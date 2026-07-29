import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';

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

const validDocument = {
  groupId: 'grupo-1',
  cityId: 'cidade-1',
  cityName: 'Cristalina',
  cityUf: 'GO',
  title: 'Contrato 001/2026',
  storagePath: 'city-documents/grupo-1/cidade-1/contrato.pdf',
};

test('membro cria e le documento municipal do proprio grupo', async () => {
  const db = ctx('u1', 'grupo-1');
  await assertSucceeds(setDoc(doc(db, 'cityDocuments/d1'), validDocument));
  await assertSucceeds(getDoc(doc(db, 'cityDocuments/d1')));
});

test('usuario nao cria documento para outro grupo', async () => {
  const db = ctx('u2', 'grupo-2');
  await assertFails(setDoc(doc(db, 'cityDocuments/d2'), validDocument));
});

test('usuario nao le nem exclui documento de outro grupo', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'cityDocuments/d3'), validDocument);
  });
  const db = ctx('u2', 'grupo-2');
  await assertFails(getDoc(doc(db, 'cityDocuments/d3')));
  await assertFails(deleteDoc(doc(db, 'cityDocuments/d3')));
});

test('metadados sao imutaveis depois do upload', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'cityDocuments/d4'), validDocument);
  });
  const db = ctx('u1', 'grupo-1');
  await assertFails(updateDoc(doc(db, 'cityDocuments/d4'), { title: 'Alterado' }));
});

test('membro exclui documento do proprio grupo', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'cityDocuments/d5'), validDocument);
  });
  const db = ctx('u1', 'grupo-1');
  await assertSucceeds(deleteDoc(doc(db, 'cityDocuments/d5')));
});
