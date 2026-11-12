import type { CicloDoPlano, PlanoEvolucao } from "@/core/lib/plano-evolucao";

/**
 * As duas folhas do plano de evolução. Contagem fixa (`PAGINAS_PLANO_EVOLUCAO`):
 * a primeira é o próximo ano frente a frente; a segunda, o calendário e o que
 * precisa estar em dia para o dinheiro chegar. `plano-evolucao-pdf.ts` mede as
 * duas antes de imprimir — conteúdo que invade o rodapé derruba a emissão.
 */

export const PAGINAS_PLANO_EVOLUCAO = 2;

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (v: number, c = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const mi = (v: number) => `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
const pc = (v: number, c = 1) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c })}%`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

const CSS = `@page{size:letter;margin:0}*{box-sizing:border-box}body{margin:0;font:9pt/1.38 Arial,sans-serif;color:#19242e;background:#fbfcfc}
.pg{width:8.5in;height:11in;padding:.5in .6in .45in;page-break-after:always;position:relative;overflow:hidden}.pg:last-child{page-break-after:auto}
.top{display:flex;justify-content:space-between;color:#647380;font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase;border-bottom:1px solid #d9e1e5;padding-bottom:.08in;margin-bottom:.2in}.top b{color:#10263f}
.k{color:#27a69a;font:bold 8pt Arial;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.06in}h1{font-size:21pt;line-height:1.05;margin:0;color:#10263f;letter-spacing:-.02em}
h2{font-size:12pt;color:#10263f;margin:.14in 0 .06in}.lede{font-size:9.6pt;color:#344551;margin:.12in 0 0;max-width:7.2in}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:.1in;margin-top:.18in}.kpi{background:#fff;border:1px solid #d9e1e5;border-radius:7px;padding:.1in .12in}
.kpi em{display:block;font-style:normal;color:#647380;font-size:6.6pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.kpi b{display:block;color:#10263f;font-size:14pt;margin-top:.04in;letter-spacing:-.02em}.kpi span{display:block;color:#647380;font-size:6.9pt;margin-top:.03in}
.kpi.h{background:#f2f8f7;border-color:#cde4e0;border-left:.05in solid #27a69a}.kpi.h b{color:#1d6a58}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d9e1e5}th{background:#10263f;color:#fff;font-size:6.9pt;letter-spacing:.06em;text-transform:uppercase;text-align:left;padding:.06in .08in}
td{padding:.06in .08in;border-bottom:1px solid #e3e9ec;font-size:8pt;vertical-align:top;color:#33454f}td.r,th.r{text-align:right}tr.t td{background:#eef4f5;font-weight:800;color:#10263f}
.mono{font-variant-numeric:tabular-nums;white-space:nowrap}.sub{font-size:7pt;color:#647380}.note{background:#fdf9ee;border:1px solid #eddfb8;border-radius:7px;padding:.1in .13in;color:#584416;font-size:8pt;margin-top:.14in}
.ins{background:#f2f8f7;border:1px solid #cde4e0;border-radius:7px;padding:.1in .13in;font-size:8.2pt;margin-top:.14in}.g2{display:grid;grid-template-columns:1fr 1fr;gap:.14in}
.card{background:#fff;border:1px solid #d9e1e5;border-radius:7px;padding:.11in .13in}.card h3{margin:0 0 .05in;font-size:10pt;color:#10263f}ul{margin:.03in 0 0;padding-left:.16in}li{margin-bottom:.04in}
.p2 td{padding:.045in .08in}.p2 h1{font-size:19pt}
.foot{position:absolute;bottom:.3in;left:.6in;right:.6in;border-top:1px solid #d9e1e5;padding-top:.07in;color:#647380;font-size:7pt;display:flex;justify-content:space-between}`;

function textosDaPosicao(p: PlanoEvolucao) {
  const nome = esc(p.municipio);
  const { proprio, minimo } = p.vaat;
  if (p.posicao === "na-faixa")
    return {
      kicker: `${nome} já está na faixa do VAAT`,
      titulo: "Cada matrícula a mais vale<br>o mínimo nacional inteiro",
      lede: `O VAAT próprio da rede é de R$ ${brl(proprio)} por aluno, contra o mínimo de R$ ${brl(minimo)}: a União completa a diferença, e cada matrícula ponderada que a rede acrescenta passa a valer <b>R$ ${brl(minimo)} por ano</b>. O plano é crescer e declarar a rede que já existe.`,
    };
  if (p.posicao === "perto")
    return {
      kicker: `${nome} está a ${n0(p.distanciaAoPiso!)} matrículas-equivalentes do VAAT`,
      titulo: "O plano que leva a rede<br>para dentro do VAAT",
      lede: `O VAAT próprio da rede é de R$ ${brl(proprio)} por aluno, ${pc((proprio / minimo - 1) * 100)} acima do mínimo nacional de R$ ${brl(minimo)}. Hoje cada matrícula ponderada a mais vale R$ ${brl(p.valorNoFundo)} — o que o fundo de ${p.uf} paga. Faltam <b>${n0(p.distanciaAoPiso!)} matrículas-equivalentes</b> para o VAAT próprio cruzar o piso; daí em diante a União completa a rede, e cada matrícula passa a valer <b>R$ ${brl(minimo)}</b>.`,
    };
  return {
    kicker: `${nome} recebe pelo fundo do estado`,
    titulo: "Cada matrícula declarada<br>é receita no ano seguinte",
    lede: `Cada matrícula ponderada a mais vale R$ ${brl(p.valorNoFundo)} por ano no fundo de ${p.uf}. O plano é crescer e declarar a rede que já existe.`,
  };
}

function valeNoCiclo(p: PlanoEvolucao, c: CicloDoPlano, anterior: number): string {
  const { minimo } = p.vaat;
  if (p.posicao === "na-faixa" || c.via === "vaat") return `R$ ${brl(minimo, 0)}`;
  const d = p.distanciaAoPiso;
  if (p.posicao !== "perto" || d === null || c.equivalentes < d) return `R$ ${brl(p.valorNoFundo, 0)}`;
  if (anterior >= d) return `R$ ${brl(minimo, 0)}`;
  return `R$ ${brl(p.valorNoFundo, 0)} → R$ ${brl(minimo, 0)} <span style="color:#1d6a58;font-weight:700">cruza o piso</span>`;
}

function paginaUm(p: PlanoEvolucao): string {
  const { kicker, titulo, lede } = textosDaPosicao(p);
  const [c1, , c3] = p.ciclos;
  const cal = p.calendario;
  const naFaixa = p.posicao === "na-faixa";
  const colunaFixas = p.vaar > 0 && p.lacunas > 0 ? "VAAR e declaração" : p.lacunas > 0 ? "Declaração" : "VAAR";
  const conta =
    naFaixa
      ? `Cada matrícula-equivalente vale o VAAT-MIN porque a rede está abaixo dele: o fundo paga a sua parte e a União completa até R$ ${brl(p.vaat.minimo)}.`
      : p.posicao === "perto"
        ? `Os primeiros ${n0(p.distanciaAoPiso!)} equivalentes valem R$ ${brl(p.valorNoFundo)} cada — o fundo de ${p.uf} —, e a União não paga nada. ${p.censoDoCruzamento ? `No Censo de ${p.censoDoCruzamento} a rede cruza o piso` : "Cruzado o piso"}: daí em diante cada equivalente vale R$ ${brl(p.vaat.minimo)}, porque a União completa a rede.`
        : `Cada matrícula-equivalente vale R$ ${brl(p.valorNoFundo)}, o que o fundo de ${p.uf} paga.`;
  const fixas =
    p.vaar > 0 && p.lacunas > 0
      ? `A coluna de VAAR e declaração soma o VAAR (${mi(p.vaar)}, referência — o rateio depende da evolução de cada rede) e a declaração ao Censo que fica abaixo da mediana nacional (${mi(p.lacunas)}). `
      : p.lacunas > 0
        ? `A coluna de declaração é o que a rede declara ao Censo abaixo da mediana nacional (${mi(p.lacunas)}). `
        : p.vaar > 0
          ? "O VAAR é referência — o rateio depende da evolução de cada rede. "
          : "";
  const evolucao = p.evolucao
    ? `Evolução do fundo: redistribuição do fundo estadual crescendo +${pc(p.evolucao.taxa * 100)} ao ano, média do município de ${p.evolucao.de} a ${p.evolucao.ate}. `
    : "";

  return `<section class="pg"><div class="top"><span><b>Plano de evolução FUNDEB</b> · ${esc(p.municipio)} — ${p.uf}</span><span>Emitido em ${dataBr(cal.emitidoEm)}</span></div>
<div class="k">${kicker}</div><h1>${titulo}</h1><p class="lede">${lede}</p>
<div class="g4"><div class="kpi"><em>Receita FUNDEB ${p.exercicio}</em><b>${mi(p.receita)}</b><span>${naFaixa ? `VAAT de ${mi(p.vaat.complementacao)}` : "sem complementação VAAT"}</span></div>
<div class="kpi"><em>${naFaixa ? "Valor por matrícula a mais" : "Hoje, por matrícula a mais"}</em><b>R$ ${brl(naFaixa ? p.vaat.minimo : p.valorNoFundo, 0)}</b><span>${naFaixa ? "VAAT-MIN, rede na faixa" : p.posicao === "perto" ? `R$ ${brl(p.vaat.minimo, 0)} depois do piso` : `fundo de ${p.uf}`}</span></div>
<div class="kpi h" data-destaque><em>Receita projetada ${c1.receita}</em><b>${mi(c1.receitaProjetada)}</b><span>+${pc((c1.receitaProjetada / p.receita - 1) * 100)} · Censo ${c1.censo}, em ${brl(cal.mesesAteReferencia, 1)} meses</span></div>
<div class="kpi"><em>Otimista ${c3.receita}</em><b>${mi(c3.receitaProjetada)}</b><span>+${pc((c3.receitaProjetada / p.receita - 1) * 100)} · três Censos no ritmo</span></div></div>
<h2>O que os últimos Censos mostram</h2><p style="font-size:8pt;color:#33454f;margin:0">${p.resumoDosCensos}</p>
<h2>De onde vêm as matrículas — o próximo Censo primeiro</h2>
<table><tr><th>Frente</th><th>Hoje</th><th>Meta até ${c3.censo}</th><th class="r" style="width:.95in">Censo ${c1.censo}</th><th class="r" style="width:.95in">Até ${c3.censo}</th></tr>
${p.frentes.map((f) => `<tr data-frente="${f.chave}"><td><b>${f.nome}</b><div class="sub">${f.conta}</div></td><td>${f.hoje}</td><td>${f.meta}</td><td class="r mono"><b>+${n0(f.noProximoCenso)}</b></td><td class="r mono">+${n0(f.equivalentes)}</td></tr>`).join("")}
<tr class="t"><td>Matrículas-equivalentes no ritmo das redes atendidas</td><td></td><td></td><td class="r mono">+${n0(c1.equivalentes)}</td><td class="r mono">+${n0(c3.equivalentes)}</td></tr></table>
<h2>O próximo ano, e os dois seguintes no mesmo ritmo</h2>
<table><tr><th>Censo → receita</th><th class="r">Equivalentes acumulados</th><th>Cada novo equivalente vale</th><th class="r">Matrículas</th><th class="r">${colunaFixas}</th><th class="r">Evolução do fundo</th><th class="r">Receita projetada</th></tr>
${p.ciclos.map((c, i) => `<tr${i === 0 ? ' class="t"' : ""}><td><b>${c.censo} → ${c.receita}</b></td><td class="r mono">+${n0(c.equivalentes)}</td><td>${valeNoCiclo(p, c, i > 0 ? p.ciclos[i - 1].equivalentes : 0)}</td><td class="r mono">+${mi(c.matriculas)}</td><td class="r mono">${c.fixas > 0 ? `+${mi(c.fixas)}` : "—"}</td><td class="r mono">${c.evolucaoDoFundo > 0 ? `+${mi(c.evolucaoDoFundo)}` : "—"}</td><td class="r mono"><b>${mi(c.receitaProjetada)}</b></td></tr>`).join("")}</table>
<div class="note"><b>Como a conta é feita.</b> ${conta}
Ritmo: +${pc(p.ritmo * 100)} da rede ao ano, a mediana das redes atendidas pela Global; o primeiro ciclo é proporcional ao tempo até ${dataBr(cal.dataDeReferencia)}. ${fixas}${evolucao}Receita não é sobra: aluno novo traz custo de professor, merenda e transporte.</div>
<div class="foot"><span>Global Sync · Global Company Consultorias · Confidencial</span><span>1 / 2</span></div></section>`;
}

function paginaDois(p: PlanoEvolucao): string {
  const cal = p.calendario;
  const final = p.ciclos[2];
  const naFaixa = p.posicao === "na-faixa";
  const ref = dataBr(cal.dataDeReferencia);
  const linhaTempo: Array<[string, string, string]> = [
    [`Até fev/${cal.censoDaMatricula}`, "Conferência escola a escola", `${p.escolasEspeciais.length ? `${p.escolasEspeciais.join(", ")}: localização declarada certa já garante o fator maior. ` : ""}Levantar quem tem educação especial sem AEE e a jornada real de cada turma.`],
    [`Mar a ${ref}`, "Crescer a rede antes da data de referência", `Busca ativa de EJA com turmas abertas até ${ref}; AEE registrado como turma; jornada integral nas escolas com estrutura.`],
    [`${ref.slice(0, 5)} a 31/07/${cal.censoDaMatricula}`, `Coleta do Censo ${cal.censoDaMatricula}`, "Declarar jornada, localização e AEE do que existe na data de referência."],
    [`Ago a out/${cal.censoDaMatricula}`, "Retificação", "Conferir a publicação preliminar e retificar no prazo do comunicado do Inep."],
    [`${cal.censoDaMatricula + 1} e ${final.censo}`, "Os dois Censos seguintes", `Repetir o ciclo em ${cal.censoDaMatricula + 1} e ${final.censo}, até a data de referência de cada ano. Receita inteira em ${final.receita}.`],
  ];
  const c3 = p.condicionalidadeIII;
  const textoVaar = [
    p.reprovadas.includes("II")
      ? "<b>Condicionalidade II:</b> participação de pelo menos 80% dos estudantes no Saeb, aferida por ano escolar avaliado e não pela média da rede — uma única série abaixo reprova. A próxima aplicação do Saeb é a que decide."
      : "",
    c3
      ? `<b>Condicionalidade III:</b> o aprendizado adequado caiu de ${pc(c3.ppi2019 * 100)} para ${pc(c3.ppi2023 * 100)} entre estudantes pretos, pardos e indígenas, e de ${pc(c3.baixo2019 * 100)} para ${pc(c3.baixo2023 * 100)} entre os de menor nível socioeconômico. Plano pedagógico por escola, começando pelas que concentram esses estudantes.`
      : "",
  ].filter(Boolean).join(" ");

  return `<section class="pg p2"><div class="top"><span><b>Plano de evolução FUNDEB</b> · ${esc(p.municipio)} — ${p.uf}</span><span>Cronograma e condições</span></div>
<div class="k">${esc(cal.titulo)}</div><h1>O calendário que decide<br>o FUNDEB de ${cal.receitaDaMatricula}</h1>
<p class="lede">O Censo fotografa a rede na última quarta-feira de maio. Para ${cal.censoDaMatricula} é ${ref}: faltam ${brl(cal.mesesAteReferencia, 1)} meses, e o que estiver declarado nesse dia é o que vira receita em ${cal.receitaDaMatricula}.</p>
<table style="margin-top:.16in"><tr><th style="width:1.3in">Quando</th><th style="width:1.9in">O quê</th><th>Como</th></tr>
${linhaTempo.map((l) => `<tr><td><b>${l[0]}</b></td><td><b>${l[1]}</b></td><td>${l[2]}</td></tr>`).join("")}</table>
<h2>A série da rede, Censo a Censo</h2>
<table><tr><th>Censo</th><th class="r">Rede municipal</th><th class="r">EJA</th><th class="r">Educação especial</th><th class="r">Tempo integral</th><th class="r">Em % da rede</th></tr>
${p.serie.map((x) => `<tr><td><b>${x.ano}</b></td><td class="r mono">${n0(x.rede)}</td><td class="r mono">${n0(x.eja)}</td><td class="r mono">${n0(x.especial)}</td><td class="r mono">${n0(x.integral)}</td><td class="r mono">${pc((x.integral / x.rede) * 100)}</td></tr>`).join("")}</table>
${textoVaar ? `<div class="card" style="margin-top:.12in"><h3>VAAR: em paralelo ao Censo</h3><p style="margin:0;font-size:8pt">${textoVaar}</p></div>` : ""}
<h2>O que precisa estar em dia para o dinheiro chegar</h2>
<div class="g2"><div class="card"><h3>${naFaixa ? "Para não perder o VAAT" : "Para entrar e ficar no VAAT"}</h3><ul style="font-size:8pt">
<li><b>Siconfi e SIOPE até 31 de agosto</b>, todo ano. Inabilitado não tem o VAAT apurado${naFaixa ? ` e perde ${mi(p.vaat.complementacao)} no exercício` : " — e não entra na faixa mesmo cruzando o piso"}.</li>
<li>Do VAAT, pelo menos 15% em despesa de capital e a parcela da educação infantil.</li>
<li>${naFaixa ? `Com o VAAT próprio ${pc((1 - p.vaat.proprio / p.vaat.minimo) * 100)} abaixo do mínimo, a rede não corre risco de sair da faixa.` : "O VAAT usa a arrecadação de dois anos antes: se os impostos próprios crescerem mais que a matrícula, a rede se afasta do piso."}</li></ul></div>
<div class="card"><h3>Riscos que o plano precisa tratar</h3><ul style="font-size:8pt">${p.riscos.map((x) => `<li>${x}</li>`).join("")}</ul></div></div>
<div class="ins"><b>Próximo passo:</b> reunião com a secretaria de educação e a contabilidade para validar as metas escola a escola e fechar o calendário até ${ref}. O levantamento completo do município acompanha este plano.</div>
<div class="foot"><span>Global Sync · Global Company Consultorias · Confidencial</span><span>2 / 2</span></div></section>`;
}

export function generatePlanoEvolucaoHtml(p: PlanoEvolucao): string {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Plano de evolução FUNDEB — ${esc(p.municipio)}/${p.uf}</title><style>${CSS}</style><body>${paginaUm(p)}${paginaDois(p)}</body></html>`;
}
