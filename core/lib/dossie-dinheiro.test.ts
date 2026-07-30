import { describe, expect, it } from "vitest";

import {
  montarConvenios,
  montarObras,
  type DossieDinheiro,
} from "@/core/lib/dossie-dinheiro";
import { generateDossieDinheiroHtml } from "@/core/lib/dossie-dinheiro-template";
import type { ObraDetalhada } from "@/core/lib/fnde-obras";
import type { ConvenioResumo, ConveniosMunicipio } from "@/core/lib/portal-transparencia";

const HOJE = new Date("2026-07-30T12:00:00.000Z");

function obra(over: Partial<ObraDetalhada> = {}): ObraDetalhada {
  return {
    id: "1",
    ano: 2015,
    tipo: "Educação Infantil",
    classificacao: "Urbana",
    situacao: "EM RETOMADA",
    estimativaRepasse: 1_000_000,
    execucao: 100_000,
    saldoBancario: 0,
    situacaoSolicitacao: "Deferido",
    situacaoTermo: "Termo validado",
    termoGerado: "Termo Gerado",
    termoValidado: "Termo validado",
    esfera: "Municipal",
    aprovacaoRepasse: 900_000,
    ...over,
  };
}

describe("de quem é o dinheiro da obra", () => {
  /**
   * A maior obra paralisada de Manaus é **estadual**. Apresentá-la como perda
   * municipal é o erro que derruba o relatório inteiro na primeira pergunta do
   * secretário — e é o que aconteceria se a esfera não fosse lida.
   */
  it("não conta como do município a obra de outra esfera no território", () => {
    const [estadual, municipal] = montarObras([
      obra({ esfera: "Estadual", situacao: "PARALISADA" }),
      obra({ id: "2", esfera: "Municipal", situacao: "PARALISADA" }),
    ]);

    expect(estadual.doMunicipio).toBe(false);
    expect(estadual.aReceber).toBeNull();
    expect(municipal.doMunicipio).toBe(true);
    expect(municipal.aReceber).toBe(900_000);
  });

  /**
   * Obra entregue não tem repasse futuro. A versão anterior subtraía execução
   * da estimativa em toda linha e anunciava milhões a receber numa obra
   * concluída anos atrás.
   */
  it("não promete repasse futuro em obra encerrada", () => {
    const [concluida, cancelada] = montarObras([
      obra({ situacao: "CONCLUIDA", execucao: 0 }),
      obra({ id: "2", situacao: "OBRA CANCELADA", execucao: 0 }),
    ]);

    expect(concluida.aReceber).toBeNull();
    expect(cancelada.aReceber).toBeNull();
    expect(concluida.parada).toBe(false);
  });

  it("nunca devolve valor a receber negativo", () => {
    const [o] = montarObras([obra({ estimativaRepasse: 100, execucao: 900 })]);
    expect(o.aReceber).toBe(0);
  });
});

describe("o que trava a retomada", () => {
  /**
   * A leitura existe para separar o que a prefeitura resolve do que depende do
   * FNDE. Dizer "está parada" sem dizer de quem é a próxima ação transforma
   * diagnóstico em lamento.
   */
  it("aponta o FNDE quando o termo ainda não foi gerado", () => {
    const [o] = montarObras([obra({ termoGerado: "", termoValidado: "" })]);
    expect(o.trava).toMatch(/próxima ação é do FNDE/);
  });

  it("aponta o ente quando o termo está gerado e não validado", () => {
    const [o] = montarObras([obra({ termoGerado: "Termo Gerado", termoValidado: "" })]);
    expect(o.trava).toMatch(/assinatura é do ente/);
  });

  it("diz que a obra está fora do pacto quando a solicitação foi indeferida", () => {
    const [o] = montarObras([obra({ situacaoSolicitacao: "Indeferido" })]);
    expect(o.trava).toMatch(/fora do novo pacto/);
  });

  it("não inventa trava em obra que não está parada", () => {
    const [o] = montarObras([obra({ situacao: "EM LICITACAO" })]);
    expect(o.trava).toBeNull();
  });
});

describe("urgência da carteira de convênios", () => {
  function convenio(over: Partial<ConvenioResumo> = {}): ConvenioResumo {
    return {
      objeto: "Objeto",
      orgao: "Órgão",
      situacao: "EM EXECUÇÃO",
      fimVigencia: "2027-12-31",
      valor: 1_000_000,
      valorLiberado: 250_000,
      educacao: false,
      ...over,
    };
  }

  function carteira(lista: ConvenioResumo[]): ConveniosMunicipio {
    return {
      total: lista.length,
      truncado: false,
      vigentes: lista.length,
      valorVigentes: lista.reduce((t, c) => t + c.valor, 0),
      liberadoVigentes: lista.reduce((t, c) => t + c.valorLiberado, 0),
      educacaoVigentes: lista.filter((c) => c.educacao).length,
      valorEducacaoVigentes: 0,
      topVigentes: lista.slice(0, 5),
      vigentesLista: lista,
      encerrados: 0,
      semLiberacao: lista.filter((c) => c.valorLiberado === 0).length,
    };
  }

  it("marca como vencendo só o que expira dentro de 180 dias", () => {
    const [logo, depois] = montarConvenios(
      carteira([convenio({ fimVigencia: "2026-09-30" }), convenio({ fimVigencia: "2028-01-01" })]),
      HOJE,
    );

    expect(logo.vencendo).toBe(true);
    expect(logo.diasRestantes).toBe(62);
    expect(depois.vencendo).toBe(false);
  });

  it("calcula a execução como liberado sobre pactuado", () => {
    const [c] = montarConvenios(carteira([convenio()]), HOJE);
    expect(c.execucao).toBe(25);
  });

  /** Valor pactuado zero não vira divisão por zero nem 0% — vira ausência. */
  it("não inventa percentual sem valor pactuado", () => {
    const [c] = montarConvenios(carteira([convenio({ valor: 0, valorLiberado: 0 })]), HOJE);
    expect(c.execucao).toBeNull();
  });

  it("devolve lista vazia quando a consulta não respondeu", () => {
    expect(montarConvenios(null, HOJE)).toEqual([]);
  });
});

describe("HTML do Dossiê do Dinheiro Federal", () => {
  function dossie(over: Partial<DossieDinheiro> = {}): DossieDinheiro {
    const obras = montarObras([obra({ situacao: "PARALISADA" })]);
    return {
      municipio: "TESTE",
      uf: "BA",
      obras,
      emendas: null,
      convenios: null,
      conveniosLista: [],
      sancoes: null,
      pnae: null,
      ausencias: ["A consulta de convênios não respondeu nesta emissão."],
      fontes: ["FNDE — Painel do Pacto de Retomada de Obras (dados abertos)"],
      resumo: {
        obras: 1,
        obrasDoMunicipio: 1,
        obrasParadas: 1,
        valorParadoMunicipal: 1_000_000,
        valorParadoOutrasEsferas: 0,
        aReceberEmObrasParadas: 900_000,
        emendasEmpenhado: 0,
        emendasPago: 0,
        emendasEducacao: 0,
        taxaDeChegada: null,
        conveniosVigentes: 0,
        valorConveniosVigentes: 0,
        conveniosVencendo: 0,
        conveniosSemLiberacao: 0,
        totalRastreado: 900_000,
      },
      ...over,
    };
  }

  function gerar(d: DossieDinheiro): string {
    return generateDossieDinheiroHtml({
      municipio: d.municipio,
      uf: d.uf,
      codigoIbge: "2924009",
      dossie: d,
      geradoEm: HOJE,
    });
  }

  it("imprime um bloco por obra e uma linha por convênio", () => {
    const html = gerar(dossie());
    expect(html.match(/<article class="obra /g) ?? []).toHaveLength(1);
    expect(html.match(/<tr class="conv /g) ?? []).toHaveLength(0);
  });

  /**
   * Fonte que não respondeu tem de aparecer nomeada. Sem isso, o leitor lê
   * seção ausente como ausência de dado — e ausência de resposta não é
   * ausência de convênio.
   */
  it("nomeia a fonte que não respondeu em vez de omitir a seção em silêncio", () => {
    const html = gerar(dossie());
    expect(html).toContain("O que não veio nesta emissão");
    expect(html).toContain("A consulta de convênios não respondeu");
  });

  it("declara quando todas as fontes responderam", () => {
    const html = gerar(dossie({ ausencias: [] }));
    expect(html).toContain("Todas as fontes responderam nesta emissão");
  });

  /**
   * A empresa não tem contrato executado. Nenhuma revisão pode introduzir
   * resultado de cliente, case ou histórico de recuperação.
   */
  it("não afirma resultado de cliente nem histórico de contratos", () => {
    const html = gerar(dossie());
    for (const proibido of [
      /j[áa] recuperamos/i,
      /nossos clientes/i,
      /case de sucesso/i,
      /municípios atendidos/i,
    ]) {
      expect(html).not.toMatch(proibido);
    }
  });
});
