/** Coleta pública sob demanda ou por um agendador externo. Não agenda tarefas nem altera registros de execução da equipe. */
import { mkdir, writeFile } from 'node:fs/promises';
import { buildRelatorioSnapshot } from '../../core/lib/relatorio-snapshot';

async function main() {
  const codigo = process.argv[2], ano = Number(process.argv[3] ?? new Date().getFullYear());
  if (!/^\d{7}$/.test(codigo ?? '') || !Number.isInteger(ano) || ano < 2022 || ano > 2100) throw new Error('Uso: npm run fundeb:monitorar -- CODIGO_IBGE ANO');
  const snapshot = await buildRelatorioSnapshot({ codigo_ibge: codigo, exercicio: ano }, true);
  const dir = 'output/dados'; await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/MONITORAMENTO_${codigo}_${ano}.json`, JSON.stringify(snapshot.inteligencia?.monitoramento, null, 2));
  console.log(JSON.stringify({ codigo, ano, snapshot: snapshot.qualidade.snapshotId, mudancas: snapshot.inteligencia?.monitoramento.mudancas.length, coberturaFinanceira: snapshot.inteligencia?.financeiro.atual.estado, alertas: snapshot.qualidade.achados }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
