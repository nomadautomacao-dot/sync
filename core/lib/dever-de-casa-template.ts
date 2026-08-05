import type { BlocoDever, DeverDeCasa, ItemDever, ParcelaDinheiro, Veredito } from "./dever-de-casa";

/**
 * Dever de Casa — HTML de impressão.
 *
 * Mesma arquitetura de dois regimes dos dossiês: `section.page` de altura fixa
 * na capa e no placar, `section.flow` nos blocos de itens. Ver o doc-comment
 * de `dossie-escolas-template.ts`.
 *
 * O contrato de completude deste relatório: **todo item julgado vira uma linha
 * impressa** (`tr.item`). O gerador confere a contagem — item que some é
 * veredito que o consultor não vê.
 */

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const umaCasa = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface DeverDeCasaInput {
  municipio: string;
  uf: string;
  dever: DeverDeCasa;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

const VEREDITO: Record<Veredito, { rotulo: string; classe: string }> = {
  cumpre: { rotulo: "cumpre", classe: "ok" },
  parcial: { rotulo: "parcial", classe: "meio" },
  descumpre: { rotulo: "descumpre", classe: "bad" },
  sem_dado: { rotulo: "sem dado", classe: "neutro" },
  fora_do_alcance: { rotulo: "fora do alcance", classe: "neutro" },
};

function linhaItem(item: ItemDever): string {
  const v = VEREDITO[item.veredito];
  return `<tr class="item">
    <td class="cod">${esc(item.id)}</td>
    <td>
      <b class="item-titulo">${esc(item.titulo)}</b>
      <span class="item-criterio">${esc(item.criterio)}</span>
      <span class="item-medida">${esc(item.medida)}</span>
      <span class="item-fonte">${esc(item.fonte)}</span>
    </td>
    <td class="num"><span class="sit ${v.classe}">${v.rotulo}</span></td>
  </tr>`;
}

function secaoBloco(bloco: BlocoDever): string {
  return `<section class="flow">
  <h2 class="secao">${esc(bloco.titulo)}</h2>
  <p class="secao-sub">${esc(bloco.sub)}</p>
  <table class="lista"><thead><tr><th>Item</th><th>Obrigação, medida e fonte</th><th class="num">Veredito</th></tr></thead>
  <tbody>${bloco.itens.map(linhaItem).join("")}</tbody></table>
</section>`;
}

function linhaDinheiro(p: ParcelaDinheiro): string {
  return `<tr>
    <td>${esc(p.rotulo)}${p.estimativa ? ' <span class="pill">estimativa</span>' : ""}
      <span class="item-fonte">${esc(p.nota)}</span></td>
    <td class="num"><b>${moeda.format(p.valor)}</b></td>
  </tr>`;
}

function kpi(valor: string, rotulo: string): string {
  return `<div class="kpi"><b>${valor}</b><span>${rotulo}</span></div>`;
}

export function generateDeverDeCasaHtml(input: DeverDeCasaInput): string {
  const { dever: d, municipio, uf } = input;
  const geradoEm = input.geradoEm ?? new Date();
  const responsavel = input.responsavel ?? "Adriel Tavares";
  const p = d.placar;
  const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(geradoEm);

  const marca = input.logoDataUri
    ? `<img src="${input.logoDataUri}" alt="" style="width:.42in;height:.42in;border-radius:8px">`
    : "";

  const notaTexto = p.nota == null ? "—" : umaCasa.format(p.nota);
  const notaClasse = p.nota == null ? "neutro" : p.nota >= 7.5 ? "ok" : p.nota >= 5 ? "meio" : "bad";

  const totalNaMesa = d.naMesa.reduce((t, x) => t + x.valor, 0);
  const fontesFalhas = d.fontes.filter((f) => !f.ok);

  const secaoDinheiro =
    d.naMesa.length || d.potencial.length
      ? `<section class="flow">
  <h2 class="secao">O que o dever de casa vale</h2>
  <p class="secao-sub">Perda causada por item reprovado de um lado; o que ação nova traria, do outro. Os dois
  nunca se somam — potencial não é perda, e apresentá-los misturados inflaria o argumento.</p>
  ${
    d.naMesa.length
      ? `<h3 class="sub-h">Deixado na mesa por descumprimento</h3>
  <table class="lista dinheiro"><tbody>${d.naMesa.map(linhaDinheiro).join("")}</tbody></table>`
      : `<div class="insight"><b>Nenhuma perda apurada por descumprimento.</b> As reprovações desta emissão não têm
  parcela em dinheiro associada — o custo delas é de convênio travado e conta reprovada, não de repasse zerado.</div>`
  }
  ${
    d.potencial.length
      ? `<h3 class="sub-h">Potencial por ação nova</h3>
  <table class="lista dinheiro"><tbody>${d.potencial.map(linhaDinheiro).join("")}</tbody></table>`
      : ""
  }
</section>`
      : "";

  const secaoFontes = `<section class="flow">
  <h2 class="secao">De onde saiu cada veredito</h2>
  <p class="secao-sub">Toda linha deste relatório tem fonte pública e data. O que não respondeu na emissão está
  marcado — e os itens correspondentes entraram como <b>sem dado</b>, fora do denominador da nota.</p>
  <table class="lista"><thead><tr><th>Fonte</th><th class="num">Situação</th><th class="num">Referência</th></tr></thead>
  <tbody>${d.fontes
    .map(
      (f) => `<tr>
    <td>${esc(f.rotulo)}</td>
    <td class="num"><span class="sit ${f.ok ? "ok" : "neutro"}">${f.ok ? "respondeu" : "faltou"}</span></td>
    <td class="num">${esc(f.detalhe)}</td>
  </tr>`,
    )
    .join("")}</tbody></table>
  <p class="fonte">Emitido em ${esc(data)} por ${esc(responsavel)} &middot; Global Company Consultorias.
  Documento interno de análise — não destinado ao município. Vereditos refletem a data de cada fonte, não a
  data de hoje; estimativas estão sempre nomeadas como tal.</p>
</section>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dever de Casa — ${esc(municipio)}/${esc(uf)}</title>
<style>${CSS}</style></head><body>

<section class="page cover">
  <div class="cover-top">
    <div style="display:flex;align-items:center;gap:.13in">${marca}
      <div><div class="marca">Global Sync</div><div class="marca-sub">Global Company Consultorias</div></div>
    </div>
    <span class="conf">Uso interno</span>
  </div>
  <div class="cover-mid">
    <span class="cover-tag">Análise interna &middot; exercício de ${d.exercicio}</span>
    <h1>Dever de casa<br><span class="thin">feito ou não feito</span></h1>
    <p class="cover-sub">Cada obrigação que o município controla por ato de gestão, com o parâmetro legal de um
    lado, o dado apurado do outro e o veredito no meio. A nota mede só o que foi verificável.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    <div class="cover-hero ${notaClasse}">
      <em>Nota do dever de casa</em>
      <div class="val"><b>${notaTexto}</b><i>${esc(p.rotulo)}</i></div>
      <p>${inteiro.format(p.cumpre)} de ${inteiro.format(p.avaliados)} itens verificáveis cumpridos${
        p.parcial ? `, ${inteiro.format(p.parcial)} parcial(is)` : ""
      }${p.descumpre ? `, ${inteiro.format(p.descumpre)} descumprido(s)` : ""}.${
        totalNaMesa > 0 ? ` Deixado na mesa: cerca de ${moeda.format(totalNaMesa)} por exercício.` : ""
      }</p>
    </div>
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(data)}</b></div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dever de Casa</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">O placar</div>
    <h2>${inteiro.format(p.cumpre)} de ${inteiro.format(p.avaliados)} itens verificáveis</h2>
    <p class="lede">Quatro blocos, do mais administrativo ao mais finalístico: prestação de contas, as cinco
    condicionalidades do VAAR, matrícula e cadastro, e resultado em sala. Item sem fonte não entra na conta —
    está listado ao final, com o motivo.</p>

    <div class="kpis">
      ${kpi(notaTexto, "nota (0 a 10)")}
      ${kpi(inteiro.format(p.cumpre), "cumpridos")}
      ${kpi(inteiro.format(p.parcial), "parciais")}
      ${kpi(inteiro.format(p.descumpre), "descumpridos")}
      ${kpi(inteiro.format(p.semDado + p.foraDoAlcance), "fora da conta")}
    </div>

    <div class="blocos-resumo">
      ${d.blocos
        .map((b) => {
          const c = b.itens.filter((i) => i.veredito === "cumpre").length;
          const av = b.itens.filter((i) =>
            ["cumpre", "parcial", "descumpre"].includes(i.veredito),
          ).length;
          const ruins = b.itens.filter((i) => i.veredito === "descumpre");
          return `<div class="card">
        <h3>${esc(b.titulo)}</h3>
        <div class="bloco-placar">${inteiro.format(c)}<span>/${inteiro.format(av)} verificáveis</span></div>
        <p class="micro">${
          ruins.length
            ? `Descumpre: ${ruins.map((i) => esc(i.id)).join(", ")}.`
            : av > 0
              ? "Nenhum item descumprido."
              : "Sem item verificável nesta emissão."
        }</p>
      </div>`;
        })
        .join("")}
    </div>

    ${
      fontesFalhas.length
        ? `<div class="nota"><b>${inteiro.format(fontesFalhas.length)} fonte(s) não responderam nesta emissão:</b>
    ${fontesFalhas.map((f) => esc(f.rotulo)).join("; ")}. Os itens que dependem delas estão fora do denominador.</div>`
        : `<div class="insight"><b>Todas as fontes responderam.</b> A nota cobre o quadro completo dos itens.</div>`
    }

    <p class="fonte">Fontes: Tesouro Nacional (CAUC e Siconfi), FNDE/MEC (SIOPE, VAAR e Portaria de ponderação),
    INEP (Censo Escolar e IDEB), MEC (Compromisso Criança Alfabetizada) e IBGE (demografia). Detalhe fonte a
    fonte na última seção.</p>
  </div>
  <div class="page-footer"><span>Tesouro Nacional &middot; FNDE/MEC &middot; INEP &middot; IBGE</span><span>2</span></div>
</section>

${d.blocos.map(secaoBloco).join("\n")}
${secaoDinheiro}
${secaoFontes}

</body></html>`;
}

const CSS = `
:root{--navy:#10263f;--teal:#27a69a;--ink:#1d2b36;--muted:#6b7d88;--line:#dbe4e8;--wash:#f7fafa;
  --red:#b0413e;--gold:#b7801f;--good:#22856f}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--ink);font-size:9pt;
  line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:letter;margin:.62in .62in .55in}
@page:first{margin:0}
section.page{width:8.5in;height:11in;overflow:hidden;position:relative;page-break-after:always;break-after:page}
.page-header{position:absolute;top:.42in;left:.62in;right:.62in;display:flex;justify-content:space-between;
  align-items:baseline;padding-bottom:.07in;border-bottom:1px solid var(--line);font-size:7.4pt;
  letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.page-header strong{color:var(--navy);font-weight:800}
.page-footer{position:absolute;bottom:.4in;left:.62in;right:.62in;display:flex;justify-content:space-between;
  font-size:7pt;color:var(--muted);border-top:1px solid var(--line);padding-top:.06in}
section.page.content .body{position:absolute;top:.82in;left:.62in;right:.62in;bottom:.62in;overflow:hidden}
section.flow{page-break-before:always;break-before:page}
section.flow .secao{font-size:19pt;color:var(--navy);letter-spacing:-.02em;margin-bottom:.06in}
section.flow .secao-sub{font-size:8.4pt;color:var(--muted);line-height:1.45;max-width:6.2in;
  margin-bottom:.16in;padding-bottom:.12in;border-bottom:2px solid var(--teal)}
.cover{background:#fff;display:grid;grid-template-rows:auto 1fr auto;border-top:.09in solid var(--teal)}
.cover:before{content:"";position:absolute;right:-1.6in;top:-1.9in;width:5.2in;height:5.2in;border-radius:50%;
  border:.55in solid rgba(39,166,154,.07)}
.cover-top{padding:.5in .7in 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
.marca{font-size:15pt;font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--navy)}
.marca-sub{margin-top:.04in;font-size:7.2pt;color:var(--muted)}
.conf{border:1px solid #e2c084;color:#a66a10;background:#fdf9ee;border-radius:4px;padding:.03in .09in;
  font-size:6.8pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.cover-mid{padding:0 .7in;position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center}
.cover-tag{display:inline-block;background:rgba(39,166,154,.09);border:1px solid rgba(39,166,154,.35);
  color:#1d7d72;font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border-radius:999px;
  padding:.05in .16in;margin-bottom:.22in;width:fit-content}
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
.cover-hero.bad{background:linear-gradient(135deg,rgba(176,65,62,.1) 0%,rgba(176,65,62,.03) 62%,rgba(255,255,255,0) 100%);
  border-color:rgba(176,65,62,.3);border-left-color:var(--red)}
.cover-hero.bad .val b{color:var(--red)}
.cover-hero.bad .val i{background:var(--red)}
.cover-hero.bad em{color:var(--red)}
.cover-hero.meio{background:linear-gradient(135deg,rgba(183,128,31,.1) 0%,rgba(183,128,31,.03) 62%,rgba(255,255,255,0) 100%);
  border-color:rgba(183,128,31,.3);border-left-color:var(--gold)}
.cover-hero.meio .val b{color:var(--gold)}
.cover-hero.meio .val i{background:var(--gold)}
.cover-hero.meio em{color:var(--gold)}
.cover-hero em{display:block;font-style:normal;color:#1d7d72;font-size:7.2pt;font-weight:800;
  letter-spacing:.15em;text-transform:uppercase}
.cover-hero .val{display:flex;align-items:baseline;gap:.14in;margin-top:.09in}
.cover-hero .val b{color:var(--teal);font-size:40pt;font-weight:700;letter-spacing:-.035em;line-height:.92}
.cover-hero .val i{font-style:normal;background:var(--teal);color:#fff;font-size:9pt;font-weight:800;
  border-radius:999px;padding:.045in .13in;white-space:nowrap}
.cover-hero p{margin-top:.11in;color:#44545f;font-size:8.4pt;line-height:1.42;max-width:4.6in}
.cover-bot{padding:0 .7in .5in;display:flex;justify-content:space-between;align-items:end;position:relative;
  z-index:1;color:var(--muted);font-size:7.6pt;line-height:1.4}
.cover-bot b{display:block;color:var(--navy);font-size:8.4pt}
.kicker{color:var(--teal);font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
h2{font-size:21pt;color:var(--navy);letter-spacing:-.025em;line-height:1.1;margin-top:.05in}
.lede{margin-top:.14in;color:#44545f;font-size:9.4pt;line-height:1.5;max-width:6in;padding-bottom:.14in;
  border-bottom:2px solid var(--teal)}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:.14in;margin-top:.2in}
.kpi{border-left:.03in solid var(--teal);padding-left:.11in}
.kpi b{display:block;color:var(--navy);font-size:16pt;letter-spacing:-.02em;line-height:1}
.kpi span{display:block;color:var(--muted);font-size:6.9pt;font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;margin-top:.05in;line-height:1.3}
.blocos-resumo{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.22in}
.card{border:1px solid var(--line);border-radius:8px;padding:.15in .17in;background:#fff}
.card h3{font-size:10.5pt;color:var(--navy);margin-bottom:.08in}
.bloco-placar{font-size:22pt;color:var(--navy);font-weight:700;letter-spacing:-.02em;line-height:1}
.bloco-placar span{font-size:9pt;color:var(--muted);font-weight:400;letter-spacing:0}
.sub-h{font-size:11pt;color:var(--navy);margin:.18in 0 .08in}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.045in 0;border-bottom:1px solid #eef3f5;vertical-align:top}
table td.num{text-align:right;color:var(--navy);white-space:nowrap}
.micro{font-size:6.9pt;color:var(--muted);line-height:1.35}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}
table.lista{font-size:7.8pt}
table.lista thead th{text-align:left;font-size:6.8pt;letter-spacing:.08em;text-transform:uppercase;
  color:#fff;background:var(--navy);padding:.055in .07in;font-weight:800}
table.lista thead th.num{text-align:right}
table.lista td{padding:.07in .07in}
table.lista tbody tr:nth-child(even){background:#f8fafb}
table.lista tr{break-inside:avoid}
table.lista td.cod{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:7.2pt;color:var(--navy);
  white-space:nowrap}
table.dinheiro td{padding:.08in .07in}
.item-titulo{display:block;color:var(--navy);font-size:8.6pt}
.item-criterio{display:block;color:var(--muted);font-size:7.4pt;line-height:1.4;margin-top:.02in}
.item-medida{display:block;color:var(--ink);font-size:7.9pt;line-height:1.4;margin-top:.04in}
.item-fonte{display:block;color:var(--muted);font-size:6.6pt;margin-top:.03in;letter-spacing:.03em}
.pill{background:rgba(183,128,31,.14);color:#8a6217;font-size:5.9pt;font-weight:800;letter-spacing:.05em;
  text-transform:uppercase;border-radius:999px;padding:.015in .05in}
.sit{font-size:6.4pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;
  padding:.02in .07in;white-space:nowrap}
.sit.ok{background:#eaf5f1;color:var(--good)}
.sit.bad{background:#fbeceb;color:var(--red)}
.sit.meio{background:#fdf6e8;color:var(--gold)}
.sit.neutro{background:#eef3f5;color:var(--muted)}
.nota,.risco,.insight{margin-top:.14in;border-radius:8px;padding:.12in .14in;font-size:7.9pt;line-height:1.45}
.nota{background:var(--wash);border-left:.03in solid var(--line);color:#44545f}
.risco{background:#fdf1f0;border-left:.03in solid var(--red)}
.insight{background:#eef6f5;border-left:.03in solid var(--teal)}
`;
