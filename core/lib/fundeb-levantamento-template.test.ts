import { describe, expect, it } from "vitest";

import {
  LEVANTAMENTO_TOTAL_PAGINAS,
  generateLevantamentoHtml,
  type LevantamentoTemplateInput,
} from "@/core/lib/fundeb-levantamento-template";
import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";
import { getGanhoApurado } from "@/core/lib/fundeb-ganho-apurado";
import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";
import { getConformidadeSiope } from "@/core/lib/siope-indicadores";
import { getEstimativaPnae } from "@/core/lib/fundeb-pnae";
import type { RelatorioFundeb } from "@/modules/levantamento-fundeb/types";

/**
 * `core/lib/fundeb-levantamento-pdf.ts` compara a contagem de páginas do PDF
 * com `LEVANTAMENTO_TOTAL_PAGINAS` e **lança** se divergirem. Uma página a
 * mais no template sem atualizar a constante — ou o contrário — derruba a
 * geração em produção, não no desenvolvimento.
 *
 * O relatório também é montado a partir de um payload cujos campos são quase
 * todos opcionais. Um município sem VAAR, sem Censo ou sem SICONFI tem de
 * gerar as mesmas páginas, com traço no lugar do número.
 */

/**
 * Fixture deliberadamente esquálido: só o que o tipo exige, tudo o mais
 * ausente. Se alguma página quebrar com dado faltando, é aqui que aparece.
 */
function relatorioMinimo(): RelatorioFundeb {
  const zerado = {
    vaafAtual: 0, vaafProjetado: 0, vaafGanho: 0,
    vaatAtual: 0, vaatProjetado: 0, vaatGanho: 0,
    vaarAtual: 0, vaarProjetado: 0, vaarGanho: 0,
    totalAtual: 0, totalProjetado: 0, totalGanho: 0, ganhoPercentual: 0,
  };

  return {
    geradoEm: "2026-07-28T12:00:00.000Z",
    identificacao: {
      municipioNome: "Município de Teste",
      uf: "SE",
      codigoIBGE: "2801207",
      exercicio: 2026,
      fonte: "teste",
    },
    receitas: {
      complementacaoVAAF: 0,
      complementacaoVAAT: 0,
      complementacaoVAAR: 0,
      totalReceitas: 0,
    },
    projecao: zerado,
    projecaoRecuperavel: zerado,
    projecaoComercial: null,
    upsideCondicionado: null,
    perfilComercial: null,
    cronogramaVAAF: [],
    sistemas: [],
    obrasPAC2: [],
    situacaoPAR: "",
    caminhoEscola: [],
    pdde: [],
    observacoesOperacionais: [],
    idebAnosIniciais: [],
    idebAnosFinais: [],
    idebEnsinoMedio: [],
    censoEscolar: null,
  } as unknown as RelatorioFundeb;
}

function paginas(html: string): number {
  return html.match(/<section class="page/g)?.length ?? 0;
}

function gerar(overrides: Partial<LevantamentoTemplateInput> = {}): string {
  return generateLevantamentoHtml({ relatorio: relatorioMinimo(), ...overrides });
}

describe("template do Levantamento FUNDEB", () => {
  it("respeita o contrato de páginas que o renderer confere", () => {
    expect(paginas(gerar())).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
  });

  it("mantém a contagem de páginas com o payload completo", () => {
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { vaar: getSituacaoVaar("3304557") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
  });

  it("nomeia a condicionalidade reprovada em vez de conjecturar", () => {
    // Antes do dataset do VAAR o relatório dizia que a ausência da parcela
    // "pode estar ligada às condições de habilitação". Agora ela é nomeada.
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { vaar: getSituacaoVaar("3304557") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(html).not.toContain("pode estar ligada");
    expect(html).toContain("Não habilitado ao VAAR");
    // Rio de Janeiro reprovou nas condicionalidades III e IV em 2026.
    expect(html).toMatch(/reprovado em 2 condicionalidades/);
  });

  it("atribui ao estado a reprovação que cascateia, e não ao município", () => {
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { vaar: getSituacaoVaar("3300100") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(html).toContain("A reprovação não é do município");
    expect(html).toContain("Nenhuma ação municipal reverte isso");
  });

  it("mostra o valor recebido para quem é beneficiário", () => {
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { vaar: getSituacaoVaar("5208707") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(html).toContain("Habilitado ao VAAR");
    expect(html).toContain("beneficiário do rateio");
    expect(html).not.toContain("A reprovação não é do município");
  });

  it("gera as páginas novas mesmo sem os datasets", () => {
    const html = gerar();
    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
    expect(html).toContain("Situação no VAAR não disponível");
    expect(html).toContain("Matrícula ponderada não disponível");
    expect(html).toContain("Declaração do município ao SIOPE não localizada");
  });

  it("apura as vinculações e não confunde o que elas travam", () => {
    // O erro mais comum do material de mercado é dizer que descumprir uma
    // vinculação bloqueia o FUNDEB. Não bloqueia: o art. 21 manda repassar
    // automaticamente. O que trava é convênio, via CAUC, e a aprovação de
    // contas no tribunal.
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { conformidade: getConformidadeSiope("2801207") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
    expect(html).toContain("Percentuais apurados pelo SIOPE");
    expect(html).toContain("Não trava o FUNDEB");
    expect(html).toContain("Trava convênio e contas");
    expect(html).not.toContain("Declaração do município ao SIOPE não localizada");
  });

  it("não formata valor em reais como percentual", () => {
    // Achado num PDF real de Serra do Ramalho/BA: a tabela de vinculações
    // exibia "Investimento por aluno da educação básica — 13.466,12%".
    // São R$ 13.466,12. O mesmo valia para a despesa com professores por aluno
    // e para o saldo do FUNDEB não utilizado (R$ 195.273,45).
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { conformidade: getConformidadeSiope("2930154") },
      } as LevantamentoTemplateInput["payload"],
    });

    // Nenhum percentual de quatro dígitos ou mais deve sobrar na página.
    expect(html).not.toMatch(/\d{1,3}\.\d{3},\d{2}%/);
    expect(html).toContain("Investimento por aluno da educação básica");
  });

  it("liga o Censo aos três fluxos que ele define", () => {
    // A tese da página: o Censo não define só o FUNDEB. Alimentação escolar e
    // salário-educação usam as mesmas matrículas, então um erro cadastral
    // custa três vezes — e a janela de correção é de 30 dias, uma vez por ano.
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { pnae: getEstimativaPnae("2801207") },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
    expect(html).toContain("PNAE estimado");
    expect(html).toContain("salário-educação");
    expect(html).toContain("Confirmação de matrículas duplicadas");
    // A estimativa não pode ser apresentada como o valor empenhado. O texto
    // quebra linha no meio da frase, então a asserção é sobre o trecho final.
    expect(html).toContain("valor empenhado");
    expect(html).toContain("Estimativa sobre as matrículas");
  });

  it("não afirma que pendência administrativa bloqueia o FUNDEB", () => {
    // É o erro mais caro do material de mercado: destrói a credibilidade do
    // resto do diagnóstico diante de quem conhece a lei. O art. 21 manda
    // repassar automaticamente e a LRF exclui educação do conceito de
    // transferência voluntária.
    const html = gerar();

    expect(html).toContain("O FUNDEB não é bloqueado por pendência administrativa");
    expect(html).toContain("CAUC não alcança o FUNDEB");
    expect(html).toContain("transferências constitucionais");
  });

  it("registra a vedação de consultoria no CACS", () => {
    // Art. 34, §5º, II: veda no conselho funcionário de empresa de assessoria
    // que preste serviços de controle dos recursos do Fundo. É restrição que
    // afeta o desenho do nosso próprio contrato.
    const html = gerar();
    expect(html).toContain("empresa de assessoria ou consultoria");
  });

  it("avisa quem está prestes a sair da faixa do VAAT", () => {
    // A complementação é equalização por insuficiência: encostar no VAAT-MIN
    // zera o repasse. Como o art. 15, II calcula sobre o penúltimo exercício,
    // isso é visível dois anos antes — e é esse aviso que justifica o bloco.
    const proximo = gerar({
      payload: {
        relatorio_dirigido_base: {
          vaat: {
            exercicio: 2026,
            proprio: 9_700,
            minimo: 10_194.38,
            complementacao: 2_000_000,
            distanciaPercentual: 4.85,
            exercicioBaseReceita: 2024,
            habilitacao: "Habilitado",
          },
        },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(proximo).toContain("está a <b>4,9%</b> do mínimo");
    expect(proximo).toContain("arrecadação de <b>2024</b>");

    // Longe do mínimo, o aviso de proximidade não aparece — só a explicação.
    const folgado = gerar({
      payload: {
        relatorio_dirigido_base: {
          vaat: {
            exercicio: 2026,
            proprio: 4_000,
            minimo: 10_194.38,
            complementacao: 9_000_000,
            distanciaPercentual: 60.76,
            exercicioBaseReceita: 2024,
            habilitacao: "Habilitado",
          },
        },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(folgado).not.toContain("do mínimo: uma alta de arrecadação");
    expect(folgado).toContain("penúltimo exercício");
  });

  it("não chama de evidenciado um número que é premissa", () => {
    // O KPI "Já evidenciado" exibia `projecaoRecuperavel`, que é
    // `VAAF × 1,40 + VAAT × 1,30 + VAAR × 1,25` — multiplicadores fixos iguais
    // para todo município. "Evidenciado" significa comprovado, e era a única
    // afirmação do relatório que um gestor bem assessorado derrubava com uma
    // pergunta: "me mostra em qual base isso está evidenciado?".
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { ganho: getGanhoApurado("2930154", "BA", 37_000_000) },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(html).not.toContain("Já evidenciado");
    expect(html).not.toContain("evidenciada");
    expect(html).not.toContain("sinalizado nas bases oficiais atuais");

    expect(html).toContain("Ganho apurado");
    expect(html).toContain("mediana nacional");
    expect(html).toContain("Não é valor perdido comprovado");
  });

  it("distingue o cenário da apuração em vez de somá-los", () => {
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { ganho: getGanhoApurado("2930154", "BA", 37_000_000) },
      } as LevantamentoTemplateInput["payload"],
    });

    // A nota de método passou a existir uma vez só, na Parte I: na página 2 ela
    // aparecia inteira de novo, e a peça gastava mais linha desmentindo o
    // próprio número de capa do que defendendo-o.
    expect(html).toContain("não têm a mesma natureza");
    expect(html).toContain("é premissa, não apuração");
    expect(html.match(/não têm a mesma natureza/g)).toHaveLength(1);
  });

  it("omite o ganho em vez de estimá-lo quando falta o dataset", () => {
    const html = gerar();
    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
    expect(html).toContain("prefere omitir o número a estimá-lo");
  });

  it("não repete o percentual de ICMS que é tese local", () => {
    // Os 28% são tese jurídico-tributária restrita a Goiás; o próprio
    // `fundeb-directed-report.ts` a marca com confiança 5 e "não deve ser
    // fechado automaticamente". O template a imprimia como "percentual mínimo"
    // para qualquer município do país. O mínimo de MDE é 25% (CF art. 212).
    const html = gerar();
    expect(html).not.toContain("28%");
    expect(html).toContain("CF art. 212");
  });

  it("não atribui a nenhuma etapa a maior ponderação do fundo", () => {
    // Educação especial urbano pondera 1,40 e tempo integral do fundamental
    // 1,50 — o teto é 2,17 (creche integral indígena ou quilombola). Duas
    // páginas afirmavam que cada uma delas era a maior da tabela.
    const html = gerar();
    expect(html).not.toContain("maior ponderação no fundo");
    expect(html).not.toContain("maior valor por aluno na tabela oficial");
    // EJA urbano pondera 1,00: vendê-la como alavanca de receita é enganoso.
    expect(html).not.toContain("modalidade com expansão possível");
  });

  it("mostra o denominador ponderado ao lado da matrícula bruta", () => {
    // A receita do fundo é proporcional a Σ(matrícula × fator), e os fatores
    // vão de 1,00 a 2,17. Sem esta página o relatório apresenta uma receita
    // cuja formação não explica.
    const ponderacao = getPonderacaoMunicipal("2801207")!;
    const html = gerar({
      payload: {
        relatorio_dirigido_base: { ponderacao },
      } as LevantamentoTemplateInput["payload"],
    });

    expect(paginas(html)).toBe(LEVANTAMENTO_TOTAL_PAGINAS);
    expect(html).toContain("Matrículas-equivalentes");
    expect(html).toContain("Fator médio da rede");
    expect(html).not.toContain("Matrícula ponderada não disponível");
  });
});

/**
 * As duas folhas comerciais que fecham o relatório. Antes dele, o documento era
 * diagnóstico do começo ao fim: a única menção à consultoria era o quarto item
 * de uma lista, e a última coisa que o gestor lia era o mapa de fontes.
 */
describe("as páginas comerciais do Levantamento", () => {
  it("descreve as quatro frentes com a janela legal de cada uma", () => {
    const html = gerar();

    expect(html).toContain("Quatro frentes, quatro janelas");
    expect(html).toContain("Conferência cadastral do Censo");
    expect(html).toContain("31/08");
    expect(html).toContain("Condicionalidades do VAAR");
    expect(html).toContain("SIOPE bimestral");
  });

  /**
   * REGRA DURA: a Global Company é empresa nova e **não executou contrato**.
   * Nenhuma revisão pode introduzir caso, histórico ou resultado de cliente
   * enquanto isso não mudar — prometer entrega que não se tem é o mesmo
   * defeito do antigo KPI "já evidenciado", só que com consequência
   * contratual.
   */
  it("não alega histórico, caso ou resultado de cliente", () => {
    const html = gerar();

    for (const proibido of [
      "já recuperamos",
      "nossos clientes",
      "case de sucesso",
      "municípios atendidos",
      "recuperou R$",
    ]) {
      expect(html.toLowerCase()).not.toContain(proibido.toLowerCase());
    }
  });

  it("fecha pedindo decisão, com o prazo que o calendário impõe", () => {
    const html = gerar();

    expect(html).toContain("O que acontece se nada for feito");
    expect(html).toContain("O custo de não decidir");
    expect(html).toContain("30 dias da publicação");
    expect(html).toContain("O próximo passo");
  });

  it("não fecha condição comercial que não é deste documento", () => {
    expect(gerar()).toContain("objeto de proposta específica");
  });
});

describe("guarda de plausibilidade do RGF", () => {
  const comPessoal = (percentual: number) =>
    gerar({
      payload: {
        fiscal: {
          siconfi: {
            rcl_ajustada: 18_156_984.31,
            despesa_pessoal_total: 46_095_572.33,
            percentual_despesa_pessoal: percentual,
          },
          situacao_lrf: "Acima do limite maximo",
        },
      } as LevantamentoTemplateInput["payload"],
    });

  /**
   * Ibateguara/AL 2026 devolveu RCL ajustada de R$ 18,1 mi contra despesa de
   * pessoal de R$ 46,1 mi — 253,87%. Não existe município a 253% da RCL em
   * pessoal; existe entrega parcial. Afirmar "acima do limite máximo" com esse
   * número é pior que omitir: o secretário de finanças reconhece o absurdo na
   * hora e o relatório inteiro perde a autoridade.
   */
  it("não acusa o ente quando a entrega do RGF é impossível", () => {
    const html = comPessoal(253.87);

    expect(html).toContain("entrega do RGF inconsistente");
    expect(html).not.toContain("Status LRF: Acima do limite maximo");
    // E o número não vira custo de não decidir na folha de fechamento.
    expect(html).not.toContain("da RCL, acima do limite");
  });

  it("mantém a leitura normal quando a razão é plausível", () => {
    const html = comPessoal(55.75);

    expect(html).toContain("Status LRF: Acima do limite maximo");
    expect(html).not.toContain("entrega do RGF inconsistente");
  });
});

describe("o destaque de ganho na capa", () => {
  it("põe o potencial de incremento como bloco dominante, no teal da marca", () => {
    const r = relatorioMinimo();
    r.projecao.totalGanho = 96_387_711.91;
    r.projecao.ganhoPercentual = 75;
    const html = generateLevantamentoHtml({ relatorio: r });

    expect(html).toContain("Potencial de incremento");
    expect(html).toContain("cover-hero");
    // `brlCompact` usa espaço inquebrável — casar com espaço comum passaria
    // batido e o teste nunca veria o número mudar.
    expect(html).toContain(`+R$\u00a096,39\u00a0mi`);
  });

  /**
   * O fixture mínimo tem projeção zerada, e era exatamente o caso que fazia a
   * capa abrir com "+R$ 0,00 mi" como cereja — pior que não ter cereja. Sem
   * ganho apurado, a âncora passa a ser a receita do exercício e o texto diz
   * por que o outro número não está ali.
   */
  it("não abre com zero quando a projeção não foi apurada", () => {
    const html = gerar();

    expect(html).not.toContain(`+R$\u00a00,00`);
    expect(html).toContain("A projeção do próximo ciclo não foi apurada");
  });
});
