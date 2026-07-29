import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'globalconsultorias',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => { await env.cleanup(); });

function ctx(uid, groupId, role = 'member') {
  return env.authenticatedContext(uid, { groupId, groupRole: role }).firestore();
}

const validReport = {
  groupId: 'grupo-1',
  cityId: 'cidade-1',
  cityName: 'Cristalina',
  cityUf: 'GO',
  codigoIbge: '5206206',
  title: 'Diagnóstico FUNDEB',
  type: 'diagnostico_fundeb',
  exercise: 2026,
  generationId: 'geracao-123',
  snapshot: {
    schemaVersion: 3,
    generation: { generationId: 'geracao-123' },
  },
  snapshotBytes: 256,
};

test('membro cria e le relatorio do proprio grupo', async () => {
  const db = ctx('u1', 'grupo-1');
  await assertSucceeds(setDoc(doc(db, 'cityReports/r1'), validReport));
  await assertSucceeds(getDoc(doc(db, 'cityReports/r1')));
});

test('usuario nao cria nem le relatorio de outro grupo', async () => {
  const db = ctx('u2', 'grupo-2');
  await assertFails(setDoc(doc(db, 'cityReports/r2'), validReport));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'cityReports/r3'), validReport);
  });
  await assertFails(getDoc(doc(db, 'cityReports/r3')));
});

test('relatorio salvo e imutavel', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'cityReports/r4'), validReport);
  });
  const db = ctx('u1', 'grupo-1');
  await assertFails(updateDoc(doc(db, 'cityReports/r4'), { title: 'Alterado' }));
});

test('aceita o tipo historico_censo e recusa tipo desconhecido', async () => {
  const db = ctx('u1', 'grupo-1');
  await assertSucceeds(
    setDoc(doc(db, 'cityReports/r-historico'), {
      ...validReport,
      type: 'historico_censo',
      title: 'Histórico do Censo Escolar',
    }),
  );
  await assertFails(
    setDoc(doc(db, 'cityReports/r-tipo-invalido'), {
      ...validReport,
      type: 'relatorio_inventado',
    }),
  );
});

test('nao cria relatorio sem o JSON da geracao', async () => {
  const db = ctx('u1', 'grupo-1');
  const { snapshot, snapshotBytes, generationId, ...withoutJson } = validReport;
  void snapshot;
  void snapshotBytes;
  void generationId;
  await assertFails(setDoc(doc(db, 'cityReports/r-sem-json'), withoutJson));
});

test('somente admin exclui relatorio', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'cityReports/r5'), validReport);
    await setDoc(doc(context.firestore(), 'cityReports/r6'), validReport);
  });
  await assertFails(deleteDoc(doc(ctx('u1', 'grupo-1'), 'cityReports/r5')));
  await assertSucceeds(deleteDoc(doc(ctx('admin', 'grupo-1', 'admin'), 'cityReports/r6')));
});
