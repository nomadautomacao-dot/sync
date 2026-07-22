/**
 * Valor Aluno Ano FUNDEB 2026
 * Source: Portaria Interministerial MEC/MF nº 14, de 29/12/2025 (Anexo I)
 *
 * Contains per-student values (VAAF) by UF and education stage,
 * plus total revenue estimates.
 */
import valorAluno2026 from "@/data/fnde/valor-aluno-ano-2026.json";

interface ValorAlunoAnoUF {
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

