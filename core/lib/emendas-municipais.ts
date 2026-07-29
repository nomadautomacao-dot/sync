import dataset from "@/data/portal-transparencia/emendas-municipios.json";

/**
 * Emendas parlamentares com aplicação carimbada no município (roadmap #28),
 * agregadas do download de dados do Portal da Transparência.
 *
 * Cobertura honesta: só entram as emendas cujo gasto o Portal vincula a um
 * código IBGE. Emendas de aplicação estadual ou nacional que beneficiam o
 * município de forma difusa ficam de fora — o dataset responde "quanto
 * dinheiro de emenda chegou carimbado aqui", não "quanto o município se
 * beneficiou de emendas".
 */
export interface EmendasAno {
  ano: number;
  quantidade: number;
  empenhado: number;
  pago: number;
  quantidadeEducacao: number;
  empenhadoEducacao: number;
  pagoEducacao: number;
}

export interface EmendasMunicipio {
  anos: EmendasAno[];
  /** Top autores de emendas de educação por valor empenhado desde 2020. */
  autoresEducacao: Array<{ nome: string; empenhado: number }>;
  fonte: string;
  geradoEm: string;
}

interface Bruto {
  geradoEm: string;
  fonte: string;
  anoMinimo: number;
  anos: number[];
  municipios: Record<string, { anos: Record<string, number[]>; autoresEducacao?: Array<[string, number]> }>;
}

const dados = dataset as unknown as Bruto;

export function getEmendasMunicipio(codigoIBGE: string): EmendasMunicipio | null {
  const digits = codigoIBGE.replace(/\D/g, "");
  const registro = dados.municipios[digits];
  if (!registro) return null;

  const anos = Object.entries(registro.anos)
    .map(([ano, serie]) => ({
      ano: Number(ano),
      quantidade: serie[0] ?? 0,
      empenhado: serie[1] ?? 0,
      pago: serie[2] ?? 0,
      quantidadeEducacao: serie[3] ?? 0,
      empenhadoEducacao: serie[4] ?? 0,
      pagoEducacao: serie[5] ?? 0,
    }))
    .sort((a, b) => a.ano - b.ano);
  if (!anos.length) return null;

  return {
    anos,
    autoresEducacao: (registro.autoresEducacao ?? []).map(([nome, empenhado]) => ({ nome, empenhado })),
    fonte: dados.fonte,
    geradoEm: dados.geradoEm,
  };
}
