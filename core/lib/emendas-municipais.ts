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

/**
 * Uma fatia das emendas do município — por autor, por função ou por tipo.
 * Os três cortes têm a mesma forma porque respondem à mesma pergunta com
 * chaves diferentes: quanto veio, quanto chegou, e quanto disso foi educação.
 */
export interface FatiaEmenda {
  nome: string;
  quantidade: number;
  empenhado: number;
  pago: number;
  empenhadoEducacao: number;
}

export interface EmendasMunicipio {
  anos: EmendasAno[];
  /** Top autores de emendas de educação por valor empenhado desde 2020. */
  autoresEducacao: Array<{ nome: string; empenhado: number }>;
  /**
   * **Todos** os autores que carimbaram emenda aqui, de qualquer função.
   *
   * `autoresEducacao` responde "quem já mandou dinheiro para a educação daqui"
   * e fica vazio em 86% dos municípios. Esta lista responde "quem manda
   * dinheiro para cá" — que é a pergunta de campo, porque o parlamentar que
   * emendou saúde é o mesmo interlocutor, e o fato de ele nunca ter emendado
   * educação é o próprio argumento da conversa.
   */
  autores: FatiaEmenda[];
  /** Onde o dinheiro de emenda cai: saúde, urbanismo, educação… */
  funcoes: FatiaEmenda[];
  /** Individual, de bancada, de comissão, de relator — negociações diferentes. */
  tipos: FatiaEmenda[];
  /** Dentro da função educação, para onde foi. Vazio sem emenda de educação. */
  subfuncoesEducacao: FatiaEmenda[];
  /** Autores fora do corte de 25. `null` quando todos couberam. */
  autoresDemais: { quantidade: number; empenhado: number; empenhadoEducacao: number } | null;
  fonte: string;
  geradoEm: string;
}

/** `[nome, quantidade, empenhado, pago, empenhadoEducacao]` */
type FatiaBruta = [string, number, number, number, number];

interface Bruto {
  geradoEm: string;
  fonte: string;
  anoMinimo: number;
  anos: number[];
  municipios: Record<
    string,
    {
      anos: Record<string, number[]>;
      autoresEducacao?: Array<[string, number]>;
      autores?: FatiaBruta[];
      funcoes?: FatiaBruta[];
      tipos?: FatiaBruta[];
      subfuncoesEducacao?: FatiaBruta[];
      autoresDemais?: [number, number, number];
    }
  >;
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

  const fatias = (brutas: FatiaBruta[] | undefined): FatiaEmenda[] =>
    (brutas ?? []).map(([nome, quantidade, empenhado, pago, empenhadoEducacao]) => ({
      nome,
      quantidade,
      empenhado,
      pago,
      empenhadoEducacao,
    }));

  const demais = registro.autoresDemais;

  return {
    anos,
    autoresEducacao: (registro.autoresEducacao ?? []).map(([nome, empenhado]) => ({ nome, empenhado })),
    autores: fatias(registro.autores),
    funcoes: fatias(registro.funcoes),
    tipos: fatias(registro.tipos),
    subfuncoesEducacao: fatias(registro.subfuncoesEducacao),
    autoresDemais: demais
      ? { quantidade: demais[0], empenhado: demais[1], empenhadoEducacao: demais[2] }
      : null,
    fonte: dados.fonte,
    geradoEm: dados.geradoEm,
  };
}
