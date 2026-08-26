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
import {
  getEscolasTerritorio,
  resumirTerritorio,
  type EscolaTerritorio,
} from "@/core/lib/escolas-territorio";
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
    expect(saida).toContain("Nenhum é fiscal");
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

  it("gera as 42 páginas do contrato do renderer, com e sem dados", () => {
    const paginas = (html: string) => html.match(/<section class="page/g)?.length ?? 0;
    expect(paginas(completo("2930154", "BA"))).toBe(42);
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
    ).toBe(42);
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
    expect(numeros[numeros.length - 1]).toBe(42);
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

describe("pontualidade fiscal na página dos requisitos fiscais", () => {
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
    // Feira de Santana/BA: reprovada na Cond. II e com escolas de resultado
    // retido por participação em 2025 — a página diz em quais portas bater.
    const saida = comEscolas("2910800", true);

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
    expect(saida).toContain("O transporte dessas escolas é por embarcação?");
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

  it("lista longa de pendências compacta a tabela; lista curta não", () => {
    const muitas = Array.from({ length: 12 }, (_, i) => ({
      codigo: `9.${i + 1}`,
      rotulo: `Requisito fiscal de exemplo número ${i + 1}`,
    }));
    const saida = comCauc({ ...base, pendencias: muitas, pendenciasEducacao: [] });
    expect(saida).toContain(`<table class="densa">`);
    expect(saida).toContain("Requisito fiscal de exemplo número 12");

    const poucas = comCauc({
      ...base,
      pendencias: muitas.slice(0, 2),
      pendenciasEducacao: [],
    });
    expect(poucas).not.toContain(`class="densa"`);
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
    expect(saida).toContain("nunca cobrança individual");
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

describe("densidade e dispersão da rede no Raio-X", () => {
  function escola(
    parcial: Partial<EscolaTerritorio> & { codigo: string },
  ): EscolaTerritorio {
    return {
      rural: false,
      dif: 0,
      lat: null,
      lng: null,
      matriculas: null,
      transporte: null,
      racas: null,
      ...parcial,
    };
  }

  /**
   * Rede sintética: duas urbanas coladas (núcleo ≈ -9.0/-37.0) e duas rurais a
   * ~22 km e ~44 km ao sul. Números redondos para as asserções serem legíveis.
   */
  const REDE = [
    escola({ codigo: "27000001", lat: -9.0, lng: -37.01, matriculas: 400 }),
    escola({ codigo: "27000002", lat: -9.0, lng: -36.99, matriculas: 600 }),
    escola({ codigo: "27000003", lat: -9.2, lng: -37.0, rural: true, matriculas: 100 }),
    escola({ codigo: "27000004", lat: -9.4, lng: -37.0, rural: true, matriculas: 150 }),
  ];

  function render(opcoes: { pctRural?: number | null; area?: number | null } = {}) {
    const { pctRural = 20, area = 500 } = opcoes;
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            escolasTerritorio: { ano: 2025, escolas: REDE, resumo: resumirTerritorio(REDE) },
            perfilIBGE: area === null ? {} : { areaTerritorial: area },
            ...(pctRural === null
              ? {}
              : {
                  populacaoRural: {
                    ano: 2022,
                    urbana: 10_000,
                    rural: Math.round((10_000 * pctRural) / (100 - pctRural)),
                    total: Math.round(10_000 / ((100 - pctRural) / 100)),
                    pctRural,
                  },
                }),
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("mede densidade, envergadura e distância das rurais ao núcleo urbano", () => {
    const saida = render();

    expect(saida).toContain("Densidade e dispersão");
    expect(saida).toContain("escolas por 100 km²");
    // 4 escolas em 500 km².
    expect(saida).toContain("0,8");
    // Envergadura: da urbana ao extremo sul, ~44 km.
    expect(saida).toContain("envergadura da rede");
    expect(saida).toContain("distância média das rurais ao núcleo");
  });

  it("declara a distância em linha reta como piso, não como distância rodoviária", () => {
    expect(render()).toContain("a rodoviária é maior, nunca menor");
  });

  it("faz a pergunta de campo quando a matrícula rural fica abaixo da população rural", () => {
    // Matrícula rural da REDE = 250/1250 = 20%. População rural em 45% abre
    // uma lacuna de 25 pontos.
    const saida = render({ pctRural: 45 });

    expect(saida).toContain("transportada para a escola urbana");
    expect(saida).toContain("quantas rotas levam aluno do campo à sede");
  });

  it("aponta rede mais rural que o município quando a matrícula excede a população", () => {
    const saida = render({ pctRural: 5 });

    expect(saida).toContain("a rede é mais rural que o município");
    expect(saida).toContain("está declarada corretamente na coleta");
  });

  it("reconhece proporção equilibrada sem inventar achado", () => {
    const saida = render({ pctRural: 22 });

    expect(saida).toContain("acompanha a população rural");
    expect(saida).not.toContain("transportada para a escola urbana");
  });

  /**
   * Regressão do caso Manaus. A primeira versão comparava só a diferença em
   * pontos percentuais, com limiar de 8: população rural 1,0% contra matrícula
   * rural 5,4% dava 4,4 pontos e o relatório afirmava "acompanha a população
   * rural, sem sinal de concentração" — quando a fatia da matrícula era cinco
   * vezes a da população. Diferença pequena em pontos, enorme em razão.
   */
  it("não chama de equilíbrio o que é múltiplo — o caso Manaus", () => {
    // Matrícula rural da REDE = 20%; população rural em 4% → 5× a fatia.
    const saida = render({ pctRural: 4 });

    expect(saida).toContain("a rede é mais rural que o município");
    expect(saida).toContain("5,0 vezes</b> a fatia da população rural");
    expect(saida).not.toContain("acompanha a população rural");
  });

  it("não transforma fatia minúscula em achado só porque a razão é alta", () => {
    // 20% contra 15% é 1,33× — abaixo do limiar de razão, e a diferença de 5
    // pontos sozinha não basta.
    const saida = render({ pctRural: 15 });

    expect(saida).toContain("acompanha a população rural");
  });

  it("avisa que os denominadores das duas fatias são diferentes", () => {
    expect(render()).toContain("Os denominadores diferem de propósito");
  });

  it("omite o cruzamento quando o Censo 2022 não respondeu", () => {
    const saida = render({ pctRural: null });

    expect(saida).toContain("o cruzamento não se sustenta e não é feito aqui");
    // A parte local continua saindo mesmo sem a fonte viva.
    expect(saida).toContain("envergadura da rede");
  });

  it("degrada a densidade sem a área do IBGE, mantendo o resto da página", () => {
    const saida = render({ area: null });

    expect(saida).toContain("escolas por 100 km²");
    expect(saida).toContain("envergadura da rede");
  });

  it("mostra a página de indisponibilidade quando não há rede no Censo", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).toContain("Dispersão da rede indisponível");
  });
});

describe("quem dirige a educação no Raio-X", () => {
  const META = {
    ano: 2021,
    status: "estrutural" as const,
    fonte: "IBGE — MUNIC 2021 (SIDRA 7296)",
    url: null,
  };
  const ind = <T,>(valor: T | null) => ({ valor, ...META });
  const boolNd = () => ind<boolean>(null);

  function render(opcoes: {
    instrucao?: string | null;
    formacao?: string | null;
    estrutura?: string | null;
    semBloco?: boolean;
  } = {}) {
    const {
      instrucao = "Especialização",
      formacao = "Pedagogia",
      estrutura = "Secretaria municipal exclusiva",
      semBloco = false,
    } = opcoes;

    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {},
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
        profile: semBloco
          ? ({ governancaEducacional: null } as never)
          : ({
              governancaEducacional: {
                conselhos: {
                  educacao: boolNd(),
                  alimentacaoEscolar: boolNd(),
                  transporteEscolar: boolNd(),
                  acompanhamentoFundeb: boolNd(),
                },
                planoMunicipalEducacao: boolNd(),
                forumPermanenteEducacao: boolNd(),
                planoCarreiraMagisterio: boolNd(),
                pisoSalarialPrevisto: boolNd(),
                limiteHoraAtividade: boolNd(),
                estruturaOrgaoGestor: ind(estrutura),
                titularNivelInstrucao: ind(instrucao),
                titularAreaFormacao: ind(formacao),
              },
            } as never),
      }),
    );
  }

  it("lê formação em Pedagogia como interlocução técnica direta", () => {
    const saida = render({ formacao: "Pedagogia" });

    expect(saida).toContain("Quem dirige a educação");
    expect(saida).toContain("A secretaria é dirigida por alguém formado em Pedagogia");
    expect(saida).toContain("pode ir direto ao ponto");
  });

  it("reconhece licenciatura como quem veio da sala de aula", () => {
    const saida = render({ formacao: "História" });

    expect(saida).toContain("licenciatura");
    expect(saida).toContain("chegou à gestão pela sala de aula");
  });

  it("trata formação fora da área sem transformar em demérito", () => {
    const saida = render({ formacao: "Direito" });

    expect(saida).toContain("fora da área de educação");
    expect(saida).toContain("Não é demérito");
    expect(saida).toContain("equipe técnica da secretaria");
  });

  /**
   * Regressão do caso Manaus. "Outra" é a categoria residual da MUNIC — quer
   * dizer "fora das dez áreas listadas". A primeira versão imprimia
   * "A secretaria é dirigida por alguém formado em Outra", lendo o rótulo do
   * balde como se fosse o nome de um curso.
   */
  it("não trata a categoria residual 'Outra' como nome de curso", () => {
    const saida = render({ formacao: "Outra" });

    expect(saida).not.toContain("formado em Outra");
    expect(saida).toContain("está fora da lista da MUNIC");
    expect(saida).toContain("Qual é, a pesquisa não diz");
    // Sem saber a área, não dá para afirmar que está fora da educação.
    expect(saida).not.toContain("fora da área de educação");
    expect(saida).toContain("qual a formação e a trajetória");
  });

  it("alerta que setor subordinado tem um passo a mais de aprovação", () => {
    const saida = render({ estrutura: "Setor subordinado a outra secretaria" });

    expect(saida).toContain("setor subordinado");
    expect(saida).toContain("passam por outra autoridade");
  });

  it("descreve secretaria exclusiva como o arranjo de menor atrito", () => {
    expect(render({ estrutura: "Secretaria municipal exclusiva" })).toContain(
      "menos atrito para executar",
    );
  });

  /**
   * Rotatividade e consórcio não existem em base pública — conferido no
   * catálogo do SIDRA e na planilha da MUNIC 2021. A página tem de perguntar,
   * nunca afirmar.
   */
  it("transforma rotatividade e consórcio em pergunta de campo", () => {
    const saida = render();

    expect(saida).toContain("quantos secretários de educação o município teve");
    expect(saida).toContain("participa de consórcio intermunicipal");
    expect(saida).toContain("o único agregado de consórcio é de saneamento");
  });

  it("avisa que eleição troca secretário e o dado é estrutural", () => {
    expect(render()).toContain("Eleição municipal troca secretário");
  });

  it("degrada sem inventar quando a MUNIC não trouxe a formação", () => {
    const saida = render({ formacao: null, instrucao: null, estrutura: null });

    expect(saida).toContain("não registrou a área de formação");
    expect(saida).toContain("O comando da educação no organograma");
    // Continua perguntando o que a fonte nunca responde.
    expect(saida).toContain("quantos secretários de educação o município teve");
  });

  it("mostra página de indisponibilidade sem o módulo de educação", () => {
    expect(render({ semBloco: true })).toContain("Perfil do órgão gestor indisponível");
  });
});

describe("declaração étnica no Raio-X — os três elos", () => {
  function escolaRacas(
    codigo: string,
    matriculas: number,
    indigena: number,
    naoDeclarada = 0,
  ): EscolaTerritorio {
    // [ND, branca, preta, parda, amarela, indígena]
    const branca = matriculas - indigena - naoDeclarada;
    return {
      codigo,
      rural: false,
      dif: 0,
      lat: null,
      lng: null,
      matriculas,
      transporte: null,
      racas: [naoDeclarada, branca, 0, 0, 0, indigena],
    };
  }

  function render(opcoes: {
    /** População indígena 0–14 do Censo 2022. */
    idadeEscolar?: number;
    /** Matrículas declaradas com cor/raça indígena no Censo Escolar. */
    declarados?: number | null;
    /** Matrículas no segmento indígena do FUNDEB. */
    noSegmento?: number;
    naoDeclarada?: number;
    semEquidade?: boolean;
  } = {}) {
    const {
      idadeEscolar = 15_600,
      declarados = 900,
      noSegmento = 142,
      naoDeclarada = 0,
      semEquidade = false,
    } = opcoes;

    const rede =
      declarados === null
        ? []
        : [escolaRacas("1", 10_000, declarados, naoDeclarada)];

    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            escolasTerritorio:
              rede.length > 0
                ? { ano: 2025, escolas: rede, resumo: resumirTerritorio(rede) }
                : undefined,
            equidadeTerritorial: semEquidade
              ? undefined
              : {
                  quilombola: {
                    populacao: 0,
                    emIdadeEscolar: 0,
                    matriculasNosSegmentos: 0,
                    razaoAtendimento: null,
                    sinalConferencia: false,
                  },
                  indigena: {
                    populacao: Math.round(idadeEscolar * 2.5),
                    emIdadeEscolar: idadeEscolar,
                    matriculasNosSegmentos: noSegmento,
                    razaoAtendimento: null,
                    sinalConferencia: true,
                  },
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

  it("localiza o vão entre cor/raça declarada e segmento ponderado", () => {
    // 900 declarados na cor/raça, 142 no segmento → 758 fora.
    const saida = render();

    expect(saida).toContain("Declaração étnica");
    expect(saida).toContain("758 matrículas indígenas declaradas fora do segmento");
    expect(saida).toContain("a ponderação segue a <b>classificação da escola</b>");
  });

  /**
   * O ponto contraintuitivo que o usuário precisa levar para a reunião: o
   * campo de cor/raça do aluno não move o repasse; a classificação da escola
   * move. A página tem de dizer isso com todas as letras.
   */
  it("explica que declarar cor/raça do aluno não aumenta repasse sozinho", () => {
    const saida = render();

    expect(saida).toContain("declarar corretamente a cor/raça do aluno não aumenta o repasse por si só");
    expect(saida).toContain("escola indígena na coleta");
  });

  it("nunca atribui pertencimento étnico nem estima quem deveria se declarar", () => {
    const saida = render();

    expect(saida).toContain("Autodeclaração, sempre");
    expect(saida).toContain("pertencimento étnico não se atribui de fora");
    expect(saida).not.toMatch(/dever(iam|ia) se declarar indígenas?[^"]/);
  });

  it("trata população minúscula como ruído censitário, sem achado", () => {
    const saida = render({ idadeEscolar: 12, declarados: 3, noSegmento: 0 });

    expect(saida).toContain("pequena demais");
    expect(saida).toContain("Nada a apurar aqui");
  });

  it("separa as duas causas quando o registro mal alcança a população", () => {
    // 900 declarados para 15.600 em idade escolar, e o segmento acompanha.
    const saida = render({ declarados: 900, noSegmento: 880 });

    expect(saida).toContain("só a lista por escola separa");
    expect(saida).toContain("quantas dessas crianças estão na rede estadual");
  });

  it("ressalva o cadastro quando a cor/raça em branco é grande", () => {
    const saida = render({ declarados: 900, naoDeclarada: 3000 });

    expect(saida).toContain("Ressalva de cadastro");
    expect(saida).toContain("é piso, não retrato");
  });

  it("deixa o elo do meio em branco sem o Censo Escolar, sem quebrar", () => {
    const saida = render({ declarados: null });

    expect(saida).toContain("o elo do meio da corrente fica em branco");
    // O par população × segmento continua impresso.
    expect(saida).toContain("matrículas no segmento ponderado");
  });

  it("mostra indisponibilidade sem o Censo 2022", () => {
    expect(render({ semEquidade: true })).toContain(
      "Cruzamento de declaração étnica indisponível",
    );
  });
});

describe("estado nutricional no Raio-X", () => {
  function render(nut: Record<string, unknown> | null = {
    ano: 2024,
    municipio: { total: 688, magrezaPct: 7, eutrofiaPct: 67.7, excessoPesoPct: 25.3, sobrepeso: 91, obesidade: 53, obesidadeGrave: 30 },
    estado: { excessoPesoPct: 29.3 },
    brasil: { excessoPesoPct: 29.8 },
  }, matriculas?: number) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            ...(nut ? { estadoNutricional: nut } : {}),
            ...(matriculas
              ? { historico: { anos: [{ ano: 2026, anoBaseCenso: 2025, totalMatriculasMunicipais: matriculas }] } }
              : {}),
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-30T12:00:00.000Z"),
      }),
    );
  }

  it("soma as três faixas do excesso, que a fonte separa", () => {
    const saida = render();

    expect(saida).toContain("Estado nutricional");
    expect(saida).toContain("25,3% das crianças acompanhadas estão acima do peso");
    expect(saida).toContain("Obesidade grave");
    // 91 + 53 + 30
    expect(saida).toContain("174");
  });

  it("compara com estado e Brasil usando a régua que a fonte devolve", () => {
    const saida = render();

    expect(saida).toContain("abaixo do estado");
    expect(saida).toContain("29,8%");
  });

  it("aponta quando o município está acima do próprio estado", () => {
    const saida = render({
      ano: 2024,
      municipio: { total: 99190, magrezaPct: 3.9, eutrofiaPct: 70.1, excessoPesoPct: 26, sobrepeso: 1, obesidade: 1, obesidadeGrave: 1 },
      estado: { excessoPesoPct: 22.3 },
      brasil: { excessoPesoPct: 29.8 },
    });

    expect(saida).toContain("acima do estado");
    expect(saida).toContain("composição do cardápio");
  });

  /**
   * A honestidade que sustenta a página: o denominador do SISVAN é quem passou
   * pela atenção primária, não a rede escolar. Sem isso, o número viraria um
   * retrato que ele não é.
   */
  it("declara a cobertura e não confunde amostra com retrato", () => {
    const saida = render(undefined, 2000);

    expect(saida).toContain("crianças acompanhadas pela atenção primária");
    // 688 de 2.000 matrículas = 34,4%
    expect(saida).toContain("34,4%");
  });

  it("avisa quando a cobertura é baixa demais para representar a rede", () => {
    const saida = render(undefined, 5000);

    // 688 de 5.000 = 13,8%
    expect(saida).toContain("leia como amostra, não como retrato");
  });

  it("cruza as duas carências quando elas convivem", () => {
    const saida = render({
      ano: 2024,
      municipio: { total: 500, magrezaPct: 8.2, eutrofiaPct: 60, excessoPesoPct: 31.8, sobrepeso: 100, obesidade: 40, obesidadeGrave: 19 },
      estado: { excessoPesoPct: 29 },
      brasil: { excessoPesoPct: 29.8 },
    });

    expect(saida).toContain("as duas carências convivendo");
  });

  it("degrada explicando que ausência não é ausência do problema", () => {
    const saida = render(null);

    expect(saida).toContain("Estado nutricional indisponível");
    expect(saida).toContain("cobertura baixa da atenção primária, não ausência do problema");
  });
});

/**
 * A fusão de "Rede de ensino" com "Aprendizagem". As duas folhas da geração
 * antiga entregavam, juntas, pouco mais de uma página de conteúdo: tabela que
 * repetia as próprias métricas, cards de conselho genérico e um bloco de
 * equidade que a declaração étnica e o mapa das escolas passaram a cobrir com
 * dado melhor. Os testes abaixo guardam o que ficou — e o que não pode voltar.
 */
describe("porte da rede e resultado agregado no Raio-X", () => {
  function render(ideb: Record<string, unknown> = {}) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            historico: {
              anos: [
                { anoBaseCenso: 2025, totalMatriculasMunicipais: 4200, totalEscolas: 31, tempoIntegral: 610, educacaoEspecial: 190, eja: 140 },
              ],
            },
          },
          relatorio_fundeb: {
            idebAnosIniciais: [{ ano: 2023, idebVerificado: 4.1, metaProjetada: 5.3, ...ideb }],
            idebAnosFinais: [{ ano: 2023, idebVerificado: 3.8, metaProjetada: 4.6, ...ideb }],
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );
  }

  it("chama as duas etapas quando as duas estão abaixo da régua", () => {
    expect(render()).toContain("As duas etapas estão abaixo da régua");
  });

  it("liga o tempo integral e a educação especial à ponderação, não só ao atendimento", () => {
    const saida = render();

    expect(saida).toContain("em tempo integral");
    expect(saida).toContain("fator de ponderação");
  });

  /**
   * A série existia no payload e não aparecia em lugar nenhum do dossiê: o
   * mapeador guardava só a última edição. Trajetória distingue rede que subiu
   * de rede que caiu para o mesmo lugar — e é o que a Cond. I do VAAR mede.
   */
  it("imprime a trajetória do IDEB e a variação entre a primeira e a última edição", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_fundeb: {
            idebAnosIniciais: [
              { ano: 2019, idebVerificado: 5.9 },
              { ano: 2021, idebVerificado: 5.5 },
              { ano: 2023, idebVerificado: 6.2, metaProjetada: 6.0, metaOrigem: "nacional" },
            ],
            idebAnosFinais: [
              { ano: 2021, idebVerificado: 4.8 },
              { ano: 2023, idebVerificado: 5.2, metaProjetada: 5.5, metaOrigem: "nacional" },
            ],
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).toContain("A trajetória, edição a edição");
    // Queda de 2019 para 2021 que o número isolado de 2023 esconde.
    expect(saida).toContain("5,5");
    expect(saida).toContain("<b>Anos iniciais:</b> +0,3 de 2019 a 2023.");
    // A etapa sem edição em 2019 vira travessão, não some a coluna.
    expect(saida).toContain("Condicionalidade I do VAAR</b> mede evolução, não nível");
  });

  it("omite a trajetória quando só existe uma edição — uma foto não é série", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_fundeb: { idebAnosIniciais: [{ ano: 2023, idebVerificado: 6.2 }] },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).not.toContain("A trajetória, edição a edição");
  });

  it("avisa que o IDEB sobe com aprovação sem aprendizagem", () => {
    expect(render()).toContain("rede que aprova todo mundo sobe o índice sem aprender mais");
  });

  /**
   * O motivo da fusão. Se algum destes textos voltar, voltou junto a folha
   * pela metade — eram conselho genérico, sem um número do município dentro.
   */
  it("não traz de volta os cards de conselho genérico das folhas antigas", () => {
    const saida = render();

    expect(saida).not.toContain("Perguntas para auditoria");
    expect(saida).not.toContain("Agenda de resultado");
    expect(saida).not.toContain("Controles essenciais");
    expect(saida).not.toContain("Espaço fiscal precisa ser protegido");
  });
});

describe("pontualidade fiscal sobrevive à falta do CAUC", () => {
  /**
   * O bloco mudou de página (saiu das complementações, que estouravam a folha
   * em todo município de porte médio para cima) e passou a morar na dos
   * requisitos fiscais. Mas ele vem do extrato de entregas do Tesouro, não do
   * CAUC — então não pode sumir quando o extrato do CAUC não responde.
   */
  it("imprime o risco VAAT mesmo sem extrato do CAUC na emissão", () => {
    const saida = generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: {
            pontualidadeFiscal: {
              risco: "alto",
              dca: [{ exercicio: 2025, entregueEm: "2026-09-10T12:00:00Z", diasAlemDoPrazo: 133, estourouCorteVaat: true }],
              rreoEntregues: 3,
              rgfEntregues: 1,
            },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-29T12:00:00.000Z"),
      }),
    );

    expect(saida).toContain("Extrato do CAUC indisponível nesta emissão");
    expect(saida).toContain("Risco de perder o VAAT — lado Siconfi: ALTO");
  });
});

/**
 * O resumo executivo e o plano de ação — as duas pontas do dossiê, e as duas
 * que o gestor lê. Antes a primeira terminava numa frase idêntica para os
 * 5.570 municípios e a segunda enxergava quatro sinais. Agora as duas saem do
 * mesmo levantamento de achados, na mesma ordem.
 */
describe("resumo executivo e plano de ação saem dos achados", () => {
  const COM_ACHADOS = {
    relatorio_dirigido_base: {
      vaar: {
        exercicio: 2025,
        habilitado: false,
        beneficiario: false,
        complementacao: 0,
        reprovadas: ["III"],
        condIVEstadual: false,
        referencia: { medianaUf: 2_303_028, ufBeneficiadas: 40, ufAvaliadas: 62 },
        pendencia: null,
      },
      obrasFnde: { totalObras: 3, paralisadas: 2, inacabadas: 0, emRetomada: 1, valorParadoEstimado: 4_900_000, obrasCriticas: [] },
    },
  };

  function render(currentPayload: Record<string, unknown>) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload,
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-30T12:00:00.000Z"),
      }),
    );
  }

  it("põe o achado mais urgente na manchete da página 2", () => {
    const saida = render(COM_ACHADOS);

    expect(saida).toContain("O que este município está perdendo");
    expect(saida).toContain("2 obras paradas com recurso federal já empenhado");
    // A seção que prova, nomeada como aparece no cabeçalho da página.
    expect(saida).toContain("Obras FNDE");
  });

  /**
   * Essa frase era o fecho do resumo, igual para todo município do país. Se
   * ela voltar, o dossiê voltou a pedir que o gestor leia 42 páginas para
   * descobrir o que está em jogo.
   */
  it("não traz de volta o diagnóstico genérico", () => {
    const saida = render(COM_ACHADOS);

    expect(saida).not.toContain("ligar orçamento, execução e resultado em uma mesma rotina");
    expect(saida).not.toContain("Diagnóstico em uma frase");
  });

  it("o plano de ação responde aos mesmos achados, na mesma ordem", () => {
    const saida = render(COM_ACHADOS);

    expect(saida).toContain("Aderir ao edital de retomada do Pacto");
    expect(saida).toContain("janela do edital vigente");
    expect(saida).toContain("movimentos que convertem recurso em entrega");
  });

  /**
   * Município sem perda nomeável não recebe folha em branco nem elogio: recebe
   * o enquadramento honesto de que o achado, se existir, está em documento que
   * não é público — que é o que o Ofício vai buscar.
   */
  it("quando não há achado, diz o que isso significa e o que não significa", () => {
    const saida = render({});

    expect(saida).toContain("Nenhuma perda nomeável nas bases consultadas");
    expect(saida).toContain("não é atestado de gestão");
    // E o plano cai nos itens de preenchimento, em vez de ficar vazio.
    expect(saida).toContain("Montar a sala de situação municipal");
  });
});

/**
 * Precatório do FUNDEF (roadmap #27).
 *
 * A página tem quatro estados e três deles são fáceis de errar: fonte muda,
 * dinheiro anterior à EC, e ausência de registro. O único caso trivial é o do
 * município que recebeu sob a Emenda.
 */
describe("página do precatório do FUNDEF", () => {
  const SOB_EC = {
    codigoIBGE: "2510105",
    janela: [2020, 2021, 2022, 2023, 2024, 2025],
    semDeclaracao: [],
    exercicios: [
      { exercicio: 2022, valor: 938562.78, codigoConta: "1.7.1.9.56.0.0", sobEc114: true },
      { exercicio: 2023, valor: 733121.91, codigoConta: "1.7.1.9.56.0.0", sobEc114: true },
      { exercicio: 2024, valor: 787562.16, codigoConta: "1.7.1.9.56.0.0", sobEc114: true },
    ],
    recebeu: true,
    total: 2459246.85,
    totalSobEc114: 2459246.85,
    totalAnterior: 0,
    minimoAbono: 1475548.11,
    saldoMde: 983698.74,
    primeiroExercicio: 2022,
    ultimoExercicio: 2024,
    observacoes: [],
  };

  /** Rafael Jambeiro/BA: R$ 42 mi, tudo antes da Emenda. */
  const ANTES_DA_EC = {
    ...SOB_EC,
    codigoIBGE: "2925956",
    exercicios: [
      { exercicio: 2020, valor: 40811940.79, codigoConta: "1.7.1.8.13.0.0", sobEc114: false },
      { exercicio: 2021, valor: 1284818.78, codigoConta: "1.7.1.8.13.0.0", sobEc114: false },
    ],
    total: 42096759.57,
    totalSobEc114: 0,
    totalAnterior: 42096759.57,
    minimoAbono: 0,
    saldoMde: 0,
    primeiroExercicio: 2020,
    ultimoExercicio: 2021,
    observacoes: ["R$ 42.096.759,57 entraram antes de 2022, quando a subvinculação de 60% em abono ainda não existia."],
  };

  const SEM_RECEITA = {
    ...SOB_EC,
    codigoIBGE: "2924009",
    exercicios: [],
    recebeu: false,
    total: 0,
    totalSobEc114: 0,
    totalAnterior: 0,
    minimoAbono: 0,
    saldoMde: 0,
    primeiroExercicio: null,
    ultimoExercicio: null,
    observacoes: [],
  };

  function render(precatorio: Record<string, unknown> | null) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          relatorio_dirigido_base: precatorio ? { precatorioFundef: precatorio } : {},
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-30T12:00:00.000Z"),
      }),
    );
  }

  /** Recorta só a folha do precatório: outras páginas podem imprimir zero. */
  function folha(precatorio: Record<string, unknown> | null) {
    const saida = render(precatorio);
    const inicio = saida.indexOf('<span>Precatório do FUNDEF</span>');
    expect(inicio).toBeGreaterThan(0);
    return saida.slice(inicio, saida.indexOf("</section>", inicio));
  }

  it("imprime o mínimo de abono sobre o que entrou sob a Emenda", () => {
    const saida = render(SOB_EC);

    expect(saida).toContain("Precatório do FUNDEF");
    expect(saida).toContain("mínimo em abono ao magistério (60%)");
    expect(saida).toContain("1.475.548");
    expect(saida).toContain("1.7.1.9.56.0.0");
  });

  /**
   * O erro que este bloco existe para impedir. Município que recebeu R$ 42
   * milhões antes de 2022 tem mínimo de abono igual a zero — e "R$ 0,00" numa
   * métrica de obrigação legal lê-se como "não deve nada", que é uma
   * afirmação que a fonte não sustenta.
   */
  it("não estampa R$ 0,00 como obrigação de quem recebeu antes da Emenda", () => {
    const saida = render(ANTES_DA_EC);

    expect(saida).toContain("Todo o valor entrou antes de 2022");
    expect(saida).toContain("promulgada em 16/12/2021");
    expect(saida).not.toContain("mínimo em abono ao magistério (60%)");
    // Nenhum "R$ 0" na folha — nem como métrica, nem no meio de uma frase.
    expect(folha(ANTES_DA_EC)).not.toMatch(/R\$\u00a00(?!\d)/);
  });

  it("diz que ausência de receita declarada não é ausência de direito", () => {
    const saida = render(SEM_RECEITA);

    expect(saida).toContain("Nenhuma receita de precatório do FUNDEF foi declarada");
    expect(saida).toContain("não significa ausência de direito");
    expect(saida).toContain("existe ação de complementação do FUNDEF ajuizada");
  });

  it("separa fonte que não respondeu de município que não recebeu", () => {
    const saida = render(null);

    expect(saida).toContain("O SICONFI não respondeu");
    expect(saida).not.toContain("Nenhuma receita de precatório do FUNDEF foi declarada");
  });

  /** A base legal é o produto da página: sem ela, é uma tabela de valores. */
  it("cita a regra em todos os estados, inclusive quando não há dado", () => {
    for (const estado of [SOB_EC, ANTES_DA_EC, SEM_RECEITA, null]) {
      const saida = render(estado);
      expect(saida).toContain("EC nº 114/2021, art. 5º");
      expect(saida).toContain("na forma de abono");
      expect(saida).toContain("suspende transferências voluntárias");
    }
  });

  /** Nem a DCA nem o SIOPE registram o pagamento — a página tem de admitir. */
  it("admite que o pagamento do abono não é público", () => {
    const saida = render(SOB_EC);

    expect(saida).toContain("nenhuma base pública registra");
    expect(saida).toContain("A comprovação está no município");
  });
});

/**
 * Bloco da FUNAI na página "Declaração étnica" (roadmap #35).
 *
 * O quarto elo da corrente, e o único que não é autodeclaração: a FUNAI
 * cadastra onde há aldeia. Só aparece onde há aldeia registrada.
 */
describe("aldeias da FUNAI na declaração étnica", () => {
  function render(codigoIbge: string, comCenso = true) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          dados_basicos: { codigo_ibge: codigoIbge, nome: "X", uf: "BA" },
          ...(comCenso
            ? {
                relatorio_dirigido_base: {
                  equidadeTerritorial: {
                    quilombola: { populacao: 0, emIdadeEscolar: 0, matriculasNosSegmentos: 0 },
                    indigena: { populacao: 812, emIdadeEscolar: 240, matriculasNosSegmentos: 0 },
                    fatorFaixa: { minimo: 1.4, maximo: 2.17 },
                  },
                },
              }
            : {}),
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-30T12:00:00.000Z"),
      }),
    );
  }

  it("não aparece em município sem aldeia registrada", () => {
    const saida = render("2703007"); // Ibateguara/AL
    expect(saida).not.toContain("O que a FUNAI cadastra");
  });

  /**
   * Paulo Afonso: 3 aldeias no cadastro da FUNAI, nenhuma escola municipal
   * declarada em terra indígena no Censo — e escola municipal a 1,3 km da
   * primeira. É a conferência que vale dinheiro, porque o segmento indígena
   * pondera de 1,40 a 2,17.
   */
  it("nomeia o vão entre cadastro e declaração, sem chamar de irregularidade", () => {
    const saida = render("2924009");

    expect(saida).toContain("O que a FUNAI cadastra");
    expect(saida).toContain("registra 3 aldeias aqui");
    expect(saida).toContain("não declara nenhuma escola municipal em terra indígena");
    expect(saida).toContain("Não é irregularidade");
    expect(saida).toContain("KARIRI");
  });

  it("lê diferente onde o Censo já declara escola indígena", () => {
    const saida = render("1302603"); // Manaus

    expect(saida).toContain("O que a FUNAI cadastra");
    expect(saida).not.toContain("não declara nenhuma escola municipal em terra indígena");
    expect(saida).toContain("num raio de 10 km");
  });

  /** Cadastro da FUNAI não depende do Censo Demográfico e não cai com ele. */
  it("sobrevive à ausência do cruzamento do IBGE", () => {
    const saida = render("2924009", false);

    expect(saida).toContain("Cruzamento de declaração étnica indisponível");
    expect(saida).toContain("O que a FUNAI cadastra");
  });

  it("declara a cauda em vez de truncar em silêncio", () => {
    const saida = render("1303809"); // São Gabriel da Cachoeira: 141 aldeias
    expect(saida).toMatch(/e mais \d+ no cadastro/);
  });
});

/**
 * Cobertura vacinal (#37) e violência notificada (#9) na folha de contexto de
 * segurança. Os dois são indicadores de saúde num relatório de FUNDEB, e cada
 * um tem uma trava de leitura que os testes abaixo protegem.
 */
describe("saúde da criança em idade escolar no Raio-X", () => {
  function render(codigoIbge: string) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: {
          dados_basicos: { codigo_ibge: codigoIbge, nome: "X", uf: "BA" },
          relatorio_dirigido_base: {
            violencia: { serie: [{ ano: 2023, taxa: 30, obitos: 40 }], ultimo: { ano: 2023, taxa: 30, obitos: 40 } },
          },
        },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-30T12:00:00.000Z"),
      }),
    );
  }

  it("liga a cobertura vacinal ao Programa Saúde na Escola", () => {
    const saida = render("2703007"); // Ibateguara: 6 de 6 abaixo da mediana

    expect(saida).toContain("Atenção primária (2022)");
    expect(saida).toContain("6 das 6 coberturas vacinais");
    expect(saida).toContain("Programa Saúde na Escola");
    expect(saida).toContain("régua = mediana nacional");
  });

  /** Cobertura acima de 100% não pode virar elogio na folha. */
  it("nega excelência a cobertura acima de 100%", () => {
    const saida = render("2930758"); // Serra do Ramalho: as seis acima de 100

    expect(saida).toContain("passam de 100%");
    expect(saida).toContain("não é excelência");
    expect(saida).not.toContain("coberturas vacinais</b> estão abaixo da mediana nacional");
  });

  /**
   * A trava que mais importa. Zero notificação é ausência de registro, não
   * ausência de violência — e o texto tem de dizer isso antes de qualquer
   * outra coisa.
   */
  it("lê silêncio de notificação como ausência de registro", () => {
    const saida = render("2703007");

    expect(saida).toContain("Nenhuma notificação de violência contra criança");
    expect(saida).toContain("quase nunca significa ausência de violência");
    expect(saida).toContain("significa ausência de registro");
    expect(saida).toContain("notificante obrigatória");
  });

  it("nega que notificar mais signifique mais violência", () => {
    const saida = render("3550308"); // São Paulo: milhares de notificações

    expect(saida).toContain("Notificação, não ocorrência");
    expect(saida).toContain("Número maior não significa mais violência");
    expect(saida).not.toContain("Nenhuma notificação de violência contra criança");
  });

  /** Indicador sensível nunca vira ranking nem rótulo. */
  it("não transforma nenhum dos dois em comparação entre municípios", () => {
    for (const codigo of ["2703007", "3550308", "2924009"]) {
      const saida = render(codigo);
      expect(saida).not.toMatch(/pior município|ranking|o mais violento|posição no ranking/i);
      expect(saida).toContain("nunca rótulo do município");
    }
  });
});

/**
 * Trabalho na idade escolar (#15). A página imprime estimativa preliminar da
 * amostra do Censo 2022 sobre criança ocupada — o dado mais fácil de usar
 * errado do dossiê inteiro. Os testes travam as quatro portas: somar as
 * faixas, chamar ocupação de 14 a 17 de ilegalidade, deixar estimativa mínima
 * decidir comparação, e omitir a ressalva da fonte.
 */
describe("trabalho na idade escolar no Raio-X", () => {
  function render(codigoIbge: string) {
    return generateMunicipalXrayHtml(
      mapMunicipalXrayModel({
        basePayload: {},
        currentPayload: { dados_basicos: { codigo_ibge: codigoIbge, nome: "X", uf: "BA" } },
        baseYear: 2024,
        currentYear: 2026,
        generatedAt: new Date("2026-07-31T12:00:00.000Z"),
      }),
    );
  }

  it("separa as duas faixas e nunca imprime um total somado", () => {
    const saida = render("2924009"); // Paulo Afonso/BA: 29 e 455

    expect(saida).toContain("Trabalho na idade escolar");
    expect(saida).toContain("ocupadas de 10 a 13 anos");
    expect(saida).toContain("ocupados de 14 a 17 anos");
    // 29 + 455 = 484: o total somado não pode aparecer em lugar nenhum.
    expect(saida).not.toContain("484");
    expect(saida).not.toMatch(/total de trabalho infantil|crianças em trabalho infantil/i);
  });

  it("imprime a moldura legal que separa as faixas", () => {
    const saida = render("2924009");

    expect(saida).toContain("não há hipótese legal de trabalho");
    expect(saida).toContain("art. 7º, XXXIII");
    expect(saida).toContain("Decreto nº 6.481/2008");
    // A trava que impede a página de acusar: ocupação de 14 a 17 é lícita.
    expect(saida).toContain("Ocupação nesta faixa não é, por si, irregularidade");
  });

  it("carrega a ressalva de amostra preliminar e o piso, não teto", () => {
    const saida = render("1302603"); // Manaus/AM

    expect(saida).toContain("Resultados preliminares da amostra");
    expect(saida).toContain("áreas de ponderação preliminares");
    expect(saida).toContain("piso, não teto");
    expect(saida).toContain("consumo do próprio domicílio");
  });

  it("recusa a comparação quando a estimativa é pequena demais", () => {
    // Ibateguara/AL: 21 crianças de 10 a 13 — taxa acima da nacional, mas a
    // estimativa não sustenta a leitura, e a página diz isso.
    const saida = render("2703007");

    expect(saida).toContain("não decide nada");
    expect(saida).toContain("sustenta é a pergunta");
    expect(saida).not.toMatch(/Está <b>(acima|abaixo)/);
  });

  it("lê as duas réguas, que discordam com frequência", () => {
    // Manaus/AM: 1,40% na faixa de 10 a 13 — acima do país (1,20%) e abaixo do
    // próprio estado (2,02%). Ler só uma régua imprimiria "acima" ao lado de um
    // número estadual maior.
    const saida = render("1302603");
    expect(saida).toContain("Está <b>acima da nacional</b> e abaixo da estadual");
    expect(saida).toContain("até os 14 não existe trabalho lícito");
  });

  it("não ordena municípios nem atribui rótulo", () => {
    for (const codigo of ["2703007", "1302603", "3550308", "2924009"]) {
      const saida = render(codigo);
      expect(saida).not.toMatch(/ranking|pior município|campeão|líder em trabalho/i);
      expect(saida).toContain("nunca rótulo do município");
    }
  });

  it("degrada com honestidade quando o município não está no dataset", () => {
    const saida = render("9999999");
    expect(saida).toContain("Ocupação na idade escolar indisponível");
  });
});
