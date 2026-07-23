import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds }
  from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp }
  from 'firebase/firestore';
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

async function seedAudit(id, groupId) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), `audit/${id}`),
      { groupId, action: 'x', createdAt: Timestamp.now() });
  });
}

test('membro do grupo lê audit do próprio grupo', async () => {
  await seedAudit('a1', 'g1');
  await assertSucceeds(getDoc(doc(ctx('u', member), 'audit/a1')));
});

test('não lê audit de outro grupo', async () => {
  await seedAudit('a1', 'g1');
  await assertFails(getDoc(doc(ctx('u', other), 'audit/a1')));
});

test('create de audit é sempre negado (mesmo para admin)', async () => {
  await assertFails(setDoc(doc(ctx('u', admin), 'audit/a2'),
    { groupId: 'g1', action: 'y', createdAt: Timestamp.now() }));
});

test('update de audit é sempre negado (mesmo para admin)', async () => {
  await seedAudit('a1', 'g1');
  await assertFails(updateDoc(doc(ctx('u', admin), 'audit/a1'), {
    action: 'z',
  }));
});

test('delete de audit é sempre negado (mesmo para admin)', async () => {
  await seedAudit('a1', 'g1');
  await assertFails(deleteDoc(doc(ctx('u', admin), 'audit/a1')));
});
