/**
 * Estado do snapshot local do Novo CAGED (`data/caged-municipios.json`).
 *
 * O snapshot é gerado por `scripts/dados/gerar-caged-municipios.mjs` e lido em
 * produção por `core/lib/municipal-profile/emprego.ts`. Este módulo responde
 * uma pergunta diferente das duas: **o snapshot ainda está em dia?**
 *
 * A resposta é barata. O endpoint `Metadados` do IPEADATA devolve
 * `SERATUALIZACAO` — o instante da última atualização da série — em ~1,6 KB e
 * ~0,15 s. O gerador grava esse carimbo dentro do snapshot; comparar o gravado
 * com o remoto diz se há dado novo sem tocar nos 58 MB de valores.
 *
 * Sem esse carimbo só restaria comparar datas de calendário, que erra nos dois
 * sentidos: o IPEADATA não publica em dia fixo, e um snapshot gerado ontem
 * contra uma série parada há três meses pareceria "atrasado".
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO_SNAPSHOT = join("data", "caged-municipios.json");
const ODATA_METADADOS = "https://www.ipeadata.gov.br/api/odata4/Metadados";
const TIMEOUT_METADADOS_MS = 30_000;

/** As mesmas duas séries que o gerador consome. */
export const SERIES_CAGED = ["ADMISNC", "DESLIGNC"] as const;

export type SerieCaged = (typeof SERIES_CAGED)[number];

interface ArquivoSnapshot {
  geradoEm?: string;
  fontes?: Partial<Record<SerieCaged, string | null>>;
  competencias?: string[];
  municipios?: Record<string, unknown>;
}

export interface EstadoSerie {
  codigo: SerieCaged;
  /** `SERATUALIZACAO` gravado quando o snapshot foi gerado. */
  local: string | null;
  /** `SERATUALIZACAO` que o IPEADATA informa agora. */
  remoto: string | null;
  /** A fonte foi republicada depois da geração do snapshot. */
  temDadoNovo: boolean;
  /** Preenchido quando a consulta de metadados falhou. */
  erro?: string;
}

export interface EstadoSnapshotCaged {
  /** `false` quando o arquivo não existe ou está ilegível. */
  presente: boolean;
  geradoEm: string | null;
  primeiraCompetencia: string | null;
  ultimaCompetencia: string | null;
  municipios: number | null;
  tamanhoBytes: number | null;
  series: EstadoSerie[];
  /** Alguma série foi republicada depois da geração. */
  desatualizado: boolean;
  /** Nenhuma série pôde ser consultada — não dá para afirmar nada. */
  indeterminado: boolean;
}

function lerArquivo(): { dados: ArquivoSnapshot; tamanhoBytes: number } | null {
  const caminho = join(process.cwd(), ARQUIVO_SNAPSHOT);
  try {
    const bruto = readFileSync(caminho, "utf8");
    return { dados: JSON.parse(bruto) as ArquivoSnapshot, tamanhoBytes: statSync(caminho).size };
  } catch {
    return null;
  }
}

async function lerAtualizacaoRemota(codigo: SerieCaged): Promise<string | null> {
  const resposta = await fetch(`${ODATA_METADADOS}('${codigo}')`, {
    headers: { Accept: "application/json", "User-Agent": "Sync/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_METADADOS_MS),
    // Cache aqui derrotaria o propósito: a pergunta é justamente se a fonte
    // mudou desde a última vez.
    cache: "no-store",
  });

  if (!resposta.ok) {
    throw new Error(`IPEADATA respondeu HTTP ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as { value?: Array<{ SERATUALIZACAO?: string }> };
  return corpo.value?.[0]?.SERATUALIZACAO ?? null;
}

/**
 * Compara os dois carimbos como instantes. As strings do IPEADATA vêm com
 * fuso ("2026-07-01T10:48:02.297-03:00"), então comparação textual não serve:
 * o mesmo instante pode ser escrito de mais de uma forma.
 */
function houveRepublicacao(local: string | null, remoto: string | null): boolean {
  if (!remoto) return false;
  // Snapshot gerado por uma versão anterior do script, sem o carimbo: não dá
  // para saber se mudou. Tratar como "tem dado novo" evita afirmar que está em
  // dia sem base para isso.
  if (!local) return true;

  const instanteLocal = Date.parse(local);
  const instanteRemoto = Date.parse(remoto);
  if (!Number.isFinite(instanteLocal) || !Number.isFinite(instanteRemoto)) return false;

  return instanteRemoto > instanteLocal;
}

export async function obterEstadoSnapshotCaged(): Promise<EstadoSnapshotCaged> {
  const arquivo = lerArquivo();
  const competencias = arquivo?.dados.competencias ?? [];

  // `allSettled`: uma série fora do ar não pode impedir o diagnóstico da outra.
  const consultas = await Promise.allSettled(
    SERIES_CAGED.map((codigo) => lerAtualizacaoRemota(codigo)),
  );

  const series: EstadoSerie[] = SERIES_CAGED.map((codigo, indice) => {
    const local = arquivo?.dados.fontes?.[codigo] ?? null;
    const consulta = consultas[indice];

    if (consulta.status === "rejected") {
      const erro = consulta.reason;
      return {
        codigo,
        local,
        remoto: null,
        temDadoNovo: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      };
    }

    return {
      codigo,
      local,
      remoto: consulta.value,
      temDadoNovo: arquivo ? houveRepublicacao(local, consulta.value) : false,
    };
  });

  return {
    presente: Boolean(arquivo),
    geradoEm: arquivo?.dados.geradoEm ?? null,
    primeiraCompetencia: competencias[0] ?? null,
    ultimaCompetencia: competencias[competencias.length - 1] ?? null,
    municipios: arquivo ? Object.keys(arquivo.dados.municipios ?? {}).length : null,
    tamanhoBytes: arquivo?.tamanhoBytes ?? null,
    series,
    desatualizado: series.some((serie) => serie.temDadoNovo),
    indeterminado: series.every((serie) => Boolean(serie.erro)),
  };
}
