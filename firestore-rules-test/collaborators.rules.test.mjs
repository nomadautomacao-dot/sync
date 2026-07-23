import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, doc } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'globalconsultorias',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
});

after(async () => { await env.cleanup(); });

function ctx(uid, groupId, role) {
  return env.authenticatedContext(uid, { groupId, groupRole: role }).firestore();
}

test('admin do grupo cria colaborador do proprio grupo', async () => {
  const db = ctx('u1', 'grupo-1', 'admin');
  await assertSucceeds(setDoc(doc(db, 'collaborators/c1'), {
    groupId: 'grupo-1', fullName: 'X', deletedAt: null,
  }));
});

test('membro comum nao cria colaborador', async () => {
  const db = ctx('u2', 'grupo-1', 'member');
  await assertFails(setDoc(doc(db, 'collaborators/c2'), {
    groupId: 'grupo-1', fullName: 'X', deletedAt: null,
  }));
});

test('admin nao cria colaborador em outro grupo', async () => {
  const db = ctx('u1', 'grupo-1', 'admin');
  await assertFails(setDoc(doc(db, 'collaborators/c3'), {
    groupId: 'grupo-2', fullName: 'X', deletedAt: null,
  }));
});

test('usuario de outro grupo nao le colaborador alheio', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaborators/c4'), {
      groupId: 'grupo-1', fullName: 'Secreto', deletedAt: null,
    });
  });
  const outro = ctx('u3', 'grupo-2', 'admin');
  await assertFails(getDoc(doc(outro, 'collaborators/c4')));
});

test('delete real e sempre negado (soft delete only)', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaborators/c5'), {
      groupId: 'grupo-1', fullName: 'X', deletedAt: null,
    });
  });
  const db = ctx('u1', 'grupo-1', 'admin');
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(db, 'collaborators/c5')));
});
