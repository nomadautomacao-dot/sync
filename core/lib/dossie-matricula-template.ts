import { getCatalogoSegmentos } from "./fundeb-ponderacao";
import type {
  Conferencia,
  Corte,
  DossieMatricula,
  Fatia,
  SegmentoDossie,
} from "./dossie-matricula";

/**
 * Dossiê da Matrícula Ponderada — HTML de impressão.
 *
 * Mesma arquitetura de duas velocidades do Dossiê das Escolas: `section.page`
 * de altura fixa para capa e folhas de argumento, `section.flow` para o que
 * cresce com o município — a tabela de segmentos, os cortes, o anexo da
 * Portaria. Cabeçalho e rodapé das folhas de fluxo vêm de `@page`.
 *
 * A regra de dinheiro do documento: toda cifra derivada carrega a marca
 * `derivado` na própria tabela, e o rodapé de cada tabela que a exibe diz de
 * onde ela sai. O leitor precisa poder separar, sem perguntar, o que a
 * Portaria publicou do que este relatório calculou.
 */

const NBSP = " ";

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec3 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

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
/** Uma casa só quando ela diz alguma coisa — `33.020`, não `33.020,0`. */
const nA = (v: number | null | undefined) =>
  v == null ? "—" : Number.isInteger(v) ? inteiro.format(v) : dec1.format(v);
const n2 = (v: number | null | undefined) => (v == null ? "—" : dec2.format(v));
const n3 = (v: number | null | undefined) => (v == null ? "—" : dec3.format(v));
const pc = (v: number | null | undefined, casas = 1) =>
  v == null ? "—" : `${(casas === 2 ? dec2 : dec1).format(v)}%`;

function brl(v: number | null | undefined): string {
  return v == null ? "—" : `R$${NBSP}${dec2.format(v)}`;
}

function brlCompact(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$${NBSP}${dec2.format(v / 1_000_000)}${NBSP}mi`;
  if (abs >= 1_000) return `R$${NBSP}${dec1.format(v / 1_000)}${NBSP}mil`;
  return `R$${NBSP}${dec2.format(v)}`;
}

/** Cifra derivada: nunca aparece sem a marca. */
function derivado(v: number | null | undefined): string {
  return v == null ? "—" : `${brlCompact(v)}<sup class="d">d</sup>`;
}

export interface DossieMatriculaInput {
  municipio: string;
  uf: string;
  codigoIbge: string;
  dossie: DossieMatricula;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

/** Quantas linhas cabem na folha do VAAF × VAAT sem empurrar o rodapé. */
const LIMITE_DIVERGENCIA = 8;

const NOTA_DERIVADO =
  '<sup class="d">d</sup> <b>Cifra derivada, não repassada.</b> O art. 7º, §1º da Lei 14.113/2020 fixa os anos ' +
  "iniciais do fundamental urbano em jornada parcial como a referência de fator 1,00 — logo o valor aluno/ano " +
  "desse segmento na Portaria Interministerial é o preço de uma matrícula-equivalente na UF, e " +
  "<i>equivalentes × esse valor</i> repete a aritmética da própria Portaria. O que sai daí é ordem de grandeza " +
  "para leitura de composição, não valor empenhado: o repasse efetivo depende de VAAT, VAAR e do calendário de " +
  "distribuição.";

// ── barra proporcional ─────────────────────────────────────────────────────

function barra(pctValor: number, classe = ""): string {
  const largura = Math.max(0, Math.min(100, pctValor));
  return `<span class="trilho ${classe}"><i style="width:${largura.toFixed(2)}%"></i></span>`;
}

// ── tabelas ────────────────────────────────────────────────────────────────

function linhaSegmento(s: SegmentoDossie, maior: number): string {
  const rel = maior > 0 ? (s.equivalentes / maior) * 100 : 0;
  const destaque = (s.fatorVaaf ?? 0) > 1 ? "acima" : "";
  return `<tr class="seg ${destaque}">
    <td class="nome">${esc(s.nome)}</td>
    <td class="num">${n0(s.matriculas)}</td>
    <td class="num f">${n2(s.fatorVaaf)}</td>
    <td class="num f2">${n2(s.fatorVaat)}</td>
    <td class="num">${n1(s.equivalentes)}</td>
    <td class="num">${pc(s.participacao, 2)}</td>
    <td class="bar">${barra(rel)}</td>
    <td class="num v">${derivado(s.valorDerivado)}</td>
  </tr>`;
}

function tabelaCorte(c: Corte, totalPonderado: number): string {
  const linhas = c.fatias
    .map(
      (f: Fatia) => `<tr>
        <td class="nome">${esc(f.rotulo)}<span class="micro"> · ${n0(f.segmentos)} segmento(s)</span></td>
        <td class="num">${n0(f.matriculas)}</td>
        <td class="num sub">${pc(f.participacaoBruta)}</td>
        <td class="num">${n1(f.equivalentes)}</td>
        <td class="num"><b>${pc(f.participacao)}</b></td>
        <td class="bar">${barra(f.participacao)}</td>
        <td class="num f">${n3(f.fatorMedio)}</td>
        <td class="num v">${derivado(f.valorDerivado)}</td>
      </tr>`,
    )
    .join("");

  const soma = c.fatias.reduce((t, f) => t + f.matriculas, 0);

  return `<div class="corte">
    <h3>${esc(c.titulo)}</h3>
    <p class="corte-nota">${c.nota}</p>
    <table class="grid">
      <thead><tr>
        <th>Fatia</th><th class="num">Matrículas</th><th class="num">% bruta</th>
        <th class="num">Equivalentes</th><th class="num">% ponderada</th><th></th>
        <th class="num">Fator médio</th><th class="num">Receita derivada</th>
      </tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr>
        <td>Total</td><td class="num">${n0(soma)}</td><td class="num sub">100,0%</td>
        <td class="num">${n1(totalPonderado)}</td><td class="num">100,0%</td><td></td>
        <td class="num f">${n3(soma > 0 ? totalPonderado / soma : null)}</td><td></td>
      </tr></tfoot>
    </table>
  </div>`;
}

function blocoConferencia(c: Conferencia): string {
  const rotulo =
    c.situacao === "divergencia"
      ? "conferir"
      : c.situacao === "coerente"
        ? "bases concordam"
        : "sem base";

  const cifra =
    c.situacao === "divergencia" && c.ganhoEquivalentes !== null
      ? `<div class="conf-cifra">
          <em>Se a diferença for de forma e não de fato</em>
          <b>${n1(c.ganhoEquivalentes)}</b><span>matrículas-equivalentes</span>
          <div class="conf-brl">${derivado(c.valorDerivado)} por ano</div>
        </div>`
      : "";

  return `<article class="conf s-${c.situacao}">
    <header>
      <h3>${esc(c.titulo)}</h3>
      <span class="tag t-${c.situacao}">${rotulo}</span>
    </header>
    <div class="conf-corpo">
      <div class="conf-num">
        <table><tbody>
          <tr><td>Censo Escolar declara</td><td class="num"><b>${c.censo}</b></td></tr>
          <tr><td>Portaria pondera</td><td class="num"><b>${c.fnde}</b></td></tr>
          ${
            c.diferenca !== null
              ? `<tr><td>Diferença</td><td class="num ${c.situacao === "divergencia" ? "alerta" : ""}"><b>${n0(c.diferenca)}</b></td></tr>`
              : ""
          }
        </tbody></table>
      </div>
      <p class="conf-leitura">${c.leitura}</p>
      ${cifra}
    </div>
  </article>`;
}

// ── documento ──────────────────────────────────────────────────────────────

export function generateDossieMatriculaHtml(input: DossieMatriculaInput): string {
  const { dossie: d, municipio, uf } = input;
  const geradoEm = input.geradoEm ?? new Date();
  const responsavel = input.responsavel ?? "Adriel Tavares";
  const r = d.resumo;

  const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    geradoEm,
  );

  const marca = input.logoDataUri
    ? `<img src="${input.logoDataUri}" alt="" style="width:.42in;height:.42in;border-radius:8px">`
    : "";

  const maiorEquivalente = d.segmentos.reduce((m, s) => Math.max(m, s.equivalentes), 0);
  const somaMatriculas = d.segmentos.reduce((t, s) => t + s.matriculas, 0);
  const somaEquivalentes = d.segmentos.reduce((t, s) => t + s.equivalentes, 0);
  const somaValor = d.segmentos.reduce((t, s) => t + (s.valorDerivado ?? 0), 0);

  const catalogo = getCatalogoSegmentos();
  const declarados = new Map(d.segmentos.map((s) => [s.nome, s]));

  const linhasSegmentos = d.segmentos.map((s) => linhaSegmento(s, maiorEquivalente)).join("");

  const linhasCatalogo = catalogo
    .map((c) => {
      const s = declarados.get(c.nome);
      return `<tr class="cat ${s ? "on" : "off"}">
        <td class="nome">${esc(c.nome)}</td>
        <td class="num f">${n2(c.fatorVaaf)}</td>
        <td class="num f2">${n2(c.fatorVaat)}</td>
        <td class="num">${s ? `<b>${n0(s.matriculas)}</b>` : "—"}</td>
      </tr>`;
    })
    .join("");

  // ── conciliação ──────────────────────────────────────────────────────────
  const c = d.conciliacao;
  const blocosAbertos = c?.linhas.filter((l) => l.divergente && l.diferenca !== null) ?? [];
  const linhasConciliacao = c
    ? c.linhas
        .map(
          (l) => `<tr class="${l.divergente ? "div" : ""}">
            <td class="nome">${esc(l.rotulo)}<p class="micro">${l.nota}</p></td>
            <td class="num">${n0(l.censo)}</td>
            <td class="num">${n0(l.fnde)}</td>
            <td class="num ${l.divergente ? "alerta" : ""}">${l.diferenca == null ? "—" : (l.diferenca > 0 ? "+" : "") + n0(l.diferenca)}</td>
          </tr>`,
        )
        .join("")
    : "";

  // ── série ────────────────────────────────────────────────────────────────
  const anos = d.serie;
  const primeiro = anos[0] ?? null;
  const ultimo = anos[anos.length - 1] ?? null;
  const variacao =
    primeiro && ultimo && primeiro.matriculas > 0
      ? ((ultimo.matriculas - primeiro.matriculas) / primeiro.matriculas) * 100
      : null;

  const linhaSerie = (
    rotulo: string,
    valor: (a: (typeof anos)[number]) => number | null,
    formato: (v: number | null) => string,
    classe = "",
  ) =>
    `<tr class="${classe}"><td class="nome">${rotulo}</td>${anos
      .map((a) => `<td class="num">${formato(valor(a))}</td>`)
      .join("")}</tr>`;

  // ── oportunidades ────────────────────────────────────────────────────────
  const comDistancia = d.oportunidades.filter((o) => o.ganhoEquivalentesMediana > 0).length;

  const blocosOportunidade = d.oportunidades
    .map((o) => {
      const valorMediana =
        d.valorPorEquivalente === null ? null : o.ganhoEquivalentesMediana * d.valorPorEquivalente;
      const valorTeto =
        d.valorPorEquivalente === null ? null : o.ganhoEquivalentes * d.valorPorEquivalente;

      // Rede acima da mediana não tem distância a fechar. Imprimir R$ 0,00 no
      // lugar da cifra transformaria um bom resultado em achado vazio — e é
      // exatamente o tipo de linha que faz o leitor desconfiar do resto.
      const acimaDaMediana = o.ganhoEquivalentesMediana <= 0;

      const linhasAlvo = acimaDaMediana
        ? `<tr class="alvo"><td><b>Distância até a mediana nacional</b></td><td class="num"><b>já alcançada</b></td></tr>
           <tr><td>Teto aritmético — toda a matrícula migrando</td><td class="num sub">${derivado(valorTeto)}</td></tr>`
        : `<tr class="alvo"><td><b>Matrículas até alcançar a mediana</b></td><td class="num"><b>${n0(Math.round(o.matriculasAteMediana))}</b></td></tr>
           <tr class="alvo"><td><b>Ganho em equivalentes até a mediana</b></td><td class="num"><b>${n1(o.ganhoEquivalentesMediana)}</b></td></tr>
           <tr class="alvo"><td><b>Ordem de grandeza anual</b></td><td class="num"><b>${derivado(valorMediana)}</b></td></tr>
           <tr><td>Teto aritmético — toda a matrícula migrando</td><td class="num sub">${derivado(valorTeto)}</td></tr>`;

      const fecho = acimaDaMediana
        ? `<p class="oport-teto"><b>Esta rede já está acima da mediana nacional.</b> Não há distância a fechar
           aqui, e o dossiê registra isso em vez de forçar um achado: metade das redes municipais do país está
           abaixo do patamar que ${esc(municipio)} já pratica. O teto acima permanece na tabela como referência
           aritmética — ele supõe migração integral, que quatro em cada cinco redes não fazem.</p>`
        : `<p class="oport-teto"><b>Por que o alvo é a mediana e não o teto.</b> O teto supõe que toda creche
           parcial vire integral e que todo aluno de educação especial tenha AEE devido — quatro em cada cinco
           redes do país não estão lá, e cobrar o teto produz cifra que a base não sustenta. A mediana é alvo
           verificável: metade do país já a alcançou.</p>`;

      return `<article class="oport">
      <header><h3>${esc(o.titulo)}</h3><span class="tag ${acimaDaMediana ? "t-coerente" : "t-oport"}">${
        acimaDaMediana ? "acima da mediana" : "conferência"
      }</span></header>
      <div class="oport-grade">
        <div class="oport-medida">
          <em>A rede está em</em><b>${pc(o.indicador * 100)}</b>
          <div class="par">
            <span>esta rede</span>${barra(o.indicador * 100, "duplo")}<i>${pc(o.indicador * 100)}</i>
          </div>
          <div class="par mediana">
            <span>mediana nacional</span>${barra(o.mediana * 100, "duplo")}<i>${pc(o.mediana * 100)}</i>
          </div>
        </div>
        <table class="grid compacta"><tbody>
          <tr><td>Matrículas na condição de menor fator</td><td class="num">${n0(o.matriculas)}</td></tr>
          ${linhasAlvo}
        </tbody></table>
      </div>
      <p class="oport-detalhe">${o.detalhe}</p>
      ${fecho}
    </article>`;
    })
    .join("");

  // ── PNAE ─────────────────────────────────────────────────────────────────
  const pnae = d.pnae;
  const linhasPnae = pnae
    ? pnae.faixas
        .map(
          (f) => `<tr>
        <td class="nome">${esc(f.rotulo)}</td>
        <td class="num f">${brl(f.perCapita)}</td>
        <td class="num">${n0(f.matriculas)}</td>
        <td class="num">${n0(pnae.diasLetivos)}</td>
        <td class="num v"><b>${brlCompact(f.valorAnual)}</b></td>
      </tr>`,
        )
        .join("")
    : "";

  const eq = d.equidade;

  // ── VAAF × VAAT: onde as duas tabelas divergem nesta rede ────────────────
  const divergentes = d.segmentos
    .filter((s) => s.fatorVaaf !== null && s.fatorVaat !== null && s.fatorVaat > s.fatorVaaf)
    .map((s) => ({ s, delta: (s.fatorVaat ?? 0) - (s.fatorVaaf ?? 0) }))
    .sort((a, b) => b.delta - a.delta);

  const linhasDivergencia =
    divergentes.length > 0
      ? divergentes
          .slice(0, LIMITE_DIVERGENCIA)
          .map(
            ({ s, delta }) => `<tr>
        <td class="nome">${esc(s.nome)}</td>
        <td class="num">${n0(s.matriculas)}</td>
        <td class="num f">${n2(s.fatorVaaf)}</td>
        <td class="num f2">${n2(s.fatorVaat)}</td>
        <td class="num"><b>+${n2(delta)}</b></td>
        <td class="num v">${nA(s.equivalentesVaat - s.equivalentes)}</td>
      </tr>`,
          )
          .join("")
      : `<tr><td colspan="6" class="vazio">Nenhum segmento desta rede tem fator diferente entre as duas
         tabelas. É o padrão de redes concentradas no ensino fundamental, onde VAAF e VAAT coincidem em
         1,00 — a rede não ganha peso adicional na régua da complementação.</td></tr>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dossiê da Matrícula Ponderada — ${esc(municipio)}/${esc(uf)}</title>
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
    <span class="cover-tag">Dossiê temático &middot; composição do fundo</span>
    <h1>A matrícula<br><span class="thin">ponderada</span></h1>
    <p class="cover-sub">O FUNDEB não paga por aluno: paga por aluno <b>vezes fator</b>. Este dossiê abre a conta
    segmento a segmento — todos os ${n0(r.segmentosComMatricula)} que ${esc(municipio)} declara, com o fator de
    cada um, o que cada um vale e de onde o número saiu.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    <div class="cover-hero">
      <em>Quanto da receita do fundo vem da composição, e não do número de alunos</em>
      <div class="val"><b>${brlCompact(d.receitaDoPeso)}</b><i>por ano<sup class="d">d</sup></i></div>
      <p>São as ${nA(d.ponderadaVaaf - d.matriculas)} matrículas-equivalentes que a rede ganha por atender em
      creche, tempo integral, campo e educação especial em vez de só anos iniciais urbanos. É a parcela da
      receita que responde ao que se declara — e a única que uma correção cadastral alcança.</p>
    </div>
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(data)}</b>Portaria Interministerial ${d.exercicio}${
      d.censo ? ` &middot; Censo Escolar ${d.censo.anoReferencia}` : ""
    }</div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dossiê da Matrícula Ponderada</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Sumário</div>
    <h2>Duas redes do mesmo tamanho<br>não recebem o mesmo valor</h2>
    <p class="lede">A diferença inteira está na composição declarada. O fator vai de 1,00 — anos iniciais do
    fundamental urbano em jornada parcial, a referência do art. 7º, §1º da Lei 14.113/2020 — a 2,17, na creche
    integral indígena ou quilombola. Um mesmo aluno pode valer mais que o dobro de outro conforme a etapa, a
    jornada, a localização e a modalidade que a rede registrou no Censo.</p>

    <div class="kpis">
      ${kpi(n0(d.matriculas), "matrículas na filtragem do FNDE")}
      ${kpi(n1(d.ponderadaVaaf), "matrículas-equivalentes (VAAF)")}
      ${kpi(n3(d.fatorMedio), "fator médio da rede")}
      ${kpi(pc(r.participacaoAcimaDaReferencia), "da receita vem de fator > 1,00")}
    </div>

    <div class="duas">
      <div class="card">
        <h3>O que este documento faz que os outros não fazem</h3>
        <p class="txt">O Levantamento mostra a receita. O Raio-X mostra o fator médio e os doze segmentos de
        maior peso. Aqui entram <b>todos os ${n0(r.segmentosComMatricula)}</b>, com matrículas, os dois fatores,
        equivalentes, participação e a conta aberta — mais cinco cortes transversais do mesmo total, a
        conciliação com o Censo que o próprio município preencheu e a série que mostra para onde a composição
        está indo.</p>
        <table><tbody>
          <tr><td>Segmentos com matrícula declarada</td><td class="num"><b>${n0(r.segmentosComMatricula)}</b></td></tr>
          <tr><td>Segmentos na tabela da Portaria</td><td class="num">${n0(catalogo.length)}</td></tr>
          <tr><td>Matrículas em segmento de fator acima de 1,00</td><td class="num"><b>${n0(r.matriculasAcimaDaReferencia)}</b></td></tr>
          <tr><td>Matrículas em rede conveniada</td><td class="num">${n0(d.matriculasConveniadas)}</td></tr>
          <tr><td>Divergências entre bases a conferir</td><td class="num ${r.divergencias > 0 ? "alerta" : ""}"><b>${n0(r.divergencias)}</b></td></tr>
        </tbody></table>
      </div>
      <div class="card">
        <h3>A régua dos fatores</h3>
        <p class="txt">A tabela da Portaria em uma escala. Cada degrau é uma decisão de declaração — nenhum
        deles é estimativa.</p>
        <table class="regua"><tbody>
          ${degrau("1,00", "Anos iniciais do fundamental, urbano, parcial", "referência legal", 100 / 2.17)}
          ${degrau("1,15", "O mesmo, no campo", "+15%", 115 / 2.17)}
          ${degrau("1,25", "Creche pública parcial urbana", "+25%", 125 / 2.17)}
          ${degrau("1,50", "Fundamental em tempo integral", "+50%", 150 / 2.17)}
          ${degrau("1,55", "Creche pública integral urbana", "+55%", 155 / 2.17)}
          ${degrau("1,75", "Creche parcial indígena ou quilombola", "+75%", 175 / 2.17)}
          ${degrau("2,17", "Creche integral indígena ou quilombola", "teto da tabela", 100)}
        </tbody></table>
        <p class="micro" style="margin-top:.07in">O AEE não está na régua porque não substitui o fator da
        etapa: ele <b>soma</b> 1,40, como matrícula adicional do mesmo aluno (art. 8º, §3º, I).</p>
      </div>
    </div>

    <div class="faixa-derivado">
      <h3>Sobre as cifras em reais deste dossiê</h3>
      <p>${NOTA_DERIVADO}</p>
      ${
        d.valorPorEquivalente !== null
          ? `<p class="vpe">Valor de uma matrícula-equivalente em ${esc(d.uf)}, exercício ${d.exercicio}:
             <b>${brl(d.valorPorEquivalente)}</b> — Portaria Interministerial MEC/MF, Anexo I.</p>`
          : `<p class="vpe">A Portaria da UF ${esc(d.uf)} não foi localizada nesta emissão: as colunas em reais
             saem vazias, e nenhum valor é estimado no lugar delas.</p>`
      }
    </div>

    <p class="fonte">Fontes: FNDE — planilha de matrículas ponderadas do FUNDEB ${d.exercicio}; Portaria
    Interministerial MEC/MF (valores aluno/ano por UF); INEP — Censo Escolar${
      d.censo ? ` ${d.censo.anoReferencia}` : ""
    } e microdados de equidade; Resolução CD/FNDE nº 4/2026 (PNAE).</p>
  </div>
  <div class="page-footer"><span>FNDE &middot; INEP &middot; Portaria Interministerial MEC/MF</span><span>2</span></div>
</section>

${
  c
    ? `<section class="page content">
  <div class="page-header"><strong>Dossiê da Matrícula Ponderada</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Conciliação</div>
    <h2>O número do FNDE veio do Censo<br>que o município preencheu</h2>
    <p class="lede">São ${n0(c.fndeTotal)} matrículas na filtragem do fundo e ${n0(c.censoTotal)} na rede
    municipal do Censo ${c.anoCenso}. A diferença assusta quem vê pela primeira vez, e tem três causas
    conhecidas — nenhuma delas é erro. Feita a ponte, ${
      c.fecha
        ? "o resíduo fecha."
        : `${blocosAbertos.length === 1 ? "um bloco não fecha" : `${blocosAbertos.length} blocos não fecham`}
           — e é aí que está a informação desta folha.`
    }</p>

    <table class="grid conc">
      <thead><tr>
        <th>Bloco</th>
        <th class="num">Censo ${c.anoCenso}<span class="micro"><br>rede municipal</span></th>
        <th class="num">Portaria ${d.exercicio}<span class="micro"><br>filtragem do fundo</span></th>
        <th class="num">Diferença</th>
      </tr></thead>
      <tbody>${linhasConciliacao}</tbody>
      <tfoot><tr>
        <td>Total</td>
        <td class="num">${n0(c.censoTotal)}</td>
        <td class="num">${n0(c.fndeTotal)}</td>
        <td class="num ${c.fecha ? "" : "alerta"}"><b>${c.residuo === 0 ? "fecha" : (c.residuo > 0 ? "+" : "") + n0(c.residuo)}</b></td>
      </tr></tfoot>
    </table>

    <div class="porque">
      <h3>Por que a ponte é necessária</h3>
      <ol>
        <li><b>O AEE gera dupla matrícula.</b> O art. 8º, §3º, I da Lei 14.113/2020 conta o mesmo aluno duas
        vezes: uma na escolarização, outra no atendimento especializado. São ${n0(c.aee)} matrículas que existem
        no fundo e não na contagem de alunos do Censo — não é duplicidade indevida, é a única que a lei
        autoriza.</li>
        <li><b>As conveniadas entram no fundo sem estar na rede.</b> ${
          c.conveniadas > 0
            ? `São ${n0(c.conveniadas)} matrículas de instituições comunitárias, confessionais ou filantrópicas de educação infantil (art. 7º, §2º). Contam para o município no fundo, mas no Censo estão na dependência privada.`
            : "O município não declara matrícula conveniada nesta filtragem, então esta parcela é zero."
        }</li>
        <li><b>A educação especial é recorte transversal.</b> No Censo ela está dentro da etapa; na Portaria é
        segmento próprio. Por isso a conciliação é por bloco, e não etapa a etapa: seria comparar taxonomias
        diferentes e chamar a diferença de erro.</li>
      </ol>
      <p class="fecho">${
        c.fecha
          ? "Feita a ponte, os dois lados fecham dentro da tolerância. Na prática isso significa que a receita do fundo é rastreável até a declaração que a própria secretaria fez — e que a correção de uma declaração muda a receita do exercício seguinte."
          : `<b>O achado desta folha.</b> ${blocosAbertos
              .map(
                (l) =>
                  `Em <b>${esc(l.rotulo.toLowerCase())}</b> a Portaria pondera ${n0(Math.abs(l.diferenca!))} ${
                    Math.abs(l.diferenca!) === 1 ? "matrícula" : "matrículas"
                  } ${l.diferenca! < 0 ? "a menos" : "a mais"} que o Censo da rede municipal.`,
              )
              .join(" ")} As duas bases saem da mesma coleta, então uma diferença desse tamanho é de
             classificação — etapa ou modalidade lançada num código que a filtragem do fundo lê de outro
             jeito. Conferir antes da próxima coleta, que é a janela em que o número ainda muda.`
      }</p>
    </div>

    <p class="fonte">Fontes: FNDE — matrículas ponderadas ${d.exercicio}; INEP — Censo Escolar ${c.anoCenso},
    agregado por município e dependência administrativa.</p>
  </div>
  <div class="page-footer"><span>Conciliação Censo Escolar × filtragem do FUNDEB</span><span>3</span></div>
</section>`
    : ""
}

<section class="page content">
  <div class="page-header"><strong>Dossiê da Matrícula Ponderada</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Os dois denominadores</div>
    <h2>VAAF e VAAT não usam<br>a mesma tabela de fatores</h2>
    <p class="lede">Quase ninguém na secretaria sabe disso, e é o que explica por que a mesma rede aparece com
    dois totais ponderados diferentes na mesma Portaria. A União sobrepesa a educação infantil na tabela do
    VAAT — creche integral pública urbana vale 1,55 no VAAF e 1,90 no VAAT; anos iniciais valem 1,00 nos dois.
    A escolha é deliberada: é onde a complementação quis induzir oferta.</p>

    <div class="dois-denominadores">
      <div class="den">
        <em>VAAF</em>
        <b>${n1(d.ponderadaVaaf)}</b>
        <span>matrículas-equivalentes</span>
        <p>Rateia o fundo de origem estadual — a cesta de impostos do art. 3º, mais a complementação de 10% da
        União distribuída para chegar ao valor mínimo por aluno. Todo município recebe por este denominador.</p>
        <div class="den-fator">fator médio <b>${n3(d.fatorMedio)}</b></div>
      </div>
      <div class="den vaat">
        <em>VAAT</em>
        <b>${n1(d.ponderadaVaat)}</b>
        <span>matrículas-equivalentes</span>
        <p>Rateia os 10,5 pontos da complementação da União destinados a elevar o valor por aluno considerando
        também a receita própria do ente. Só os municípios abaixo do limite recebem — mas o denominador existe
        para todos, e é ele que muda de tabela.</p>
        <div class="den-fator">fator médio <b>${n3(d.fatorMedioVaat)}</b></div>
      </div>
      <div class="den delta">
        <em>Diferença</em>
        <b>${d.ponderadaVaat > d.ponderadaVaaf ? "+" : ""}${n1(d.ponderadaVaat - d.ponderadaVaaf)}</b>
        <span>equivalentes a mais no VAAT</span>
        <p>${
          d.ponderadaVaat > d.ponderadaVaaf
            ? "A composição desta rede é mais valiosa na régua do VAAT que na do VAAF. Traduzindo: a rede pesa mais na complementação da União do que no rateio estadual — e é por isso que a habilitação ao VAAT importa tanto aqui."
            : "A composição desta rede não ganha peso adicional na régua do VAAT. É o padrão de redes concentradas no fundamental, onde as duas tabelas coincidem em 1,00."
        }</p>
        <div class="den-fator">${pc(d.ponderadaVaaf > 0 ? ((d.ponderadaVaat - d.ponderadaVaaf) / d.ponderadaVaaf) * 100 : null, 2)} de diferença</div>
      </div>
    </div>

    <h3 class="sub">Onde as duas tabelas mais divergem, nesta rede</h3>
    <p class="sub-nota">Os segmentos declarados por ${esc(municipio)} ordenados pela distância entre os dois
    fatores. São eles que fazem a rede pesar mais na complementação da União do que no rateio estadual — e é
    neles que uma correção cadastral rende duas vezes.</p>
    <table class="grid divergencia">
      <thead><tr>
        <th>Segmento</th><th class="num">Matrículas</th><th class="num">VAAF</th><th class="num">VAAT</th>
        <th class="num">Distância</th><th class="num">Equivalentes a mais no VAAT</th>
      </tr></thead>
      <tbody>${linhasDivergencia}</tbody>
    </table>
    ${
      divergentes.length > LIMITE_DIVERGENCIA
        ? `<p class="micro" style="margin-top:.06in">Mostrados os ${LIMITE_DIVERGENCIA} de maior distância, de
           ${n0(divergentes.length)} segmentos em que as duas tabelas diferem. Os demais estão na tabela completa
           e no anexo, ambos com as duas colunas de fator.</p>`
        : ""
    }

    <p class="fonte">Fonte: FNDE — tabelas de ponderação VAAF e VAAT da Portaria Interministerial MEC/MF
    ${d.exercicio}, aplicadas às matrículas do município. Onde as duas colunas coincidem, o segmento não
    aparece nesta tabela: a distância é zero.</p>
  </div>
  <div class="page-footer"><span>Os dois denominadores da mesma Portaria</span><span>${c ? 4 : 3}</span></div>
</section>

<section class="flow">
  <h2 class="secao">Todos os segmentos, com a conta aberta</h2>
  <p class="secao-sub">Os ${n0(d.segmentos.length)} segmentos que ${esc(municipio)} declara, do que mais pesa ao
  que menos pesa. As linhas destacadas são as de fator acima de 1,00 — as que fazem a receita subir sem que o
  número de alunos mude. O rodapé confere: a soma dos equivalentes tem de bater com o total ponderado da
  Portaria.</p>

  <table class="grid segs">
    <thead><tr>
      <th>Segmento</th><th class="num">Matrículas</th>
      <th class="num">Fator<br>VAAF</th><th class="num">Fator<br>VAAT</th>
      <th class="num">Equivalentes</th><th class="num">% do total</th><th></th>
      <th class="num">Receita derivada</th>
    </tr></thead>
    <tbody>${linhasSegmentos}</tbody>
    <tfoot><tr>
      <td><b>Total declarado</b></td>
      <td class="num"><b>${n0(somaMatriculas)}</b></td>
      <td class="num f">${n3(d.fatorMedio)}</td>
      <td class="num f2">${n3(d.fatorMedioVaat)}</td>
      <td class="num"><b>${n1(somaEquivalentes)}</b></td>
      <td class="num"><b>100,00%</b></td><td></td>
      <td class="num v"><b>${brlCompact(somaValor)}</b></td>
    </tr></tfoot>
  </table>
  <p class="rodape-tabela"><b>Conferência.</b> A Portaria publica ${n1(d.ponderadaVaaf)} matrículas-equivalentes
  para ${esc(municipio)}; a soma da coluna acima dá ${n1(somaEquivalentes)}. ${
    Math.abs(somaEquivalentes - d.ponderadaVaaf) < 1
      ? "As duas batem — a tabela reconstrói o número oficial a partir dos fatores publicados."
      : `A diferença de ${n1(Math.abs(somaEquivalentes - d.ponderadaVaaf))} vem do arredondamento dos fatores derivados da planilha do FNDE, que publica valores já ponderados e não os multiplicadores.`
  }</p>
  <p class="nota-d">${NOTA_DERIVADO}</p>
</section>

<section class="flow">
  <h2 class="secao">O mesmo total, cortado de cinco maneiras</h2>
  <p class="secao-sub">Cada corte reparte exatamente as mesmas ${n0(d.matriculas)} matrículas e os mesmos
  ${n1(d.ponderadaVaaf)} equivalentes. A coluna que interessa é a distância entre <b>% bruta</b> e
  <b>% ponderada</b>: onde a segunda supera a primeira, aquela fatia carrega mais receita do que carrega
  alunos.</p>
  ${d.cortes.map((corte) => tabelaCorte(corte, d.ponderadaVaaf)).join("")}
  <p class="nota-d">${NOTA_DERIVADO}</p>
</section>

${
  d.conferencias.length > 0
    ? `<section class="flow">
  <h2 class="secao">Censo contra Portaria, indicador a indicador</h2>
  <p class="secao-sub">As duas bases saem da mesma coleta, mas leem campos diferentes. Onde discordam, o motivo
  costuma ser de forma — e forma se corrige na coleta seguinte, que é a única janela em que o número ainda muda.
  ${
    d.resumo.divergencias > 0
      ? `<b>${n0(d.resumo.divergencias)} ${d.resumo.divergencias === 1 ? "divergência" : "divergências"} ${d.resumo.divergencias === 1 ? "aparece" : "aparecem"} primeiro.</b>`
      : "Nenhuma divergência acima da tolerância nesta emissão — o que já é resultado, e vale registrar."
  }</p>
  ${d.conferencias.map(blocoConferencia).join("")}
  <p class="nota-d">${NOTA_DERIVADO}</p>
</section>`
    : ""
}

${
  d.oportunidades.length > 0
    ? `<section class="flow">
  <h2 class="secao">As conferências que a planilha sustenta</h2>
  <p class="secao-sub">Não são acusações: a creche pode ser legitimamente parcial e o AEE pode não ser devido.
  O que o dossiê faz é pôr o valor em jogo na mesa e dizer onde conferir. ${
    comDistancia === 0
      ? "Nesta rede, nenhuma tem distância a fechar até a mediana nacional — e aparecem assim mesmo, porque o resultado também é informação."
      : comDistancia === d.oportunidades.length
        ? "Todas com distância a fechar."
        : `${comDistancia} de ${d.oportunidades.length} com distância a fechar.`
  }</p>
  ${blocosOportunidade}
  <p class="nota-d">${NOTA_DERIVADO}</p>
</section>`
    : ""
}

${
  anos.length > 0
    ? `<section class="flow">
  <h2 class="secao">Para onde a composição está indo</h2>
  <p class="secao-sub">A ponderação de um exercício é uma fotografia. Esta é a série: ${anos.length} anos do
  Censo Escolar da rede municipal de ${esc(municipio)}, nas grandezas que o fator remunera.${
    variacao !== null
      ? ` A matrícula total ${variacao < 0 ? "caiu" : "subiu"} ${pc(Math.abs(variacao))} entre ${primeiro!.ano} e ${ultimo!.ano}.`
      : ""
  }</p>

  <table class="grid serie">
    <thead><tr><th>Grandeza</th>${anos.map((a) => `<th class="num">${a.ano}</th>`).join("")}</tr></thead>
    <tbody>
      ${linhaSerie("Matrículas na rede municipal", (a) => a.matriculas, n0, "forte")}
      ${linhaSerie("Creche", (a) => a.creche, n0)}
      ${linhaSerie("Creche em tempo integral", (a) => a.crecheIntegral, n0)}
      ${linhaSerie("Creche integral — participação", (a) => a.crecheIntegralPct, (v) => pc(v), "pctl")}
      ${linhaSerie("Pré-escola", (a) => a.preEscola, n0)}
      ${linhaSerie("Pré-escola em tempo integral", (a) => a.preEscolaIntegral, n0)}
      ${linhaSerie("Ensino fundamental", (a) => a.fundamental, n0)}
      ${linhaSerie("Fundamental em tempo integral", (a) => a.fundamentalIntegral, n0)}
      ${linhaSerie("Fundamental integral — participação", (a) => a.fundamentalIntegralPct, (v) => pc(v), "pctl")}
      ${linhaSerie("Educação de jovens e adultos", (a) => a.eja, n0)}
      ${linhaSerie("Educação especial", (a) => a.especial, n0)}
    </tbody>
  </table>

  <p class="rodape-tabela"><b>Como ler esta tabela.</b> As duas linhas de participação são as que o fundo
  remunera diretamente: tempo integral pondera de 20% a 50% acima da mesma etapa em jornada parcial. Matrícula
  que cai reduz a receita do exercício seguinte com dois anos de defasagem — a Portaria de um ano usa o Censo
  do ano anterior —, e é por isso que a série importa mais que o número isolado.</p>
</section>`
    : ""
}

${
  pnae
    ? `<section class="flow junta">
  <h2 class="secao">A segunda receita da mesma matrícula</h2>
  <p class="secao-sub">O Censo Escolar não define só o FUNDEB. A alimentação escolar é rateada pelas
  <b>mesmas matrículas</b>, pela fórmula VT = A × D × C do art. 47 da Resolução CD/FNDE nº 4/2026, com
  ${n0(pnae.diasLetivos)} dias letivos. Um erro de declaração custa duas vezes.</p>

  <table class="grid">
    <thead><tr>
      <th>Faixa do Anexo V</th><th class="num">Per capita/dia</th><th class="num">Matrículas</th>
      <th class="num">Dias</th><th class="num">Estimativa anual</th>
    </tr></thead>
    <tbody>${linhasPnae}</tbody>
    <tfoot><tr>
      <td><b>Total</b></td><td></td>
      <td class="num"><b>${n0(pnae.matriculasConsideradas)}</b></td>
      <td class="num">${n0(pnae.diasLetivos)}</td>
      <td class="num v"><b>${brlCompact(pnae.valorAnual)}</b></td>
    </tr></tfoot>
  </table>

  <p class="rodape-tabela"><b>É estimativa, não o valor empenhado.</b> O FNDE reparte por entidade executora,
  admite delegação de rede entre entes e usa o Censo do ano anterior. O que a tabela dá é a ordem de grandeza
  que as matrículas atuais justificam — útil para comparar com o que o município de fato recebeu, não para
  substituí-lo. O AEE entra como contraturno e por isso não soma ao total de estudantes: contá-lo duplicaria
  o aluno.<br>Fonte: ${esc(pnae.fonte)}.</p>
</section>`
    : ""
}

${
  eq?.escolas
    ? `<section class="flow junta">
  <h2 class="secao">Território declarado, fator recebido</h2>
  <p class="secao-sub">Localização diferenciada é campo do Censo, preenchido uma vez por unidade, e vale
  ponderação em toda etapa. A tabela cruza o que as escolas declaram com o que a Portaria pondera.</p>

  <table class="grid">
    <thead><tr><th>Condição declarada nas escolas</th><th class="num">Escolas municipais</th><th class="num">Matrículas ponderadas na condição</th></tr></thead>
    <tbody>
      <tr><td class="nome">Total da rede municipal</td><td class="num"><b>${n0(eq.escolas.municipaisTotal)}</b></td><td class="num">${n0(d.matriculas)}</td></tr>
      <tr><td class="nome">Zona rural</td><td class="num">${n0(eq.escolas.municipaisRurais)}</td><td class="num">${n0(somaLocalizacao(d, "campo"))}</td></tr>
      <tr><td class="nome">Terra indígena</td><td class="num">${n0(eq.escolas.municipaisTerraIndigena)}</td><td class="num">${n0(somaLocalizacao(d, "indigena"))}</td></tr>
      <tr><td class="nome">Remanescente de quilombo</td><td class="num">${n0(eq.escolas.municipaisQuilombolas)}</td><td class="num">${n0(somaLocalizacao(d, "quilombola"))}</td></tr>
      <tr><td class="nome">Assentamento</td><td class="num">${n0(eq.escolas.municipaisAssentamento)}</td><td class="num sub">segue o fator do campo</td></tr>
      <tr><td class="nome">Educação escolar indígena</td><td class="num">${n0(eq.escolas.municipaisEducacaoIndigena)}</td><td class="num">${n0(somaModalidade(d, "bilingue"))}</td></tr>
    </tbody>
  </table>

  <p class="rodape-tabela"><b>Escola não é matrícula.</b> A coluna da esquerda conta unidades e a da direita
  conta alunos, então as duas nunca se igualam — o que se lê aqui é presença: condição declarada em escola e
  ausente na ponderação merece conferência, porque o fator segue a declaração, não a realidade do terreno.
  ${
    eq.naoDeclaradaPct !== null
      ? `A cor/raça não declarada nesta rede é de ${pc(eq.naoDeclaradaPct)}${eq.cadastroFragil ? " — acima de um terço, o que torna qualquer leitura por cor/raça mais uma descrição do preenchimento do Censo do que dos alunos" : ""}.`
      : ""
  }<br>Fonte: ${esc(eq.fonte)}, Censo ${eq.anoCenso}.</p>
</section>`
    : ""
}

<section class="flow">
  <h2 class="secao">Anexo — a tabela da Portaria, inteira</h2>
  <p class="secao-sub">Os ${n0(catalogo.length)} segmentos da ponderação ${d.exercicio} com os dois fatores.
  Em destaque, os ${n0(d.segmentos.length)} que ${esc(municipio)} declara. Segmento vazio quase sempre é oferta
  que não existe — mas nem sempre, e é para essa leitura que o anexo serve. Fator em branco significa que a
  Portaria não publicou multiplicador para a combinação, por não haver matrícula no país inteiro.</p>

  <table class="grid catalogo">
    <thead><tr><th>Segmento</th><th class="num">Fator VAAF</th><th class="num">Fator VAAT</th><th class="num">Matrículas aqui</th></tr></thead>
    <tbody>${linhasCatalogo}</tbody>
  </table>

  <p class="fonte" style="margin-top:.2in">Emitido em ${esc(data)} por ${esc(responsavel)} &middot;
  Global Company Consultorias. Documento confidencial, destinado exclusivamente ao município analisado.
  Fonte primária: ${esc(d.fonte)}.</p>
</section>

</body></html>`;
}

function somaLocalizacao(d: DossieMatricula, chave: string): number {
  return d.segmentos.reduce((t, s) => (s.localizacao === chave ? t + s.matriculas : t), 0);
}

function somaModalidade(d: DossieMatricula, chave: string): number {
  return d.segmentos.reduce((t, s) => (s.modalidade === chave ? t + s.matriculas : t), 0);
}

function kpi(valor: string, rotulo: string): string {
  return `<div class="kpi"><b>${valor}</b><span>${rotulo}</span></div>`;
}

function degrau(fator: string, rotulo: string, nota: string, largura: number): string {
  return `<tr>
    <td class="rf">${fator}</td>
    <td class="rb">${barra(largura, "regua")}</td>
    <td class="rr">${rotulo}<span class="micro"> · ${nota}</span></td>
  </tr>`;
}

const CSS = `
:root{--navy:#10263f;--teal:#27a69a;--ink:#1d2b36;--muted:#6b7d88;--line:#dbe4e8;
  --wash:#f7fafa;--red:#b0413e;--gold:#b7801f;--good:#22856f;--violet:#5a5fa8}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--ink);
  font-size:9pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}

@page{size:letter;margin:.62in .62in .55in}
@page:first{margin:0}

/* ── regime 1: altura fixa ───────────────────────────────────────────────── */
section.page{width:8.5in;height:11in;overflow:hidden;position:relative;page-break-after:always;break-after:page}
section.page.content{padding:0}
.page-header{position:absolute;top:.42in;left:.62in;right:.62in;display:flex;justify-content:space-between;
  align-items:baseline;padding-bottom:.07in;border-bottom:1px solid var(--line);
  font-size:7.4pt;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.page-header strong{color:var(--navy);font-weight:800}
.page-footer{position:absolute;bottom:.4in;left:.62in;right:.62in;display:flex;justify-content:space-between;
  font-size:7pt;color:var(--muted);border-top:1px solid var(--line);padding-top:.06in}
section.page.content .body{position:absolute;top:.82in;left:.62in;right:.62in;bottom:.62in;overflow:hidden}

/* ── regime 2: fluxo ─────────────────────────────────────────────────────── */
section.flow{page-break-before:always;break-before:page}
/* Seções curtas que continuam na mesma folha em vez de gastar uma inteira. */
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
  letter-spacing:.13em;text-transform:uppercase;max-width:4.4in;line-height:1.4}
.cover-hero .val{display:flex;align-items:baseline;gap:.14in;margin-top:.08in}
.cover-hero .val b{color:var(--teal);font-size:40pt;font-weight:700;letter-spacing:-.035em;line-height:.92}
.cover-hero .val i{font-style:normal;background:var(--teal);color:#fff;font-size:9pt;font-weight:800;
  border-radius:999px;padding:.045in .13in;white-space:nowrap}
.cover-hero .val i .d{color:#d6f2ee}
.cover-hero p{margin-top:.1in;color:#44545f;font-size:8.3pt;line-height:1.42;max-width:5in}
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
.kpi b{display:block;color:var(--navy);font-size:16pt;letter-spacing:-.02em;line-height:1}
.kpi span{display:block;color:var(--muted);font-size:6.6pt;font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;margin-top:.05in;line-height:1.3}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.2in}
.card{border:1px solid var(--line);border-radius:8px;padding:.14in .16in;background:#fff}
.card h3{font-size:10.5pt;color:var(--navy);margin-bottom:.07in}
.card .txt{font-size:8pt;line-height:1.45;color:#44545f;margin-bottom:.08in}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.042in 0;border-bottom:1px solid #eef3f5;vertical-align:top}
table td.num{text-align:right;color:var(--navy);white-space:nowrap}
td.num.sub,th.num.sub{color:var(--muted)}
td.alerta{color:var(--red)}
.micro{font-size:6.8pt;color:var(--muted);line-height:1.35;font-weight:400}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}

/* ── régua de fatores ────────────────────────────────────────────────────── */
.regua td{border:0;padding:.028in 0}
.regua .rf{width:.42in;font-weight:800;color:var(--navy);font-size:8pt}
.regua .rb{width:1.15in;padding-right:.08in}
.regua .rr{font-size:7.6pt;color:#44545f;line-height:1.3}

/* ── faixa de aviso sobre derivação ──────────────────────────────────────── */
.faixa-derivado{margin-top:.2in;border:1px solid #e2c084;background:#fdf9ee;border-radius:8px;padding:.13in .16in}
.faixa-derivado h3{font-size:9pt;color:#8a5a0d;margin-bottom:.05in}
.faixa-derivado p{font-size:7.6pt;line-height:1.45;color:#5d4a2c}
.faixa-derivado .vpe{margin-top:.06in;color:#8a5a0d}
/* A margem não é estética: colado, "R$ 17,40 miᵈ" se lê como "R$ 17,40 mil" —
   erro de mil vezes na coluna de dinheiro. */
sup.d{color:var(--gold);font-weight:800;font-size:.7em;margin-left:.03in}

/* ── conciliação ─────────────────────────────────────────────────────────── */
.grid{margin-top:.14in;font-size:8pt}
.grid thead th{text-align:left;font-size:6.8pt;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  font-weight:800;padding:0 0 .05in;border-bottom:1.5px solid var(--navy);vertical-align:bottom}
.grid thead th.num{text-align:right}
.grid tbody td{padding:.05in 0;border-bottom:1px solid #eef3f5}
.grid tbody td.nome{padding-right:.14in}
.grid tfoot td{padding:.06in 0 0;border-top:1.5px solid var(--navy);font-weight:700;color:var(--navy)}
.grid tfoot td.num{text-align:right}
.grid td .micro{display:block;margin-top:.02in;max-width:3.5in}
.conc tbody tr.div td{background:#fdf6f5}
.porque{margin-top:.18in;border:1px solid var(--line);border-radius:8px;padding:.14in .16in;background:var(--wash)}
.porque h3{font-size:10pt;color:var(--navy);margin-bottom:.07in}
.porque ol{padding-left:.18in;font-size:8pt;line-height:1.48;color:#44545f}
.porque li{margin-bottom:.06in}
.porque .fecho{margin-top:.08in;font-size:8pt;line-height:1.48;color:#33454f;padding-top:.08in;
  border-top:1px solid var(--line)}

/* ── VAAF × VAAT ─────────────────────────────────────────────────────────── */
.dois-denominadores{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.14in;margin-top:.2in}
.den{border:1px solid var(--line);border-top:.045in solid var(--teal);border-radius:8px;padding:.14in .15in}
.den.vaat{border-top-color:var(--violet)}
.den.delta{border-top-color:var(--gold);background:var(--wash)}
.den em{display:block;font-style:normal;font-size:7pt;font-weight:800;letter-spacing:.13em;
  text-transform:uppercase;color:var(--muted)}
.den b{display:block;font-size:20pt;letter-spacing:-.03em;color:var(--navy);line-height:1.05;margin-top:.04in}
.den span{display:block;font-size:6.8pt;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;
  font-weight:800;margin-top:.02in}
.den p{margin-top:.09in;font-size:7.5pt;line-height:1.45;color:#44545f}
.den-fator{margin-top:.09in;padding-top:.06in;border-top:1px solid var(--line);font-size:7.4pt;color:var(--muted)}
.den-fator b{display:inline;font-size:9pt;color:var(--navy)}
h3.sub{margin-top:.24in;font-size:11pt;color:var(--navy);letter-spacing:-.015em}
.sub-nota{font-size:7.6pt;color:var(--muted);line-height:1.45;margin-top:.03in;max-width:6.2in}
.divergencia td.nome{font-size:7.8pt}
td.vazio{font-size:8pt;line-height:1.5;color:#44545f;padding:.1in 0}

/* ── tabelas de fluxo ────────────────────────────────────────────────────── */
.grid tbody tr{break-inside:avoid;page-break-inside:avoid}
.grid thead{display:table-header-group}
td.f{color:var(--teal);font-weight:700}
td.f2{color:var(--violet);font-weight:700}
td.v{color:var(--navy);font-weight:600}
.segs td.nome{font-size:7.8pt}
.segs tbody tr.acima td.nome{font-weight:600;color:var(--navy)}
.segs tbody tr.acima td.f{background:rgba(39,166,154,.08)}
.trilho{display:block;background:#e9f0f1;border-radius:2px;height:.075in;width:.95in}
.trilho i{display:block;height:100%;background:var(--teal);border-radius:2px}
.trilho.regua{width:100%;height:.09in;background:#e9f0f1}
.trilho.regua i{background:linear-gradient(90deg,var(--teal),#1d7d72)}
.trilho.duplo{width:100%;margin-top:.06in}
td.bar{width:1in;padding-left:.08in}
.rodape-tabela{margin-top:.12in;font-size:7.4pt;line-height:1.45;color:#44545f;background:var(--wash);
  border-left:.03in solid var(--teal);padding:.09in .12in;border-radius:0 6px 6px 0}
.nota-d{margin-top:.12in;font-size:6.9pt;line-height:1.45;color:var(--muted)}

/* ── cortes ──────────────────────────────────────────────────────────────── */
.corte{margin-bottom:.24in;break-inside:avoid;page-break-inside:avoid}
.corte h3{font-size:12pt;color:var(--navy);letter-spacing:-.015em}
.corte-nota{font-size:7.6pt;color:var(--muted);line-height:1.45;margin-top:.03in;max-width:6.2in}

/* ── conferências ────────────────────────────────────────────────────────── */
.conf{border:1px solid var(--line);border-radius:8px;padding:.13in .15in;margin-bottom:.13in;
  break-inside:avoid;page-break-inside:avoid}
.conf.s-divergencia{border-left:.045in solid var(--gold);background:#fefbf5}
.conf.s-coerente{border-left:.045in solid var(--good)}
.conf.s-sem-base{border-left:.045in solid var(--line)}
.conf header{display:flex;justify-content:space-between;align-items:baseline;gap:.12in;
  padding-bottom:.07in;border-bottom:1px solid var(--line)}
.conf h3{font-size:11pt;color:var(--navy);letter-spacing:-.015em}
.tag{font-size:6.2pt;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;
  padding:.025in .08in;white-space:nowrap;background:#eef3f5;color:var(--muted)}
.t-divergencia{background:#fdf4e3;color:var(--gold)}
.t-coerente{background:#eef6f5;color:var(--good)}
.t-oport{background:#fdf4e3;color:var(--gold)}
.conf-corpo{display:grid;grid-template-columns:1.9in 1fr auto;gap:.16in;margin-top:.09in;align-items:start}
.conf-num table{font-size:7.8pt}
.conf-leitura{font-size:8pt;line-height:1.48;color:#44545f}
.conf-cifra{border-left:1px solid var(--line);padding-left:.14in;min-width:1.5in}
.conf-cifra em{display:block;font-style:normal;font-size:6.6pt;font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;color:var(--muted);line-height:1.3;max-width:1.5in}
.conf-cifra b{display:block;font-size:16pt;color:var(--gold);letter-spacing:-.025em;line-height:1.1;margin-top:.04in}
.conf-cifra span{display:block;font-size:6.8pt;color:var(--muted)}
.conf-brl{margin-top:.05in;font-size:8.4pt;font-weight:700;color:var(--navy)}

/* ── oportunidades ───────────────────────────────────────────────────────── */
.oport{border:1px solid var(--line);border-radius:8px;padding:.14in .16in;margin-bottom:.16in;
  break-inside:avoid;page-break-inside:avoid}
.oport header{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:.07in;
  border-bottom:1px solid var(--line)}
.oport h3{font-size:12pt;color:var(--navy);letter-spacing:-.015em}
.oport-grade{display:grid;grid-template-columns:1.9in 1fr;gap:.18in;margin-top:.1in;align-items:start}
.oport-medida em{display:block;font-style:normal;font-size:6.8pt;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted)}
.oport-medida b{display:block;font-size:24pt;color:var(--teal);letter-spacing:-.03em;line-height:1.05}
.oport-medida .par{display:grid;grid-template-columns:.72in 1fr .38in;align-items:center;gap:.05in;
  margin-top:.06in;font-size:6.8pt;color:var(--muted)}
.oport-medida .par span{white-space:nowrap}
.oport-medida .par i{font-style:normal;text-align:right;color:var(--navy);font-weight:700}
.oport-medida .par.mediana .trilho i{background:var(--muted)}
.compacta{margin-top:0}
.compacta tr.alvo td{background:rgba(39,166,154,.07)}
.oport-detalhe{margin-top:.11in;font-size:7.9pt;line-height:1.48;color:#44545f;padding-top:.09in;
  border-top:1px solid var(--line)}
.oport-teto{margin-top:.08in;font-size:7.3pt;line-height:1.45;color:var(--muted)}

/* ── série ───────────────────────────────────────────────────────────────── */
.serie tbody tr.forte td{font-weight:700;color:var(--navy)}
.serie tbody tr.pctl td{color:var(--teal);font-weight:600;background:rgba(39,166,154,.05)}

/* ── anexo ───────────────────────────────────────────────────────────────── */
.catalogo{font-size:7.6pt}
.catalogo tbody tr.off td{color:#a8b6be}
.catalogo tbody tr.off td.f,.catalogo tbody tr.off td.f2{color:#b9c8cd;font-weight:400}
.catalogo tbody tr.on td.nome{font-weight:700;color:var(--navy)}
.catalogo tbody tr.on td{background:rgba(39,166,154,.06)}
`;
