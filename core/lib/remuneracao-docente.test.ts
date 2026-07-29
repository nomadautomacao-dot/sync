import { describe, expect, it } from "vitest";

import remuneracao from "@/data/fnde/remuneracao-docente.json";
import { getRemuneracaoMunicipal } from "@/core/lib/remuneracao-docente";

/**
 * Este dataset já saiu errado uma vez, e de um jeito que passaria despercebido:
 * a Paraíba declara carga horária em unidade que não é a hora semanal — `"7"`,
 * `"2"` — e proporcionalizar `salário × 40 / 2` produziu medianas municipais de
 * **meio milhão de reais**. Quarenta e oito municípios acima de R$ 30 mil.
 * Nenhum erro foi lançado; os números apenas ficaram absurdos.
 *
 * As travas abaixo existem porque a checagem que importa não é "o código roda",
 * é "o número é possível". Uma mediana municipal do magistério no Brasil não
 * vive acima de R$ 25 mil, e o piso nacional é fato externo publicado em
 * portaria.
 */
const arquivo = remuneracao as {
  anoReferencia: number;
  pisoNacional: number;
  municipios: Record<string, { medianaMagisterio: number | null; confiavel?: boolean; cobertura?: number }>;
};

const AMOSTRA = ["2801207", "3550308", "1302603", "3136959"];

describe("remuneração do magistério", () => {
  it("não persiste nenhum dado pessoal", () => {
    // A fonte devolve nome do servidor, escola e salário individual. Nada
    // disso pode chegar ao repositório.
    const bruto = JSON.stringify(arquivo);
    expect(bruto).not.toMatch(/NO_PROFISSIONAL|NO_RAZAO_SOCIAL|CO_ESCOLA/);
  });

  it("usa o piso publicado em portaria para o exercício de referência", () => {
    // 2025: Portaria MEC nº 77/2025. O valor é fato externo, não escolha nossa.
    expect(arquivo.anoReferencia).toBe(2025);
    expect(arquivo.pisoNacional).toBe(4867.77);
  });

  it("nenhuma mediana publicável fica em patamar impossível", () => {
    // A regressão que motivou este arquivo. O p90 nacional é ~R$ 8,2 mil;
    // qualquer mediana municipal acima de R$ 25 mil é erro de declaração.
    //
    // A asserção é sobre a saída do LEITOR, não sobre o arquivo: o filtro
    // registro a registro do gerador não pega o ente que declara um valor
    // fixo errado para a folha inteira, e é o leitor que rebaixa esses casos.
    let publicaveis = 0;

    for (const codigo of Object.keys(arquivo.municipios)) {
      // O leitor trunca para 6 dígitos; qualquer verificador serve.
      const lido = getRemuneracaoMunicipal(`${codigo}0`);
      if (!lido?.confiavel || lido.medianaMagisterio === null) continue;

      publicaveis += 1;
      expect(lido.medianaMagisterio, `município ${codigo}`).toBeLessThanOrEqual(25_000);
      expect(lido.medianaMagisterio, `município ${codigo}`).toBeGreaterThanOrEqual(1_000);
    }

    expect(publicaveis).toBeGreaterThan(4000);
  });

  it("o leitor rebaixa quem o gerador deixou passar", () => {
    // Sem esta segunda barreira, Cariús/CE entraria num relatório com mediana
    // de R$ 36 mil — o gerador o considera confiável porque cada registro,
    // isolado, está dentro da faixa.
    const suspeitos = Object.entries(arquivo.municipios).filter(
      ([, m]) => m.confiavel !== false && (m.medianaMagisterio ?? 0) > 25_000,
    );

    expect(suspeitos.length).toBeGreaterThan(0);
    for (const [codigo] of suspeitos) {
      expect(
        getRemuneracaoMunicipal(`${codigo}0`)?.confiavel,
        `município ${codigo} deveria ter sido rebaixado`,
      ).toBe(false);
    }
  });

  it("resolve o código IBGE de 7 dígitos e mantém a coerência interna", () => {
    for (const codigo of AMOSTRA) {
      const r = getRemuneracaoMunicipal(codigo);
      expect(r, `município ${codigo} ausente`).not.toBeNull();

      // A base da mediana nunca excede o que o ente declarou.
      expect(r!.magisterio).toBeLessThanOrEqual(r!.magisterioDeclarado);
      expect(r!.abaixoDoPiso).toBeLessThanOrEqual(r!.magisterio);
      expect(r!.cobertura).toBeGreaterThan(0);
      expect(r!.cobertura).toBeLessThanOrEqual(100);

      if (r!.medianaMagisterio !== null && r!.razaoMedianaPiso !== null) {
        expect(r!.razaoMedianaPiso).toBeCloseTo(r!.medianaMagisterio / r!.piso, 2);
      }
    }
  });

  it("proporcionaliza à jornada de referência do piso", () => {
    const r = getRemuneracaoMunicipal("2801207")!;
    expect(r.jornadaReferencia).toBe(40);
    // Comparar contrato de 20h com o piso cheio produziria descumprimento
    // onde não há; o art. 2º, §3º da Lei 11.738/2008 admite o proporcional.
    expect(r.abaixoDoPisoPct).toBeGreaterThanOrEqual(0);
    expect(r.abaixoDoPisoPct).toBeLessThanOrEqual(100);
  });

  it("devolve null para código inexistente em vez de lançar", () => {
    expect(getRemuneracaoMunicipal("0000000")).toBeNull();
    expect(getRemuneracaoMunicipal("")).toBeNull();
    expect(getRemuneracaoMunicipal("123")).toBeNull();
  });
});
