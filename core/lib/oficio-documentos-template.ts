/**
 * Ofício de solicitação de documentos + questionário da rede.
 *
 * É o único documento do dossiê **endereçado à prefeitura**. Todos os outros
 * (Raio-X, Diagnóstico, Histórico do Censo) são análise para a equipe técnica;
 * este é pedido formal, e a diferença de destinatário muda o tom de cada
 * frase.
 *
 * ## Por que existe
 *
 * As bases federais descrevem o município pelo lado de fora. Um terço do
 * diagnóstico educacional não tem fonte pública e nunca terá — formação
 * continuada, absenteísmo, quem opera o SIMEC, quantas rotas de transporte
 * existem de fato. Antes essas perguntas viviam como "roteiro de campo" dentro
 * do Raio-X, o que tinha dois problemas: ficavam num relatório que a
 * prefeitura não recebe, e vinham escritas para o consultor ler.
 *
 * Aqui elas viram **questionário com linha de resposta**, na mesma peça que
 * pede os cinco documentos. A prefeitura recebe um documento só, e quem
 * responde vê o que já sabemos ao lado de cada pergunta.
 *
 * ## Regra de tom
 *
 * O contexto de cada pergunta imprime o **registro público** que já temos e
 * para em seguida. Nada de veredito: "a MUNIC 2021 não registra CAE —
 * confirmar a situação atual" e nunca "sem CAE o PNAE fica irregular". O
 * julgamento é trabalho do Raio-X, que é interno; aqui o objetivo é coletar.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Indicador } from "./municipal-profile/types";
import type { MunicipalXrayModel } from "./municipal-xray-template";

// ---------------------------------------------------------------------------
// Formatação — cada template de relatório é autocontido (mesmo padrão de
// `censo-historico-template.ts`), para que mexer num não mexa no outro.
// ---------------------------------------------------------------------------

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function int(value: number | null) {
  return value === null ? "N/D" : integer.format(value);
}

function pct(value: number | null) {
  return value === null ? "N/D" : `${decimal.format(value)}%`;
}

// ---------------------------------------------------------------------------
// Parâmetros do ofício
// ---------------------------------------------------------------------------

export interface ResponsavelOficio {
  nome: string;
  cargo: string;
  whatsapp: string;
  email: string;
}

export interface OficioParams {
  /** "001/2026". Numeração é controle do escritório, não do sistema. */
  numero: string;
  /** Prazo pedido, em dias corridos. */
  prazoDias: number;
  emitidoEm: Date;
  responsavel: ResponsavelOficio;
  /** Ano de referência da base do Censo pedida. */
  anoCenso: number;
}

export const RESPONSAVEL_PADRAO: ResponsavelOficio = {
  nome: "Adriel Pereira Tavares",
  cargo: "Responsável Técnico · TI — Global Company Consultorias",
  whatsapp: "(77) 99700-5880",
  email: "globalconsultorias@icloud.com",
};

/**
 * Logo embutido em base64: o Chromium que gera o PDF roda sem rede e sem
 * servidor de arquivos, então referência a `/global-sync-icon.png` sairia
 * quebrada. Falha de leitura degrada para marca sem ícone.
 */
function logoDataUri(): string | null {
  try {
    const bytes = readFileSync(join(process.cwd(), "public", "global-sync-icon.png"));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Os cinco documentos
// ---------------------------------------------------------------------------

interface DocumentoPedido {
  nome: string;
  resumo: string;
  tambemChamado: string;
  paraQueServe: string;
  ondeEsta: string;
}

function documentos(anoCenso: number): DocumentoPedido[] {
  return [
    {
      nome: `Cópia da Portaria de Matrículas ${anoCenso + 1}`,
      resumo: "Ato que fixa as regras e o cronograma de matrícula da rede no ano corrente.",
      tambemChamado:
        "Portaria de matrícula, resolução de matrícula, edital ou calendário de matrícula da rede.",
      paraQueServe:
        "Mostra como a rede organiza a captação de alunos e permite projetar a variação de matrícula por etapa — a variável que mais pesa no FUNDEB.",
      ondeEsta: "Secretaria de Educação ou Diário Oficial do município.",
    },
    {
      nome: "Cópia da Lei de Sistema / Rede de Ensino",
      resumo:
        "Lei que institui o Sistema Municipal de Ensino ou que vincula a rede ao sistema estadual.",
      tambemChamado:
        "Lei de criação do Sistema Municipal de Ensino, lei do Conselho Municipal de Educação.",
      paraQueServe:
        "Define se o município tem sistema próprio ou está vinculado ao estadual. Isso muda quem normatiza a rede, quem autoriza escolas e o que o município pode contratar.",
      ondeEsta: "Gabinete, Procuradoria, Câmara Municipal ou portal de legislação.",
    },
    {
      nome: "Cópia do Referencial Curricular do Município",
      resumo: "Documento curricular próprio da rede, alinhado à BNCC e ao referencial estadual.",
      tambemChamado:
        "Documento Curricular Municipal, currículo da rede, referencial alinhado à BNCC.",
      paraQueServe:
        "Revela o grau de alinhamento à BNCC e ao referencial estadual, e o que sustenta formação continuada e escolha de material didático.",
      ondeEsta: "Coordenação pedagógica da Secretaria de Educação.",
    },
    {
      nome: "Cópia das Diretrizes de Ensino",
      resumo:
        "Normas pedagógicas da rede: jornada, avaliação, progressão e organização do ano letivo.",
      tambemChamado:
        "Diretrizes pedagógicas, regimento escolar, normas de organização do ano letivo.",
      paraQueServe:
        "Descrevem como a rede trata jornada, avaliação, progressão e formação. É onde aparecem as lacunas normativas que travam projetos.",
      ondeEsta: "Coordenação pedagógica ou Conselho Municipal de Educação.",
    },
    {
      nome: `Cópia da base ou relatório do Censo Escolar ${anoCenso}`,
      resumo: "Extração do Educacenso com matrículas por escola e etapa de ensino.",
      tambemChamado:
        "Educacenso, relatório do Educacenso, planilha de matrículas por escola e etapa, espelho do Censo.",
      paraQueServe:
        "É a base que o FNDE usa para calcular VAAF, VAAT e VAAR. Comparar o espelho do Censo com a rede real é o que revela matrícula não computada — ou seja, receita que o município deixou de receber. Documento mais importante da lista.",
      ondeEsta:
        "Setor de estatística ou Censo da Secretaria de Educação, no sistema Educacenso do INEP.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Questionário
// ---------------------------------------------------------------------------

interface PerguntaCampo {
  pergunta: string;
  /**
   * O registro público que já temos. Aparece ao lado da pergunta para que
   * quem responde saiba de onde partimos — e nunca como veredito sobre a
   * gestão. Ver "Regra de tom" no topo do arquivo.
   */
  contexto?: string;
}

interface SecaoCampo {
  titulo: string;
  itens: PerguntaCampo[];
}

/**
 * As perguntas que sobrevivem ao corte.
 *
 * Critério único: a resposta **muda receita do FUNDEB** ou **trava repasse**.
 * Ficaram de fora as que descrevem a máquina sem mexer no dinheiro — adesão à
 * UNDIME, acompanhamento jurídico, organograma da secretaria, manutenção
 * predial, instrumentos urbanísticos, formação continuada, absenteísmo. Não
 * são irrelevantes; são assunto de outra conversa, e num ofício com prazo de
 * resposta cada pergunta gasta a paciência de quem responde.
 *
 * As seções passaram a se chamar pelo efeito financeiro, não pelo tema
 * administrativo: quem lê entende em que parte da conta ele está mexendo.
 */
export function montarQuestionario(model: MunicipalXrayModel): SecaoCampo[] {
  const g = model.profile?.governancaEducacional;
  const c = model.profile?.conformidadeEducacional;

  /** Registro da MUNIC nas duas pontas; silêncio da fonte não vira afirmação. */
  const registro = (ind: Indicador<boolean> | undefined, sim: string, nao: string) =>
    ind?.valor === true ? sim : ind?.valor === false ? nao : undefined;

  const anoMunic = g?.estruturaOrgaoGestor.ano ?? 2021;

  return [
    {
      titulo: "1 · Matrícula e ponderação — o que multiplica o valor-aluno",
      itens: [
        {
          pergunta:
            "O município aderiu à Busca Ativa Escolar? Quem opera a plataforma e quantos alunos foram reconduzidos no último ano?",
          contexto:
            "Aluno recuperado vira matrícula no Censo, e o Censo define o FUNDEB do exercício seguinte.",
        },
        {
          pergunta:
            "A educação em tempo integral tem projeto aprovado e em execução? Em quais escolas e etapas?",
          contexto:
            model.fullTime !== null
              ? `Censo Escolar: ${int(model.fullTime)} matrículas em tempo integral na rede. A etapa integral tem fator de ponderação maior que a parcial.`
              : "A etapa em tempo integral tem fator de ponderação maior que a parcial.",
        },
        {
          pergunta:
            "As escolas que atendem comunidade indígena ou quilombola estão declaradas como tal na coleta do Censo? Quem confere isso antes do fechamento?",
          contexto: (() => {
            const p = model.peoples?.indigenous;
            const dec = model.schoolMap?.raceTotals?.indigenous ?? null;
            const regra =
              "Os segmentos indígena e quilombola ponderam de 1,40 a 2,17 — os maiores da tabela — e a ponderação segue a classificação da escola, não a cor/raça do aluno.";
            // Município sem nenhuma das duas contagens: imprimir "0 e 0" é
            // ruído num documento que vai para a prefeitura. Fica só a regra.
            if (!p || dec === null || (dec === 0 && p.enrolled === 0)) return regra;
            return `Censo Escolar: ${int(dec)} matrículas com cor/raça indígena declarada. Planilha do FNDE: ${int(p.enrolled)} no segmento indígena. ${regra}`;
          })(),
        },
        {
          pergunta:
            "Existe sala de recursos multifuncionais para atendimento educacional especializado? Quantos alunos têm AEE registrado no Censo?",
          contexto:
            model.specialEducation !== null
              ? `Censo Escolar: ${int(model.specialEducation)} matrículas em educação especial na rede. O AEE registrado gera dupla matrícula na conta do fundo.`
              : "O AEE registrado no Censo gera dupla matrícula na conta do fundo.",
        },
      ],
    },
    {
      titulo: "2 · Remuneração — o piso de 70% do fundo",
      itens: [
        {
          pergunta:
            "Quantos profissionais da educação básica estão em efetivo exercício, e qual a divisão entre efetivos, temporários e comissionados?",
          contexto:
            "Ao menos 70% do FUNDEB tem de ir para remuneração de profissionais da educação básica em efetivo exercício — quem entra nessa conta define se o piso é cumprido.",
        },
        {
          pergunta:
            "O plano de carreira está sendo cumprido? As progressões estão em dia e o piso nacional do magistério é pago?",
          contexto: registro(
            g?.planoCarreiraMagisterio,
            `MUNIC ${anoMunic}: plano de carreira do magistério registrado.`,
            `MUNIC ${anoMunic}: não consta plano de carreira do magistério — confirmar a situação atual.`,
          ),
        },
        {
          pergunta:
            "A lei do 1/3 de hora-atividade é cumprida? Como a jornada fora de sala é registrada na folha?",
          contexto: registro(
            g?.limiteHoraAtividade,
            `MUNIC ${anoMunic}: o plano de carreira prevê expressamente o limite de 2/3 da carga horária em interação com os educandos.`,
            `MUNIC ${anoMunic}: o plano de carreira não traz previsão expressa do limite de 2/3 — confirmar como a jornada é organizada hoje.`,
          ),
        },
      ],
    },
    {
      titulo: "3 · Transporte e alimentação — despesa que o valor-aluno não cobre",
      itens: [
        {
          pergunta:
            "Quantas rotas de transporte escolar existem? Qual a divisão entre frota própria e terceirizada?",
          contexto: registro(
            g?.conselhos.transporteEscolar,
            `MUNIC ${anoMunic}: Conselho de Transporte Escolar registrado.`,
            `MUNIC ${anoMunic}: não consta Conselho de Transporte Escolar — confirmar a situação atual.`,
          ),
        },
        {
          pergunta:
            "Quantas rotas levam aluno do campo para escola da sede, e qual o custo anual delas?",
          contexto: (() => {
            const rurais = model.schoolMap?.ruralCount ?? 0;
            return rurais > 0
              ? `Censo Escolar: ${int(rurais)} escolas da rede em zona rural. O fator do campo é achatado — paga igual para a escola perto e para a distante.`
              : "O fator de ponderação do campo é achatado: paga igual para a escola perto e para a distante da sede.";
          })(),
        },
        {
          pergunta:
            "O cardápio é aprovado por nutricionista e qual o percentual de compra da agricultura familiar?",
          contexto: registro(
            g?.conselhos.alimentacaoEscolar,
            `MUNIC ${anoMunic}: Conselho de Alimentação Escolar registrado. O mínimo legal de compra da agricultura familiar é 30% do PNAE.`,
            `MUNIC ${anoMunic}: não consta Conselho de Alimentação Escolar — confirmar a situação atual. O mínimo legal de compra da agricultura familiar é 30% do PNAE.`,
          ),
        },
      ],
    },
    {
      titulo: "4 · O que trava repasse",
      itens: [
        {
          pergunta:
            "Quem executa a prestação de contas do PDDE, PNAE e PNATE? Há pendência em aberto em algum deles?",
          contexto: "Prestação de contas pendente suspende o repasse do programa correspondente.",
        },
        {
          pergunta: "O SIOPE é alimentado com que frequência e por quem?",
          contexto:
            c?.mdeAplicado.valor !== null && c?.mdeAplicado.valor !== undefined
              ? `SIOPE: ${pct(c.mdeAplicado.valor)} aplicados em MDE no exercício declarado. A entrega em dia é requisito para a complementação VAAT.`
              : "A entrega do SIOPE em dia é requisito para a complementação VAAT.",
        },
        {
          pergunta:
            "Quem acompanha o SIMEC e as obras pactuadas com o FNDE? Há obra paralisada com recurso já liberado?",
          contexto:
            "Obra paralisada com recurso liberado bloqueia novo termo de compromisso com o FNDE.",
        },
      ],
    },
    {
      titulo: "5 · Coleta e controle social",
      itens: [
        {
          pergunta:
            "Quem responde pelo Censo Escolar e como o prazo de fechamento é controlado?",
          contexto: model.enrollmentYear
            ? `Última base pública disponível: Censo ${model.enrollmentYear}. O Censo é a base de cálculo do FUNDEB do ano seguinte — é o documento que mais move receita nesta lista.`
            : "O Censo é a base de cálculo do FUNDEB do ano seguinte — é o documento que mais move receita nesta lista.",
        },
        {
          pergunta:
            "Os conselhos têm mandato vigente, se reúnem e registram atas? Em especial o CACS-FUNDEB e o CAE.",
          contexto: g
            ? `MUNIC ${anoMunic} — CME: ${g.conselhos.educacao.valor === true ? "registrado" : g.conselhos.educacao.valor === false ? "não consta" : "sem informação"} · CAE: ${g.conselhos.alimentacaoEscolar.valor === true ? "registrado" : g.conselhos.alimentacaoEscolar.valor === false ? "não consta" : "sem informação"} · CACS-FUNDEB: ${g.conselhos.acompanhamentoFundeb.valor === true ? "registrado" : g.conselhos.acompanhamentoFundeb.valor === false ? "não consta" : "sem informação"}.`
            : undefined,
        },
      ],
    },
  ];
}

/** Páginas ocupadas pelo questionário. Ver `distribuirQuestionario`. */
const PAGINAS_QUESTIONARIO = 2;

/**
 * Distribui as seções em páginas equilibrando o número de perguntas.
 *
 * Devolve **sempre** `PAGINAS_QUESTIONARIO` grupos, porque o contrato de
 * páginas do PDF é fixo: um empacotamento mais apertado que gerasse um grupo
 * a menos derrubaria a geração inteira.
 *
 * Mesmo motivo do roteiro que existia no Raio-X: corte por índice fixo cabia
 * exatamente e transbordava em silêncio ao ganhar pergunta nova — o contrato
 * conta `<section class="page">` no DOM e não enxerga o transbordo, que só
 * aparece na folha impressa.
 */
export function distribuirQuestionario(secoes: SecaoCampo[]): SecaoCampo[][] {
  const n = secoes.length;
  if (n <= PAGINAS_QUESTIONARIO) return secoes.map((s) => [s]);

  const custo = secoes.map((s) => s.itens.length);
  const cortes: number[] = [];
  let melhor: number[] = [];
  let melhorMax = Number.POSITIVE_INFINITY;

  // Força bruta sobre os PAGINAS_QUESTIONARIO-1 pontos de corte. Com meia
  // dúzia de seções o custo é irrelevante, e o resultado é o corte contíguo
  // que minimiza a página mais cheia.
  const buscar = (inicio: number) => {
    if (cortes.length === PAGINAS_QUESTIONARIO - 1) {
      const limites = [0, ...cortes, n];
      let maximo = 0;
      for (let g = 0; g < limites.length - 1; g++) {
        maximo = Math.max(
          maximo,
          custo.slice(limites[g], limites[g + 1]).reduce((t, x) => t + x, 0),
        );
      }
      if (maximo < melhorMax) {
        melhorMax = maximo;
        melhor = [...cortes];
      }
      return;
    }
    for (let i = inicio; i <= n - (PAGINAS_QUESTIONARIO - cortes.length); i++) {
      cortes.push(i);
      buscar(i + 1);
      cortes.pop();
    }
  };
  buscar(1);

  const limites = [0, ...melhor, n];
  return Array.from({ length: limites.length - 1 }, (_, g) =>
    secoes.slice(limites[g], limites[g + 1]),
  );
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const CSS = `
@page{size:letter;margin:0}*{box-sizing:border-box}
:root{--navy:#10263f;--teal:#27a69a;--ink:#19242e;--muted:#647380;--line:#d9e1e5;--paper:#fbfcfc}
html,body{margin:0;padding:0;background:#dfe6e9;color:var(--ink)}
body{font-family:Arial,"Noto Sans",sans-serif;font-size:9pt;line-height:1.38}
.page{width:8.5in;height:11in;margin:0 auto;background:var(--paper);overflow:hidden;page-break-after:always;position:relative}
.page:last-child{page-break-after:auto}
.content-page{display:grid;grid-template-rows:auto 1fr auto}
.page-header{min-height:.48in;padding:.22in .62in .11in;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:end;color:var(--muted);font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase}
.page-header strong{color:var(--navy);font-weight:800}
.page-body{padding:.25in .62in .18in;overflow:hidden}
.page-footer{min-height:.39in;padding:.1in .62in .2in;border-top:1px solid var(--line);color:var(--muted);font-size:7pt;display:flex;justify-content:space-between;align-items:start}
h1,h2,h3,p{margin:0}
h2{color:var(--navy);font-size:21pt;line-height:1.04;letter-spacing:-.025em}
h2:after{content:"";display:block;width:.55in;height:.03in;margin-top:.11in;background:var(--teal)}
h3{color:var(--navy);font-size:11pt;line-height:1.15;margin-bottom:.07in}
p+p{margin-top:.09in}
.kicker{color:var(--teal);font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.09in}
.lede{margin-top:.13in;max-width:6.65in;color:#344551;font-size:10pt;line-height:1.42}
.small{font-size:7.7pt;color:var(--muted)}
.strong{font-weight:800;color:var(--navy)}
.divider{height:1px;background:var(--line);margin:.17in 0}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.18in}
.mt-1{margin-top:.12in}.mt-2{margin-top:.2in}
.card{background:#fff;border:1px solid var(--line);border-radius:7px;padding:.15in}
.note{background:#fdf9ee;border:1px solid #eddfb8;border-radius:7px;padding:.11in .14in;color:#584416}
.insight{background:#f2f8f7;border:1px solid #cde4e0;border-radius:7px;padding:.11in .14in}
.oficio-head{background:#0C2E29;color:#fff;padding:.26in .62in;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden}
.oficio-head:before{content:"";position:absolute;right:-.9in;top:-1.15in;width:2.9in;height:2.9in;border-radius:50%;border:.4in solid rgba(62,201,143,.13)}
.brandmark{display:flex;align-items:center;gap:.13in;position:relative}
.brandicon{width:.5in;height:.5in;border-radius:.11in;display:block}
.wordmark{font-size:16.5pt;font-weight:700;letter-spacing:-.02em;line-height:1}
.brandsub{margin-top:.045in;font-size:7.2pt;letter-spacing:.03em;color:#93C6B8}
.oficio-id{text-align:right;position:relative}
.oficio-id b{display:block;font-size:11pt;letter-spacing:.02em}
.oficio-id span{display:block;margin-top:.05in;font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:#9BBFB4}
.to{display:flex;justify-content:space-between;align-items:flex-start;gap:.3in}
.to-label{color:var(--muted);font-size:6.8pt;font-weight:700;letter-spacing:.11em;text-transform:uppercase}
.to-name{margin-top:.05in;color:var(--navy);font-size:11.5pt;font-weight:800;line-height:1.15}
.to-sub{margin-top:.04in;color:#44545f;font-size:8.4pt}
.doc-row{display:grid;grid-template-columns:.2in 1fr;gap:.11in;align-items:start;padding:.062in 0;border-bottom:1px solid var(--line)}
.doc-row:last-child{border-bottom:none}
.box{width:.15in;height:.15in;border:1.4px solid #9fb0bb;border-radius:2.5px;margin-top:.025in}
.doc-name{color:var(--navy);font-size:10pt;font-weight:800;line-height:1.2}
.doc-hint{margin-top:.025in;color:var(--muted);font-size:7.6pt;line-height:1.3}
.strip{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.16in}
.strip div{border-left:1px solid var(--line);padding-left:.14in}.strip div:first-child{border-left:none;padding-left:0}
.strip b{display:block;color:var(--navy);font-size:9.6pt;line-height:1.2;margin-top:.045in}
.strip span{display:block;color:var(--muted);font-size:6.8pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.sign{margin-top:.42in}
.sign-line{width:3.1in}
.sign-line hr{border:none;border-top:1px solid #94a5b0;margin:0 0 .07in}
.sign-name{color:var(--navy);font-size:9.6pt;font-weight:800}
.chk{display:grid;grid-template-columns:.3in 1fr;gap:.12in;background:#fff;border:1px solid var(--line);border-radius:7px;padding:.13in .15in}
.chk-num{font-size:9pt;font-weight:800;color:var(--teal);letter-spacing:.05em;padding-top:.014in}
.chk h3{margin-bottom:.06in}
.chk-field{margin-top:.058in}
.chk-field em{display:block;font-style:normal;color:var(--teal);font-size:6.5pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
.chk-field p{margin-top:.015in;font-size:7.9pt;line-height:1.29;color:#33454f}
.q-secao{margin-bottom:.15in}
.q-secao h3{color:var(--navy);font-size:9.6pt;border-bottom:1px solid var(--line);padding-bottom:.045in;margin-bottom:.08in}
.q-item{padding:.045in 0}
.q-pergunta{color:var(--ink);font-size:8.6pt;line-height:1.28;font-weight:700}
.q-ctx{margin-top:.02in;color:var(--muted);font-size:7.1pt;line-height:1.26;font-style:italic}
.q-linha{margin-top:.055in;border-bottom:1px dotted #b9c6ce;height:.19in}
`;

function paginaOficio(
  model: MunicipalXrayModel,
  params: OficioParams,
  logo: string | null,
  totalPaginas: number,
): string {
  const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(params.emitidoEm)
    .replace(".", "");
  const cidade = `${model.municipality} — ${model.uf}`;
  const docs = documentos(params.anoCenso);

  const linhas = docs
    .map(
      (d, idx) =>
        `<div class="doc-row"><div class="box"></div><div><div class="doc-name">${idx + 1}. ${esc(d.nome)}</div><div class="doc-hint">${esc(d.resumo)}</div></div></div>`,
    )
    .join("");

  return `<section class="page content-page"><div class="oficio-head"><div class="brandmark">${
    logo ? `<img src="${logo}" alt="" class="brandicon">` : ""
  }<div><div class="wordmark">Global Sync</div><div class="brandsub">Global Company Consultorias</div></div></div><div class="oficio-id"><b>Ofício nº ${esc(params.numero)}</b><span>${esc(cidade)} · ${esc(dataCurta)}</span></div></div><div class="page-body"><div class="to"><div><div class="to-label">Ao</div><div class="to-name">Secretaria Municipal de Educação de ${esc(cidade)}</div><div class="to-sub">A/C Sr(a). Secretário(a) Municipal de Educação</div></div><div style="text-align:right;min-width:1.5in"><div class="to-label">Código IBGE</div><div class="to-sub" style="color:var(--navy);font-weight:800;font-size:9.6pt">${esc(model.ibgeCode)}</div></div></div><div class="divider"></div><div class="kicker">Solicitação de documentos</div><h2>Documentos da rede municipal<br>para o diagnóstico educacional</h2><p class="lede">A Global Company Consultorias está elaborando o diagnóstico técnico da rede municipal de ensino de ${esc(model.municipality)}. As bases federais — FNDE, INEP, SICONFI e IBGE — já foram consolidadas, mas elas descrevem o município pelo lado de fora. Para que a análise reflita a rede como ela de fato funciona, solicitamos cópia dos cinco documentos abaixo e as respostas do questionário anexo.</p><div class="insight mt-1"><h3>O que a rede recebe de volta</h3><p style="font-size:8.6pt;line-height:1.4">O <span class="strong">Raio-X Municipal</span>: um relatório técnico de finanças, matrículas, IDEB e infraestrutura da rede, com a estimativa de FUNDEB do exercício e a indicação dos pontos em que há receita a recuperar. Entregue sem custo e sem compromisso para o município.</p></div><div class="mt-2"><div class="kicker" style="color:var(--muted)">Os cinco documentos</div>${linhas}</div><div class="divider mt-1"></div><div class="strip"><div><span>Prazo máximo de envio</span><b>${params.prazoDias} dias</b></div><div><span>WhatsApp — envio direto</span><b>${esc(params.responsavel.whatsapp)}</b></div><div><span>Para arquivos pesados</span><b>${esc(params.responsavel.email)}</b></div></div><p class="small mt-1">Cópia digital simples é suficiente: não é necessário autenticar nem imprimir. A página seguinte descreve cada documento, e as duas últimas trazem um questionário curto sobre o que as bases públicas não alcançam.</p><div class="sign"><div class="sign-line"><hr><div class="sign-name">${esc(params.responsavel.nome)}</div><div class="small">${esc(params.responsavel.cargo)}</div></div></div></div><div class="page-footer"><span>Global Sync · Global Company Consultorias — Inteligência municipal</span><span>1 / ${totalPaginas}</span></div></section>`;
}

function paginaDetalhamento(
  model: MunicipalXrayModel,
  params: OficioParams,
  totalPaginas: number,
): string {
  const cidade = `${model.municipality} — ${model.uf}`;
  const docs = documentos(params.anoCenso);
  const cabecalho = `<div class="page-header"><span><strong>Ofício nº ${esc(params.numero)}</strong> · ${esc(cidade)}</span><span>Detalhamento dos documentos</span></div>`;

  const cartao = (d: DocumentoPedido, idx: number) =>
    `<div class="chk"><div class="chk-num">${String(idx + 1).padStart(2, "0")}</div><div><h3>${esc(d.nome.replace(/^Cópia d[aeo]s? /, ""))}</h3><div class="chk-field"><em>Também chamado de</em><p>${esc(d.tambemChamado)}</p></div><div class="chk-field"><em>Para que serve na análise</em><p>${esc(d.paraQueServe)}</p></div><div class="chk-field"><em>Onde costuma estar</em><p>${esc(d.ondeEsta)}</p></div></div></div>`;

  const quatro = docs.slice(0, 4).map(cartao).join("");
  const quinto = docs[4];

  return `<section class="page content-page">${cabecalho}<div class="page-body"><div class="kicker">Como identificar</div><h2>O que é cada documento</h2><p class="lede" style="font-size:9.2pt">Os nomes variam de rede para rede. Abaixo, o que procuramos, por que o documento importa para a análise e o setor onde ele costuma estar arquivado.</p><div class="grid-2 mt-1" style="gap:.13in">${quatro}</div><div class="chk mt-1" style="grid-template-columns:.34in 1fr"><div class="chk-num">05</div><div><h3>${esc(quinto.nome.replace(/^Cópia d[aeo]s? /, ""))}</h3><div class="grid-2" style="gap:.2in"><div><div class="chk-field"><em>Também chamado de</em><p>${esc(quinto.tambemChamado)}</p></div><div class="chk-field"><em>Onde costuma estar</em><p>${esc(quinto.ondeEsta)}</p></div></div><div><div class="chk-field"><em>Para que serve na análise</em><p>${esc(quinto.paraQueServe)}</p></div></div></div></div></div><div class="note mt-1"><h3 style="color:#584416">Formatos aceitos</h3><p style="font-size:8.4pt;line-height:1.4">PDF, DOCX, XLSX, CSV ou fotografia legível das páginas. Cópia digital simples resolve — sem necessidade de autenticação em cartório ou de via impressa. Se algum arquivo ultrapassar o limite do WhatsApp, envie para <span class="strong" style="color:#584416">${esc(params.responsavel.email)}</span> com o nome do município no assunto. Documentos parciais também ajudam: é melhor receber quatro dos cinco no prazo do que os cinco depois.</p></div><div class="card mt-1" style="padding:.12in .14in"><h3>Em caso de dúvida</h3><p style="font-size:8.4pt;line-height:1.4">${esc(params.responsavel.nome)} &nbsp;·&nbsp; WhatsApp <span class="strong">${esc(params.responsavel.whatsapp)}</span> &nbsp;·&nbsp; <span class="strong">${esc(params.responsavel.email)}</span>. Podemos orientar por telefone qual arquivo corresponde a cada item, inclusive junto ao setor responsável.</p></div></div><div class="page-footer"><span>Prazo máximo de envio: ${params.prazoDias} dias · Emitido em ${new Intl.DateTimeFormat("pt-BR").format(params.emitidoEm)}</span><span>2 / ${totalPaginas}</span></div></section>`;
}

function paginaQuestionario(
  model: MunicipalXrayModel,
  params: OficioParams,
  secoes: SecaoCampo[],
  indice: number,
  totalPaginas: number,
): string {
  const cidade = `${model.municipality} — ${model.uf}`;
  const numero = indice + 3;

  const corpo = secoes
    .map((secao) => {
      const itens = secao.itens
        .map(
          (item) =>
            `<div class="q-item"><div class="q-pergunta">${esc(item.pergunta)}</div>${
              item.contexto ? `<div class="q-ctx">${esc(item.contexto)}</div>` : ""
            }<div class="q-linha"></div></div>`,
        )
        .join("");
      return `<div class="q-secao"><h3>${esc(secao.titulo)}</h3>${itens}</div>`;
    })
    .join("");

  const abertura =
    indice === 0
      ? `<div class="kicker">Questionário</div><h2>O que as bases públicas não alcançam</h2><p class="lede" style="font-size:9.2pt">As perguntas abaixo completam o diagnóstico. Onde já existe registro público sobre ${esc(model.municipality)}, ele aparece em itálico sob a pergunta — assim fica claro de onde partimos e o que precisa ser confirmado ou atualizado. Responder por escrito ou em conversa por telefone, como for mais prático.</p>`
      : `<div class="kicker">Questionário · continuação</div><h2>Custeio, repasse e coleta</h2>`;

  return `<section class="page content-page"><div class="page-header"><span><strong>Ofício nº ${esc(params.numero)}</strong> · ${esc(cidade)}</span><span>Questionário ${indice + 1}/${PAGINAS_QUESTIONARIO}</span></div><div class="page-body">${abertura}<div class="mt-1">${corpo}</div></div><div class="page-footer"><span>Global Sync · Global Company Consultorias — Inteligência municipal</span><span>${numero} / ${totalPaginas}</span></div></section>`;
}

export function generateOficioDocumentosHtml(
  model: MunicipalXrayModel,
  params: OficioParams,
): string {
  const logo = logoDataUri();
  const grupos = distribuirQuestionario(montarQuestionario(model));
  const total = 2 + grupos.length;

  const questionario = grupos
    .map((secoes, idx) => paginaQuestionario(model, params, secoes, idx, total))
    .join("\n\n");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Ofício de solicitação de documentos — ${esc(model.municipality)}</title>
<style>${CSS}</style></head><body>

${paginaOficio(model, params, logo, total)}

${paginaDetalhamento(model, params, total)}

${questionario}

</body></html>`;
}
