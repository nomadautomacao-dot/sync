/**
 * As duas vias de contratação direta da Lei 14.133/21 — e o kit sabe as duas.
 *
 * Até 2026-08-14 o processo saía sempre como **inexigibilidade** (Art. 74),
 * porque era o que o modelo herdado dizia. Mas a via é escolha do caso: a
 * inexigibilidade exige inviabilidade de competição (notória especialização,
 * serviço singular); a **dispensa** (Art. 75) é o caminho quando a licitação é
 * possível mas a lei permite deixá-la de lado — tipicamente pelo valor.
 *
 * Errar a via não é detalhe de nomenclatura: é o fundamento do processo
 * inteiro, e o parecer jurídico da prefeitura é onde isso aparece. Por isso a
 * escolha é explícita, o fundamento vai por extenso no documento, e o sistema
 * avisa quando o valor não cabe na hipótese escolhida.
 */

export type ViaDeContratacao = "inexigibilidade" | "dispensa";

export interface FundamentoLegal {
  id: string;
  /** O que aparece no seletor. */
  rotulo: string;
  /** A frase que entra no documento, na íntegra. */
  texto: string;
  /** `true` quando a hipótese é limitada pelo valor da contratação. */
  limitadaPorValor?: boolean;
}

export interface Via {
  key: ViaDeContratacao;
  /** "Dispensa de Licitação" — vai no título das peças. */
  nome: string;
  /** "Dispensa" — vai onde o texto já diz "de licitação" ao lado. */
  nomeCurto: string;
  artigo: string;
  descricao: string;
  fundamentos: FundamentoLegal[];
}

export const VIAS_DE_CONTRATACAO: Via[] = [
  {
    key: "dispensa",
    nome: "Dispensa de Licitação",
    nomeCurto: "Dispensa",
    artigo: "Art. 75 da Lei nº 14.133/2021",
    descricao:
      "A competição seria possível, mas a lei autoriza contratar direto — em regra, pelo valor.",
    fundamentos: [
      {
        id: "75-II",
        rotulo: "Art. 75, II — outros serviços e compras (limite por valor)",
        texto:
          'Art. 75, inciso II, da Lei Federal nº 14.133/2021, por se tratar de contratação de serviços cujo valor não ultrapassa o limite legal para dispensa',
        limitadaPorValor: true,
      },
      {
        id: "75-IV",
        rotulo: "Art. 75, IV — hipóteses específicas (alíneas)",
        texto:
          "Art. 75, inciso IV, da Lei Federal nº 14.133/2021, por enquadrar-se em hipótese específica de dispensa de licitação",
      },
      {
        id: "75-VIII",
        rotulo: "Art. 75, VIII — emergência ou calamidade",
        texto:
          "Art. 75, inciso VIII, da Lei Federal nº 14.133/2021, em razão de emergência ou de calamidade pública",
      },
    ],
  },
  {
    key: "inexigibilidade",
    nome: "Inexigibilidade de Licitação",
    nomeCurto: "Inexigibilidade",
    artigo: "Art. 74 da Lei nº 14.133/2021",
    descricao:
      "A competição é inviável — serviço técnico especializado de natureza intelectual, com notória especialização.",
    fundamentos: [
      {
        id: "74-III-f",
        rotulo: 'Art. 74, III, "f" — treinamento e aperfeiçoamento de pessoal',
        texto:
          'Art. 74, inciso III, alínea "f", da Lei Federal nº 14.133/2021, por se tratar de serviço técnico especializado de natureza predominantemente intelectual, com profissional ou empresa de notória especialização',
      },
      {
        id: "74-III-c",
        rotulo: 'Art. 74, III, "c" — assessoria e consultoria técnica',
        texto:
          'Art. 74, inciso III, alínea "c", da Lei Federal nº 14.133/2021, por se tratar de assessoria ou consultoria técnica de natureza predominantemente intelectual, com profissional ou empresa de notória especialização',
      },
    ],
  },
];

export function viaPorKey(key: ViaDeContratacao): Via {
  const via = VIAS_DE_CONTRATACAO.find((v) => v.key === key);
  if (!via) throw new Error(`Via de contratação desconhecida: ${key}`);
  return via;
}

export function fundamentoPorId(id: string): FundamentoLegal | undefined {
  return VIAS_DE_CONTRATACAO.flatMap((via) => via.fundamentos).find((f) => f.id === id);
}

/** O fundamento padrão de cada via — o primeiro da lista, o mais usado. */
export function fundamentoPadrao(key: ViaDeContratacao): FundamentoLegal {
  return viaPorKey(key).fundamentos[0];
}

/**
 * O teto da dispensa por valor, em centavos.
 *
 * **Este número muda todo ano.** O Art. 75 traz R$ 50.000 para "outros
 * serviços e compras", e o Executivo federal o atualiza por decreto — o valor
 * abaixo é o do Decreto 11.871/2023 (exercício de 2024). Antes de usar a
 * dispensa por valor num processo real, confira o decreto vigente: o alerta
 * daqui serve para pegar o erro grosseiro (contrato de seis dígitos entrando
 * como dispensa por valor), não para dar a palavra final.
 */
export const LIMITE_DISPENSA_POR_VALOR_CENTS = 5_990_602;

/**
 * O aviso quando o valor não cabe na hipótese escolhida — `null` quando não
 * há o que avisar.
 *
 * A comparação é com o valor **global** do contrato, e não com o mensal: o
 * limite da dispensa vale para o total contratado no exercício para o mesmo
 * objeto. Comparar pelo mensal deixaria passar exatamente o caso que este
 * aviso existe para pegar — parcelar o mesmo serviço até caber no teto.
 */
export function avisoDeLimite(
  fundamentoId: string,
  valorGlobalCents: number,
): string | null {
  const fundamento = fundamentoPorId(fundamentoId);
  if (!fundamento?.limitadaPorValor) return null;
  if (valorGlobalCents <= LIMITE_DISPENSA_POR_VALOR_CENTS) return null;

  const formatar = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      cents / 100,
    );

  return (
    `O valor global de ${formatar(valorGlobalCents)} ultrapassa o limite da dispensa por valor ` +
    `(${formatar(LIMITE_DISPENSA_POR_VALOR_CENTS)}, valor de referência atualizado anualmente por decreto). ` +
    `Confira o decreto vigente e, se o valor não couber, use outro fundamento ou a via de inexigibilidade.`
  );
}

/**
 * As chaves que os templates DOCX consomem. Ficam aqui, e não no gerador,
 * porque são a tradução da escolha para o papel — quem muda a nomenclatura
 * muda num lugar só.
 */
export interface CamposDaVia {
  modalidadeNome: string;
  modalidadeNomeUpper: string;
  modalidadeCurta: string;
  modalidadeCurtaUpper: string;
  baseLegal: string;
}

export function camposDaVia(
  key: ViaDeContratacao,
  fundamentoId?: string,
): CamposDaVia {
  const via = viaPorKey(key);
  const fundamento =
    (fundamentoId && fundamentoPorId(fundamentoId)) || fundamentoPadrao(key);

  return {
    modalidadeNome: via.nome,
    modalidadeNomeUpper: via.nome.toLocaleUpperCase("pt-BR"),
    modalidadeCurta: via.nomeCurto,
    modalidadeCurtaUpper: via.nomeCurto.toLocaleUpperCase("pt-BR"),
    baseLegal: fundamento.texto,
  };
}
