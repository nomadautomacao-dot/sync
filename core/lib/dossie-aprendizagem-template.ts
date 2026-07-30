import {
  SIGNIFICADO_GRUPO,
  type DossieAprendizagem,
  type LeituraIdeb,
  type SerieDossie,
} from "./dossie-aprendizagem";
import { DESCRICAO_CONDICIONALIDADE } from "./fundeb-vaar";

/**
 * Dossiê da Aprendizagem — HTML de impressão.
 *
 * Mesma arquitetura de duas velocidades dos outros dossiês. A regra editorial
 * específica deste: **todo percentual de distribuição aparece também em número
 * de crianças**, e todo número de crianças aparece com o sinal `≈` e a nota que
 * explica a suposição. "18% no nível insuficiente" não move ninguém; "cerca de
 * 380 crianças" move — mas só é dizível porque a suposição está impressa.
 */

const NBSP = " ";

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ausência é `—`, nunca zero. Regra 2 da visão geral dos dossiês. */
const n0 = (v: number | null | undefined) => (v == null ? "—" : inteiro.format(v));
const n1 = (v: number | null | undefined) => (v == null ? "—" : dec1.format(v));
const pc = (v: number | null | undefined) => (v == null ? "—" : `${dec1.format(v)}%`);

/** Contagem aproximada: nunca sai sem o sinal. */
const aprox = (v: number | null | undefined) =>
  v == null ? "—" : `≈${NBSP}${inteiro.format(v)}`;

const NOTA_APROXIMACAO =
  "<b>Por que os números de crianças levam ≈.</b> A divulgação do Saeb publica <i>percentual</i>, não " +
  "contagem, e o Censo Escolar publica matrícula <i>por etapa</i>, não por série. A conversão aplica o " +
  "percentual à matrícula da etapa dividida pelo número de séries dela — cinco nos anos iniciais, quatro " +
  "nos finais —, o que supõe distribuição uniforme entre as séries. A suposição erra em rede que perde " +
  "matrícula ano a ano, onde o 1º ano é maior que o 5º. O percentual é exato; a contagem é ordem de " +
  "grandeza, e serve para dimensionar turma, material e formação, não para conferir lista de chamada.";

export interface DossieAprendizagemInput {
  municipio: string;
  uf: string;
  codigoIbge: string;
  dossie: DossieAprendizagem;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

const CLASSE_GRUPO = {
  insuficiente: "g-insuf",
  basico: "g-basico",
  proficiente: "g-prof",
  avancado: "g-avanc",
} as const;

function blocoSerie(s: SerieDossie): string {
  const segmentos = s.grupos
    .filter((g) => g.pct > 0)
    .map(
      (g) =>
        `<span class="seg ${CLASSE_GRUPO[g.chave]}" style="width:${g.pct.toFixed(2)}%">${
          g.pct >= 7 ? `${dec1.format(g.pct)}%` : ""
        }</span>`,
    )
    .join("");

  const ref = s.referencia;

  const linhas = s.grupos
    .map((g) => {
      const nacional =
        ref === null
          ? ""
          : g.chave === "insuficiente"
            ? `<span class="ref">mediana nacional ${dec1.format(ref.medianaInsuficiente)}%</span>`
            : g.chave === "avancado"
              ? `<span class="ref">mediana nacional ${dec1.format(ref.medianaAvancado)}%</span>`
              : "";
      return `<tr class="grupo ${CLASSE_GRUPO[g.chave]}">
      <td class="nome"><span class="ponto"></span>${g.rotulo}</td>
      <td class="num"><b>${pc(g.pct)}</b>${nacional}</td>
      <td class="num ap">${aprox(g.alunosAproximados)}</td>
      <td class="txt">${SIGNIFICADO_GRUPO[g.chave]}</td>
    </tr>`;
    })
    .join("");

  return `<article class="serie ${s.atipica ? "atipica" : ""}">
  <header>
    <div>
      <h3>${esc(s.rotulo)}</h3>
      <p class="meta">${
        s.baseConversao !== null
          ? `base da conversão: ≈${NBSP}${inteiro.format(s.baseConversao)} alunos na série`
          : "sem matrícula da etapa no Censo — a conversão em crianças não é possível"
      }${
        ref?.percentilInsuficiente !== null && ref !== null
          ? ` &middot; percentil ${dec1.format(ref.percentilInsuficiente!)} em nível insuficiente entre ${inteiro.format(ref.redes)} redes municipais`
          : ""
      }</p>
    </div>
    <div class="media">
      <em>Proficiência média</em>
      <b>${n1(s.media)}</b>
    </div>
  </header>

  <div class="empilhada">${segmentos}</div>

  <table class="grupos"><tbody>${linhas}</tbody></table>

  ${
    s.atipica && ref
      ? `<p class="atipico"><b>Distribuição atípica no país — conferir antes de ler como resultado.</b>
      ${dec1.format(s.grupos[3].pct)}% dos alunos aparecem no nível avançado, contra mediana de
      ${dec1.format(ref.medianaAvancado)}% entre as ${inteiro.format(ref.redes)} redes municipais avaliadas.
      Isso põe esta rede acima do percentil 99 nacional. Não é acusação: rede pequena com turma excepcional
      produz o mesmo efeito. Mas antes de apresentar o número como conquista, conferir a taxa de participação
      na aplicação e o número de alunos avaliados — em rede de poucas dezenas de respondentes, um punhado de
      provas move a distribuição inteira.</p>`
      : `<p class="fecho-serie"><b>${pc(s.abaixoDoEsperado)} da rede — ${aprox(s.abaixoDoEsperadoAproximado)} crianças —
  ainda não domina o que esta etapa exige</b> (insuficiente e básico somados). É a fila de espera pedagógica
  desta prova: quem está no insuficiente precisa de recomposição, quem está no básico precisa de reforço, e
  as duas coisas custam e demoram diferente.</p>`
  }
</article>`;
}

const ROTULO_TRAJETORIA: Record<string, { texto: string; classe: string }> = {
  subindo: { texto: "subindo", classe: "bom" },
  estagnada: { texto: "estagnada", classe: "atencao" },
  caindo: { texto: "caindo", classe: "ruim" },
  indefinida: { texto: "série curta demais", classe: "neutro" },
};

function cartaoIdeb(l: LeituraIdeb): string {
  const t = ROTULO_TRAJETORIA[l.trajetoria];
  return `<div class="card-ideb">
    <em>${esc(l.rotulo)}</em>
    <b>${n1(l.ultimo?.valor)}</b>
    <span class="tag t-${t.classe}">${t.texto}</span>
    <table><tbody>
      <tr><td>Edição</td><td class="num">${l.ultimo?.ano ?? "—"}</td></tr>
      <tr><td>Variação desde a anterior</td><td class="num ${(l.variacaoRecente ?? 0) < 0 ? "alerta" : ""}">${
        l.variacaoRecente === null ? "—" : `${l.variacaoRecente > 0 ? "+" : ""}${dec1.format(l.variacaoRecente)}`
      }</td></tr>
      <tr><td>Desde ${l.primeiro?.ano ?? "—"}</td><td class="num">${
        l.ultimo && l.primeiro
          ? `${l.ultimo.valor - l.primeiro.valor > 0 ? "+" : ""}${dec1.format(l.ultimo.valor - l.primeiro.valor)}`
          : "—"
      }</td></tr>
      <tr><td>Contra a referência nacional</td><td class="num ${(l.distanciaReferencia ?? 0) < 0 ? "alerta" : ""}">${
        l.distanciaReferencia === null
          ? "—"
          : `${l.distanciaReferencia > 0 ? "+" : ""}${dec1.format(l.distanciaReferencia)}`
      }</td></tr>
    </tbody></table>
  </div>`;
}

export function generateDossieAprendizagemHtml(input: DossieAprendizagemInput): string {
  const { dossie: d, municipio, uf } = input;
  const geradoEm = input.geradoEm ?? new Date();
  const responsavel = input.responsavel ?? "Adriel Tavares";
  const r = d.resumo;

  const dataEmissao = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(geradoEm);

  const marca = input.logoDataUri
    ? `<img src="${input.logoDataUri}" alt="" style="width:.42in;height:.42in;border-radius:8px">`
    : "";

  const a = d.alfabetizacao;
  const rend = d.rendimento;

  // O ritmo necessário fica negativo quando a rede já passou a meta final —
  // imprimir "-4 pontos por ano" ali seria absurdo.
  const metaJaSuperada = a?.metaFinal ? a.metaFinal.ritmoNecessario <= 0 : false;

  const linhasIdeb = d.serieIdeb
    .map(
      (ano) => `<tr class="ano-ideb">
      <td class="nome"><b>${ano.ano}</b></td>
      <td class="num">${n1(ano.anosIniciais)}</td>
      <td class="bar">${barraIdeb(ano.anosIniciais)}</td>
      <td class="num sub">${n1(ano.referenciaAnosIniciais)}</td>
      <td class="num">${n1(ano.anosFinais)}</td>
      <td class="bar">${barraIdeb(ano.anosFinais)}</td>
      <td class="num sub">${n1(ano.referenciaAnosFinais)}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dossiê da Aprendizagem — ${esc(municipio)}/${esc(uf)}</title>
<style>
${CSS}
</style></head><body>

<section class="page cover">
  <div class="cover-top">
    <div style="display:flex;align-items:center;gap:.13in">
      ${marca}
      <div><div class="marca">Global Sync</div><div class="marca-sub">Global Company Consultorias</div></div>
    </div>
    <span class="conf-sel">Documento confidencial</span>
  </div>
  <div class="cover-mid">
    <span class="cover-tag">Dossiê temático &middot; resultado de aprendizagem</span>
    <h1>A média esconde<br><span class="thin">a criança</span></h1>
    <p class="cover-sub">Duas redes com o mesmo IDEB podem ter 8% ou 30% dos alunos no nível insuficiente. A
    média não distingue; a política pública sim — uma é reforço focalizado, a outra é recomposição em massa.
    Este dossiê abre a distribuição das quatro provas do Saeb e converte cada percentual em crianças.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    ${
      r.piorInsuficiente
        ? `<div class="cover-hero">
      <em>No pior recorte da rede — ${esc(r.piorInsuficiente.rotulo.toLowerCase())}</em>
      <div class="val"><b>${dec1.format(r.piorInsuficiente.pct)}%</b><i>no nível insuficiente</i></div>
      <p>Não é a média que está em jogo, é quem está atrás dela: crianças que seguem para a série seguinte sem
      a base desta — e nenhuma etapa posterior volta para ensinar o que ficou. As quatro provas, com a conta
      em crianças, estão nas folhas seguintes.</p>
    </div>`
        : `<div class="cover-hero">
      <em>Distribuição de proficiência</em>
      <div class="val"><b>—</b><i>sem divulgação</i></div>
      <p>A planilha do Saeb 2023 não traz a rede municipal deste município. O dossiê segue com IDEB,
      alfabetização e fluxo escolar, e diz na folha seguinte por que a distribuição não aparece.</p>
    </div>`
    }
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(dataEmissao)}</b>INEP — Saeb${
      d.saeb ? ` ${d.saeb.ano}` : ""
    }, IDEB e Censo Escolar</div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dossiê da Aprendizagem</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Sumário</div>
    <h2>O que o número único<br>não deixa ver</h2>
    <p class="lede">O IDEB esconde duas coisas ao mesmo tempo: a distância entre as escolas da rede — isso é o
    Dossiê das Escolas — e a distribuição dos alunos dentro delas, que é este documento. Some-se a
    alfabetização no 2º ano, <b>a única meta deste dossiê que o próprio município assinou</b>: todo o resto
    compara com referência nacional; ali a régua é o compromisso do ente.</p>

    <div class="kpis">
      ${kpi(n1(r.idebAnosIniciais), "IDEB anos iniciais")}
      ${kpi(n1(r.idebAnosFinais), "IDEB anos finais")}
      ${kpi(r.piorInsuficiente ? `${dec1.format(r.piorInsuficiente.pct)}%` : "—", "pior nível insuficiente")}
      ${kpi(a ? `${dec1.format(a.ultimo.valor)}%` : "—", `alfabetização ${a?.ultimo.ano ?? ""}`)}
    </div>

    <div class="duas">
      <div class="card">
        <h3>A conta que este dossiê existe para fazer</h3>
        ${
          r.alunosInsuficientesAproximados !== null
            ? `<p class="txt">Somando as quatro provas, <b>${aprox(r.alunosInsuficientesAproximados)} crianças</b>
             aparecem no nível insuficiente. São coortes diferentes — 5º e 9º ano, duas disciplinas —, então
             o número não é "alunos distintos da rede": é a carga de trabalho somada das quatro frentes. É
             assim que se dimensiona turma de recomposição, material e formação.</p>`
            : `<p class="txt">A conversão de percentual em crianças não foi possível: o Censo Escolar não
             trouxe matrícula do fundamental por etapa para este município.</p>`
        }
        <table><tbody>
          ${d.series
            .map(
              (s) =>
                `<tr><td>${esc(s.rotulo)}</td><td class="num"><b>${pc(s.grupos[0].pct)}</b> <span class="ap">${aprox(s.grupos[0].alunosAproximados)}</span></td></tr>`,
            )
            .join("")}
          ${d.series.length === 0 ? '<tr><td colspan="2" class="sub">Sem divulgação do Saeb para esta rede.</td></tr>' : ""}
        </tbody></table>
      </div>
      <div class="card ${r.metaFinalForaDeAlcance ? "ruim" : ""}">
        <h3>A meta que o município assinou</h3>
        ${
          a
            ? `<table><tbody>
          <tr><td>Alfabetizados no 2º ano — ${a.ultimo.ano}</td><td class="num"><b>${pc(a.ultimo.valor)}</b></td></tr>
          <tr><td>Meta pactuada do mesmo ano</td><td class="num">${pc(a.ultimo.meta)}</td></tr>
          <tr class="destaque"><td><b>Cumpriu</b></td><td class="num"><b>${
            a.ultimo.cumpriu === null ? "—" : a.ultimo.cumpriu ? "sim" : "não"
          }</b></td></tr>
          <tr><td>Ritmo observado</td><td class="num">${a.ritmoObservado === null ? "—" : `${a.ritmoObservado > 0 ? "+" : ""}${dec1.format(a.ritmoObservado)} pt/ano`}</td></tr>
          <tr><td>Ritmo necessário até ${a.metaFinal?.ano ?? "—"}</td><td class="num">${
            a.metaFinal === null
              ? "—"
              : metaJaSuperada
                ? "meta já superada"
                : `${dec1.format(a.metaFinal.ritmoNecessario)} pt/ano`
          }</td></tr>
        </tbody></table>
        <p class="micro" style="margin-top:.07in">${
          r.metaFinalForaDeAlcance
            ? `<b>Em ritmo constante, a meta de ${a.metaFinal?.ano} não é alcançada.</b> O ritmo observado é menor que o necessário, e a diferença cresce a cada ano que passa sem mudança de política. É a única afirmação deste tipo que o dossiê pode fazer com número — porque a meta é do próprio município.`
            : metaJaSuperada
              ? `A rede já está no patamar da meta final do Compromisso. O que resta é sustentar, e a participação de ${pc(a.participacao)} na avaliação é o que dá validade ao resultado.`
              : "Em ritmo constante, a meta final do Compromisso é alcançável. A leitura vale enquanto o ritmo se sustentar."
        }</p>
        ${
          a.participacaoFragil
            ? `<p class="aviso">Participação de ${pc(a.participacao)} na avaliação — abaixo de 80%. O resultado descreve quem fez a prova, não a rede, e qualquer leitura acima precisa dessa ressalva na frente.</p>`
            : ""
        }`
            : `<p class="txt">O município não consta na divulgação do Indicador Criança Alfabetizada.</p>`
        }
      </div>
    </div>

    ${
      d.ausencias.length > 0
        ? `<div class="ausencias">
      <h3>O que não veio, e por quê</h3>
      <ul>${d.ausencias.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    </div>`
        : ""
    }

    ${
      r.seriesAtipicas > 0
        ? `<div class="ausencias">
      <h3>Antes de ler os resultados desta rede</h3>
      <p style="font-size:7.4pt;line-height:1.45;color:#5d4a2c">Em ${
        r.seriesAtipicas === 1 ? "uma das provas" : `${r.seriesAtipicas} das provas`
      }, a distribuição desta rede está <b>acima do percentil 99</b> das redes municipais do país no nível
      avançado. Distribuição assim tanto pode ser rede pequena com turma excepcional quanto problema de
      aplicação — o dossiê marca a prova, mostra a mediana nacional ao lado e manda conferir participação e
      número de respondentes antes de apresentar o número como conquista.</p>
    </div>`
        : ""
    }

    <div class="faixa-aprox">
      <h3>Sobre os números de crianças deste dossiê</h3>
      <p>${NOTA_APROXIMACAO}</p>
    </div>

    <p class="fonte">Fontes: INEP — planilha de resultados do Saeb${d.saeb ? ` ${d.saeb.ano}` : ""}, aba
    Municípios, rede municipal; divulgação do IDEB e taxas de rendimento por município; Indicador Criança
    Alfabetizada (Compromisso Nacional Criança Alfabetizada); Censo Escolar${
      d.censo ? ` ${d.censo.anoReferencia}` : ""
    }; microdados do ENEM por município de prova.</p>
  </div>
  <div class="page-footer"><span>INEP — Saeb, IDEB, Censo Escolar e CNCA</span><span>2</span></div>
</section>

${
  d.series.length > 0
    ? `<section class="flow">
  <h2 class="secao">A distribuição, prova a prova</h2>
  <p class="secao-sub">As quatro provas do Saeb da rede municipal, cada uma com a barra da distribuição, a
  proficiência média e o que cada grupo significa em decisão de gestão. A escala do INEP não tem rótulo
  qualitativo — o agrupamento em quatro níveis é a convenção consolidada por Todos Pela Educação e QEdu, e
  está descrito no rodapé desta seção.</p>
  ${d.series.map(blocoSerie).join("")}
  <p class="rodape-tabela"><b>Onde ficam os cortes.</b> Em Língua Portuguesa do 5º ano, insuficiente é abaixo
  de 150 pontos e proficiente começa em 200; em Matemática do 5º, abaixo de 175 e 225. No 9º ano, LP abaixo
  de 200 e proficiente em 275; MT abaixo de 225 e proficiente em 300. São escalas diferentes por série e
  disciplina — comparar a média de LP5 com a de LP9 diretamente não significa nada.<br>${NOTA_APROXIMACAO}</p>
</section>`
    : ""
}

${
  d.serieIdeb.length > 0
    ? `<section class="flow">
  <h2 class="secao">O IDEB, edição a edição</h2>
  <p class="secao-sub">Todas as edições desde 2005, nas duas etapas, com a referência nacional ao lado. A
  coluna de referência <b>não é meta deste município</b>: o INEP não projeta meta municipal desde 2021, e
  chamá-la de meta afirmaria um compromisso que ninguém assinou.</p>

  <table class="grid ideb">
    <thead><tr>
      <th>Edição</th>
      <th class="num" colspan="3">Anos iniciais</th>
      <th class="num" colspan="3">Anos finais</th>
    </tr>
    <tr class="sub-head">
      <th></th><th class="num">IDEB</th><th></th><th class="num">referência</th>
      <th class="num">IDEB</th><th></th><th class="num">referência</th>
    </tr></thead>
    <tbody>${linhasIdeb}</tbody>
  </table>

  <div class="duas" style="margin-top:.2in">
    ${d.leituraIdeb.map(cartaoIdeb).join("")}
  </div>

  <p class="rodape-tabela"><b>O IDEB é produto, não soma.</b> Ele é nota padronizada × indicador de
  rendimento — prova e fluxo multiplicados. Isso tem uma consequência prática que quase nenhuma rede
  explora: subir aprovação move o índice no ano seguinte, enquanto subir proficiência leva dois ciclos. A
  folha do fluxo escolar mostra onde está a margem deste município nesse segundo fator.</p>
</section>`
    : ""
}

${
  a
    ? `<section class="flow">
  <h2 class="secao">Alfabetização, ano a ano, contra a meta assinada</h2>
  <p class="secao-sub">O Indicador Criança Alfabetizada mede o 2º ano do fundamental e é o único indicador
  deste dossiê com <b>meta individual do município</b>, pactuada ano a ano até ${a.metaFinal?.ano ?? 2030}.
  Não é referência nacional nem mediana de pares: é o compromisso do próprio ente, e por isso "cumpriu" é
  dizível sem rodeio.</p>

  <table class="grid">
    <thead><tr>
      <th>Ano</th><th class="num">Alfabetizados</th><th></th><th class="num">Meta pactuada</th>
      <th class="num">Diferença</th><th class="num">Cumpriu</th>
    </tr></thead>
    <tbody>
      ${a.serie
        .map(
          (ano) => `<tr>
        <td class="nome"><b>${ano.ano}</b></td>
        <td class="num"><b>${pc(ano.valor)}</b></td>
        <td class="bar">${barraPct(ano.valor)}</td>
        <td class="num sub">${pc(ano.meta)}</td>
        <td class="num ${ano.meta !== null && ano.valor < ano.meta ? "alerta" : ""}">${
          ano.meta === null ? "—" : `${ano.valor - ano.meta > 0 ? "+" : ""}${dec1.format(ano.valor - ano.meta)}`
        }</td>
        <td class="num"><span class="tag t-${ano.cumpriu === null ? "neutro" : ano.cumpriu ? "bom" : "ruim"}">${
          ano.cumpriu === null ? "sem meta" : ano.cumpriu ? "sim" : "não"
        }</span></td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <div class="duas" style="margin-top:.2in">
    <div class="card">
      <h3>Ritmo observado contra ritmo necessário</h3>
      <table><tbody>
        <tr><td>Ritmo dos dois últimos anos</td><td class="num"><b>${a.ritmoObservado === null ? "—" : `${a.ritmoObservado > 0 ? "+" : ""}${dec1.format(a.ritmoObservado)} pt/ano`}</b></td></tr>
        <tr><td>Necessário até ${a.metaFinal?.ano ?? "—"}</td><td class="num"><b>${
          a.metaFinal === null ? "—" : metaJaSuperada ? "meta já superada" : `${dec1.format(a.metaFinal.ritmoNecessario)} pt/ano`
        }</b></td></tr>
        <tr><td>Meta final do Compromisso</td><td class="num">${pc(a.metaFinal?.meta ?? null)}</td></tr>
        ${
          a.proximaMeta
            ? `<tr class="destaque"><td><b>Falta para a meta de ${a.proximaMeta.ano}</b></td><td class="num"><b>${
                a.proximaMeta.faltamPontos <= 0
                  ? "já alcançada"
                  : `${dec1.format(a.proximaMeta.faltamPontos)} pontos`
              }</b></td></tr>`
            : ""
        }
        <tr><td>Variação desde ${a.serie[0]?.ano ?? "—"}</td><td class="num">${
          a.variacaoPontos === null ? "—" : `${a.variacaoPontos > 0 ? "+" : ""}${dec1.format(a.variacaoPontos)} pontos`
        }</td></tr>
      </tbody></table>
      <p class="micro" style="margin-top:.07in">${
        r.metaFinalForaDeAlcance
          ? "O ritmo observado é menor que o necessário. Em ritmo constante a meta final não é alcançada — e cada ano sem mudança aumenta o ritmo que os anos restantes vão exigir."
          : metaJaSuperada
            ? "A rede já superou a meta final. A conversa deixa de ser de alcance e passa a ser de sustentação."
            : "O ritmo observado alcança a meta final, se sustentado."
      }</p>
    </div>
    <div class="card">
      <h3>Contexto e validade do dado</h3>
      <table><tbody>
        <tr><td>Participação na avaliação</td><td class="num ${a.participacaoFragil ? "alerta" : ""}"><b>${pc(a.participacao)}</b></td></tr>
        <tr><td>Nível no Compromisso</td><td class="num">${a.nivelRotulo ? esc(a.nivelRotulo) : "—"}</td></tr>
        ${
          a.uf
            ? `<tr><td>Rede pública de ${esc(a.uf.sigla)} em ${a.uf.ano}</td><td class="num">${pc(a.uf.valor)}</td></tr>
          <tr><td>Diferença para o estado</td><td class="num">${`${a.ultimo.valor - a.uf.valor > 0 ? "+" : ""}${dec1.format(a.ultimo.valor - a.uf.valor)}`} pontos</td></tr>`
            : ""
        }
      </tbody></table>
      <p class="micro" style="margin-top:.07in">${
        a.participacaoFragil
          ? "<b>Participação abaixo de 80%.</b> O resultado descreve quem fez a prova, não a rede: se os ausentes forem justamente os que menos aprenderam, o número real é mais baixo que o publicado."
          : "A participação sustenta a leitura do resultado — acima de 80%, o indicador descreve a rede e não só quem compareceu."
      }<br>Fonte: ${esc(a.fonte)}</p>
    </div>
  </div>
</section>`
    : ""
}

${
  rend
    ? `<section class="flow">
  <h2 class="secao">Fluxo escolar — a metade rápida do IDEB</h2>
  <p class="secao-sub">O IDEB é nota × rendimento. A nota responde em dois ciclos de avaliação; o fluxo
  responde no ano seguinte, porque sai do Censo. É por aqui que uma rede move o índice mais rápido — e é por
  aqui que ela o perde, quando o abandono cresce sem ninguém olhar.
  ${
    rend.recorte !== "municipal"
      ? `<b>Atenção ao recorte:</b> o INEP não publicou o dado da rede municipal deste município, então os números abaixo são do recorte <b>${esc(rend.recorte)}</b> e descrevem o território, não a rede que a secretaria administra.`
      : ""
  }</p>

  <table class="grid fluxo">
    <thead><tr>
      <th>Indicador</th><th class="num">Anos<br>iniciais</th><th class="num">Anos<br>finais</th>
      <th class="num">Funda-<br>mental</th><th>O que significa</th>
    </tr></thead>
    <tbody>
      <tr>
        <td class="nome"><b>Aprovação</b></td>
        <td class="num"><b>${pc(rend.anosIniciais.aprovacao)}</b></td>
        <td class="num"><b>${pc(rend.anosFinais.aprovacao)}</b></td>
        <td class="num">${pc(rend.fundamental.aprovacao)}</td>
        <td class="txt">Entra no IDEB como indicador de rendimento. Aprovação alta com proficiência baixa põe
        o fluxo no teto sem que a aprendizagem tenha subido junto — conferir o critério antes de ler como
        conquista.</td>
      </tr>
      <tr>
        <td class="nome"><b>Reprovação</b></td>
        <td class="num">${pc(rend.anosIniciais.reprovacao)}</td>
        <td class="num">${pc(rend.anosFinais.reprovacao)}</td>
        <td class="num">${pc(rend.fundamental.reprovacao)}</td>
        <td class="txt">Aluno reprovado ocupa vaga de novo no ano seguinte e alimenta a distorção
        idade-série, que por sua vez antecipa a evasão.</td>
      </tr>
      <tr>
        <td class="nome"><b>Abandono</b></td>
        <td class="num ${(rend.anosIniciais.abandono ?? 0) > 1 ? "alerta" : ""}">${pc(rend.anosIniciais.abandono)}</td>
        <td class="num ${(rend.anosFinais.abandono ?? 0) > 1 ? "alerta" : ""}">${pc(rend.anosFinais.abandono)}</td>
        <td class="num">${pc(rend.fundamental.abandono)}</td>
        <td class="txt">Aluno que sai não volta sozinho e não conta no Censo do ano seguinte: é matrícula
        perdida e receita perdida, nesta ordem.</td>
      </tr>
      <tr>
        <td class="nome"><b>Distorção idade-série</b></td>
        <td class="num ${(rend.anosIniciais.distorcao ?? 0) > 25 ? "alerta" : ""}">${pc(rend.anosIniciais.distorcao)}</td>
        <td class="num ${(rend.anosFinais.distorcao ?? 0) > 25 ? "alerta" : ""}">${pc(rend.anosFinais.distorcao)}</td>
        <td class="num">${pc(rend.fundamental.distorcao)}</td>
        <td class="txt">Matrícula que já está na rede e não avança: consome vaga sem gerar progressão. É o
        estoque que a reprovação e o abandono formaram nos anos anteriores.</td>
      </tr>
    </tbody>
  </table>

  ${
    rend.idebAnosIniciais || rend.idebAnosFinais
      ? `<h3 class="sub">Como o IDEB de ${rend.anoReferencia} foi formado</h3>
  <p class="sub-nota">Os dois fatores do produto, abertos. É a folha que mostra se o índice desta rede vem
  da prova ou do fluxo — e, portanto, onde ele é frágil.</p>
  <table class="grid">
    <thead><tr><th>Componente</th><th class="num">Anos iniciais</th><th class="num">Anos finais</th></tr></thead>
    <tbody>
      <tr><td class="nome">Proficiência em Língua Portuguesa</td><td class="num">${n1(rend.idebAnosIniciais?.notaPortugues)}</td><td class="num">${n1(rend.idebAnosFinais?.notaPortugues)}</td></tr>
      <tr><td class="nome">Proficiência em Matemática</td><td class="num">${n1(rend.idebAnosIniciais?.notaMatematica)}</td><td class="num">${n1(rend.idebAnosFinais?.notaMatematica)}</td></tr>
      <tr><td class="nome">Nota padronizada (0 a 10)</td><td class="num"><b>${n1(rend.idebAnosIniciais?.notaMedia)}</b></td><td class="num"><b>${n1(rend.idebAnosFinais?.notaMedia)}</b></td></tr>
      <tr><td class="nome">Indicador de rendimento (0 a 1)</td><td class="num"><b>${
        rend.idebAnosIniciais?.indicadorRendimento == null ? "—" : rend.idebAnosIniciais.indicadorRendimento.toFixed(3).replace(".", ",")
      }</b></td><td class="num"><b>${
        rend.idebAnosFinais?.indicadorRendimento == null ? "—" : rend.idebAnosFinais.indicadorRendimento.toFixed(3).replace(".", ",")
      }</b></td></tr>
      <tr class="destaque"><td class="nome"><b>IDEB observado</b></td><td class="num"><b>${n1(rend.idebAnosIniciais?.idebObservado)}</b></td><td class="num"><b>${n1(rend.idebAnosFinais?.idebObservado)}</b></td></tr>
    </tbody>
  </table>
  <p class="rodape-tabela"><b>Leia o produto, não os fatores isolados.</b> Nota padronizada 5,7 com
  rendimento 0,90 dá IDEB 5,1. Uma rede com rendimento próximo de 1,00 já esgotou a margem do fluxo: dali em
  diante o índice só sobe por proficiência, que é o caminho lento. Uma rede com rendimento baixo tem margem
  rápida — mas só se a aprovação subir por aprendizagem, e não por decisão administrativa.</p>`
      : ""
  }

  <p class="fonte">Fonte: ${esc(rend.fonte)} · recorte de rede: ${esc(rend.recorte)}.</p>
</section>`
    : ""
}

${
  d.vaar
    ? `<section class="flow">
  <h2 class="secao">A ponte com o VAAR — o portão e a régua</h2>
  <p class="secao-sub">A complementação VAAR funciona em duas etapas, e confundi-las custa dinheiro. As cinco
  condicionalidades são o <b>portão</b>: reprovar em uma zera a parcela inteira, por melhor que a rede seja.
  Passado o portão, o quanto se recebe é proporcional ao <b>avanço</b> em atendimento e aprendizagem — não ao
  nível. Rede com IDEB alto e estagnada recebe pouco; rede com IDEB baixo que sobe, recebe. É por isso que os
  números de partida desta folha importam mais que o da capa.</p>

  <div class="duas">
    <div class="card">
      <h3>De onde esta rede parte</h3>
      <table><tbody>
        ${d.leituraIdeb
          .map(
            (l) =>
              `<tr><td>${esc(l.rotulo)}</td><td class="num"><b>${n1(l.ultimo?.valor)}</b> <span class="micro" style="display:inline">${ROTULO_TRAJETORIA[l.trajetoria].texto}</span></td></tr>`,
          )
          .join("")}
        ${a ? `<tr><td>Alfabetização no 2º ano</td><td class="num"><b>${pc(a.ultimo.valor)}</b></td></tr>` : ""}
        ${
          r.piorInsuficiente
            ? `<tr><td>Pior nível insuficiente</td><td class="num"><b>${dec1.format(r.piorInsuficiente.pct)}%</b></td></tr>`
            : ""
        }
      </tbody></table>
      <p class="micro" style="margin-top:.07in">Estes são os números de partida. O rateio compara a próxima
      edição com esta — o que a rede fizer a partir de agora é o que entra na conta.</p>
    </div>
    <div class="card ${d.vaar.reprovadas.length > 0 ? "ruim" : ""}">
      <h3>O portão: as condicionalidades em ${d.vaar.exercicio}</h3>
      <table><tbody>
        ${(Object.keys(DESCRICAO_CONDICIONALIDADE) as Array<keyof typeof DESCRICAO_CONDICIONALIDADE>)
          .map((cond) => {
            const situacao = d.vaar!.condicionalidades[cond];
            const rotulo =
              situacao === null ? "não informada" : situacao ? "cumprida" : "reprovada";
            const classe = situacao === null ? "neutro" : situacao ? "bom" : "ruim";
            return `<tr><td>${esc(cond)}<span class="micro">${esc(DESCRICAO_CONDICIONALIDADE[cond])}</span></td><td class="num"><span class="tag t-${classe}">${rotulo}</span></td></tr>`;
          })
          .join("")}
      </tbody></table>
      <p class="micro" style="margin-top:.07in">Reprovar em uma zera a parcela inteira (art. 14, §1º da Lei
      14.113/2020). Duas delas encostam neste dossiê: a <b>II</b> exige participação de 80% no Saeb — logística
      de aplicação e mobilização de família, gestão e não pedagogia — e a <b>III</b> mede a redução das
      desigualdades de aprendizagem, que é exatamente a cauda que as barras das folhas anteriores mostram.</p>
    </div>
  </div>
</section>`
    : ""
}

${
  d.enem
    ? `<section class="flow junta">
  <h2 class="secao">ENEM — o fim da básica aponta para algum lugar?</h2>
  <p class="secao-sub"><b>Este indicador não é da rede municipal.</b> O ENEM é do fim do ensino médio, que é
  rede estadual, e o recorte é por <b>município de prova</b> — inclui candidatos de cidades vizinhas que
  provam aqui. Entra como termômetro do território, nunca como resultado da rede que a secretaria
  administra.</p>

  <div class="duas">
    <div class="card">
      <h3>Abstenção em ${d.enem.ano}</h3>
      <table><tbody>
        <tr><td>Inscritos com prova neste município</td><td class="num"><b>${n0(d.enem.inscritos)}</b></td></tr>
        <tr><td>Ausentes nos dois dias</td><td class="num">${n0(d.enem.ausentes)}</td></tr>
        <tr class="destaque"><td><b>Abstenção</b></td><td class="num"><b>${pc(d.enem.pctAbstencao)}</b></td></tr>
        ${
          d.enem.uf
            ? `<tr><td>Abstenção em ${esc(d.enem.uf.sigla)}</td><td class="num">${pc(d.enem.uf.pctAbstencao)}</td></tr>
          <tr><td>Diferença para o estado</td><td class="num ${d.enem.pctAbstencao > d.enem.uf.pctAbstencao ? "alerta" : ""}">${`${d.enem.pctAbstencao - d.enem.uf.pctAbstencao > 0 ? "+" : ""}${dec1.format(d.enem.pctAbstencao - d.enem.uf.pctAbstencao)}`} pontos</td></tr>`
            : ""
        }
      </tbody></table>
    </div>
    <div class="card">
      <h3>Por que isto entra num dossiê de rede municipal</h3>
      <p class="txt">Abstenção alta não é preguiça de adolescente: é o sinal de que a conclusão do ensino
      médio não está associada, no território, a nenhum destino concreto. Isso volta para a rede municipal
      por dois caminhos — a expectativa da família sobre o valor da escola, e a evasão que começa nos anos
      finais do fundamental, dentro da rede que a secretaria administra.</p>
      <p class="txt" style="margin-top:.07in">O uso correto do número é como pergunta de campo, não como
      indicador de desempenho: <i>a rede sabe quantos dos seus egressos chegam ao ENEM?</i></p>
    </div>
  </div>

  <p class="fonte">Fonte: ${esc(d.enem.fonte)}. O microdado pós-LGPD não publica município de residência, só o
  de prova — município sem local de aplicação não aparece, e município-sede acumula candidatos de vizinhos.</p>
</section>`
    : ""
}

<section class="flow junta">
  <p class="fonte">Emitido em ${esc(dataEmissao)} por ${esc(responsavel)} &middot; Global Company
  Consultorias. Documento confidencial, destinado exclusivamente ao município analisado.</p>
</section>

</body></html>`;
}

function kpi(valor: string, rotulo: string): string {
  return `<div class="kpi"><b>${valor}</b><span>${rotulo}</span></div>`;
}

/** Trilho de 0 a 10, a escala do IDEB. */
function barraIdeb(valor: number | null): string {
  if (valor === null) return '<span class="trilho"></span>';
  return `<span class="trilho"><i style="width:${Math.min(100, valor * 10).toFixed(1)}%"></i></span>`;
}

function barraPct(valor: number | null): string {
  if (valor === null) return '<span class="trilho"></span>';
  return `<span class="trilho"><i style="width:${Math.min(100, Math.max(0, valor)).toFixed(1)}%"></i></span>`;
}

const CSS = `
:root{--navy:#10263f;--teal:#27a69a;--ink:#1d2b36;--muted:#6b7d88;--line:#dbe4e8;
  --wash:#f7fafa;--red:#b0413e;--gold:#b7801f;--good:#22856f;--violet:#5a5fa8}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--ink);
  font-size:9pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}

@page{size:letter;margin:.62in .62in .55in}
@page:first{margin:0}

section.page{width:8.5in;height:11in;overflow:hidden;position:relative;page-break-after:always;break-after:page}
section.page.content{padding:0}
.page-header{position:absolute;top:.42in;left:.62in;right:.62in;display:flex;justify-content:space-between;
  align-items:baseline;padding-bottom:.07in;border-bottom:1px solid var(--line);
  font-size:7.4pt;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.page-header strong{color:var(--navy);font-weight:800}
.page-footer{position:absolute;bottom:.4in;left:.62in;right:.62in;display:flex;justify-content:space-between;
  font-size:7pt;color:var(--muted);border-top:1px solid var(--line);padding-top:.06in}
section.page.content .body{position:absolute;top:.82in;left:.62in;right:.62in;bottom:.62in;overflow:hidden}

section.flow{page-break-before:always;break-before:page}
section.flow.junta{page-break-before:auto;break-before:auto;margin-top:.34in}
section.flow .secao{font-size:19pt;color:var(--navy);letter-spacing:-.02em;margin-bottom:.06in;
  break-after:avoid;page-break-after:avoid}
section.flow .secao-sub{font-size:8.4pt;color:var(--muted);line-height:1.45;max-width:6.4in;
  margin-bottom:.18in;padding-bottom:.12in;border-bottom:2px solid var(--teal);
  break-after:avoid;page-break-after:avoid}

/* ── capa ────────────────────────────────────────────────────────────────── */
.cover{background:#fff;display:grid;grid-template-rows:auto 1fr auto;border-top:.09in solid var(--teal)}
.cover:before{content:"";position:absolute;right:-1.6in;top:-1.9in;width:5.2in;height:5.2in;
  border-radius:50%;border:.55in solid rgba(39,166,154,.07)}
.cover-top{padding:.5in .7in 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
.marca{font-size:15pt;font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--navy)}
.marca-sub{margin-top:.04in;font-size:7.2pt;color:var(--muted)}
.conf-sel{border:1px solid #e2c084;color:#a66a10;background:#fdf9ee;border-radius:4px;padding:.03in .09in;
  font-size:6.8pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.cover-mid{padding:0 .7in;position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center}
.cover-tag{display:inline-block;background:rgba(39,166,154,.09);border:1px solid rgba(39,166,154,.35);
  color:#1d7d72;font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  border-radius:999px;padding:.05in .16in;margin-bottom:.22in;width:fit-content}
.cover h1{font-size:33pt;line-height:1.05;letter-spacing:-.03em;font-weight:700;color:var(--navy)}
.cover h1 .thin{color:var(--teal);font-weight:400}
.cover-sub{margin-top:.18in;color:#44545f;font-size:10.5pt;line-height:1.45;max-width:5.7in}
.cover-muni{margin-top:.3in}
.cover-muni em{display:block;font-style:normal;color:var(--muted);font-size:7.4pt;font-weight:800;
  letter-spacing:.13em;text-transform:uppercase}
.cover-muni b{display:block;color:var(--navy);font-size:19pt;letter-spacing:-.02em;margin-top:.05in}
.cover-hero{margin-top:.28in;max-width:5.9in;border-radius:12px;padding:.22in .3in .24in;
  background:linear-gradient(135deg,rgba(39,166,154,.12) 0%,rgba(39,166,154,.03) 62%,rgba(255,255,255,0) 100%);
  border:1px solid rgba(39,166,154,.28);border-left:.055in solid var(--teal)}
.cover-hero em{display:block;font-style:normal;color:#1d7d72;font-size:7.2pt;font-weight:800;
  letter-spacing:.13em;text-transform:uppercase;max-width:4.6in;line-height:1.4}
.cover-hero .val{display:flex;align-items:baseline;gap:.14in;margin-top:.08in}
.cover-hero .val b{color:var(--teal);font-size:44pt;font-weight:700;letter-spacing:-.035em;line-height:.92}
.cover-hero .val i{font-style:normal;background:var(--teal);color:#fff;font-size:9pt;font-weight:800;
  border-radius:999px;padding:.045in .13in;white-space:nowrap}
.cover-hero p{margin-top:.1in;color:#44545f;font-size:8.3pt;line-height:1.42;max-width:5.1in}
.cover-bot{padding:0 .7in .5in;display:flex;justify-content:space-between;align-items:end;position:relative;
  z-index:1;color:var(--muted);font-size:7.6pt;line-height:1.4}
.cover-bot b{display:block;color:var(--navy);font-size:8.4pt}

/* ── folhas de argumento ─────────────────────────────────────────────────── */
.kicker{color:var(--teal);font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
h2{font-size:21pt;color:var(--navy);letter-spacing:-.025em;line-height:1.1;margin-top:.05in}
.lede{margin-top:.13in;color:#44545f;font-size:9.2pt;line-height:1.5;max-width:6.4in;
  padding-bottom:.13in;border-bottom:2px solid var(--teal)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:.14in;margin-top:.18in}
.kpi{border-left:.03in solid var(--teal);padding-left:.11in}
.kpi b{display:block;color:var(--navy);font-size:17pt;letter-spacing:-.02em;line-height:1}
.kpi span{display:block;color:var(--muted);font-size:6.6pt;font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;margin-top:.05in;line-height:1.3}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.2in}
.card{border:1px solid var(--line);border-radius:8px;padding:.14in .16in;background:#fff;
  break-inside:avoid;page-break-inside:avoid}
.card.ruim{border-color:#e6bab8;background:#fdf6f5}
.card h3{font-size:10.5pt;color:var(--navy);margin-bottom:.07in}
.card .txt{font-size:8pt;line-height:1.45;color:#44545f}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.042in 0;border-bottom:1px solid #eef3f5;vertical-align:top}
table td.num{text-align:right;color:var(--navy);white-space:nowrap}
td.num.sub,th.num.sub,td.sub{color:var(--muted);font-weight:400}
td.alerta{color:var(--red)}
tr.destaque td{background:rgba(39,166,154,.07)}
.ap{color:var(--muted);font-weight:600}
.micro{display:block;font-size:6.8pt;color:var(--muted);line-height:1.35;font-weight:400}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}
.aviso{margin-top:.07in;background:#fdf4e3;border-left:.03in solid var(--gold);border-radius:0 5px 5px 0;
  padding:.07in .1in;font-size:7.4pt;line-height:1.42;color:#6b5116}
.tag{display:inline-block;font-size:6.2pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  border-radius:999px;padding:.025in .08in;white-space:nowrap;background:#eef3f5;color:var(--muted)}
.t-ruim{background:#fbeceb;color:var(--red)}
.t-atencao{background:#fdf4e3;color:var(--gold)}
.t-bom{background:#eef6f5;color:var(--good)}

.ausencias{margin-top:.18in;border:1px solid #e2c084;background:#fdf9ee;border-radius:8px;padding:.12in .15in}
.ausencias h3{font-size:9pt;color:#8a5a0d;margin-bottom:.05in}
.ausencias ul{padding-left:.16in;font-size:7.4pt;line-height:1.42;color:#5d4a2c}
.faixa-aprox{margin-top:.18in;border:1px solid var(--line);background:var(--wash);border-radius:8px;
  padding:.12in .15in}
.faixa-aprox h3{font-size:9pt;color:var(--navy);margin-bottom:.04in}
.faixa-aprox p{font-size:7.5pt;line-height:1.45;color:#44545f}

/* ── tabelas de fluxo ────────────────────────────────────────────────────── */
.grid{margin-top:.14in;font-size:8pt}
.grid thead{display:table-header-group}
.grid thead th{text-align:left;font-size:6.8pt;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  font-weight:800;padding:0 0 .05in;border-bottom:1.5px solid var(--navy);vertical-align:bottom}
.grid thead th.num{text-align:right}
.grid thead tr.sub-head th{border-bottom:1px solid var(--line);padding-top:.03in;font-size:6.4pt}
.grid tbody tr{break-inside:avoid;page-break-inside:avoid}
.grid tbody td{padding:.05in 0;border-bottom:1px solid #eef3f5}
.grid tbody td.nome{padding-right:.14in}
.grid tbody td.txt{font-size:7.4pt;line-height:1.42;color:#44545f;padding-left:.14in}
.grid tfoot td{padding:.06in 0 0;border-top:1.5px solid var(--navy);font-weight:700;color:var(--navy)}
.trilho{display:block;background:#e9f0f1;border-radius:2px;height:.075in;width:.8in}
.trilho i{display:block;height:100%;background:var(--teal);border-radius:2px}
td.bar{width:.85in;padding-left:.08in;padding-right:.08in}
.rodape-tabela{margin-top:.12in;font-size:7.4pt;line-height:1.45;color:#44545f;background:var(--wash);
  border-left:.03in solid var(--teal);padding:.09in .12in;border-radius:0 6px 6px 0}
h3.sub{margin-top:.26in;font-size:12pt;color:var(--navy);letter-spacing:-.015em;
  break-after:avoid;page-break-after:avoid}
.sub-nota{font-size:7.6pt;color:var(--muted);line-height:1.45;margin-top:.03in;max-width:6.2in;
  break-after:avoid;page-break-after:avoid}
.ideb td.nome{width:.6in}
.ideb td.bar{padding-left:.12in}
/* Cabeçalhos numéricos estreitos colavam um no outro sem largura declarada. */
.fluxo td.nome,.fluxo th:first-child{width:1.15in}
.fluxo td.num,.fluxo th.num{width:.72in;padding-left:.06in}
/* Fecha a corrente de "não quebre aqui": título, subtítulo e o primeiro
   bloco de conteúdo ficam na mesma folha. */
.duas{break-before:avoid;page-break-before:avoid}

/* ── bloco por prova ─────────────────────────────────────────────────────── */
.serie{border:1px solid var(--line);border-radius:8px;padding:.14in .16in;margin-bottom:.15in;
  break-inside:avoid;page-break-inside:avoid;background:#fff}
.serie header{display:flex;justify-content:space-between;align-items:flex-start;gap:.15in;
  padding-bottom:.08in;border-bottom:1px solid var(--line)}
.serie h3{font-size:12pt;color:var(--navy);letter-spacing:-.015em}
.serie .meta{font-size:7pt;color:var(--muted);margin-top:.02in}
.serie .media{text-align:right}
.serie .media em{display:block;font-style:normal;font-size:6.6pt;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted)}
.serie .media b{display:block;font-size:17pt;color:var(--teal);letter-spacing:-.03em;line-height:1.05}
.empilhada{display:flex;height:.26in;border-radius:5px;overflow:hidden;margin-top:.11in;
  border:1px solid var(--line)}
.empilhada .seg{display:flex;align-items:center;justify-content:center;font-size:6.6pt;font-weight:800;
  color:#fff;letter-spacing:.02em;min-width:0}
/* Escopadas na barra: as mesmas classes marcam a linha da tabela abaixo, e sem
   o escopo o fundo cobria a linha inteira e apagava o texto. */
.empilhada .g-insuf{background:#b0413e}
.empilhada .g-basico{background:#d69a3a}
.empilhada .g-prof{background:#27a69a}
.empilhada .g-avanc{background:#1d5d55}
.grupos{margin-top:.1in;font-size:7.8pt}
.grupos td{padding:.04in 0;border-bottom:1px solid #f2f6f7;vertical-align:top}
.grupos td.nome{width:1in;font-weight:700;color:var(--navy)}
.grupos td.num{width:.55in}
.grupos td.num.ap{width:.7in}
.grupos td.txt{font-size:7.2pt;line-height:1.4;color:#44545f;padding-left:.14in}
.grupos .ponto{display:inline-block;width:.07in;height:.07in;border-radius:2px;margin-right:.05in}
.grupos .g-insuf .ponto{background:#b0413e}
.grupos .g-basico .ponto{background:#d69a3a}
.grupos .g-prof .ponto{background:#27a69a}
.grupos .g-avanc .ponto{background:#1d5d55}
.fecho-serie{margin-top:.1in;padding:.08in .11in;background:var(--wash);border-radius:6px;font-size:7.6pt;
  line-height:1.42;color:#33454f}
.serie.atipica{border-color:#e2c084}
.atipico{margin-top:.1in;padding:.08in .11in;background:#fdf9ee;border-left:.03in solid var(--gold);
  border-radius:0 6px 6px 0;font-size:7.6pt;line-height:1.42;color:#5d4a2c}
.grupos .ref{display:block;font-size:6.5pt;color:var(--muted);font-weight:400;margin-top:.01in}

/* ── cartões do IDEB ─────────────────────────────────────────────────────── */
.card-ideb{border:1px solid var(--line);border-top:.045in solid var(--teal);border-radius:8px;
  padding:.14in .15in;break-inside:avoid;page-break-inside:avoid}
.card-ideb em{display:block;font-style:normal;font-size:7pt;font-weight:800;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted)}
.card-ideb b{display:inline-block;font-size:24pt;letter-spacing:-.03em;color:var(--navy);line-height:1.05;
  margin:.03in .1in .03in 0}
.card-ideb table{margin-top:.06in;font-size:7.8pt}
`;
