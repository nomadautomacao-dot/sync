import {
  ROTULO_GRUPO,
  type AnoSerie,
  type CorrentePovo,
  type DossieEquidade,
  type GrupoCorRaca,
  type SerieCorRaca,
} from "./dossie-equidade";

/**
 * Dossiê da Equidade e dos Territórios — HTML de impressão.
 *
 * A regra editorial que governa cada folha: **pertencimento é
 * autodeclaração**. O documento aponta lacuna de registro e nunca afirma que
 * alguém "é" indígena ou quilombola, nem estima quantos "deveriam" se declarar.
 * Onde a fonte não distingue — o campo de cor/raça do Censo Escolar não tem
 * categoria quilombola —, o elo sai como travessão, e a lacuna é dita em
 * palavras. Preencher aquele campo com uma estimativa seria pior que a lacuna.
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

/** Ausência é `—`, nunca zero. Regra 2 da visão geral dos dossiês. */
const n0 = (v: number | null | undefined) => (v == null ? "—" : inteiro.format(v));
const pc = (v: number | null | undefined) => (v == null ? "—" : `${dec1.format(v)}%`);
const sinal = (v: number | null | undefined) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${dec1.format(v)}`;

function brlCompact(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$${NBSP}${dec2.format(v / 1_000_000)}${NBSP}mi`;
  if (abs >= 1_000) return `R$${NBSP}${dec1.format(v / 1_000)}${NBSP}mil`;
  return `R$${NBSP}${dec2.format(v)}`;
}

const derivado = (v: number | null | undefined) =>
  v == null ? "—" : `${brlCompact(v)}<sup class="d">d</sup>`;

const NOTA_AUTODECLARACAO =
  "<b>Pertencimento é autodeclaração.</b> Este dossiê aponta lacuna de <b>registro</b> e em nenhum ponto " +
  "afirma que alguém é indígena ou quilombola, nem estima quantos deveriam se declarar. Os três números da " +
  "corrente vêm de três perguntas diferentes, feitas a três respondentes diferentes: o Censo Demográfico " +
  "pergunta à família, o Censo Escolar registra o que a escola preencheu, e a Portaria conta a escola com " +
  "localização diferenciada declarada. Nenhuma delas responde “quantas crianças indígenas existem aqui”.";

const NOTA_DERIVADO =
  '<sup class="d">d</sup> <b>Cifra derivada.</b> O acréscimo do fator sobre a referência 1,00 (art. 7º, §1º ' +
  "da Lei 14.113/2020), multiplicado pelo valor aluno/ano do segmento de fator 1,00 na UF. Usa o <b>menor</b> " +
  "fator do povo, não o teto de 2,17 — o teto supõe creche integral, que a maior parte da matrícula não é. " +
  "E só vale se a distância for de registro: onde a criança estuda legitimamente em escola comum, não há " +
  "fator a recuperar.";

export interface DossieEquidadeInput {
  municipio: string;
  uf: string;
  codigoIbge: string;
  dossie: DossieEquidade;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

const GRUPOS: GrupoCorRaca[] = ["naoDeclarada", "preta", "parda", "branca", "amarela", "indigena"];

const CLASSE_GRUPO: Record<GrupoCorRaca, string> = {
  naoDeclarada: "g-nd",
  preta: "g-preta",
  parda: "g-parda",
  branca: "g-branca",
  amarela: "g-amarela",
  indigena: "g-indigena",
};

function linhaAno(a: AnoSerie): string {
  const segmentos = GRUPOS.filter((g) => (a.pct[g] ?? 0) > 0)
    .map(
      (g) =>
        `<span class="seg ${CLASSE_GRUPO[g]}" style="width:${(a.pct[g] ?? 0).toFixed(2)}%">${
          (a.pct[g] ?? 0) >= 9 ? `${dec1.format(a.pct[g] ?? 0)}%` : ""
        }</span>`,
    )
    .join("");

  return `<tr class="ano-serie ${a.mudouCadastro ? "mudou" : ""}">
    <td class="nome"><b>${a.ano}</b></td>
    <td class="num">${n0(a.total)}</td>
    <td class="empi"><div class="empilhada">${segmentos}</div></td>
    <td class="num ${a.mudouCadastro ? "alerta" : ""}"><b>${pc(a.pct.naoDeclarada)}</b></td>
    <td class="num ${a.mudouCadastro ? "alerta" : "sub"}">${sinal(a.variacaoNaoDeclarada)}</td>
    <td class="num">${pc((a.pct.preta ?? 0) + (a.pct.parda ?? 0))}</td>
    <td class="num">${pc(a.pct.indigena)}</td>
  </tr>`;
}

/** A barra empilhada sem legenda é um enfeite: seis cores e nenhuma chave. */
const LEGENDA = GRUPOS.map(
  (g) => `<span class="leg"><i class="${CLASSE_GRUPO[g]}"></i>${ROTULO_GRUPO[g]}</span>`,
).join("");

function blocoSerie(s: SerieCorRaca): string {
  return `<div class="serie">
    <h3 class="sub">${esc(s.rotulo)}</h3>
    <div class="legenda">${LEGENDA}</div>
    <table class="grid serie-tab">
      <thead><tr>
        <th>Ano</th><th class="num">Matrículas</th><th>Composição declarada</th>
        <th class="num">Não declarada</th><th class="num">Variação</th>
        <th class="num">Preta + parda</th><th class="num">Indígena</th>
      </tr></thead>
      <tbody>${s.anos.map(linhaAno).join("")}</tbody>
    </table>
    ${
      s.anosComMudanca.length > 0
        ? `<p class="alerta-cadastro"><b>O cadastro mudou em ${s.anosComMudanca.join(" e ")}.</b>
        A não declaração ${
          (s.variacaoNaoDeclarada ?? 0) < 0 ? "caiu" : "subiu"
        } ${pc(Math.abs(s.variacaoNaoDeclarada ?? 0))} entre ${s.anos[0].ano} e ${s.anos[s.anos.length - 1].ano}.
        Movimento desse tamanho em um ano <b>não é mudança demográfica</b> — é a rede tendo mexido no
        preenchimento do campo. Consequência prática: a composição de ${s.anos[0].ano} e a de
        ${s.anos[s.anos.length - 1].ano} <b>não são comparáveis</b>, e qualquer leitura de "a rede ficou mais
        negra" atribuiria à população um movimento que foi do formulário.</p>`
        : `<p class="micro" style="margin-top:.08in">A não declaração se manteve estável na série
        (${sinal(s.variacaoNaoDeclarada)} pontos entre ${s.anos[0]?.ano} e ${s.anos[s.anos.length - 1]?.ano}),
        então a comparação de composição entre os anos é válida.</p>`
    }
  </div>`;
}

function blocoCorrente(c: CorrentePovo): string {
  const maior = Math.max(...c.elos.map((e) => e.valor ?? 0), 1);

  const elos = c.elos
    .map(
      (e, i) => `<div class="elo">
      <div class="elo-topo">
        <span class="elo-ord">${i + 1}</span>
        <div>
          <h4>${esc(e.rotulo)}</h4>
          <p class="micro">${esc(e.fonte)}</p>
        </div>
        <b>${n0(e.valor)}</b>
      </div>
      <span class="trilho"><i style="width:${(((e.valor ?? 0) / maior) * 100).toFixed(1)}%"></i></span>
      ${e.perda ? `<p class="elo-perda">${e.perda.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</p>` : ""}
    </div>`,
    )
    .join("");

  return `<article class="corrente">
  <header>
    <h3>Povo ${esc(c.rotulo.toLowerCase())}</h3>
    ${
      c.territorial.sinalConferencia
        ? '<span class="tag t-atencao">conferência</span>'
        : '<span class="tag t-bom">sem sinal</span>'
    }
  </header>

  <div class="elos">${elos}</div>

  ${
    c.declaradasNoCenso === null
      ? `<p class="lacuna"><b>O elo do meio não existe para este povo, e não será inventado.</b> O campo de
      cor/raça do Censo Escolar tem seis categorias — não declarada, branca, preta, parda, amarela e
      indígena — e <b>nenhuma delas é quilombola</b>. Criança quilombola aparece ali como parda, preta ou
      branca, conforme a autodeclaração da família. Preencher este elo com estimativa seria pior que a
      lacuna: transformaria uma pergunta de campo numa afirmação sem fonte.</p>`
      : c.vaoDeclaracaoParaPonderacao !== null && c.vaoDeclaracaoParaPonderacao > 0
        ? `<div class="vao">
      <div>
        <em>Distância entre declaração e ponderação</em>
        <b>${n0(c.vaoDeclaracaoParaPonderacao)}</b>
        <span>matrículas declaradas que não ponderam pelo segmento</span>
      </div>
      <div class="vao-cifra">
        <em>Se a distância for de registro</em>
        <b>${derivado(c.valorDerivado)}</b>
        <span>por ano</span>
      </div>
    </div>`
        : `<p class="lacuna ok"><b>Declaração e ponderação estão alinhadas.</b> As matrículas no segmento
      ponderado cobrem as declaradas no Censo Escolar — não há distância de registro a conferir aqui.</p>`
  }

  <div class="perguntas">
    <h4>As perguntas que esta corrente produz</h4>
    <ol>${c.perguntas.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
  </div>
</article>`;
}

export function generateDossieEquidadeHtml(input: DossieEquidadeInput): string {
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

  const zona = d.territorio?.corRaca ?? null;
  const eq = d.equidade;
  const houveMudanca = d.series.some((s) => s.anosComMudanca.length > 0);

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dossiê da Equidade e dos Territórios — ${esc(municipio)}/${esc(uf)}</title>
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
    <span class="cover-tag">Dossiê temático &middot; equidade e territórios</span>
    <h1>Três contagens<br><span class="thin">da mesma criança</span></h1>
    <p class="cover-sub">O Censo Demográfico pergunta à família. O Censo Escolar registra o que a escola
    preencheu. A Portaria do FUNDEB conta a escola com localização diferenciada declarada. São três
    perguntas diferentes — e a distância entre elas é, ao mesmo tempo, a medida da desigualdade que a
    Condicionalidade III do VAAR observa e o fator de ponderação que a rede deixa na mesa.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    <div class="cover-hero">
      ${
        r.valorDerivadoTotal !== null
          ? `<em>Se a distância entre declaração e ponderação for de registro</em>
      <div class="val"><b>${brlCompact(r.valorDerivadoTotal)}</b><i>por ano<sup class="d">d</sup></i></div>
      <p>São matrículas já declaradas no Censo Escolar que não ponderam pelo segmento correspondente do
      fundo. A ponderação segue a <b>localização da escola</b>, não a cor/raça do aluno — então a distância
      pode ser legítima, e é por isso que ela vira pergunta de campo e não acusação.</p>`
          : `<em>Não declaração de cor/raça na rede municipal</em>
      <div class="val"><b>${pc(r.naoDeclaradaPct)}</b><i>das matrículas</i></div>
      <p>É o termômetro da qualidade do cadastro. Sem o campo preenchido não há como medir desigualdade
      entre grupos — e sem medir não há como reduzir, que é exatamente o que a Condicionalidade III do VAAR
      passou a premiar.</p>`
      }
    </div>
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(dataEmissao)}</b>IBGE &middot; INEP &middot; FNDE &middot; INCRA</div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dossiê da Equidade e dos Territórios</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Sumário</div>
    <h2>Para reduzir distância<br>é preciso primeiro medi-la</h2>
    <p class="lede">O FUNDEB deixou de pagar só por média: a Condicionalidade III do VAAR premia a
    <b>redução das desigualdades socioeconômicas e raciais de aprendizagem</b>. Medir essa distância exige o
    cadastro de cor/raça preenchido — e é por aí que este dossiê começa, antes de qualquer leitura de
    composição.</p>

    <div class="kpis">
      ${kpi(pc(r.naoDeclaradaPct), "cor/raça não declarada")}
      ${kpi(pc(r.negraPct), "matrícula preta ou parda")}
      ${kpi(n0(d.condicoes.reduce((t, c) => t + c.escolas, 0)), "escolas em território diferenciado")}
      ${kpi(
        r.condicionalidadeIII === null ? "—" : r.condicionalidadeIII ? "cumprida" : "reprovada",
        `Cond. III do VAAR${d.vaar ? ` em ${d.vaar.exercicio}` : ""}`,
      )}
    </div>

    <div class="duas">
      <div class="card ${r.cadastroFragil ? "ruim" : ""}">
        <h3>A qualidade do cadastro vem antes</h3>
        ${
          eq
            ? `<table><tbody>
          <tr><td>Matrículas da rede municipal</td><td class="num"><b>${n0(eq.municipal.total)}</b></td></tr>
          <tr class="destaque"><td><b>Cor/raça não declarada</b></td><td class="num"><b>${n0(eq.municipal.naoDeclarada)}</b> <span class="sub">(${pc(r.naoDeclaradaPct)})</span></td></tr>
          <tr><td>Preta e parda</td><td class="num">${n0(eq.negraMunicipal)} <span class="sub">(${pc(r.negraPct)})</span></td></tr>
          <tr><td>Indígena</td><td class="num">${n0(eq.municipal.indigena)}</td></tr>
          <tr><td>Amarela</td><td class="num">${n0(eq.municipal.amarela)}</td></tr>
          <tr><td>Branca</td><td class="num">${n0(eq.municipal.branca)}</td></tr>
        </tbody></table>
        <p class="micro" style="margin-top:.07in">${
          r.cadastroFragil
            ? "<b>Acima de um terço não declarado.</b> Nesta faixa a distribuição descreve o preenchimento do Censo, não a composição dos alunos — corrigir o cadastro é pré-requisito de qualquer análise de equidade, e de qualquer tentativa de cumprir a Cond. III."
            : "Abaixo de um terço de não declaração, a distribuição descreve a rede e não só o preenchimento. A série da folha seguinte diz se ela sempre foi assim."
        }</p>`
            : '<p class="txt">Os microdados do Censo Escolar não trouxeram a composição por cor/raça deste município.</p>'
        }
      </div>
      <div class="card">
        <h3>A distância que vira dinheiro</h3>
        ${
          d.correntes.length > 0
            ? `<table><tbody>
          ${d.correntes
            .map(
              (c) => `<tr><td>População ${esc(c.rotulo.toLowerCase())} de 0 a 14<span class="micro">Censo 2022</span></td><td class="num"><b>${n0(c.territorial.emIdadeEscolar)}</b></td></tr>
          <tr><td>Matrículas no segmento ponderado</td><td class="num ${c.territorial.sinalConferencia ? "alerta" : ""}">${n0(c.territorial.matriculasNosSegmentos)}</td></tr>`,
            )
            .join("")}
          ${
            r.valorDerivadoTotal !== null
              ? `<tr class="destaque"><td><b>Se a distância for de registro</b></td><td class="num"><b>${derivado(r.valorDerivadoTotal)}</b></td></tr>`
              : ""
          }
        </tbody></table>
        <p class="micro" style="margin-top:.07in"><b>A ponderação segue a escola, não o aluno.</b> É
        contraintuitivo e é onde está o dinheiro: criança declarada indígena numa escola urbana comum
        pondera como urbana comum. A folha da corrente separa as duas perdas possíveis.</p>`
            : `<p class="txt">O Censo 2022 não registra população quilombola nem indígena em idade escolar
             neste município, acima do piso a partir do qual a conferência faz sentido. A folha da corrente
             não aparece — e a ausência é do Censo, não deste dossiê.</p>`
        }
      </div>
    </div>

    ${
      houveMudanca
        ? `<div class="ausencias">
      <h3>Antes de comparar qualquer ano com outro</h3>
      <p style="font-size:7.4pt;line-height:1.45;color:#5d4a2c">A série de cor/raça desta rede tem
      <b>mudança de cadastro</b> — a não declaração saltou mais de cinco pontos de um ano para o outro. Isso
      não é mudança demográfica: é o campo tendo sido preenchido. A folha seguinte marca os anos afetados, e
      nenhuma comparação de composição atravessa essa fronteira sem a ressalva.</p>
    </div>`
        : ""
    }

    ${
      d.ausencias.length > 0
        ? `<div class="ausencias">
      <h3>O que não veio nesta emissão</h3>
      <ul>${d.ausencias.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
    </div>`
        : ""
    }

    <div class="faixa-nota">
      <h3>A regra que governa este documento</h3>
      <p>${NOTA_AUTODECLARACAO}</p>
    </div>

    <p class="fonte">Fontes: INEP — microdados do Censo Escolar${
      d.anoCensoEscolar ? ` ${d.anoCensoEscolar}` : ""
    } (cor/raça por escola e por zona) e série histórica 2023–2025; ${esc(
      d.territorial?.fonte ?? "IBGE — Censo Demográfico 2022 × FNDE",
    )}; ${esc(d.assentamentos?.fonte ?? "INCRA — acervo fundiário")}.</p>
  </div>
  <div class="page-footer"><span>IBGE &middot; INEP &middot; FNDE &middot; INCRA</span><span>2</span></div>
</section>

${
  d.series.length > 0
    ? `<section class="flow">
  <h2 class="secao">A série, lida como cadastro antes de composição</h2>
  <p class="secao-sub">Duas redes, todos os anos, todos os grupos. A ordem de leitura importa: primeiro a
  coluna de <b>não declarada</b> e a de <b>variação</b>; só depois a composição. Uma queda súbita de não
  declaração entre dois anos não é mudança demográfica — é a rede tendo preenchido o campo, e a composição
  dos dois anos deixa de ser comparável.</p>
  ${d.series.map(blocoSerie).join("")}
  <p class="rodape-tabela"><b>Por que as duas redes aparecem.</b> A municipal é a que a secretaria
  administra; a pública inclui federal e estadual e descreve o território. Quando as duas se movem juntas, o
  movimento é do município; quando só a municipal se move, é da secretaria. A distinção separa política de
  rede de mudança de população.</p>
</section>`
    : ""
}

${
  d.correntes.length > 0
    ? `<section class="flow">
  <h2 class="secao">A corrente de três elos</h2>
  <p class="secao-sub">População do povo, matrícula declarada e matrícula ponderada — nesta ordem. Cada seta
  entre dois elos é uma perda possível, com causa distinta, e a <b>segunda é a que vira dinheiro</b>. Nenhuma
  análise que olhe só duas das três pontas enxerga essa segunda perda.</p>
  ${d.correntes.map(blocoCorrente).join("")}
  <p class="nota-d">${NOTA_DERIVADO}<br><br>${NOTA_AUTODECLARACAO}</p>
</section>`
    : ""
}

${
  d.condicoes.length > 0 || d.assentamentos
    ? `<section class="flow">
  <h2 class="secao">Territórios declarados, e o que cada um vale</h2>
  <p class="secao-sub">Localização diferenciada é campo do Censo Escolar, preenchido uma vez por unidade, e
  vale ponderação em toda etapa. A escola nomeada está no Dossiê das Escolas; o fator de cada segmento, no
  Dossiê da Matrícula Ponderada. Aqui elas se encontram.</p>

  ${
    d.condicoes.length > 0
      ? `<table class="grid condicoes">
    <thead><tr><th>Condição declarada</th><th class="num">Escolas<br>municipais</th><th class="num">Fator nos<br>anos iniciais</th><th>O que a condição vale</th></tr></thead>
    <tbody>
      ${d.condicoes
        .map(
          (c) => `<tr class="condicao">
        <td class="nome"><b>Escolas em ${esc(c.rotulo)}</b></td>
        <td class="num"><b>${n0(c.escolas)}</b></td>
        <td class="num f">${c.fatorExemplo === null ? "—" : dec2.format(c.fatorExemplo)}</td>
        <td class="txt">${esc(c.nota)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>`
      : `<p class="rodape-tabela">Nenhuma escola desta rede declara localização diferenciada no Censo
         Escolar. Onde há território e não há declaração, o fator não se aplica — e essa é a conferência que
         a folha da corrente propõe.</p>`
  }

  ${
    d.assentamentos
      ? `<h3 class="sub">Assentamentos do INCRA contra as escolas declaradas</h3>
  <p class="sub-nota">O acervo fundiário conta os assentamentos; o Censo Escolar conta as escolas que se
  declaram neles. Os dois não precisam bater — nem todo assentamento tem escola própria —, e a divergência é
  pergunta de campo, não erro.</p>
  <div class="duas">
    <div class="card">
      <h3>O que o INCRA registra</h3>
      <table><tbody>
        <tr><td>Assentamentos no município</td><td class="num"><b>${n0(d.assentamentos.qtd)}</b></td></tr>
        <tr><td>Famílias assentadas</td><td class="num">${n0(d.assentamentos.familias)}</td></tr>
        <tr><td>Capacidade</td><td class="num">${n0(d.assentamentos.capacidade)}</td></tr>
        <tr><td>Área</td><td class="num">${n0(d.assentamentos.areaHa)} ha</td></tr>
      </tbody></table>
      <p class="micro" style="margin-top:.06in">Fonte: ${esc(d.assentamentos.fonte)}.</p>
    </div>
    <div class="card">
      <h3>O que a rede declara</h3>
      <table><tbody>
        <tr><td>Escolas municipais em assentamento</td><td class="num"><b>${n0(
          d.condicoes.find((c) => c.codigo === 1)?.escolas ?? 0,
        )}</b></td></tr>
        <tr><td>Escolas municipais em zona rural</td><td class="num">${n0(d.territorio?.rurais)}</td></tr>
        <tr><td>Total de escolas municipais</td><td class="num">${n0(d.territorio?.total)}</td></tr>
      </tbody></table>
      <p class="micro" style="margin-top:.06in">Assentamento pondera pelo fator do campo — 15% acima do
      urbano na mesma etapa. Se há famílias assentadas e nenhuma escola declarada em assentamento, a pergunta
      é onde essas crianças estudam, e como aquela escola está classificada.</p>
    </div>
  </div>`
      : ""
  }
</section>`
    : ""
}

${
  zona
    ? `<section class="flow junta">
  <h2 class="secao">Cor/raça por zona — o que o agregado municipal esconde</h2>
  <p class="secao-sub">O número único da rede é média de duas realidades. É comum a rede rural ser
  significativamente mais negra e ter pior resultado — e quando é, <b>o mapa da rede é o mapa da
  Condicionalidade III</b>.</p>

  <table class="grid">
    <thead><tr>
      <th>Zona</th><th class="num">Matrículas</th><th class="num">Preta e parda</th><th></th>
      <th class="num">Indígena</th><th class="num">Não declarada</th>
    </tr></thead>
    <tbody>
      <tr><td class="nome"><b>Urbana</b></td><td class="num">${n0(zona.urbana.matriculas)}</td>
        <td class="num"><b>${pc(zona.urbana.negraPct)}</b></td>
        <td class="bar"><span class="trilho"><i style="width:${(zona.urbana.negraPct ?? 0).toFixed(1)}%"></i></span></td>
        <td class="num">${pc(zona.urbana.indigenaPct)}</td><td class="num sub">${pc(zona.urbana.naoDeclaradaPct)}</td></tr>
      <tr><td class="nome"><b>Rural</b></td><td class="num">${n0(zona.rural.matriculas)}</td>
        <td class="num"><b>${pc(zona.rural.negraPct)}</b></td>
        <td class="bar"><span class="trilho"><i style="width:${(zona.rural.negraPct ?? 0).toFixed(1)}%"></i></span></td>
        <td class="num">${pc(zona.rural.indigenaPct)}</td><td class="num sub">${pc(zona.rural.naoDeclaradaPct)}</td></tr>
    </tbody>
  </table>

  <p class="rodape-tabela">${
    r.diferencaNegraRuralUrbana !== null && Math.abs(r.diferencaNegraRuralUrbana) >= 3
      ? `<b>A rede rural é ${dec1.format(Math.abs(r.diferencaNegraRuralUrbana))} pontos ${
          r.diferencaNegraRuralUrbana > 0 ? "mais" : "menos"
        } negra que a urbana.</b> Diferença desse tamanho significa que qualquer desigualdade de resultado
        entre zonas é também desigualdade racial — e é assim que a Condicionalidade III a lê. Cruze com o
        Dossiê das Escolas: as unidades rurais estão nomeadas lá, com IDEB, abandono e distorção.`
      : "A composição das duas zonas é próxima, então a desigualdade entre elas — se houver, e o Dossiê das Escolas mostra — não se explica por composição racial."
  }${
    zona.rural.naoDeclaradaPct !== null &&
    zona.urbana.naoDeclaradaPct !== null &&
    Math.abs(zona.rural.naoDeclaradaPct - zona.urbana.naoDeclaradaPct) >= 5
      ? `<br><b>O preenchimento do campo também difere entre as zonas</b> — ${pc(zona.urbana.naoDeclaradaPct)} na urbana contra ${pc(zona.rural.naoDeclaradaPct)} na rural. Antes de ler a composição como diferença de população, conferir se ela não é diferença de cadastro.`
      : ""
  }</p>
</section>`
    : ""
}

${
  d.vaar
    ? `<section class="flow">
  <h2 class="secao">A ponte com a Condicionalidade III</h2>
  <p class="secao-sub">A Cond. III do VAAR mede <b>redução das desigualdades socioeconômicas e raciais de
  aprendizagem</b>. Reprovar nela zera a parcela inteira do VAAR, por melhor que a rede seja no resto — é o
  art. 14, §1º da Lei 14.113/2020.</p>

  <div class="duas">
    <div class="card ${r.condicionalidadeIII === false ? "ruim" : ""}">
      <h3>Situação em ${d.vaar.exercicio}</h3>
      <table><tbody>
        <tr class="destaque"><td><b>Condicionalidade III</b></td><td class="num"><b>${
          r.condicionalidadeIII === null
            ? "não informada"
            : r.condicionalidadeIII
              ? "cumprida"
              : "reprovada"
        }</b></td></tr>
        <tr><td>Habilitado ao VAAR</td><td class="num">${d.vaar.habilitado ? "sim" : "não"}</td></tr>
        ${
          d.vaar.reprovadas.length > 0
            ? `<tr><td>Condicionalidades reprovadas</td><td class="num alerta">${esc(d.vaar.reprovadas.join(", "))}</td></tr>`
            : ""
        }
      </tbody></table>
      <p class="micro" style="margin-top:.07in">${
        r.condicionalidadeIII === false
          ? "A condicionalidade que este dossiê inteiro descreve está reprovada. As duas folhas anteriores — a série de cadastro e a composição por zona — são o ponto de partida para qualquer plano de recuperá-la."
          : "A condicionalidade está cumprida. Sustentá-la depende de o cadastro continuar preenchido: sem cor/raça declarada não há como medir redução de distância, e o que não se mede não se comprova."
      }</p>
    </div>
    <div class="card">
      <h3>O que o cadastro precisa ter</h3>
      <p class="txt">Medir desigualdade racial de aprendizagem exige três coisas ao mesmo tempo, e nenhuma
      delas é automática:</p>
      <ol class="lista">
        <li><b>Campo de cor/raça preenchido</b>, por autodeclaração da família — não por observação de quem
        matricula.</li>
        <li><b>Participação no Saeb acima de 80%</b>, que é a Cond. II e é logística de aplicação.</li>
        <li><b>Localização diferenciada declarada</b> por unidade, que é o que liga território a fator.</li>
      </ol>
      <p class="micro" style="margin-top:.06in">As três são atos de cadastro, feitos na coleta do Censo e na
      aplicação da prova. Nenhuma exige obra, contratação ou lei — e é por isso que são as primeiras a
      resolver.</p>
    </div>
  </div>

  <p class="fonte" style="margin-top:.2in">Emitido em ${esc(dataEmissao)} por ${esc(responsavel)} &middot;
  Global Company Consultorias. Documento confidencial, destinado exclusivamente ao município analisado.</p>
</section>`
    : ""
}

${secaoQuemFicaDeFora(d)}

</body></html>`;
}

/**
 * Quatro cruzamentos que já existiam no Raio-X e que este dossiê não via.
 *
 * Todos respondem à pergunta que a peça inteira faz — **quem fica de fora, e
 * por quê** — e nenhum exige coleta nova: os datasets estão versionados. A
 * seção só imprime o que o município tem; num município sem aldeia, sem
 * ocupação estimada e com notificação em dia, ela simplesmente não aparece.
 *
 * A ordem é deliberada: primeiro o que a lei já resolve (idade mínima),
 * depois o que a ponderação paga (aldeia), depois as duas condições de
 * chegada — a atenção primária alcança? a rede de proteção registra?
 *
 * Cada bloco carrega a ressalva da sua fonte, e nenhuma delas é opcional:
 * ocupação vem de **amostra** do Censo; notificação **não é** ocorrência; e
 * cobertura vacinal acima de 100% não é excelência, é artefato de
 * denominador.
 */
function secaoQuemFicaDeFora(d: DossieEquidade): string {
  const blocos: string[] = [];

  const ti = d.trabalhoInfantil;
  if (ti && !ti.semOcupacaoEstimada) {
    const menor = ti.abaixoDaIdadeMinima;
    const maior = ti.idadeDeAprendizagem;
    blocos.push(`<div class="card ${menor && menor.ocupadas > 0 ? "ruim" : ""}">
      <h3>Ocupação na idade escolar</h3>
      <table><tbody>
        ${menor ? `<tr class="destaque"><td><b>10 a 13 anos ocupados</b></td><td class="num"><b>${n0(menor.ocupadas)}</b>${menor.taxaPct !== null ? ` · ${pc(menor.taxaPct)}` : ""}</td></tr>` : ""}
        ${maior ? `<tr><td>14 a 17 anos ocupados</td><td class="num">${n0(maior.ocupadas)}${maior.taxaPct !== null ? ` · ${pc(maior.taxaPct)}` : ""}</td></tr>` : ""}
      </tbody></table>
      <p class="micro" style="margin-top:.07in">As duas faixas <b>não se somam</b>: abaixo de 14 não há
      hipótese legal de trabalho (CF, art. 7º, XXXIII); de 14 a 17 há, e ocupação nessa faixa não é, por si,
      irregularidade. ${esc(ti.ressalva)}</p>
    </div>`);
  }

  const al = d.aldeias;
  if (al && al.aldeias.length > 0) {
    blocos.push(`<div class="card ${al.registroSemDeclaracao ? "ruim" : ""}">
      <h3>Aldeias no cadastro da FUNAI</h3>
      <table><tbody>
        <tr class="destaque"><td><b>Aldeias registradas</b></td><td class="num"><b>${n0(al.aldeias.length)}</b></td></tr>
        <tr><td>Escolas municipais em terra indígena</td><td class="num ${al.registroSemDeclaracao ? "alerta" : ""}">${n0(al.escolasIndigenas)}</td></tr>
        <tr><td>Aldeias sem escola indígena a ${al.raioKm} km</td><td class="num">${n0(al.aldeiasSemEscolaIndigena)}</td></tr>
      </tbody></table>
      <p class="micro" style="margin-top:.07in">${
        al.registroSemDeclaracao
          ? "A FUNAI cadastra aldeia e o Censo não declara nenhuma escola municipal em terra indígena. <b>Não é irregularidade</b> — a escola pode ser estadual, ou as crianças podem estudar fora da aldeia. Mas a ponderação segue a classificação da escola, e é o único elo desta corrente que não depende de autodeclaração."
          : "O cadastro da FUNAI é o único elo desta corrente que não depende de autodeclaração: ele registra onde há aldeia, e a ponderação segue a classificação da escola."
      }</p>
    </div>`);
  }

  const vac = d.vacinacao;
  const vio = d.violencia;
  if (vac || vio) {
    const linhaVac = vac
      ? `<tr><td>Coberturas abaixo da mediana nacional</td><td class="num ${vac.abaixoDaMediana >= 3 ? "alerta" : ""}">${n0(vac.abaixoDaMediana)} de ${n0(vac.vacinas.length)}</td></tr>`
      : "";
    const linhaVio = vio
      ? `<tr class="destaque"><td><b>Notificações de violência (5 a 14)</b></td><td class="num"><b>${n0(vio.total)}</b></td></tr>`
      : "";
    blocos.push(`<div class="card ${vio?.silencioTotal ? "ruim" : ""}">
      <h3>O que alcança a criança, e o que fica registrado</h3>
      <table><tbody>${linhaVio}${linhaVac}</tbody></table>
      <p class="micro" style="margin-top:.07in">${
        vio?.silencioTotal
          ? "<b>Zero notificação quase nunca significa ausência de violência</b> — significa ausência de registro, e a escola é notificante obrigatória (Lei nº 13.431/2017 e ECA, art. 245). "
          : "<b>Número maior de notificações não significa mais violência</b> — costuma significar vigilância melhor. "
      }${
        vac
          ? `A cobertura vacinal mede se a atenção primária alcança o território; acima de 100% ela não sustenta leitura, porque o denominador é população estimada. Série do PNI encerrada em ${vac.ano}.`
          : ""
      }</p>
    </div>`);
  }

  if (blocos.length === 0) return "";

  return `<section class="flow">
  <h2 class="secao">Quem fica de fora, por outras quatro fontes</h2>
  <p class="secao-sub">As folhas anteriores mediram quem a rede registra e como isso vira ponderação. Estes
  quatro cruzamentos vêm de fora da educação e respondem à mesma pergunta por outro caminho — ocupação em
  idade escolar, aldeia cadastrada, alcance da atenção primária e fluxo de proteção. Nenhum classifica o
  município: todos apontam onde conferir.</p>
  <div class="${blocos.length >= 2 ? "duas" : ""}">${blocos.join("")}</div>
</section>`;
}

function kpi(valor: string, rotulo: string): string {
  return `<div class="kpi"><b>${valor}</b><span>${rotulo}</span></div>`;
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
  letter-spacing:.13em;text-transform:uppercase;max-width:4.8in;line-height:1.4}
.cover-hero .val{display:flex;align-items:baseline;gap:.14in;margin-top:.08in}
.cover-hero .val b{color:var(--teal);font-size:42pt;font-weight:700;letter-spacing:-.035em;line-height:.92}
.cover-hero .val i{font-style:normal;background:var(--teal);color:#fff;font-size:9pt;font-weight:800;
  border-radius:999px;padding:.045in .13in;white-space:nowrap}
.cover-hero .val i .d{color:#d6f2ee;margin-left:.02in}
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
.kpi b{display:block;color:var(--navy);font-size:16pt;letter-spacing:-.02em;line-height:1.05}
.kpi span{display:block;color:var(--muted);font-size:6.6pt;font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;margin-top:.05in;line-height:1.3}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.2in;break-before:avoid}
.card{border:1px solid var(--line);border-radius:8px;padding:.14in .16in;background:#fff;
  break-inside:avoid;page-break-inside:avoid}
.card.ruim{border-color:#e6bab8;background:#fdf6f5}
.card h3{font-size:10.5pt;color:var(--navy);margin-bottom:.07in}
.card .txt{font-size:8pt;line-height:1.45;color:#44545f}
.lista{padding-left:.18in;font-size:7.8pt;line-height:1.45;color:#44545f;margin-top:.06in}
.lista li{margin-bottom:.04in}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.042in 0;border-bottom:1px solid #eef3f5;vertical-align:top}
table td.num{text-align:right;color:var(--navy);white-space:nowrap}
td.num.sub,th.num.sub,td.sub,span.sub{color:var(--muted);font-weight:400}
td.alerta{color:var(--red)}
td.f{color:var(--teal);font-weight:700}
tr.destaque td{background:rgba(39,166,154,.07)}
.micro{display:block;font-size:6.8pt;color:var(--muted);line-height:1.35;font-weight:400}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}
sup.d{color:var(--gold);font-weight:800;font-size:.7em;margin-left:.03in}
.tag{display:inline-block;font-size:6.2pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  border-radius:999px;padding:.025in .08in;white-space:nowrap;background:#eef3f5;color:var(--muted)}
.t-atencao{background:#fdf4e3;color:var(--gold)}
.t-bom{background:#eef6f5;color:var(--good)}

.ausencias{margin-top:.18in;border:1px solid #e2c084;background:#fdf9ee;border-radius:8px;padding:.12in .15in}
.ausencias h3{font-size:9pt;color:#8a5a0d;margin-bottom:.05in}
.ausencias ul{padding-left:.16in;font-size:7.4pt;line-height:1.42;color:#5d4a2c}
.faixa-nota{margin-top:.18in;border:1px solid var(--line);background:var(--wash);border-radius:8px;
  padding:.12in .15in}
.faixa-nota h3{font-size:9pt;color:var(--navy);margin-bottom:.04in}
.faixa-nota p{font-size:7.5pt;line-height:1.45;color:#44545f}

/* ── tabelas de fluxo ────────────────────────────────────────────────────── */
.grid{margin-top:.12in;font-size:8pt}
.grid thead{display:table-header-group}
.grid thead th{text-align:left;font-size:6.8pt;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  font-weight:800;padding:0 0 .05in;border-bottom:1.5px solid var(--navy);vertical-align:bottom}
.grid thead th.num{text-align:right}
.grid tbody tr{break-inside:avoid;page-break-inside:avoid}
.grid tbody td{padding:.05in 0;border-bottom:1px solid #eef3f5}
.grid tbody td.nome{padding-right:.14in}
.grid tbody td.txt{font-size:7.4pt;line-height:1.42;color:#44545f;padding-left:.14in}
.trilho{display:block;background:#e9f0f1;border-radius:2px;height:.075in;width:.8in}
.trilho i{display:block;height:100%;background:var(--teal);border-radius:2px}
td.bar{width:.85in;padding-left:.08in;padding-right:.08in}
.rodape-tabela{margin-top:.12in;font-size:7.4pt;line-height:1.45;color:#44545f;background:var(--wash);
  border-left:.03in solid var(--teal);padding:.09in .12in;border-radius:0 6px 6px 0}
.nota-d{margin-top:.12in;font-size:6.9pt;line-height:1.45;color:var(--muted)}
h3.sub{margin-top:.22in;font-size:11.5pt;color:var(--navy);letter-spacing:-.015em;
  break-after:avoid;page-break-after:avoid}
.sub-nota{font-size:7.6pt;color:var(--muted);line-height:1.45;margin-top:.03in;max-width:6.2in;
  break-after:avoid;page-break-after:avoid}

/* ── série de cor/raça ───────────────────────────────────────────────────── */
.serie{margin-bottom:.22in;break-inside:avoid;page-break-inside:avoid}
/* Sem largura declarada, "MATRÍCULAS" e "COMPOSIÇÃO DECLARADA" encostavam. */
.serie-tab th:first-child,.serie-tab td.nome{width:.5in}
.serie-tab th:nth-child(2),.serie-tab td:nth-child(2){width:.8in;padding-right:.14in}
.condicoes th:nth-child(2),.condicoes td:nth-child(2){width:.9in}
.condicoes th:nth-child(3),.condicoes td:nth-child(3){width:.85in;padding-right:.06in}
.empi{width:2.2in;padding-left:.08in;padding-right:.1in}
.empilhada{display:flex;height:.17in;border-radius:3px;overflow:hidden;border:1px solid var(--line)}
.empilhada .seg{display:flex;align-items:center;justify-content:center;font-size:5.8pt;font-weight:800;
  color:#fff;min-width:0}
.g-nd{background:#8d9aa2}
.g-preta{background:#2f3e46}
.g-parda{background:#a8763e}
.g-branca{background:#dfe6e9;color:#44545f!important}
.g-amarela{background:#d9b64a}
.g-indigena{background:#1d7d72}
.ano-serie.mudou td{background:#fdf9ee}
.legenda{display:flex;flex-wrap:wrap;gap:.02in .14in;margin-top:.05in;font-size:6.6pt;color:var(--muted)}
.legenda .leg{display:flex;align-items:center;gap:.04in}
.legenda i{display:inline-block;width:.08in;height:.08in;border-radius:2px;border:1px solid rgba(0,0,0,.08)}
.alerta-cadastro{margin-top:.08in;padding:.08in .11in;background:#fdf9ee;border-left:.03in solid var(--gold);
  border-radius:0 6px 6px 0;font-size:7.5pt;line-height:1.45;color:#5d4a2c}

/* ── corrente ────────────────────────────────────────────────────────────── */
.corrente{border:1px solid var(--line);border-radius:8px;padding:.15in .17in;margin-bottom:.18in;
  break-inside:avoid;page-break-inside:avoid;background:#fff}
.corrente header{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:.08in;
  border-bottom:1px solid var(--line)}
.corrente h3{font-size:12pt;color:var(--navy);letter-spacing:-.015em}
.elos{margin-top:.1in}
.elo{margin-bottom:.11in}
.elo-topo{display:grid;grid-template-columns:.24in 1fr auto;align-items:baseline;gap:.08in}
.elo-ord{color:var(--muted);font-size:8pt;font-weight:800}
.elo h4{font-size:8.6pt;color:var(--navy);line-height:1.25}
.elo-topo > b{font-size:13pt;color:var(--navy);letter-spacing:-.02em}
.elo .trilho{width:100%;margin-top:.04in}
.elo-perda{margin-top:.05in;margin-left:.32in;font-size:7.2pt;line-height:1.42;color:var(--muted)}
.lacuna{margin-top:.09in;padding:.09in .12in;background:var(--wash);border-radius:6px;font-size:7.6pt;
  line-height:1.45;color:#33454f}
.lacuna.ok{background:#f3faf7}
.vao{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.1in;padding:.11in .13in;
  background:#fdf9ee;border-radius:6px}
.vao em{display:block;font-style:normal;font-size:6.6pt;font-weight:800;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted)}
.vao b{display:block;font-size:19pt;color:var(--navy);letter-spacing:-.03em;line-height:1.1;margin-top:.02in}
.vao span{display:block;font-size:6.8pt;color:var(--muted);line-height:1.3}
.vao-cifra{border-left:1px solid #e2c084;padding-left:.14in}
.vao-cifra b{color:var(--gold)}
.perguntas{margin-top:.11in;padding-top:.09in;border-top:1px solid var(--line)}
.perguntas h4{font-size:6.9pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.perguntas ol{padding-left:.18in;margin-top:.05in;font-size:7.5pt;line-height:1.45;color:#44545f}
.perguntas li{margin-bottom:.03in}
`;
