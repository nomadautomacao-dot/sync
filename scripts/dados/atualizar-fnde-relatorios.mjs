#!/usr/bin/env node
/** Atualização explícita, fora da emissão. Guarda URL, versão, checksum e reconciliação. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const ano=Number(process.argv[2]||2026);
if(!Number.isInteger(ano)||ano<2022||ano>2100) throw new Error('Exercício inválido');
const pagina=`https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/${ano}`;
async function baixar(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);return Buffer.from(await r.arrayBuffer());}
function decodificar(b){const s=b.toString('utf8');return s.includes('\ufffd')?new TextDecoder('windows-1252').decode(b):s;}
const html=decodificar(await baixar(pagina));
const links=[...html.matchAll(/href="([^"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),pagina).href);
const receita=links.find(u=>/receita-total-do-fundeb.*\.csv/i.test(u));
const vaat=links.find(u=>/vaat-vaat-min.*\.pdf/i.test(u));
if(!receita||!vaat)throw new Error('Publicação sem receita ou anexo VAAT; arquivos anteriores preservados.');
const versao=html.match(/(?:\d+ª publicação|\d+a publicação)[\s\S]{0,50}?Portaria[^<]+/i)?.[0]?.replace(/<[^>]*>/g,'').trim()||`FNDE ${ano} - publicação encontrada em ${pagina}`;
const arquivos=[{id:'receitas',url:receita},{id:'vaat',url:vaat}];
const numero=s=>Number(s.trim().replaceAll('.','').replace(',','.').replace(/^[-–—]\s*$/,'0'));
const preparados=[];
for(const a of arquivos){
  const bytes=await baixar(a.url);let texto;
  if(a.id==='vaat') {
    // O link CSV da 3ª publicação aponta para a 1ª. O PDF identificado pela portaria é a referência.
    const convertido=spawnSync('pdftotext',['-layout','-','-'],{input:bytes,maxBuffer:32*1024*1024});
    if(convertido.status!==0)throw new Error('Instale Poppler/pdftotext para extrair o anexo VAAT oficial.');
    const pdf=convertido.stdout.toString();
    const numeroPdf='([\\d.,]+|-)';
    const re=new RegExp('^([A-Z]{2})\\s+(.+?)\\s+(\\d{7})\\s+'+numeroPdf+'\\s+'+numeroPdf+'\\s+'+numeroPdf+'\\s+([\\d.,]+%)\\s*$');
    const linhas=pdf.split(/\r?\n/).map(l=>l.trim().match(re)).filter(Boolean).map(m=>m.slice(1).join(';'));
    texto=pdf.match(/Portaria Interministerial[^\n]+/)?.[0]+'\nUF;Ente Federado;IBGE;VAAT anterior;VAAT com complementação;Complementação VAAT;IEI\n'+linhas.join('\n')+'\n';
  } else texto=decodificar(bytes).replace(/^\uFEFF/,'');
  const linhas=texto.split(/\r?\n/).filter(l=>a.id==='receitas'?/^[A-Z]{2};\d{7};/.test(l):/^[A-Z]{2};[^;]+;\d{7};/.test(l));
  if(linhas.length<5000)throw new Error(`${a.id}: cobertura inesperada (${linhas.length}); atualização recusada`);
  if(a.id==='receitas')for(const l of linhas){const c=l.split(';');const valores=c.slice(3,7).map(numero);const total=numero(c[8]);
    if(![...valores,total].every(Number.isFinite)||Math.abs(valores.reduce((x,y)=>x+y,0)-total)>.05)throw new Error(`Receita não conciliada: ${c[1]}`);}
  preparados.push({...a,texto,municipios:linhas.length,sha256:createHash('sha256').update(texto).digest('hex')});
}
// Bloqueia mistura de publicações: o VAAT deve conciliar por município com o anexo de receitas.
const porIbge=new Map(preparados.find(a=>a.id==='receitas').texto.split(/\r?\n/).filter(l=>/^[A-Z]{2};\d{7};/.test(l)).map(l=>{const c=l.split(';');return [c[1],numero(c[5])]}));
for(const l of preparados.find(a=>a.id==='vaat').texto.split(/\r?\n/).filter(l=>/^[A-Z]{2};[^;]+;\d{7};/.test(l))){const c=l.split(';');if(porIbge.has(c[2])&&Math.abs(porIbge.get(c[2])-numero(c[5]))>.05)throw new Error(`VAAT de outra versão: ${c[2]}`);}
await mkdir('data/fnde',{recursive:true});
const manifestPath=`data/fnde/fontes-${ano}.json`;
let antigo=null;try{antigo=JSON.parse(await readFile(manifestPath,'utf8'));}catch{}
const coletadoEm=new Date().toISOString();
for(const a of preparados){
  const destino=`data/fnde/${a.id}-${ano}.csv`;
  // A revisão anterior permanece disponível para rastrear retificações.
  try{const anterior=await readFile(destino);const hash=createHash('sha256').update(anterior).digest('hex');
    const dir=`data/fnde/revisoes/${ano}`;await mkdir(dir,{recursive:true});await writeFile(`${dir}/${a.id}-${hash.slice(0,12)}.csv`,anterior);
  }catch(e){if(e.code!=='ENOENT')throw e;}
  await writeFile(`${destino}.tmp`,a.texto);await rename(`${destino}.tmp`,destino);
}
const manifest={schemaVersion:1,exercicio:ano,coletadoEm,pagina,versao,anterior:antigo?.coletadoEm??null,
  arquivos:preparados.map(({id,url,municipios,sha256})=>({id,url,municipios,sha256}))};
await writeFile(manifestPath+'.tmp',JSON.stringify(manifest,null,2)+'\n');await rename(manifestPath+'.tmp',manifestPath);
console.log(JSON.stringify(manifest,null,2));
