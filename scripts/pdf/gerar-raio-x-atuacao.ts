import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildRelatorioSnapshot, type RelatorioSnapshot } from '../../core/lib/relatorio-snapshot';
import { montarRaioXAtuacao } from '../../core/lib/raio-x-atuacao';
import { generateRaioXAtuacaoPdf } from '../../core/lib/raio-x-atuacao-pdf';

async function main() {
  const args = process.argv.slice(2);
  const codigo = args[0] ?? '2304400', exercicio = Number(args[1] ?? new Date().getFullYear());
  if (!/^\d{7}$/.test(codigo) || !Number.isInteger(exercicio) || exercicio < 2022 || exercicio > 2100) throw new Error('Uso: tsx scripts/pdf/gerar-raio-x-atuacao.ts IBGE ANO [--snapshot arquivo.json]');
  const index = args.indexOf('--snapshot');
  if (index >= 0 && !args[index + 1]) throw new Error('Informe o arquivo após --snapshot.');
  const snapshot: RelatorioSnapshot = index >= 0
    ? JSON.parse(await readFile(args[index + 1], 'utf8'))
    : await buildRelatorioSnapshot({ codigo_ibge: codigo, exercicio });
  if (String(snapshot.current.relatorio.identificacao.codigoIBGE) !== codigo || snapshot.current.relatorio.identificacao.exercicio !== exercicio) throw new Error('Snapshot de outro município ou exercício.');
  const model = montarRaioXAtuacao(snapshot);
  const result = await generateRaioXAtuacaoPdf(model);
  await mkdir('output/pdf', { recursive: true });
  await mkdir('tmp/pdfs/raio-x-atuacao', { recursive: true });
  const destino = join('output/pdf', result.filename);
  await writeFile(destino, result.pdfBuffer);
  await writeFile(destino.replace(/\.pdf$/, '.json'), JSON.stringify(model, null, 2));
  await writeFile(join('tmp/pdfs/raio-x-atuacao', result.filename.replace(/\.pdf$/, '.html')), result.html);
  console.log(JSON.stringify({ arquivo: destino, paginas: result.paginas, acoes: model.acoes.length, snapshot: model.snapshotId, coletadoEm: model.coletadoEm }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
