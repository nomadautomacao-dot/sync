"use client";

/**
 * Painel de manutenção do snapshot local do Novo CAGED.
 *
 * Existe porque a fonte do bloco Emprego não é uma API consultável por
 * município: o IPEADATA ignora `$filter` e devolve 58 MB por série. O dado
 * mora em `data/caged-municipios.json`, versionado no git, e alguém precisa
 * decidir quando regerá-lo. Esta tela é esse alguém.
 *
 * Só aparece em desenvolvimento — a rota que ela consome escreve no repositório
 * de trabalho, o que não faz sentido no Cloud Run (ver o docblock de
 * `app/api/dev/dados/caged/route.ts`).
 */

import { useState } from "react";
import { CloudDownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Flex, List, Tag, Typography, theme } from "antd";

const { Text, Paragraph } = Typography;

interface EstadoSerie {
  codigo: string;
  local: string | null;
  remoto: string | null;
  temDadoNovo: boolean;
  erro?: string;
}

interface EstadoSnapshot {
  presente: boolean;
  geradoEm: string | null;
  primeiraCompetencia: string | null;
  ultimaCompetencia: string | null;
  municipios: number | null;
  tamanhoBytes: number | null;
  series: EstadoSerie[];
  desatualizado: boolean;
  indeterminado: boolean;
}

const ROTA = "/api/dev/dados/caged";

function formatarInstante(valor: string | null) {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarTamanho(bytes: number | null) {
  if (bytes === null) return "—";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Cabeçalho do card: o veredito em uma frase, antes de qualquer detalhe. */
function Veredito({ estado }: { estado: EstadoSnapshot }) {
  if (!estado.presente) {
    return (
      <Alert
        type="error"
        showIcon
        message="Snapshot ausente. O relatório cai no download de ~117 MB a cada reinício do servidor."
      />
    );
  }
  if (estado.indeterminado) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Não foi possível falar com o IPEADATA. O snapshot local continua servindo normalmente."
      />
    );
  }
  if (estado.desatualizado) {
    return (
      <Alert
        type="warning"
        showIcon
        message="O IPEADATA republicou a série depois desta cópia. Há dado novo para baixar."
      />
    );
  }
  return <Alert type="success" showIcon message="Em dia com a fonte. Nada a baixar." />;
}

export function DadosLocaisCaged() {
  const { token } = theme.useToken();
  const [estado, setEstado] = useState<EstadoSnapshot | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);

  async function verificar() {
    setVerificando(true);
    setErro(null);
    setLog(null);
    try {
      const resposta = await fetch(ROTA, { cache: "no-store" });
      if (!resposta.ok) throw new Error(`A verificação falhou (HTTP ${resposta.status}).`);
      setEstado((await resposta.json()) as EstadoSnapshot);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setVerificando(false);
    }
  }

  async function atualizar() {
    setBaixando(true);
    setErro(null);
    setLog(null);
    try {
      const resposta = await fetch(ROTA, { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setLog(corpo.log ?? null);
        throw new Error(corpo.error ?? `A atualização falhou (HTTP ${resposta.status}).`);
      }
      setLog(corpo.log ?? null);
      setEstado(corpo.estado as EstadoSnapshot);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      setBaixando(false);
    }
  }

  const ocupado = verificando || baixando;
  // Baixar 117 MB sem saber se há motivo é justamente o que esta tela evita:
  // o botão só libera depois que a verificação apontou dado novo (ou a
  // ausência do arquivo).
  const podeAtualizar = Boolean(estado && (estado.desatualizado || !estado.presente));

  return (
    <Card
      title="Novo CAGED — dados locais"
      extra={
        <Tag style={{ fontFamily: "var(--font-sync-mono)" }} variant="filled">
          dev
        </Tag>
      }
    >
      <Paragraph type="secondary" style={{ maxWidth: 460 }}>
        Emprego formal do Raio-X municipal. A fonte não permite consulta por município, então o
        recorte fica em <Text code>data/caged-municipios.json</Text>.
      </Paragraph>

      <Flex gap={8} wrap>
        <Button type="primary" icon={<ReloadOutlined />} loading={verificando} disabled={ocupado} onClick={verificar}>
          {verificando ? "Verificando…" : "Verificar dados"}
        </Button>

        <Button
          icon={<CloudDownloadOutlined />}
          loading={baixando}
          disabled={ocupado || !podeAtualizar}
          onClick={atualizar}
          title={
            podeAtualizar
              ? "Baixa ~117 MB do IPEADATA e regrava o snapshot"
              : "Verifique primeiro; o botão libera se houver dado novo"
          }
        >
          {baixando ? "Baixando… (~80s)" : "Atualizar agora"}
        </Button>
      </Flex>

      {erro && <Alert style={{ marginTop: 16 }} type="error" showIcon message={erro} />}

      {estado && (
        <Flex vertical gap={16} style={{ marginTop: 16 }}>
          <Veredito estado={estado} />

          <Descriptions
            size="small"
            column={1}
            items={[
              { key: "gerado", label: "Gerado em", children: formatarInstante(estado.geradoEm) },
              {
                key: "competencias",
                label: "Competências",
                children: estado.primeiraCompetencia
                  ? `${estado.primeiraCompetencia} a ${estado.ultimaCompetencia}`
                  : "—",
              },
              {
                key: "municipios",
                label: "Municípios",
                children: estado.municipios?.toLocaleString("pt-BR") ?? "—",
              },
              { key: "tamanho", label: "Tamanho", children: formatarTamanho(estado.tamanhoBytes) },
            ]}
          />

          <div>
            <Text
              type="secondary"
              style={{
                fontFamily: "var(--font-sync-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Séries na fonte
            </Text>
            <List
              size="small"
              bordered
              style={{ marginTop: 8 }}
              dataSource={estado.series}
              renderItem={(serie) => (
                <List.Item key={serie.codigo}>
                  <Flex justify="space-between" align="center" style={{ width: "100%", gap: 12 }}>
                    <Text strong style={{ fontFamily: "var(--font-sync-mono)" }}>
                      {serie.codigo}
                    </Text>
                    <Text type={serie.erro ? "danger" : "secondary"} style={{ textAlign: "right" }}>
                      {serie.erro ? (
                        serie.erro
                      ) : (
                        <>
                          cópia {formatarInstante(serie.local)} · fonte {formatarInstante(serie.remoto)}
                          {serie.temDadoNovo && (
                            <Tag color="warning" style={{ marginLeft: 8 }}>
                              novo
                            </Tag>
                          )}
                        </>
                      )}
                    </Text>
                  </Flex>
                </List.Item>
              )}
            />
          </div>
        </Flex>
      )}

      {log && (
        <pre
          style={{
            marginTop: 16,
            maxHeight: 208,
            overflow: "auto",
            borderRadius: token.borderRadius,
            background: token.colorFillTertiary,
            padding: "10px 12px",
            fontFamily: "var(--font-sync-mono)",
            fontSize: 11,
            lineHeight: 1.6,
            color: token.colorText,
          }}
        >
          {log}
        </pre>
      )}

      {estado?.desatualizado === false && estado.presente && (
        <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
          Depois de atualizar, comite <Text code>data/caged-municipios.json</Text> — é o commit que
          leva o dado para o deploy e para as outras máquinas.
        </Paragraph>
      )}
    </Card>
  );
}
