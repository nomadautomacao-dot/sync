import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const url = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=maxima';
const bytes = process.argv[2]
  ? await readFile(process.argv[2])
  : execFileSync('curl', ['--fail','--silent','--show-error','--location','--proto','=https','--proto-redir','=https','--max-time','180',url], {maxBuffer:128*1024*1024});
const raw = JSON.parse(bytes.toString('utf8'));
if (raw.type !== 'FeatureCollection' || raw.features?.length < 5500) throw new Error('Malha nacional incompleta.');
const estados = new Map(), codes = new Set();
for (const f of raw.features) {
  const id = f.properties?.codarea;
  if (!/^\d{7}$/.test(id) || codes.has(id) || !['Polygon','MultiPolygon'].includes(f.geometry?.type)) throw new Error('Feição municipal inválida.');
  codes.add(id);
  const uf = id.slice(0,2), municipios = estados.get(uf) ?? {};
  municipios[id] = f.geometry; estados.set(uf, municipios);
}
if (estados.size !== 27) throw new Error('A malha não cobre as 27 unidades federativas.');
const dir = 'data/ibge/malhas', arquivos = [];
await mkdir(dir, {recursive:true});
for (const [uf, geometrias] of estados) {
  const text = JSON.stringify(geometrias);
  await writeFile(`${dir}/${uf}.json`, text);
  arquivos.push({uf,municipios:Object.keys(geometrias).length,sha256:createHash('sha256').update(text).digest('hex')});
}
await writeFile(`${dir}/fontes.json`, JSON.stringify({schemaVersion:1,url,qualidade:'maxima',coletadoEm:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),municipios:codes.size,arquivos},null,2));
console.log(`${codes.size} geometrias oficiais salvas em ${estados.size} arquivos por UF.`);
