import type { DossieDemanda, FaixaCobertura } from "./dossie-demanda";

/**
 * Dossiê da Demanda — HTML de impressão.
 *
 * Duas regras editoriais próprias deste documento:
 *
 * 1. **Criança de 0 a 3 fora da creche não é "fora da escola".** A matrícula é
 *    obrigatória dos 4 aos 17 (EC 59/2009); antes disso é direito da família e
 *    dever de oferta do Estado. Os dois números aparecem separados e nunca
 *    somados — juntá-los quintuplica o problema e destrói a credibilidade da
 *    folha inteira.
 * 2. **Coorte não é matrícula.** O Registro Civil conta quem nasceu; a criança
 *    pode ir para a rede privada ou estadual. O que este dossiê projeta é
 *    demanda, e diz isso em cada folha onde projeta.
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

function brlCompact(v: number | null | undefined): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$${NBSP}${dec2.format(v / 1_000_000)}${NBSP}mi`;
  if (abs >= 1_000) return `R$${NBSP}${dec1.format(v / 1_000)}${NBSP}mil`;
  return `R$${NBSP}${dec2.format(v)}`;
}

const derivado = (v: number | null | undefined) =>
  v == null ? "—" : `${brlCompact(v)}<sup class="d">d</sup>`;

const NOTA_DERIVADO =
  '<sup class="d">d</sup> <b>Cifra derivada, e ela não é lucro.</b> O art. 7º, §1º da Lei 14.113/2020 fixa os ' +
  "anos iniciais do fundamental urbano em jornada parcial como a referência de fator 1,00, então o valor " +
  "aluno/ano desse segmento na Portaria é o preço de uma matrícula-equivalente na UF. Multiplicar por " +
  "matrícula × fator repete a aritmética da própria Portaria. Mas <b>abrir vaga de creche custa</b>: a receita " +
  "por matrícula é real e entra no exercício seguinte, e não paga a vaga sozinha. O número dimensiona a " +
  "decisão; não a vende.";

export interface DossieDemandaInput {
  municipio: string;
  uf: string;
  codigoIbge: string;
  dossie: DossieDemanda;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

function barra(pctValor: number | null, classe = ""): string {
  const largura = pctValor === null ? 0 : Math.max(0, Math.min(100, pctValor));
  return `<span class="trilho ${classe}"><i style="width:${largura.toFixed(1)}%"></i></span>`;
}

function linhaFaixa(f: FaixaCobertura): string {
  const alcancou = f.faltamParaMeta === 0;
  return `<tr class="faixa">
    <td class="nome"><b>${esc(f.rotulo)}</b><span class="micro">${esc(f.idade)}${
      f.obrigatoria ? " &middot; matrícula obrigatória" : " &middot; oferta obrigatória, matrícula facultativa"
    }</span></td>
    <td class="num">${n0(f.populacao)}</td>
    <td class="num">${n0(f.matriculaMunicipal)}</td>
    <td class="num"><b>${pc(f.coberturaMunicipal)}</b></td>
    <td class="bar">${barra(f.coberturaMunicipal)}</td>
    <td class="num">${n0(f.matriculaTotal)}</td>
    <td class="num"><b>${pc(f.coberturaTotal)}</b></td>
    <td class="bar">${barra(f.coberturaTotal, "cheia")}</td>
    <td class="num sub">${pc(f.metaPne)}</td>
    <td class="num ${alcancou ? "bom" : "alerta"}">${
      alcancou ? "alcançada" : `faltam ${inteiro.format(f.faltamParaMeta)}`
    }</td>
  </tr>`;
}

export function generateDossieDemandaHtml(input: DossieDemandaInput): string {
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

  const dem = d.demografia;
  const nascimentos = dem?.nascimentos ?? [];
  const maiorCoorte = nascimentos.reduce((m, n) => Math.max(m, n.nascidos), 0);
  const creche = d.creche;
  const bf = d.buscaAtiva;
  const emQueda = (r.tendenciaNascimentos ?? 0) < 0;
  // Meta já alcançada não pode virar "R$ 0,00" — é resultado, não achado vazio.
  const metaCrecheAlcancada = creche !== null && creche.matriculasAteMeta === 0;

  const linhasCoortes = nascimentos
    .map(
      (c) => `<tr class="coorte">
      <td class="nome"><b>${c.anoNascimento}</b></td>
      <td class="num"><b>${n0(c.nascidos)}</b></td>
      <td class="bar">${barra(maiorCoorte > 0 ? (c.nascidos / maiorCoorte) * 100 : 0)}</td>
      <td class="num">${c.anoNascimento + 1}</td>
      <td class="num">${c.chegaPreEscolaEm}</td>
      <td class="num"><b>${c.chegaPrimeiroAnoEm}</b></td>
      <td class="num sub">${c.anoNascimento + 11}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dossiê da Demanda — ${esc(municipio)}/${esc(uf)}</title>
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
    <span class="cover-tag">Dossiê temático &middot; demanda e cobertura</span>
    <h1>A rede de ${r.proximaCoorte?.chegaEm ?? 2030}<br><span class="thin">já nasceu</span></h1>
    <p class="cover-sub">A matrícula segue o nascimento com atraso fixo: quem nasceu em
    ${r.proximaCoorte?.nascimento ?? "2024"} entra na pré-escola quatro anos depois e no 1º ano em
    ${r.proximaCoorte?.chegaEm ?? 2030}. O Registro Civil já contou todas essas crianças, uma a uma. <b>Não
    existe incerteza demográfica de curto prazo em educação básica</b> — existe gente que não olhou.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    ${
      r.proximaCoorte
        ? `<div class="cover-hero">
      <em>Nasceram em ${r.proximaCoorte.nascimento} e chegam ao 1º ano em ${r.proximaCoorte.chegaEm}</em>
      <div class="val"><b>${inteiro.format(r.proximaCoorte.nascidos)}</b><i>crianças já contadas</i></div>
      <p>${
        emQueda
          ? `A série de nascimentos caiu ${pc(Math.abs(r.tendenciaNascimentos!))} entre a primeira e a última coorte. Base do fundo encolhendo em data conhecida — e é a única página deste conjunto que fala do exercício de ${r.proximaCoorte.chegaEm}.`
          : `A série de nascimentos subiu ${pc(Math.abs(r.tendenciaNascimentos ?? 0))} entre a primeira e a última coorte. É pressão de matrícula chegando em data conhecida, e vaga não se abre no mesmo ano em que a criança bate na porta.`
      }</p>
    </div>`
        : `<div class="cover-hero">
      <em>Registro Civil</em><div class="val"><b>—</b><i>sem resposta do IBGE</i></div>
      <p>As consultas de nascidos vivos e de população por idade não responderam nesta emissão. A folha
      seguinte diz o que ficou de fora e por quê.</p>
    </div>`
    }
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(dataEmissao)}</b>IBGE &middot; INEP &middot; MDS</div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dossiê da Demanda</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Sumário</div>
    <h2>Vaga não se abre no ano<br>em que a criança bate na porta</h2>
    <p class="lede">Creche exige obra, professor concursado e alvará; ampliar oferta leva de dois a quatro
    anos. A coorte que precisa dessa vaga já nasceu e já foi contada. Este dossiê põe as duas coisas na mesma
    tabela — quem chega, em que ano, e o que a rede tem hoje.</p>

    <div class="kpis">
      ${kpi(pc(r.coberturaCrecheTotal), "cobertura de creche, todas as redes")}
      ${kpi(n0(r.demandaCrecheNaoAtendida), "crianças de 0 a 3 sem vaga")}
      ${kpi(n0(r.foraDaEscolaObrigatoria), "de 4 a 14 fora de qualquer rede")}
      ${kpi(n0(r.naoLocalizadosBolsaFamilia), "não localizados no Bolsa Família")}
    </div>

    <div class="distincao">
      <h3>Os dois números que não podem ser somados</h3>
      <div class="par">
        <div>
          <em>Demanda não atendida &middot; 0 a 3 anos</em>
          <b>${n0(r.demandaCrecheNaoAtendida)}</b>
          <p>Creche é <b>dever de oferta</b> do Estado e direito da família — a matrícula não é obrigatória.
          Criança de 2 anos sem vaga é fila, é mãe fora do mercado de trabalho e é receita de fundo não
          capturada. Não é ilegalidade.</p>
        </div>
        <div class="grave">
          <em>Fora da escola &middot; 4 a 14 anos</em>
          <b>${n0(r.foraDaEscolaObrigatoria)}</b>
          <p>Aqui a matrícula é <b>obrigatória</b> (EC 59/2009). Criança desta faixa fora de qualquer rede é
          descumprimento de dever constitucional, aciona conselho tutelar e Ministério Público, e é o número
          que vai para a busca ativa.</p>
        </div>
      </div>
      <p class="micro">Somar os dois daria ${n0(
        (r.demandaCrecheNaoAtendida ?? 0) + (r.foraDaEscolaObrigatoria ?? 0),
      )} — número que aparece em muita apresentação e que qualquer secretário desmonta em uma frase. Este
      dossiê nunca os soma.</p>
    </div>

    ${
      d.ausencias.length > 0
        ? `<div class="ausencias">
      <h3>O que não veio nesta emissão, e por quê</h3>
      <ul>${d.ausencias.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
    </div>`
        : ""
    }

    <div class="faixa-nota">
      <h3>Sobre os denominadores desta folha e das próximas</h3>
      <p>A população é do <b>Censo Demográfico 2022</b> e a matrícula é do <b>Censo Escolar
      ${d.censo?.anoReferencia ?? ""}</b> — três anos de distância entre numerador e denominador. Leia como
      ordem de grandeza, não como taxa exata. Cobertura acima de 100% <b>não é erro</b>: significa que a rede
      atende crianças de municípios vizinhos, e o denominador conta só quem mora aqui. Onde isso acontece, a
      conta de "fora da escola" perde sentido e o dossiê imprime travessão em vez de um número inventado.</p>
    </div>

    <p class="fonte">Fontes: ${esc(dem?.fonte ?? "IBGE — Censo 2022 e Registro Civil")}; INEP — Censo Escolar
    ${d.censo?.anoReferencia ?? ""}, matrícula por etapa e dependência; ${esc(
      bf?.fonte ?? "MDS — Matriz de Informação Social / SICON",
    )}${d.rural ? `; ${esc(d.rural.fonte)}` : ""}.</p>
  </div>
  <div class="page-footer"><span>IBGE &middot; INEP &middot; MDS</span><span>2</span></div>
</section>

${
  nascimentos.length > 0
    ? `<section class="flow">
  <h2 class="secao">O calendário das coortes</h2>
  <p class="secao-sub">Cada linha é um ano de nascimento e os anos em que aquela turma bate em cada porta da
  rede. Não é projeção estatística: são crianças já nascidas e já contadas pelo Registro Civil, por município
  de residência da mãe. <b>É o plano decenal em uma tabela.</b></p>

  <table class="grid">
    <thead><tr>
      <th>Nasceram em</th><th class="num">Crianças</th><th></th>
      <th class="num">Creche<span class="micro">a partir de</span></th>
      <th class="num">Pré-escola<span class="micro">aos 4 anos</span></th>
      <th class="num">1º ano<span class="micro">aos 6 anos</span></th>
      <th class="num">Anos finais<span class="micro">aos 11</span></th>
    </tr></thead>
    <tbody>${linhasCoortes}</tbody>
  </table>

  <p class="rodape-tabela"><b>Coorte não é matrícula.</b> A criança contada aqui pode ir para a rede privada
  ou para a estadual, e uma parte muda de município. O que a tabela projeta é <b>demanda</b> — o teto do que
  a rede vai enfrentar, não o número de matrículas que ela terá. Para converter demanda em matrícula, use a
  cobertura observada da folha seguinte: ela já embute a divisão que este município pratica hoje.
  ${
    emQueda
      ? `<br><b>A série está caindo ${pc(Math.abs(r.tendenciaNascimentos!))}.</b> Isso não é alívio: é a base do fundo encolhendo com dois anos de defasagem — a Portaria de um ano usa o Censo do ano anterior. E a queda não desobriga a rede de abrir vaga de creche, porque a cobertura atual está longe da meta.`
      : ""
  }</p>

  ${
    d.projecao.length > 0
      ? `<h3 class="sub">O mesmo dado, visto por ano de chegada</h3>
  <p class="sub-nota">Quantas crianças estarão na idade de cada etapa, em cada ano. A linha da pré-escola só
  aparece quando <b>as duas coortes</b> que a compõem — 4 e 5 anos — já nasceram; nos anos em que falta uma,
  o campo sai vazio, porque completá-lo exigiria projetar nascimento que ainda não aconteceu.</p>
  <table class="grid">
    <thead><tr>
      <th>Ano</th><th class="num">Chegam ao 1º ano</th><th class="num">Coorte</th>
      <th class="num">Na idade de pré-escola</th><th class="num">Coortes</th>
    </tr></thead>
    <tbody>
      ${d.projecao
        .map(
          (p) => `<tr>
        <td class="nome"><b>${p.ano}</b></td>
        <td class="num"><b>${n0(p.chegamAoPrimeiroAno)}</b></td>
        <td class="num sub">nascidos em ${p.coorteDoPrimeiroAno}</td>
        <td class="num"><b>${n0(p.naPreEscola)}</b></td>
        <td class="num sub">${p.coortesDaPreEscola.length > 0 ? p.coortesDaPreEscola.join(" e ") : "—"}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>`
      : ""
  }
</section>`
    : ""
}

${
  d.faixas.length > 0
    ? `<section class="flow">
  <h2 class="secao">Cobertura por faixa, com os dois denominadores</h2>
  <p class="secao-sub">A mesma população, dividida por dois numeradores diferentes. <b>Rede municipal</b>
  responde quanto a prefeitura atende; <b>todas as redes</b> responde quanto está na escola. A distância
  entre as duas é o que outra rede atende — e o que falta na segunda para 100% é criança fora da escola,
  nas faixas em que a matrícula é obrigatória.</p>

  <table class="grid cobertura">
    <thead><tr>
      <th>Faixa</th><th class="num">População<span class="micro">Censo 2022</span></th>
      <th class="num">Rede municipal</th><th class="num">%</th><th></th>
      <th class="num">Todas as redes</th><th class="num">%</th><th></th>
      <th class="num">Meta PNE</th><th class="num">Situação</th>
    </tr></thead>
    <tbody>${d.faixas.map(linhaFaixa).join("")}</tbody>
  </table>

  <p class="rodape-tabela"><b>A meta 1 do PNE pede 50% da população de 0 a 3 em creche</b> e universalização
  de 4 a 17. As demais faixas aparecem com 100% porque é o que a Constituição exige, não porque o PNE tenha
  projetado meta municipal.
  ${
    d.faixas.some((f) => f.atraiDeFora)
      ? `<br><b>Cobertura acima de 100% em ${d.faixas
          .filter((f) => f.atraiDeFora)
          .map((f) => f.rotulo.toLowerCase())
          .join(" e ")}.</b> A rede atende mais crianças do que a população residente da faixa: são alunos de municípios vizinhos. Não é erro de conta, e é informação de planejamento — essas vagas custam ao município e contam no fundo dele.`
      : ""
  }</p>
</section>`
    : ""
}

${
  creche
    ? `<section class="flow junta">
  <h2 class="secao">A conta da creche</h2>
  <p class="secao-sub">Creche integral pública urbana pondera <b>${creche.fatorIntegral === null ? "—" : dec2.format(creche.fatorIntegral)}</b>
  no FUNDEB — o maior fator disponível sem mudar o público que o município já atende. É por isso que a
  distância até a meta do PNE é, ao mesmo tempo, a maior fila social e a maior alavanca de receita da rede.</p>

  <div class="duas">
    <div class="card">
      <h3>Onde a rede está</h3>
      <table><tbody>
        <tr><td>População de 0 a 3 anos</td><td class="num"><b>${n0(creche.populacao)}</b></td></tr>
        <tr><td>Matrículas de creche, todas as redes</td><td class="num">${n0(creche.matriculaTotal)}</td></tr>
        <tr class="destaque"><td><b>Cobertura</b></td><td class="num"><b>${pc(creche.coberturaTotal)}</b></td></tr>
        <tr><td>Meta 1 do PNE</td><td class="num">${pc(creche.metaPct)}</td></tr>
        <tr><td>Crianças de 0 a 3 sem vaga hoje</td><td class="num">${n0(r.demandaCrecheNaoAtendida)}</td></tr>
      </tbody></table>
      <div class="regua">
        <span class="r-rot">cobertura atual</span>${barra(creche.coberturaTotal)}<i>${pc(creche.coberturaTotal)}</i>
      </div>
      <div class="regua">
        <span class="r-rot">meta do PNE</span>${barra(creche.metaPct, "meta")}<i>${pc(creche.metaPct)}</i>
      </div>
    </div>
    <div class="card ${metaCrecheAlcancada ? "" : "alvo"}">
      <h3>O que falta, e o que ele vale</h3>
      ${
        metaCrecheAlcancada
          ? `<p class="txt"><b>A meta 1 do PNE já está alcançada nesta rede.</b> Com ${pc(creche.coberturaTotal)}
             de cobertura, ${esc(municipio)} está acima dos 50% que o Plano pede — e acima da imensa maioria
             das redes municipais do país. A conversa aqui deixa de ser de alcance e passa a ser de
             sustentação: manter a vaga com a matrícula caindo exige decisão sobre rede física, não sobre
             expansão.</p>
        <table><tbody>
          <tr><td>Crianças de 0 a 3 ainda sem vaga</td><td class="num"><b>${n0(r.demandaCrecheNaoAtendida)}</b></td></tr>
          <tr><td>Distância até a meta</td><td class="num"><b>alcançada</b></td></tr>
        </tbody></table>`
          : `<table><tbody>
          <tr class="destaque"><td><b>Matrículas para alcançar a meta</b></td><td class="num"><b>${n0(creche.matriculasAteMeta)}</b></td></tr>
          <tr><td>Fator da creche integral pública urbana</td><td class="num">${creche.fatorIntegral === null ? "—" : dec2.format(creche.fatorIntegral)}</td></tr>
          <tr><td>Matrículas-equivalentes que isso gera</td><td class="num"><b>${creche.equivalentes === null ? "—" : inteiro.format(Math.round(creche.equivalentes))}</b></td></tr>
          <tr><td>Valor da matrícula-equivalente em ${esc(d.uf)}</td><td class="num">${brlCompact(creche.valorPorEquivalente)}</td></tr>
          <tr class="destaque"><td><b>Ordem de grandeza anual</b></td><td class="num"><b>${derivado(creche.valorDerivado)}</b></td></tr>
        </tbody></table>
        <p class="micro" style="margin-top:.07in"><b>Este número não é meta de arrecadação.</b> Ele mede o
        que a meta do PNE representa em receita de fundo se a vaga for de tempo integral. Alcançá-la exige
        obra, professor e alvará — e leva de dois a quatro anos, que é exatamente o intervalo em que as
        coortes da folha anterior chegam.</p>`
      }
    </div>
  </div>

  <p class="nota-d">${NOTA_DERIVADO}</p>
</section>`
    : ""
}

${
  bf
    ? `<section class="flow">
  <h2 class="secao">Busca ativa — a lista já existe</h2>
  <p class="secao-sub">A condicionalidade de educação do Bolsa Família acompanha frequência
  <b>criança a criança</b>, bimestralmente, pelo SICON. O agregado abaixo é público; a <b>lista nominal está
  no SICON, com o gestor municipal do programa</b>. Busca ativa neste município não precisa começar do zero
  — começa por essa lista. Competência ${esc(bf.competencia)}.</p>

  <div class="duas">
    <div class="card ${bf.naoLocalizados > 0 ? "alvo" : ""}">
      <h3>O acompanhamento</h3>
      <table><tbody>
        <tr><td>Público de educação no programa (4 a 17)</td><td class="num"><b>${n0(bf.publicoEducacao)}</b></td></tr>
        <tr><td>Acompanhados</td><td class="num">${n0(bf.acompanhados)} <span class="sub">(${pc(bf.percAcompanhados)})</span></td></tr>
        <tr class="destaque"><td><b>Não localizados pela rede</b></td><td class="num"><b>${n0(bf.naoLocalizados)}</b> <span class="sub">(${pc(bf.percNaoLocalizados)})</span></td></tr>
        <tr><td>Sem informação de frequência</td><td class="num">${n0(bf.semInformacaoFrequencia)}</td></tr>
        <tr><td>Dos acompanhados, com frequência acima do mínimo</td><td class="num">${pc(bf.percFrequenciaAcima)}</td></tr>
      </tbody></table>
      <p class="micro" style="margin-top:.07in">Frequência mínima da condicionalidade: 60% para 4 e 5 anos,
      75% dos 6 aos 17.</p>
    </div>
    <div class="card">
      <h3>Sanções já formalizadas</h3>
      <table><tbody>
        <tr><td>Advertências</td><td class="num">${n0(bf.sancoes.advertencias)}</td></tr>
        <tr><td>Bloqueios</td><td class="num">${n0(bf.sancoes.bloqueios)}</td></tr>
        <tr><td>Suspensões</td><td class="num">${n0(bf.sancoes.suspensoes)}</td></tr>
        <tr><td>Cancelamentos</td><td class="num">${n0(bf.sancoes.cancelamentos)}</td></tr>
        <tr><td>Famílias em fase de suspensão</td><td class="num">${n0(bf.sancoes.familiasEmFaseDeSuspensao)}</td></tr>
      </tbody></table>
      <p class="micro" style="margin-top:.07in"><b>A condicionalidade é proteção, não punição.</b> O
      descumprimento aciona a rede de assistência antes de virar sanção — a leitura correta destes números é
      alerta de busca ativa, nunca culpa da família. Cada criança recuperada vira matrícula no Censo, e o
      Censo define o FUNDEB do exercício seguinte.</p>
    </div>
  </div>

  <p class="fonte">Fonte: ${esc(bf.fonte)}.</p>
</section>`
    : ""
}

${
  dem?.maesAdolescentes || d.rural
    ? `<section class="flow junta">
  <h2 class="secao">Dois contextos que a demanda carrega</h2>
  <p class="secao-sub">Nenhum dos dois é indicador de desempenho da rede. Os dois mudam o desenho da oferta
  que a rede precisa ter — e por isso entram num dossiê de demanda, não num de resultado.</p>

  <div class="duas">
    ${
      dem?.maesAdolescentes
        ? `<div class="card">
      <h3>Maternidade adolescente</h3>
      <table><tbody>
        <tr><td>Nascimentos de mães de até 19 anos em ${dem.maesAdolescentes.ano}</td><td class="num"><b>${n0(dem.maesAdolescentes.nascimentos)}</b></td></tr>
        <tr class="destaque"><td><b>Do total de nascimentos do ano</b></td><td class="num"><b>${pc(dem.maesAdolescentes.percentualDoTotal)}</b></td></tr>
      </tbody></table>
      <p class="txt" style="margin-top:.07in">Cada mãe adolescente é <b>duas demandas na mesma rede</b>: a
      creche do filho e a vaga dela própria, que sem a primeira ela não ocupa. É um dos maiores preditores de
      evasão feminina no ensino médio e no EJA.</p>
      <p class="micro" style="margin-top:.06in"><b>Isto é contexto de rede, nunca rótulo individual.</b> A
      resposta de política é oferta noturna, contraturno e prioridade de vaga em creche — não cobrança de
      ninguém.</p>
    </div>`
        : ""
    }
    ${
      d.rural
        ? `<div class="card">
      <h3>Onde a demanda mora</h3>
      <table><tbody>
        <tr><td>População urbana</td><td class="num">${n0(d.rural.urbana)}</td></tr>
        <tr><td>População rural</td><td class="num"><b>${n0(d.rural.rural)}</b></td></tr>
        <tr class="destaque"><td><b>Participação rural</b></td><td class="num"><b>${pc(d.rural.pctRural)}</b></td></tr>
      </tbody></table>
      <p class="txt" style="margin-top:.07in">A localização muda três coisas ao mesmo tempo: o
      <b>fator do FUNDEB</b> — campo pondera 15% acima do urbano em toda etapa —, o custo de transporte
      escolar e o desenho da rede física. Demanda rural não se atende com vaga urbana.</p>
      <p class="micro" style="margin-top:.06in">Fonte: ${esc(d.rural.fonte)}, ${d.rural.ano}. A distribuição
      das escolas no território está no Dossiê das Escolas.</p>
    </div>`
        : ""
    }
  </div>

  <p class="fonte" style="margin-top:.2in">Emitido em ${esc(dataEmissao)} por ${esc(responsavel)} &middot;
  Global Company Consultorias. Documento confidencial, destinado exclusivamente ao município analisado.</p>
</section>`
    : ""
}

</body></html>`;
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
.card.alvo{border-color:#e2c084;background:#fdfaf3}
.card h3{font-size:10.5pt;color:var(--navy);margin-bottom:.07in}
.card .txt{font-size:8pt;line-height:1.45;color:#44545f}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.042in 0;border-bottom:1px solid #eef3f5;vertical-align:top}
table td.num{text-align:right;color:var(--navy);white-space:nowrap}
td.num.sub,th.num.sub,td.sub,span.sub{color:var(--muted);font-weight:400}
td.alerta{color:var(--red)}
td.bom{color:var(--good)}
tr.destaque td{background:rgba(39,166,154,.07)}
.micro{display:block;font-size:6.8pt;color:var(--muted);line-height:1.35;font-weight:400}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}
/* A margem não é estética: colado, "R$ 17,40 miᵈ" se lê como "R$ 17,40 mil" —
   erro de mil vezes no número mais importante da folha. */
sup.d{color:var(--gold);font-weight:800;font-size:.7em;margin-left:.03in}

/* ── os dois números que não se somam ────────────────────────────────────── */
.distincao{margin-top:.2in;border:1px solid var(--line);border-radius:8px;padding:.14in .16in;background:#fff}
.distincao h3{font-size:10.5pt;color:var(--navy);margin-bottom:.08in}
.distincao .par{display:grid;grid-template-columns:1fr 1fr;gap:.16in}
.distincao .par > div{border-left:.035in solid var(--teal);padding-left:.12in}
.distincao .par > div.grave{border-left-color:var(--red)}
.distincao em{display:block;font-style:normal;font-size:6.8pt;font-weight:800;letter-spacing:.09em;
  text-transform:uppercase;color:var(--muted)}
/* Só o número, não todo <b> do bloco: sem o filho direto, o negrito dentro do
   parágrafo herdava o corpo de 21pt e a frase virava manchete. */
.distincao .par > div > b{display:block;font-size:21pt;color:var(--navy);letter-spacing:-.03em;
  line-height:1.1;margin-top:.03in}
.distincao .par > div.grave > b{color:var(--red)}
.distincao p{font-size:7.5pt;line-height:1.42;color:#44545f;margin-top:.05in}
.distincao > .micro{margin-top:.1in;padding-top:.07in;border-top:1px solid var(--line)}

.ausencias{margin-top:.18in;border:1px solid #e2c084;background:#fdf9ee;border-radius:8px;padding:.12in .15in}
.ausencias h3{font-size:9pt;color:#8a5a0d;margin-bottom:.05in}
.ausencias ul{padding-left:.16in;font-size:7.4pt;line-height:1.42;color:#5d4a2c}
.faixa-nota{margin-top:.18in;border:1px solid var(--line);background:var(--wash);border-radius:8px;
  padding:.12in .15in}
.faixa-nota h3{font-size:9pt;color:var(--navy);margin-bottom:.04in}
.faixa-nota p{font-size:7.5pt;line-height:1.45;color:#44545f}

/* ── tabelas de fluxo ────────────────────────────────────────────────────── */
.grid{margin-top:.14in;font-size:8pt}
.grid thead{display:table-header-group}
.grid thead th{text-align:left;font-size:6.8pt;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  font-weight:800;padding:0 0 .05in;border-bottom:1.5px solid var(--navy);vertical-align:bottom}
.grid thead th.num{text-align:right}
.grid thead th .micro{text-transform:none;letter-spacing:0;font-size:6.2pt;margin-top:.01in}
.grid tbody tr{break-inside:avoid;page-break-inside:avoid}
.grid tbody td{padding:.05in 0;border-bottom:1px solid #eef3f5}
.grid tbody td.nome{padding-right:.14in}
.trilho{display:block;background:#e9f0f1;border-radius:2px;height:.075in;width:.7in}
.trilho i{display:block;height:100%;background:var(--teal);border-radius:2px}
.trilho.cheia i{background:#1d5d55}
.trilho.meta i{background:var(--gold)}
td.bar{width:.75in;padding-left:.07in;padding-right:.07in}
.rodape-tabela{margin-top:.12in;font-size:7.4pt;line-height:1.45;color:#44545f;background:var(--wash);
  border-left:.03in solid var(--teal);padding:.09in .12in;border-radius:0 6px 6px 0}
.nota-d{margin-top:.12in;font-size:6.9pt;line-height:1.45;color:var(--muted)}
h3.sub{margin-top:.26in;font-size:12pt;color:var(--navy);letter-spacing:-.015em;
  break-after:avoid;page-break-after:avoid}
.sub-nota{font-size:7.6pt;color:var(--muted);line-height:1.45;margin-top:.03in;max-width:6.2in;
  break-after:avoid;page-break-after:avoid}
.cobertura td.nome{width:1.5in}

/* ── régua da creche ─────────────────────────────────────────────────────── */
.regua{display:grid;grid-template-columns:.85in 1fr .42in;align-items:center;gap:.06in;margin-top:.07in;
  font-size:6.8pt;color:var(--muted)}
.regua .trilho{width:100%}
.regua .r-rot{white-space:nowrap}
.regua i{font-style:normal;text-align:right;color:var(--navy);font-weight:700;font-size:7.4pt}
`;
