import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds }
  from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { after, before, beforeEach, test } from 'node:test';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'sync-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

function ctx(uid, claims) {
  return env.authenticatedContext(uid, claims).firestore();
}
const admin = { groupId: 'g1', groupRole: 'owner' };
const member = { groupId: 'g1', groupRole: 'member' };
const other = { groupId: 'g2', groupRole: 'owner' };

async function seedCity(id, groupId) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), `cities/${id}`),
      { groupId, name: 'X', deletedAt: null });
  });
}

test('membro do grupo lê cidade do próprio grupo', async () => {
  await seedCity('c1', 'g1');
  await assertSucceeds(getDoc(doc(ctx('u', member), 'cities/c1')));
});

test('não lê cidade de outro grupo', async () => {
  await seedCity('c1', 'g1');
  await assertFails(getDoc(doc(ctx('u', other), 'cities/c1')));
});

test('admin cria cidade no próprio grupo', async () => {
  await assertSucceeds(setDoc(doc(ctx('u', admin), 'cities/c2'),
    { groupId: 'g1', name: 'Nova', deletedAt: null }));
});

test('membro comum NÃO cria cidade', async () => {
  await assertFails(setDoc(doc(ctx('u', member), 'cities/c3'),
    { groupId: 'g1', name: 'Nova', deletedAt: null }));
});

test('não cria cidade em outro grupo (hijack)', async () => {
  await assertFails(setDoc(doc(ctx('u', admin), 'cities/c4'),
    { groupId: 'g2', name: 'Nova', deletedAt: null }));
});

test('delete real é sempre negado', async () => {
  await seedCity('c1', 'g1');
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(ctx('u', admin), 'cities/c1')));
});

test('admin edita cidade do próprio grupo', async () => {
  await seedCity('c1', 'g1');
  const { updateDoc } = await import('firebase/firestore');
  await assertSucceeds(updateDoc(doc(ctx('u', admin), 'cities/c1'), {
    name: 'Y', groupId: 'g1',
  }));
});

test('membro comum NÃO edita cidade', async () => {
  await seedCity('c1', 'g1');
  const { updateDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(ctx('u', member), 'cities/c1'), {
    name: 'Y', groupId: 'g1',
  }));
});

test('admin não sequestra cidade mudando o groupId (update hijack)', async () => {
  await seedCity('c1', 'g1');
  const { updateDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(ctx('u', admin), 'cities/c1'), {
    groupId: 'g2',
  }));
});
