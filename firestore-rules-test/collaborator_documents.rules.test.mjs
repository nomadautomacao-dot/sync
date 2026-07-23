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

function ctx(uid, groupId, role) {
  return env.authenticatedContext(uid, { groupId, groupRole: role }).firestore();
}

// Documentos de colaborador nao restringem por role: qualquer usuario
// autenticado do grupo pode subir/excluir, igual a rota Next legada (so
// exigia getSessionUser()). Por isso os testes usam 'member', nao 'admin'.

test('membro comum le documento do proprio grupo', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaboratorDocuments/d1'), {
      groupId: 'grupo-1', collaboratorId: 'colab1', name: 'Contrato',
    });
  });
  const db = ctx('u1', 'grupo-1', 'member');
  await assertSucceeds(getDoc(doc(db, 'collaboratorDocuments/d1')));
});

test('usuario de outro grupo nao le documento alheio', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaboratorDocuments/d2'), {
      groupId: 'grupo-1', collaboratorId: 'colab1', name: 'Secreto',
    });
  });
  const outro = ctx('u2', 'grupo-2', 'member');
  await assertFails(getDoc(doc(outro, 'collaboratorDocuments/d2')));
});

test('membro comum cria documento do proprio grupo', async () => {
  const db = ctx('u1', 'grupo-1', 'member');
  await assertSucceeds(setDoc(doc(db, 'collaboratorDocuments/d3'), {
    groupId: 'grupo-1', collaboratorId: 'colab1', name: 'RG',
  }));
});

test('membro nao cria documento sequestrando outro grupo (hijack)', async () => {
  const db = ctx('u1', 'grupo-1', 'member');
  await assertFails(setDoc(doc(db, 'collaboratorDocuments/d4'), {
    groupId: 'grupo-2', collaboratorId: 'colab1', name: 'RG',
  }));
});

test('membro comum exclui documento do proprio grupo (hard delete)', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaboratorDocuments/d5'), {
      groupId: 'grupo-1', collaboratorId: 'colab1', name: 'X',
    });
  });
  const db = ctx('u1', 'grupo-1', 'member');
  await assertSucceeds(deleteDoc(doc(db, 'collaboratorDocuments/d5')));
});

test('usuario de outro grupo nao exclui documento alheio (hijack)', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaboratorDocuments/d6'), {
      groupId: 'grupo-1', collaboratorId: 'colab1', name: 'X',
    });
  });
  const outro = ctx('u2', 'grupo-2', 'member');
  await assertFails(deleteDoc(doc(outro, 'collaboratorDocuments/d6')));
});

test('update e sempre negado (metadado imutavel apos criado)', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaboratorDocuments/d7'), {
      groupId: 'grupo-1', collaboratorId: 'colab1', name: 'X',
    });
  });
  const db = ctx('u1', 'grupo-1', 'member');
  await assertFails(updateDoc(doc(db, 'collaboratorDocuments/d7'), {
    name: 'Y',
  }));
});
