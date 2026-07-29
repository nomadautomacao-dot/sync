import { describe, expect, it } from "vitest";

import {
  generateMunicipalXrayHtml,
  mapMunicipalXrayModel,
} from "@/core/lib/municipal-xray-template";
import { getSituacaoVaar } from "@/core/lib/fundeb-vaar";
import { getGanhoApurado } from "@/core/lib/fundeb-ganho-apurado";
import { getPonderacaoMunicipal } from "@/core/lib/fundeb-ponderacao";
import { getConformidadeSiope } from "@/core/lib/siope-indicadores";
import { getMunicipiosGemeos } from "@/core/lib/municipios-gemeos";
import { getIdebEscolas } from "@/core/lib/ideb-escolas";
import { cruzarContextoResultado, getIndicadoresEscolas } from "@/core/lib/indicadores-escolas";
import { getSaebDistribuicao } from "@/core/lib/saeb-distribuicao";
import { getViolenciaMunicipal } from "@/core/lib/violencia-municipal";
import { getEscolasTerritorio } from "@/core/lib/escolas-territorio";
import { getEnemAbstencao } from "@/core/lib/enem-abstencao";
import { municipalBoundaryFromGeoJson } from "@/core/lib/ibge-municipal-boundary";

/**
 * A página do FUNDEB do Raio-X terminava com um par "alavanca / risco" escrito
 * em termos que serviam para qualquer município do país — e que, por isso, não
 * informavam nenhum. Estes testes garantem que o texto passou a depender do
 * dado: um município habilitado e um inabilitado não podem ler igual.
 */
function html(codigoIBGE: string | null) {
  const model = mapMunicipalXrayModel({
    basePayload: {},
    currentPayload: codigoIBGE
      ? { relatorio_dirigido_base: { vaar: getSituacaoVaar(codigoIBGE) } }
      : {},
    baseYear: 2024,
    currentYear: 2026,
    generatedAt: new Date("2026-07-28T12:00:00.000Z"),
  });

  return generateMunicipalXrayHtml(model);
}

describe("bloco do VAAR no Raio-X municipal", () => {
  it("nomeia a condicionalidade reprovada de quem está fora por conta própria", () => {
    // Costa Marques/RO reprovou em II e III. RO tem municípios habilitados,
    // então nada aqui vem de cascata estadual — a causa é local.
    const saida = html("1100080");

    expect(saida).toContain("VAAR 2026: R$ 0");
    expect(saida).toContain("nas condicionalidades");
    expect(saida).toContain("II, III");
    expect(saida).not.toContain("por reprovação do estado");
  });

  it("trata reprovação isolada como agenda de item único", () => {
    // Cacoal/RO reprovou apenas na Condicionalidade III.
    const saida = html("1100049");

    expect(saida).toContain("na condicionalidade");
    expect(saida).toContain("a reprovação é isolada");
  });

  it("atribui ao estado a reprovação que cascateia", () => {
    const saida = html("3300100"); // Angra dos Reis — reprovação estadual

    expect(saida).toContain("por reprovação do estado");
    expect(saida).toContain("Nenhuma ação municipal reverte isso");
  });

  it("mostra o valor recebido de quem é beneficiário", () => {
    const saida = html("5208707"); // Goiânia — maior VAAR do país

    expect(saida).toMatch(/VAAR 2026: R\$[^<]*recebidos/);
    expect(saida).toContain("habilitado nas cinco condicionalidades");
    expect(saida).not.toContain("por reprovação do estado");
  });

  it("dois municípios em situações opostas não leem igual", () => {
    expect(html("5208707")).not.toBe(html("3304557"));
  });

  it("volta ao texto genérico quando não há dado, sem quebrar a página", () => {
    const saida = html(null);

    expect(saida).toContain("<b>Alavanca:</b>");
    expect(saida).toContain("<b>Risco:</b>");
    expect(saida).not.toContain("VAAR 2026");
  });
});

describe("página das complementações — por que cada uma se perde", () => {
  /**
   * A página nasceu de uma reunião real: um prefeito atribuiu a perda do VAAR
   * a "uma questão fiscal". Não existe essa hipótese — nenhum dos 22 textos de
   * pendência do FNDE em 2026 é fiscal. Questão fiscal derruba o VAAT (art.
   * 13, §4º). Estes testes garantem que a página desfaz a confusão com o
   * texto oficial impresso.
   */
  function comVaar(codigoIBGE: string) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: { relatorio_dirigido_base: { vaar: getSituacaoVaar(codigoIBGE) } },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("imprime o motivo oficial do FNDE, verbatim", () => {
    // Costa Marques/RO reprovou em II e III — a pendência publicada cita os
    // dois incisos. É a resposta documental para "por que perdemos o VAAR".
    const saida = comVaar("1100080");

    expect(saida).toContain("O motivo oficial, nas palavras do FNDE");
    expect(saida).toContain("Não cumprimento do disposto no art. 14, § 1º, II e III");
    expect(saida).toContain("Nenhum inciso é fiscal");
  });

  it("desfaz a confusão entre VAAR e VAAT", () => {
    const saida = comVaar("1100080");

    expect(saida).toContain("essa frase mistura duas parcelas");
    expect(saida).toContain("Pendência fiscal nunca derruba o VAAR");
    expect(saida).toContain("art. 13, §4º");
    expect(saida).toContain("31 de agosto");
  });

  it("não inventa pendência para quem é beneficiário", () => {
    const saida = comVaar("5208707"); // Goiânia — recebe a parcela
    expect(saida).not.toContain("O motivo oficial, nas palavras do FNDE");
    expect(saida).toContain("recebidos");
  });
});

describe("páginas de ponderação e vinculações no Raio-X", () => {
  function completo(codigoIBGE: string, uf: string) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            ganho: getGanhoApurado(codigoIBGE, uf),
            ponderacao: getPonderacaoMunicipal(codigoIBGE),
            conformidade: getConformidadeSiope(codigoIBGE),
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("mostra o ganho apurado com origem e ressalva de conferência", () => {
    const saida = completo("2930154", "BA");

    expect(saida).toContain("ganho apurado por ano");
    expect(saida).toContain("mediana nacional");
    expect(saida).toContain("Antes de tratar como recuperável");
    // A referência do VAAR nunca entra como componente somável.
    expect(saida).toContain("referência");
  });

  it("apura as 14 vinculações sem trocar reais por percentual", () => {
    const saida = completo("2930154", "BA");

    expect(saida).toContain("Vinculações da educação");
    expect(saida).toContain("não trava o FUNDEB");
    // Regressão do PDF de Serra do Ramalho: nenhum percentual de 4+ dígitos.
    expect(saida).not.toMatch(/\d{1,3}\.\d{3},\d%/);
  });

  it("degrada com honestidade quando os datasets faltam", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).toContain("Ponderação indisponível");
    expect(saida).toContain("Declaração ao SIOPE não localizada");
  });

  it("gera as 40 páginas do contrato do renderer, com e sem dados", () => {
    const paginas = (html: string) => html.match(/<section class="page/g)?.length ?? 0;
    expect(paginas(completo("2930154", "BA"))).toBe(40);
    expect(
      paginas(
        generateMunicipalXrayHtml(
          mapMunicipalXrayModel({
            basePayload: {},
            currentPayload: {},
            baseYear: 2024,
            currentYear: 2026,
            generatedAt: new Date("2026-07-29T12:00:00.000Z"),
          }),
        ),
      ),
    ).toBe(40);
  });

  it("numera as páginas sequencialmente a partir do contador", () => {
    // A numeração deixou de ser literal: cada rodapé recebe `prox()`. Uma
    // página inserida sem usar o contador quebraria a sequência — e este
    // teste — antes de chegar ao PDF.
    const html = completo("2930154", "BA");
    const numeros = [...html.matchAll(/<footer class="page-footer"><span>[^<]*<\/span><span>(\d+)<\/span>/g)]
      .map((m) => Number(m[1]));

    // A capa não tem rodapé numerado; o miolo vai de 2 até o total.
    expect(numeros[0]).toBe(2);
    expect(numeros[numeros.length - 1]).toBe(40);
    for (let i = 1; i < numeros.length; i++) expect(numeros[i]).toBe(numeros[i - 1] + 1);
  });
});

describe("gêmeos estatísticos no Raio-X", () => {
  function comGemeos(codigoIBGE: string) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: { gemeos: getMunicipiosGemeos(codigoIBGE) },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("compara com a coorte de porte, nomeando a faixa", () => {
    const saida = comGemeos("2930154");

    expect(saida).toContain("mais parecidos");
    expect(saida).toContain("Mediana dos iguais");
    expect(saida).toContain("Fator médio de ponderação da rede");
  });

  it("diz quanto da coorte capta o VAAR e se o município capta", () => {
    const saida = comGemeos("2930154");
    expect(saida).toContain("VAAR entre os iguais");
    expect(saida).toContain("% da coorte está habilitada");
  });

  it("aponta o indicador de maior distância como candidato a plano de ação", () => {
    // Serra do Ramalho está no percentil 4 em remuneração-70% entre os
    // iguais: a página precisa transformar isso em achado, não em célula.
    const saida = comGemeos("2930154");
    expect(saida).toContain("Onde a distância é maior");
  });

  it("degrada com honestidade sem coorte", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Coorte de comparação indisponível");
  });
});

describe("pontualidade fiscal na página das complementações", () => {
  function comPontualidade(risco: "alto" | "medio" | "baixo", extras: Record<string, unknown> = {}) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            pontualidadeFiscal: {
              risco,
              dca: [
                { exercicio: 2025, entregueEm: "2026-09-10T12:00:00Z", diasAlemDoPrazo: 133, estourouCorteVaat: risco === "alto" },
                { exercicio: 2024, entregueEm: "2025-04-20T12:00:00Z", diasAlemDoPrazo: -10, estourouCorteVaat: false },
              ],
              rreoEntregues: 3,
              rgfEntregues: 1,
            },
            ...extras,
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("prevê o risco VAAT em vez de fazer autópsia", () => {
    const saida = comPontualidade("alto");

    expect(saida).toContain("Risco de perder o VAAT — lado Siconfi: ALTO");
    expect(saida).toContain("após o corte de 31/8");
    expect(saida).toContain("cenário que inabilita");
  });

  it("no risco baixo, diz que a rotina está controlada", () => {
    const saida = comPontualidade("baixo");
    expect(saida).toContain("lado Siconfi: BAIXO");
    expect(saida).toContain("manter a rotina");
  });

  it("cruza com o lado SIOPE quando a declaração está defasada", () => {
    // Siconfi em dia não salva a habilitação se o SIOPE não fechar — os dois
    // lados do corte do art. 13, §4º precisam aparecer juntos.
    const saida = comPontualidade("baixo", {
      conformidade: { ano: 2024, defasado: true, indicadores: [{ cod: "1.1", chave: "mde", rotulo: "MDE", valor: 26, unidade: "percentual", limite: 25, sentido: "min", conforme: true, folga: 1, base: null }] },
    });

    expect(saida).toContain("O outro lado do corte: SIOPE");
    expect(saida).toContain("não consta com declaração no exercício de referência");
  });
});

describe("Saeb/IDEB por escola no Raio-X", () => {
  function comEscolas(codigoIBGE: string, comVaar = false) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            idebEscolas: getIdebEscolas(codigoIBGE),
            ...(comVaar ? { vaar: getSituacaoVaar(codigoIBGE) } : {}),
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("nomeia as escolas da rede com IDEB e Saeb", () => {
    const saida = comEscolas("2930154");
    expect(saida).toContain("A média municipal esconde");
    expect(saida).toContain("IDEB AI");
    // Nome real de escola da rede, vindo da divulgação identificada.
    expect(saida).toMatch(/ESCOLA|ESC |EMEF|EMEIEF/);
  });

  it("liga as escolas ND à reprovação na Condicionalidade II", () => {
    // Costa Marques/RO: reprovado na Cond. II e com escolas de resultado
    // retido por participação — a página diz em quais portas bater.
    const saida = comEscolas("1100080", true);

    expect(saida).toContain("sem resultado divulgado por participação abaixo de 80%");
    expect(saida).toContain("reprovou na Condicionalidade II do VAAR");
    expect(saida).toContain("em quais portas bater");
  });

  it("degrada com honestidade sem a divulgação", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Resultados por escola indisponíveis");
  });
});

describe("contexto por escola no Raio-X", () => {
  /** Reproduz a composição do govia-compat: leitor + cruzamento com o IDEB. */
  function comContexto(codigoIBGE: string) {
    const indicadores = getIndicadoresEscolas(codigoIBGE);
    const ideb = getIdebEscolas(codigoIBGE);
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            indicadoresEscolas:
              indicadores === null
                ? null
                : {
                    ...indicadores,
                    cruzamento: cruzarContextoResultado(
                      new Map(
                        (ideb?.escolas ?? [])
                          .filter((e) => typeof e.ai?.ideb === "number")
                          .map((e) => [e.codigo, e.ai?.ideb as number]),
                      ),
                      indicadores.escolas,
                    ),
                  },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("imprime INSE, complexidade, distorção e abandono por escola, com fontes e anos", () => {
    const saida = comContexto("2930154"); // Serra do Ramalho/BA

    expect(saida).toContain("O IDEB sozinho pune a escola errada");
    expect(saida).toContain("INSE (nível)");
    expect(saida).toContain("INSE médio da rede");
    expect(saida).toContain("INSE 2023, ICG 2021");
  });

  it("acha a escola resiliente e a de alerta numa rede grande", () => {
    // Manaus: 507 escolas municipais no dataset — pares INSE × IDEB de sobra
    // para as medianas do cruzamento significarem alguma coisa.
    const saida = comContexto("1302603");

    expect(saida).toContain("Contexto × resultado");
    expect(saida).toContain("comporta resultado melhor");
  });

  it("liga o abandono por escola à Condicionalidade I do VAAR", () => {
    const saida = comContexto("1302603");
    expect(saida).toContain("Condicionalidade I do VAAR");
  });

  it("degrada com honestidade sem as publicações", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Indicadores de contexto indisponíveis");
  });
});

describe("distribuição de proficiência no Raio-X", () => {
  function comProficiencia(codigoIBGE: string) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: { saebDistribuicao: getSaebDistribuicao(codigoIBGE) },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("imprime a distribuição da rede municipal com os quatro grupos", () => {
    const saida = comProficiencia("2930154"); // Serra do Ramalho/BA

    expect(saida).toContain("A cauda que a média esconde");
    expect(saida).toContain("Insuficiente %");
    expect(saida).toContain("Matemática — 9º ano");
    // 31,8% dos alunos de LP 5º abaixo do piso — o dado real da sonda.
    expect(saida).toContain("31,8%");
  });

  it("liga a cauda insuficiente à Condicionalidade III do VAAR", () => {
    const saida = comProficiencia("2930154");
    expect(saida).toContain("Condicionalidade III do VAAR");
    expect(saida).toContain("redução das desigualdades de aprendizagem");
  });

  it("imprime a convenção de cortes para o número ser auditável", () => {
    const saida = comProficiencia("2930154");
    expect(saida).toContain("Todos Pela Educação/QEdu");
  });

  it("degrada com honestidade sem a planilha", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Distribuição do Saeb indisponível");
  });
});

describe("contexto de segurança no Raio-X", () => {
  function comViolencia(codigoIBGE: string, extras: Record<string, unknown> = {}) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: { violencia: getViolenciaMunicipal(codigoIBGE), ...extras },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("imprime a série com a régua nacional do mesmo ano e a faixa juvenil", () => {
    const saida = comViolencia("1302603"); // Manaus — acima da nacional

    expect(saida).toContain("O território que cerca a escola");
    expect(saida).toContain("taxa nacional no mesmo ano");
    expect(saida).toContain("acima da nacional");
    expect(saida).toContain("dos homicídios são de jovens");
  });

  it("cruza com as escolas sem resultado no Saeb quando elas existem", () => {
    const saida = comViolencia("1302603", { idebEscolas: getIdebEscolas("1302603") });
    expect(saida).toContain("dia de prova é dia de risco");
  });

  it("trata o dado como contexto, nunca como rótulo", () => {
    const saida = comViolencia("1302603");
    expect(saida).toContain("não como comparação pública entre municípios");
  });

  it("degrada com honestidade sem a série", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Dados de violência indisponíveis");
  });
});

describe("mapa das escolas no Raio-X", () => {
  // Contorno sintético cobrindo Manaus (lng -61..-59, lat -4..-2): as escolas
  // reais do dataset precisam cair dentro do viewBox projetado.
  const CONTORNO = municipalBoundaryFromGeoJson({
    type: "Polygon",
    coordinates: [[[-61, -4], [-59, -4], [-59, -2], [-61, -2], [-61, -4]]],
  });

  function comMapa(codigoIBGE: string, comContorno = true) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: { escolasTerritorio: getEscolasTerritorio(codigoIBGE) },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
        ...(comContorno ? { boundary: CONTORNO } : {}),
      }),
    );
  }

  it("plota as escolas sobre o contorno com a legenda de localização", () => {
    const saida = comMapa("1302603"); // Manaus

    expect(saida).toContain("A rede sobre o território");
    expect(saida).toContain('class="map-escolas"');
    expect(saida).toContain("dot-dif");
    expect(saida).toContain("localização diferenciada");
    // 492 escolas georreferenciadas geram centenas de pontos no SVG.
    expect((saida.match(/<circle class="dot-/g) ?? []).length).toBeGreaterThan(400);
  });

  it("nomeia as escolas ribeirinhas e transforma a embarcação em pergunta de campo", () => {
    const saida = comMapa("1302603");
    expect(saida).toContain("comunidade ribeirinha");
    expect(saida).toContain("o transporte dessas escolas é por embarcação?");
    expect(saida).toContain("alunos em transporte público");
  });

  it("abre a cor/raça por zona e liga à desigualdade racial da Cond. III", () => {
    // Manaus: 75,9% negra na zona urbana, 80,8% na rural (Censo 2025).
    const saida = comMapa("1302603");

    expect(saida).toContain("Cor/raça por zona");
    expect(saida).toContain("75,9%");
    expect(saida).toContain("80,8%");
    expect(saida).toContain("desigualdade <b>racial</b> de aprendizagem");
  });

  it("sem malha, mantém as contagens e avisa que o mapa faltou", () => {
    const saida = comMapa("1302603", false);
    expect(saida).toContain("Malha territorial indisponível");
    expect(saida).toContain("escolas municipais ativas");
  });

  it("degrada com honestidade sem o dataset", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Mapa da rede indisponível");
  });
});

describe("abstenção do ENEM na página de economia", () => {
  function comEnem(codigoIBGE: string, uf: string) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            // A página de economia degrada sem o VAB; o bloco do ENEM mora nela.
            economiaLocal: {
              anoPib: 2021,
              setorDominante: "agropecuaria",
              setores: { agropecuaria: 55, industria: 5, servicos: 25, administracao: 15 },
              taxaAlfabetizacao: 80,
            },
            enemAbstencao: getEnemAbstencao(codigoIBGE, uf),
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("compara a abstenção local com a régua da UF e explica o recorte", () => {
    // Serra do Ramalho: 31,6% contra 27,4% da BA — acima da régua.
    const saida = comEnem("2930154", "BA");

    expect(saida).toContain("O termômetro do ENEM 2024");
    expect(saida).toContain("31,6%");
    expect(saida).toContain("27,4%");
    expect(saida).toContain("município de prova");
    expect(saida).toContain("não é percebido como porta de entrada");
  });

  it("some em silêncio para município sem local de prova", () => {
    const saida = comEnem("0000000", "BA");
    expect(saida).not.toContain("O termômetro do ENEM");
  });
});

describe("alfabetização (ICA) no Raio-X", () => {
  function comAlfabetizacao(alfabetizacao: Record<string, unknown> | null) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: { relatorio_dirigido_base: { alfabetizacao } },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  const manaus = {
    serie: [
      { ano: 2023, valor: 52, meta: null, cumpriu: null },
      { ano: 2024, valor: 50, meta: 57, cumpriu: false },
      { ano: 2025, valor: 58, meta: 61, cumpriu: false },
    ],
    ultimo: { ano: 2025, valor: 58, meta: 61, cumpriu: false },
    variacaoPontos: 6,
    proximaMeta: { ano: 2026, meta: 66, faltamPontos: 8 },
    metaFinal: { ano: 2030, meta: 80, ritmoNecessario: 4.4 },
    ritmoObservado: 8,
    nivel: 2,
    nivelRotulo: "Nível 2 (50% a 60%)",
    participacao: 81.7,
    participacaoFragil: false,
    uf: { sigla: "AM", valor: 57, ano: 2025 },
  };

  it("afirma cumprimento da meta do próprio município, sem ressalva de referência", () => {
    const saida = comAlfabetizacao(manaus);
    expect(saida).toContain("58,0% das crianças alfabetizadas no 2º ano");
    expect(saida).toContain("3,0 pontos abaixo");
    expect(saida).toContain("não cumpriu");
    expect(saida).toContain("Metas do CNCA pactuadas por município");
  });

  it("compara o ritmo observado com o ritmo que a meta final exige", () => {
    const saida = comAlfabetizacao(manaus);
    // ritmo observado 8 >= necessário 4,4 → o texto reconhece que chega lá.
    expect(saida).toContain("O ritmo atual chega lá");
    expect(saida).toContain("4,4 pontos por ano");

    const lento = comAlfabetizacao({ ...manaus, ritmoObservado: 1 });
    expect(lento).toContain("O ritmo atual não chega lá");
    expect(lento).toContain("recomposição focalizada");
  });

  it("mostra a próxima meta como problema de lista nominal", () => {
    const saida = comAlfabetizacao(manaus);
    expect(saida).toContain("66,0%");
    expect(saida).toContain("8,0 pontos");
    expect(saida).toContain("lista nominal");
  });

  it("participação baixa relativiza o resultado em vez de escondê-la", () => {
    const fragil = comAlfabetizacao({ ...manaus, participacao: 62.4, participacaoFragil: true });
    expect(fragil).toContain("Abaixo de 80%, o resultado descreve quem fez a prova");
    expect(fragil).toContain("empurra o percentual para cima");
  });

  it("liga alfabetização à Condicionalidade I do VAAR", () => {
    const saida = comAlfabetizacao(manaus);
    expect(saida).toContain("Condicionalidade I do VAAR");
    expect(saida).toContain("distorção idade-série");
  });

  it("sem medição, diz que ausência não é resultado ruim", () => {
    const saida = comAlfabetizacao(null);
    expect(saida).toContain("Indicador Criança Alfabetizada indisponível");
    expect(saida).toContain("não é resultado ruim, é ausência de medição");
  });
});

describe("ciclo político no Raio-X", () => {
  function comCiclo(cicloPolitico: Record<string, unknown> | null) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: { relatorio_dirigido_base: { cicloPolitico } },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  const base = {
    atual: { prefeito: "David Almeida", partido: "AVANTE", eleicao: 2024 },
    mandato: { inicio: 2025, fim: 2028 },
    proximaEleicao: 2028,
    panorama: { reeleitos: 1760, sucessoes: 771, alternancias: 2501, total: 5032 },
  };

  it("imprime as duas travas legais do fim de mandato com base legal e ano", () => {
    const saida = comCiclo({ ...base, anterior: null, situacao: "indeterminado" });
    expect(saida).toContain("2025–2028");
    expect(saida).toContain('Lei nº 9.504/1997, art. 73, VI, "a"');
    expect(saida).toContain("LRF, art. 42 e art. 21");
    expect(saida).toContain("três meses antes do pleito");
  });

  it("alternância vira alerta sobre a declaração do primeiro Censo do mandato", () => {
    const saida = comCiclo({
      ...base,
      anterior: { prefeito: "Arthur Neto", partido: "PSDB", eleicao: 2020 },
      situacao: "alternancia",
    });
    expect(saida).toContain("a secretaria começou do zero");
    expect(saida).toContain("declaração do Censo do primeiro ano");
    expect(saida).toContain("Arthur Neto");
  });

  it("reeleição muda o argumento da consultoria em vez de repetir o mesmo texto", () => {
    const reeleito = comCiclo({
      ...base,
      anterior: { prefeito: "David Almeida", partido: "AVANTE", eleicao: 2020 },
      situacao: "reeleicao",
    });
    expect(reeleito).toContain("continuidade com responsabilidade acumulada");
    expect(reeleito).not.toContain("a secretaria começou do zero");

    const sucessao = comCiclo({
      ...base,
      anterior: { prefeito: "Outro Nome", partido: "AVANTE", eleicao: 2020 },
      situacao: "sucessao_mesmo_partido",
    });
    expect(sucessao).toContain("Sucessão dentro do mesmo grupo político");
    expect(sucessao).toContain("Vale mapear quem ficou");
  });

  it("sem o pleito anterior, transforma a dúvida em pergunta em vez de afirmar", () => {
    const saida = comCiclo({ ...base, anterior: null, situacao: "indeterminado" });
    expect(saida).toContain("Comparação com o mandato anterior indisponível");
    expect(saida).toContain("entra no roteiro de campo");
  });

  it("dá a régua nacional das três situações", () => {
    const saida = comCiclo({ ...base, anterior: null, situacao: "indeterminado" });
    expect(saida).toContain("1.760");
    expect(saida).toContain("2.501");
    expect(saida).toContain("a descontinuidade administrativa a regra");
  });

  it("sem resultado eleitoral, degrada sem inventar mandato", () => {
    const saida = comCiclo(null);
    expect(saida).toContain("Resultado eleitoral não localizado na base");
  });
});

describe("requisitos fiscais do CAUC no Raio-X", () => {
  function comCauc(caucRequisitos: Record<string, unknown> | null) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: { relatorio_dirigido_base: { caucRequisitos } },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  const base = {
    dataPesquisa: "2026-07-29",
    comprovados: 25,
    desabilitados: 3,
    proximoVencimento: { codigo: "1.2", rotulo: "Regularidade no pagamento de precatórios judiciais", validadeAte: "2026-07-29" },
    panorama: { comPendencia: 2493, total: 5569 },
  };

  it("município sem pendência é dito regular, com o prazo mais próximo nomeado", () => {
    const saida = comCauc({ ...base, pendencias: [], pendenciasEducacao: [] });
    expect(saida).toContain("Nenhuma pendência no extrato do CAUC");
    expect(saida).toContain("precatórios judiciais");
    expect(saida).toContain("Nenhuma pendência nos cinco itens de educação");
  });

  it("dá régua nacional à pendência local", () => {
    const saida = comCauc({ ...base, pendencias: [], pendenciasEducacao: [] });
    expect(saida).toContain("2.493 dos 5.569 municípios");
    expect(saida).toContain("44,8%");
  });

  it("nomeia pendências e liga a de educação ao VAAT", () => {
    const saida = comCauc({
      ...base,
      comprovados: 22,
      pendencias: [
        { codigo: "3.2.3", rotulo: "Encaminhamento do Anexo 8 do RREO ao Siope" },
        { codigo: "5.7", rotulo: "Aplicação de 50% da complementação VAAT do Fundeb na educação infantil" },
      ],
      pendenciasEducacao: [
        { codigo: "3.2.3", rotulo: "Encaminhamento do Anexo 8 do RREO ao Siope" },
        { codigo: "5.7", rotulo: "Aplicação de 50% da complementação VAAT do Fundeb na educação infantil" },
      ],
    });
    expect(saida).toContain("2 pendências bloqueiam");
    expect(saida).toContain("Anexo 8 do RREO ao Siope");
    expect(saida).toContain("art. 13, §4º da Lei nº 14.113/2020");
    expect(saida).toContain("a transferência voluntária que não é assinada");
  });

  it("explica que Desabilitado é do país inteiro, nunca falha local", () => {
    const saida = comCauc({ ...base, pendencias: [], pendenciasEducacao: [] });
    expect(saida).toContain("igual para todos os entes do país");
    expect(saida).toContain("nunca é falha local");
  });

  it("sem o extrato, degrada sem estimar", () => {
    const saida = comCauc(null);
    expect(saida).toContain("Extrato do CAUC indisponível");
    expect(saida).toContain("nenhum valor é estimado");
  });
});

describe("dinheiro federal além do fundo no Raio-X", () => {
  function comFederal(base: Record<string, unknown>) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: { relatorio_dirigido_base: base },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  const emendas = {
    geradoEm: "2026-07-29",
    anos: [
      { ano: 2024, quantidade: 7, empenhado: 45_144_107, pago: 30_411_038, quantidadeEducacao: 2, empenhadoEducacao: 2_747_163, pagoEducacao: 200_550 },
      { ano: 2025, quantidade: 2, empenhado: 6_500_000, pago: 770_000, quantidadeEducacao: 0, empenhadoEducacao: 0, pagoEducacao: 0 },
    ],
    autoresEducacao: [{ nome: "OMAR AZIZ", empenhado: 2_747_163 }],
  };

  it("mostra emendas por ano com o recorte de educação e o autor", () => {
    const saida = comFederal({ emendas });
    expect(saida).toContain("O dinheiro de Brasília que não passa pelo FUNDEB");
    expect(saida).toContain("R$ 45,1 mi");
    expect(saida).toContain("OMAR AZIZ");
    expect(saida).toContain("função 12");
    expect(saida).toContain("município de aplicação identificado");
  });

  it("resume a carteira de convênios vigentes e cobra os sem liberação", () => {
    const saida = comFederal({
      emendas,
      conveniosFederais: {
        total: 40,
        truncado: false,
        vigentes: 12,
        valorVigentes: 80_000_000,
        liberadoVigentes: 25_000_000,
        educacaoVigentes: 3,
        valorEducacaoVigentes: 9_000_000,
        semLiberacao: 4,
        topVigentes: [
          { objeto: "Construção de escola de ensino fundamental", orgao: "FNDE", valor: 6_000_000, valorLiberado: 0, fimVigencia: "2027-10-01", situacao: "NORMAL", educacao: true },
        ],
      },
    });
    expect(saida).toContain("Convênios com o ente municipal");
    expect(saida).toContain("Construção de escola de ensino fundamental");
    expect(saida).toContain("sem liberação");
  });

  it("sanção sobre o ente vira risco; ausência vira leitura de governança", () => {
    const sancionado = comFederal({
      emendas,
      sancoesFederais: {
        enteSancionado: [
          { cadastro: "CEIS", sancionado: "MUNICIPIO DE EXEMPLO", orgaoSancionador: "CGU", tipo: "Inidoneidade", fimSancao: "2027-01-01" },
        ],
        aplicadasPeloEnte: 0,
        exemplosAplicadas: [],
      },
    });
    expect(sancionado).toContain("O ente aparece em cadastro de sanções");
    expect(sancionado).toContain("trava transferência voluntária");

    const limpo = comFederal({
      emendas,
      sancoesFederais: { enteSancionado: [], aplicadasPeloEnte: 5, exemplosAplicadas: [] },
    });
    expect(limpo).toContain("não aparece como sancionado");
    expect(limpo).toContain("Lei 14.133");
  });

  it("sem nenhuma das três fontes, degrada sem estimar nada", () => {
    const saida = comFederal({});
    expect(saida).toContain("Emendas e convênios indisponíveis nesta emissão");
    expect(saida).toContain("Nenhum valor é estimado");
  });
});

describe("obras FNDE no Raio-X", () => {
  function comObras(obrasFnde: Record<string, unknown> | null) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: { relatorio_dirigido_base: { obrasFnde } },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("destaca obra parada como perda tripla, com valores do painel", () => {
    const saida = comObras({
      totalObras: 10,
      paralisadas: 2,
      inacabadas: 0,
      emRetomada: 6,
      valorParadoEstimado: 3_500_000,
      valorEstimadoRepactuacao: 16_157_618,
      obrasCriticas: [
        { ano: 2014, tipo: "Quadra escolar", classificacao: "Coberta", situacao: "PARALISADA", estimativaRepasse: 2_000_000, execucao: 34_040 },
        { ano: 2013, tipo: "Creche", classificacao: "Tipo B", situacao: "PARALISADA", estimativaRepasse: 1_500_000, execucao: 0 },
      ],
    });

    expect(saida).toContain("Obra parada é perda tripla");
    expect(saida).toContain("Quadra escolar");
    expect(saida).toContain("paralisada");
    expect(saida).toContain("fator 1,55 que não entra");
    expect(saida).toContain("repactuação");
  });

  it("sem obra crítica, vira rotina de execução em vez de resgate", () => {
    const saida = comObras({
      totalObras: 4,
      paralisadas: 0,
      inacabadas: 0,
      emRetomada: 0,
      valorParadoEstimado: 0,
      valorEstimadoRepactuacao: null,
      obrasCriticas: [],
    });

    expect(saida).toContain("Nenhuma obra crítica");
    expect(saida).toContain("rotina de execução, não resgate");
  });

  it("degrada com honestidade sem o painel", () => {
    const saida = comObras(null);
    expect(saida).toContain("Sem obras no painel público do Pacto");
  });

  it("nomeia a safra dominante com a janela de colheita como pergunta de campo", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            economiaLocal: {
              anoPib: 2021,
              setorDominante: "agropecuaria",
              setores: { agropecuaria: 55, industria: 5, servicos: 25, administracao: 15 },
              taxaAlfabetizacao: 80,
              culturaDominante: { nome: "Soja", participacaoPct: 46.4, anoPam: 2024 },
            },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).toContain("A safra tem nome (PAM 2024)");
    expect(saida).toContain("Soja");
    expect(saida).toContain("janeiro a março");
    expect(saida).toContain("a evasão é calendário, não pedagogia");
  });

  it("cultura de colheita contínua muda a leitura para pressão constante", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            economiaLocal: {
              anoPib: 2021,
              setorDominante: "administracao",
              setores: { agropecuaria: 29, industria: 8, servicos: 27, administracao: 36 },
              taxaAlfabetizacao: 82,
              culturaDominante: { nome: "Banana", participacaoPct: 34.8, anoPam: 2024 },
            },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).toContain("Banana");
    expect(saida).toContain("Colheita contínua");
    expect(saida).toContain("o turno, não o mês");
  });
});

describe("demografia e demanda futura no Raio-X", () => {
  const FIXTURE = {
    fonte: "IBGE — Censo 2022 e Registro Civil",
    anoCenso: 2022,
    faixas: { creche: 2360, preEscola: 1089, anosIniciais: 3038, anosFinais: 2372 },
    nascimentos: [
      { anoNascimento: 2020, nascidos: 552, chegaPreEscolaEm: 2024, chegaPrimeiroAnoEm: 2026 },
      { anoNascimento: 2024, nascidos: 480, chegaPreEscolaEm: 2028, chegaPrimeiroAnoEm: 2030 },
    ],
    tendenciaNascimentosPct: -13,
  };

  function comDemografia(extras: Record<string, unknown> = {}) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: { demografiaEducacional: FIXTURE },
          ...extras,
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("projeta as coortes até o 1º ano com o calendário certo", () => {
    const saida = comDemografia();
    expect(saida).toContain("já nasceu");
    expect(saida).toContain("pré-escola em <b>2028</b>");
    expect(saida).toContain("1º ano em <b>2030</b>");
  });

  it("trata nascimento em queda como base do fundo encolhendo em data conhecida", () => {
    const saida = comDemografia();
    expect(saida).toContain("A base do fundo encolhe em data conhecida");
    expect(saida).toContain("cobertura");
  });

  it("calcula a cobertura de creche como piso, com o denominador do Censo", () => {
    // 590 matrículas municipais ÷ 2.360 crianças de 0–3 = 25%.
    const saida = comDemografia({ educacao: { matriculas_creche: 590, matriculas_pre_escola: 980 } });
    expect(saida).toContain("25,0%");
    expect(saida).toContain("meta PNE: 50%");
    expect(saida).toContain("Piso = matrículas da <b>rede municipal</b>");
  });

  it("mostra o atendimento de todas as redes e aponta faixa obrigatória descoberta", () => {
    // Anos finais com 1.900 matrículas totais ÷ 2.372 (11–14) = 80% — numa
    // faixa obrigatória, os 20% restantes são criança fora da escola.
    const saida = comDemografia({
      educacao: { matriculas_creche: 590, matriculas_pre_escola: 980 },
      relatorio_dirigido_base: {
        demografiaEducacional: FIXTURE,
        atendimentoTotal: { ano: 2025, creche: 1200, preEscola: 1050, anosIniciais: 3000, anosFinais: 1900 },
      },
    });

    expect(saida).toContain("Todas as redes");
    expect(saida).toContain("Censo Escolar 2025");
    expect(saida).toContain("Sinal de busca ativa");
    expect(saida).toContain("anos finais");
  });

  it("degrada com honestidade quando o IBGE não responde", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Demografia indisponível");
  });

  it("trata maternidade adolescente como resposta de rede, nunca cobrança individual", () => {
    const saida = comDemografia({
      relatorio_dirigido_base: {
        demografiaEducacional: {
          ...FIXTURE,
          maesAdolescentes: { ano: 2024, nascimentos: 86, percentualDoTotal: 17.9 },
        },
      },
    });

    expect(saida).toContain("Maternidade adolescente");
    expect(saida).toContain("demanda de creche");
    expect(saida).toContain("nunca a cobrança individual");
  });
});

describe("território e fator no Raio-X", () => {
  function comPovos(quilombola: Record<string, unknown>, indigena: Record<string, unknown>) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            equidadeTerritorial: {
              fonte: "IBGE × FNDE",
              anoCenso: 2022,
              quilombola,
              indigena,
              fatorFaixa: { minimo: 1.4, maximo: 2.17 },
            },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  const SEM_SINAL = { populacao: 15_608, emIdadeEscolar: 3_521, matriculasNosSegmentos: 2_376, razaoAtendimento: 67.5, sinalConferencia: false };
  const COM_SINAL = { populacao: 71_691, emIdadeEscolar: 15_647, matriculasNosSegmentos: 142, razaoAtendimento: 0.9, sinalConferencia: true };
  const AUSENTE = { populacao: 0, emIdadeEscolar: 0, matriculasNosSegmentos: 0, razaoAtendimento: null, sinalConferencia: false };

  it("sinaliza a conferência com o valor do fator, sem acusar", () => {
    const saida = comPovos(AUSENTE, COM_SINAL);

    expect(saida).toContain("Sinal de conferência");
    expect(saida).toContain("1,4 a 2,17");
    // A moldura anti-acusação é obrigatória: o fator segue a escola.
    expect(saida).toContain("pode ser legítimo");
    expect(saida).toContain("localização diferenciada");
  });

  it("reconhece declaração compatível em vez de fabricar problema", () => {
    const saida = comPovos(SEM_SINAL, AUSENTE);
    expect(saida).toContain("compatível com a presença do povo");
    expect(saida).not.toContain("Sinal de conferência");
  });

  it("registra a ausência como informação com fonte", () => {
    const saida = comPovos(AUSENTE, AUSENTE);
    expect(saida).toContain("Sem população quilombola ou indígena no Censo 2022");
    expect(saida).toContain("melhor que omitir a verificação");
  });
});

describe("frequência do Bolsa Família no Raio-X", () => {
  function comPbf(extras: Record<string, unknown> = {}) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            frequenciaBolsaFamilia: {
              fonte: "MDS — SICON",
              competencia: "202605",
              publicoEducacao: 6080,
              acompanhados: 5840,
              percAcompanhados: 96.05,
              naoLocalizados: 141,
              percNaoLocalizados: 2.32,
              semInformacaoFrequencia: 240,
              percFrequenciaAcima: 99.98,
              sancoes: { advertencias: 8, bloqueios: 2, suspensoes: 2, cancelamentos: 0, familiasEmFaseDeSuspensao: 6 },
              ...extras,
            },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("manda a manchete para os não localizados, com a rota da busca ativa", () => {
    const saida = comPbf();

    expect(saida).toContain("141 crianças beneficiárias que a escola não localizou");
    expect(saida).toContain("lista nominal");
    expect(saida).toContain("busca ativa");
    // O elo com o dinheiro: aluno recuperado vira Censo, Censo vira FUNDEB.
    expect(saida).toContain("o Censo define o FUNDEB");
  });

  it("imprime a moldura de proteção, nunca a culpa da família", () => {
    const saida = comPbf();
    expect(saida).toContain("proteção, não punição");
    expect(saida).toContain("não das famílias");
    expect(saida).toContain("nenhum dado nominal é acessado ou armazenado");
  });

  it("cobra o registro quando o acompanhamento é baixo", () => {
    // Manaus acompanha 73%: antes de buscar aluno, o município precisa saber
    // quem procurar — e isso é gestão do acompanhamento, não pedagogia.
    const saida = comPbf({ percAcompanhados: 73.07 });
    expect(saida).toContain("a prioridade é o registro");
  });

  it("degrada com honestidade quando o MDS não responde", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Acompanhamento do PBF indisponível");
  });
});

describe("assentamentos e economia local no Raio-X", () => {
  it("sinaliza famílias assentadas sem escola declarada na condição", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            assentamentos: { fonte: "INCRA", qtd: 4, familias: 520, capacidade: 600, areaHa: 12_000 },
            equidade: {
              anoCenso: 2024,
              municipal: { total: 5_000, indigena: 0 },
              negraMunicipal: 2_000,
              naoDeclaradaPct: 10,
              cadastroFragil: false,
              escolas: { municipaisRurais: 8, municipaisEducacaoIndigena: 0, municipaisQuilombolas: 0, municipaisAssentamento: 0 },
            },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).toContain("Assentamentos da reforma agrária");
    expect(saida).toContain("520</b> famílias");
    expect(saida).toContain("Sinal de conferência");
    expect(saida).toContain("fator +15%");
  });

  it("classifica a economia e liga o EJA ao custo de oportunidade", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            economiaLocal: {
              fonte: "IBGE",
              anoPib: 2021,
              setores: { agropecuaria: 38, industria: 15, servicos: 40.9, administracao: 6.1 },
              setorDominante: "agropecuaria",
              taxaAlfabetizacao: 82.19,
              analfabetosEstimados: null,
            },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).toContain("Uma economia de agropecuária");
    expect(saida).toContain("Economia de <b>safra</b>");
    expect(saida).toContain("O mercado do EJA");
    // A moldura anti-determinismo é obrigatória.
    expect(saida).toContain("nunca determinística");
  });

  it("degrada com honestidade quando o IBGE não responde", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
    expect(saida).toContain("Economia local indisponível");
  });
});

describe("conformidade legal no Raio-X municipal", () => {
  /**
   * Modelo mínimo com o bloco de conformidade. Só os campos que a página lê —
   * o resto do perfil fica ausente, e cada página sabe se virar sem ele.
   */
  function comConformidade() {
    const ind = (valor: number | null) => ({
      valor,
      fonte: "SIOPE/FNDE",
      ano: 2025,
      status: "oficial" as const,
    });

    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
        profile: {
          conformidadeEducacional: {
            exercicio: 2025,
            mdeAplicado: ind(27.4),
            despesaMde: ind(12_000_000),
            receitaImpostos: ind(43_800_000),
            fundebRemuneracao: ind(74.1),
            fundebRemuneracaoValor: ind(21_000_000),
            fundebRecebido: ind(28_300_000),
          },
        } as never,
      }),
    );
  }

  it("atribui os 70% aos profissionais da educação básica, não ao magistério", () => {
    // Art. 26 da Lei 14.113/2020: os 70% alcançam todos os profissionais da
    // educação básica. Os 60% restritos ao magistério eram o FUNDEB anterior
    // (Lei 11.494/2007), revogado. O proprio modulo de dados que alimenta esta
    // pagina ja documenta assim, e o Levantamento avisa que confundir os dois e
    // o erro mais comum -- o Raio-X dizia "remuneracao do magisterio" e
    // contradizia os dois.
    const saida = comConformidade();

    expect(saida).toContain("remuneração dos profissionais");
    expect(saida).not.toContain("remuneração do magistério");
    expect(saida).toContain("apoio técnico, administrativo e operacional");
    expect(saida).toContain("art. 26 da Lei 14.113/2020");
  });

  it("mantém o mínimo de MDE em 25%, o da Constituição", () => {
    const saida = comConformidade();
    expect(saida).toContain("art. 212 da Constituição");
    expect(saida).not.toContain("28%");
  });
});

describe("capa territorial do Raio-X municipal", () => {
  it("embute a silhueta oficial no próprio HTML", () => {
    const model = mapMunicipalXrayModel({
      basePayload: {},
      currentPayload: {
        dados_basicos: {
          nome: "Senhor do Bonfim",
          uf: "BA",
          codigo_ibge: "2930105",
          regiao: "Nordeste",
        },
      },
      baseYear: 2025,
      currentYear: 2026,
      boundary: {
        path: "M 42.00 42.00 L 678.00 42.00 L 678.00 678.00 Z",
        viewBox: "0 0 720 720",
        source: "IBGE — Malhas Territoriais",
        projection: { minX: 0, maxY: 0, scale: 1, offsetX: 0, offsetY: 0 },
      },
    });

    const saida = generateMunicipalXrayHtml(model);

    expect(saida).toContain("Contorno territorial de Senhor do Bonfim");
    expect(saida).toContain('class="territory-shape"');
    expect(saida).toContain("IBGE — Malhas Territoriais");
    expect(saida).toContain("Grade editorial única");
  });

  it("mantém uma capa cartográfica quando a malha está indisponível", () => {
    const saida = html(null);

    expect(saida).toContain("territory-fallback");
    expect(saida).toContain("Malha municipal indisponível");
  });
});
