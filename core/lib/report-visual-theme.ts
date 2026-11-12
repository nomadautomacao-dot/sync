import type { Page } from 'playwright';
import { lerJsonDeDados } from './dados-arquivo';
import { getEscolasTerritorio } from './escolas-territorio';
import { fetchMunicipalBoundary, projectToBoundary } from './ibge-municipal-boundary';

export const REPORT_VISUAL_VERSION = '2026.1';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const slug=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').toUpperCase();
type UfIbge={UF?:{sigla?:string}};
export interface Municipality {id:number;nome:string;microrregiao?:{mesorregiao?:UfIbge}|null;'regiao-imediata'?:{'regiao-intermediaria'?:UfIbge}|null}
/** A microrregião vem nula para município criado depois da divisão de 2017 (Boa
 * Esperança do Norte/MT). Ler `m.microrregiao.mesorregiao` direto lançava dentro
 * do `find`, o `catch` engolia, e **todo** município de código maior — o resto de
 * MT, Goiás inteiro e o DF — saía sem mapa e sem UF na capa. */
export const ufDe=(m:Municipality)=>m.microrregiao?.mesorregiao?.UF?.sigla??m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla??'';

/** A camada visual é aplicada antes das verificações de completude e corte.
 * Somente a capa é recomposta; nenhum bloco técnico ou linha de dados é removido. */
export async function applyReportVisualTheme(page:Page, municipalitySlug:string) {
  await page.emulateMedia({media:'print'});
  const before=await page.evaluate(()=>{
    const c=document.querySelector<HTMLElement>('section.page.cover');
    const selectors={title:'h1',city:'.cover-city, .cover-muni b, .city',tag:'.cover-tag, .cover-eyebrow, .cover-label',conf:'.conf, .cover-label',subtitle:'.cover-sub, .cover-lead',footer:'.cover-bot, .cover-meta',note:'.cover-hero p, .cover-note',heroLabel:'.cover-hero em',heroValue:'.cover-hero .val b',heroExtra:'.cover-hero .val i'};
    const fields=Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,c?.querySelector<HTMLElement>(selector)?.innerText.trim()??''])) as Record<keyof typeof selectors,string>;
    return {hasCover:Boolean(c),destaque:Boolean(c?.querySelector('.cover-hero[data-capa-destaque]')),...fields,
      stats:[...(c?.querySelectorAll('.cover-stat, .stats>div, .ckpi')??[])].map(e=>({value:e.querySelector('b')?.textContent??'',label:e.querySelector('span, em')?.textContent??''})),
    };
  });
  let municipality:Municipality|undefined;
  try {const catalog=lerJsonDeDados<{municipios:Municipality[]}>('data/ibge/municipios.json');municipality=catalog.municipios.find(m=>municipalitySlug===String(m.id)||municipalitySlug.startsWith(`${slug(m.nome)}_${ufDe(m)}`));}catch{/* A capa mantém a identidade que já estava no documento. */}
  const boundary=municipality?await fetchMunicipalBoundary(String(municipality.id)):null;
  const territory=municipality?getEscolasTerritorio(String(municipality.id)):null;
  const points=boundary?(territory?.escolas??[]).flatMap(e=>{
    if(e.lat==null||e.lng==null||!Number.isFinite(e.lat)||!Number.isFinite(e.lng))return [];
    const p=projectToBoundary(boundary,e.lng,e.lat);return p.x>=0&&p.x<=720&&p.y>=0&&p.y<=720?[p]:[];
  }):[];
  const map=boundary?`<svg viewBox="${esc(boundary.viewBox)}" aria-label="Contorno municipal"><defs><pattern id="rv-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#183f48" stroke-opacity=".07"/></pattern><linearGradient id="rv-land"><stop stop-color="#2f918a"/><stop offset="1" stop-color="#1d5560"/></linearGradient></defs><rect width="720" height="720" fill="url(#rv-grid)"/><path d="${esc(boundary.path)}" fill="url(#rv-land)" fill-rule="evenodd" stroke="#174a54" stroke-width="1.4"/>${points.map(p=>`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.6" fill="#f3c26b"/>`).join('')}<text x="675" y="55" fill="#6a827a" font-size="14">N</text><path d="M680 65v35m-5-29l5-6l5 6" fill="none" stroke="#6a827a"/></svg>`:'';
  // O relatório que marca o próprio destaque (`data-capa-destaque`) quer o número
  // principal na capa, à frente dos de apoio. Sem isso o Levantamento perdia o
  // ganho — a razão de ser da capa — e mostrava só receita e estimativa.
  const principal=before.destaque&&before.heroValue?[{value:before.heroValue,label:[before.heroLabel,before.heroExtra].filter(Boolean).join(' · '),destaque:true}]:[];
  const apoio:Array<{value:string;label:string;destaque?:boolean}>=before.stats.length?before.stats:principal.length||!before.heroValue?[]:[{value:before.heroValue,label:before.heroLabel},{value:before.heroExtra,label:''}].filter(x=>x.value);
  // Acima de 13 caracteres ("+R$ 1.990,36 mi", receita de capital) o destaque
  // em corpo cheio encosta na divisória da placa; o corpo cai um degrau.
  const stats=[...principal,...apoio].slice(0,3);
  const city=municipality?.nome??before.city;
  const uf=municipality?ufDe(municipality):'';
  const content=`<div class="rv-brand"><b>GLOBAL SYNC<span>INTELIGÊNCIA MUNICIPAL</span></b><span>${esc(before.conf||'RELATÓRIO MUNICIPAL')}</span></div><div class="rv-heading"><div class="rv-kicker">${esc(before.tag||'DIAGNÓSTICO E PLANEJAMENTO')}</div><h1>${esc(before.title).replace(/\n/g,'<br>')}</h1><h2 style="font-size:${city.length>30?29:city.length>21?35:46}px">${esc(city)}</h2><div class="rv-state">${esc(uf)}${municipality?` / IBGE ${municipality.id}`:''}</div><p>${esc(before.subtitle)}</p></div><div class="rv-map">${map}</div><div class="rv-map-label">${boundary?`IBGE · contorno municipal simplificado<br>${points.length} ${points.length===1?'ponto escolar':'pontos escolares'} · Censo ${territory?.ano??'N/D'}<br>Pontos indicam localização, sem classificação de desempenho.`:'Cartografia não disponível nesta emissão.'}</div><div class="rv-bottom"><div class="rv-stats">${stats.map(x=>`<div${x.destaque?' class="rv-destaque"':''}><b${x.destaque&&x.value.length>13?' style="font-size:34px"':''}>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join('')}</div>${before.note?`<p class="rv-note">${esc(before.note)}</p>`:''}<div class="rv-meta">${esc(before.footer).replace(/\n/g,' · ')}</div><div class="rv-signature">GLOBAL SYNC / EDIÇÃO VISUAL ${REPORT_VISUAL_VERSION}</div></div>`;
  await page.addStyleTag({content:REPORT_VISUAL_CSS});
  await page.evaluate(({version,content,hasCover})=>{
    document.documentElement.dataset.reportVisual=version;
    const cover=document.querySelector<HTMLElement>('section.page.cover');
    if(hasCover&&cover){cover.className='page cover rv-cover';cover.innerHTML=content;}
  },{version:REPORT_VISUAL_VERSION,content,hasCover:before.hasCover});
  const bad=await page.evaluate(()=>{
    const h=document.querySelector('.rv-heading')?.getBoundingClientRect();
    const b=document.querySelector('.rv-bottom')?.getBoundingClientRect();
    return Boolean(h&&b&&h.bottom>b.top-12);
  });
  if(bad)throw new Error('Capa visual excede a área disponível; revisar título e indicadores.');
}

export const REPORT_VISUAL_CSS=`
@page rv-cover{margin:0}
@page rv-fixed{margin:0}
html[data-report-visual] section.rv-cover{page:rv-cover}
html[data-report-visual] section.page:not(.rv-cover){page:rv-fixed}

html[data-report-visual]{--navy:#183f48;--blue:#287f7b;--teal:#277d73;--gold:#bc8c42;--ink:#183d43;--muted:#59736b;--line:#d4dfd4;--paper:#fafbf7;--wash:#edf3e9;--good:#257467;--warn:#906328}
html[data-report-visual] body{font-family:Arial,Helvetica,sans-serif;color:#183d43}
html[data-report-visual] .page:not(.rv-cover),html[data-report-visual] section.flow{background:#fafbf7}
html[data-report-visual] .page:not(.rv-cover) h2,html[data-report-visual] .flow h2{color:#183f48;font-weight:600;letter-spacing:-.025em}
html[data-report-visual] .kicker,html[data-report-visual] .eyebrow,html[data-report-visual] .intel-kicker{color:#357d70;letter-spacing:.12em}
html[data-report-visual] th{background:#183f48;color:#fff;border-color:#d4dfd4}
html[data-report-visual] td{border-color:#d4dfd4}
html[data-report-visual] .card,html[data-report-visual] .intel-card,html[data-report-visual] .kpi{border-color:#d4dfd4;box-shadow:none}
html[data-report-visual] .insight,html[data-report-visual] .evidence{background:#e9f0e5;border-color:#398577}
html[data-report-visual] .note,html[data-report-visual] .limit,html[data-report-visual] .intel-note{background:#f1eadb;border-color:#bc8c42}
html[data-report-visual] .page-header,html[data-report-visual] .page-footer{border-color:#cbd8ce;color:#59736b}
html[data-report-visual] section.rv-cover{background:#f2f6f1!important;color:#183f48!important;border:0!important;display:block!important;position:relative!important;padding:0!important;overflow:hidden!important;box-sizing:border-box}
html[data-report-visual] .rv-cover:before,html[data-report-visual] .rv-cover:after{display:none!important}
.rv-cover .rv-brand{position:absolute;top:6%;left:7.5%;right:7.5%;display:flex;align-items:center;justify-content:space-between;z-index:2;font:10px Arial;letter-spacing:1px;color:#59736b}
.rv-cover .rv-brand b{color:#183f48;font-size:15px;font-weight:bold}.rv-cover .rv-brand b span{display:block;font-size:7px;margin-top:7px;font-weight:normal;letter-spacing:1.4px}.rv-cover .rv-brand>span{border:1px solid #b5c7bb;border-radius:18px;padding:8px 11px;max-width:42%;font-size:8px}
.rv-cover .rv-heading{position:absolute;top:15%;left:7.5%;right:7.5%;z-index:2}.rv-cover .rv-kicker{color:#2f7d70;font:bold 9px Arial;letter-spacing:1.5px;margin-bottom:15px;max-width:95%}
.rv-cover h1{font:500 36px/1.07 Arial!important;letter-spacing:-1.1px!important;color:#183f48!important;margin:0!important;max-width:100%!important}.rv-cover h2{font-family:Arial;line-height:1.05;font-weight:500;letter-spacing:-1.3px;color:#23806f!important;margin:18px 0 9px!important;max-width:100%}.rv-cover .rv-state{font:10px Arial;letter-spacing:2px;color:#59736b}
.rv-cover .rv-heading>p{font:11px/1.55 Arial;color:#48605a;max-width:35%;margin-top:19px}
.rv-cover .rv-map{position:absolute;top:28%;right:1%;width:66%;height:44%;z-index:1}.rv-cover .rv-map svg{height:100%;width:100%}.rv-cover .rv-map-label{position:absolute;top:63%;left:7.5%;max-width:29%;font:8px/1.65 Arial;color:#6a827a;z-index:2}
.rv-cover .rv-bottom{position:absolute;left:7.5%;right:7.5%;bottom:4.5%;z-index:2}/* A capa é clara, e os números ficam numa placa escura no pé. Já foi o
   contrário — fundo verde-escuro na folha inteira —, e ali verde-claro sobre
   verde não destacava, por maior que fosse o corpo: o número disputava com o
   mapa e com o próprio fundo. Agora só a placa é escura, o mapa ganha o
   contraste do papel, e o destaque sai no verde da marca. */
.rv-cover .rv-stats{display:flex;align-items:stretch;background:#102f3b;border:0;border-radius:10px;padding:20px 0;margin-bottom:13px}.rv-cover .rv-stats>div{flex:1;min-width:0;padding:0 20px;border-left:1px solid #2f545c;display:flex;flex-direction:column;justify-content:center}.rv-cover .rv-stats>div:first-child{border-left:0}.rv-cover .rv-stats b{display:block;font:700 24px/1.1 Arial;letter-spacing:-.7px;color:#fff;white-space:nowrap}.rv-cover .rv-stats span{display:block;font:10px/1.45 Arial;color:#c3d6ce;margin-top:8px}.rv-cover .rv-stats .rv-destaque{flex:1.7}.rv-cover .rv-stats .rv-destaque b{font-size:40px;color:#74e3b4;letter-spacing:-1.3px}.rv-cover .rv-stats .rv-destaque span{color:#cfeadc;font-size:10.5px}.rv-cover .rv-note{font:10px/1.5 Arial;color:#48605a;margin:12px 0;max-width:100%}.rv-cover .rv-meta{font:8px/1.6 Arial;color:#6a827a;margin-top:15px}.rv-cover .rv-signature{border-top:1px solid #d0dbd2;margin-top:18px;padding-top:10px;font:7px Arial;letter-spacing:1px;color:#7d9189}
`;
