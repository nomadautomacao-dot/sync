import { readdir, stat, readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hashDados } from './public-data-fetch';
import type { RelatorioSnapshot } from './relatorio-snapshot';
import { coletarExecucaoFundeb } from './fundeb-execucao';
import { coletarIndicadoresVaar } from './fundeb-vaar-indicadores';
import { montarInteligencia, type MonitoramentoRelatorio } from './relatorio-inteligencia';

/** Todas as bases locais invalidam a coleta, inclusive ano-base e dados escolares.
 * Fingerprint de arquivo (caminho, tamanho e modificação); fontes baixadas têm SHA-256 do conteúdo. */
export async function assinaturaBasesLocais(): Promise<string> {
  const base = join(process.cwd(), 'data');
  const paths = await readdir(base, { recursive: true });
  const inventory = await Promise.all(paths.filter(p => /\.(json|csv)$/.test(p) && !p.includes('revisoes/') && !p.includes('monitoramento/') && !p.includes('govia-municipios-store')).sort().map(async p => { const s = await stat(join(base, p)); return [p, s.size, s.mtimeMs]; }));
  return hashDados(JSON.stringify(inventory));
}

export async function enriquecerSnapshot(snapshot: RelatorioSnapshot, atualizar = false): Promise<RelatorioSnapshot> {
  const { codigoIBGE, exercicio } = snapshot.current.relatorio.identificacao;
  if (!/^\d{7}$/.test(String(codigoIBGE))) throw new Error('Código municipal inválido para enriquecimento.');
  const [financeiro, vaar] = await Promise.all([
    coletarExecucaoFundeb(String(codigoIBGE), exercicio, snapshot.current.relatorio.receitas.totalReceitas, atualizar),
    coletarIndicadoresVaar(String(codigoIBGE), exercicio, atualizar),
  ]);
  const dir = join(process.cwd(), '.cache', 'monitoramento-relatorios', String(codigoIBGE));
  const path = join(dir, `${exercicio}.json`);
  let anterior: MonitoramentoRelatorio | null = null;
  try { anterior = JSON.parse(await readFile(path, 'utf8')); } catch { /* Primeira coleta. */ }
  snapshot.inteligencia = montarInteligencia(snapshot, financeiro, vaar, anterior);
  // As observações de origem determinam a identidade; gerar um PDF não muda a evidência.
  snapshot.qualidade.snapshotId = hashDados(JSON.stringify({ original: snapshot.qualidade.snapshotId, fontes: snapshot.inteligencia.monitoramento.fontes.map(f => f.sha256), observacoes: snapshot.inteligencia.monitoramento.observacoes })).slice(0, 16);
  await mkdir(dir, { recursive: true });
  if (anterior) {
    const history = join(dir, `${exercicio}-${hashDados(JSON.stringify(anterior.observacoes)).slice(0, 16)}.json`);
    await writeFile(history, JSON.stringify(anterior));
  }
  const temp = path + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(snapshot.inteligencia.monitoramento));
  await rename(temp, path);
  return snapshot;
}
