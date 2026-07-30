import type { DossieComparativo, IndicadorComparado } from "./dossie-comparativo";

/**
 * Dossiê Comparativo — HTML de impressão.
 *
 * A folha central é o painel de percentis, e ele tem uma regra que não pode ser
 * relaxada: **a cor segue o `sentido` do indicador, não o valor bruto**.
 * Percentil 90 em abandono é vermelho; percentil 90 em IDEB é verde; percentil
 * 90 em investimento por aluno não é nem um nem outro. Colorir pelo valor
 * produziria um painel bonito e invertido.
 *
 * Por isso as réguas usam `posicaoOrientada` — 100 é sempre o melhor lado — e
 * indicador neutro é desenhado em cinza, com a marca no percentil cru.
 */

const NBSP = " ";

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const n0 = (v: number | null | undefined) => (v == null ? "—" : inteiro.format(v));

/** Formata na unidade do indicador — sem isso, R$ e % viram o mesmo número. */
function valorNa(unidade: IndicadorComparado["unidade"], v: number | null | undefined): string {
  if (v == null) return "—";
  if (unidade === "percentual") return `${dec1.format(v)}%`;
  if (unidade === "reais") {
    return Math.abs(v) >= 1000
      ? `R$${NBSP}${dec1.format(v / 1000)}${NBSP}mil`
      : `R$${NBSP}${dec2.format(v)}`;
  }
  return dec2.format(v);
}

function distanciaNa(unidade: IndicadorComparado["unidade"], v: number): string {
  const sinal = v > 0 ? "+" : "";
  if (unidade === "percentual") return `${sinal}${dec1.format(v)} pt`;
  if (unidade === "reais") {
    return Math.abs(v) >= 1000
      ? `${sinal}R$${NBSP}${dec1.format(v / 1000)}${NBSP}mil`
      : `${sinal}R$${NBSP}${dec2.format(v)}`;
  }
  return `${sinal}${dec2.format(v)}`;
}

const CLASSE_AVALIACAO: Record<IndicadorComparado["avaliacao"], string> = {
  melhor: "a-melhor",
  pior: "a-pior",
  tipico: "a-tipico",
  neutro: "a-neutro",
  "sem-leitura": "a-sem",
};

const ROTULO_AVALIACAO: Record<IndicadorComparado["avaliacao"], string> = {
  melhor: "acima dos pares",
  pior: "abaixo dos pares",
  tipico: "típico do porte",
  neutro: "sem lado melhor",
  "sem-leitura": "coorte insuficiente",
};

export interface DossieComparativoInput {
  municipio: string;
  uf: string;
  codigoIbge: string;
  dossie: DossieComparativo;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

/**
 * Régua de 0 a 100 com a marca do município.
 *
 * A escala é sempre a orientada: à esquerda o pior lado, à direita o melhor.
 * Em indicador neutro não há lado, e a régua sai cinza com a nota dizendo isso.
 */
function regua(i: IndicadorComparado): string {
  if (i.avaliacao === "sem-leitura") {
    return '<span class="regua vazia"><i class="meio"></i></span>';
  }
  const pos = Math.max(1.5, Math.min(98.5, i.posicaoOrientada));
  return `<span class="regua ${CLASSE_AVALIACAO[i.avaliacao]}">
    <i class="meio"></i>
    <i class="marca" style="left:${pos.toFixed(1)}%"></i>
  </span>`;
}

function linhaRegua(i: IndicadorComparado): string {
  return `<tr class="regua-linha">
    <td class="nome">${esc(i.rotulo)}</td>
    <td class="num">${valorNa(i.unidade, i.valor)}</td>
    <td class="num sub">${valorNa(i.unidade, i.medianaPorte)}</td>
    <td class="reg">${regua(i)}</td>
    <td class="num"><b class="${CLASSE_AVALIACAO[i.avaliacao]}">${
      i.avaliacao === "sem-leitura" ? "—" : `p${i.percentil}`
    }</b></td>
  </tr>`;
}

function blocoIndicador(i: IndicadorComparado): string {
  return `<article class="indicador ${CLASSE_AVALIACAO[i.avaliacao]}">
  <header>
    <div>
      <h3>${esc(i.rotulo)}</h3>
      <p class="micro">${n0(i.comparaveis)} municípios de porte semelhante têm este dado</p>
    </div>
    <span class="tag ${CLASSE_AVALIACAO[i.avaliacao]}">${ROTULO_AVALIACAO[i.avaliacao]}</span>
  </header>

  <div class="grade">
    <div class="col">
      <h4>As três réguas</h4>
      <table><tbody>
        <tr class="destaque"><td><b>Este município</b></td><td class="num"><b>${valorNa(i.unidade, i.valor)}</b></td></tr>
        <tr><td>Mediana do porte semelhante</td><td class="num">${valorNa(i.unidade, i.medianaPorte)}</td></tr>
        <tr><td>Mediana da UF</td><td class="num">${valorNa(i.unidade, i.medianaUf)}</td></tr>
        <tr><td>Distância até a mediana do porte</td><td class="num">${distanciaNa(i.unidade, i.distancia)}${
          i.distanciaRelativa !== null
            ? ` <span class="sub">(${i.distanciaRelativa > 0 ? "+" : ""}${dec1.format(i.distanciaRelativa)}%)</span>`
            : ""
        }</td></tr>
        <tr><td>Percentil na coorte de porte</td><td class="num"><b>${
          i.avaliacao === "sem-leitura" ? "não publicado" : `p${i.percentil}`
        }</b></td></tr>
      </tbody></table>
    </div>
    <div class="col">
      <h4>Onde isso põe a rede</h4>
      <div class="regua-grande">${regua(i)}</div>
      <div class="regua-eixo"><span>pior lado</span><span>mediana</span><span>melhor lado</span></div>
      <p class="leitura">${esc(i.leitura)}</p>
      ${
        i.distanciaEmMatriculas
          ? `<p class="conversao">A distância até a mediana equivale a
        <b>${n0(i.distanciaEmMatriculas.quantidade)} ${esc(i.distanciaEmMatriculas.base)}</b>.</p>`
          : ""
      }
    </div>
  </div>

  ${
    i.parametroLegal
      ? `<p class="parametro"><b>Parâmetro legal, que prevalece sobre a comparação:</b> ${esc(i.parametroLegal)}</p>`
      : ""
  }
</article>`;
}

export function generateDossieComparativoHtml(input: DossieComparativoInput): string {
  const { dossie: d, municipio, uf } = input;
  const geradoEm = input.geradoEm ?? new Date();
  const responsavel = input.responsavel ?? "Adriel Tavares";
  const r = d.resumo;
  const g = d.gemeos;

  const dataEmissao = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(geradoEm);

  const marca = input.logoDataUri
    ? `<img src="${input.logoDataUri}" alt="" style="width:.42in;height:.42in;border-radius:8px">`
    : "";

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dossiê Comparativo — ${esc(municipio)}/${esc(uf)}</title>
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
    <span class="cover-tag">Dossiê temático &middot; comparação com os pares</span>
    <h1>Quanto,<br><span class="thin">comparado a quem</span></h1>
    <p class="cover-sub">Todo número dos outros dossiês responde "quanto?". Este responde "quanto, comparado
    a quem?" — e é a diferença entre um relatório que informa e um que muda decisão. A comparação é com
    municípios de <b>rede do mesmo tamanho</b>, que enfrentam a mesma escala de problema, e não com a média
    nacional, que é puxada pelas capitais.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    ${
      r.total > 0
        ? `<div class="cover-hero">
      <em>De ${n0(r.total)} indicadores comparados com ${g ? n0(g.faixaPorte.tamanho) : "—"} municípios de porte semelhante</em>
      <div class="val"><b>${n0(r.piores)}</b><i>abaixo dos pares</i></div>
      <p>${n0(r.melhores)} acima, ${n0(r.tipicos)} indistinguíveis do típico e ${n0(r.neutros)} sem lado
      melhor. ${
        r.posicaoMedia !== null
          ? `A posição média da rede é o percentil ${n0(r.posicaoMedia)} — ${
              r.posicaoMedia >= 50
                ? "acima da metade dos pares no conjunto dos indicadores."
                : "abaixo da metade dos pares no conjunto dos indicadores."
            }`
          : ""
      }</p>
    </div>`
        : `<div class="cover-hero">
      <em>Coorte de comparação</em><div class="val"><b>—</b><i>indisponível</i></div>
      <p>Não foi possível montar a coorte de municípios de porte semelhante nesta emissão. A folha seguinte
      diz por quê.</p>
    </div>`
    }
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(dataEmissao)}</b>FNDE &middot; INEP &middot; SIOPE</div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dossiê Comparativo</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Sumário</div>
    <h2>Estar na mediana<br>não significa estar bem</h2>
    <p class="lede">A mediana pode ser ruim. Este dossiê diz onde a rede está entre os seus iguais — e, onde
    existe <b>parâmetro legal</b>, imprime o parâmetro junto, porque ele prevalece sobre qualquer comparação.
    Cumprir a lei não é competir com o vizinho.</p>

    <div class="placar">
      ${placar("acima dos pares", r.melhores, "a-melhor")}
      ${placar("típicos do porte", r.tipicos, "a-tipico")}
      ${placar("abaixo dos pares", r.piores, "a-pior")}
      ${placar("sem lado melhor", r.neutros, "a-neutro")}
    </div>

    <div class="duas">
      <div class="card">
        <h3>Comparado com quem, exatamente</h3>
        ${
          g
            ? `<p class="txt">A coorte é montada por <b>porte de rede</b> — matrículas na filtragem do FUNDEB
             —, não por população nem PIB. Tudo o que este dossiê compara é produzido pela rede de ensino, e
             é o tamanho dela que define o que é operacionalmente comparável.</p>
        <table><tbody>
          <tr><td>Matrículas desta rede</td><td class="num"><b>${n0(g.matriculas)}</b></td></tr>
          <tr><td>Municípios na coorte de porte</td><td class="num"><b>${n0(g.faixaPorte.tamanho)}</b></td></tr>
          <tr><td>Faixa de matrículas da coorte</td><td class="num">${n0(g.faixaPorte.minimo)} a ${n0(g.faixaPorte.maximo)}</td></tr>
          <tr><td>Municípios na coorte da UF</td><td class="num">${n0(g.coorteUf)}</td></tr>
          ${
            g.vaar
              ? `<tr><td>Da coorte de porte, habilitados ao VAAR</td><td class="num">${g.vaar.habilitadoCoortePct}%</td></tr>
          <tr class="destaque"><td><b>Este município capta VAAR</b></td><td class="num"><b>${
            g.vaar.municipioHabilitado === null ? "—" : g.vaar.municipioHabilitado ? "sim" : "não"
          }</b></td></tr>`
              : ""
          }
        </tbody></table>
        <p class="micro" style="margin-top:.07in">A lista dos pares não é publicada, e isso é deliberado:
        nomear "o município X vai melhor que você" cria atrito sem acrescentar informação. O que importa é a
        distribuição, não o vizinho.</p>`
            : '<p class="txt">A coorte não pôde ser montada nesta emissão.</p>'
        }
      </div>
      <div class="card">
        <h3>Como ler as réguas</h3>
        <p class="txt">A régua de cada indicador vai do <b>pior lado</b> ao <b>melhor lado</b>, não do menor
        ao maior valor. Isso importa: percentil 90 em abandono é péssimo e percentil 90 em IDEB é ótimo —
        colorir pelo número bruto produziria um painel invertido.</p>
        <div class="exemplo">
          <div class="ex"><span>abaixo dos pares</span><span class="regua a-pior"><i class="meio"></i><i class="marca" style="left:18%"></i></span></div>
          <div class="ex"><span>típico do porte</span><span class="regua a-tipico"><i class="meio"></i><i class="marca" style="left:50%"></i></span></div>
          <div class="ex"><span>acima dos pares</span><span class="regua a-melhor"><i class="meio"></i><i class="marca" style="left:84%"></i></span></div>
          <div class="ex"><span>sem lado melhor</span><span class="regua a-neutro"><i class="meio"></i><i class="marca" style="left:62%"></i></span></div>
        </div>
        <p class="micro" style="margin-top:.07in">Indicador <b>sem lado melhor</b> — investimento por aluno,
        salário do magistério — sai em cinza. Investimento alto pode ser oferta cara e necessária, com rede
        rural dispersa e tempo integral, ou pode ser ineficiência: a régua diz onde a rede está, não se isso
        é bom.</p>
      </div>
    </div>

    ${
      d.ausencias.length > 0
        ? `<div class="ausencias">
      <h3>O que não veio nesta emissão</h3>
      <ul>${d.ausencias.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
    </div>`
        : ""
    }

    <p class="fonte">Fontes: FNDE — matrículas ponderadas ${new Date().getFullYear()} (porte da rede e
    composição), VAAR; SIOPE — indicadores de aplicação; INEP — divulgação do IDEB e rendimento, Saeb,
    Indicador Criança Alfabetizada e microdados do Censo Escolar. Todos os indicadores vêm de dataset local
    e completo para o país: a coorte inteira precisa da mesma apuração, senão o percentil compara municípios
    que têm o dado com municípios que não têm.</p>
  </div>
  <div class="page-footer"><span>FNDE &middot; INEP &middot; SIOPE</span><span>2</span></div>
</section>

${
  d.grupos.length > 0
    ? `<section class="flow">
  <h2 class="secao">O painel — os ${n0(r.total)} indicadores em uma folha</h2>
  <p class="secao-sub">Cada régua vai do pior lado ao melhor. A marca é este município; o traço central é a
  mediana dos pares de porte semelhante. Leia a coluna das réguas de cima a baixo: onde as marcas se
  concentram à esquerda está o assunto que a rede precisa enfrentar primeiro.</p>

  ${d.grupos
    .map(
      (grupo) => `<div class="grupo">
    <h3 class="sub">${esc(grupo.rotulo)}</h3>
    <table class="grid painel">
      <thead><tr>
        <th>Indicador</th><th class="num">Este município</th><th class="num">Mediana do porte</th>
        <th>Pior &larr; posição na coorte &rarr; melhor</th><th class="num">Percentil</th>
      </tr></thead>
      <tbody>${grupo.indicadores.map(linhaRegua).join("")}</tbody>
    </table>
  </div>`,
    )
    .join("")}

  <p class="rodape-tabela"><b>Mediana, não média.</b> A distribuição municipal brasileira é assimétrica: a
  média é puxada pelas capitais e some com o município típico. Todas as réguas deste dossiê usam mediana, e
  o percentil é calculado sobre a coorte de porte — não sobre o país inteiro.</p>
</section>`
    : ""
}

${
  d.maioresDistancias.length > 0
    ? `<section class="flow">
  <h2 class="secao">As ${d.maioresDistancias.length === 1 ? "maior distância" : `${d.maioresDistancias.length} maiores distâncias`}</h2>
  <p class="secao-sub">Ordenadas por posição na coorte, não por diferença bruta: pontos de indicadores com
  escalas diferentes não se comparam entre si. O que se compara é a fila — e estes são os indicadores em que
  a rede está mais atrás dos seus iguais.</p>

  ${d.maioresDistancias
    .map(
      (i, ordem) => `<div class="destaque-dist">
    <div class="dist-ord">${ordem + 1}</div>
    <div>
      <h3>${esc(i.rotulo)}</h3>
      <div class="dist-nums">
        <span><em>este município</em><b>${valorNa(i.unidade, i.valor)}</b></span>
        <span><em>mediana dos pares</em><b>${valorNa(i.unidade, i.medianaPorte)}</b></span>
        <span><em>distância</em><b class="a-pior">${distanciaNa(i.unidade, i.distancia)}</b></span>
        <span><em>percentil</em><b class="a-pior">p${i.percentil}</b></span>
      </div>
      <p class="dist-leitura">${esc(i.leitura)}</p>
      ${
        i.distanciaEmMatriculas
          ? `<p class="dist-conversao">Traduzindo em gente: fechar a distância até a mediana são
        <b>${n0(i.distanciaEmMatriculas.quantidade)} ${esc(i.distanciaEmMatriculas.base)}</b>.</p>`
          : ""
      }
    </div>
  </div>`,
    )
    .join("")}

  <p class="rodape-tabela"><b>Distância até a mediana não é meta.</b> Alcançar a mediana dos pares põe a rede
  no meio da fila, não em conformidade nem em excelência. Onde há parâmetro legal — MDE, remuneração,
  aplicação do FUNDEB —, é ele que define o piso, e ele aparece no bloco do indicador correspondente.</p>
</section>`
    : ""
}

${
  d.indicadores.length > 0
    ? `<section class="flow">
  <h2 class="secao">Indicador por indicador</h2>
  <p class="secao-sub">Os ${n0(d.indicadores.length)} indicadores com as três réguas abertas, o número de
  pares que têm o dado e a leitura do que aquele percentil significa em gestão. Onde existe parâmetro legal,
  ele fecha o bloco — porque ele prevalece sobre a comparação.</p>
  ${d.indicadores.map(blocoIndicador).join("")}
  <p class="fonte" style="margin-top:.2in">Emitido em ${esc(dataEmissao)} por ${esc(responsavel)} &middot;
  Global Company Consultorias. Documento confidencial, destinado exclusivamente ao município analisado.</p>
</section>`
    : ""
}

</body></html>`;
}

function placar(rotulo: string, valor: number, classe: string): string {
  return `<div class="placar-item ${classe}"><b>${inteiro.format(valor)}</b><span>${rotulo}</span></div>`;
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
  letter-spacing:.13em;text-transform:uppercase;max-width:5in;line-height:1.4}
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
.placar{display:grid;grid-template-columns:repeat(4,1fr);gap:.14in;margin-top:.18in}
.placar-item{border-left:.035in solid var(--line);padding-left:.12in}
.placar-item b{display:block;font-size:22pt;letter-spacing:-.03em;line-height:1;color:var(--navy)}
.placar-item span{display:block;color:var(--muted);font-size:6.8pt;font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;margin-top:.05in;line-height:1.3}
.placar-item.a-melhor{border-left-color:var(--good)}
.placar-item.a-melhor b{color:var(--good)}
.placar-item.a-pior{border-left-color:var(--red)}
.placar-item.a-pior b{color:var(--red)}
.placar-item.a-tipico{border-left-color:var(--gold)}
.placar-item.a-neutro{border-left-color:var(--muted)}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.2in;break-before:avoid}
.card{border:1px solid var(--line);border-radius:8px;padding:.14in .16in;background:#fff;
  break-inside:avoid;page-break-inside:avoid}
.card h3{font-size:10.5pt;color:var(--navy);margin-bottom:.07in}
.card .txt{font-size:8pt;line-height:1.45;color:#44545f;margin-bottom:.06in}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.042in 0;border-bottom:1px solid #eef3f5;vertical-align:top}
table td.num{text-align:right;color:var(--navy);white-space:nowrap}
td.num.sub,th.num.sub,td.sub,span.sub{color:var(--muted);font-weight:400}
tr.destaque td{background:rgba(39,166,154,.07)}
.micro{display:block;font-size:6.8pt;color:var(--muted);line-height:1.35;font-weight:400}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}
.exemplo{margin-top:.06in}
.ex{display:grid;grid-template-columns:1.05in 1fr;align-items:center;gap:.08in;margin-bottom:.05in;
  font-size:6.9pt;color:var(--muted)}
.ausencias{margin-top:.18in;border:1px solid #e2c084;background:#fdf9ee;border-radius:8px;padding:.12in .15in}
.ausencias h3{font-size:9pt;color:#8a5a0d;margin-bottom:.05in}
.ausencias ul{padding-left:.16in;font-size:7.4pt;line-height:1.42;color:#5d4a2c}

/* ── réguas ──────────────────────────────────────────────────────────────── */
.regua{position:relative;display:block;height:.13in;background:#eef3f5;border-radius:3px;width:100%;
  border:1px solid var(--line)}
.regua .meio{position:absolute;left:50%;top:-1px;bottom:-1px;width:1px;background:#b9c8cd}
.regua .marca{position:absolute;top:-.025in;width:.075in;height:.18in;border-radius:2px;
  transform:translateX(-50%);background:var(--muted)}
.regua.a-melhor{background:linear-gradient(90deg,#f6f9f9 0%,#e6f4f1 100%)}
.regua.a-melhor .marca{background:var(--good)}
.regua.a-pior{background:linear-gradient(90deg,#fbeceb 0%,#f8f9f9 100%)}
.regua.a-pior .marca{background:var(--red)}
.regua.a-tipico .marca{background:var(--gold)}
.regua.a-neutro .marca{background:var(--muted)}
.regua.vazia{background:repeating-linear-gradient(45deg,#f4f7f8,#f4f7f8 3px,#eef3f5 3px,#eef3f5 6px)}
td.reg{width:1.7in;padding-left:.1in;padding-right:.1in}
.painel td.nome{width:2in;font-size:7.8pt}
/* Sem largura declarada, "MEDIANA DO PORTE" encostava no cabeçalho da régua. */
.painel th:nth-child(2),.painel td:nth-child(2){width:.95in}
.painel th:nth-child(3),.painel td:nth-child(3){width:1in;padding-right:.12in}
.painel th:last-child,.painel td:last-child{width:.55in}
b.a-melhor{color:var(--good)}
b.a-pior{color:var(--red)}
b.a-tipico{color:var(--gold)}
b.a-neutro,b.a-sem{color:var(--muted)}

/* ── tabelas de fluxo ────────────────────────────────────────────────────── */
.grid{margin-top:.1in;font-size:8pt}
.grid thead{display:table-header-group}
.grid thead th{text-align:left;font-size:6.6pt;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);
  font-weight:800;padding:0 0 .05in;border-bottom:1.5px solid var(--navy);vertical-align:bottom}
.grid thead th.num{text-align:right}
.grid tbody tr{break-inside:avoid;page-break-inside:avoid}
.grid tbody td{padding:.05in 0;border-bottom:1px solid #eef3f5}
.grid tbody td.nome{padding-right:.12in}
.grupo{margin-bottom:.2in;break-inside:avoid;page-break-inside:avoid}
.rodape-tabela{margin-top:.12in;font-size:7.4pt;line-height:1.45;color:#44545f;background:var(--wash);
  border-left:.03in solid var(--teal);padding:.09in .12in;border-radius:0 6px 6px 0}
h3.sub{margin-top:.2in;font-size:11.5pt;color:var(--navy);letter-spacing:-.015em;
  break-after:avoid;page-break-after:avoid}

/* ── maiores distâncias ──────────────────────────────────────────────────── */
.destaque-dist{display:grid;grid-template-columns:.4in 1fr;gap:.1in;border:1px solid #e6bab8;
  background:#fdf6f5;border-radius:8px;padding:.14in .16in;margin-bottom:.14in;
  break-inside:avoid;page-break-inside:avoid}
.dist-ord{font-size:20pt;font-weight:800;color:#e0b4b1;line-height:1}
.destaque-dist h3{font-size:12pt;color:var(--navy);letter-spacing:-.015em}
.dist-nums{display:grid;grid-template-columns:repeat(4,1fr);gap:.1in;margin-top:.08in;
  padding:.08in 0;border-top:1px solid #eddcda;border-bottom:1px solid #eddcda}
.dist-nums em{display:block;font-style:normal;font-size:6.4pt;font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;color:var(--muted)}
.dist-nums b{display:block;font-size:12pt;color:var(--navy);letter-spacing:-.02em;margin-top:.02in}
.dist-leitura{margin-top:.08in;font-size:7.9pt;line-height:1.45;color:#44545f}
.dist-conversao{margin-top:.06in;font-size:7.9pt;line-height:1.45;color:#33454f}

/* ── bloco por indicador ─────────────────────────────────────────────────── */
.indicador{border:1px solid var(--line);border-radius:8px;padding:.14in .16in;margin-bottom:.14in;
  break-inside:avoid;page-break-inside:avoid;background:#fff}
.indicador.a-pior{border-left:.045in solid var(--red)}
.indicador.a-melhor{border-left:.045in solid var(--good)}
.indicador.a-tipico{border-left:.045in solid var(--gold)}
.indicador.a-neutro,.indicador.a-sem{border-left:.045in solid var(--line)}
.indicador header{display:flex;justify-content:space-between;align-items:flex-start;gap:.15in;
  padding-bottom:.08in;border-bottom:1px solid var(--line)}
.indicador h3{font-size:11pt;color:var(--navy);letter-spacing:-.015em;line-height:1.2}
.tag{display:inline-block;font-size:6.2pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  border-radius:999px;padding:.025in .08in;white-space:nowrap;background:#eef3f5;color:var(--muted)}
.tag.a-melhor{background:#eef6f5;color:var(--good)}
.tag.a-pior{background:#fbeceb;color:var(--red)}
.tag.a-tipico{background:#fdf4e3;color:var(--gold)}
.indicador .grade{display:grid;grid-template-columns:1.05fr 1fr;gap:.18in;margin-top:.09in}
.indicador h4{font-size:6.9pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);
  margin-bottom:.04in}
.indicador table{font-size:7.8pt}
.indicador table td{padding:.03in 0}
.regua-grande{margin-top:.02in}
.regua-eixo{display:flex;justify-content:space-between;font-size:6.2pt;color:var(--muted);margin-top:.03in}
.leitura{margin-top:.08in;font-size:7.6pt;line-height:1.45;color:#44545f}
.conversao{margin-top:.06in;padding:.06in .09in;background:var(--wash);border-radius:5px;font-size:7.5pt;
  line-height:1.4;color:#33454f}
.parametro{margin-top:.09in;padding:.07in .1in;background:#f4f6fb;border-left:.03in solid var(--violet);
  border-radius:0 5px 5px 0;font-size:7.4pt;line-height:1.42;color:#3c4560}
`;
