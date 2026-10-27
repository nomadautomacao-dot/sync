import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {NextRequest} from 'next/server';
import {DOCUMENTOS} from '../../modules/cidades/documentos-emissiveis';
const codigo=process.argv[2]??'2304400';
const selected=process.argv[3];
async function main(){
 await mkdir('tmp/pdfs/catalogo-visual',{recursive:true});const rows=[];
 for(const d of DOCUMENTOS.filter(d=>!selected||d.id===selected)){
  const started=Date.now();
  try{
   const endpoint=d.endpoint.split('?')[0];const route=await import(pathToFileURL(resolve(`app${endpoint}/route.ts`)).href);
   const response:Response=await route.POST(new NextRequest('http://localhost'+d.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo_ibge:codigo,exercicio:2026,response_format:'bundle'})}));
   if(!response.ok)throw new Error(`${response.status}: ${await response.text()}`);
   const bundle=await response.json();if(!bundle.pdfBase64||!bundle.archive)throw new Error('PDF ou arquivo de dados ausente');
   const pdf=Buffer.from(bundle.pdfBase64,'base64');const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)??[]).length;if(!pages)throw new Error('Sem páginas');
   await writeFile(`tmp/pdfs/catalogo-visual/${d.id}.pdf`,pdf);
   await writeFile(`tmp/pdfs/catalogo-visual/${d.id}.json`,JSON.stringify(bundle.archive));
   const row={id:d.id,ok:true,pages,bytes:pdf.length,seconds:Math.round((Date.now()-started)/1000)};rows.push(row);console.log(JSON.stringify(row));
  }catch(e){const row={id:d.id,ok:false,error:e instanceof Error?e.message:String(e)};rows.push(row);console.error(JSON.stringify(row));}
 }
 await writeFile(`tmp/pdfs/catalogo-visual/resultado${selected?'-'+selected:''}.json`,JSON.stringify(rows,null,2));
 if(rows.some(r=>!r.ok))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
