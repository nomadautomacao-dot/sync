import { ROTULOS_DIFERENCIADA } from "./escolas-territorio";
import type { DossieEscolas, EscolaDossie, SinalEscola } from "./dossie-escolas";

/**
 * Dossiê das Escolas — HTML de impressão.
 *
 * ## A diferença de arquitetura em relação ao Raio-X
 *
 * O Raio-X e o Levantamento são feitos de `section.page` de altura fixa com
 * `overflow:hidden`: cada folha é uma seção, e conteúdo que estoura é cortado
 * (por isso existe o `pdf-corte.ts`). Isso funciona porque lá o número de
 * páginas é contrato.
 *
 * Aqui não pode ser assim. O corpo do dossiê é uma lista de N escolas, e N
 * varia de 20 a 500+ conforme o município. O documento **precisa** transbordar
 * para a folha seguinte, que é justamente o que `overflow:hidden` impede.
 *
 * Então há dois regimes na mesma folha de papel:
 *
 * - **Seções de altura fixa** (capa, sumário, painel): `section.page`, como nos
 *   outros relatórios.
 * - **Seções de fluxo** (blocos por escola, índice): `section.flow`, sem altura
 *   fixa e sem `overflow:hidden`. O Chromium quebra onde precisar, e
 *   `break-inside:avoid` garante que nenhum bloco de escola seja partido ao
 *   meio entre duas folhas.
 *
 * O cabeçalho e o rodapé das folhas de fluxo vêm de `@page`, não de um
 * `<header>` dentro da seção — dentro da seção ele apareceria uma vez só, no
 * começo, e não em cada folha.
 */

const NBSP = " ";

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const decimal2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ausência é `—`, nunca zero. Regra 2 da visão geral dos dossiês. */
const n0 = (v: number | null | undefined) => (v == null ? "—" : inteiro.format(v));
const n1 = (v: number | null | undefined) => (v == null ? "—" : decimal.format(v));
const n2 = (v: number | null | undefined) => (v == null ? "—" : decimal2.format(v));
const pc = (v: number | null | undefined) => (v == null ? "—" : `${decimal.format(v)}%`);

export interface DossieEscolasInput {
  municipio: string;
  uf: string;
  codigoIbge: string;
  dossie: DossieEscolas;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

/**
 * A linha de leitura de cada bloco.
 *
 * Só aparece quando um critério objetivo dispara — bloco sem sinal fica sem
 * linha, e isso é proposital: um parágrafo genérico repetido 400 vezes é ruído
 * que ensina o leitor a pular a seção inteira.
 */
const LEITURA: Record<SinalEscola, (e: EscolaDossie) => string> = {
  "sem-resultado-participacao": () =>
    "<b>Resultado retido por participação abaixo de 80% no Saeb.</b> É a Condicionalidade II do VAAR, e ela reprova a rede inteira — esta escola é uma das portas em que bater. Logística de aplicação e mobilização de família são gestão, não pedagogia.",
  "abaixo-do-esperado-para-o-contexto": () =>
    "<b>Vai abaixo da mediana da rede tendo contexto socioeconômico acima da mediana.</b> É a escola com mais a ganhar em gestão pedagógica — e a que um ranking de IDEB puro esconde, porque lá embaixo só aparecem as escolas de contexto mais difícil.",
  "abandono-alto": (e) =>
    `<b>Abandono de ${pc(e.abandonoFund)} no fundamental.</b> Aluno que sai não volta sozinho e não conta no Censo do ano seguinte — é matrícula perdida e receita perdida, nesta ordem.`,
  "distorcao-alta": (e) =>
    `<b>Distorção idade-série de ${pc(e.tdiFund)}.</b> Matrícula que já está na rede e não avança: consome vaga sem gerar progressão e antecipa a evasão.`,
  "aprovacao-integral": () =>
    "<b>Aprovação de 100%.</b> O IDEB é fluxo × proficiência, e aprovação integral põe o fluxo no teto — o índice sobe sem que a aprendizagem tenha subido junto. Conferir o critério de aprovação antes de ler o resultado como conquista.",
  "localizacao-diferenciada": (e) =>
    `<b>Declarada em ${esc(e.difRotulo ?? "localização diferenciada")}.</b> A condição pondera acima da urbana comum — de 1,15 no campo a 2,17 em creche integral indígena ou quilombola. Ela vale enquanto estiver declarada na coleta.`,
  "sem-coordenada": () =>
    "<b>Sem coordenada declarada no Censo.</b> A escola não entra no mapa nem no cálculo de distância, e a ausência é do preenchimento, não da escola.",
};

const ROTULO_SINAL: Record<SinalEscola, string> = {
  "sem-resultado-participacao": "resultado retido",
  "abaixo-do-esperado-para-o-contexto": "abaixo do esperado",
  "abandono-alto": "abandono alto",
  "distorcao-alta": "distorção alta",
  "aprovacao-integral": "aprovação 100%",
  "localizacao-diferenciada": "localização diferenciada",
  "sem-coordenada": "sem coordenada",
};

function blocoEtapa(rotulo: string, etapa: EscolaDossie["ai"]): string {
  if (!etapa) {
    return `<div class="etapa vazia"><h4>${rotulo}</h4><p class="nd">Sem divulgação para esta etapa</p></div>`;
  }
  if (etapa.nd) {
    return `<div class="etapa retida"><h4>${rotulo}</h4><p class="nd"><b>Resultado retido</b><br>participação &lt; 80% no Saeb</p></div>`;
  }
  return `<div class="etapa"><h4>${rotulo}</h4>
    <div class="ideb">${n1(etapa.ideb)}</div>
    <table><tbody>
      <tr><td>Português</td><td class="num">${n2(etapa.lp)}</td></tr>
      <tr><td>Matemática</td><td class="num">${n2(etapa.mt)}</td></tr>
      <tr><td>Aprovação</td><td class="num">${pc(etapa.aprovacao)}</td></tr>
    </tbody></table></div>`;
}

function blocoEscola(e: EscolaDossie, ordem: number): string {
  const zona = e.rural ? "campo" : "urbana";
  const etiquetas = e.sinais
    .map((s) => `<span class="tag t-${s}">${ROTULO_SINAL[s]}</span>`)
    .join("");

  const negras = e.racas ? e.racas[2] + e.racas[3] : null;
  const totalRacas = e.racas ? e.racas.reduce((t, v) => t + v, 0) : 0;
  const negraPct = negras !== null && totalRacas > 0 ? (negras / totalRacas) * 100 : null;
  const naoDeclPct = e.racas && totalRacas > 0 ? (e.racas[0] / totalRacas) * 100 : null;

  const leituras = e.sinais
    .map((s) => `<li>${LEITURA[s](e)}</li>`)
    .join("");

  return `<article class="escola">
  <header>
    <div class="ident">
      <span class="ord">${ordem}</span>
      <div>
        <h3>${e.nome ? esc(e.nome) : `Escola ${esc(e.codigo)}`}</h3>
        <p class="meta">código ${esc(e.codigo)} &middot; ${zona}${
          e.difRotulo ? ` &middot; ${esc(e.difRotulo)}` : ""
        }${e.nome ? "" : ' &middot; <i>nome não disponível na divulgação do INEP</i>'}</p>
      </div>
    </div>
    <div class="tags">${etiquetas}</div>
  </header>

  <div class="grade">
    <div class="col">
      <h4>Rede</h4>
      <table><tbody>
        <tr><td>Matrículas</td><td class="num"><b>${n0(e.matriculas)}</b></td></tr>
        <tr><td>Transporte público</td><td class="num">${n0(e.transporte)}</td></tr>
        <tr><td>Matrícula negra</td><td class="num">${pc(negraPct)}</td></tr>
        <tr><td>Cor/raça não declarada</td><td class="num">${pc(naoDeclPct)}</td></tr>
      </tbody></table>
    </div>
    ${blocoEtapa("Anos iniciais", e.ai)}
    ${blocoEtapa("Anos finais", e.af)}
    <div class="col">
      <h4>Contexto</h4>
      <table><tbody>
        <tr><td>INSE${e.inseNivel != null ? ` <span class="micro">(nível ${e.inseNivel})</span>` : ""}</td><td class="num">${n2(e.inse)}</td></tr>
        <tr><td>Complexidade de gestão</td><td class="num">${e.icg == null ? "—" : e.icg}</td></tr>
        <tr><td>Distorção idade-série</td><td class="num">${pc(e.tdiFund)}</td></tr>
        <tr><td>Abandono</td><td class="num">${pc(e.abandonoFund)}</td></tr>
        <tr><td>Docentes adequados</td><td class="num">${pc(e.docentesAdequadosFund)}</td></tr>
      </tbody></table>
    </div>
  </div>

  ${leituras ? `<ul class="leitura">${leituras}</ul>` : ""}
</article>`;
}

export function generateDossieEscolasHtml(input: DossieEscolasInput): string {
  const { dossie: d, municipio, uf } = input;
  const geradoEm = input.geradoEm ?? new Date();
  const responsavel = input.responsavel ?? "Adriel Tavares";
  const r = d.resumo;
  const c = d.cobertura;

  const data = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(geradoEm);

  const marca = input.logoDataUri
    ? `<img src="${input.logoDataUri}" alt="" style="width:.42in;height:.42in;border-radius:8px">`
    : "";

  const difLinhas = Object.entries(r.porDiferenciada)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([cod, qtd]) =>
        `<tr><td>Escolas em ${esc(ROTULOS_DIFERENCIADA[Number(cod)] ?? `localização diferenciada (código ${cod})`)}</td><td class="num"><b>${n0(qtd)}</b></td></tr>`,
    )
    .join("");

  const destaque = (
    rotulo: string,
    alvo: { nome: string | null; codigo: string; valor: number } | null,
    formato: (v: number) => string,
  ) =>
    `<tr><td>${rotulo}</td><td class="num">${
      alvo ? `<b>${formato(alvo.valor)}</b> <span class="micro">${esc(alvo.nome ?? alvo.codigo)}</span>` : "—"
    }</td></tr>`;

  const blocos = d.escolas.map((e, i) => blocoEscola(e, i + 1)).join("\n");

  const indice = [...d.escolas]
    .sort((a, b) => (a.nome ?? a.codigo).localeCompare(b.nome ?? b.codigo, "pt-BR"))
    .map(
      (e) =>
        `<li>${e.nome ? esc(e.nome) : `Escola ${esc(e.codigo)}`} <span class="micro">${esc(e.codigo)}</span></li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dossiê das Escolas — ${esc(municipio)}/${esc(uf)}</title>
<style>
${CSS}
</style></head><body>

<section class="page cover">
  <div class="cover-top">
    <div style="display:flex;align-items:center;gap:.13in">
      ${marca}
      <div>
        <div class="marca">Global Sync</div>
        <div class="marca-sub">Global Company Consultorias</div>
      </div>
    </div>
    <span class="conf">Documento confidencial</span>
  </div>
  <div class="cover-mid">
    <span class="cover-tag">Dossiê temático &middot; rede municipal</span>
    <h1>As escolas<br><span class="thin">uma por uma</span></h1>
    <p class="cover-sub">Cada unidade da rede municipal de ${esc(municipio)} com tudo o que as bases
    oficiais sustentam sobre ela: território, matrícula, resultado e contexto — na mesma linha.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    <div class="cover-hero">
      <em>Unidades no dossiê</em>
      <div class="val"><b>${n0(c.total)}</b><i>${n0(r.matriculas)} matrículas</i></div>
      <p>Toda a rede municipal ativa no Censo Escolar ${d.anoTerritorio}. Nenhuma unidade fica de fora,
      inclusive as que as demais bases não alcançam.</p>
    </div>
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(data)}</b>Censo ${d.anoTerritorio}${
      d.anoIdeb ? ` &middot; IDEB ${d.anoIdeb}` : ""
    }</div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dossiê das Escolas</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Sumário</div>
    <h2>O que a rede mostra quando<br>se olha escola por escola</h2>
    <p class="lede">Os números abaixo só existem porque o dossiê inteiro foi computado. Nenhum deles está
    publicado em lugar nenhum nesta forma — são o agregado de ${n0(c.total)} unidades, cada uma com o que
    as bases do INEP trazem sobre ela.</p>

    <div class="kpis">
      ${kpi(n0(c.total), "escolas na rede municipal")}
      ${kpi(n0(r.matriculas), "matrículas declaradas")}
      ${kpi(n0(r.retidasPorParticipacao), "com resultado retido no Saeb")}
      ${kpi(n0(r.abaixoDoEsperado), "abaixo do esperado para o contexto")}
    </div>

    <div class="duas">
      <div class="card">
        <h3>Os extremos da rede</h3>
        <table><tbody>
          ${destaque("Melhor IDEB — anos iniciais", r.melhorIdebAi, (v) => decimal.format(v))}
          ${destaque("Pior IDEB — anos iniciais", r.piorIdebAi, (v) => decimal.format(v))}
          ${destaque("Maior abandono", r.maiorAbandono, (v) => `${decimal.format(v)}%`)}
          ${destaque("Maior distorção idade-série", r.maiorDistorcao, (v) => `${decimal.format(v)}%`)}
          <tr><td>IDEB médio da rede — anos iniciais</td><td class="num"><b>${n1(r.idebMedioAi)}</b></td></tr>
        </tbody></table>
        <p class="micro" style="margin-top:.06in">A distância entre a melhor e a pior escola é a desigualdade
        que a Condicionalidade III do VAAR mede — e que a média municipal esconde por construção.</p>
      </div>
      <div class="card">
        <h3>Território e ponderação</h3>
        <table><tbody>
          <tr><td>Escolas em zona rural</td><td class="num"><b>${n0(r.rurais)}</b></td></tr>
          ${difLinhas || '<tr><td>Escolas em localização diferenciada</td><td class="num">nenhuma</td></tr>'}
          <tr><td>Escolas com aprovação de 100%</td><td class="num"><b>${n0(r.aprovacaoIntegral)}</b></td></tr>
        </tbody></table>
        <p class="micro" style="margin-top:.06in">Localização diferenciada declarada é fator de ponderação:
        vai de 1,15 no campo a 2,17 em creche integral indígena ou quilombola. A condição vale enquanto
        estiver declarada na coleta do Censo.</p>
      </div>
    </div>

    <div class="cobertura">
      <h3>Cobertura das bases — o que cada uma alcança</h3>
      <p>Os três datasets têm coberturas diferentes, e um bloco com metade dos campos em <b>—</b> precisa que
      o leitor saiba por quê. De <b>${n0(c.total)}</b> escolas da rede:</p>
      <div class="barras">
        ${barra("com nome divulgado", c.comNome, c.total)}
        ${barra("com IDEB divulgado", c.comIdeb, c.total)}
        ${barra("com INSE (Saeb 2023)", c.comInse, c.total)}
        ${barra("com coordenada no Censo", c.comCoordenada, c.total)}
      </div>
      <p class="micro">A divulgação do IDEB cobre apenas escolas com ensino fundamental avaliado — creche e
      pré-escola pura não aparecem nela, e é por isso que a base deste dossiê é o Censo Escolar, não o IDEB.
      ${
        c.comNome < c.total
          ? `<b>${n0(c.total - c.comNome)} escola(s) sem nome divulgado</b> aparecem identificadas pelo código.`
          : "Todas as escolas da rede têm nome divulgado."
      }</p>
    </div>

    <p class="fonte">Fontes: INEP — microdados do Censo Escolar ${d.anoTerritorio} (rede municipal ativa);
    divulgação do IDEB por escola${d.anoIdeb ? ` ${d.anoIdeb}` : ""}; indicadores educacionais por escola
    (INSE, complexidade de gestão, distorção idade-série, rendimento e adequação da formação docente).</p>
  </div>
  <div class="page-footer"><span>INEP — Censo Escolar, IDEB e indicadores por escola</span><span>2</span></div>
</section>

<section class="flow">
  <h2 class="secao">As escolas, uma por uma</h2>
  <p class="secao-sub">Ordenadas do sinal mais grave para o menos: primeiro as com resultado retido por
  participação, depois as que vão abaixo do esperado para o próprio contexto, depois abandono e distorção.
  Dentro de cada grupo, do menor IDEB para o maior. Escola sem sinal não recebe linha de leitura — e isso
  também é informação.</p>
  ${blocos}
</section>

<section class="flow">
  <h2 class="secao">Índice remissivo</h2>
  <p class="secao-sub">As ${n0(c.total)} escolas em ordem alfabética.</p>
  <ol class="indice">${indice}</ol>
  <p class="fonte" style="margin-top:.2in">Emitido em ${esc(data)} por ${esc(responsavel)} &middot;
  Global Company Consultorias. Documento confidencial, destinado exclusivamente ao município analisado.</p>
</section>

</body></html>`;
}

function kpi(valor: string, rotulo: string): string {
  return `<div class="kpi"><b>${valor}</b><span>${rotulo}</span></div>`;
}

function barra(rotulo: string, parte: number, total: number): string {
  const pct = total > 0 ? (parte / total) * 100 : 0;
  return `<div class="barra">
    <span class="b-rot">${rotulo}</span>
    <span class="b-trilho"><i style="width:${pct.toFixed(1)}%"></i></span>
    <span class="b-val">${inteiro.format(parte)} <span class="micro">(${decimal.format(pct)}%)</span></span>
  </div>`;
}

const CSS = `
:root{--navy:#10263f;--teal:#27a69a;--ink:#1d2b36;--muted:#6b7d88;--line:#dbe4e8;
  --wash:#f7fafa;--red:#b0413e;--gold:#b7801f;--good:#22856f}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--ink);
  font-size:9pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* As folhas de fluxo herdam cabeçalho e rodapé daqui — dentro da seção eles
   apareceriam uma vez só, no começo, e não em cada folha impressa. */
@page{size:letter;margin:.62in .62in .55in}
@page:first{margin:0}

/* ── regime 1: altura fixa (capa, sumário) ───────────────────────────── */
section.page{width:8.5in;height:11in;overflow:hidden;position:relative;page-break-after:always;
  break-after:page}
section.page.content{padding:0}
.page-header{position:absolute;top:.42in;left:.62in;right:.62in;display:flex;justify-content:space-between;
  align-items:baseline;padding-bottom:.07in;border-bottom:1px solid var(--line);
  font-size:7.4pt;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.page-header strong{color:var(--navy);font-weight:800}
.page-footer{position:absolute;bottom:.4in;left:.62in;right:.62in;display:flex;justify-content:space-between;
  font-size:7pt;color:var(--muted);border-top:1px solid var(--line);padding-top:.06in}
section.page.content .body{position:absolute;top:.82in;left:.62in;right:.62in;bottom:.62in;overflow:hidden}

/* ── regime 2: fluxo (o corpo do dossiê) ─────────────────────────────── */
section.flow{page-break-before:always;break-before:page}
section.flow .secao{font-size:19pt;color:var(--navy);letter-spacing:-.02em;margin-bottom:.06in}
section.flow .secao-sub{font-size:8.4pt;color:var(--muted);line-height:1.45;max-width:6in;
  margin-bottom:.18in;padding-bottom:.12in;border-bottom:2px solid var(--teal)}

/* ── capa ────────────────────────────────────────────────────────────── */
.cover{background:#fff;display:grid;grid-template-rows:auto 1fr auto;border-top:.09in solid var(--teal)}
.cover:before{content:"";position:absolute;right:-1.6in;top:-1.9in;width:5.2in;height:5.2in;
  border-radius:50%;border:.55in solid rgba(39,166,154,.07)}
.cover-top{padding:.5in .7in 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
.marca{font-size:15pt;font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--navy)}
.marca-sub{margin-top:.04in;font-size:7.2pt;color:var(--muted)}
.conf{border:1px solid #e2c084;color:#a66a10;background:#fdf9ee;border-radius:4px;padding:.03in .09in;
  font-size:6.8pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.cover-mid{padding:0 .7in;position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center}
.cover-tag{display:inline-block;background:rgba(39,166,154,.09);border:1px solid rgba(39,166,154,.35);
  color:#1d7d72;font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  border-radius:999px;padding:.05in .16in;margin-bottom:.22in;width:fit-content}
.cover h1{font-size:33pt;line-height:1.05;letter-spacing:-.03em;font-weight:700;color:var(--navy)}
.cover h1 .thin{color:var(--teal);font-weight:400}
.cover-sub{margin-top:.18in;color:#44545f;font-size:10.5pt;line-height:1.45;max-width:5.6in}
.cover-muni{margin-top:.36in}
.cover-muni em{display:block;font-style:normal;color:var(--muted);font-size:7.4pt;font-weight:800;
  letter-spacing:.13em;text-transform:uppercase}
.cover-muni b{display:block;color:var(--navy);font-size:19pt;letter-spacing:-.02em;margin-top:.05in}
.cover-hero{margin-top:.32in;max-width:5.75in;border-radius:12px;padding:.24in .3in .26in;
  background:linear-gradient(135deg,rgba(39,166,154,.11) 0%,rgba(39,166,154,.03) 62%,rgba(255,255,255,0) 100%);
  border:1px solid rgba(39,166,154,.28);border-left:.055in solid var(--teal)}
.cover-hero em{display:block;font-style:normal;color:#1d7d72;font-size:7.2pt;font-weight:800;
  letter-spacing:.15em;text-transform:uppercase}
.cover-hero .val{display:flex;align-items:baseline;gap:.14in;margin-top:.09in}
.cover-hero .val b{color:var(--teal);font-size:44pt;font-weight:700;letter-spacing:-.035em;line-height:.92}
.cover-hero .val i{font-style:normal;background:var(--teal);color:#fff;font-size:9pt;font-weight:800;
  border-radius:999px;padding:.045in .13in;white-space:nowrap}
.cover-hero p{margin-top:.11in;color:#44545f;font-size:8.4pt;line-height:1.42;max-width:4.6in}
.cover-bot{padding:0 .7in .5in;display:flex;justify-content:space-between;align-items:end;position:relative;
  z-index:1;color:var(--muted);font-size:7.6pt;line-height:1.4}
.cover-bot b{display:block;color:var(--navy);font-size:8.4pt}

/* ── sumário ─────────────────────────────────────────────────────────── */
.kicker{color:var(--teal);font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
h2{font-size:21pt;color:var(--navy);letter-spacing:-.025em;line-height:1.1;margin-top:.05in}
.lede{margin-top:.14in;color:#44545f;font-size:9.4pt;line-height:1.5;max-width:6in;
  padding-bottom:.14in;border-bottom:2px solid var(--teal)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:.14in;margin-top:.2in}
.kpi{border-left:.03in solid var(--teal);padding-left:.11in}
.kpi b{display:block;color:var(--navy);font-size:17pt;letter-spacing:-.02em;line-height:1}
.kpi span{display:block;color:var(--muted);font-size:6.9pt;font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;margin-top:.05in;line-height:1.3}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.22in}
.card{border:1px solid var(--line);border-radius:8px;padding:.15in .17in;background:#fff}
.card h3{font-size:10.5pt;color:var(--navy);margin-bottom:.08in}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.045in 0;border-bottom:1px solid #eef3f5}
table td.num{text-align:right;color:var(--navy)}
.micro{font-size:6.9pt;color:var(--muted);line-height:1.35}
.cobertura{margin-top:.22in;border:1px solid var(--line);border-radius:8px;padding:.15in .17in;background:var(--wash)}
.cobertura h3{font-size:10.5pt;color:var(--navy)}
.cobertura p{font-size:8.2pt;color:#44545f;margin-top:.05in;line-height:1.45}
.barras{margin:.12in 0}
.barra{display:grid;grid-template-columns:1.7in 1fr 1.1in;align-items:center;gap:.1in;margin-bottom:.06in;
  font-size:8pt}
.b-rot{color:#44545f}
.b-trilho{background:#e4edee;border-radius:3px;height:.1in;display:block}
.b-trilho i{display:block;height:100%;background:var(--teal);border-radius:3px}
.b-val{text-align:right;color:var(--navy);font-weight:700}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}

/* ── bloco por escola ────────────────────────────────────────────────── */
.escola{border:1px solid var(--line);border-radius:8px;padding:.13in .15in;margin-bottom:.13in;
  break-inside:avoid;page-break-inside:avoid;background:#fff}
.escola header{display:flex;justify-content:space-between;align-items:flex-start;gap:.15in;
  padding-bottom:.08in;border-bottom:1px solid var(--line)}
.escola .ident{display:flex;gap:.1in;align-items:baseline}
.escola .ord{color:var(--muted);font-size:8pt;font-weight:800;min-width:.3in}
.escola h3{font-size:10.5pt;color:var(--navy);letter-spacing:-.015em;line-height:1.15}
.escola .meta{font-size:7pt;color:var(--muted);margin-top:.02in}
.tags{display:flex;flex-wrap:wrap;gap:.04in;justify-content:flex-end;max-width:2.6in}
.tag{font-size:6.2pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;
  padding:.02in .07in;white-space:nowrap;background:#eef3f5;color:var(--muted)}
.t-sem-resultado-participacao{background:#fbeceb;color:var(--red)}
.t-abaixo-do-esperado-para-o-contexto{background:#fdf4e3;color:var(--gold)}
.t-abandono-alto{background:#fbeceb;color:var(--red)}
.t-distorcao-alta{background:#fdf4e3;color:var(--gold)}
.t-aprovacao-integral{background:#eef6f5;color:#1d7d72}
.escola .grade{display:grid;grid-template-columns:1.55fr 1fr 1fr 1.55fr;gap:.13in;margin-top:.1in}
.escola h4{font-size:6.9pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);
  margin-bottom:.04in}
.escola table{font-size:7.6pt}
.escola table td{padding:.03in 0}
.etapa{border-left:1px solid var(--line);padding-left:.11in;text-align:center}
.etapa table{margin-top:.05in;text-align:left}
.etapa h4{text-align:left}
.etapa .ideb{font-size:19pt;font-weight:700;color:var(--teal);letter-spacing:-.03em;line-height:1.05}
.etapa .nd{font-size:7.4pt;color:var(--muted);line-height:1.35;margin-top:.06in;text-align:left}
.etapa.retida .nd b{color:var(--red)}
.col{border-left:1px solid var(--line);padding-left:.11in}
.col:first-child{border-left:0;padding-left:0}
.leitura{margin-top:.1in;padding:.09in .11in;background:var(--wash);border-radius:6px;list-style:none}
.leitura li{font-size:7.6pt;line-height:1.42;color:#33454f;padding-left:.13in;position:relative;
  margin-bottom:.04in}
.leitura li:last-child{margin-bottom:0}
.leitura li:before{content:"";position:absolute;left:0;top:.055in;width:.05in;height:.05in;border-radius:50%;
  background:var(--teal)}

/* ── índice ──────────────────────────────────────────────────────────── */
.indice{columns:3;column-gap:.28in;font-size:7.8pt;line-height:1.5;padding-left:.2in}
.indice li{break-inside:avoid;margin-bottom:.02in}
`;
