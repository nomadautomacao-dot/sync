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
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  LoaderIcon,
} from "lucide-react";

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
  const [aberto, setAberto] = useState(false);
  const pendentes = jobs.filter((job) => job.status === "pendente").length;
  const comErro = jobs.filter((job) => job.status === "erro").length;
  const total = jobs.length;

  if (!total) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[320px] overflow-hidden rounded-[16px] border border-white/95 bg-white/95 shadow-[0_18px_44px_rgba(22,24,29,.18)] backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setAberto((estava) => !estava)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[#FAFAFC]"
      >
        {processando ? (
          <LoaderIcon className="size-4 shrink-0 animate-spin text-[#16181D]" />
        ) : comErro ? (
          <AlertCircleIcon className="size-4 shrink-0 text-[#E5484D]" />
        ) : (
          <CheckCircle2Icon className="size-4 shrink-0 text-[#1F6A47]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] font-bold text-[#16181D]">
            {processando
              ? `Gerando ${processando.documentoNome}`
              : comErro
                ? `${comErro} emissão(ões) falharam`
                : "Fila de emissão"}
          </div>
          <div className="truncate font-mono text-[9.5px] text-[#A2A6B2]">
            {processando
              ? `${processando.cityName} · ${pendentes} na fila`
              : `${total} pedido(s)`}
          </div>
        </div>
        {aberto ? (
          <ChevronDownIcon className="size-3.5 shrink-0 text-[#A2A6B2]" />
        ) : (
          <ChevronUpIcon className="size-3.5 shrink-0 text-[#A2A6B2]" />
        )}
      </button>

      {aberto && (
        <div className="max-h-[260px] overflow-y-auto border-t border-[#F0F1F5]">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-2 border-b border-[#F4F4F8] px-3.5 py-2 last:border-0"
            >
              {job.status === "gerando" ? (
                <LoaderIcon className="size-3 shrink-0 animate-spin text-[#16181D]" />
              ) : job.status === "erro" ? (
                <AlertCircleIcon className="size-3 shrink-0 text-[#E5484D]" />
              ) : (
                <span className="size-1.5 shrink-0 rounded-full bg-[#D6D7DE]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10.5px] font-semibold text-[#3B3F4A]">
                  {job.documentoNome}
                </div>
                <div
                  className={`truncate font-mono text-[9px] ${
                    job.status === "erro" ? "text-[#991B1B]" : "text-[#A2A6B2]"
                  }`}
                  title={job.erro}
                >
                  {job.status === "erro"
                    ? job.erro || "falhou"
                    : `${job.cityName} · ${job.cityUf}`}
                </div>
              </div>
              {job.status === "erro" && (
                <button
                  type="button"
                  onClick={() => void repetir(job.id)}
                  className="shrink-0 rounded-full bg-[#F2F1F7] px-2.5 py-1 text-[9.5px] font-bold text-[#3B3F4A] transition-colors hover:bg-[#ECEBF2]"
                >
                  Repetir
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
