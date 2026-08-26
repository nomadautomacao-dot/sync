import type { CaseSucesso, MunicipioApurado } from "@/modules/case-de-sucesso/types";

/**
 * O Case de Sucesso em HTML — folhas de 1920×1080, para apresentar e imprimir.
 *
 * ## Por que este documento não segue a arquitetura dos dossiês
 *
 * Os dossiês são A4 de leitura, com paginação por fluxo. Este é um deck: folha
 * de proporção 16:9, uma ideia por folha, projetado numa reunião. Por isso a
 * página é fixa e o conteúdo **não pode transbordar** — o que passar de 1080px
 * some na impressão em vez de rolar para a folha seguinte. `case-sucesso-pdf.ts`
 * confere isso antes de devolver o arquivo.
 *
 * ## O tom, e o que ficou de fora de propósito
 *
 * É peça comercial. Uma versão anterior explicava a escada da EC 108/2020 (a
 * complementação da União sobe por lei, de 19% do fundo em 2024 para 23% em
 * 2026) e descontava esse efeito com um contrafactual. Saiu: numa reunião,
 * abrir a discussão sobre o que a lei fez sozinha responde a uma objeção que
 * ninguém levantou, e enfraquece o documento.
 *
 * O que ficou da comparação é a **posição** — "entre as 2% que mais cresceram no
 * Brasil". É a mesma medição, virada do avesso: vende como troféu e continua
 * conferível, porque o percentil sai do universo inteiro das portarias.
 *
 * O rigor que não sai junto com o tom: janela de apuração impressa por
 * município, fonte e exercícios em cada folha, e nenhum ano reivindicado fora
 * do período de atuação.
 */
export interface CaseSucessoTemplateInput {
  caso: CaseSucesso;
  logoDataUri?: string | null;
  /** Quantos municípios cabem numa folha sem espremer as fichas. */
  porFolha?: number;
}

/** Quatro fichas é o limite do que se lê numa folha 16:9 projetada. */
const POR_FOLHA_PADRAO = 4;

const mi = (v: number) => `R$ ${(v / 1e6).toFixed(2).replace(".", ",")} mi`;
const miCurto = (v: number) => `R$ ${(v / 1e6).toFixed(1).replace(".", ",")} mi`;
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const pctSinal = (v: number) => `${v >= 0 ? "+" : "−"}${pct(Math.abs(v))}`;
const p0 = (v: number) => Math.round(v);

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Nome do FNDE vem em caixa alta; no documento ele aparece como se escreve. */
function nomeProprio(nome: string): string {
  const minusculas = new Set(["de", "do", "da", "dos", "das", "e"]);
  return nome
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((palavra, i) =>
      i > 0 && minusculas.has(palavra)
        ? palavra
        : palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1),
    )
    .join(" ");
}

/** O selo é troféu, não ressalva: posição da rede entre as do país. */
function selo(m: MunicipioApurado): string {
  return m.percentilBR >= 90
    ? `entre as ${100 - p0(m.percentilBR)}% que mais cresceram no Brasil`
    : `à frente de ${p0(m.percentilBR)}% dos municípios do país`;
}

/**
 * Contagem pequena vai por extenso.
 *
 * "4 redes. 4 aumentos." num título de 54px lê como planilha, e o algarismo
 * ainda quebra a linha em lugar diferente do da palavra. Acima de dez, o
 * algarismo volta a ser o certo.
 */
const EXTENSO = [
  "zero", "um", "dois", "três", "quatro", "cinco",
  "seis", "sete", "oito", "nove", "dez",
];
function porExtenso(n: number): string {
  return EXTENSO[n] ?? String(n);
}
function capitalizar(s: string): string {
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

function emGrupos<T>(itens: T[], tamanho: number): T[][] {
  const grupos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) grupos.push(itens.slice(i, i + tamanho));
  return grupos;
}

export function generateCaseSucessoHtml(input: CaseSucessoTemplateInput): string {
  const { caso } = input;
  const porFolha = input.porFolha ?? POR_FOLHA_PADRAO;
  const ms = caso.municipios;
  const n = ms.length;
  const topo10 = ms.filter((m) => m.percentilBR >= 90);
  const inicio = Math.min(...ms.map((m) => m.inicio));
  const fim = Math.max(...ms.map((m) => m.fim));
  const universo = Math.max(...ms.map((m) => m.universoBR));

  const gruposPlacar = emGrupos(ms, porFolha);
  const gruposSerie = emGrupos(ms, porFolha);
  const totalFolhas = 1 + gruposPlacar.length + gruposSerie.length + 2;

  const rede = n === 1 ? "rede" : "redes";
  const fonte = `FNDE · portarias de complementação do FUNDEB · exercícios ${caso.anos[0]} a ${fim}`;

  const marca = input.logoDataUri
    ? `<img src="${input.logoDataUri}" alt="" />`
    : `<div class="marca-vazia"></div>`;

  const lockup = `
    <div class="lockup">
      ${marca}
      <div><div class="marca">Global Sync</div><div class="marca-sub">Global Company Consultorias</div></div>
    </div>`;

  /**
   * Os pontos recebem a posição **explícita** da folha.
   *
   * Um contador que incrementasse a cada chamada numeraria pela ordem em que as
   * strings são construídas, não pela ordem em que as folhas aparecem — e como
   * as folhas do meio são montadas antes da capa, a capa saía com o quarto ponto
   * aceso. Erro que o compilador não pega e que só o documento renderizado mostra.
   */
  const pontos = (posicao: number) =>
    `<div class="dots">${Array.from(
      { length: totalFolhas },
      (_, i) => `<span${i + 1 === posicao ? ' class="on"' : ""}></span>`,
    ).join("")}</div>`;

  const POS_CAPA = 1;
  const posPlacar = (i: number) => POS_CAPA + 1 + i;
  const posSerie = (i: number) => posPlacar(gruposPlacar.length) + i;
  const POS_METODO = posSerie(gruposSerie.length);
  const POS_FECHAMENTO = POS_METODO + 1;

  const pecaPlacar = (m: MunicipioApurado) => `
    <div class="peca">
      <em>${esc(nomeProprio(m.nome))}</em>
      <span class="per">${m.inicio} → ${m.fim}</span>
      <b>${pctSinal(m.variacaoTotal)}</b>
      <span class="cif">${mi(m.ganhoTotal)} a mais por ano</span>
      <div class="antes-depois">
        <div class="ad">
          <span class="ad-rot">${m.inicio}</span>
          <span class="ad-track"><span class="ad-fill antes"
            style="width:${((m.totalInicio / m.totalFim) * 100).toFixed(1)}%"></span></span>
          <span class="ad-val">${mi(m.totalInicio)}</span>
        </div>
        <div class="ad">
          <span class="ad-rot">${m.fim}</span>
          <span class="ad-track"><span class="ad-fill depois" style="width:100%"></span></span>
          <span class="ad-val">${mi(m.totalFim)}</span>
        </div>
      </div>
    </div>`;

  const fichaSerie = (m: MunicipioApurado) => {
    const maxTotal = Math.max(...m.serie.map((x) => x.total));
    const linhas = m.serie
      .map((x) => {
        const largura = (x.total / maxTotal) * 100;
        const parteCompl = x.total > 0 ? (x.complementacao / x.total) * 100 : 0;
        const marco = x.ano === m.anoHabilitacaoVaat;
        return `
        <div class="ano-linha${marco ? " marco" : ""}">
          <span class="ano-rot">${x.ano}</span>
          <span class="track"><span class="fill" style="width:${largura.toFixed(1)}%">
            <span class="fill-compl" style="width:${parteCompl.toFixed(1)}%"></span></span></span>
          <span class="ano-val">${mi(x.total)}</span>
        </div>`;
      })
      .join("");

    return `
    <article class="cidade${m.percentilBR >= 90 ? " destaque-forte" : ""}">
      <header>
        <div>
          <h3>${esc(nomeProprio(m.nome))}</h3>
          <span class="cod">${esc(m.uf)} &middot; atuação ${m.inicio}–${m.fim}</span>
        </div>
        <span class="ganho">${pctSinal(m.variacaoTotal)}</span>
      </header>
      <div class="serie">${linhas}</div>
      <div class="uniao">
        <em>Parcela vinda da União</em>
        <b>${mi(m.complementacaoInicio)} → ${mi(m.complementacaoFim)}</b>
        <span>${pctSinal(m.variacaoComplementacao)} no período</span>
      </div>
      <div class="fecho">
        <div class="cifra">
          <em>A mais por ano para a rede</em>
          <b>${mi(m.ganhoTotal)}</b>
          <span>${mi(m.totalInicio)} em ${m.inicio} → ${mi(m.totalFim)} em ${m.fim}</span>
        </div>
        <p class="selo">${selo(m)}</p>
      </div>
    </article>`;
  };

  const folhasPlacar = gruposPlacar
    .map(
      (grupo, i) => `
<section class="slide" data-slide="placar-${i + 1}">
  <div class="pad">
    <div class="topbar">${lockup}<span class="kicker">O resultado${gruposPlacar.length > 1 ? ` &middot; ${i + 1} de ${gruposPlacar.length}` : ""}</span></div>
    <h1 class="titulo">${capitalizar(porExtenso(n))} ${rede}.
    ${n === 1 ? "Um aumento" : `${capitalizar(porExtenso(n))} aumentos`}.
    <em>${n === 1 ? "Verificável" : "Todos verificáveis"}.</em></h1>
    <p class="lead">Crescimento da receita total do FUNDEB de cada município no período em que
    trabalhamos com a rede.</p>
    <div class="placar" style="grid-template-columns:repeat(${Math.max(grupo.length, 2)},1fr)">
      ${grupo.map(pecaPlacar).join("")}
    </div>
    ${
      i === 0
        ? `<div class="faixa-total">
      <div class="bloco">
        <em>Somadas as ${porExtenso(n)} ${rede}</em>
        <b>${mi(caso.agregado.ganhoTotal)}</b>
        <span>a mais por ano para a educação municipal — de ${mi(caso.agregado.totalInicio)}
        para ${mi(caso.agregado.totalFim)}</span>
      </div>
      <div class="risco"></div>
      <div class="bloco">
        <em>Vindo da complementação da União</em>
        <b>${mi(caso.agregado.ganhoComplementacao)}</b>
        <span>de ${mi(caso.agregado.complementacaoInicio)} para ${mi(caso.agregado.complementacaoFim)}
        — VAAF, VAAT e VAAR. É a parcela que depende do que o município declara e cumpre.</span>
      </div>
      ${
        topo10.length > 0
          ? `<div class="risco"></div>
      <div class="bloco">
        <em>Posição no país</em>
        <b>${topo10.length} de ${n}</b>
        <span>entre as <b class="realce">10% que mais cresceram no Brasil</b> —
        ${topo10.map((m) => esc(nomeProprio(m.nome))).join(", ")}.</span>
      </div>`
          : ""
      }
    </div>`
        : ""
    }
    <div class="rodape"><span>${fonte} &middot; valores nominais</span>${pontos(posPlacar(i))}</div>
  </div>
</section>`,
    )
    .join("\n");

  const folhasSerie = gruposSerie
    .map(
      (grupo, i) => `
<section class="slide" data-slide="serie-${i + 1}">
  <div class="pad">
    <div class="topbar">${lockup}<span class="kicker">Rede a rede${gruposSerie.length > 1 ? ` &middot; ${i + 1} de ${gruposSerie.length}` : ""}</span></div>
    <h1 class="titulo" style="font-size:44px;max-width:44ch;margin-bottom:6px">A curva de cada município, ano a ano.</h1>
    <p class="lead" style="font-size:19px;margin-bottom:22px;max-width:120ch">A barra é a receita total do
    FUNDEB do exercício; a faixa em verde é a parte que vem da União — a que cresce quando a base da rede
    entra em ordem.</p>
    <div class="cidades-grid" style="grid-template-columns:repeat(${Math.max(grupo.length, 2)},1fr)">
      ${grupo.map(fichaSerie).join("\n")}
    </div>
    <p class="legenda"><i class="sw-total"></i> receita total do FUNDEB &nbsp;&nbsp;
      <i class="sw-compl"></i> parcela vinda da União</p>
    <div class="rodape"><span>${fonte} &middot; posição apurada contra os ${universo} municípios brasileiros que recebem complementação</span>${pontos(posSerie(i))}</div>
  </div>
</section>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Case de Sucesso &middot; Global Company &middot; ${inicio}–${fim}</title>
<style>
${CSS}
</style>
</head>
<body>
<div class="deck-viewport"><div class="deck-stage" id="palco">

<section class="slide s-capa dark active" data-slide="capa">
  <div class="pad">
    <div class="topbar">${lockup}<span class="kicker">Case de sucesso &middot; ${inicio}–${fim}</span></div>
    <div class="corpo">
      <div>
        <span class="capa-tag">${porExtenso(n)} ${n === 1 ? "rede municipal" : "redes municipais"}</span>
        <h1 class="capa-h1">${miCurto(caso.agregado.ganhoTotal)} a mais para a <em>educação</em>
        de ${n === 1 ? "um município" : `${porExtenso(n)} municípios`}.</h1>
        <p class="capa-sub">Receita do FUNDEB que passou a entrar nessas redes depois da nossa
        atuação — e que está publicada, portaria por portaria, no portal do FNDE.</p>
        <div class="capa-cidades">${ms.map((m) => esc(nomeProprio(m.nome))).join(" &middot; ")}</div>
      </div>
      <aside class="painel">
        <div>
          <div class="rot">Receita do FUNDEB &middot; as ${porExtenso(n)} ${rede} somadas</div>
          <div class="valor">${mi(caso.agregado.ganhoTotal)}</div>
          <div class="valor-sub">de ${mi(caso.agregado.totalInicio)} para ${mi(caso.agregado.totalFim)} ao ano</div>
        </div>
        <div class="divisor"></div>
        ${
          topo10.length > 0
            ? `<div class="contraponto">
          <b>${topo10.length} entre as 10% que mais cresceram no Brasil</b>
          <span>${topo10.map((m) => esc(nomeProprio(m.nome))).join(", ")} — contra os ${universo}
          municípios brasileiros que recebem complementação da União.</span>
        </div>`
            : `<div class="contraponto">
          <b>Resultado conferível na fonte</b>
          <span>Cada valor deste documento está publicado nas portarias de complementação do FUNDEB.</span>
        </div>`
        }
      </aside>
    </div>
    <div class="rodape"><span>${fonte}</span>${pontos(POS_CAPA)}</div>
  </div>
</section>

${folhasPlacar}
${folhasSerie}

<section class="slide" data-slide="metodo">
  <div class="pad">
    <div class="topbar">${lockup}<span class="kicker">Como fazemos</span></div>
    <h1 class="titulo">Três frentes, cada uma com a data que a lei marca.</h1>
    <p class="lead">O FUNDEB paga pelo que o município consegue comprovar, no prazo em que a norma
    exige. É aí que atuamos — e é aí que está o dinheiro que a rede deixa de receber sem perceber.</p>
    <div class="passos">
      <article class="passo">
        <div class="n">1</div>
        <h3>Conferência cadastral do Censo</h3>
        <p>Escola a escola: localização, jornada declarada, AEE registrado como turma e matrícula em
        duplicidade com outra rede. <b>O fator de ponderação vai de 1,00 a 2,17</b> — e a coleta de um
        ano define o repasse do ano seguinte.</p>
        <div class="saida"><em>Prazo</em><strong>Coleta até 31/07 &middot; retificação em 30 dias
        após a prévia</strong></div>
      </article>
      <article class="passo">
        <div class="n">2</div>
        <h3>Habilitação ao VAAT</h3>
        <p>DCA no Siconfi, Anexo 8 no SIOPE e os itens de educação do CAUC acompanhados <b>antes do
        corte</b>, não depois da recusa. É a parcela que mais cresceu nas redes deste documento.</p>
        <div class="saida"><em>Prazo</em><strong>Dados no Siconfi e no SIOPE até 31/08
        (art. 13, §4º)</strong></div>
      </article>
      <article class="passo">
        <div class="n">3</div>
        <h3>Condicionalidades do VAAR</h3>
        <p>A parcela por resultado exige cumprir os requisitos do art. 14 — e é a que mais se perde por
        omissão administrativa. <b>Município que não cumpre não recebe</b>, e em geral descobre tarde.</p>
        <div class="saida"><em>Prazo</em><strong>Requisitos verificados no exercício anterior
        ao repasse</strong></div>
      </article>
    </div>
    <div class="rodape"><span>Lei 14.113/2020 &middot; Global Company Consultorias</span>${pontos(POS_METODO)}</div>
  </div>
</section>

<section class="slide s-fim dark" data-slide="fechamento">
  <div class="pad">
    <div class="topbar">${lockup}<span class="conf">Documento confidencial</span></div>
    <div class="corpo">
      <div>
        <h1 class="capa-h1" style="font-size:56px">Quanto o seu município está deixando na mesa?</h1>
        <div class="principio">Começamos pelo diagnóstico: a leitura completa da sua rede nas bases
        oficiais, com o que cada lacuna vale em reais — antes de qualquer contrato.</div>
        <div class="contato">
          <b>Global Company Consultorias</b><br />
          GLOBAL SERVICES COMPANY LTDA &middot; CNPJ 26.137.996/0001-75<br />
          Pe. Orthon Vieira Lima, S/N, Centro &middot; Santa Maria da Vitória — BA<br />
          Tel: (61) 98155-1533 &middot; globalconsultorias@icloud.com
        </div>
      </div>
      <aside class="painel">
        <div>
          <div class="rot">O que entregamos primeiro</div>
          <div class="valor" style="font-size:54px">Raio-X<br />municipal</div>
          <div class="valor-sub">Matrícula ponderada escola a escola, habilitação ao VAAT,
          condicionalidades do VAAR e o valor de cada correção possível.</div>
        </div>
        <div class="divisor"></div>
        <div class="contraponto">
          <b>Sem custo e sem compromisso</b>
          <span>Basta o código IBGE do município. O diagnóstico vai com a memória de cálculo de
          cada número, para a sua equipe conferir na fonte.</span>
        </div>
      </aside>
    </div>
    <div class="rodape"><span>${fonte}</span>${pontos(POS_FECHAMENTO)}</div>
  </div>
</section>

</div></div>

<div class="controles" aria-label="Controles da apresentação">
  <button type="button" id="ant">Anterior</button>
  <div class="conta" id="conta">1 / ${totalFolhas}</div>
  <button type="button" id="prox">Próximo</button>
</div>

<script>
(function () {
  var palco = document.getElementById("palco");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var conta = document.getElementById("conta");
  var i = 0;
  function ajustar() {
    var escala = Math.min(innerWidth / 1920, innerHeight / 1080);
    var x = (innerWidth - 1920 * escala) / 2;
    var y = (innerHeight - 1080 * escala) / 2;
    palco.style.transform = "translate(" + x + "px," + y + "px) scale(" + escala + ")";
  }
  function mostrar(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, k) {
      s.classList.toggle("active", k === i);
      s.classList.toggle("visible", k === i);
    });
    conta.textContent = (i + 1) + " / " + slides.length;
  }
  document.getElementById("ant").addEventListener("click", function () { mostrar(i - 1); });
  document.getElementById("prox").addEventListener("click", function () { mostrar(i + 1); });
  addEventListener("keydown", function (e) {
    if (["ArrowRight", "PageDown", " "].indexOf(e.key) >= 0) { e.preventDefault(); mostrar(i + 1); }
    if (["ArrowLeft", "PageUp"].indexOf(e.key) >= 0) { e.preventDefault(); mostrar(i - 1); }
    if (e.key === "Home") mostrar(0);
    if (e.key === "End") mostrar(slides.length - 1);
  });
  addEventListener("resize", ajustar);
  var p = new URLSearchParams(location.search);
  if (p.has("export") || /Headless|Playwright/i.test(navigator.userAgent)) {
    document.body.classList.add("exportando");
  }
  ajustar(); mostrar(0);
})();
</script>
</body>
</html>`;
}

/* A paleta é a dos dossiês (core/lib/dossie-*-template.ts) de propósito: o case
   sai da mesma casa que o Raio-X, e marca própria por documento seria aparência
   a mais para manter. */
const CSS = `
:root{
  --navy:#10263f; --navy-2:#17395c; --teal:#27a69a; --teal-esc:#1d7d72;
  --ink:#1d2b36; --muted:#6b7d88; --line:#dbe4e8; --wash:#f7fafa;
  --good:#22856f;
  --papel:#f4f7f8; --superficie:#ffffff;
  --fonte:Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#0b1a29;
  font-family:var(--fonte);color:var(--ink);-webkit-font-smoothing:antialiased}
.deck-viewport{position:fixed;inset:0;overflow:hidden;background:#0b1a29}
.deck-stage{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden;
  transform-origin:0 0;background:var(--papel)}
.slide{position:absolute;inset:0;width:1920px;height:1080px;overflow:hidden;display:block;
  visibility:hidden;opacity:0;pointer-events:none;background:var(--papel)}
.slide.active,.slide.visible{visibility:visible;opacity:1;pointer-events:auto;z-index:1}

.pad{padding:56px 76px 44px;height:100%;position:relative;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:34px;flex:none}
.lockup{display:flex;align-items:center;gap:14px}
.lockup img,.marca-vazia{width:52px;height:52px;border-radius:11px;display:block}
.marca-vazia{background:var(--teal)}
.lockup .marca{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1;color:var(--navy)}
.lockup .marca-sub{margin-top:4px;font-size:13px;color:var(--muted)}
.slide.dark .lockup .marca{color:#fff}
.slide.dark .lockup .marca-sub{color:rgba(255,255,255,.62)}
.kicker{display:inline-flex;align-items:center;padding:10px 18px;border-radius:999px;
  background:rgba(39,166,154,.10);border:1px solid rgba(39,166,154,.34);color:var(--teal-esc);
  font-size:13px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.slide.dark .kicker{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2);color:#8fe3d6}
h1.titulo{font-size:54px;line-height:1.05;font-weight:800;letter-spacing:-.03em;color:var(--navy);
  max-width:28ch;margin-bottom:12px}
h1.titulo em{font-style:normal;color:var(--good)}
p.lead{font-size:21px;line-height:1.45;color:var(--muted);max-width:92ch;margin-bottom:26px}
.rodape{margin-top:auto;flex:none;display:flex;justify-content:space-between;align-items:center;
  border-top:1px solid var(--line);padding-top:16px;font-size:14px;color:var(--muted)}
.slide.dark .rodape{border-top-color:rgba(255,255,255,.14);color:rgba(255,255,255,.5)}
.dots{display:flex;gap:7px;flex:none}
.dots span{width:7px;height:7px;border-radius:50%;background:var(--line)}
.dots span.on{background:var(--teal)}
.slide.dark .dots span{background:rgba(255,255,255,.2)}
.slide.dark .dots span.on{background:#8fe3d6}
.conf{border:1px solid #e2c084;color:#a66a10;background:#fdf9ee;border-radius:5px;padding:6px 12px;
  font-size:11px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}

.s-capa,.s-fim{background:linear-gradient(140deg,#0d2138 0%,#12314f 62%,#1b4a63 130%);color:#eef5f7}
.s-capa .pad,.s-fim .pad{border-top:9px solid var(--teal)}
.s-capa .corpo,.s-fim .corpo{display:grid;grid-template-columns:1.1fr .9fr;gap:52px;flex:1;align-items:center}
.capa-tag{display:inline-block;background:rgba(39,166,154,.16);border:1px solid rgba(39,166,154,.45);
  color:#8fe3d6;font-size:13px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;
  border-radius:999px;padding:9px 18px;margin-bottom:26px}
.capa-h1{font-size:68px;line-height:1.03;font-weight:800;letter-spacing:-.035em;color:#fff;max-width:16ch}
.capa-h1 em{font-style:normal;color:#8fe3d6}
.capa-sub{margin-top:26px;font-size:23px;line-height:1.5;color:#cfe0e6;max-width:42ch}
.capa-cidades{margin-top:34px;font-size:16px;color:#9fb6c2;letter-spacing:.02em;max-width:60ch;line-height:1.6}
.painel{background:rgba(255,255,255,.055);border:1px solid rgba(143,227,214,.3);border-radius:24px;
  padding:38px 34px;display:flex;flex-direction:column;gap:22px}
.painel .rot{font-size:13px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#8fe3d6}
.painel .valor{font-size:80px;font-weight:800;letter-spacing:-.04em;line-height:.98;color:#fff;margin-top:10px}
.painel .valor-sub{font-size:19px;color:#cfe0e6;margin-top:8px;line-height:1.4}
.painel .divisor{height:1px;background:rgba(255,255,255,.15)}
.painel .contraponto{background:rgba(0,0,0,.22);border-radius:14px;padding:18px 20px}
.painel .contraponto b{display:block;font-size:26px;font-weight:800;color:#8fe3d6;letter-spacing:-.02em}
.painel .contraponto span{font-size:15px;color:#bed3db;line-height:1.45;display:block;margin-top:5px}

.placar{display:grid;gap:20px;flex:1;margin-bottom:22px}
.placar .peca{background:var(--superficie);border:1px solid var(--line);border-radius:20px;
  padding:30px 26px;border-top:5px solid var(--teal);height:100%;
  display:flex;flex-direction:column;justify-content:center}
.placar .peca em{font-style:normal;display:block;font-size:20px;font-weight:800;color:var(--navy);
  letter-spacing:-.02em;margin-bottom:4px}
.placar .peca .per{font-size:12.5px;color:var(--muted);display:block;margin-bottom:16px}
.placar .peca b{display:block;font-size:50px;font-weight:800;color:var(--good);letter-spacing:-.035em;
  line-height:1}
.placar .peca span.cif{display:block;font-size:15px;color:var(--muted);margin-top:8px}
.antes-depois{margin-top:26px;padding-top:22px;border-top:1px solid var(--line);
  display:flex;flex-direction:column;gap:14px}
.ad{display:grid;grid-template-columns:42px 1fr;grid-template-rows:auto auto;gap:2px 10px;align-items:center}
.ad-rot{grid-row:1 / span 2;font-size:13px;font-weight:800;color:var(--muted)}
.ad-track{height:14px;border-radius:999px;background:#e8eef0;overflow:hidden;display:block}
.ad-fill{height:100%;border-radius:999px;display:block}
.ad-fill.antes{background:#9db2c0}
.ad-fill.depois{background:var(--teal)}
.ad-val{font-size:13px;font-weight:800;color:var(--ink);grid-column:2}

.faixa-total{display:flex;align-items:center;gap:30px;flex:none;
  background:var(--navy);color:#fff;border-radius:24px;padding:36px 38px}
.faixa-total .bloco{flex:1}
.faixa-total .bloco em{font-style:normal;display:block;font-size:13px;font-weight:800;letter-spacing:.12em;
  text-transform:uppercase;color:#8fe3d6;margin-bottom:12px}
.faixa-total .bloco b{display:block;font-size:54px;font-weight:800;letter-spacing:-.04em;line-height:1;color:#fff}
.faixa-total .bloco span{display:block;font-size:16px;color:#cfe0e6;margin-top:10px;line-height:1.45}
.faixa-total .bloco b.realce{display:inline;font-size:inherit;color:#8fe3d6;letter-spacing:normal}
.faixa-total .risco{width:1px;align-self:stretch;background:rgba(255,255,255,.18);flex:none}

.cidades-grid{display:grid;gap:20px;flex:1}
.cidade{background:var(--superficie);border:1px solid var(--line);border-radius:20px;padding:26px 24px;
  display:flex;flex-direction:column;justify-content:space-between;border-top:5px solid var(--line)}
.cidade.destaque-forte{border-top-color:var(--teal)}
.cidade header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:22px}
.cidade h3{font-size:25px;font-weight:800;color:var(--navy);letter-spacing:-.02em;line-height:1.15}
.cidade .cod{font-size:12.5px;color:var(--muted);display:block;margin-top:5px}
.cidade .ganho{flex:none;font-size:26px;font-weight:800;color:var(--good);letter-spacing:-.02em}
.serie{margin-bottom:20px}
.ano-linha{display:grid;grid-template-columns:46px 1fr auto;align-items:center;gap:11px;margin-bottom:22px}
.ano-linha:last-child{margin-bottom:0}
.ano-rot{font-size:14px;font-weight:800;color:var(--muted)}
.ano-linha.marco .ano-rot{color:var(--teal-esc)}
.track{height:22px;border-radius:999px;background:#e8eef0;overflow:hidden;display:block}
.fill{height:100%;border-radius:999px;background:var(--navy-2);display:block;position:relative}
.fill-compl{position:absolute;left:0;top:0;bottom:0;background:var(--teal);border-radius:999px 0 0 999px;display:block}
.ano-val{font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap}
.uniao{background:var(--wash);border-radius:12px;padding:14px 15px}
.uniao em{font-style:normal;display:block;font-size:11.5px;font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.uniao b{display:block;font-size:16px;font-weight:800;color:var(--navy);letter-spacing:-.01em}
.uniao span{display:block;font-size:13px;font-weight:700;color:var(--good);margin-top:4px}
.fecho{margin-top:20px;border-top:1px solid var(--line);padding-top:18px}
.fecho .cifra em{font-style:normal;display:block;font-size:12px;font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;color:var(--muted);margin-bottom:7px}
.fecho .cifra b{display:block;font-size:34px;font-weight:800;color:var(--navy);letter-spacing:-.03em;line-height:1}
.fecho .cifra span{display:block;font-size:13px;color:var(--muted);margin-top:7px;line-height:1.45}
.fecho .selo{margin-top:16px;background:rgba(39,166,154,.09);border:1px solid rgba(39,166,154,.3);
  border-radius:11px;padding:12px 13px;font-size:13.5px;line-height:1.4;font-weight:700;color:var(--teal-esc)}
.legenda{flex:none;margin-top:18px;font-size:13px;color:var(--muted)}
.legenda i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:middle;margin-right:5px}
.sw-total{background:var(--navy-2)} .sw-compl{background:var(--teal)}

.passos{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;flex:1;align-content:stretch}
.passo{background:var(--superficie);border:1px solid var(--line);border-radius:22px;padding:34px 32px;
  height:100%;display:flex;flex-direction:column}
.passo .n{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;color:#fff;
  font-size:21px;font-weight:800;margin-bottom:24px;background:var(--navy)}
.passo:nth-child(2) .n{background:var(--navy-2)}
.passo:nth-child(3) .n{background:var(--teal-esc)}
.passo h3{font-size:28px;font-weight:800;color:var(--navy);letter-spacing:-.02em;margin-bottom:14px}
.passo p{font-size:18px;line-height:1.55;color:var(--muted)}
.passo p b{color:var(--ink)}
.passo .saida{margin-top:auto;padding-top:22px;border-top:1px solid var(--line)}
.passo .saida em{font-style:normal;font-size:11px;font-weight:800;letter-spacing:.1em;
  text-transform:uppercase;color:var(--teal-esc);display:block;margin-bottom:6px}
.passo .saida strong{font-size:17px;color:var(--navy);font-weight:800;line-height:1.35;display:block}

.principio{margin-top:30px;border:1px solid rgba(143,227,214,.34);border-radius:16px;padding:22px 24px;
  background:rgba(255,255,255,.05);font-size:19px;line-height:1.5;color:#eef5f7;max-width:42ch}
.contato{margin-top:28px;font-size:17px;line-height:1.7;color:#cfe0e6}
.contato b{color:#fff}

@media print{
  @page{size:1920px 1080px;margin:0}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{width:1920px;height:auto;overflow:visible;background:#fff}
  .deck-viewport{position:static;overflow:visible;background:#fff}
  .deck-stage{position:static;width:auto;height:auto;transform:none!important;background:none}
  .slide{position:relative;display:block!important;visibility:visible!important;opacity:1!important;
    width:1920px;height:1080px;break-after:page;page-break-after:always}
  .slide:last-child{break-after:auto;page-break-after:auto}
  .controles{display:none!important}
}
.controles{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:1000;display:flex;
  gap:8px;align-items:center;background:rgba(13,33,56,.9);padding:9px 15px;
  border-radius:999px;border:1px solid rgba(255,255,255,.1);opacity:0;transition:opacity .25s ease}
body:not(.exportando) .deck-viewport:hover ~ .controles,
body:not(.exportando) .controles:hover{opacity:1}
body.exportando .controles{display:none!important}
.controles button{border:0;background:transparent;color:#fff;font:700 13px var(--fonte);cursor:pointer;
  padding:7px 11px;border-radius:999px}
.controles button:hover{background:rgba(255,255,255,.12)}
.controles .conta{color:rgba(255,255,255,.7);font:600 12px var(--fonte);min-width:50px;text-align:center}
`;
