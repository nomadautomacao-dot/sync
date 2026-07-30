import type { ConvenioDossie, DossieDinheiro, ObraDossie } from "./dossie-dinheiro";
import type { FatiaEmenda } from "./emendas-municipais";

/**
 * Dossiê do Dinheiro Federal — HTML de impressão.
 *
 * Mesma arquitetura de duas velocidades dos outros dossiês: `section.page` de
 * altura fixa para capa e folhas de argumento, `section.flow` para o que cresce
 * com o município — obras, convênios, autores de emenda.
 *
 * A regra editorial específica deste documento: **nada aqui é dinheiro do
 * município até que se diga de quem é**. Obra do painel do Pacto é listada por
 * território, e a esfera do termo é que define o dono. Convênio vigente é valor
 * pactuado, não recebido. Emenda empenhada é promessa registrada. Cada tabela
 * carrega essa distinção na própria coluna, porque é a primeira pergunta que um
 * secretário de finanças faz.
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

/** Data ISO → dd/mm/aaaa. Campo vazio da fonte sai como travessão. */
function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : "—";
}

export interface DossieDinheiroInput {
  municipio: string;
  uf: string;
  codigoIbge: string;
  dossie: DossieDinheiro;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

/** Situação da obra → como ela aparece na etiqueta e com que cor. */
const ROTULO_SITUACAO: Record<string, { texto: string; classe: string }> = {
  PARALISADA: { texto: "paralisada", classe: "ruim" },
  INACABADA: { texto: "inacabada", classe: "ruim" },
  "EM RETOMADA": { texto: "em retomada", classe: "atencao" },
  "EM LICITACAO": { texto: "em licitação", classe: "neutro" },
  CONCLUIDA: { texto: "concluída", classe: "bom" },
  "OBRA CANCELADA": { texto: "cancelada", classe: "neutro" },
};

function blocoObra(o: ObraDossie, ordem: number): string {
  const rotulo = ROTULO_SITUACAO[o.situacao] ?? { texto: o.situacao.toLowerCase(), classe: "neutro" };

  return `<article class="obra ${o.parada ? "parada" : ""}">
  <header>
    <div class="ident">
      <span class="ord">${ordem}</span>
      <div>
        <h3>${esc(o.tipo)}</h3>
        <p class="meta">termo de ${o.ano ?? "ano não informado"} &middot; ${esc(o.classificacao)}
        &middot; id ${esc(o.id)}</p>
      </div>
    </div>
    <div class="tags">
      <span class="tag t-${rotulo.classe}">${rotulo.texto}</span>
      <span class="tag ${o.doMunicipio ? "t-mun" : "t-outra"}">${
        o.doMunicipio ? "esfera municipal" : `esfera ${esc(o.esfera.toLowerCase())}`
      }</span>
    </div>
  </header>

  <div class="grade">
    <div class="col">
      <h4>Valores do painel</h4>
      <table><tbody>
        <tr><td>Estimativa de repasse do FNDE</td><td class="num"><b>${brlCompact(o.estimativaRepasse)}</b></td></tr>
        <tr><td>Aprovado no novo pacto</td><td class="num">${brlCompact(o.aprovacaoRepasse)}</td></tr>
        <tr><td>Já executado</td><td class="num">${brlCompact(o.execucao)}</td></tr>
        <tr><td>Saldo bancário na aprovação</td><td class="num">${brlCompact(o.saldoBancario)}</td></tr>
        ${
          o.aReceber !== null
            ? `<tr class="destaque"><td><b>Ainda a receber</b></td><td class="num"><b>${brlCompact(o.aReceber)}</b></td></tr>`
            : `<tr><td>Ainda a receber</td><td class="num sub">${
                o.doMunicipio ? "obra encerrada" : "não é do município"
              }</td></tr>`
        }
      </tbody></table>
    </div>
    <div class="col">
      <h4>Situação do processo</h4>
      <table><tbody>
        <tr><td>Solicitação</td><td class="num">${esc(o.situacaoSolicitacao || "—")}</td></tr>
        <tr><td>Termo</td><td class="num">${esc(o.situacaoTermo || "—")}</td></tr>
        <tr><td>Termo gerado</td><td class="num">${o.termoGerado ? esc(o.termoGerado) : "—"}</td></tr>
        <tr><td>Termo validado</td><td class="num">${o.termoValidado ? esc(o.termoValidado) : "—"}</td></tr>
      </tbody></table>
    </div>
  </div>

  ${o.trava ? `<p class="trava">${esc(o.trava)}</p>` : ""}
</article>`;
}

function linhaFatia(f: FatiaEmenda, maior: number, mostrarEducacao = true): string {
  const rel = maior > 0 ? (f.empenhado / maior) * 100 : 0;
  const chegada = f.empenhado > 0 ? (f.pago / f.empenhado) * 100 : null;
  return `<tr class="fatia">
    <td class="nome">${esc(f.nome)}</td>
    <td class="num">${n0(f.quantidade)}</td>
    <td class="num"><b>${brlCompact(f.empenhado)}</b></td>
    <td class="bar">${barra(rel)}</td>
    <td class="num">${brlCompact(f.pago)}</td>
    <td class="num ${chegada !== null && chegada < 50 ? "alerta" : ""}">${pc(chegada)}</td>
    ${mostrarEducacao ? `<td class="num ${f.empenhadoEducacao > 0 ? "edu" : "sub"}">${f.empenhadoEducacao > 0 ? brlCompact(f.empenhadoEducacao) : "—"}</td>` : ""}
  </tr>`;
}

function barra(pctValor: number, classe = ""): string {
  const largura = Math.max(0, Math.min(100, pctValor));
  return `<span class="trilho ${classe}"><i style="width:${largura.toFixed(2)}%"></i></span>`;
}

function linhaConvenio(c: ConvenioDossie): string {
  const urgente = c.vencendo;
  return `<tr class="conv ${urgente ? "urgente" : ""} ${c.educacao ? "edu" : ""}">
    <td class="nome">${esc(c.objeto || "Objeto não informado")}
      <span class="micro">${esc(c.orgao || "órgão não informado")}</span></td>
    <td class="num">${esc(c.situacao || "—")}</td>
    <td class="num">${data(c.fimVigencia)}${
      c.diasRestantes !== null
        ? `<span class="micro">${c.diasRestantes < 0 ? "vencido" : `${inteiro.format(c.diasRestantes)} dias`}</span>`
        : ""
    }</td>
    <td class="num"><b>${brlCompact(c.valor)}</b></td>
    <td class="num ${c.valorLiberado === 0 ? "alerta" : ""}">${brlCompact(c.valorLiberado)}</td>
    <td class="bar">${barra(c.execucao ?? 0)}</td>
    <td class="num">${pc(c.execucao)}</td>
  </tr>`;
}

export function generateDossieDinheiroHtml(input: DossieDinheiroInput): string {
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

  const e = d.emendas;
  const maiorAutor = e?.autores.reduce((m, a) => Math.max(m, a.empenhado), 0) ?? 0;
  const maiorFuncao = e?.funcoes.reduce((m, f) => Math.max(m, f.empenhado), 0) ?? 0;
  const educacaoFuncao = e?.funcoes.find((f) => /^educa/i.test(f.nome)) ?? null;
  const maiorFuncaoNome = e?.funcoes[0] ?? null;

  const anos = e?.anos ?? [];
  const maiorAnoEmpenho = anos.reduce((m, a) => Math.max(m, a.empenhado), 0);

  const blocosObras = d.obras.map((o, i) => blocoObra(o, i + 1)).join("\n");
  const linhasConvenios = d.conveniosLista.map(linhaConvenio).join("");

  const sancoes = d.sancoes;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dossiê do Dinheiro Federal — ${esc(municipio)}/${esc(uf)}</title>
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
    <span class="cover-tag">Dossiê temático &middot; recursos federais</span>
    <h1>O dinheiro federal<br><span class="thin">fora do FUNDEB</span></h1>
    <p class="cover-sub">O fundo é o fluxo contínuo. Este é o outro orçamento — obra do FNDE, emenda
    parlamentar, convênio e alimentação escolar. Ele é <b>descontínuo, disputado e perecível</b>, e não
    existe consolidado em lugar nenhum: cada pedaço mora num sistema diferente.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    <div class="cover-hero">
      <em>Rastreado neste dossiê, em recursos federais fora do fundo</em>
      <div class="val"><b>${brlCompact(r.totalRastreado)}</b><i>pactuado e a receber</i></div>
      <p>Soma do valor de ${n0(r.conveniosVigentes)} convênio(s) vigente(s), do repasse ainda a receber nas
      obras paradas do próprio município e da estimativa anual do PNAE. Emenda parlamentar fica fora deste
      total de propósito: boa parte dela vira convênio, e somar as duas contaria o mesmo real duas vezes.</p>
    </div>
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(dataEmissao)}</b>FNDE &middot; Portal da Transparência (CGU)</div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dossiê do Dinheiro Federal</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Sumário</div>
    <h2>Empenhado não é pago,<br>e obra no município não é obra do município</h2>
    <p class="lede">As duas confusões custam caro e aparecem em toda reunião. Emenda empenhada é promessa
    registrada no orçamento da União; o que entrou no caixa é a coluna do lado. E o painel do FNDE lista
    obras por <b>território</b> — a esfera do termo é que diz de quem é. Este dossiê carrega as duas
    distinções em toda tabela.</p>

    <div class="kpis">
      ${kpi(brlCompact(r.valorParadoMunicipal), "parado em obra do município")}
      ${kpi(brlCompact(r.emendasEmpenhado), "em emenda empenhada desde 2020")}
      ${kpi(pc(r.taxaDeChegada), "da emenda empenhada virou pagamento")}
      ${kpi(n0(r.conveniosVigentes), "convênios vigentes")}
    </div>

    <div class="duas">
      <div class="card">
        <h3>O inventário, em números</h3>
        <table><tbody>
          <tr><td>Obras no painel do Pacto</td><td class="num"><b>${n0(r.obras)}</b></td></tr>
          <tr><td>Delas, com termo de esfera municipal</td><td class="num">${n0(r.obrasDoMunicipio)}</td></tr>
          <tr><td>Paradas — paralisada, inacabada ou em retomada</td><td class="num ${r.obrasParadas > 0 ? "alerta" : ""}"><b>${n0(r.obrasParadas)}</b></td></tr>
          <tr><td>Repasse a receber nas paradas do município</td><td class="num"><b>${brlCompact(r.aReceberEmObrasParadas)}</b></td></tr>
          ${
            r.valorParadoOutrasEsferas > 0
              ? `<tr><td>Parado em obra de <b>outra esfera</b> no território</td><td class="num sub">${brlCompact(r.valorParadoOutrasEsferas)}</td></tr>`
              : ""
          }
          <tr><td>Convênios vigentes sem nenhuma liberação</td><td class="num ${r.conveniosSemLiberacao > 0 ? "alerta" : ""}">${n0(r.conveniosSemLiberacao)}</td></tr>
          <tr><td>Convênios que vencem em até 180 dias</td><td class="num ${r.conveniosVencendo > 0 ? "alerta" : ""}">${n0(r.conveniosVencendo)}</td></tr>
        </tbody></table>
      </div>
      <div class="card">
        <h3>A emenda que chega e a que não chega</h3>
        ${
          e
            ? `<table><tbody>
          <tr><td>Empenhado desde ${anos[0]?.ano ?? "—"}</td><td class="num"><b>${brlCompact(r.emendasEmpenhado)}</b></td></tr>
          <tr><td>Pago no mesmo período</td><td class="num"><b>${brlCompact(r.emendasPago)}</b></td></tr>
          <tr class="destaque"><td><b>Taxa de chegada</b></td><td class="num"><b>${pc(r.taxaDeChegada)}</b></td></tr>
          <tr><td>Empenhado em <b>educação</b></td><td class="num ${r.emendasEducacao > 0 ? "edu" : "sub"}">${r.emendasEducacao > 0 ? brlCompact(r.emendasEducacao) : "nenhum"}</td></tr>
          <tr><td>Participação da educação no total</td><td class="num">${pc(r.emendasEmpenhado > 0 ? (r.emendasEducacao / r.emendasEmpenhado) * 100 : null)}</td></tr>
          <tr><td>Parlamentares que já carimbaram emenda aqui</td><td class="num"><b>${n0(e.autores.length + (e.autoresDemais?.quantidade ?? 0))}</b></td></tr>
        </tbody></table>
        <p class="micro" style="margin-top:.07in">${
          maiorFuncaoNome && !/^educa/i.test(maiorFuncaoNome.nome)
            ? `A maior função de destino é <b>${esc(maiorFuncaoNome.nome.toLowerCase())}</b>, com ${brlCompact(maiorFuncaoNome.empenhado)}. ${
                educacaoFuncao
                  ? `Educação aparece com ${brlCompact(educacaoFuncao.empenhado)}.`
                  : "Educação não aparece em nenhuma emenda carimbada aqui desde 2020."
              }`
            : "A repartição por função está na folha das emendas."
        }</p>`
            : `<p class="txt">O Portal da Transparência não registra emenda com aplicação carimbada neste
               município desde 2020. A ausência é do carimbo territorial: emenda de aplicação estadual ou
               nacional que beneficie o município de forma difusa não entra nesta base — e este é, ele
               próprio, um achado de campo.</p>`
        }
      </div>
    </div>

    ${
      d.ausencias.length > 0
        ? `<div class="ausencias">
      <h3>O que não veio nesta emissão, e por quê</h3>
      <ul>${d.ausencias.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      <p class="micro">Ausência de resposta não é ausência de dado. A seção correspondente sai vazia em vez
      de sair estimada.</p>
    </div>`
        : `<div class="ausencias completo">
      <h3>Todas as fontes responderam nesta emissão</h3>
      <p class="micro">Painel do Pacto de Retomada, emendas parlamentares, convênios e cadastros de sanção —
      as quatro consultas retornaram. Nenhuma seção deste dossiê está vazia por falha de fonte.</p>
    </div>`
    }

    <p class="fonte">Fontes: ${d.fontes.map(esc).join("; ")}.</p>
  </div>
  <div class="page-footer"><span>FNDE &middot; Portal da Transparência (CGU)</span><span>2</span></div>
</section>

<section class="flow">
  <h2 class="secao">Obra a obra</h2>
  <p class="secao-sub">${
    d.obras.length > 0
      ? `As ${n0(d.obras.length)} obras que o painel do Pacto de Retomada lista no território de
         ${esc(municipio)}, da maior estimativa de repasse à menor. Cada uma com a esfera do termo — porque
         obra no município não é obra do município — e, nas paradas, o que exatamente trava a retomada e de
         quem é a próxima ação.`
      : `O painel do Pacto de Retomada não lista obra no território de ${esc(municipio)}. Isso significa
         ausência no painel, não ausência de obra: o painel cobre os termos e convênios de infraestrutura
         escolar do FNDE que entraram no processo de repactuação, e não a totalidade das obras da rede.`
  }</p>
  ${blocosObras}
  ${
    d.obras.length > 0
      ? `<p class="rodape-tabela"><b>Como ler a coluna do termo.</b> Termo não gerado é fila do FNDE, e o que
         cabe ao município é cobrar a emissão. Termo gerado e não validado é assinatura do ente — é o passo
         mais rápido de destravar. Solicitação indeferida põe a obra fora do novo pacto, e reentrar exige
         novo pleito. Dizer que uma obra está parada sem dizer de quem é a próxima ação transforma
         diagnóstico em lamento.<br><b>E por que "ainda a receber" some em algumas linhas.</b> A subtração só
         é imprimida onde ela significa alguma coisa: obra concluída ou cancelada não tem repasse futuro a
         esperar, e obra de outra esfera no território não é dinheiro deste município. Nas duas o campo sai
         com a razão escrita, nunca com um número que sugira caixa a entrar.</p>`
      : ""
  }
</section>

${
  e
    ? `<section class="flow">
  <h2 class="secao">Emenda parlamentar, ano a ano</h2>
  <p class="secao-sub">Toda emenda com aplicação carimbada neste município desde ${anos[0]?.ano ?? ""}. A
  coluna que ninguém olha é a distância entre <b>empenhado</b> e <b>pago</b>: empenho é promessa registrada,
  pagamento é dinheiro que entrou. Neste município a taxa de chegada do período é de
  <b>${pc(r.taxaDeChegada)}</b>.</p>

  <table class="grid">
    <thead><tr>
      <th>Ano</th><th class="num">Emendas</th><th class="num">Empenhado</th><th></th>
      <th class="num">Pago</th><th class="num">Chegada</th><th class="num">Educação</th>
    </tr></thead>
    <tbody>
      ${anos
        .map(
          (a) => `<tr>
        <td class="nome"><b>${a.ano}</b></td>
        <td class="num">${n0(a.quantidade)}</td>
        <td class="num"><b>${brlCompact(a.empenhado)}</b></td>
        <td class="bar">${barra(maiorAnoEmpenho > 0 ? (a.empenhado / maiorAnoEmpenho) * 100 : 0)}</td>
        <td class="num">${brlCompact(a.pago)}</td>
        <td class="num ${a.empenhado > 0 && a.pago / a.empenhado < 0.5 ? "alerta" : ""}">${pc(a.empenhado > 0 ? (a.pago / a.empenhado) * 100 : null)}</td>
        <td class="num ${a.empenhadoEducacao > 0 ? "edu" : "sub"}">${a.empenhadoEducacao > 0 ? brlCompact(a.empenhadoEducacao) : "—"}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
    <tfoot><tr>
      <td><b>Período</b></td>
      <td class="num"><b>${n0(anos.reduce((t, a) => t + a.quantidade, 0))}</b></td>
      <td class="num"><b>${brlCompact(r.emendasEmpenhado)}</b></td><td></td>
      <td class="num"><b>${brlCompact(r.emendasPago)}</b></td>
      <td class="num"><b>${pc(r.taxaDeChegada)}</b></td>
      <td class="num edu">${r.emendasEducacao > 0 ? brlCompact(r.emendasEducacao) : "—"}</td>
    </tr></tfoot>
  </table>

  <p class="rodape-tabela"><b>Emenda de um ano não se paga naquele ano.</b> Empenho vira restos a pagar e
  atravessa exercícios, então a taxa de chegada dos anos recentes é naturalmente menor que a dos antigos —
  o que se lê aqui é a tendência do conjunto, não o desempenho de cada linha. Ano antigo com chegada baixa
  é que é sinal: ali o recurso provavelmente foi cancelado.</p>

  <h3 class="sub">Onde o dinheiro de emenda cai</h3>
  <p class="sub-nota">A função orçamentária de destino. É a folha que responde, com número, se a educação
  disputa emenda neste município ou se ela nunca esteve na mesa.</p>
  <table class="grid">
    <thead><tr>
      <th>Função</th><th class="num">Emendas</th><th class="num">Empenhado</th><th></th>
      <th class="num">Pago</th><th class="num">Chegada</th><th class="num">Educação</th>
    </tr></thead>
    <tbody>${e.funcoes.map((f) => linhaFatia(f, maiorFuncao)).join("")}</tbody>
  </table>

  ${
    e.subfuncoesEducacao.length > 0
      ? `<h3 class="sub">Dentro da educação, para onde foi</h3>
  <p class="sub-nota">A subfunção diz se a emenda de educação chegou na rede que o município administra.
  Ensino superior e ensino profissional são função 12 e <b>não</b> são rede municipal.</p>
  <table class="grid">
    <thead><tr><th>Subfunção</th><th class="num">Emendas</th><th class="num">Empenhado</th><th></th><th class="num">Pago</th><th class="num">Chegada</th></tr></thead>
    <tbody>${e.subfuncoesEducacao
      .map((f) => linhaFatia(f, e.subfuncoesEducacao[0]?.empenhado ?? 0, false))
      .join("")}</tbody>
  </table>`
      : ""
  }

  <h3 class="sub">Por tipo de emenda</h3>
  <p class="sub-nota">Individual, de bancada e de relator se negociam de formas diferentes e com
  interlocutores diferentes — a de bancada passa pela articulação estadual, a individual é conversa direta.</p>
  <table class="grid">
    <thead><tr><th>Tipo</th><th class="num">Emendas</th><th class="num">Empenhado</th><th></th><th class="num">Pago</th><th class="num">Chegada</th><th class="num">Educação</th></tr></thead>
    <tbody>${e.tipos.map((f) => linhaFatia(f, e.tipos[0]?.empenhado ?? 0)).join("")}</tbody>
  </table>
</section>

<section class="flow">
  <h2 class="secao">Quem já mandou dinheiro para cá</h2>
  <p class="secao-sub">Os ${n0(e.autores.length + (e.autoresDemais?.quantidade ?? 0))} parlamentares com
  emenda carimbada em ${esc(municipio)} desde ${anos[0]?.ano ?? ""}, de qualquer função. É a lista de quem
  já provou ter interesse no município — e a coluna da direita mostra quanto disso foi para educação, que na
  maioria dos casos é a conversa que ainda não aconteceu.</p>

  <table class="grid">
    <thead><tr>
      <th>Autor</th><th class="num">Emendas</th><th class="num">Empenhado</th><th></th>
      <th class="num">Pago</th><th class="num">Chegada</th><th class="num">Para educação</th>
    </tr></thead>
    <tbody>${e.autores.map((a) => linhaFatia(a, maiorAutor)).join("")}</tbody>
    ${
      e.autoresDemais
        ? `<tfoot><tr>
      <td>Demais ${n0(e.autoresDemais.quantidade)} autores, somados</td><td class="num">—</td>
      <td class="num">${brlCompact(e.autoresDemais.empenhado)}</td><td></td>
      <td class="num">—</td><td class="num">—</td>
      <td class="num">${e.autoresDemais.empenhadoEducacao > 0 ? brlCompact(e.autoresDemais.empenhadoEducacao) : "—"}</td>
    </tr></tfoot>`
        : ""
    }
  </table>

  <p class="rodape-tabela">${
    e.autoresDemais
      ? `<b>Truncamento declarado.</b> A base guarda os 25 maiores autores por valor empenhado; os outros
         ${n0(e.autoresDemais.quantidade)} entram somados na última linha, com valor, para que nenhum real
         suma da conta.`
      : "<b>Nenhum truncamento.</b> Todos os autores com emenda carimbada aqui estão na tabela."
  } Emenda de aplicação estadual ou nacional que beneficie o município de forma difusa não aparece: o Portal
  só vincula ao código IBGE o gasto carimbado no território.<br>Fonte: ${esc(e.fonte)} Dados de ${esc(e.geradoEm)}.</p>
</section>`
    : ""
}

${
  d.convenios
    ? `<section class="flow">
  <h2 class="secao">Convênio a convênio</h2>
  <p class="secao-sub">Os ${n0(d.conveniosLista.length)} instrumentos vigentes do município com a União, do
  maior valor ao menor. <b>Valor é o pactuado, não o recebido</b> — a coluna de liberado é a que diz o que
  saiu do caixa federal. ${
    r.conveniosSemLiberacao > 0
      ? `${n0(r.conveniosSemLiberacao)} deles não tiveram nenhuma liberação até hoje.`
      : "Todos tiveram alguma liberação."
  }${
    r.conveniosVencendo > 0
      ? ` ${n0(r.conveniosVencendo)} vencem em até 180 dias e aparecem destacados.`
      : ""
  }</p>

  <table class="grid convenios">
    <thead><tr>
      <th>Objeto e órgão</th><th class="num">Situação</th><th class="num">Fim da vigência</th>
      <th class="num">Valor pactuado</th><th class="num">Liberado</th><th></th><th class="num">%</th>
    </tr></thead>
    <tbody>${linhasConvenios}</tbody>
    <tfoot><tr>
      <td><b>Total vigente</b></td><td class="num">—</td><td class="num">—</td>
      <td class="num"><b>${brlCompact(d.convenios.valorVigentes)}</b></td>
      <td class="num"><b>${brlCompact(d.convenios.liberadoVigentes)}</b></td><td></td>
      <td class="num"><b>${pc(d.convenios.valorVigentes > 0 ? (d.convenios.liberadoVigentes / d.convenios.valorVigentes) * 100 : null)}</b></td>
    </tr></tfoot>
  </table>

  <p class="rodape-tabela"><b>A carteira inteira, e o que ficou fora dela.</b> A consulta trouxe
  ${n0(d.convenios.total)} instrumentos deste município; ${n0(d.convenios.encerrados)} já estão encerrados
  por conclusão, cancelamento ou fim de vigência e não entram na tabela. ${
    d.convenios.truncado
      ? "<b>A paginação da API bateu no teto:</b> há instrumentos além dos consultados, e o número acima é piso, não total."
      : "A paginação não bateu no teto, então a carteira está completa."
  } ${
    d.convenios.educacaoVigentes > 0
      ? `Destes vigentes, ${n0(d.convenios.educacaoVigentes)} são da função educação, somando ${brlCompact(d.convenios.valorEducacaoVigentes)} — marcados na tabela.`
      : "Nenhum dos vigentes está classificado na função educação. A classificação é a funcional oficial (função 12); o texto do objeto não entra, porque adivinhar tema por palavra viraria afirmação sem fonte."
  }</p>
</section>`
    : ""
}

${
  sancoes
    ? `<section class="flow junta">
  <h2 class="secao">Sanções — duas listas que não se confundem</h2>
  <p class="secao-sub">Sanção <b>aplicada ao ente</b> e sanção <b>aplicada pelo ente</b> a fornecedores
  dizem coisas opostas, e são confundidas o tempo todo. A primeira trava convênio; a segunda é sinal de
  controle interno funcionando.</p>

  <div class="duas">
    <div class="card ${sancoes.enteSancionado.length > 0 ? "ruim" : ""}">
      <h3>Aplicadas ao município</h3>
      ${
        sancoes.enteSancionado.length > 0
          ? `<table><tbody>${sancoes.enteSancionado
              .map(
                (s) =>
                  `<tr><td>${esc(s.sancionado)}<span class="micro">${esc(s.cadastro)} &middot; ${esc(s.orgaoSancionador)} &middot; ${esc(s.tipo)}</span></td><td class="num">${data(s.fimSancao)}</td></tr>`,
              )
              .join("")}</tbody></table>
        <p class="micro" style="margin-top:.06in">Sanção vigente contra o ente é impedimento direto de
        celebrar convênio e de receber transferência voluntária.</p>`
          : `<p class="txt">Nenhuma sanção vigente em que o próprio município apareça como sancionado, nos
             cadastros CEIS e CNEP consultados nesta emissão.</p>`
      }
    </div>
    <div class="card">
      <h3>Aplicadas pelo município</h3>
      <table><tbody>
        <tr><td>Fornecedores sancionados por órgãos do município</td><td class="num"><b>${n0(sancoes.aplicadasPeloEnte)}</b></td></tr>
      </tbody></table>
      ${
        sancoes.listaAplicadas.length > 0
          ? `<table style="margin-top:.06in"><tbody>${sancoes.listaAplicadas
              .slice(0, 6)
              .map(
                (s) =>
                  `<tr><td>${esc(s.sancionado)}<span class="micro">${esc(s.cadastro)} &middot; ${esc(s.tipo)}</span></td><td class="num">${data(s.fimSancao)}</td></tr>`,
              )
              .join("")}</tbody></table>
        ${sancoes.listaAplicadas.length > 6 ? `<p class="micro" style="margin-top:.05in">Mostrados 6 de ${n0(sancoes.listaAplicadas.length)}.</p>` : ""}`
          : `<p class="txt">Nenhum registro de sanção aplicada por órgão deste município. Isso pode
             significar controle sem ocorrências ou ausência de registro nos cadastros federais — a consulta
             não distingue as duas coisas.</p>`
      }
    </div>
  </div>

  <p class="rodape-tabela">A consulta busca por nome e não tem filtro territorial: o que ela responde é se o
  <b>ente</b> está sancionado e se a prefeitura <b>registra</b> sanções contra fornecedores. A lista completa
  de fornecedores da educação sancionados exigiria o rol de contratados do ente, que não é público nesta
  API.${sancoes.truncado ? " <b>A paginação bateu no teto nesta consulta</b> — há registros além dos lidos." : ""}</p>
</section>`
    : ""
}

<section class="flow junta">
  <h2 class="secao">As transferências automáticas, e o que condiciona cada uma</h2>
  <p class="secao-sub">Ao contrário de obra e convênio, estas não se disputam: chegam por fórmula. Mas todas
  têm condicionante, e é sempre a mesma família — adesão feita, conselho constituído e prestação de contas
  em dia. Perder uma delas por documento é a perda mais barata de evitar e a mais cara de descobrir tarde.</p>

  <table class="grid">
    <thead><tr><th>Programa</th><th>Como é calculado</th><th>O que condiciona o repasse</th><th class="num">Neste município</th></tr></thead>
    <tbody>
      <tr>
        <td class="nome"><b>PNAE</b><span class="micro">Alimentação escolar</span></td>
        <td class="txt">VT = A × D × C — matrículas do Censo do ano anterior × 200 dias × per capita da faixa
        (art. 47 da Resolução CD/FNDE nº 4/2026).</td>
        <td class="txt">CAE constituído e em exercício; prestação de contas no SIGPC; no mínimo 30% em
        agricultura familiar.</td>
        <td class="num">${
          d.pnae
            ? `<b>${brlCompact(d.pnae.valorAnual)}</b><span class="micro">estimativa anual sobre ${n0(d.pnae.matriculasConsideradas)} matrículas</span>`
            : "—"
        }</td>
      </tr>
      <tr>
        <td class="nome"><b>PDDE</b><span class="micro">Dinheiro direto na escola</span></td>
        <td class="txt">Por escola, pelo número de alunos do Censo, com adesão da unidade executora.</td>
        <td class="txt">Adesão no PDDE Interativo; unidade executora com CNPJ ativo; prestação de contas do
        exercício anterior aprovada.</td>
        <td class="num sub">consulta por escola</td>
      </tr>
      <tr>
        <td class="nome"><b>PNATE</b><span class="micro">Transporte escolar</span></td>
        <td class="txt">Alunos da rede que usam transporte escolar rural, declarados no Censo.</td>
        <td class="txt">Declaração correta do transporte no Censo Escolar — o campo é por aluno, e quem não
        declara não recebe.</td>
        <td class="num sub">segue o Censo</td>
      </tr>
      <tr>
        <td class="nome"><b>Salário-educação</b><span class="micro">Quota estadual e municipal</span></td>
        <td class="txt">Rateio da contribuição social pela matrícula da educação básica pública do Censo.</td>
        <td class="txt">Matrícula declarada no Censo. É automático e não exige adesão — mas cai junto com
        qualquer subdeclaração.</td>
        <td class="num sub">segue o Censo</td>
      </tr>
    </tbody>
  </table>

  <p class="rodape-tabela"><b>As quatro dependem do mesmo Censo.</b> É a razão de o Dossiê da Matrícula
  Ponderada e este se lerem juntos: um erro de declaração não custa só o fator do FUNDEB — ele encolhe a
  merenda, o transporte e o salário-educação no mesmo movimento, e o efeito só aparece no exercício
  seguinte, quando a correção já não é possível.</p>

  <h3 class="sub">O que a consulta pública não alcança</h3>
  <p class="sub-nota">Esta lista é também o que a consultoria precisa receber do município para fechar o
  inventário. Nenhum destes é público: todos exigem credencial do ente.</p>
  <table class="grid">
    <thead><tr><th>Sistema</th><th>O que só se vê com credencial</th></tr></thead>
    <tbody>
      <tr><td class="nome"><b>SIMEC</b></td><td class="txt">Cronograma físico-financeiro de cada obra, medições, pendências de vistoria e histórico de restituição. A consulta pública dá a existência da obra e a estimativa, não o andamento.</td></tr>
      <tr><td class="nome"><b>SIGPC</b></td><td class="txt">Situação de cada prestação de contas — a que está em análise, a que voltou com diligência e a que foi rejeitada. Prestação rejeitada bloqueia repasse novo do mesmo programa.</td></tr>
      <tr><td class="nome"><b>PDDE Interativo</b></td><td class="txt">Adesão e situação por unidade executora, escola a escola. Escola sem UEx ativa não recebe, e a rede costuma descobrir no fim do exercício.</td></tr>
      <tr><td class="nome"><b>Transferegov</b></td><td class="txt">Anexos, pareceres e diligências de cada convênio. O Portal dá valor, vigência e liberação; o que trava a liberação está no processo.</td></tr>
      <tr><td class="nome"><b>SIGARPWEB</b></td><td class="txt">Situação das adesões a ata de registro de preços (ônibus escolar, mobiliário, equipamento) e o saldo disponível de cada pregão.</td></tr>
    </tbody>
  </table>

  <p class="fonte" style="margin-top:.2in">Emitido em ${esc(dataEmissao)} por ${esc(responsavel)} &middot;
  Global Company Consultorias. Documento confidencial, destinado exclusivamente ao município analisado.
  Fontes: ${d.fontes.map(esc).join("; ")}.</p>
</section>

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
  letter-spacing:.13em;text-transform:uppercase;max-width:4.6in;line-height:1.4}
.cover-hero .val{display:flex;align-items:baseline;gap:.14in;margin-top:.08in}
.cover-hero .val b{color:var(--teal);font-size:40pt;font-weight:700;letter-spacing:-.035em;line-height:.92}
.cover-hero .val i{font-style:normal;background:var(--teal);color:#fff;font-size:9pt;font-weight:800;
  border-radius:999px;padding:.045in .13in;white-space:nowrap}
.cover-hero p{margin-top:.1in;color:#44545f;font-size:8.3pt;line-height:1.42;max-width:5.1in}
.cover-bot{padding:0 .7in .5in;display:flex;justify-content:space-between;align-items:end;position:relative;
  z-index:1;color:var(--muted);font-size:7.6pt;line-height:1.4}
.cover-bot b{display:block;color:var(--navy);font-size:8.4pt}

/* ── folhas de argumento ─────────────────────────────────────────────────── */
.kicker{color:var(--teal);font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
h2{font-size:20pt;color:var(--navy);letter-spacing:-.025em;line-height:1.12;margin-top:.05in}
.lede{margin-top:.13in;color:#44545f;font-size:9.2pt;line-height:1.5;max-width:6.4in;
  padding-bottom:.13in;border-bottom:2px solid var(--teal)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:.14in;margin-top:.18in}
.kpi{border-left:.03in solid var(--teal);padding-left:.11in}
.kpi b{display:block;color:var(--navy);font-size:15pt;letter-spacing:-.02em;line-height:1.05}
.kpi span{display:block;color:var(--muted);font-size:6.6pt;font-weight:800;letter-spacing:.06em;
  text-transform:uppercase;margin-top:.05in;line-height:1.3}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.2in}
.card{border:1px solid var(--line);border-radius:8px;padding:.14in .16in;background:#fff}
.card.ruim{border-color:#e6bab8;background:#fdf6f5}
.card h3{font-size:10.5pt;color:var(--navy);margin-bottom:.07in}
.card .txt{font-size:8pt;line-height:1.45;color:#44545f}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.042in 0;border-bottom:1px solid #eef3f5;vertical-align:top}
table td.num{text-align:right;color:var(--navy);white-space:nowrap}
td.num.sub,th.num.sub{color:var(--muted);font-weight:400}
td.alerta{color:var(--red)}
td.edu{color:var(--teal);font-weight:700}
tr.destaque td{background:rgba(39,166,154,.07)}
.micro{display:block;font-size:6.8pt;color:var(--muted);line-height:1.35;font-weight:400}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}

.ausencias{margin-top:.2in;border:1px solid #e2c084;background:#fdf9ee;border-radius:8px;padding:.13in .16in}
.ausencias.completo{border-color:#bfe0d6;background:#f3faf7}
.ausencias h3{font-size:9pt;color:#8a5a0d;margin-bottom:.05in}
.ausencias.completo h3{color:#1d7d72}
.ausencias ul{padding-left:.16in;font-size:7.6pt;line-height:1.45;color:#5d4a2c}
.ausencias li{margin-bottom:.04in}
.ausencias .micro{margin-top:.05in}

/* ── tabelas de fluxo ────────────────────────────────────────────────────── */
.grid{margin-top:.14in;font-size:8pt}
.grid thead{display:table-header-group}
.grid thead th{text-align:left;font-size:6.8pt;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  font-weight:800;padding:0 0 .05in;border-bottom:1.5px solid var(--navy);vertical-align:bottom}
.grid thead th.num{text-align:right}
.grid tbody tr{break-inside:avoid;page-break-inside:avoid}
.grid tbody td{padding:.05in 0;border-bottom:1px solid #eef3f5}
.grid tbody td.nome{padding-right:.14in}
.grid tbody td.txt{font-size:7.4pt;line-height:1.42;color:#44545f;padding-right:.14in}
.grid tfoot td{padding:.06in 0 0;border-top:1.5px solid var(--navy);font-weight:700;color:var(--navy)}
.grid tfoot td.num{text-align:right}
.trilho{display:block;background:#e9f0f1;border-radius:2px;height:.075in;width:.8in}
.trilho i{display:block;height:100%;background:var(--teal);border-radius:2px}
td.bar{width:.85in;padding-left:.08in}
.rodape-tabela{margin-top:.12in;font-size:7.4pt;line-height:1.45;color:#44545f;background:var(--wash);
  border-left:.03in solid var(--teal);padding:.09in .12in;border-radius:0 6px 6px 0}
h3.sub{margin-top:.26in;font-size:12pt;color:var(--navy);letter-spacing:-.015em;
  break-after:avoid;page-break-after:avoid}
.sub-nota{font-size:7.6pt;color:var(--muted);line-height:1.45;margin-top:.03in;max-width:6.2in;
  break-after:avoid;page-break-after:avoid}

/* ── bloco por obra ──────────────────────────────────────────────────────── */
.obra{border:1px solid var(--line);border-radius:8px;padding:.13in .15in;margin-bottom:.13in;
  break-inside:avoid;page-break-inside:avoid;background:#fff}
.obra.parada{border-left:.045in solid var(--gold);background:#fefbf5}
.obra header{display:flex;justify-content:space-between;align-items:flex-start;gap:.15in;
  padding-bottom:.08in;border-bottom:1px solid var(--line)}
.obra .ident{display:flex;gap:.1in;align-items:baseline}
.obra .ord{color:var(--muted);font-size:8pt;font-weight:800;min-width:.24in}
.obra h3{font-size:11pt;color:var(--navy);letter-spacing:-.015em;line-height:1.15}
.obra .meta{font-size:7pt;color:var(--muted);margin-top:.02in}
.tags{display:flex;flex-wrap:wrap;gap:.04in;justify-content:flex-end}
.tag{font-size:6.2pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;
  padding:.025in .08in;white-space:nowrap;background:#eef3f5;color:var(--muted)}
.t-ruim{background:#fbeceb;color:var(--red)}
.t-atencao{background:#fdf4e3;color:var(--gold)}
.t-bom{background:#eef6f5;color:var(--good)}
.t-mun{background:#eef3fb;color:var(--violet)}
.t-outra{background:#f4eef8;color:#7a5aa0}
.obra .grade{display:grid;grid-template-columns:1fr 1fr;gap:.18in;margin-top:.09in}
.obra h4{font-size:6.9pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);
  margin-bottom:.03in}
.obra table{font-size:7.7pt}
.obra table td{padding:.03in 0}
.trava{margin-top:.09in;padding:.08in .11in;background:var(--wash);border-radius:6px;font-size:7.7pt;
  line-height:1.42;color:#33454f}
.obra.parada .trava{background:#fbf4e6}

/* ── convênios ───────────────────────────────────────────────────────────── */
.convenios td.nome{font-size:7.6pt;max-width:2.4in}
.convenios tbody tr.urgente td{background:#fdf4e3}
.convenios tbody tr.edu td.nome{border-left:.025in solid var(--teal);padding-left:.06in}
`;
