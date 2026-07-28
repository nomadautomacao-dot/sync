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
import { RefreshCwIcon, DownloadIcon, CheckCircle2Icon, AlertCircleIcon } from "lucide-react";

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
      <Faixa tom="erro" icone={<AlertCircleIcon size={15} />}>
        Snapshot ausente. O relatório cai no download de ~117 MB a cada reinício do servidor.
      </Faixa>
    );
  }
  if (estado.indeterminado) {
    return (
      <Faixa tom="aviso" icone={<AlertCircleIcon size={15} />}>
        Não foi possível falar com o IPEADATA. O snapshot local continua servindo normalmente.
      </Faixa>
    );
  }
  if (estado.desatualizado) {
    return (
      <Faixa tom="aviso" icone={<AlertCircleIcon size={15} />}>
        O IPEADATA republicou a série depois desta cópia. Há dado novo para baixar.
      </Faixa>
    );
  }
  return (
    <Faixa tom="ok" icone={<CheckCircle2Icon size={15} />}>
      Em dia com a fonte. Nada a baixar.
    </Faixa>
  );
}

function Faixa({
  tom,
  icone,
  children,
}: {
  tom: "ok" | "aviso" | "erro";
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  const estilo = {
    ok: "bg-success-light text-success-dark",
    aviso: "bg-warning-light text-warning-dark",
    erro: "bg-error-light text-error-dark",
  }[tom];

  return (
    <div className={`flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[13px] ${estilo}`}>
      <span className="mt-px shrink-0">{icone}</span>
      <span className="leading-snug">{children}</span>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[13px] text-soft">{rotulo}</span>
      <span className="text-[13px] font-medium text-title tabular-nums">{valor}</span>
    </div>
  );
}

export function DadosLocaisCaged() {
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
    <section className="rounded-[14px] border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-title">Novo CAGED — dados locais</h2>
          <p className="mt-1 max-w-[420px] text-[13px] leading-relaxed text-soft">
            Emprego formal do Raio-X municipal. A fonte não permite consulta por município, então o
            recorte fica em <code className="text-[12px]">data/caged-municipios.json</code>.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-light px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.8px] text-soft">
          dev
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={verificar}
          disabled={ocupado}
          className="inline-flex h-10 items-center gap-2 rounded-[20px] bg-[#16181D] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#2C2F38] disabled:opacity-50"
        >
          <RefreshCwIcon size={15} className={verificando ? "animate-spin" : undefined} />
          {verificando ? "Verificando…" : "Verificar dados"}
        </button>

        <button
          type="button"
          onClick={atualizar}
          disabled={ocupado || !podeAtualizar}
          title={
            podeAtualizar
              ? "Baixa ~117 MB do IPEADATA e regrava o snapshot"
              : "Verifique primeiro; o botão libera se houver dado novo"
          }
          className="inline-flex h-10 items-center gap-2 rounded-[20px] border border-line-stronger px-4 text-[14px] font-semibold text-title transition-colors hover:bg-surface-hover disabled:opacity-40"
        >
          <DownloadIcon size={15} />
          {baixando ? "Baixando… (~80s)" : "Atualizar agora"}
        </button>
      </div>

      {erro && (
        <div className="mt-4">
          <Faixa tom="erro" icone={<AlertCircleIcon size={15} />}>
            {erro}
          </Faixa>
        </div>
      )}

      {estado && (
        <div className="mt-4 space-y-4">
          <Veredito estado={estado} />

          <div className="rounded-[10px] bg-surface-subtle px-4 py-2">
            <Linha rotulo="Gerado em" valor={formatarInstante(estado.geradoEm)} />
            <Linha
              rotulo="Competências"
              valor={
                estado.primeiraCompetencia
                  ? `${estado.primeiraCompetencia} a ${estado.ultimaCompetencia}`
                  : "—"
              }
            />
            <Linha
              rotulo="Municípios"
              valor={estado.municipios?.toLocaleString("pt-BR") ?? "—"}
            />
            <Linha rotulo="Tamanho" valor={formatarTamanho(estado.tamanhoBytes)} />
          </div>

          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[1px] text-dim">
              Séries na fonte
            </p>
            <div className="mt-2 space-y-2">
              {estado.series.map((serie) => (
                <div
                  key={serie.codigo}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-line px-3 py-2"
                >
                  <span className="font-mono text-[12px] font-semibold text-title">
                    {serie.codigo}
                  </span>
                  <span className="text-right text-[12px] text-soft">
                    {serie.erro ? (
                      <span className="text-error-dark">{serie.erro}</span>
                    ) : (
                      <>
                        cópia {formatarInstante(serie.local)} · fonte{" "}
                        {formatarInstante(serie.remoto)}
                        {serie.temDadoNovo && (
                          <span className="ml-2 font-semibold text-warning-dark">novo</span>
                        )}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {log && (
        <pre className="mt-4 max-h-52 overflow-auto rounded-[10px] bg-surface-alt px-3 py-2.5 font-mono text-[11px] leading-relaxed text-body">
          {log}
        </pre>
      )}

      {estado?.desatualizado === false && estado.presente && (
        <p className="mt-4 text-[12px] leading-relaxed text-dim">
          Depois de atualizar, comite <code>data/caged-municipios.json</code> — é o commit que leva
          o dado para o deploy e para as outras máquinas.
        </p>
      )}
    </section>
  );
}
