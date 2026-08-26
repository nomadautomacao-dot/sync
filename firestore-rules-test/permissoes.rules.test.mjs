import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { setDoc, updateDoc, doc } from 'firebase/firestore';

// Enforcement fino por area (roadmap multiusuario, fase 1). A claim `perm`
// carrega so os desvios do padrao do papel — ver claimsDeAcesso em
// core/lib/acessos.ts e a matriz em core/domain/rbac.ts.

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'globalconsultorias',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

function ctx(uid, claims) {
  return env.authenticatedContext(uid, claims).firestore();
}

const member = { groupId: 'g1', groupRole: 'member' };
const viewer = { groupId: 'g1', groupRole: 'viewer' };

const cidade = { groupId: 'g1', name: 'Nova', deletedAt: null };
const post = { groupId: 'g1', autorUid: 'u1', texto: 'Bom dia' };
const documento = {
  groupId: 'g1',
  cityId: 'c1',
  title: 'Contrato',
  storagePath: 'city-documents/g1/c1/contrato.pdf',
  createdBy: 'u1',
};
const colaborador = { groupId: 'g1', fullName: 'X', deletedAt: null };

test('member com cidades "ver" nao cria nem edita cidade', async () => {
  const db = ctx('u1', { ...member, perm: { cidades: 'ver' } });
  await assertFails(setDoc(doc(db, 'cities/c1'), cidade));
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'cities/c2'), cidade);
  });
  await assertFails(updateDoc(doc(db, 'cities/c2'), { name: 'Y' }));
});

test('member com cidades "editar" cria e edita cidade', async () => {
  const db = ctx('u1', { ...member, perm: { cidades: 'editar' } });
  await assertSucceeds(setDoc(doc(db, 'cities/c1'), cidade));
  await assertSucceeds(updateDoc(doc(db, 'cities/c1'), { name: 'Y' }));
});

test('member sem ajuste escreve em cidades (padrao do papel)', async () => {
  const db = ctx('u1', member);
  await assertSucceeds(setDoc(doc(db, 'cities/c1'), cidade));
});

test('viewer nao escreve em nada', async () => {
  const db = ctx('u1', viewer);
  await assertFails(setDoc(doc(db, 'cities/c1'), cidade));
  await assertFails(setDoc(doc(db, 'mural/p1'), post));
  await assertFails(setDoc(doc(db, 'cityDocuments/d1'), documento));
  await assertFails(setDoc(doc(db, 'collaborators/col1'), colaborador));
});

test('member sem ajuste nao escreve em pessoas; com ajuste, escreve', async () => {
  const semAjuste = ctx('u1', member);
  await assertFails(setDoc(doc(semAjuste, 'collaborators/col1'), colaborador));
  const comAjuste = ctx('u2', { ...member, perm: { pessoas: 'editar' } });
  await assertSucceeds(setDoc(doc(comAjuste, 'collaborators/col2'), colaborador));
});

test('member posta no mural; viewer nao', async () => {
  await assertSucceeds(setDoc(doc(ctx('u1', member), 'mural/p1'), post));
  await assertFails(setDoc(doc(ctx('u2', viewer), 'mural/p2'), post));
});

test('trava de ajustes segura ate ajuste explicito de editar', async () => {
  const db = ctx('u1', { ...member, perm: { ajustes: 'editar' } });
  await assertFails(
    setDoc(doc(db, 'workspace_settings/g1'), { groupId: 'g1', nome: 'X' }),
  );
});
