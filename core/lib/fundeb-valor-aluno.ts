/**
 * Valor Aluno Ano FUNDEB 2026
 * Source: Portaria Interministerial MEC/MF nº 14, de 29/12/2025 (Anexo I)
 *
 * Contains per-student values (VAAF) by UF and education stage,
 * plus total revenue estimates.
 */
import valorAluno2026 from "@/data/fnde/valor-aluno-ano-2026.json";

export interface ValorAlunoAnoUF {
  /** Creche tempo integral - pública */
  crecheIntegralPublica: number;
  /** Creche tempo integral - conveniada */
  crecheIntegralConveniada: number;
  /** Creche tempo parcial - pública */
  crecheParcialPublica: number;
  /** Creche tempo parcial - conveniada */
  crecheParcialConveniada: number;
  /** Pré-escola tempo integral - pública */
  preEscolaIntegralPublica: number;
  /** Pré-escola tempo integral - conveniada */
  preEscolaIntegralConveniada: number;
  /** Pré-escola tempo parcial - pública */
  preEscolaParcialPublica: number;
  /** Pré-escola tempo parcial - conveniada */
  preEscolaParcialConveniada: number;
  /** Ensino fundamental tempo integral */
  fundamentalIntegral: number;
  /** Ensino fundamental parcial - anos iniciais (base VAAF reference) */
  fundamentalParcialAnosIniciais: number;
  /** Ensino fundamental parcial - anos finais */
  fundamentalParcialAnosFinais: number;
  /** Ensino médio tempo integral */
  medioIntegral: number;
  /** Ensino médio tempo parcial */
  medioParcial: number;
  /** Educação de jovens e adultos */
  eja: number;
  /** Educação especial */
  educacaoEspecial: number;
  /** Atendimento educacional especializado */
  atendimentoEspecializado: number;
  /** Educação profissional e técnica */
  profissionalTecnica: number;
  /** Contribuição dos estados/DF/municípios ao FUNDEB */
  receitaEstadosMunicipios: number;
  /** Complementação VAAF da União */
  complementacaoVAAF: number;
  /** Total das receitas (VAAF) */
  totalReceitasVAAF: number;
}

const dataset = valorAluno2026 as Record<string, ValorAlunoAnoUF>;

/**
 * Get per-student VAAF values for a given UF.
 * @param uf - Two-letter state code (e.g. "GO", "SP", "BA")
 * @returns ValorAlunoAnoUF or null if UF not found
 */
export function getValorAlunoAno(uf: string): ValorAlunoAnoUF | null {
  const normalized = uf.trim().toUpperCase();
  return dataset[normalized] ?? null;
}

/**
 * Get the base VAAF value per student for a given UF.
 * This is the "Ensino Fundamental parcial - anos iniciais" value,
 * which is the reference value used in FUNDEB calculations.
 * @param uf - Two-letter state code
 * @returns Base VAAF value or null
 */
export function getValorAlunoBase(uf: string): number | null {
  const entry = getValorAlunoAno(uf);
  return entry?.fundamentalParcialAnosIniciais ?? null;
}

/**
 * Get all UFs that receive VAAF complementation from the Union.
 * States where complementacaoVAAF > 0 are below the minimum national threshold.
 */
export function getUFsComComplementacaoVAAF(): Array<{ uf: string; complementacao: number; valorBase: number }> {
  return Object.entries(dataset)
    .filter(([uf, entry]) => uf !== "BR" && entry.complementacaoVAAF > 0)
    .map(([uf, entry]) => ({
      uf,
      complementacao: entry.complementacaoVAAF,
      valorBase: entry.fundamentalParcialAnosIniciais,
    }))
    .sort((a, b) => b.complementacao - a.complementacao);
}

/**
 * Get the national total (BR) entry.
 */
export function getValorAlunoBrasil(): ValorAlunoAnoUF | null {
  return dataset["BR"] ?? null;
}
