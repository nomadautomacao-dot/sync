import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const curl = promisify(execFile);
const HOSTS = new Set(['www.gov.br', 'download.inep.gov.br', 'www.fnde.gov.br', 'apidatalake.tesouro.gov.br']);
export const hashDados = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export interface FonteColetada { url: string; coletadoEm: string; sha256: string }

/** Somente fontes públicas conhecidas. Nunca desabilita a validação TLS. */
export async function baixarFonte(url: string, atualizar = false): Promise<{ bytes: Buffer; fonte: FonteColetada }> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !HOSTS.has(parsed.hostname)) throw new Error('Fonte pública fora da lista permitida.');
  const dir = join(process.cwd(), '.cache', 'fontes-publicas');
  const key = hashDados(url), file = join(dir, key + '.json');
  if (!atualizar) try {
    const cached = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - Date.parse(cached.fonte.coletadoEm) < 6 * 3600_000) {
      const bytes = Buffer.from(cached.base64, 'base64');
      if (hashDados(bytes) === cached.fonte.sha256) return { bytes, fonte: cached.fonte };
    }
  } catch { /* Ausência de cache exige consulta. */ }
  let bytes: Buffer;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    // O curl usa a cadeia de certificados do sistema em instalações desktop.
    // Ambos os caminhos validam TLS; não há fallback para HTTP.
    try {
      const result = await curl('curl', ['--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--proto-redir', '=https', '--max-time', '35', url], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
      bytes = result.stdout;
    } catch { throw error; }
  }
  const fonte = { url, coletadoEm: new Date().toISOString(), sha256: hashDados(bytes) };
  await mkdir(dir, { recursive: true });
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify({ fonte, base64: bytes.toString('base64') }));
  await rename(temp, file);
  return { bytes, fonte };
}

export async function consultarLista<T>(url: string, atualizar = false): Promise<{ itens: T[]; fontes: FonteColetada[] }> {
  const itens: T[] = [], fontes: FonteColetada[] = [], visitados = new Set<string>();
  let proxima: string | undefined = url;
  for (let page = 0; proxima && page < 100; page++) {
    if (visitados.has(proxima)) throw new Error('Paginação circular da fonte.');
    visitados.add(proxima);
    const { bytes, fonte } = await baixarFonte(proxima, atualizar);
    const body = JSON.parse(bytes.toString('utf8'));
    const records = body.items ?? body.value;
    if (!Array.isArray(records)) throw new Error('Resposta sem lista de registros.');
    itens.push(...records); fontes.push(fonte);
    const next = body['@odata.nextLink'] ?? body.links?.find((l: { rel: string }) => l.rel === 'next')?.href;
    if (body.hasMore && !next) throw new Error('Fonte truncada: paginação sem próximo endereço.');
    proxima = next ? new URL(next, proxima).href : undefined;
  }
  if (proxima) throw new Error('Limite de paginação excedido; resultado não utilizado.');
  return { itens, fontes };
}
