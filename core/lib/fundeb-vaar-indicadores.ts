import JSZip from 'jszip';
import { baixarFonte, type FonteColetada } from './public-data-fetch';

type Celula = string | number | null;
export interface ComponenteVaar {
  tipo: 'condicionalidadeIII' | 'atendimento' | 'aprendizagem';
  estado: 'disponivel' | 'indisponivel' | 'falha_consulta';
  fonte: FonteColetada | null; campos: Record<string, Celula>;
  motivo: string | null; aviso: string | null;
}
export interface IndicadoresVaar { exercicio: number; pagina: string; componentes: ComponenteVaar[] }
const xmlText = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Lê apenas valores publicados, inclusive strings compartilhadas. Não avalia fórmulas. */
export async function lerRegistroVaar(bytes: Buffer, codigo: string, ano: number): Promise<Record<string, Celula> | null> {
  const zip = await JSZip.loadAsync(bytes);
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string') ?? '';
  const shared = [...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t => xmlText(t[1])).join(''));
  for (const file of Object.keys(zip.files).filter(p => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))) {
    const sheet = await zip.files[file].async('string');
    let headers: Record<string, string> | null = null;
    for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const values: Record<string, Celula> = {};
      for (const match of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const column = match[1].match(/\br="([A-Z]+)\d+"/)?.[1];
        if (!column) continue;
        const type = match[1].match(/\bt="([^"]+)"/)?.[1], inner = match[2] ?? '';
        const v = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
        const inline = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => xmlText(m[1])).join('');
        values[column] = type === 's' ? shared[Number(v)] ?? null : type === 'inlineStr' ? inline : v == null || v === '' ? null : type === 'str' ? xmlText(v) : Number.isFinite(Number(v)) ? Number(v) : xmlText(v);
      }
      if (Object.values(values).some(v => typeof v === 'string' && /^(codigo_ente|codigo_do_ente|id_ente)$/i.test(v))) {
        headers = Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v === 'string').map(([c, v]) => [c, String(v)]));
      } else if (headers) {
        const idColumn = Object.keys(headers).find(c => /^(codigo_ente|codigo_do_ente|id_ente)$/i.test(headers![c]));
        if (!idColumn || String(values[idColumn]) !== codigo) continue;
        const record = Object.fromEntries(Object.entries(headers).map(([col, name]) => [name, values[col] ?? null]));
        if (Number(record.Competencia ?? record.ano_fundeb) !== ano) throw new Error('Competência VAAR diferente da solicitada.');
        return record;
      }
    }
  }
  return null;
}

export async function coletarIndicadoresVaar(codigo: string, ano: number, atualizar = false): Promise<IndicadoresVaar> {
  const pagina = `https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/fundeb/bases-de-dados/indicadores-da-complementacao-vaar/${ano}`;
  const tipos = ['condicionalidadeIII', 'atendimento', 'aprendizagem'] as const;
  let urls: string[] = [];
  try {
    const { bytes } = await baixarFonte(pagina, atualizar);
    urls = [...bytes.toString('utf8').matchAll(/href="([^"]+\.xlsx)"/gi)].map(m => new URL(m[1].replace(/&amp;/g, '&'), pagina).href);
  } catch { return { exercicio: ano, pagina, componentes: tipos.map(tipo => ({ tipo, estado: 'falha_consulta', fonte: null, campos: {}, motivo: null, aviso: 'Página anual dos indicadores indisponível. Nenhuma base de outro exercício foi substituída.' })) }; }
  const componentes = await Promise.all(tipos.map(async (tipo): Promise<ComponenteVaar> => {
    const match = tipo === 'condicionalidadeIII' ? /condicionalidade_III/i : new RegExp(`vaar_${tipo}`, 'i');
    const url = urls.filter(u => match.test(u)).at(-1);
    if (!url) return { tipo, estado: 'indisponivel', fonte: null, campos: {}, motivo: null, aviso: 'Arquivo não identificado na publicação anual.' };
    try {
      const { bytes, fonte } = await baixarFonte(url, atualizar);
      const campos = await lerRegistroVaar(bytes, codigo, ano);
      return { tipo, estado: campos ? 'disponivel' : 'indisponivel', fonte, campos: campos ?? {}, motivo: campos ? String(campos.Motivo ?? campos.motivo_recebimento_ou_nao ?? '') || null : null, aviso: campos ? null : 'Código municipal ou cabeçalho não identificado na planilha; validar o leiaute.' };
    } catch { return { tipo, estado: 'falha_consulta', fonte: null, campos: {}, motivo: null, aviso: 'Falha ao consultar ou interpretar a planilha. Não inferir resultado zero.' }; }
  }));
  return { exercicio: ano, pagina, componentes };
}
