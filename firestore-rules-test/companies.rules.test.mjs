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

async function seedCompany(id, groupId) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), `companies/${id}`),
      { groupId, tradingName: 'X', deletedAt: null });
  });
}

test('membro do grupo lê empresa do próprio grupo', async () => {
  await seedCompany('c1', 'g1');
  await assertSucceeds(getDoc(doc(ctx('u', member), 'companies/c1')));
});

test('não lê empresa de outro grupo', async () => {
  await seedCompany('c1', 'g1');
  await assertFails(getDoc(doc(ctx('u', other), 'companies/c1')));
});

test('admin cria empresa no próprio grupo', async () => {
  await assertSucceeds(setDoc(doc(ctx('u', admin), 'companies/c2'),
    { groupId: 'g1', tradingName: 'Nova', deletedAt: null }));
});

test('membro comum NÃO cria empresa', async () => {
  await assertFails(setDoc(doc(ctx('u', member), 'companies/c3'),
    { groupId: 'g1', tradingName: 'Nova', deletedAt: null }));
});

test('não cria empresa em outro grupo (hijack)', async () => {
  await assertFails(setDoc(doc(ctx('u', admin), 'companies/c4'),
    { groupId: 'g2', tradingName: 'Nova', deletedAt: null }));
});

test('delete real é sempre negado', async () => {
  await seedCompany('c1', 'g1');
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(ctx('u', admin), 'companies/c1')));
});
