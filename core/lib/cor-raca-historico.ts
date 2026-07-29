import dataset from "@/data/inep/cor-raca-historico.json";

/**
 * Série histórica de matrícula por cor/raça (Censo Escolar 2023–2025),
 * agregada dos microdados do INEP por `gerar-cor-raca-historico.mjs`.
 *
 * A ordem gravada no dataset é contrato: [não declarada, branca, preta,
 * parda, amarela, indígena]. Escolas em atividade; `m` = rede municipal,
 * `p` = rede pública (federal + estadual + municipal).
 */
export interface CorRacaHistoricoAno {
  ano: number;
  total: number;
  naoDeclarada: number;
  branca: number;
  preta: number;
  parda: number;
  amarela: number;
  indigena: number;
}

export interface CorRacaHistorico {
  municipal: CorRacaHistoricoAno[];
  publica: CorRacaHistoricoAno[];
  geradoEm: string;
}

interface Bruto {
  geradoEm: string;
  fonte: string;
  anos: number[];
  municipios: Record<string, Record<string, { m: number[]; p: number[] }>>;
}

const dados = dataset as unknown as Bruto;

function desserializar(ano: number, serie: number[]): CorRacaHistoricoAno {
  const [naoDeclarada, branca, preta, parda, amarela, indigena] = serie;
  return {
    ano,
    total: naoDeclarada + branca + preta + parda + amarela + indigena,
    naoDeclarada,
    branca,
    preta,
    parda,
    amarela,
    indigena,
  };
}

export function getCorRacaHistorico(codigoIBGE: string): CorRacaHistorico | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = dados.municipios[digits];
  if (!registro) return null;

  const anos = Object.keys(registro)
    .map(Number)
    .sort((a, b) => a - b);
  if (!anos.length) return null;

  return {
    municipal: anos.map((ano) => desserializar(ano, registro[ano].m)),
    publica: anos.map((ano) => desserializar(ano, registro[ano].p)),
    geradoEm: dados.geradoEm,
  };
}
