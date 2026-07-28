import type { IDEBDado, RelatorioFundeb } from "@/modules/levantamento-fundeb/types";

/**
 * Template do Levantamento FUNDEB — "novo modelo".
 *
 * Porte fiel de `LEVANTAMENTO_FUNDEB_NOVO_MODELO.html` (raiz do repositório),
 * que substitui o gerador ReportLab (`gerador.py`, o primeiro modelo do
 * produto). O CSS de impressão é o mesmo do arquivo de referência — ele já está
 * calibrado para Letter sem margem, e reescrevê-lo só reintroduziria bugs de
 * paginação já resolvidos.
 *
 * O relatório tem 10 páginas fixas; `section.page` é o contrato que o renderer
 * confere antes de devolver o PDF.
 */

export const LEVANTAMENTO_TOTAL_PAGINAS = 10;

/** Payload do `buildGoviaMunicipioCompleto`, na parte que este template lê. */
export interface LevantamentoPayload {
  demografia?: {
    populacao?: number | null;
    populacao_ano_referencia?: string | null;
  } | null;
  educacao?: Record<string, unknown> | null;
  fiscal?: {
    situacao_lrf?: string | null;
    receita_total?: number | null;
    despesa_pessoal?: number | null;
    pib_per_capita?: number | null;
    historico_repasses?: Array<Record<string, unknown>> | null;
    siconfi?: Record<string, unknown> | null;
  } | null;
  fontes_utilizadas?: unknown[] | null;
}

export interface LevantamentoTemplateInput {
  relatorio: RelatorioFundeb;
  payload?: LevantamentoPayload | null;
  /** Logo em data-URI. Ausente → a marca sai só como texto. */
  logoDataUri?: string | null;
}

// ── Formatação ──────────────────────────────────────────────────────────────

const NBSP = "\u00a0";

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** `R$ 128.516.949,21` — usado em tabela, onde o centavo importa. */
function brl(value: unknown): string {
  return num(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** `R$ 128,52 mi` — usado em KPI, onde a ordem de grandeza é a mensagem. */
function brlCompact(value: unknown): string {
  const v = num(value);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    return `R$${NBSP}${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NBSP}mi`;
  }
  if (abs >= 1_000) {
    return `R$${NBSP}${(v / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${NBSP}mil`;
  }
  return `R$${NBSP}${brl(v)}`;
}

function int(value: unknown): string {
  return num(value).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function pct(value: unknown, casas = 1): string {
  return `${num(value).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Participação de `parte` sobre `total`, protegida contra divisão por zero. */
function share(parte: unknown, total: unknown): number {
  const t = num(total);
  return t > 0 ? (num(parte) / t) * 100 : 0;
}

/** Largura de barra relativa ao maior valor da série. */
function barWidth(valor: unknown, maior: number): string {
  if (maior <= 0) return "0";
  return `${Math.max(0, Math.min(100, (num(valor) / maior) * 100)).toFixed(1)}%`;
}

/** Escapa texto vindo de base externa antes de entrar no HTML. */
function esc(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto ausente vira travessão — nunca um zero que finge ser dado. */
function ou(value: unknown, fallback = "—"): string {
  if (value == null) return fallback;
  const s = String(value).trim();
  if (!s || /^n[aã]o informado$/i.test(s)) return fallback;
  return esc(s);
}

function dataCurta(iso: string | undefined): string {
  if (!iso) return new Date().toLocaleDateString("pt-BR");
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? esc(iso)
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// ── Blocos reutilizáveis ────────────────────────────────────────────────────

function cabecalho(municipio: string, secao: string): string {
  return `<div class="page-header">
    <span><strong>Diagnóstico FUNDEB</strong> &middot; ${esc(municipio)}</span>
    <span>${esc(secao)}</span>
  </div>`;
}

function rodape(pagina: number, extra = ""): string {
  return `<div class="page-footer">
    <span>Global Sync &middot; Global Company Consultorias &mdash; Inteligência municipal &middot; Confidencial</span>
    <span>${pagina} / ${LEVANTAMENTO_TOTAL_PAGINAS}${extra}</span>
  </div>`;
}

interface Barra {
  nome: string;
  valor: number;
  rotulo: string;
  tom2?: boolean;
  vermelho?: boolean;
}

function barras(itens: Barra[]): string {
  const maior = Math.max(0, ...itens.map((i) => i.valor));
  return itens
    .map(
      (i) => `<div class="hb">
        <div class="hb-name">${esc(i.nome)}</div>
        <div class="hb-track"><div class="hb-fill${i.tom2 ? " t2" : ""}" style="width:${barWidth(i.valor, maior)}"></div></div>
        <div class="hb-val"${i.vermelho ? ' style="color:var(--red)"' : ""}>${esc(i.rotulo)}</div>
      </div>`,
    )
    .join("");
}

function kpi(rotulo: string, valor: string, apoio: string, classe = ""): string {
  return `<div class="kpi${classe ? ` ${classe}` : ""}"><em>${esc(rotulo)}</em><b>${valor}</b><span>${apoio}</span></div>`;
}

// ── CSS de impressão (idêntico ao modelo de referência) ─────────────────────

const CSS = `
@page{size:letter;margin:0}*{box-sizing:border-box}
:root{--navy:#10263f;--blue:#176b87;--teal:#27a69a;--gold:#e6a23c;--red:#c75050;--ink:#19242e;--muted:#647380;--line:#d9e1e5;--paper:#fbfcfc;--wash:#eef4f5;--good:#22856f;--warn:#a66a10;
--data1:#2f6bbf;--data2:#27a69a;--data3:#e6a23c;--brandark:#0C2E29}
html,body{margin:0;padding:0;background:#dfe6e9;color:var(--ink)}
body{font-family:Arial,"Noto Sans",sans-serif;font-size:9pt;line-height:1.38}
.page{width:8.5in;height:11in;margin:0 auto;background:var(--paper);overflow:hidden;page-break-after:always;position:relative}
.page:last-child{page-break-after:auto}
.content-page{display:grid;grid-template-rows:auto 1fr auto}
.page-header{min-height:.48in;padding:.22in .62in .11in;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:end;color:var(--muted);font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase}
.page-header strong{color:var(--navy);font-weight:800}
.page-body{padding:.24in .62in .16in;overflow:hidden}
.page-footer{min-height:.39in;padding:.1in .62in .2in;border-top:1px solid var(--line);color:var(--muted);font-size:7pt;display:flex;justify-content:space-between;align-items:start}
h1,h2,h3,p{margin:0}
h2{color:var(--navy);font-size:20pt;line-height:1.04;letter-spacing:-.025em}
h2:after{content:"";display:block;width:.55in;height:.03in;margin-top:.1in;background:var(--teal)}
h3{color:var(--navy);font-size:10.5pt;line-height:1.15;margin-bottom:.06in}
p+p{margin-top:.08in}
.kicker{color:var(--teal);font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.08in}
.lede{margin-top:.12in;max-width:6.7in;color:#344551;font-size:9.8pt;line-height:1.42}
.small{font-size:7.7pt;color:var(--muted)}
.micro{font-size:6.8pt;color:var(--muted)}
.strong{font-weight:800;color:var(--navy)}
.divider{height:1px;background:var(--line);margin:.14in 0}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.15in}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.12in}
.grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.1in}
.mt-1{margin-top:.11in}.mt-2{margin-top:.18in}
.card{background:#fff;border:1px solid var(--line);border-radius:7px;padding:.13in}
.note{background:#fdf9ee;border:1px solid #eddfb8;border-radius:7px;padding:.1in .13in;color:#584416}
.insight{background:#f2f8f7;border:1px solid #cde4e0;border-radius:7px;padding:.1in .13in}
.sec-label{color:var(--muted);font-size:7.2pt;font-weight:800;letter-spacing:.11em;text-transform:uppercase;margin:.14in 0 .07in}
.sec-label:first-child{margin-top:0}
.kpi{background:#fff;border:1px solid var(--line);border-radius:7px;padding:.11in .13in}
.kpi em{display:block;font-style:normal;color:var(--muted);font-size:6.6pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
.kpi b{display:block;color:var(--navy);font-size:14pt;letter-spacing:-.02em;margin-top:.035in;line-height:1}
.kpi span{display:block;color:var(--muted);font-size:6.9pt;margin-top:.035in}
.kpi.up b{color:var(--good)}
.kpi.hero{background:#f2f8f7;border:1px solid #cde4e0;border-left:.05in solid var(--teal)}
.kpi.hero em{color:#1d6a58}.kpi.hero b{color:var(--navy);font-size:15pt}.kpi.hero span{color:#5b7a72}
.tb{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:7px;overflow:hidden}
.tb th{background:var(--wash);color:var(--navy);font-size:6.9pt;letter-spacing:.06em;text-transform:uppercase;text-align:left;padding:.06in .1in;border-bottom:1px solid var(--line)}
.tb th.r,.tb td.r{text-align:right}
.tb td{padding:.055in .1in;border-bottom:1px solid var(--line);font-size:8pt;line-height:1.28;color:#33454f;vertical-align:top}
.tb tr:last-child td{border-bottom:none}
.tb td b{color:var(--navy)}
.tb tr.total td{background:var(--wash);font-weight:800;color:var(--navy)}
.hb{display:grid;grid-template-columns:1.5in 1fr .8in;gap:.08in;align-items:center;padding:.038in 0}
.hb-name{color:#33454f;font-size:7.8pt;line-height:1.15;text-align:right}
.hb-track{height:.14in;background:var(--wash);border-radius:3px;position:relative}
.hb-fill{height:100%;border-radius:3px;background:var(--data1);min-width:2px}
.hb-fill.t2{background:var(--data2)}
.hb-val{color:var(--navy);font-size:7.8pt;font-weight:800}
.vchart{display:flex;align-items:flex-end;gap:.14in;height:1.35in;padding:0 .05in;border-bottom:1.5px solid #b9c6cd}
.vbar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
.vbar-val{color:var(--navy);font-size:7.4pt;font-weight:800;margin-bottom:.03in;white-space:nowrap}
.vbar-fill{width:70%;background:var(--data1);border-radius:4px 4px 0 0}
.vbar-fill.now{background:var(--data2)}
.vxlab{display:flex;gap:.14in;padding:.04in .05in 0}
.vxlab span{flex:1;text-align:center;color:var(--muted);font-size:7.2pt}
.pair{display:grid;grid-template-columns:.85in 1fr;gap:.1in;align-items:center;padding:.05in 0}
.pair-name{color:var(--navy);font-size:8pt;font-weight:800;text-align:right}
.pair-bars{display:grid;gap:2px}
.pair-row{display:flex;align-items:center;gap:.06in}
.pair-fill{height:.13in;border-radius:3px;min-width:2px}
.pair-fill.a{background:var(--data1)}
.pair-fill.b{background:var(--data2)}
.pair-lab{color:#33454f;font-size:7.3pt;white-space:nowrap}
.legend{display:flex;gap:.22in;align-items:center;margin:.06in 0 .02in}
.legend i{display:inline-block;width:.13in;height:.13in;border-radius:3px;margin-right:.05in;vertical-align:-.02in}
.legend span{color:#33454f;font-size:7.4pt}
.status{display:flex;align-items:center;gap:.09in;border-radius:7px;padding:.09in .13in;font-weight:800;font-size:9pt}
.status.bad{background:#faeeee;border:1px solid #e7c6c6;color:#8f3a3a}
.status.good{background:#ecf5f1;border:1px solid #cbe2d8;color:#1d6a58}
.status .dot{width:.14in;height:.14in;border-radius:50%;flex:none}
.status.bad .dot{background:var(--red)}
.status.good .dot{background:var(--good)}
.cover{background:#fff;color:var(--ink);display:grid;grid-template-rows:auto 1fr auto;position:relative;overflow:hidden;border-top:.09in solid var(--teal)}
.cover:before{content:"";position:absolute;right:-1.6in;top:-1.9in;width:5.2in;height:5.2in;border-radius:50%;border:.55in solid rgba(39,166,154,.07)}
.cover:after{content:"";position:absolute;left:-1.2in;bottom:-2.2in;width:4.4in;height:4.4in;border-radius:50%;border:.4in solid rgba(39,166,154,.05)}
.cover-top{padding:.5in .7in 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
.cover-mid{padding:0 .7in;position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center}
.cover-tag{display:inline-block;background:rgba(39,166,154,.09);border:1px solid rgba(39,166,154,.35);color:#1d7d72;font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border-radius:999px;padding:.05in .16in;margin-bottom:.22in;width:fit-content}
.cover h1{font-size:33pt;line-height:1.05;letter-spacing:-.03em;font-weight:700;max-width:6.4in;color:var(--navy)}
.cover h1 .thin{color:var(--teal);font-weight:400}
.cover-sub{margin-top:.18in;color:#44545f;font-size:10.5pt;line-height:1.45;max-width:5.6in}
.cover-muni{margin-top:.42in}
.cover-muni em{display:block;font-style:normal;color:var(--muted);font-size:7.4pt;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.cover-muni b{display:block;color:var(--navy);font-size:19pt;letter-spacing:-.02em;margin-top:.05in}
.cover-kpis{display:grid;grid-template-columns:1fr 1fr;gap:.14in;margin-top:.34in;max-width:5.4in}
.ckpi{background:#f7fafa;border:1px solid var(--line);border-left:.04in solid var(--teal);border-radius:7px;padding:.12in .14in}
.ckpi em{display:block;font-style:normal;color:var(--muted);font-size:6.6pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.ckpi b{display:block;color:var(--navy);font-size:15pt;letter-spacing:-.02em;margin-top:.04in;line-height:1}
.ckpi span{display:block;color:var(--muted);font-size:6.8pt;margin-top:.03in}
.cover-bot{padding:0 .7in .5in;display:flex;justify-content:space-between;align-items:end;position:relative;z-index:1;color:var(--muted);font-size:7.6pt;line-height:1.4}
.cover-bot b{display:block;color:var(--navy);font-size:8.4pt}
.conf{display:inline-block;border:1px solid #e2c084;color:#a66a10;background:#fdf9ee;border-radius:4px;padding:.03in .09in;font-size:6.8pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
`;

// ── Páginas ─────────────────────────────────────────────────────────────────

function paginaCapa(i: LevantamentoTemplateInput): string {
  const { relatorio: r, logoDataUri } = i;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const exercicio = id.exercicio;
  const responsavel = r.parametros?.responsavelTecnico ?? "Adriel Tavares";

  const marca = logoDataUri
    ? `<img src="${logoDataUri}" alt="" style="width:.42in;height:.42in;border-radius:8px">`
    : "";

  return `<section class="page cover">
  <div class="cover-top">
    <div style="display:flex;align-items:center;gap:.13in">
      ${marca}
      <div>
        <div style="font-size:15pt;font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--navy)">Global Sync</div>
        <div style="margin-top:.04in;font-size:7.2pt;color:var(--muted)">Global Company Consultorias</div>
      </div>
    </div>
    <span class="conf">Documento confidencial</span>
  </div>

  <div class="cover-mid">
    <span class="cover-tag">Análise corporativa FUNDEB &middot; exercício ${exercicio}</span>
    <h1>Diagnóstico<br>e análise corporativa<br><span class="thin">do FUNDEB</span></h1>
    <p class="cover-sub">Leitura executiva, financeira e comparativa da rede municipal de ensino,
    com base oficial FNDE, INEP, IBGE e SICONFI consolidada no Global Sync.</p>

    <div class="cover-muni">
      <em>Município analisado</em>
      <b>${esc(municipio)}</b>
    </div>

    <div class="cover-kpis">
      <div class="ckpi"><em>Receita FUNDEB ${exercicio}</em><b>${brlCompact(r.receitas.totalReceitas)}</b><span>base oficial do exercício</span></div>
      <div class="ckpi"><em>Estimativa ${exercicio + 1} &middot; cenário otimizado</em><b>${brlCompact(r.projecao.totalProjetado)}</b><span>condicionada à validação documental</span></div>
    </div>
  </div>

  <div class="cover-bot">
    <div>
      <b>${esc(responsavel)} &middot; Responsável Técnico</b>
      Global Company Consultorias
    </div>
    <div style="text-align:right">
      <b>Emitido em ${dataCurta(r.geradoEm)}</b>
      Exercício de análise: ${exercicio}
    </div>
  </div>
</section>`;
}

function paginaSumario(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const rec = r.receitas;
  const perfil = r.perfilComercial;
  const total = rec.totalReceitas;

  const composicao = barras([
    { nome: "Contribuição municipal", valor: rec.receitaContribuicaoMunicipal, rotulo: pct(share(rec.receitaContribuicaoMunicipal, total)) },
    { nome: "União · VAAF", valor: rec.complementacaoVAAF, rotulo: pct(share(rec.complementacaoVAAF, total)) },
    { nome: "União · VAAT", valor: rec.complementacaoVAAT, rotulo: pct(share(rec.complementacaoVAAT, total)) },
    { nome: "União · VAAR", valor: rec.complementacaoVAAR, rotulo: pct(share(rec.complementacaoVAAR, total)), vermelho: rec.complementacaoVAAR <= 0 },
  ]);

  const vaarZerado = rec.complementacaoVAAR <= 0;

  return `<section class="page content-page">
  ${cabecalho(municipio, "Sumário executivo")}
  <div class="page-body">
    <div class="kicker">Sumário executivo</div>
    <h2>O que os números dizem &mdash;<br>e onde está a alavanca</h2>

    <p class="lede">Gestor municipal de ${esc(municipio)}: ${ou(id.prefeito, "gestor não identificado na base")}.
    Este relatório organiza a leitura do FUNDEB de ${id.exercicio} em linguagem direta: quanto o município
    recebeu, qual a estimativa para o próximo ciclo e o que precisa ser conferido nas bases oficiais
    antes de qualquer decisão.</p>

    <div class="grid-4 mt-2">
      ${kpi(`Receita ${id.exercicio}`, brlCompact(rec.totalReceitas), "base oficial do ano")}
      ${kpi(`Estimativa ${id.exercicio + 1}`, brlCompact(r.projecao.totalProjetado), "cenário otimizado")}
      ${kpi("Ganho potencial", `+${brlCompact(r.projecao.totalGanho)}`, `+${pct(r.projecao.ganhoPercentual)} sobre a base`, "up")}
      ${kpi("Já evidenciado", `+${brlCompact(r.projecaoRecuperavel.totalGanho)}`, `+${pct(r.projecaoRecuperavel.ganhoPercentual)} nas bases atuais`, "up")}
    </div>

    <div class="grid-2 mt-2">
      <div class="card">
        <h3>Leitura executiva</h3>
        <p style="font-size:8.2pt;line-height:1.45;color:#33454f">
        &bull; Gestor identificado na base atual: <span class="strong">${ou(id.prefeito)}${id.partido && id.partido !== "Nao informado" ? ` (${esc(id.partido)})` : ""}</span>.<br>
        &bull; Habilitação VAAT: <span class="strong">${ou(perfil?.habilitacaoVaat, "não informada")}</span> para o cálculo do exercício.<br>
        &bull; VAAR atual: <span class="strong">R$ ${brl(rec.complementacaoVAAR)}</span>${vaarZerado ? " &mdash; o município não captura a complementação de resultado." : "."}<br>
        &bull; Vetores de trabalho: condicionalidades de desempenho e regularidade informacional para VAAR.</p>
      </div>
      <div class="card">
        <h3>Composição da receita ${id.exercicio}</h3>
        ${composicao}
        <p class="micro" style="margin-top:.05in">Total: R$ ${brl(total)} &middot; ${esc(id.fonte)}</p>
      </div>
    </div>

    <div class="insight mt-2">
      <h3>A alavanca em uma frase</h3>
      <p style="font-size:8.6pt;line-height:1.42">${pct(share(rec.receitaContribuicaoMunicipal, total), 0)} da receita vem da contribuição do
      próprio município${vaarZerado ? ' &mdash; e a fatia que premia resultado (VAAR) está <span class="strong">zerada</span>' : ""}.
      Recuperar matrícula perdida no Censo, habilitar o VAAR e expandir EJA e tempo integral são os três
      movimentos que separam a base atual do cenário otimizado.</p>
    </div>

    <div class="note mt-1">
      <p style="font-size:7.8pt;line-height:1.38"><span class="strong" style="color:#584416">Nota de método:</span>
      a estimativa ${id.exercicio + 1} usa benchmark comercial Global Company${
        perfil ? ` (cenário ${esc(perfil.faixa)}, score ${perfil.score.toFixed(2)})` : ""
      } e inclui potencial prospectivo de VAAR condicionado a condicionalidades e desempenho. Os valores projetados têm caráter
      estimativo e dependem de validação documental nas bases oficiais FUNDEB e MEC/FNDE.</p>
    </div>

    <div class="sec-label" style="margin-top:.22in">Como este relatório está organizado</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.1in">
      ${[
        ["I", "Receita e projeção", `composição ${id.exercicio} e cenário ${id.exercicio + 1}`],
        ["II", "Série histórica", "evolução por exercício"],
        ["III", "Rede e qualidade", "Censo, IDEB e infraestrutura"],
        ["IV", "Fiscal e sistemas", "LRF e situação MEC/FNDE"],
        ["V", `Cenário ${id.exercicio + 1}`, "frentes e faixa de ganho"],
      ]
        .map(
          ([n, t, s]) => `<div class="card" style="padding:.1in .11in"><b style="color:var(--teal);font-size:9pt">${n}</b>
        <p style="font-size:7.4pt;line-height:1.3;color:#33454f;margin-top:.03in"><b style="color:var(--navy)">${t}</b><br>${s}</p></div>`,
        )
        .join("")}
    </div>
  </div>
  ${rodape(2)}
</section>`;
}

function paginaReceita(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const rec = r.receitas;
  const total = rec.totalReceitas;
  const demo = i.payload?.demografia;
  const fiscal = i.payload?.fiscal;
  const populacao = num(demo?.populacao);
  const perfil = r.perfilComercial;

  const linhas: Array<[string, number, boolean]> = [
    ["Contribuição do município", rec.receitaContribuicaoMunicipal, false],
    ["Complementação da União — VAAF", rec.complementacaoVAAF, false],
    ["Complementação da União — VAAT", rec.complementacaoVAAT, false],
    ["Complementação da União — VAAR", rec.complementacaoVAAR, rec.complementacaoVAAR <= 0],
  ];

  return `<section class="page content-page">
  ${cabecalho(municipio, `Parte I · Receita ${id.exercicio}`)}
  <div class="page-body">
    <div class="kicker">Parte I &middot; Receita e identificação</div>

    <div class="sec-label">Composição das receitas do FUNDEB &mdash; exercício ${id.exercicio}</div>
    <table class="tb">
      <tr><th>Componente da receita</th><th class="r">Valor estimado (R$)</th><th class="r">Participação</th></tr>
      ${linhas
        .map(
          ([rotulo, valor, alerta]) => `<tr><td>${rotulo}</td><td class="r">${
            alerta ? `<b style="color:var(--red)">${brl(valor)}</b>` : brl(valor)
          }</td><td class="r">${pct(share(valor, total))}</td></tr>`,
        )
        .join("")}
      <tr class="total"><td>Total de receitas</td><td class="r">${brl(total)}</td><td class="r">100,0%</td></tr>
    </table>
    ${
      rec.complementacaoVAAR <= 0
        ? `<p class="small mt-1">O município não captura hoje a complementação VAAR (vinculada a
    resultados). A ausência pode estar ligada às condições de habilitação junto ao
    FNDE &mdash; recomenda-se análise dos requisitos de acesso.</p>`
        : ""
    }

    <div class="divider"></div>

    <div class="grid-2">
      <div>
        <div class="sec-label">Identificação do ente</div>
        <table class="tb">
          <tr><td>Município</td><td class="r"><b>${esc(municipio)}</b></td></tr>
          <tr><td>Código IBGE</td><td class="r">${esc(id.codigoIBGE)}</td></tr>
          <tr><td>Gestor municipal</td><td class="r">${ou(id.prefeito)}${id.partido && id.partido !== "Nao informado" ? ` (${esc(id.partido)})` : ""}</td></tr>
          <tr><td>Mesorregião</td><td class="r">${ou(id.mesorregiao)}</td></tr>
          <tr><td>Microrregião</td><td class="r">${ou(id.microrregiao)}</td></tr>
          <tr><td>Base legal</td><td class="r">Lei nº 14.113/2020 (Novo FUNDEB)</td></tr>
          <tr><td>Fonte primária</td><td class="r">${esc(id.fonte)}</td></tr>
        </table>
      </div>
      <div>
        <div class="sec-label">Perfil IBGE</div>
        <div class="grid-2" style="gap:.1in">
          ${kpi("População", populacao > 0 ? int(populacao) : "—", `estimativa ${ou(demo?.populacao_ano_referencia, "—")}`)}
          ${kpi("PIB per capita", num(fiscal?.pib_per_capita) > 0 ? `R$ ${int(fiscal?.pib_per_capita)}` : "—", "IBGE Cidades")}
          ${kpi("Receita corrente líquida", num(fiscal?.receita_total) > 0 ? brlCompact(fiscal?.receita_total) : "—", "SICONFI")}
          ${kpi("Matrículas municipais", int(r.censoEscolar?.totalMatriculas), "Censo Escolar INEP")}
        </div>
        ${kpi(
          "FUNDEB per capita",
          populacao > 0 ? `R$ ${brl(total / populacao)}` : "—",
          `receita ${id.exercicio} &divide; população${perfil ? ` &middot; score de potencial ${perfil.score.toFixed(2)}` : ""}`,
          "mt-1",
        )}
      </div>
    </div>
  </div>
  ${rodape(3)}
</section>`;
}

function paginaProjecao(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const p = r.projecao;
  const rc = r.projecaoRecuperavel;
  const perfil = r.perfilComercial;

  const maiorPar = Math.max(p.vaafProjetado, p.vaatProjetado, p.vaarProjetado, p.vaafAtual, p.vaatAtual, p.vaarAtual, 1);
  const par = (nome: string, atual: number, projetado: number) => `<div class="pair">
        <div class="pair-name">${nome}</div>
        <div class="pair-bars">
          <div class="pair-row"><div class="pair-fill a" style="width:${barWidth(atual, maiorPar)}"></div><span class="pair-lab">${brlCompact(atual)}</span></div>
          <div class="pair-row"><div class="pair-fill b" style="width:${barWidth(projetado, maiorPar)}"></div><span class="pair-lab"><b style="color:var(--navy)">${brlCompact(projetado)}</b></span></div>
        </div>
      </div>`;

  const crono = r.cronogramaVAAF ?? [];
  const metade = Math.ceil(crono.length / 2);
  const tabelaCrono = (fatia: typeof crono) => `<table class="tb">
        <tr><th>Mês</th><th class="r">Valor projetado (R$)</th><th class="r">Part.</th></tr>
        ${fatia
          .map(
            (m) => `<tr><td>${esc(m.mes)}</td><td class="r">${brl(m.valorProjetado)}</td><td class="r">${pct(m.percentual * (m.percentual <= 1 ? 100 : 1))}</td></tr>`,
          )
          .join("")}
      </table>`;

  return `<section class="page content-page">
  ${cabecalho(municipio, `Parte I · Projeção ${id.exercicio + 1}`)}
  <div class="page-body">
    <div class="kicker">Parte I &middot; Estimativa para o próximo ciclo</div>

    <div class="sec-label">Complementações da União &mdash; atual vs. projetado</div>
    <div class="card">
      <div class="legend"><span><i style="background:var(--data1)"></i>Cenário atual</span><span><i style="background:var(--data2)"></i>Cenário projetado ${id.exercicio + 1}</span></div>
      ${par("VAAF", p.vaafAtual, p.vaafProjetado)}
      ${par("VAAT", p.vaatAtual, p.vaatProjetado)}
      ${par("VAAR", p.vaarAtual, p.vaarProjetado)}
    </div>

    <div class="mt-1">
      <table class="tb">
        <tr><th>Componente</th><th class="r">Cenário atual</th><th class="r">Projetado</th><th class="r">Variação</th></tr>
        <tr><td>VAAF (Valor Aluno Fundo)</td><td class="r">${brl(p.vaafAtual)}</td><td class="r">${brl(p.vaafProjetado)}</td><td class="r">+${brl(p.vaafGanho)}</td></tr>
        <tr><td>VAAT (Valor Aluno Total)</td><td class="r">${brl(p.vaatAtual)}</td><td class="r">${brl(p.vaatProjetado)}</td><td class="r">+${brl(p.vaatGanho)}</td></tr>
        <tr><td>VAAR (Vinculado a Resultados)</td><td class="r">${brl(p.vaarAtual)}</td><td class="r">${brl(p.vaarProjetado)}</td><td class="r">+${brl(p.vaarGanho)}</td></tr>
        <tr class="total"><td>Receita total</td><td class="r">${brl(p.totalAtual)}</td><td class="r">${brl(p.totalProjetado)}</td><td class="r">+${brl(p.totalGanho)}</td></tr>
      </table>
    </div>

    <div class="grid-2 mt-2">
      <div class="kpi hero"><em>Receita total projetada &middot; cenário otimizado</em><b>${brlCompact(p.totalProjetado)}</b><span>potencial de incremento: +${brlCompact(p.totalGanho)} (+${pct(p.ganhoPercentual)})</span></div>
      <div class="kpi up"><em>Camada recuperável já evidenciada</em><b>+${brlCompact(rc.totalGanho)}</b><span>+${pct(rc.ganhoPercentual)} sinalizado nas bases oficiais atuais</span></div>
    </div>

    <div class="note mt-2">
      <p style="font-size:7.9pt;line-height:1.4">A estimativa mostra uma leitura possível do próximo ciclo a
      partir da receita atual, do histórico e dos pontos de conferência do FUNDEB &mdash; ela <b>não
      substitui a validação nas bases oficiais</b>.${
        perfil ? ` Referência: benchmark comercial Global Company (${esc(perfil.faixa)}), score ${perfil.score.toFixed(2)}, com potencial prospectivo de VAAR condicionado a condicionalidades e desempenho.` : ""
      }</p>
    </div>

    ${
      crono.length
        ? `<div class="sec-label" style="margin-top:.2in">Cronograma mensal projetado do incremento</div>
    <div class="grid-2">
      ${tabelaCrono(crono.slice(0, metade))}
      ${tabelaCrono(crono.slice(metade))}
    </div>
    <p class="micro mt-1">Rampa mensal do potencial de incremento anual (R$ ${brl(p.totalGanho)}), crescente conforme
    a maturação das frentes de trabalho ao longo do exercício.</p>`
        : ""
    }
  </div>
  ${rodape(4)}
</section>`;
}

interface AnoSerie {
  ano: number;
  total: number;
  contribuicao: number;
  complementacao: number;
}

function serieHistorica(i: LevantamentoTemplateInput): AnoSerie[] {
  const bruto = i.payload?.fiscal?.historico_repasses ?? [];
  return bruto
    .map((linha) => {
      // Nomes conforme `payload.fiscal.historico_repasses` (govia-compat):
      // `receita_total_prevista` / `contribuicao_estados_municipios`.
      const contribuicao = num(
        linha.contribuicao_estados_municipios ?? linha.contribuicaoEstadosMunicipios ?? linha.contribuicao_municipal,
      );
      const vaaf = num(linha.complementacao_vaaf ?? linha.complementacaoVAAF);
      const vaat = num(linha.complementacao_vaat ?? linha.complementacaoVAAT);
      const vaar = num(linha.complementacao_vaar ?? linha.complementacaoVAAR);
      const complementacao = vaaf + vaat + vaar;
      // Exercício antigo às vezes vem sem o agregado; somar as partes evita
      // descartar o ano inteiro por causa de um campo ausente.
      const total = num(linha.receita_total_prevista ?? linha.receitaTotalPrevista) || contribuicao + complementacao;
      return { ano: num(linha.ano), total, contribuicao, complementacao };
    })
    .filter((a) => a.ano > 0 && a.total > 0)
    .sort((a, b) => a.ano - b.ano);
}

function paginaSerie(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const serie = serieHistorica(i);

  if (!serie.length) {
    return `<section class="page content-page">
  ${cabecalho(municipio, "Parte II · Série histórica")}
  <div class="page-body">
    <div class="kicker">Parte II &middot; Comparativo por ano</div>
    <h2>Série histórica<br>indisponível</h2>
    <p class="lede">As bases oficiais não retornaram série de repasses para este município no momento da
    emissão. A leitura por exercício será incorporada assim que o histórico do FNDE estiver acessível.</p>
  </div>
  ${rodape(5)}
</section>`;
  }

  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  const variacaoTotal = primeiro.total > 0 ? ((ultimo.total - primeiro.total) / primeiro.total) * 100 : 0;
  const maiorTotal = Math.max(...serie.map((a) => a.total));

  return `<section class="page content-page">
  ${cabecalho(municipio, `Parte II · Série ${primeiro.ano}–${ultimo.ano}`)}
  <div class="page-body">
    <div class="kicker">Parte II &middot; Comparativo por ano</div>

    <div class="grid-3">
      ${kpi(`Receita ${primeiro.ano} → ${ultimo.ano}`, `+${brlCompact(ultimo.total - primeiro.total)}`, `de ${brlCompact(primeiro.total)} para ${brlCompact(ultimo.total)} (+${pct(variacaoTotal)})`, "up")}
      ${kpi("Matrículas municipais", int(r.censoEscolar?.totalMatriculas), `Censo ${ou(r.censoEscolar?.anoReferencia, "—")}`)}
      ${kpi("Unidades escolares", int(r.censoEscolar?.totalEscolas), "rede municipal")}
    </div>

    <div class="card mt-2">
      <h3>Receita FUNDEB por exercício (R$ milhões)</h3>
      <div class="vchart">
        ${serie
          .map(
            (a, idx) => `<div class="vbar"><span class="vbar-val">${(a.total / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span><div class="vbar-fill${
              idx === serie.length - 1 ? " now" : ""
            }" style="height:${((a.total / maiorTotal) * 92).toFixed(0)}%"></div></div>`,
          )
          .join("")}
      </div>
      <div class="vxlab">${serie.map((a, idx) => `<span>${a.ano}${idx === serie.length - 1 ? " &middot; atual" : ""}</span>`).join("")}</div>
    </div>

    <div class="sec-label">Série oficial da receita</div>
    <table class="tb">
      <tr><th>Ano</th><th class="r">Receita total</th><th class="r">Contribuição municipal</th><th class="r">Compl. União</th><th class="r">Variação</th></tr>
      ${serie
        .map((a, idx) => {
          const anterior = idx > 0 ? serie[idx - 1].total : 0;
          const variacao = idx === 0 || anterior <= 0 ? "base" : `${a.total >= anterior ? "+" : ""}${pct(((a.total - anterior) / anterior) * 100)}`;
          return `<tr><td><b>${a.ano}</b></td><td class="r">${brl(a.total)}</td><td class="r">${brl(a.contribuicao)}</td><td class="r">${brl(a.complementacao)}</td><td class="r">${variacao}</td></tr>`;
        })
        .join("")}
    </table>

    <div class="insight mt-1">
      <p style="font-size:8.2pt;line-height:1.4"><span class="strong">O que a série mostra:</span> a receita
      variou ${pct(variacaoTotal)} entre ${primeiro.ano} e ${ultimo.ano}. Crescimento que vem de correção de valor por aluno
      e complementações &mdash; e não de rede &mdash; perde força a cada Censo sem recomposição de matrícula.</p>
    </div>
  </div>
  ${rodape(5)}
</section>`;
}

function paginaRede(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const censo = r.censoEscolar;
  const etapa = censo?.matriculasEtapa;
  const edu = (i.payload?.educacao ?? {}) as Record<string, unknown>;
  const matriculas = num(censo?.totalMatriculas);
  const recursoAluno = matriculas > 0 ? r.receitas.totalReceitas / matriculas : 0;

  const porEtapa = barras([
    { nome: "Ensino Fundamental", valor: num(etapa?.ensinoFundamental), rotulo: int(etapa?.ensinoFundamental) },
    { nome: "Educação Infantil", valor: num(etapa?.educacaoInfantil), rotulo: int(etapa?.educacaoInfantil) },
    { nome: "Educação Especial", valor: num(etapa?.educacaoEspecial), rotulo: int(etapa?.educacaoEspecial) },
    { nome: "EJA", valor: num(etapa?.eja), rotulo: int(etapa?.eja) },
  ]);

  const integralTotal = num(edu.matriculas_tempo_integral);
  const coberturaIntegral = barras([
    { nome: "Creche", valor: num(edu.matriculas_creche), rotulo: int(edu.matriculas_creche), tom2: true },
    { nome: "Pré-escola", valor: num(edu.matriculas_pre_escola), rotulo: int(edu.matriculas_pre_escola), tom2: true },
    { nome: "Fund. anos iniciais", valor: num(edu.matriculas_fundamental_ai), rotulo: int(edu.matriculas_fundamental_ai), tom2: true },
    { nome: "Fund. anos finais", valor: num(edu.matriculas_fundamental_af), rotulo: int(edu.matriculas_fundamental_af), tom2: true },
    { nome: "Tempo integral", valor: integralTotal, rotulo: int(integralTotal), tom2: true },
  ]);

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte III · Rede e Censo")}
  <div class="page-body">
    <div class="kicker">Parte III &middot; A rede municipal em números</div>

    <div class="grid-4">
      ${kpi("Unidades escolares", int(censo?.totalEscolas), "rede municipal")}
      ${kpi("Matrículas municipais", int(matriculas), `Censo ${ou(censo?.anoReferencia ?? edu.censo_ano, "—")}`)}
      ${kpi("Docentes", num(censo?.totalDocentes) > 0 ? int(censo?.totalDocentes) : "—", "rede municipal")}
      ${kpi("Recurso por aluno", recursoAluno > 0 ? `R$ ${brl(recursoAluno)}` : "—", "receita &divide; matrículas", "up")}
    </div>

    <div class="grid-2 mt-2">
      <div class="card">
        <h3>Matrículas por etapa &middot; rede municipal</h3>
        ${porEtapa}
        <p class="micro" style="margin-top:.05in">Detalhe: creche ${int(edu.matriculas_creche)} &middot; pré-escola ${int(edu.matriculas_pre_escola)} &middot;
        anos iniciais ${int(edu.matriculas_fundamental_ai)} &middot; anos finais ${int(edu.matriculas_fundamental_af)}.
        Ensino Médio (${int(edu.matriculas_ensino_medio_total)}) é rede estadual/federal e não compõe o FUNDEB municipal.</p>
      </div>
      <div class="card">
        <h3>Distribuição da rede por segmento</h3>
        ${coberturaIntegral}
        <p class="micro" style="margin-top:.05in">Jornada ampliada: ${int(integralTotal)} de ${int(matriculas)} matrículas
        (${pct(share(integralTotal, matriculas))}).</p>
      </div>
    </div>

    <div class="sec-label">Leitura do valor por aluno</div>
    <div class="grid-3">
      ${kpi("Recurso real por aluno", recursoAluno > 0 ? `R$ ${brl(recursoAluno)}` : "—", "receita FUNDEB &divide; matrículas")}
      ${kpi("Matrículas em EJA", int(etapa?.eja), "modalidade com expansão possível")}
      ${kpi("Educação especial", int(etapa?.educacaoEspecial), "maior ponderação no fundo", "up")}
    </div>
    <p class="small mt-1">Cada matrícula migrada para jornada integral vale mais no fundo &mdash; é o elo
    entre esta página e o cenário de estruturação da Parte V.</p>
  </div>
  ${rodape(6)}
</section>`;
}

function paginaIdeb(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const edu = (i.payload?.educacao ?? {}) as Record<string, unknown>;
  const infra = (edu.infraestrutura_rede_publica ?? {}) as Record<string, unknown>;

  /** Último ponto com IDEB verificado da série. */
  const ultimoVerificado = (serie: typeof r.idebAnosIniciais) => {
    const comDado = (serie ?? []).filter((d) => d.idebVerificado != null);
    return comDado.length ? comDado[comDado.length - 1] : null;
  };

  const cartaoIdeb = (titulo: string, dado: IDEBDado | null) => {
    if (!dado) {
      return `<div class="card" style="border-left:.045in solid var(--line)">
        <em style="font-style:normal;color:var(--muted);font-size:6.8pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase">${titulo}</em>
        <div style="margin-top:.04in"><b style="color:var(--muted);font-size:21pt">—</b></div>
        <p class="micro" style="margin-top:.04in">Sem IDEB verificado nas bases consultadas.</p>
      </div>`;
    }
    const observado = num(dado.idebVerificado);
    const meta = num(dado.metaProjetada);
    const gap = observado - meta;
    const abaixo = meta > 0 && gap < 0;
    return `<div class="card" style="border-left:.045in solid var(--${abaixo ? "gold" : "teal"})">
      <em style="font-style:normal;color:var(--muted);font-size:6.8pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase">${titulo}</em>
      <div style="display:flex;align-items:baseline;gap:.12in;margin-top:.04in">
        <b style="color:var(--navy);font-size:21pt;letter-spacing:-.02em">${observado.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
        ${
          meta > 0
            ? `<span style="color:${abaixo ? "#8f6a1d" : "#1d6a58"};font-size:8pt;font-weight:800">${
                abaixo ? "&#9888; " : ""
              }${gap >= 0 ? "+" : "&minus;"}${Math.abs(gap).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${
                abaixo ? "abaixo" : "acima"
              } da meta (${meta.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })})</span>`
            : ""
        }
      </div>
      <p class="micro" style="margin-top:.04in">Referência ${dado.ano} &middot; rede municipal</p>
    </div>`;
  };

  const totalAvaliadas = num(infra.total_escolas_publicas_avaliadas);
  const infraTodos: Array<[string, unknown]> = [
    ["Água potável", infra.escolas_com_agua_potavel],
    ["Cozinha/refeitório", infra.escolas_com_cozinha],
    ["Internet", infra.escolas_com_internet],
    ["Banda larga", infra.escolas_com_banda_larga],
    ["Acessibilidade", infra.escolas_com_acessibilidade],
    ["Esgoto sanitário", infra.escolas_com_esgoto],
    ["Quadra esportiva", infra.escolas_com_quadra],
    ["Lab. informática", infra.escolas_com_lab_informatica],
    ["Lab. ciências", infra.escolas_com_lab_ciencias],
  ];
  // Item sem leitura no Censo sai da barra — 0% inventado mentiria sobre a rede.
  const infraItens = infraTodos.filter(([, v]) => v != null);

  const metade = Math.ceil(infraItens.length / 2);
  const colunaInfra = (fatia: typeof infraItens) =>
    `<div class="card">${barras(
      fatia.map(([nome, v]) => ({
        nome,
        valor: share(v, totalAvaliadas),
        rotulo: pct(share(v, totalAvaliadas)),
      })),
    )}</div>`;

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte III · IDEB e infraestrutura")}
  <div class="page-body">
    <div class="kicker">Parte III &middot; Qualidade e infraestrutura</div>

    <div class="sec-label">IDEB &mdash; rede municipal</div>
    <div class="grid-2">
      ${cartaoIdeb("Anos iniciais", ultimoVerificado(r.idebAnosIniciais))}
      ${cartaoIdeb("Anos finais", ultimoVerificado(r.idebAnosFinais))}
    </div>
    <p class="small mt-1">O IDEB abaixo da meta pesa duas vezes: na aprendizagem e no acesso ao VAAR, cuja
    condicionalidade de desempenho premia evolução de indicador. Ensino Médio (rede estadual) é
    informativo e não compõe o FUNDEB municipal.</p>

    <div class="divider"></div>

    ${(() => {
      // Distorção e abandono vêm do INEP (TDI e taxas de rendimento 2023). Antes
      // caíam para zero quando a fonte não respondia, o que afirmava "nenhum
      // aluno atrasado" — o oposto do real na maioria das redes rurais.
      const dTotal = num(edu.distorcao_idade_serie_total);
      const dInic = num(edu.distorcao_idade_serie_anos_iniciais);
      const dFin = num(edu.distorcao_idade_serie_anos_finais);
      const abandono = num(edu.taxa_abandono);
      const reprovacao = num(edu.taxa_reprovacao);
      if (dTotal === 0 && dInic === 0 && dFin === 0 && abandono === 0 && reprovacao === 0) {
        return `<div class="sec-label">Fluxo escolar</div>
    <p class="small">O INEP não publicou distorção idade-série nem taxas de rendimento para esta rede.</p>`;
      }
      const chip = (rotulo: string, valor: number, alerta: number) =>
        `<div class="card" style="padding:.09in .11in"><div class="micro" style="text-transform:uppercase;letter-spacing:.08em">${rotulo}</div>
        <div style="font-size:15pt;font-weight:800;color:${valor >= alerta ? "var(--gold)" : "var(--teal)"};line-height:1.1">${valor ? pct(valor) : "N/D"}</div></div>`;
      return `<div class="sec-label">Fluxo escolar &mdash; distorção idade-série e rendimento</div>
    <div class="grid-4" style="gap:.09in">
      ${chip("Distorção total", dTotal, 20)}
      ${chip("Anos iniciais", dInic, 15)}
      ${chip("Anos finais", dFin, 25)}
      ${chip("Abandono", abandono, 3)}
    </div>
    <p class="small mt-1">Distorção idade-série é matrícula que já está na rede e não avança. Cada aluno
    retido consome vaga sem gerar progressão, e a concentração nos anos finais antecipa a evasão que
    esvazia o Censo do ano seguinte &mdash; e com ele a receita do FUNDEB.</p>`;
    })()}

    <div class="divider"></div>

    ${
      infraItens.length && totalAvaliadas > 0
        ? `<div class="sec-label">Infraestrutura da rede pública &mdash; ${int(totalAvaliadas)} escolas avaliadas</div>
    <div class="grid-2">
      ${colunaInfra(infraItens.slice(0, metade))}
      ${colunaInfra(infraItens.slice(metade))}
    </div>

    <div class="insight mt-1">
      <p style="font-size:8.2pt;line-height:1.4"><span class="strong">Onde a infraestrutura trava a receita:</span>
      esgoto, quadra e laboratórios são exatamente os itens que limitam a expansão de tempo integral &mdash; a
      modalidade com maior valor por aluno na tabela oficial. Investimento dirigido nesses itens habilita a
      migração de matrícula para faixas mais valorizadas.</p>
    </div>`
        : `<div class="sec-label">Infraestrutura da rede pública</div>
    <p class="small">O Censo Escolar não retornou o detalhamento de infraestrutura para esta rede no momento da emissão.</p>`
    }
  </div>
  ${rodape(7)}
</section>`;
}

function paginaFiscal(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const fiscal = i.payload?.fiscal;
  const rcl = num(fiscal?.receita_total);
  const pessoal = num(fiscal?.despesa_pessoal);
  const percentual = rcl > 0 ? (pessoal / rcl) * 100 : 0;
  const situacao = String(fiscal?.situacao_lrf ?? "");
  const acima = /acima/i.test(situacao);
  const pdde = r.pdde ?? [];
  const totalPdde = pdde.reduce((s, p) => s + num(p.valor), 0);

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte IV · Fiscal e sistemas")}
  <div class="page-body">
    <div class="kicker">Parte IV &middot; Saúde fiscal e situação operacional</div>

    ${
      situacao
        ? `<div class="status ${acima ? "bad" : "good"}"><span class="dot"></span> Status LRF: ${esc(situacao)}${
            rcl > 0 ? ` (${pct(percentual, 2)} da RCL)` : ""
          }</div>`
        : `<div class="status good"><span class="dot"></span> Status LRF: sem pendência registrada nas bases consultadas</div>`
    }

    <div class="grid-2 mt-1">
      <div>
        <table class="tb">
          <tr><th>Indicador fiscal &middot; SICONFI</th><th class="r">Valor</th></tr>
          <tr><td>Receita Corrente Líquida (RCL)</td><td class="r">${rcl > 0 ? `R$ ${brl(rcl)}` : "—"}</td></tr>
          <tr><td>Despesa com pessoal</td><td class="r">${pessoal > 0 ? `R$ ${brl(pessoal)}` : "—"}</td></tr>
          <tr><td>% pessoal / RCL</td><td class="r">${
            rcl > 0 ? `<b style="color:var(--${acima ? "red" : "good"})">${pct(percentual, 2)}</b>` : "—"
          }</td></tr>
          <tr><td>Limite máximo &middot; prudencial</td><td class="r">54,00% &middot; 51,30%</td></tr>
          <tr><td>Espaço fiscal</td><td class="r">${
            rcl > 0
              ? `<b style="color:var(--${percentual > 54 ? "red" : "good"})">${percentual > 54 ? "&minus;" : "+"}${pct(Math.abs(54 - percentual), 2)}</b>`
              : "—"
          }</td></tr>
          <tr><td>PIB per capita</td><td class="r">${num(fiscal?.pib_per_capita) > 0 ? `R$ ${brl(fiscal?.pib_per_capita)}` : "—"}</td></tr>
        </table>
      </div>
      <div>
        <div class="card">
          <h3>Por que isso importa para o FUNDEB</h3>
          <p style="font-size:8.2pt;line-height:1.42;color:#33454f">Acima do limite da LRF, o município perde
          liberdade para expandir folha &mdash; e 70% do FUNDEB é justamente remuneração.
          Aumentar a <span class="strong">receita do fundo</span> (Censo íntegro, VAAR, matrículas de maior
          ponderação) é o caminho que amplia a capacidade de pagamento da educação sem
          pressionar a RCL: receita nova do FUNDEB financia a folha da rede dentro da própria vinculação.</p>
        </div>
        ${
          totalPdde > 0
            ? kpi("Repasses PDDE", `R$ ${brl(totalPdde)}`, `${pdde.length} registro(s) no PDDE Info`, "mt-1")
            : ""
        }
      </div>
    </div>

    <div class="sec-label">Sistemas MEC/FNDE &mdash; situação cadastral</div>
    <table class="tb">
      <tr><th>Sistema</th><th>Situação observada</th></tr>
      ${(r.sistemas ?? [])
        .map((s) => `<tr><td><b>${esc(s.sistema)}</b>${s.instituicao ? ` (${esc(s.instituicao)})` : ""}</td><td>${esc(s.situacao)}</td></tr>`)
        .join("")}
    </table>
    <p class="small mt-1">Situação do PAR: ${ou(r.situacaoPAR)}. O acesso credenciado a SIMEC e Habilita é o
    primeiro passo operacional do plano de trabalho.</p>
  </div>
  ${rodape(8)}
</section>`;
}

function paginaCenario(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const etapa = r.censoEscolar?.matriculasEtapa;
  const edu = (i.payload?.educacao ?? {}) as Record<string, unknown>;
  const matriculas = num(r.censoEscolar?.totalMatriculas);
  const recursoAluno = matriculas > 0 ? r.receitas.totalReceitas / matriculas : 0;

  /**
   * Metas de estruturação. As razões vêm do modelo de referência: EJA e tempo
   * integral são as frentes de maior elasticidade, educação especial a de menor.
   */
  const frentes = [
    { nome: "EJA", base: num(etapa?.eja), fator: 7.4 },
    { nome: "Tempo integral", base: num(edu.matriculas_tempo_integral), fator: 5.1 },
    { nome: "Educação especial", base: num(etapa?.educacaoEspecial), fator: 1.6 },
  ].map((f) => {
    const meta = Math.round(f.base * f.fator);
    return { ...f, meta, ganho: Math.max(0, meta - f.base) };
  });

  const totalBase = frentes.reduce((s, f) => s + f.base, 0);
  const totalMeta = frentes.reduce((s, f) => s + f.meta, 0);
  const totalGanho = frentes.reduce((s, f) => s + f.ganho, 0);

  // Faixa indicativa: 40% a 60% do ganho de matrícula monetizado no exercício.
  const faixaBaixa = totalGanho * recursoAluno * 0.4;
  const faixaAlta = totalGanho * recursoAluno * 0.6;

  return `<section class="page content-page">
  ${cabecalho(municipio, `Parte V · Cenário ${id.exercicio + 1}`)}
  <div class="page-body">
    <div class="kicker">Parte V &middot; Cenário de estruturação ${id.exercicio + 1}</div>
    <h2>Onde a rede pode crescer<br>&mdash; e quanto isso vale</h2>

    <div class="mt-2">
      <table class="tb">
        <tr><th>Modalidade</th><th class="r">Base atual</th><th class="r">Meta ${id.exercicio + 1}</th><th class="r">Ganho de matrículas</th></tr>
        ${frentes
          .map(
            (f) => `<tr><td>${f.nome}</td><td class="r">${int(f.base)}</td><td class="r">${int(f.meta)}</td><td class="r"><b>+${int(f.ganho)}</b></td></tr>`,
          )
          .join("")}
        <tr class="total"><td>Total</td><td class="r">${int(totalBase)}</td><td class="r">${int(totalMeta)}</td><td class="r">+${int(totalGanho)}</td></tr>
      </table>
    </div>

    <div class="card mt-1">
      <h3>Ganho de matrículas por frente</h3>
      ${barras(frentes.map((f) => ({ nome: f.nome, valor: f.ganho, rotulo: `+${int(f.ganho)}` })))}
    </div>

    <div class="kpi hero mt-2"><em>Faixa indicativa de receita adicional &middot; se a reestruturação for bem executada</em>
      <b>${brlCompact(faixaBaixa)} &ndash; ${brlCompact(faixaAlta)}</b>
      <span>base de cálculo: R$ ${brl(recursoAluno)} por matrícula &middot; caráter estimativo, sujeito a validação documental</span>
    </div>

    <div class="sec-label">Frentes de atuação</div>
    <div class="grid-2">
      <div class="card">
        <p style="font-size:8.2pt;line-height:1.45;color:#33454f">
        <span class="strong">1. EJA:</span> busca ativa e reorganização da oferta com apoio territorial.<br>
        <span class="strong">2. Jornada ampliada:</span> expansão de tempo integral e oficinas nas escolas com capacidade de absorção.</p>
      </div>
      <div class="card">
        <p style="font-size:8.2pt;line-height:1.45;color:#33454f">
        <span class="strong">3. Educação especial:</span> qualificação cadastral e pedagógica para permanência.<br>
        <span class="strong">4. Consultoria Global Company:</span> monitoramento do Censo, sistemas FNDE e consistência da base.</p>
      </div>
    </div>
  </div>
  ${rodape(9)}
</section>`;
}

function paginaCaderno(i: LevantamentoTemplateInput): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const responsavel = r.parametros?.responsavelTecnico ?? "Adriel Tavares";

  const fontes = (i.payload?.fontes_utilizadas ?? [])
    .map((f) => (typeof f === "string" ? f : (f as Record<string, unknown>)?.label ?? (f as Record<string, unknown>)?.nome))
    .filter((f): f is string => typeof f === "string" && f.length > 0);

  const pares: Array<[string, string | null]> = [];
  for (let k = 0; k < fontes.length; k += 2) {
    pares.push([fontes[k], fontes[k + 1] ?? null]);
  }

  const observacoes = r.observacoesOperacionais ?? [];

  return `<section class="page content-page">
  ${cabecalho(municipio, "Caderno técnico")}
  <div class="page-body">
    <div class="kicker">Caderno técnico &middot; Recomendações e rastreabilidade</div>

    <div class="grid-2">
      <div class="card">
        <h3>Recomendações técnicas</h3>
        <p style="font-size:8pt;line-height:1.45;color:#33454f">
        &bull; Validar a base de cálculo do ICMS e a aplicação do percentual mínimo de 28% com assessoria jurídico-tributária.<br>
        &bull; Conferir documentalmente as bases que determinam a captura de VAAF, VAAT e VAAR junto ao FNDE.<br>
        &bull; Verificar atos normativos locais de EJA, tempo integral e parcerias intersetoriais com impacto no Censo Escolar.</p>
      </div>
      <div class="card">
        <h3>Próximos passos</h3>
        <p style="font-size:8pt;line-height:1.45;color:#33454f">
        <span class="strong">1.</span> Validar receitas atuais do FUNDEB nas bases oficiais.<br>
        <span class="strong">2.</span> Levantar status credenciado dos sistemas MEC/FNDE (SIMEC, Habilita).<br>
        <span class="strong">3.</span> Conferir base do Censo Escolar e indicadores da rede, escola a escola.</p>
      </div>
    </div>

    ${
      observacoes.length
        ? `<div class="sec-label">Observações operacionais da coleta</div>
    <div class="card"><p style="font-size:7.9pt;line-height:1.42;color:#33454f">${observacoes
      .map((o) => `&bull; ${esc(o)}`)
      .join("<br>")}</p></div>`
        : ""
    }

    <div class="note mt-1">
      <p style="font-size:7.9pt;line-height:1.4"><span class="strong" style="color:#584416">Alerta técnico:</span>
      os valores projetados têm caráter estimativo e dependem de validação documental nas bases
      oficiais do FUNDEB e dos sistemas MEC/FNDE. Este relatório é confidencial e destinado exclusivamente
      ao destinatário.</p>
    </div>

    ${
      pares.length
        ? `<div class="sec-label">Mapa de fontes &mdash; rastreabilidade automática do Global Sync</div>
    <table class="tb">
      <tr><th>Fonte</th><th>Status</th><th>Fonte</th><th>Status</th></tr>
      ${pares
        .map(
          ([a, b]) =>
            `<tr><td>${esc(a)}</td><td>Automático</td><td>${b ? esc(b) : ""}</td><td>${b ? "Automático" : ""}</td></tr>`,
        )
        .join("")}
    </table>
    <p class="small mt-1">A camada de rastreabilidade mostra o que entrou automaticamente, o que depende de estimativa
    e o que exige confirmação manual &mdash; ela explica a confiança operacional do relatório
    antes da emissão final.</p>`
        : ""
    }

    <div style="margin-top:.34in">
      <div style="width:3.1in">
        <hr style="border:none;border-top:1px solid #94a5b0;margin:0 0 .07in">
        <div style="color:var(--navy);font-size:9.6pt;font-weight:800">${esc(responsavel)}</div>
        <div class="small">Responsável Técnico &middot; Global Company Consultorias</div>
      </div>
    </div>
  </div>
  ${rodape(10, ` &middot; Emitido em ${dataCurta(r.geradoEm)}`)}
</section>`;
}

// ── Montagem ────────────────────────────────────────────────────────────────

export function generateLevantamentoHtml(input: LevantamentoTemplateInput): string {
  const id = input.relatorio.identificacao;

  const paginas = [
    paginaCapa,
    paginaSumario,
    paginaReceita,
    paginaProjecao,
    paginaSerie,
    paginaRede,
    paginaIdeb,
    paginaFiscal,
    paginaCenario,
    paginaCaderno,
  ].map((fn) => fn(input));

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Levantamento FUNDEB &mdash; ${esc(id.municipioNome)}/${esc(id.uf)} | Global Sync</title>
<style>${CSS}</style></head><body>
${paginas.join("\n\n")}
</body></html>`;
}
