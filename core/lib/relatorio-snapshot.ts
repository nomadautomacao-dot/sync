import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { buildGoviaMunicipioCompleto, findGoviaMunicipio } from './govia-compat';
import { buildMunicipalProfile } from './municipal-profile';
import { fetchMunicipalBoundary } from './ibge-municipal-boundary';
import { getFonteFundeb, getFundebReceitasOficiais } from './fundeb-fnde';
import { conferirSoma, exigirQualidade, type AchadoQualidade, type EvidenciaDado } from './qualidade-dados';
import type { InteligenciaRelatorio } from './relatorio-inteligencia';
import { assinaturaBasesLocais, enriquecerSnapshot } from './relatorio-monitoramento';
import { atualizarReceitasPublicadas } from './fundeb-publicacoes';

const SCHEMA = 6;
const emCurso = new Map<string,Promise<RelatorioSnapshot>>();
type Principal = NonNullable<Awaited<ReturnType<typeof buildGoviaMunicipioCompleto>>>;
export interface QualidadeRelatorio { snapshotId:string; coletadoEm:string; versao:string; evidencias:EvidenciaDado[]; achados:AchadoQualidade[] }
export interface RelatorioSnapshot {
  schemaVersion:number; current:Principal; base:Principal|null;
  profile:Awaited<ReturnType<typeof buildMunicipalProfile>>|null;
  boundary:Awaited<ReturnType<typeof fetchMunicipalBoundary>>|null;
  qualidade:QualidadeRelatorio;
  inteligencia?: InteligenciaRelatorio;
}

/** Uma coleta compartilhada pelos dois PDFs. A versão do FNDE invalida o cache. */
export async function buildRelatorioSnapshot(params:Parameters<typeof buildGoviaMunicipioCompleto>[0], atualizar=false):Promise<RelatorioSnapshot> {
  const municipio=await findGoviaMunicipio(params);
  if(!municipio)throw new Error('Município não encontrado.');
  const ano=params.exercicio??new Date().getFullYear();
  const avisosPublicacoes=(await Promise.all([atualizarReceitasPublicadas(ano,atualizar),atualizarReceitasPublicadas(ano-1,atualizar)])).flat();
  const fonte=getFonteFundeb(ano);
  const bases=await assinaturaBasesLocais();
  const assinatura=createHash('sha256').update(JSON.stringify({schema:SCHEMA,fonte,fonteBase:getFonteFundeb(ano-1),bases,avisosPublicacoes})).digest('hex').slice(0,12);
  const chave=`${municipio.id}-${ano}-${assinatura}`;
  const dir=join(process.cwd(),'.cache','relatorios'); const arquivo=join(dir,chave+'.json');
  if(!atualizar)try {
    const s=JSON.parse(await readFile(arquivo,'utf8')) as RelatorioSnapshot;
    if(Date.now()-Date.parse(s.qualidade.coletadoEm)<6*3600_000){
      if(s.profile)s.profile.coletadoEm=new Date(s.profile.coletadoEm);
      return s;
    }
  }catch{/* Cache ausente ou inválido: nova coleta. */}
  const pendente=emCurso.get(chave); if(pendente)return pendente;
  const promessa=(async()=>{
    const identidade={codigo_ibge:String(municipio.id),exercicio:ano};
    const [atual,anterior,perfil,limite]=await Promise.allSettled([
      buildGoviaMunicipioCompleto(identidade),
      buildGoviaMunicipioCompleto({...identidade,exercicio:ano-1}),
      buildMunicipalProfile({codigoIbge:String(municipio.id),municipio:municipio.nome,uf:municipio.microrregiao?.mesorregiao?.UF?.sigla??params.uf??''}),
      fetchMunicipalBoundary(String(municipio.id)),
    ]);
    if(atual.status==='rejected')throw atual.reason;
    if(!atual.value)throw new Error('Base principal não disponível.');
    const current=atual.value; const profile=perfil.status==='fulfilled'?perfil.value:null;
    const coletadoEm=new Date().toISOString();
    const rec=current.relatorio.receitas;
    const oficial=await getFundebReceitasOficiais(String(municipio.id),ano);
    if(!oficial||Object.keys(rec).some(k=>Math.abs(rec[k as keyof typeof rec]-oficial[k as keyof typeof rec])>.05))throw new Error("Receita principal sem conciliação com a fonte oficial; emissão interrompida.");
    const achados=conferirSoma(rec.totalReceitas,[rec.receitaContribuicaoMunicipal,rec.complementacaoVAAF,rec.complementacaoVAAT,rec.complementacaoVAAR],'fundeb_componentes');
    for(const mensagem of avisosPublicacoes)achados.push({codigo:'monitoramento_fnde',nivel:'aviso',mensagem});
    if(!fonte)achados.push({codigo:'versao_fnde',nivel:'aviso',mensagem:'Arquivo FNDE sem manifesto de atualização; conferir a versão da estimativa.'});
    if(anterior.status==='rejected'||!anterior.value)achados.push({codigo:'ano_base',nivel:'aviso',mensagem:'Ano-base indisponível; comparação anual limitada.'});
    if(perfil.status==='rejected')achados.push({codigo:'perfil',nivel:'aviso',mensagem:'Falha na consulta ao perfil municipal.'});
    for(const f of profile?.falhas??[])achados.push({codigo:`consulta_${f.bloco}`,nivel:'aviso',mensagem:`${f.fonte}: ${f.motivo}`});
    const evidencias:EvidenciaDado[]=Object.entries(rec).filter(([,v])=>typeof v==='number').map(([id,valor])=>({id:`fundeb.${id}`,valor:valor as number,unidade:'BRL',universo:'rede_beneficiaria_fundeb',periodo:String(ano),fonte:fonte?.versao??current.relatorio.identificacao.fonte,url:fonte?.arquivos.find(a=>a.id==='receitas')?.url??null,coletadoEm:fonte?.coletadoEm??coletadoEm,versao:fonte?.versao??null,estado:valor===0?'zero_confirmado':'disponivel'}));
    function visitar(obj:unknown,caminho:string){
      if(!obj||typeof obj!=='object')return;
      const o=obj as Record<string,unknown>;
      if('valor' in o&&'fonte' in o){
        const valor=typeof o.valor==='number'||typeof o.valor==='string'||typeof o.valor==='boolean'?o.valor:null;
        const anoRef=String(o.periodo??o.ano??'').match(/(?:19|20)\d{2}/)?.[0];
        const antigo=anoRef&&Number(anoRef)<ano-4;
        const falhou=valor===null&&(profile?.falhas??[]).some(f=>caminho.includes(f.bloco)||String(o.fonte).includes(f.fonte));
        evidencias.push({id:caminho,valor,unidade:String(o.unidade??'não documentada'),universo:String(o.universo??'ver definição da fonte'),periodo:String(o.periodo??o.ano??'')||null,fonte:String(o.fonte),url:typeof o.url==='string'?o.url:null,coletadoEm,estado:falhou?'falha_consulta':valor===null?'indisponivel':antigo?'desatualizado':valor===0?'zero_confirmado':'disponivel'});
      } else for(const [k,v] of Object.entries(o))visitar(v,`${caminho}.${k}`);
    }
    visitar(profile,'perfil');
    const antigos=evidencias.filter(e=>e.estado==='desatualizado');
    if(antigos.length)achados.push({codigo:'referencias_historicas',nivel:'aviso',mensagem:`${antigos.length} indicadores têm referência anterior a ${ano-4}; usar como contexto histórico, sem inferir situação atual.`});
    const censo=current.relatorio.censoEscolar;
    if(censo?.matriculasDetalhadas&&censo.matriculasEtapa){
      const {creche,preEscola}=censo.matriculasDetalhadas;
      if(creche!=null&&preEscola!=null)achados.push(...conferirSoma(censo.matriculasEtapa.educacaoInfantil,[creche,preEscola],'educacao_infantil'));
    }
    if(censo?.tempoIntegral?.total!=null&&censo.totalMatriculasMunicipais!=null&&censo.tempoIntegral.total>censo.totalMatriculasMunicipais)achados.push({codigo:'integral_total',nivel:'erro',mensagem:'Matrículas integrais excedem a rede municipal.'});
    const micro=current.payload.relatorio_dirigido_base.escolasTerritorio;
    const microTotal=(micro as unknown as {resumo?:{total?:number}}|null)?.resumo?.total;
    if(microTotal&&microTotal!==censo?.totalEscolasMunicipais)achados.push({codigo:'universo_escolas',nivel:'aviso',mensagem:`Escolas municipais: ${censo?.totalEscolasMunicipais} na base consolidada e ${microTotal} no recorte territorial dos microdados. Os recortes precisam de reconciliação por código INEP; não usar denominadores intercambiáveis.`});
    evidencias.push({id:'educacao.matriculas_municipais',valor:censo?.totalMatriculasMunicipais??null,unidade:'matriculas',universo:'rede_municipal',periodo:String(censo?.anoReferencia),fonte:censo?.fonte??'Inep',url:'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-basica',coletadoEm,estado:censo?.totalMatriculasMunicipais==null?'indisponivel':'disponivel'});
    exigirQualidade(achados);
    const snapshotId=createHash('sha256').update(JSON.stringify({chave,coletadoEm,evidencias})).digest('hex').slice(0,16);
    const snapshot:RelatorioSnapshot={schemaVersion:SCHEMA,current,base:anterior.status==='fulfilled'?anterior.value:null,profile,boundary:limite.status==='fulfilled'?limite.value:null,qualidade:{snapshotId,coletadoEm,versao:fonte?.versao??'Versão a confirmar',evidencias,achados}};
    await enriquecerSnapshot(snapshot,atualizar);
    await mkdir(dir,{recursive:true});await writeFile(arquivo+'.tmp',JSON.stringify(snapshot));await rename(arquivo+'.tmp',arquivo);
    return snapshot;
  })();
  emCurso.set(chave,promessa);
  try{return await promessa;}finally{emCurso.delete(chave);}
}
