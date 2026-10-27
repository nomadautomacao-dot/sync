import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { baixarFonte, hashDados } from './public-data-fetch';

const base = 'https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/financiamento/fundeb/';
const pendentes = new Map<number, Promise<string[]>>();
const n = (s: string | undefined) => s?.trim() ? Number(s.trim().replace(/\./g, '').replace(',', '.').replace(/^[-–—]$/, '0')) : NaN;
export function validarReceitasPublicadas(texto: string, ano: number): Map<string, number[]> {
  if (!texto.slice(0, 4000).includes(String(ano))) throw new Error('Arquivo sem competência anual identificável.');
  const rows = texto.split(/\r?\n/).filter(l => /^[A-Z]{2};\d{7};/.test(l));
  if (rows.length < 5000) throw new Error('Cobertura municipal incompleta; atualização recusada.');
  const parsed = new Map<string, number[]>();
  for (const row of rows) {
    const cols = row.split(';'), valores = cols.slice(3, 7).map(n), total = n(cols[8]);
    if (valores.length !== 4 || ![...valores, total].every(v=>Number.isFinite(v)&&v>=0) || Math.abs(valores.reduce((a,b)=>a+b,0)-total) > .05 || parsed.has(cols[1])) throw new Error('Receitas sem conciliação ou código duplicado.');
    parsed.set(cols[1], [...valores,total]);
  }
  return parsed;
}
const links = (html: string, url: string) => [...html.matchAll(/href="([^"]+)"/g)].map(m => new URL(m[1].replace(/&amp;/g,'&'),url).href);
const decode = (b: Buffer) => {const t=b.toString('utf8');return t.includes('\ufffd')?new TextDecoder('windows-1252').decode(b):t;};

/** Descobre a publicação anual e só substitui receitas depois da conciliação.
 * Quando VAAT muda, bloqueia a troca isolada: os anexos precisam ser atualizados juntos. */
export async function atualizarReceitasPublicadas(ano: number, atualizar = false): Promise<string[]> {
  const running = pendentes.get(ano); if(running)return running;
  const work = (async()=>{
    const pagina=base+ano;
    try {
      let html=decode((await baixarFonte(pagina,atualizar)).bytes), page=pagina;
      const allLinks=links(html,page);
      const publicationNumber=(url:string)=>Number(url.match(/\/(\d+)(?:a|ª)?-publicac(?:ao|oes)/i)?.[1]??0);
      let candidates=allLinks.filter(u=>/\.csv(?:\/|$)/i.test(u)&&/receita[.\w-]*total/i.test(u));
      if(!candidates.length) {
        const parents=allLinks.map(url=>url.match(/^(.*?\/\d+(?:a|ª)?-publicac(?:ao|oes)[^/]*)/i)?.[1]).filter((u):u is string=>Boolean(u&&u.includes(`/fundeb/${ano}`))).sort((a,b)=>publicationNumber(b)-publicationNumber(a));
        if(parents[0]) {page=parents[0];html=decode((await baixarFonte(page,atualizar)).bytes);candidates=links(html,page).filter(u=>/\.csv(?:\/|$)/i.test(u)&&/receita[.\w-]*total/i.test(u));}
      }
      const url=[...new Set(candidates)].sort((a,b)=>publicationNumber(b)-publicationNumber(a))[0];
      if(!url)return [`FNDE ${ano}: não foi possível identificar automaticamente o CSV da publicação mais recente; versão local mantida.`];
      const {bytes,fonte}=await baixarFonte(url,atualizar), texto=decode(bytes).replace(/^\uFEFF/,'');
      const nova=validarReceitasPublicadas(texto,ano), dir=join(process.cwd(),'data','fnde'), path=join(dir,`receitas-${ano}.csv`);
      const anterior=await readFile(path,'utf8').catch(()=>null);
      const antes=anterior?validarReceitasPublicadas(anterior,ano):null;
      if(antes&&[...antes.keys()].some(id=>!nova.has(id)))throw new Error('Publicação omite municípios da base anterior.');
      const mudou=!antes||[...nova].some(([id,v])=>JSON.stringify(v)!==JSON.stringify(antes.get(id)));
      if(mudou&&antes) {
        const temVaat=await readFile(join(dir,`vaat-${ano}.csv`),'utf8').then(()=>true).catch(()=>false);
        if(temVaat&&[...nova].some(([id,v])=>!antes.has(id)||Math.abs(v[2]-antes.get(id)![2])>.05)) return [`FNDE ${ano}: nova publicação altera o VAAT. Atualizar o conjunto receita/VAAT antes de usar esta emissão como versão vigente; troca isolada bloqueada.`];
      }
      const versao=texto.split(/\r?\n/).find(l=>/portaria/i.test(l))?.split(';')[0].trim()??`FNDE ${ano} - ${page}`;
      const manifestPath=join(dir,`fontes-${ano}.json`);
      const previous=await readFile(manifestPath,'utf8').then(t=>JSON.parse(t)).catch(()=>null);
      const checksum=hashDados(texto);
      if(!mudou&&previous?.arquivos?.find((a:{id:string})=>a.id==='receitas')?.sha256===checksum)return [];
      await mkdir(dir,{recursive:true});
      if(anterior&&mudou) {const revisions=join(dir,'revisoes',String(ano));await mkdir(revisions,{recursive:true});await writeFile(join(revisions,`receitas-${hashDados(anterior).slice(0,12)}.csv`),anterior);}
      const suffix='.'+randomUUID()+'.tmp';
      await writeFile(path+suffix,texto);await rename(path+suffix,path);
      const arquivos=[{id:'receitas',url,sha256:checksum,municipios:nova.size},...(previous?.arquivos??[]).filter((a:{id:string})=>a.id!=='receitas')];
      await writeFile(manifestPath+suffix,JSON.stringify({schemaVersion:1,exercicio:ano,pagina,versao,coletadoEm:fonte.coletadoEm,arquivos},null,2));await rename(manifestPath+suffix,manifestPath);
      return [];
    }catch{return [`FNDE ${ano}: consulta ou validação da publicação indisponível; versão local preservada e identificada no relatório.`];}
  })();
  pendentes.set(ano,work);try{return await work;}finally{pendentes.delete(ano);}
}
