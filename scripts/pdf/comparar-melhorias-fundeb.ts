import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import type { RelatorioSnapshot } from '../../core/lib/relatorio-snapshot';
import { assertSemCorte } from '../../core/lib/pdf-corte';
import { CSS_INTELIGENCIA, paginasInteligencia } from '../../core/lib/relatorio-inteligencia-template';

const esc = (v: unknown) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function main() {
  const source = process.argv[2]; if (!source) throw new Error('Informe o snapshot do pacote de relatórios.');
  const s: RelatorioSnapshot = JSON.parse(await readFile(source,'utf8'));
  const i = s.inteligencia; if (!i) throw new Error('Snapshot sem inteligência executiva.');
  const { municipioNome, uf, exercicio, codigoIBGE } = s.current.relatorio.identificacao;
  const slug = `${municipioNome}_${uf}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').toUpperCase();
  const executive = paginasInteligencia(i);
  const before = `<div class="intel"><div class="intel-kicker">Comparação dos modelos / ${esc(municipioNome)} - ${uf}</div><h2>O que mudou nos relatórios</h2><p>Comparação entre a versão anterior e a nova emissão. Não representa resultado de intervenção no município.</p><table><thead><tr><th>Antes</th><th>Depois</th></tr></thead><tbody>${[
    ['Exemplo hipotético de R$ 1,2 milhão no diagnóstico.','Simulador separado; nenhuma receita adicional presumida no PDF.'],
    ['Estimativa anual como principal referência financeira.','Previsão FNDE, previsão municipal, receita realizada e comparação no mesmo bimestre.'],
    ['Percentuais históricos de aplicação.','Indicadores do período corrente, mantendo o histórico identificado nos anexos.'],
    ['VAAR resumido à condicionalidade e à mediana de outros entes.','Motivos e componentes oficiais da condicionalidade III, atendimento e aprendizagem.'],
    ['Contagens diferentes de escolas sem lista conciliável.','Relação por código INEP, presença em cada base e triagem de prioridades.'],
    ['Plano de investigação em PDF.','Plano com frentes específicas do município; painel para responsável, prazo, evidência, resultado e histórico.'],
    ['Atualização com cobertura parcial das versões locais.','Detecção das publicações anuais, validação da receita, checksum das novas consultas e comparação entre coletas.'],
  ].map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table><div class="intel-note">Não há promessa de habilitação, recuperação ou contratação. O acompanhamento da equipe depende de registros reais, e a execução exclusiva do Fundeb ainda exige Anexo 8 e conciliação bancária.</div><p>Snapshot: ${s.qualidade.snapshotId}. Referência: ${esc(s.qualidade.versao)}.</p></div>`;
  const bodies=[before,executive[1].html,executive[2].html,executive[3].html];
  const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font:12px Arial}.page{width:210mm;height:297mm;padding:16mm;break-after:page;position:relative}.page:last-child{break-after:auto}.page-body{height:257mm}footer{position:absolute;bottom:10mm;left:16mm;right:16mm;display:flex;justify-content:space-between;color:#60727d;font:10px Arial}${CSS_INTELIGENCIA}</style><body>${bodies.map((h,k)=>`<section class="page"><main class="page-body">${h}</main><footer><span>Global Sync · ${esc(municipioNome)}/${uf} · ${exercicio}</span><span>${k+1} / ${bodies.length}</span></footer></section>`).join('')}</body></html>`;
  const browser=await chromium.launch({args:['--no-sandbox']});
  try{const page=await browser.newPage();await page.setContent(html);await assertSemCorte(page,'Antes e depois');await mkdir('output/pdf',{recursive:true});await writeFile(`output/pdf/ANTES_E_DEPOIS_${slug.replace(/_CE$/,'')}_${exercicio}.pdf`,await page.pdf({preferCSSPageSize:true,printBackground:true}));}finally{await browser.close();}
  await mkdir('output/dados',{recursive:true});
  const csv=(v:unknown)=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replace(/"/g,'""')+'"';
  const rows=[['Código INEP','Escola','Matrículas','Território','Resultados','Indicadores','Conferir recortes','Sinais'],...i.escolas.map(e=>[e.codigo,e.nome,e.matriculas,e.bases.territorio,e.bases.resultados,e.bases.indicadores,e.verificacaoCadastro,e.sinais.map(x=>`${x.indicador}: ${x.valor} (${x.ano}); referência ${x.referencia}`).join(' | ')])];
  await writeFile(`output/dados/ESCOLAS_${slug}_${exercicio}.csv`,'\uFEFF'+rows.map(r=>r.map(csv).join(';')).join('\r\n'));
  await writeFile(`output/dados/INTELIGENCIA_${codigoIBGE}_${exercicio}.json`,JSON.stringify(i,null,2));
  console.log(JSON.stringify({paginas:4,escolas:i.escolas.length,snapshot:s.qualidade.snapshotId}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
