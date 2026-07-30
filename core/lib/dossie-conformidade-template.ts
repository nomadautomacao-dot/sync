import type { DossieConformidade, ItemAgenda } from "./dossie-conformidade";
import type { RequisitoCauc } from "./cauc-requisitos";
import type { IndicadorSiope } from "./siope-indicadores";
import { DESCRICAO_CONDICIONALIDADE, type Condicionalidade } from "./fundeb-vaar";

/**
 * Dossiê da Conformidade — HTML de impressão.
 *
 * Mesma arquitetura de dois regimes do Dossiê das Escolas: `section.page` de
 * altura fixa na capa e no sumário, `section.flow` nas listas que crescem com
 * o município. Ver o doc-comment de `dossie-escolas-template.ts`.
 */

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const n0 = (v: number | null | undefined) => (v == null ? "—" : inteiro.format(v));
const pc = (v: number | null | undefined, casas = 2) =>
  v == null ? "—" : `${(casas === 2 ? dec2 : dec).format(v)}%`;

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR").format(d);
}

export interface DossieConformidadeInput {
  municipio: string;
  uf: string;
  dossie: DossieConformidade;
  geradoEm?: Date;
  logoDataUri?: string | null;
  responsavel?: string;
}

/** O que cada situação do extrato significa — e o que ela trava. */
const SITUACAO: Record<RequisitoCauc["situacao"], { rotulo: string; classe: string }> = {
  comprovado: { rotulo: "comprovado", classe: "ok" },
  pendente: { rotulo: "pendente", classe: "bad" },
  desabilitado: { rotulo: "desabilitado", classe: "neutro" },
};

function linhaAgenda(a: ItemAgenda): string {
  const prazo = a.semPrazoFuturo
    ? '<span class="micro">sem prazo futuro informado</span>'
    : a.diasRestantes < 0
      ? `<b class="vermelho">vencido há ${inteiro.format(Math.abs(a.diasRestantes))} dia(s)</b>`
      : a.urgente
        ? `<b class="ambar">em ${inteiro.format(a.diasRestantes)} dia(s)</b>`
        : `${inteiro.format(a.diasRestantes)} dias`;
  return `<tr class="${a.urgente ? "urg" : ""}">
    <td class="cod">${esc(a.codigo)}${a.educacao ? ' <span class="pill">educação</span>' : ""}</td>
    <td>${esc(a.rotulo)}</td>
    <td class="num">${dataBR(a.validadeAte)}</td>
    <td class="num">${prazo}</td>
  </tr>`;
}

function linhaRequisito(r: RequisitoCauc, educacao: boolean): string {
  const s = SITUACAO[r.situacao];
  return `<tr>
    <td class="cod">${esc(r.codigo)}${educacao ? ' <span class="pill">educação</span>' : ""}</td>
    <td>${esc(r.rotulo)}</td>
    <td class="num"><span class="sit ${s.classe}">${s.rotulo}</span></td>
    <td class="num">${r.validadeAte ? dataBR(r.validadeAte) : "—"}</td>
  </tr>`;
}

function linhaSiope(i: IndicadorSiope): string {
  const temParam = i.limite != null && i.conforme != null;
  const estado = !temParam
    ? '<span class="sit neutro">informativo</span>'
    : i.conforme
      ? '<span class="sit ok">cumprido</span>'
      : '<span class="sit bad">descumprido</span>';
  const parametro =
    i.limite == null
      ? "—"
      : `${i.sentido === "min" ? "mín." : "máx."} ${i.unidade === "percentual" ? pc(i.limite) : moeda.format(i.limite)}`;
  const valor =
    i.valor == null ? "—" : i.unidade === "percentual" ? pc(i.valor) : moeda.format(i.valor);
  const folga =
    i.folga == null || !temParam
      ? "—"
      : `<b class="${i.folga >= 0 ? "verde" : "vermelho"}">${i.folga >= 0 ? "+" : "−"}${pc(Math.abs(i.folga))}</b>`;
  return `<tr>
    <td class="cod">${esc(i.cod)}</td>
    <td>${esc(i.rotulo)}</td>
    <td class="num">${valor}</td>
    <td class="num">${parametro}</td>
    <td class="num">${folga}</td>
    <td class="num">${estado}</td>
  </tr>`;
}

export function generateDossieConformidadeHtml(input: DossieConformidadeInput): string {
  const { dossie: d, municipio, uf } = input;
  const geradoEm = input.geradoEm ?? new Date();
  const responsavel = input.responsavel ?? "Adriel Tavares";
  const r = d.resumo;
  const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(geradoEm);

  const marca = input.logoDataUri
    ? `<img src="${input.logoDataUri}" alt="" style="width:.42in;height:.42in;border-radius:8px">`
    : "";

  const educacaoCods = new Set(d.agenda.filter((a) => a.educacao).map((a) => a.codigo));
  d.cauc?.pendenciasEducacao.forEach((p) => educacaoCods.add(p.codigo));

  const proximo = d.agenda.find((a) => !a.semPrazoFuturo && a.diasRestantes >= 0) ?? null;

  const secaoAgenda = d.cauc
    ? `<section class="flow">
  <h2 class="secao">A agenda que protege a carteira de convênios</h2>
  <p class="secao-sub">Todo requisito comprovado tem prazo, e requisito comprovado <b>vira pendência sozinho</b>
  quando o prazo passa. Esta é a lista ordenada por data — a rotina é olhar antes do vencimento, não depois
  da recusa. Consulta de ${dataBR(d.cauc.dataPesquisa)}.</p>
  <table class="lista"><thead><tr><th>Código</th><th>Requisito</th><th class="num">Válido até</th><th class="num">Prazo</th></tr></thead>
  <tbody>${d.agenda.map(linhaAgenda).join("")}</tbody></table>
  <p class="nota"><b>Sem prazo futuro informado</b> significa que o extrato repetiu a data da consulta no lugar
  de um vencimento: o item está comprovado e válido hoje, e não que ele vença hoje. São ${n0(r.semPrazoFuturo)}
  dos ${n0(d.agenda.length)} comprovados com data.</p>
</section>`
    : "";

  const secaoRequisitos = d.cauc
    ? `<section class="flow">
  <h2 class="secao">Requisito a requisito</h2>
  <p class="secao-sub">Os ${n0(r.requisitos)} itens do extrato, na ordem em que o Tesouro os publica.
  <b>Desabilitado</b> significa item indisponível na consulta, <b>igual para todos os entes do país</b> —
  nunca é falha local, e são ${n0(r.desabilitados)} nesta emissão.</p>
  <table class="lista"><thead><tr><th>Código</th><th>Requisito</th><th class="num">Situação</th><th class="num">Válido até</th></tr></thead>
  <tbody>${d.cauc.requisitos.map((req) => linhaRequisito(req, educacaoCods.has(req.codigo))).join("")}</tbody></table>
  ${
    d.cauc.pendenciasEducacao.length
      ? `<div class="risco"><b>${d.cauc.pendenciasEducacao.length === 1 ? "Uma pendência é de educação" : `${d.cauc.pendenciasEducacao.length} pendências são de educação`}:</b>
      ${d.cauc.pendenciasEducacao.map((p) => `${esc(p.codigo)} — ${esc(p.rotulo)}`).join("; ")}.
      São os itens em que o Tesouro confere a aplicação mínima e o envio do Anexo 8 ao SIOPE — <b>o mesmo envio
      que habilita ao VAAT</b> (art. 13, §4º da Lei nº 14.113/2020). Aqui a pendência custa duas coisas ao mesmo
      tempo: a transferência voluntária que não é assinada e a complementação que não é habilitada.</div>`
      : `<div class="insight"><b>Nenhuma pendência nos itens de educação.</b> É o sinal mais direto de que a
      prestação de contas da educação está em dia — e é ela que sustenta a habilitação ao VAAT.</div>`
  }
</section>`
    : "";

  const secaoSiope = d.siope
    ? `<section class="flow">
  <h2 class="secao">Vinculações da educação, indicador por indicador</h2>
  <p class="secao-sub">Os ${n0(r.indicadoresSiope)} indicadores apurados pelo SIOPE na declaração de
  ${d.siope.ano}${d.siope.defasado ? " — <b>exercício anterior ao de referência</b>" : ""}. Os que não têm
  parâmetro legal aparecem como <b>informativos</b>: lê-los como descumprimento é o engano mais comum desta
  tabela.</p>
  <table class="lista"><thead><tr><th>Cód.</th><th>Vinculação</th><th class="num">Apurado</th><th class="num">Parâmetro</th><th class="num">Folga</th><th class="num">Situação</th></tr></thead>
  <tbody>${d.siope.indicadores.map(linhaSiope).join("")}</tbody></table>
  <div class="${r.descumpridas ? "risco" : "insight"}"><b>O que o descumprimento trava — e o que não trava.</b>
  Não trava o FUNDEB: o art. 21 da Lei nº 14.113/2020 manda repassar o fundo automaticamente, e a LRF exclui as
  transferências de educação do conceito de transferência voluntária. O que ele trava são <b>convênios e
  operações de crédito</b>, via CAUC, e a <b>aprovação das contas</b> no tribunal, com imputação de débito e
  multa. A palavra "glosa" não aparece na lei do FUNDEB.</div>
</section>`
    : "";

  const secaoPontualidade = d.pontualidade
    ? `<section class="flow">
  <h2 class="secao">Pontualidade das entregas</h2>
  <p class="secao-sub">As datas reais das últimas DCAs contra os dois prazos que importam: <b>30 de abril</b>
  (LRF, art. 51, §1º, I) e o corte de <b>31 de agosto</b> que habilita ao VAAT do exercício seguinte. É
  previsão, não autópsia — o padrão de um ano diz o risco do outro.</p>
  <div class="status ${d.pontualidade.risco === "alto" ? "bad" : d.pontualidade.risco === "medio" ? "warn" : "ok"}">
    Risco de perder o VAAT pelo lado Siconfi: <b>${d.pontualidade.risco.toUpperCase()}</b>
  </div>
  <table class="lista"><thead><tr><th>Exercício</th><th class="num">Entregue em</th><th class="num">Homologada</th><th class="num">Contra 30/4</th><th class="num">Contra 31/8</th></tr></thead>
  <tbody>${d.pontualidade.dca
    .map(
      (e) => `<tr>
      <td class="cod">DCA ${e.exercicio}</td>
      <td class="num">${dataBR(e.entregueEm)}</td>
      <td class="num">${e.homologada ? "sim" : "não"}</td>
      <td class="num">${
        e.diasAlemDoPrazo == null
          ? "—"
          : e.diasAlemDoPrazo > 0
            ? `<b class="ambar">+${inteiro.format(e.diasAlemDoPrazo)}d</b>`
            : '<b class="verde">no prazo</b>'
      }</td>
      <td class="num">${
        e.estourouCorteVaat === true
          ? '<b class="vermelho">após o corte</b>'
          : e.estourouCorteVaat === false
            ? '<b class="verde">dentro</b>'
            : "—"
      }</td>
    </tr>`,
    )
    .join("")}</tbody></table>
  <p class="nota">RREO entregues: ${n0(d.pontualidade.rreoEntregues)} &middot; RGF entregues:
  ${n0(d.pontualidade.rgfEntregues)}. Fonte: extrato de entregas do Tesouro Nacional, consultado em
  ${dataBR(d.pontualidade.consultadoEm?.slice(0, 10))}.</p>
</section>`
    : "";

  const secaoVaar = d.vaar
    ? `<section class="flow">
  <h2 class="secao">As cinco condicionalidades do VAAR</h2>
  <p class="secao-sub">Aferidas todo ano, do zero. Reprovar em <b>uma</b> zera a parcela inteira — e nenhuma
  delas é fiscal.</p>
  <table class="lista"><thead><tr><th>Inciso</th><th>Condicionalidade</th><th class="num">Situação</th></tr></thead>
  <tbody>${(["I", "II", "III", "IV", "V"] as Condicionalidade[])
    .map((inc) => {
      const reprovada = d.vaar!.reprovadas.includes(inc);
      return `<tr><td class="cod">${inc}</td><td>${esc(DESCRICAO_CONDICIONALIDADE[inc])}</td><td class="num"><span class="sit ${
        reprovada ? "bad" : "ok"
      }">${reprovada ? "reprovada" : "cumprida"}</span></td></tr>`;
    })
    .join("")}</tbody></table>
  ${
    d.vaar.pendencia
      ? `<div class="risco"><b>O motivo oficial, nas palavras do FNDE:</b> &ldquo;${esc(d.vaar.pendencia)}&rdquo;</div>`
      : ""
  }
  ${
    d.vaar.condIVEstadual
      ? `<div class="nota"><b>A reprovação é do estado.</b> A Condicionalidade IV é aferida na UF, e nenhum
      município dela recebe o VAAR neste ciclo — a correção é articulação estadual, não gestão local.</div>`
      : ""
  }
  <p class="nota">Complementação recebida: <b>${moeda.format(d.vaar.complementacao)}</b>${
    d.vaar.referencia?.medianaUf
      ? ` &middot; mediana dos habilitados da UF: ${moeda.format(d.vaar.referencia.medianaUf)}`
      : ""
  }${
    d.vaar.referencia
      ? ` &middot; ${n0(d.vaar.referencia.ufBeneficiadas)} de ${n0(d.vaar.referencia.ufAvaliadas)} municípios da UF habilitados`
      : ""
  }.</p>
</section>`
    : "";

  const rp = d.remuneracao;
  const secaoPiso = rp
    ? `<section class="flow">
  <h2 class="secao">Piso do magistério</h2>
  <p class="secao-sub">Declaração de ${rp.ano} ao SIOPE. O piso é lei (Lei nº 11.738/2008) e a remuneração sai
  dos 70% do fundo — adimplência ao piso é o que o tribunal e o Ministério Público olham primeiro.</p>
  <table class="lista"><tbody>
    <tr><td>Piso nacional (jornada de referência)</td><td class="num"><b>${moeda.format(rp.piso ?? 0)}</b></td></tr>
    <tr><td>Mediana do magistério declarado</td><td class="num"><b>${moeda.format(rp.medianaMagisterio ?? 0)}</b></td></tr>
    <tr><td>Razão mediana / piso</td><td class="num">${rp.razaoMedianaPiso == null ? "—" : `${dec2.format(rp.razaoMedianaPiso)}×`}</td></tr>
    <tr><td>Vínculos abaixo do piso</td><td class="num"><b>${n0(rp.abaixoDoPiso)}</b> de ${n0(rp.magisterioDeclarado)} <span class="micro">(${pc(rp.abaixoDoPisoPct, 1)})</span></td></tr>
    <tr><td>Vínculos temporários</td><td class="num">${n0(rp.temporarios)} <span class="micro">(${pc(rp.temporariosPct, 1)})</span></td></tr>
    <tr><td>Cobertura da amostra</td><td class="num">${pc(rp.cobertura, 1)}</td></tr>
  </tbody></table>
  ${
    rp.confiavel
      ? ""
      : `<div class="nota"><b>Amostra de cobertura baixa.</b> Os percentuais acima descrevem os vínculos que a
      declaração alcançou, não a folha inteira — leia como sinal de direção, e confirme na folha do município.</div>`
  }
  <p class="nota">Salários proporcionalizados à jornada de referência. A remuneração é agregada na coleta —
  nenhum dado pessoal é lido nem impresso.</p>
</section>`
    : "";

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dossiê da Conformidade — ${esc(municipio)}/${esc(uf)}</title>
<style>${CSS}</style></head><body>

<section class="page cover">
  <div class="cover-top">
    <div style="display:flex;align-items:center;gap:.13in">${marca}
      <div><div class="marca">Global Sync</div><div class="marca-sub">Global Company Consultorias</div></div>
    </div>
    <span class="conf">Documento confidencial</span>
  </div>
  <div class="cover-mid">
    <span class="cover-tag">Dossiê temático &middot; prestação de contas</span>
    <h1>O que trava<br><span class="thin">e até quando</span></h1>
    <p class="cover-sub">Cada requisito fiscal, cada vinculação da educação e cada entrega, com a data e o
    dispositivo legal de cada um. É a lista que a secretaria usa no dia seguinte.</p>
    <div class="cover-muni"><em>Município</em><b>${esc(municipio)} — ${esc(uf)}</b></div>
    <div class="cover-hero">
      <em>${proximo ? "Próximo prazo real" : "Requisitos no extrato"}</em>
      <div class="val"><b>${proximo ? `${inteiro.format(proximo.diasRestantes)} dias` : n0(r.requisitos)}</b>${
        proximo ? `<i>${esc(proximo.codigo)} · ${dataBR(proximo.validadeAte)}</i>` : ""
      }</div>
      <p>${
        proximo
          ? `${esc(proximo.rotulo)}. A agenda completa, ordenada por data, está na primeira seção.`
          : "O extrato do CAUC não trouxe comprovação com prazo futuro nesta emissão."
      }</p>
    </div>
  </div>
  <div class="cover-bot">
    <div><b>${esc(responsavel)} &middot; Responsável Técnico</b>Global Company Consultorias</div>
    <div style="text-align:right"><b>Emitido em ${esc(data)}</b>${
      d.cauc?.dataPesquisa ? `CAUC de ${dataBR(d.cauc.dataPesquisa)}` : ""
    }</div>
  </div>
</section>

<section class="page content">
  <div class="page-header"><strong>Dossiê da Conformidade</strong><span>${esc(municipio)} — ${esc(uf)}</span></div>
  <div class="body">
    <div class="kicker">Sumário</div>
    <h2>O placar da prestação de contas</h2>
    <p class="lede">Três sistemas diferentes decidem se o município recebe: o <b>CAUC</b> libera convênio, o
    <b>SIOPE</b> comprova a aplicação da educação e o <b>Siconfi</b> habilita à complementação VAAT. Eles não
    se comunicam entre si, e a secretaria costuma descobrir a pendência na recusa.</p>

    <div class="kpis">
      ${kpi(`${n0(r.comprovados)}/${n0(r.requisitos)}`, "requisitos comprovados no CAUC")}
      ${kpi(n0(r.pendentes), "pendências no extrato")}
      ${kpi(n0(r.pendentesEducacao), "pendências de educação")}
      ${kpi(n0(r.vencemEm60Dias), "vencem nos próximos 60 dias")}
    </div>

    <div class="duas">
      <div class="card">
        <h3>Onde cada pendência dói</h3>
        <table><tbody>
          <tr><td>Convênios e transferências voluntárias</td><td class="num">${r.pendentes ? '<b class="vermelho">bloqueado</b>' : '<b class="verde">liberado</b>'}</td></tr>
          <tr><td>Habilitação ao VAAT do exercício seguinte</td><td class="num">${
            d.pontualidade?.risco === "alto" ? '<b class="vermelho">risco alto</b>' : d.pontualidade?.risco === "medio" ? '<b class="ambar">risco médio</b>' : '<b class="verde">controlado</b>'
          }</td></tr>
          <tr><td>Complementação VAAR</td><td class="num">${
            r.condicionalidadesReprovadas ? `<b class="vermelho">zerada (${d.vaar?.reprovadas.join(", ")})</b>` : '<b class="verde">habilitado</b>'
          }</td></tr>
          <tr><td>Repasse do FUNDEB</td><td class="num"><b class="verde">automático (art. 21)</b></td></tr>
        </tbody></table>
        <p class="micro" style="margin-top:.06in">O repasse do fundo <b>nunca</b> é bloqueado por pendência
        administrativa. Quem mistura as linhas acima corrige o que não está quebrado e deixa quebrado o que trava.</p>
      </div>
      <div class="card">
        <h3>Vinculações e piso</h3>
        <table><tbody>
          <tr><td>Indicadores apurados pelo SIOPE</td><td class="num"><b>${n0(r.indicadoresSiope)}</b></td></tr>
          <tr><td>Vinculações descumpridas</td><td class="num">${r.descumpridas ? `<b class="vermelho">${n0(r.descumpridas)}</b>` : '<b class="verde">nenhuma</b>'}</td></tr>
          <tr><td>Declaração do exercício de referência</td><td class="num">${
            d.siope ? (d.siope.defasado ? '<b class="ambar">defasada</b>' : '<b class="verde">em dia</b>') : "—"
          }</td></tr>
          <tr><td>Magistério abaixo do piso</td><td class="num">${
            rp?.abaixoDoPisoPct == null ? "—" : `<b>${pc(rp.abaixoDoPisoPct, 1)}</b>`
          }</td></tr>
        </tbody></table>
        <p class="micro" style="margin-top:.06in">${
          d.cauc?.panorama
            ? `Panorama nacional: ${inteiro.format(d.cauc.panorama.comPendencia)} de ${inteiro.format(d.cauc.panorama.total)} municípios têm ao menos uma pendência no extrato.`
            : "Panorama nacional indisponível nesta emissão."
        }</p>
      </div>
    </div>

    <div class="calendario">
      <h3>O calendário do exercício, numa folha</h3>
      <table><tbody>
        <tr><td>DCA no Siconfi</td><td class="num"><b>30 de abril</b> <span class="micro">LRF, art. 51, §1º, I</span></td></tr>
        <tr><td>SIOPE, por bimestre</td><td class="num"><b>30 dias</b> <span class="micro">do fechamento do bimestre</span></td></tr>
        <tr><td>Coleta do Censo Escolar</td><td class="num"><b>maio a 31/7</b></td></tr>
        <tr><td>Retificação do Censo</td><td class="num"><b>30 dias</b> <span class="micro">da publicação preliminar</span></td></tr>
        <tr><td>Siconfi <b>e</b> SIOPE para habilitar ao VAAT</td><td class="num"><b>31 de agosto</b> <span class="micro">Lei nº 14.113/2020, art. 13, §4º</span></td></tr>
        <tr><td>Envio ao FNDE para cálculo dos coeficientes</td><td class="num"><b>dezembro</b></td></tr>
      </tbody></table>
    </div>

    <p class="fonte">Fontes: Tesouro Nacional — CAUC (extrato de requisitos fiscais) e extrato de entregas;
    FNDE/MEC — SIOPE (vinculações da educação e remuneração do magistério) e lista de habilitação do VAAR.
    Todas consultadas na emissão deste documento.</p>
  </div>
  <div class="page-footer"><span>Tesouro Nacional &middot; FNDE/MEC</span><span>2</span></div>
</section>

${secaoAgenda}
${secaoRequisitos}
${secaoSiope}
${secaoPontualidade}
${secaoVaar}
${secaoPiso}

<section class="flow">
  <p class="fonte">Emitido em ${esc(data)} por ${esc(responsavel)} &middot; Global Company Consultorias.
  Documento confidencial, destinado exclusivamente ao município analisado. O extrato do CAUC é publicado em
  dias úteis e reflete a situação da data da consulta; item comprovado aqui não substitui a checagem do órgão
  concedente no momento da assinatura.</p>
</section>

</body></html>`;
}

function kpi(valor: string, rotulo: string): string {
  return `<div class="kpi"><b>${valor}</b><span>${rotulo}</span></div>`;
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
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:.14in;margin-top:.2in}
.kpi{border-left:.03in solid var(--teal);padding-left:.11in}
.kpi b{display:block;color:var(--navy);font-size:16pt;letter-spacing:-.02em;line-height:1}
.kpi span{display:block;color:var(--muted);font-size:6.9pt;font-weight:800;letter-spacing:.07em;
  text-transform:uppercase;margin-top:.05in;line-height:1.3}
.duas{display:grid;grid-template-columns:1fr 1fr;gap:.16in;margin-top:.22in}
.card,.calendario{border:1px solid var(--line);border-radius:8px;padding:.15in .17in;background:#fff}
.calendario{margin-top:.2in;background:var(--wash)}
.card h3,.calendario h3{font-size:10.5pt;color:var(--navy);margin-bottom:.08in}
table{width:100%;border-collapse:collapse;font-size:8.2pt}
table td{padding:.045in 0;border-bottom:1px solid #eef3f5;vertical-align:top}
table td.num{text-align:right;color:var(--navy);white-space:nowrap}
.micro{font-size:6.9pt;color:var(--muted);line-height:1.35}
.fonte{margin-top:.16in;font-size:6.9pt;color:var(--muted);line-height:1.4}
table.lista{font-size:7.8pt}
table.lista thead th{text-align:left;font-size:6.8pt;letter-spacing:.08em;text-transform:uppercase;
  color:#fff;background:var(--navy);padding:.055in .07in;font-weight:800}
table.lista thead th.num{text-align:right}
table.lista td{padding:.05in .07in}
table.lista tbody tr:nth-child(even){background:#f8fafb}
table.lista tbody tr.urg{background:#fdf6e8}
table.lista td.cod{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:7.2pt;color:var(--navy);
  white-space:nowrap}
.pill{background:rgba(39,166,154,.14);color:#1d7d72;font-size:5.9pt;font-weight:800;letter-spacing:.05em;
  text-transform:uppercase;border-radius:999px;padding:.015in .05in}
.sit{font-size:6.4pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;
  padding:.02in .07in;white-space:nowrap}
.sit.ok{background:#eaf5f1;color:var(--good)}
.sit.bad{background:#fbeceb;color:var(--red)}
.sit.neutro{background:#eef3f5;color:var(--muted)}
.verde{color:var(--good)}.vermelho{color:var(--red)}.ambar{color:var(--gold)}
.nota,.risco,.insight{margin-top:.14in;border-radius:8px;padding:.12in .14in;font-size:7.9pt;line-height:1.45}
.nota{background:var(--wash);border-left:.03in solid var(--line);color:#44545f}
.risco{background:#fdf1f0;border-left:.03in solid var(--red)}
.insight{background:#eef6f5;border-left:.03in solid var(--teal)}
.status{margin-bottom:.12in;border-radius:8px;padding:.1in .14in;font-size:9pt;font-weight:600}
.status.ok{background:#eaf5f1;color:var(--good)}
.status.warn{background:#fdf6e8;color:var(--gold)}
.status.bad{background:#fbeceb;color:var(--red)}
`;
