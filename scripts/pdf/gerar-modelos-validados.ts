import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {buildRelatorioSnapshot, type RelatorioSnapshot} from '../../core/lib/relatorio-snapshot';
import {generateLevantamentoHtml} from '../../core/lib/fundeb-levantamento-template';
import {generateLevantamentoPdf} from '../../core/lib/fundeb-levantamento-pdf';
import {mapMunicipalXrayModel,generateMunicipalXrayHtml} from '../../core/lib/municipal-xray-template';
import {generateMunicipalXrayPdf} from '../../core/lib/municipal-xray-pdf';
async function main(){
 const codigo=process.argv[2]??'2304400'; const ano=Number(process.argv[3]??2026);
 if(!/^\d{7}$/.test(codigo)||!Number.isInteger(ano)||ano<2022)throw new Error('Uso: node --import tsx scripts/pdf/gerar-modelos-validados.ts CODIGO_IBGE ANO [--atualizar]');
 const sourceIndex=process.argv.indexOf('--snapshot');
 const s:RelatorioSnapshot=sourceIndex>=0?JSON.parse(await readFile(process.argv[sourceIndex+1],'utf8')):await buildRelatorioSnapshot({codigo_ibge:codigo,exercicio:ano},process.argv.includes('--atualizar'));
 if(String(s.current.relatorio.identificacao.codigoIBGE)!==codigo||s.current.relatorio.identificacao.exercicio!==ano)throw new Error('Snapshot de outro município ou exercício.');
 const nome=s.current.relatorio.identificacao.municipioNome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').toUpperCase()+'_'+s.current.relatorio.identificacao.uf;
 const dir='tmp/pdfs/modelos-validados'; await mkdir(dir,{recursive:true});
 await mkdir('output/pdf',{recursive:true});
 await writeFile(`output/pdf/BASE_VALIDADA_${nome}_${ano}.json`,JSON.stringify(s,null,2));
 const logo=await readFile('public/global-sync-icon.png').catch(()=>null);
 const h=generateLevantamentoHtml({relatorio:s.current.relatorio,payload:s.current.payload,inteligencia:s.inteligencia,qualidade:s.qualidade,logoDataUri:logo?'data:image/png;base64,'+logo.toString('base64'):null});
 const m=mapMunicipalXrayModel({currentPayload:s.current.payload,basePayload:s.base?.payload??{},baseYear:ano-1,currentYear:ano,profile:s.profile,boundary:s.boundary,inteligencia:s.inteligencia,qualidade:s.qualidade});
 const x=generateMunicipalXrayHtml(m);
 await writeFile(`${dir}/${nome}-fundeb.html`,h);await writeFile(`${dir}/${nome}-raiox.html`,x);
 const f=await generateLevantamentoPdf(h,nome,ano);await writeFile(`output/pdf/LEVANTAMENTO_FUNDEB_${nome}_${ano}_REVISADO.pdf`,f.pdfBuffer);
 const r=await generateMunicipalXrayPdf(x,`${nome}_${ano-1}_${ano}`);await writeFile(`output/pdf/RAIO_X_${nome}_${ano-1}_${ano}_REVISADO.pdf`,r.pdfBuffer);
 console.log(JSON.stringify({snapshot:s.qualidade.snapshotId,receitas:s.current.relatorio.receitas,falhas:s.profile?.falhas,ajustes:r.ajustadas}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
