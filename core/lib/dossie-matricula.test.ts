import { describe, expect, it } from "vitest";

import { montarDossieMatricula } from "@/core/lib/dossie-matricula";
import { generateDossieMatriculaHtml } from "@/core/lib/dossie-matricula-template";
import { getCatalogoSegmentos, getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";
import { getInepCensoMunicipalRecord } from "@/core/lib/inep-censo";

const PAULO_AFONSO = "2924009";
const MANAUS = "1302603";
const IBATEGUARA = "2703007";
const SAO_PAULO = "3550308";

describe("montagem do Dossiê da Matrícula Ponderada", () => {
  it("traz todos os segmentos declarados, não só os de maior peso", () => {
    const d = montarDossieMatricula(MANAUS, "AM")!;
    const p = getPonderacaoMunicipal(MANAUS)!;

    expect(d.segmentos).toHaveLength(p.segmentos.length);
    expect(d.segmentos.length).toBeGreaterThan(12);
  });

  it("devolve null onde a planilha do FNDE não traz o município", () => {
    expect(montarDossieMatricula("0000000")).toBeNull();
  });

  /**
   * A conta que o documento inteiro promete: a soma de matrícula × fator tem
   * de reconstruir o total ponderado que a Portaria publica. Se não bater, o
   * dossiê está mostrando fatores que não são os que geraram a receita.
   */
  it("reconstrói o total ponderado somando matrícula × fator", () => {
    for (const [codigo, uf] of [
      [PAULO_AFONSO, "BA"],
      [MANAUS, "AM"],
      [SAO_PAULO, "SP"],
    ] as const) {
      const d = montarDossieMatricula(codigo, uf)!;
      const soma = d.segmentos.reduce((t, s) => t + s.equivalentes, 0);

      expect(Math.abs(soma - d.ponderadaVaaf)).toBeLessThan(1);
    }
  });

  /** Cada corte reparte o mesmo total: se um deles perder uma fatia, some dinheiro. */
  it("os cinco cortes repartem exatamente as mesmas matrículas", () => {
    const d = montarDossieMatricula(SAO_PAULO, "SP")!;

    expect(d.cortes).toHaveLength(5);
    for (const corte of d.cortes) {
      const matriculas = corte.fatias.reduce((t, f) => t + f.matriculas, 0);
      const equivalentes = corte.fatias.reduce((t, f) => t + f.equivalentes, 0);

      expect(matriculas).toBe(d.matriculas);
      expect(Math.abs(equivalentes - d.ponderadaVaaf)).toBeLessThan(1);
    }
  });

  it("classifica o segmento pelo nome, que é a única estrutura que a Portaria dá", () => {
    const d = montarDossieMatricula(SAO_PAULO, "SP")!;
    const porNome = new Map(d.segmentos.map((s) => [s.nome, s]));

    const creche = porNome.get("Creche Integral Conveniada Urbano")!;
    expect(creche.etapa).toBe("creche");
    expect(creche.jornada).toBe("integral");
    expect(creche.localizacao).toBe("urbano");
    expect(creche.dependencia).toBe("conveniada");
    expect(creche.modalidade).toBe("regular");

    // Anos iniciais são a jornada parcial do fundamental, ainda que a Portaria
    // não escreva "Parcial" no nome.
    const ai = porNome.get("Anos Iniciais Fundamental Urbano")!;
    expect(ai.jornada).toBe("parcial");
    expect(ai.fatorVaaf).toBe(1);

    // Educação especial em pré-escola é etapa pré-escola e modalidade especial:
    // as duas coisas ao mesmo tempo, e é isso que a conciliação depende.
    const esp = porNome.get("Educação Especial - Pré-Escola Urbano")!;
    expect(esp.etapa).toBe("pre-escola");
    expect(esp.modalidade).toBe("especial");
  });

  /**
   * A folha do VAAF × VAAT existe porque os dois fatores são diferentes. Se a
   * lib devolvesse o mesmo número nas duas colunas, a folha inteira seria uma
   * afirmação falsa.
   */
  it("expõe os dois fatores da Portaria, que não são iguais na educação infantil", () => {
    const d = montarDossieMatricula(MANAUS, "AM")!;
    const creche = d.segmentos.find((s) => s.nome === "Creche Integral Pública Urbano")!;
    const ai = d.segmentos.find((s) => s.nome === "Anos Iniciais Fundamental Urbano")!;

    expect(creche.fatorVaaf).toBe(1.55);
    expect(creche.fatorVaat).toBe(1.9);
    // Nos anos iniciais as duas tabelas coincidem — é a referência de ambas.
    expect(ai.fatorVaaf).toBe(1);
    expect(ai.fatorVaat).toBe(1);
    expect(d.ponderadaVaat).toBeGreaterThan(d.ponderadaVaaf);
  });
});

describe("conciliação entre o Censo e a filtragem do FUNDEB", () => {
  /**
   * O achado que sustenta a folha: bloco a bloco, o número do FNDE é o número
   * que o município declarou. Em Paulo Afonso, Manaus e Ibateguara os três
   * blocos fecham na casa da unidade.
   */
  it("fecha bloco a bloco contra o Censo da rede municipal", () => {
    for (const codigo of [PAULO_AFONSO, IBATEGUARA]) {
      const c = montarDossieMatricula(codigo)!.conciliacao!;

      for (const linha of c.linhas) {
        if (linha.censo === null) continue;
        expect(linha.diferenca).toBe(0);
      }
      expect(c.fecha).toBe(true);
    }
  });

  /**
   * São Paulo declara 2.620 matrículas de ensino médio na rede municipal do
   * Censo e a Portaria não as pondera. No total isso cabe na tolerância de
   * 0,5%, então um `fecha` que olhasse só o total declararia conciliação
   * fechada na mesma folha em que a linha aparece marcada como divergente.
   */
  it("não declara conciliação fechada com um bloco aberto", () => {
    const c = montarDossieMatricula(SAO_PAULO, "SP")!.conciliacao!;
    const abertos = c.linhas.filter((l) => l.divergente);

    expect(abertos).toHaveLength(1);
    expect(abertos[0].diferenca).toBe(-2620);
    // O resíduo total cabe na tolerância — e ainda assim não fecha.
    expect(Math.abs(c.residuo)).toBeLessThan(c.censoTotal * 0.005);
    expect(c.fecha).toBe(false);

    const html = gerar(SAO_PAULO, "SAO PAULO", "SP");
    expect(html).toContain("O achado desta folha");
    expect(html).not.toContain("o resíduo fecha");
  });

  it("põe AEE e conveniadas fora da contraparte do Censo, que é onde elas estão", () => {
    const c = montarDossieMatricula(SAO_PAULO, "SP")!.conciliacao!;
    const semContraparte = c.linhas.filter((l) => l.censo === null).map((l) => l.rotulo);

    expect(semContraparte).toHaveLength(2);
    expect(c.aee).toBeGreaterThan(0);
    // São Paulo é a maior rede conveniada de educação infantil do país.
    expect(c.conveniadas).toBeGreaterThan(200_000);
  });

  /** Sem Censo do município não há ponte — e a folha some, em vez de sair torta. */
  it("não monta conciliação sem o Censo do município", () => {
    const semCenso = getInepCensoMunicipalRecord("0000000");
    expect(semCenso).toBeNull();
  });
});

describe("conferências entre Censo e Portaria", () => {
  /**
   * Manaus declara 15.798 matrículas de fundamental em tempo integral no Censo
   * e a Portaria pondera 15.367 como integral. A diferença é de forma, não de
   * fato — mas vale 0,50 de fator por matrícula, e é a maior distância por
   * matrícula da tabela inteira.
   */
  it("acha a matrícula integral que o Censo tem e a Portaria não pondera", () => {
    const d = montarDossieMatricula(MANAUS, "AM")!;
    const fund = d.conferencias.find((c) => c.chave === "integral-fundamental")!;

    expect(fund.situacao).toBe("divergencia");
    expect(fund.diferenca).toBeGreaterThan(400);
    expect(fund.ganhoEquivalentes).toBeCloseTo(fund.diferenca! * 0.5, 5);
    expect(fund.valorDerivado).toBeGreaterThan(0);
  });

  /** Diferença dentro da tolerância não vira alarme — ruído de base não é achado. */
  it("não chama de divergência a diferença dentro da tolerância", () => {
    const d = montarDossieMatricula(PAULO_AFONSO, "BA")!;
    const fund = d.conferencias.find((c) => c.chave === "integral-fundamental")!;

    expect(fund.diferenca).toBe(2);
    expect(fund.situacao).toBe("coerente");
    expect(fund.valorDerivado).toBeNull();
  });

  it("põe as divergências antes do que está coerente", () => {
    const d = montarDossieMatricula(MANAUS, "AM")!;
    const primeiraCoerente = d.conferencias.findIndex((c) => c.situacao !== "divergencia");
    const ultimaDivergencia = d.conferencias.reduce(
      (ultimo, c, i) => (c.situacao === "divergencia" ? i : ultimo),
      -1,
    );

    expect(primeiraCoerente).toBeGreaterThan(ultimaDivergencia);
  });

  /**
   * Município sem escola numa condição não gera conferência daquela condição:
   * cobrar ponderação quilombola de quem não tem escola quilombola é ruído.
   */
  it("não confere condição de território que a rede não declara", () => {
    const d = montarDossieMatricula(PAULO_AFONSO, "BA")!;

    expect(d.conferencias.some((c) => c.chave === "quilombola")).toBe(false);
    expect(d.conferencias.some((c) => c.chave === "campo")).toBe(true);
  });
});

describe("regra de dinheiro do dossiê", () => {
  /**
   * A exceção deste documento à regra da casa ("só imprime R$ que a fonte
   * publicou") é a derivação pelo valor aluno/ano da UF — e ela só é aceitável
   * porque toda cifra assim aparece marcada. Um R$ sem marca seria lido como
   * repasse.
   */
  it("marca toda cifra derivada no HTML", () => {
    const html = gerar(MANAUS, "MANAUS", "AM");
    // O separador entre `R$` e o número é NBSP (U+00A0), não espaço comum — o
    // template usa NBSP para o valor nunca quebrar entre duas linhas. Trocar
    // por espaço comum aqui zera as duas contagens e derruba o teste, que é o
    // comportamento desejado: a asserção não pode passar por não casar nada.
    const cifras = html.match(/R\$ [\d.,]+( (mi|mil))?/g) ?? [];
    const marcadas = html.match(/R\$ [\d.,]+( (mi|mil))?<sup class="d">d<\/sup>/g) ?? [];

    expect(cifras.length).toBeGreaterThan(20);
    // As não marcadas são o per capita do PNAE, o valor da matrícula-equivalente
    // e os totais do PNAE — todas publicadas em resolução, nenhuma derivada.
    expect(marcadas.length).toBeGreaterThan(cifras.length * 0.6);
    expect(html).toContain("Cifra derivada, não repassada");
  });

  it("não imprime cifra nenhuma quando a Portaria da UF não é conhecida", () => {
    const d = montarDossieMatricula(MANAUS, "ZZ")!;

    expect(d.valorPorEquivalente).toBeNull();
    expect(d.receitaDerivada).toBeNull();
    expect(d.receitaDoPeso).toBeNull();
    for (const s of d.segmentos) expect(s.valorDerivado).toBeNull();
  });

  /**
   * Paulo Afonso está acima da mediana nacional de AEE. A versão anterior
   * imprimia "R$ 0,00" como se fosse achado — linha que faz o leitor
   * desconfiar de todo o resto.
   */
  it("não imprime R$ 0,00 quando a rede já está acima da mediana", () => {
    const d = montarDossieMatricula(PAULO_AFONSO, "BA")!;
    const aee = d.oportunidades.find((o) => o.chave === "aee")!;
    expect(aee.ganhoEquivalentesMediana).toBe(0);

    const html = gerar(PAULO_AFONSO, "PAULO AFONSO", "BA");
    expect(html).toContain("acima da mediana");
    expect(html).toContain("já alcançada");
    expect(html).not.toContain("R$ 0,00");
  });
});

describe("HTML do Dossiê da Matrícula Ponderada", () => {
  it("imprime uma linha por segmento declarado e o catálogo inteiro no anexo", () => {
    const d = montarDossieMatricula(IBATEGUARA, "AL")!;
    const html = gerar(IBATEGUARA, "IBATEGUARA", "AL");

    expect(html.match(/<tr class="seg /g) ?? []).toHaveLength(d.segmentos.length);
    expect(html.match(/<tr class="cat /g) ?? []).toHaveLength(getCatalogoSegmentos().length);
  });

  /**
   * A empresa não tem contrato executado. Nenhuma revisão deste documento pode
   * introduzir resultado de cliente, case ou histórico de recuperação.
   */
  it("não afirma resultado de cliente nem histórico de contratos", () => {
    const html = gerar(MANAUS, "MANAUS", "AM");

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

function gerar(codigo: string, nome: string, uf: string): string {
  return generateDossieMatriculaHtml({
    municipio: nome,
    uf,
    codigoIbge: codigo,
    dossie: montarDossieMatricula(codigo, uf)!,
    geradoEm: new Date("2026-07-30T12:00:00.000Z"),
  });
}
