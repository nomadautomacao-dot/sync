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

async function seedSettings(groupId) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), `workspace_settings/${groupId}`),
      { groupId, groupName: 'X' });
  });
}

test('membro do grupo lê as próprias settings (doc id = groupId)', async () => {
  await seedSettings('g1');
  await assertSucceeds(getDoc(doc(ctx('u', member), 'workspace_settings/g1')));
});

test('não lê settings de outro grupo', async () => {
  await seedSettings('g1');
  await assertFails(getDoc(doc(ctx('u', other), 'workspace_settings/g1')));
});

test('admin cria settings do próprio grupo', async () => {
  await assertSucceeds(setDoc(doc(ctx('u', admin), 'workspace_settings/g1'),
    { groupId: 'g1', groupName: 'Nova' }));
});

test('membro comum NÃO cria settings', async () => {
  await assertFails(setDoc(doc(ctx('u', member), 'workspace_settings/g1'),
    { groupId: 'g1', groupName: 'Nova' }));
});

test('não cria settings em outro grupo (hijack pelo id do doc)', async () => {
  await assertFails(setDoc(doc(ctx('u', admin), 'workspace_settings/g2'),
    { groupId: 'g2', groupName: 'Nova' }));
});

test('delete real é sempre negado', async () => {
  await seedSettings('g1');
  const { deleteDoc } = await import('firebase/firestore');
  await assertFails(deleteDoc(doc(ctx('u', admin), 'workspace_settings/g1')));
});

test('admin edita settings do próprio grupo', async () => {
  await seedSettings('g1');
  const { updateDoc } = await import('firebase/firestore');
  await assertSucceeds(updateDoc(doc(ctx('u', admin), 'workspace_settings/g1'), {
    groupName: 'Y', groupId: 'g1',
  }));
});

test('membro comum NÃO edita settings', async () => {
  await seedSettings('g1');
  const { updateDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(ctx('u', member), 'workspace_settings/g1'), {
    groupName: 'Y', groupId: 'g1',
  }));
});

test('admin não sequestra settings mudando o groupId do dado (update hijack)', async () => {
  await seedSettings('g1');
  const { updateDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(ctx('u', admin), 'workspace_settings/g1'), {
    groupId: 'g2',
  }));
});
