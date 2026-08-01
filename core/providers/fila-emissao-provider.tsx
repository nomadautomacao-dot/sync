"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CaretDownOutlined,
  CaretUpOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  LoadingOutlined,
} from "@ant-design/icons";
import { Badge, Button, Card, Flex, List, Typography, theme } from "antd";

import { getCity } from "@/core/lib/cities-firestore";
import {
  getFirebaseDb,
  getFirebaseStorage,
} from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";
import { arquivarEmissao, emitirPdf } from "@/modules/cidades/emissao";
import {
  atualizarJob,
  enfileirarDocumentos,
  listarJobsAbertos,
  type AlvoDaFila,
  type JobDeEmissao,
} from "@/modules/cidades/fila-emissao-firestore";
import { DOCUMENTOS } from "@/app/(sync)/modulos/levantamento-fundeb/_components/documentos";

/**
 * O processador da fila de emissão.
 *
 * Fica montado no shell inteiro, e não numa tela: é o que permite enfileirar os
 * relatórios de um município e sair navegando — mudar de aba não interrompe o
 * que está no meio. O que interrompe é fechar a janela, e para isso a fila mora
 * no Firestore: ao reabrir, este provedor encontra o que ficou pendente e
 * continua sozinho.
 *
 * **Um de cada vez, sempre.** Cada relatório abre um Chromium no servidor e
 * consulta uma dúzia de fontes públicas; dois em paralelo competem por memória
 * e multiplicam a chance de a fonte responder com bloqueio por excesso.
 */

const { Text } = Typography;

interface FilaDeEmissao {
  jobs: JobDeEmissao[];
  processando: JobDeEmissao | null;
  enfileirar: (
    alvo: AlvoDaFila,
    documentos: readonly string[],
  ) => Promise<number>;
  repetir: (jobId: string) => Promise<void>;
}

const ContextoDaFila = createContext<FilaDeEmissao | null>(null);

export function useFilaDeEmissao(): FilaDeEmissao {
  const contexto = useContext(ContextoDaFila);
  if (!contexto) {
    throw new Error("useFilaDeEmissao precisa estar dentro de FilaEmissaoProvider.");
  }
  return contexto;
}

export function FilaEmissaoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<JobDeEmissao[]>([]);
  const [processando, setProcessando] = useState<JobDeEmissao | null>(null);
  /* Guarda contra dois laços simultâneos: o efeito de montagem e um enfileirar
     manual podem chamar `processar` no mesmo instante. */
  const rodando = useRef(false);

  const recarregar = useCallback(async () => {
    if (!user?.groupId) return [];
    const abertos = await listarJobsAbertos(getFirebaseDb(), user.groupId);
    setJobs(abertos);
    return abertos;
  }, [user]);

  const processar = useCallback(async () => {
    if (rodando.current || !user?.groupId) return;
    rodando.current = true;

    try {
      const db = getFirebaseDb();
      const storage = getFirebaseStorage();

      for (;;) {
        const abertos = await listarJobsAbertos(db, user.groupId);
        setJobs(abertos);
        const job = abertos.find((candidato) => candidato.status === "pendente");
        if (!job) break;

        setProcessando(job);
        await atualizarJob(db, job.id, { status: "gerando" });

        try {
          const documento = DOCUMENTOS.find(
            (candidato) => candidato.id === job.documentoId,
          );
          if (!documento) {
            throw new Error(`Documento desconhecido: ${job.documentoId}.`);
          }

          const cidade = await getCity(db, job.cityId);
          if (!cidade) {
            throw new Error("A cidade saiu da carteira antes da emissão.");
          }

          const emitido = await emitirPdf(documento, {
            codigoIbge: job.codigoIbge,
            nome: job.cityName,
            uf: job.cityUf,
            regiao: job.regiao,
          });

          await arquivarEmissao({
            db,
            storage,
            cidade,
            documento,
            emitido,
            usuario: {
              id: user.id,
              name: user.name,
              groupId: user.groupId,
            },
          });

          await atualizarJob(db, job.id, { status: "concluido" });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["city-documents"] }),
            queryClient.invalidateQueries({ queryKey: ["city-reports"] }),
            queryClient.invalidateQueries({ queryKey: ["cities"] }),
          ]);
        } catch (erro) {
          /* Sem nova tentativa automática: quando uma fonte pública cai, ela
             fica fora por horas, e reenfileirar sozinho vira laço de milhares
             de requisições. O painel mostra a falha com botão de repetir. */
          await atualizarJob(db, job.id, {
            status: "erro",
            erro: erro instanceof Error ? erro.message : String(erro),
            tentativas: job.tentativas + 1,
          });
        } finally {
          setProcessando(null);
        }
      }

      await recarregar();
    } finally {
      rodando.current = false;
    }
  }, [queryClient, recarregar, user]);

  /* Ao abrir o app: o que ficou marcado como "gerando" é resto de uma sessão
     que morreu no meio — nenhuma janela está cuidando dele. Volta para a fila. */
  useEffect(() => {
    if (!user?.groupId) return;
    let cancelado = false;

    (async () => {
      const db = getFirebaseDb();
      const abertos = await listarJobsAbertos(db, user.groupId);
      if (cancelado) return;
      for (const job of abertos) {
        if (job.status === "gerando") {
          await atualizarJob(db, job.id, { status: "pendente" });
        }
      }
      if (!cancelado) void processar();
    })().catch((erro) => {
      console.warn("Não foi possível retomar a fila de emissão:", erro);
    });

    return () => {
      cancelado = true;
    };
  }, [processar, user?.groupId]);

  const enfileirar = useCallback(
    async (alvo: AlvoDaFila, documentos: readonly string[]) => {
      if (!user?.groupId) return 0;
      const escolhidos = DOCUMENTOS.filter((documento) =>
        documentos.includes(documento.id),
      ).map((documento) => ({ id: documento.id, nome: documento.nome }));

      const criados = await enfileirarDocumentos(
        getFirebaseDb(),
        user.groupId,
        alvo,
        escolhidos,
      );
      await recarregar();
      void processar();
      return criados;
    },
    [processar, recarregar, user],
  );

  const repetir = useCallback(
    async (jobId: string) => {
      await atualizarJob(getFirebaseDb(), jobId, {
        status: "pendente",
        erro: "",
      });
      await recarregar();
      void processar();
    },
    [processar, recarregar],
  );

  return (
    <ContextoDaFila.Provider
      value={{ jobs, processando, enfileirar, repetir }}
    >
      {children}
      <PainelDaFila jobs={jobs} processando={processando} repetir={repetir} />
    </ContextoDaFila.Provider>
  );
}

/**
 * O aviso flutuante. Fica no canto inferior direito e só existe quando há fila
 * — um painel permanente de "nada acontecendo" é ruído numa tela de trabalho.
 */
function PainelDaFila({
  jobs,
  processando,
  repetir,
}: {
  jobs: JobDeEmissao[];
  processando: JobDeEmissao | null;
  repetir: (jobId: string) => Promise<void>;
}) {
  const { token } = theme.useToken();
  const [aberto, setAberto] = useState(false);
  const pendentes = jobs.filter((job) => job.status === "pendente").length;
  const comErro = jobs.filter((job) => job.status === "erro").length;
  const total = jobs.length;

  if (!total) return null;

  return (
    <Card
      size="small"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1000,
        width: 320,
        boxShadow: token.boxShadowSecondary,
      }}
      styles={{ body: { padding: 0 } }}
    >
      <Button
        type="text"
        block
        onClick={() => setAberto((estava) => !estava)}
        aria-expanded={aberto}
        style={{ height: "auto", padding: "10px 14px", textAlign: "left" }}
      >
        <Flex align="center" gap={10} style={{ width: "100%" }}>
          {processando ? (
            <LoadingOutlined spin style={{ color: token.colorText }} />
          ) : comErro ? (
            <ExclamationCircleFilled style={{ color: token.colorError }} />
          ) : (
            <CheckCircleFilled style={{ color: token.colorSuccess }} />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text strong ellipsis style={{ display: "block", fontSize: 11.5 }}>
              {processando
                ? `Gerando ${processando.documentoNome}`
                : comErro
                  ? `${comErro} emissão(ões) falharam`
                  : "Fila de emissão"}
            </Text>
            <Text
              type="secondary"
              ellipsis
              style={{ display: "block", fontFamily: "var(--font-sync-mono)", fontSize: 9.5 }}
            >
              {processando
                ? `${processando.cityName} · ${pendentes} na fila`
                : `${total} pedido(s)`}
            </Text>
          </div>
          {aberto ? (
            <CaretUpOutlined style={{ color: token.colorTextTertiary }} />
          ) : (
            <CaretDownOutlined style={{ color: token.colorTextTertiary }} />
          )}
        </Flex>
      </Button>

      {aberto && (
        <List
          size="small"
          style={{
            maxHeight: 260,
            overflowY: "auto",
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
          dataSource={jobs}
          renderItem={(job) => (
            <List.Item
              style={{ paddingInline: 14 }}
              actions={
                job.status === "erro"
                  ? [
                      <Button key="repetir" size="small" onClick={() => void repetir(job.id)}>
                        Repetir
                      </Button>,
                    ]
                  : undefined
              }
            >
              <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
                {job.status === "gerando" ? (
                  <LoadingOutlined spin style={{ fontSize: 11, color: token.colorText }} />
                ) : job.status === "erro" ? (
                  <ExclamationCircleFilled style={{ fontSize: 11, color: token.colorError }} />
                ) : (
                  <Badge status="default" />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text strong ellipsis style={{ display: "block", fontSize: 10.5 }}>
                    {job.documentoNome}
                  </Text>
                  <Text
                    type={job.status === "erro" ? "danger" : "secondary"}
                    ellipsis
                    title={job.erro}
                    style={{ display: "block", fontFamily: "var(--font-sync-mono)", fontSize: 9 }}
                  >
                    {job.status === "erro" ? job.erro || "falhou" : `${job.cityName} · ${job.cityUf}`}
                  </Text>
                </div>
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
