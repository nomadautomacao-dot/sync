import type { GeneroAutoridade, PropostaFormData } from "../types";

export const UF_STATE_NAMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

const FEMALE_FIRST_NAMES = new Set([
  "ALINE",
  "ANA",
  "ANGELA",
  "BÁRBARA",
  "BARBARA",
  "CARMEN",
  "CECILIA",
  "CECÍLIA",
  "CLAUDIA",
  "CLÁUDIA",
  "CRISTINA",
  "DANIELA",
  "ELIANA",
  "ELISA",
  "ELIZABETH",
  "ERIKA",
  "FABIANA",
  "FERNANDA",
  "FLAVIA",
  "FLÁVIA",
  "GILMA",
  "JACQUELINE",
  "JULIANA",
  "KELLY",
  "LEONOR",
  "LETICIA",
  "LETÍCIA",
  "LIVIA",
  "LÍVIA",
  "LUCIANA",
  "LUCIA",
  "LÚCIA",
  "LUIZA",
  "MÁRCIA",
  "MARCIA",
  "MARIA",
  "MARTA",
  "MAYARA",
  "NAYARA",
  "PAULA",
  "PATRICIA",
  "PATRÍCIA",
  "RENATA",
  "RITA",
  "SELMA",
  "SILVANA",
  "SUZANICE",
  "TANIA",
  "TÂNIA",
  "THAMARA",
  "THÂMARA",
  "VANESSA",
  "VALERIA",
  "VALÉRIA",
]);

function normalizeNameToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z\s]/gi, " ")
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase();
}

export function getStateNameByUf(uf: string) {
  return UF_STATE_NAMES[uf.trim().toUpperCase()] ?? uf;
}

export function authorityPreset(gender: GeneroAutoridade) {
  return gender === "feminino"
    ? {
        pronomeTratamento: "Exma.",
        tituloSocialAutoridade: "Sra.",
        cargoAutoridade: "Prefeita Municipal",
        saudacaoInicial: "Prezada Prefeita,",
      }
    : {
        pronomeTratamento: "Exmo.",
        tituloSocialAutoridade: "Sr.",
        cargoAutoridade: "Prefeito Municipal",
        saudacaoInicial: "Prezado Prefeito,",
      };
}

export function inferAuthorityGender(name: string): GeneroAutoridade | null {
  const firstToken = normalizeNameToken(name);
  if (!firstToken) {
    return null;
  }

  if (FEMALE_FIRST_NAMES.has(firstToken)) {
    return "feminino";
  }

  return null;
}

export function calculateHonorarios(data: Pick<
  PropostaFormData,
  "receitaAtual" | "receitaProjetada" | "escalonamento"
>) {
  const incremento = Math.max(0, data.receitaProjetada - data.receitaAtual);
  const salarioMinimo = Math.max(data.escalonamento.salarioMinimo || 0, 1);
  const nivel1Brl = data.escalonamento.nivel1LimiteSm * salarioMinimo;
  const nivel2Brl = data.escalonamento.nivel2LimiteSm * salarioMinimo;
  let honorarios = 0;

  if (incremento > nivel2Brl) {
    honorarios += nivel1Brl * (data.escalonamento.nivel1Percentual / 100);
    honorarios += (nivel2Brl - nivel1Brl) * (data.escalonamento.nivel2Percentual / 100);
    honorarios += (incremento - nivel2Brl) * (data.escalonamento.nivel3Percentual / 100);
  } else if (incremento > nivel1Brl) {
    honorarios += nivel1Brl * (data.escalonamento.nivel1Percentual / 100);
    honorarios += (incremento - nivel1Brl) * (data.escalonamento.nivel2Percentual / 100);
  } else {
    honorarios += incremento * (data.escalonamento.nivel1Percentual / 100);
  }

  return {
    incremento,
    honorarios,
    receitaAtualSm: data.receitaAtual / salarioMinimo,
    receitaProjetadaSm: data.receitaProjetada / salarioMinimo,
    incrementoSm: incremento / salarioMinimo,
    honorariosSm: honorarios / salarioMinimo,
    nivel1Brl,
    nivel2Brl,
    percentualIncremento: data.receitaAtual > 0 ? (incremento / data.receitaAtual) * 100 : 0,
    percentualEfetivo: incremento > 0 ? (honorarios / incremento) * 100 : 0,
  };
}
