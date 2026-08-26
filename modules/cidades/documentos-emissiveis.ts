import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  CalculatorOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HistoryOutlined,
  ReadOutlined,
  SendOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from "@ant-design/icons";

import type { CityReportType } from "@/modules/cidades/reports-types";

/**
 * O catálogo de documentos que o módulo emite, nesta ordem de uso.
 *
 * Vive num módulo próprio, e não dentro da página, por dois motivos. O
 * primeiro é que ele é dado, não interface. O segundo é que assim ele pode ser
 * testado: cada entrada aponta para uma rota de API e para um tipo de
 * relatório arquivável, e um `endpoint` com erro de digitação só apareceria
 * quando alguém clicasse no card em produção.
 *
 * ## As três famílias
 *
 * - **Raio-X** é a cidade inteira, o passo que antecede a conversa de fundo.
 * - **Diagnóstico e Histórico do Censo** aprofundam no FUNDEB.
 * - **Dever de Casa** é o único que julga: nota interna de 0 a 10, item a
 *   item, para o consultor decidir prioridade e argumento. Não vai ao gestor.
 * - **Ofício** é o único endereçado à prefeitura — os outros são análise
 *   interna, e por isso o tom dele é de coleta, nunca de veredito.
 * - **Os oito dossiês** são o produto que justifica o preço da consultoria:
 *   cada um pega um tópico e desce até a última linha que a fonte sustenta.
 *   Neles a contagem de páginas não é contrato — o volume é função do
 *   município, e o card anuncia o tamanho antes de gerar.
 */
/**
 * O que entra na fila quando um município é adicionado à carteira.
 *
 * São os quatro que vão para toda reunião. Os oito dossiês ficam de fora de
 * propósito: cada um consulta as fontes vivas por conta própria, e enfileirar
 * doze por cidade transformaria "adicionei um município" em meia hora de
 * chamadas a APIs de governo — para material que só se usa quando a conversa
 * pede aquele tópico.
 */
export const RELATORIOS_PADRAO = [
  "raio-x",
  "levantamento",
  "historico-censo",
  "oficio-documentos",
] as const;

export const DOCUMENTOS = [
  {
    id: "raio-x" as const,
    reportType: "raio_x" as CityReportType,
    icone: ThunderboltOutlined,
    nome: "Raio-X Municipal",
    paginas: 42,
    variante: "secundario" as const,
    prefixoArquivo: "RaioX_Municipal",
    endpoint: "/api/modulos/levantamento-fundeb/raio-x",
    descricao:
      "A cidade inteira antes da conversa de fundo. Todo número traz fonte e ano.",
    conteudo: [
      "Saneamento (Censo 2022)",
      "Rede de saúde (CNES)",
      "Emprego formal (CAGED)",
      "Vulnerabilidade (CadÚnico)",
      "Capacidade institucional (MUNIC)",
    ],
  },
  {
    id: "levantamento" as const,
    reportType: "diagnostico_fundeb" as CityReportType,
    icone: FileTextOutlined,
    nome: "Diagnóstico FUNDEB",
    paginas: 10,
    variante: "primario" as const,
    prefixoArquivo: "Levantamento_FUNDEB",
    endpoint: "/api/modulos/levantamento-fundeb/pdf?tipo=levantamento",
    descricao:
      "O aprofundamento no fundo: repasses, projeção de ganho e plano de ação.",
    conteudo: [
      "VAAF / VAAT / VAAR",
      "Projeção de ganho",
      "Censo Escolar INEP",
      "Série histórica",
      "Saúde fiscal",
      "Plano de ação",
    ],
  },
  {
    id: "dever-de-casa" as const,
    reportType: "dever_de_casa" as CityReportType,
    icone: CheckSquareOutlined,
    nome: "Dever de Casa",
    // O tamanho depende das fontes que responderem; a medida vem da prévia.
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dever_de_Casa",
    endpoint: "/api/modulos/levantamento-fundeb/dever-de-casa",
    descricao:
      "O veredito interno: cada obrigação que o município controla, com parâmetro legal, dado apurado e nota de 0 a 10. Não vai à mesa do gestor.",
    conteudo: [
      "Nota do dever de casa",
      "Prestação de contas, item a item",
      "As cinco condicionalidades do VAAR",
      "Censo × Portaria e creche",
      "Alfabetização e IDEB contra a régua",
      "O que o descumprimento custa",
    ],
  },
  {
    id: "historico-censo" as const,
    reportType: "historico_censo" as CityReportType,
    icone: HistoryOutlined,
    nome: "Histórico do Censo Escolar",
    paginas: 11,
    variante: "secundario" as const,
    prefixoArquivo: "Historico_Censo",
    endpoint: "/api/modulos/levantamento-fundeb/historico-censo",
    descricao:
      "Os últimos três Censos lado a lado — e o que a trajetória significa para a receita.",
    conteudo: [
      "Matrículas por rede e etapa",
      "Creche e pré-escola",
      "Cor/raça em série",
      "Tempo integral (fator)",
      "Docentes e rede física",
      "Infraestrutura em série",
      "Sinais e perguntas de campo",
    ],
  },
  {
    id: "oficio-documentos" as const,
    reportType: "oficio_documentos" as CityReportType,
    icone: SendOutlined,
    nome: "Ofício de solicitação de documentos",
    paginas: 4,
    variante: "secundario" as const,
    prefixoArquivo: "Oficio_Documentos",
    endpoint: "/api/modulos/levantamento-fundeb/oficio-documentos",
    descricao:
      "O único documento endereçado à prefeitura: pede os cinco documentos da rede e traz o questionário do que as bases não alcançam.",
    conteudo: [
      "Ofício à Secretaria de Educação",
      "Os cinco documentos, com caixa",
      "Onde cada um costuma estar",
      "Questionário com linha de resposta",
      "Registro público sob cada pergunta",
    ],
  },
  {
    id: "dossie-escolas" as const,
    reportType: "dossie_escolas" as CityReportType,
    icone: ReadOutlined,
    nome: "Dossiê das Escolas",
    // O tamanho é função do município; a medida real vem da prévia da rota.
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Escolas",
    endpoint: "/api/modulos/dossies/escolas",
    descricao:
      "A rede inteira, unidade por unidade: território, matrícula, resultado e contexto de cada escola na mesma linha.",
    conteudo: [
      "Um bloco por escola",
      "IDEB e Saeb por etapa",
      "INSE e complexidade de gestão",
      "Distorção, abandono e docentes",
      "Cor/raça e transporte",
      "Índice remissivo",
    ],
  },
  {
    id: "dossie-conformidade" as const,
    reportType: "dossie_conformidade" as CityReportType,
    icone: AuditOutlined,
    nome: "Dossiê da Conformidade",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Conformidade",
    endpoint: "/api/modulos/dossies/conformidade",
    descricao:
      "Todo requisito do CAUC com a data em que vence, toda vinculação do SIOPE com a folga, e o que cada pendência trava — e o que ela não trava.",
    conteudo: [
      "Agenda por data de vencimento",
      "Requisito a requisito",
      "SIOPE com folga e parâmetro",
      "Pontualidade das DCAs",
      "As cinco condicionalidades",
      "Piso do magistério",
    ],
  },
  {
    id: "dossie-matricula" as const,
    reportType: "dossie_matricula" as CityReportType,
    icone: CalculatorOutlined,
    nome: "Dossiê da Matrícula Ponderada",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Matricula_Ponderada",
    endpoint: "/api/modulos/dossies/matricula",
    descricao:
      "De onde vem cada real do fundo: todos os segmentos com matrícula × fator, cinco cortes do mesmo total e a conciliação com o Censo que o município preencheu.",
    conteudo: [
      "Todos os segmentos, com a conta aberta",
      "Os dois fatores — VAAF e VAAT",
      "Cinco cortes do mesmo total",
      "Conciliação Censo × Portaria",
      "Censo contra Portaria, indicador a indicador",
      "Série da composição e PNAE",
    ],
  },
  {
    id: "dossie-dinheiro" as const,
    reportType: "dossie_dinheiro" as CityReportType,
    icone: BankOutlined,
    nome: "Dossiê do Dinheiro Federal",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Dinheiro_Federal",
    endpoint: "/api/modulos/dossies/dinheiro",
    descricao:
      "O segundo orçamento: obra do FNDE com o que trava cada uma, emenda ano a ano com quanto virou pagamento, convênio a convênio e quem já mandou dinheiro para cá.",
    conteudo: [
      "Obra a obra, com a esfera do termo",
      "O que trava cada retomada",
      "Emenda: empenhado contra pago",
      "Quem já mandou dinheiro para cá",
      "Convênio a convênio, com liberação",
      "Sanções e transferências automáticas",
    ],
  },
  {
    id: "dossie-aprendizagem" as const,
    reportType: "dossie_aprendizagem" as CityReportType,
    icone: TrophyOutlined,
    nome: "Dossiê da Aprendizagem",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Aprendizagem",
    endpoint: "/api/modulos/dossies/aprendizagem",
    descricao:
      "A distribuição que a média esconde: as quatro provas do Saeb com o percentual convertido em crianças, a série do IDEB e a alfabetização contra a meta que o município assinou.",
    conteudo: [
      "Distribuição das quatro provas",
      "Percentual convertido em crianças",
      "Régua contra as redes do país",
      "IDEB, edição a edição",
      "Alfabetização contra a meta assinada",
      "Fluxo escolar e a ponte com o VAAR",
    ],
  },
  {
    id: "dossie-demanda" as const,
    reportType: "dossie_demanda" as CityReportType,
    icone: TeamOutlined,
    nome: "Dossiê da Demanda",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Demanda",
    endpoint: "/api/modulos/dossies/demanda",
    descricao:
      "A rede de 2030 já nasceu: o calendário das coortes do Registro Civil, a cobertura por faixa com os dois denominadores e a conta da creche contra a meta do PNE.",
    conteudo: [
      "Calendário das coortes por ano",
      "Cobertura: rede municipal e todas",
      "A conta da creche e a meta do PNE",
      "Fora da escola × demanda não atendida",
      "Busca ativa pelo Bolsa Família",
      "Maternidade adolescente e rural",
    ],
  },
  {
    id: "dossie-equidade" as const,
    reportType: "dossie_equidade" as CityReportType,
    icone: GlobalOutlined,
    nome: "Dossiê da Equidade e dos Territórios",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Equidade",
    endpoint: "/api/modulos/dossies/equidade",
    descricao:
      "Três contagens da mesma criança — Censo Demográfico, Censo Escolar e Portaria do FUNDEB — e a distância entre elas, que é a Condicionalidade III e o fator de ponderação ao mesmo tempo.",
    conteudo: [
      "Série de cor/raça, ano a ano",
      "Mudança de cadastro sinalizada",
      "A corrente de três elos por povo",
      "Territórios declarados e seus fatores",
      "Cor/raça por zona urbana e rural",
      "A ponte com a Condicionalidade III",
    ],
  },
  {
    id: "dossie-comparativo" as const,
    reportType: "dossie_comparativo" as CityReportType,
    icone: BarChartOutlined,
    nome: "Dossiê Comparativo",
    paginas: 0,
    variante: "secundario" as const,
    prefixoArquivo: "Dossie_Comparativo",
    endpoint: "/api/modulos/dossies/comparativo",
    descricao:
      "Quanto, comparado a quem: cada indicador contra a mediana dos municípios de rede do mesmo tamanho, a mediana da UF e o percentil na coorte.",
    conteudo: [
      "O painel de percentis numa folha",
      "Três réguas por indicador",
      "As maiores distâncias, desenvolvidas",
      "Parâmetro legal onde ele prevalece",
      "A coorte: comparado com quem",
      "Distância traduzida em matrículas",
    ],
  },
];

