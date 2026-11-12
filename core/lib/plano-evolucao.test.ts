import { describe, expect, it } from "vitest";

import { montarPlanoEvolucao } from "./plano-evolucao";
import type { RelatorioSnapshot } from "./relatorio-snapshot";

/**
 * O plano e o levantamento saem da mesma coleta e precisam dizer os mesmos
 * números: a prefeitura recebe os dois juntos. Os dados abaixo são os da
 * emissão de 12/11/2026 (Censo 2027 a 6,4 meses, 53% de um ano).
 */
const CALENDARIO = {
  fase: "encerrado", emitidoEm: "2026-11-12", censoDaMatricula: 2027, receitaDaMatricula: 2028,
  dataDeReferencia: "2027-05-26", mesesAteReferencia: 6.4, fracaoDoPrimeiroCiclo: 0.53,
  censoDaDeclaracao: 2027, receitaDaDeclaracao: 2028, fimDaRetificacao: "2026-10-23", retificacaoEstimada: false,
  titulo: "Censo 2026 encerrado: o trabalho mira o Censo 2027", acoes: [],
};

interface Fixture {
  ident: { municipioNome: string; uf: string; codigoIBGE: string; exercicio: number };
  receita: number;
  parcelas: Array<{ chave: string; valor: number }>;
  vaat: { proprio: number; minimo: number; complementacao: number; habilitacao: string };
  pond: { matriculas: number; ponderadaVaat: number; especial: number; aee: number; creche?: object };
  reprovadas: string[];
  contribuicao: Array<[number, number]>;
}

function snapshot(f: Fixture, semCalendario = false): RelatorioSnapshot {
  const parcelas = f.parcelas.map((p) => ({ ...p, titulo: p.chave, regra: "", pagina: 4, natureza: "referencia" }));
  return {
    current: {
      relatorio: {
        identificacao: f.ident,
        receitas: { totalReceitas: f.receita },
        projecao: { parcelas, otimista: { tresAnos: { parcelas } } },
      },
      payload: {
        fiscal: { historico_repasses: f.contribuicao.map(([ano, v]) => ({ ano, contribuicao_estados_municipios: v })) },
        relatorio_dirigido_base: {
          cenarioEstruturacao: semCalendario ? {} : { calendario: CALENDARIO },
          vaat: f.vaat,
          ponderacao: {
            matriculas: f.pond.matriculas,
            ponderadaVaat: f.pond.ponderadaVaat,
            segmentos: [
              { nome: "Educação Especial - Demais segmentos Urbano", matriculas: f.pond.especial },
              { nome: "Atendimento Educacional Especializado Urbano", matriculas: f.pond.aee },
            ],
            oportunidades: f.pond.creche ? [f.pond.creche] : [],
          },
          vaar: { reprovadas: f.reprovadas },
        },
      },
    },
    qualidade: { snapshotId: "teste" },
  } as unknown as RelatorioSnapshot;
}

const CANEDO: Fixture = {
  ident: { municipioNome: "Senador Canedo", uf: "GO", codigoIBGE: "5220454", exercicio: 2026 },
  receita: 200_722_290.59,
  parcelas: [{ chave: "vaar", valor: 17_755_425.12 }],
  vaat: { proprio: 10_511.38, minimo: 10_192.38, complementacao: 0, habilitacao: "Habilitado para o cálculo do VAAT" },
  pond: { matriculas: 25_873, ponderadaVaat: 31_785.88, especial: 1_194, aee: 930 },
  reprovadas: ["II", "III"],
  contribuicao: [[2023, 155_972_931], [2024, 167_112_993], [2025, 195_771_701], [2026, 200_722_291]],
};

const SERRA: Fixture = {
  ident: { municipioNome: "Serra do Ramalho", uf: "BA", codigoIBGE: "2930154", exercicio: 2026 },
  receita: 88_107_810.51,
  parcelas: [{ chave: "vaar", valor: 4_760_160.48 }, { chave: "lacunas", valor: 1_136_410.57 }],
  vaat: { proprio: 7_764.61, minimo: 10_192.38, complementacao: 26_041_658.3, habilitacao: "Habilitado para o cálculo do VAAT" },
  pond: {
    matriculas: 7_673, ponderadaVaat: 10_537.89, especial: 595, aee: 329,
    creche: { chave: "creche-integral", indicador: 0.178, mediana: 0.685, matriculasAteMediana: 371.65 },
  },
  reprovadas: ["III"],
  contribuicao: [[2023, 36_122_113], [2024, 39_274_458], [2025, 44_683_876], [2026, 44_660_901]],
};

const trabalho = (c: { matriculas: number; fixas: number }) => c.matriculas + c.fixas;

describe("plano de evolução", () => {
  it("bate com o levantamento: próximo ciclo e três ciclos são os mesmos números", () => {
    const canedo = montarPlanoEvolucao(snapshot(CANEDO));
    const serra = montarPlanoEvolucao(snapshot(SERRA));

    // Os totais do otimista que o levantamento de 12/11/2026 imprimiu.
    expect(trabalho(canedo.ciclos[0])).toBeCloseTo(27_335_423.89, -3);
    expect(trabalho(canedo.ciclos[2])).toBeCloseTo(80_704_312.92, -3);
    expect(trabalho(serra.ciclos[0])).toBeCloseTo(10_404_622.62, -3);
    expect(trabalho(serra.ciclos[2])).toBeCloseTo(27_416_137.96, -3);
  });

  it("Senador Canedo está perto do piso e cruza no segundo Censo", () => {
    const p = montarPlanoEvolucao(snapshot(CANEDO));

    expect(p.posicao).toBe("perto");
    expect(p.distanciaAoPiso).toBeCloseTo(2_658, -1);
    expect(p.censoDoCruzamento).toBe(2028);
    expect(p.ciclos[0].via).toBe("fundo");
    expect(p.ciclos[2].via).toBe("entra");
    // Receita de hoje + evolução do fundo (+8,8% ao ano, dois anos) + trabalho.
    expect(p.ciclos[0].receitaProjetada / 1e6).toBeCloseTo(264.8, 0);
  });

  it("Serra do Ramalho já está na faixa, e a creche parcial não conta duas vezes", () => {
    const p = montarPlanoEvolucao(snapshot(SERRA));

    expect(p.posicao).toBe("na-faixa");
    expect(p.distanciaAoPiso).toBeNull();
    // A creche declarada parcial já é a lacuna de declaração do levantamento.
    expect(p.frentes.map((f) => f.chave)).not.toContain("creche");
    // A média do total diria 22,5% ao ano (entrada no VAAT em 2024); a redistribuição, 7,3%.
    expect(p.evolucao!.taxa).toBeCloseTo(0.073, 2);
  });

  it("as frentes fecham com o ritmo, e o AEE entra inteiro no próximo Censo", () => {
    for (const f of [CANEDO, SERRA]) {
      const p = montarPlanoEvolucao(snapshot(f));
      const total = p.frentes.reduce((s, x) => s + x.equivalentes, 0);
      const proximo = p.frentes.reduce((s, x) => s + x.noProximoCenso, 0);
      const aee = p.frentes.find((x) => x.chave === "aee")!;

      expect(total).toBeCloseTo(p.ciclos[2].equivalentes, 6);
      expect(proximo).toBeCloseTo(p.ciclos[0].equivalentes, 6);
      expect(aee.noProximoCenso).toBeCloseTo(aee.equivalentes, 6);
      // A EJA fecha a conta e é sempre a última frente.
      expect(p.frentes[p.frentes.length - 1].chave).toBe("eja");
    }
  });

  it("sem calendário do Censo, recusa em vez de datar metas no escuro", () => {
    expect(() => montarPlanoEvolucao(snapshot(CANEDO, true))).toThrow(/calendário do Censo/);
  });
});
