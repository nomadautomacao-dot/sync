import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import type {RelatorioSnapshot} from '../../core/lib/relatorio-snapshot';
import {municipalBoundaryFromGeoJson} from '../../core/lib/ibge-municipal-boundary';
import {generateMunicipalXrayVisual,type VisualMapSource} from '../../core/lib/municipal-xray-visual';
import {assertSemCorte} from '../../core/lib/pdf-corte';

async function main(){
 const source=process.argv[2];if(!source)throw new Error('Uso: node --import tsx scripts/pdf/gerar-raio-x-visual.ts SNAPSHOT.json [MALHA.geojson]');
 const snapshot:RelatorioSnapshot=JSON.parse(await readFile(source,'utf8'));
 const {municipioNome,uf,exercicio,codigoIBGE}=snapshot.current.relatorio.identificacao;
 let boundary=snapshot.boundary;let mapSource:VisualMapSource|undefined;
 if(process.argv[3]){const bytes=await readFile(process.argv[3]);boundary=municipalBoundaryFromGeoJson(JSON.parse(bytes.toString('utf8')));if(!boundary)throw new Error('Malha inválida');mapSource={url:`https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${codigoIBGE}?formato=application/vnd.geo%2Bjson&qualidade=maxima`,sha256:createHash('sha256').update(bytes).digest('hex'),collectedAt:new Date().toISOString()};}
 const result=generateMunicipalXrayVisual(snapshot,boundary,mapSource);
 const slug=`${municipioNome}_${uf}_${exercicio}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_]/g,'_').toUpperCase();
 await mkdir('output/pdf',{recursive:true});await mkdir('output/interactive',{recursive:true});await mkdir('tmp/pdfs/raiox-visual',{recursive:true});
 await writeFile(`tmp/pdfs/raiox-visual/${slug}.html`,result.pdfHtml);
 await writeFile(`output/interactive/RAIO_X_VISUAL_${slug}.html`,result.interactiveHtml);
 const browser=await chromium.launch();
 try{const page=await browser.newPage();await page.setContent(result.pdfHtml,{waitUntil:'load'});await page.emulateMedia({media:'print'});await assertSemCorte(page,'Raio-X visual');await page.pdf({path:`output/pdf/RAIO_X_VISUAL_${slug}.pdf`,preferCSSPageSize:true,printBackground:true});}finally{await browser.close()}
 await writeFile(`output/interactive/BASE_VISUAL_${slug}.json`,JSON.stringify({snapshotId:snapshot.qualidade.snapshotId,mapSource,boundary,schools:result.schools,sources:result.sourceLinks},null,2));
 console.log(JSON.stringify({pages:result.pages,mapped:result.mapped,schools:result.schools.length,snapshotId:snapshot.qualidade.snapshotId}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
