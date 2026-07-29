/**
 * Abstenção no ENEM — o termômetro público de quanto o fim da educação
 * básica "aponta para algum lugar".
 *
 * Os dados vêm de `data/inep/enem-abstencao.json`, gerado offline por
 * `scripts/dados/gerar-enem-abstencao.mjs` a partir dos microdados do ENEM.
 *
 * ## Limitação honesta (pós-LGPD)
 *
 * O microdado não publica mais o município de residência — só o de **prova**.
 * Município pequeno sem local de aplicação não aparece (os candidatos provam
 * na cidade-polo), e o número de um município-sede inclui vizinhos. A
 * comparação com a UF continua válida porque o recorte é o mesmo dos dois
 * lados. Abstenção = ausência nos dois dias.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVO = join("data", "inep", "enem-abstencao.json");

export interface EnemAbstencaoMunicipio {
  fonte: string;
  ano: number;
  inscritos: number;
  ausentes: number;
  pctAbstencao: number;
  /** Agregado da UF de prova, para a comparação. */
  uf: { sigla: string; inscritos: number; pctAbstencao: number } | null;
}

interface ArquivoEnem {
  fonte?: string;
  ano?: number;
  ufs?: Record<string, { inscritos?: number; pctAbstencao?: number }>;
  municipios?: Record<string, { inscritos?: number; ausentes?: number; pctAbstencao?: number }>;
}

let cache: ArquivoEnem | null | undefined;

function carregar(): ArquivoEnem | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ARQUIVO), "utf8")) as ArquivoEnem;
  } catch {
    // Dataset ausente: o bloco some do relatório em vez de derrubar a geração.
    cache = null;
  }
  return cache;
}

export function getEnemAbstencao(codigoIBGE: string, ufSigla: string): EnemAbstencaoMunicipio | null {
  const arquivo = carregar();
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = arquivo?.municipios?.[digits];
  if (
    !arquivo ||
    !registro ||
    typeof registro.inscritos !== "number" ||
    typeof registro.pctAbstencao !== "number"
  ) {
    return null;
  }

  const sigla = ufSigla.trim().toUpperCase();
  const uf = arquivo.ufs?.[sigla];

  return {
    fonte: arquivo.fonte ?? "INEP — microdados do ENEM, por município de prova",
    ano: arquivo.ano ?? 0,
    inscritos: registro.inscritos,
    ausentes: registro.ausentes ?? 0,
    pctAbstencao: registro.pctAbstencao,
    uf:
      uf && typeof uf.inscritos === "number" && typeof uf.pctAbstencao === "number"
        ? { sigla, inscritos: uf.inscritos, pctAbstencao: uf.pctAbstencao }
        : null,
  };
}
