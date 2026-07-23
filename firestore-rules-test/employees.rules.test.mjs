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

async function seedEmployee(id, groupId, companyId = 'c1') {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), `employees/${id}`),
      { groupId, companyId, name: 'X', deletedAt: null });
  });
}

test('membro do grupo lê funcionário do próprio grupo', async () => {
  await seedEmployee('e1', 'g1');
  await assertSucceeds(getDoc(doc(ctx('u', member), 'employees/e1')));
});

test('não lê funcionário de outro grupo', async () => {
  await seedEmployee('e1', 'g1');
  await assertFails(getDoc(doc(ctx('u', other), 'employees/e1')));
});

test('admin cria funcionário no próprio grupo', async () => {
  await assertSucceeds(setDoc(doc(ctx('u', admin), 'employees/e2'),
    { groupId: 'g1', companyId: 'c1', name: 'Novo', deletedAt: null }));
});

test('membro comum NÃO cria funcionário', async () => {
  await assertFails(setDoc(doc(ctx('u', member), 'employees/e3'),
    { groupId: 'g1', companyId: 'c1', name: 'Novo', deletedAt: null }));
});

test('não cria funcionário em outro grupo (hijack)', async () => {
  await assertFails(setDoc(doc(ctx('u', admin), 'employees/e4'),
    { groupId: 'g2', companyId: 'c1', name: 'Novo', deletedAt: null }));
});

test('delete real é sempre negado', async () => {
  await seedEmployee('e1', 'g1');
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(ctx('u', admin), 'employees/e1')));
});

test('admin edita funcionário do próprio grupo', async () => {
  await seedEmployee('e1', 'g1');
  const { updateDoc } = await import('firebase/firestore');
  await assertSucceeds(updateDoc(doc(ctx('u', admin), 'employees/e1'), {
    name: 'Y', groupId: 'g1',
  }));
});

test('admin não sequestra funcionário mudando o groupId (update hijack)', async () => {
  await seedEmployee('e1', 'g1');
  const { updateDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(ctx('u', admin), 'employees/e1'), {
    groupId: 'g2',
  }));
});
