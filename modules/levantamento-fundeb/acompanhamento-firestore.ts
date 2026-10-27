'use client';
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, type Firestore } from 'firebase/firestore';
import { acompanhamentoSchema, type RegistroAcao } from './acompanhamento';

export async function listarAcoes(db: Firestore, groupId: string, codigoIbge: string, exercicio: number): Promise<RegistroAcao[]> {
  const response = await getDocs(query(collection(db, 'fundebActions'), where('groupId', '==', groupId)));
  return response.docs.map(d => ({ ...d.data(), id: d.id }) as RegistroAcao).filter(r => r.codigoIbge === codigoIbge && r.exercicio === exercicio);
}
export async function salvarAcao(db: Firestore, registro: Omit<RegistroAcao, 'id'>): Promise<void> {
  const acompanhamento = acompanhamentoSchema.parse(registro.acompanhamento);
  const id = [registro.groupId, registro.codigoIbge, registro.exercicio, registro.acaoId].map(encodeURIComponent).join('_');
  const ref = doc(db, 'fundebActions', id), evento = doc(collection(ref, 'historico'));
  await runTransaction(db, async tx => {
    const old = await tx.get(ref);
    const atual = old.exists() ? old.data() as RegistroAcao : null;
    if (atual && atual.groupId !== registro.groupId) throw new Error('Registro de outro grupo.');
    if ((atual?.revisao ?? 0) !== registro.revisao) throw new Error('Outra pessoa atualizou esta ação. Recarregue antes de salvar.');
    const payload = { ...registro, acompanhamento, revisao: registro.revisao + 1, snapshotId: atual?.snapshotId ?? registro.snapshotId, linhaBase: atual?.linhaBase ?? registro.linhaBase, atualizadoEm: serverTimestamp() };
    tx.set(ref, payload);
    tx.set(evento, { groupId: registro.groupId, atualizadoPor: registro.atualizadoPor, registradoEm: serverTimestamp(), revisao: payload.revisao, acompanhamento });
  });
}
