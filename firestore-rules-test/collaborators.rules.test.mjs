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

test('admin do grupo edita colaborador do proprio grupo', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaborators/c6'), {
      groupId: 'grupo-1', fullName: 'X', deletedAt: null,
    });
  });
  const db = ctx('u1', 'grupo-1', 'admin');
  const { updateDoc } = await import('firebase/firestore');
  await assertSucceeds(updateDoc(doc(db, 'collaborators/c6'), {
    fullName: 'Y', groupId: 'grupo-1',
  }));
});

test('membro comum nao edita colaborador', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaborators/c7'), {
      groupId: 'grupo-1', fullName: 'X', deletedAt: null,
    });
  });
  const db = ctx('u2', 'grupo-1', 'member');
  const { updateDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(db, 'collaborators/c7'), {
    fullName: 'Y', groupId: 'grupo-1',
  }));
});

test('admin nao sequestra colaborador mudando o groupId', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaborators/c8'), {
      groupId: 'grupo-1', fullName: 'X', deletedAt: null,
    });
  });
  const db = ctx('u1', 'grupo-1', 'admin');
  const { updateDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(db, 'collaborators/c8'), {
    groupId: 'grupo-2',
  }));
});

test('admin de outro grupo nao edita colaborador alheio', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'collaborators/c9'), {
      groupId: 'grupo-1', fullName: 'X', deletedAt: null,
    });
  });
  const db = ctx('u3', 'grupo-2', 'admin');
  const { updateDoc } = await import('firebase/firestore');
  await assertFails(updateDoc(doc(db, 'collaborators/c9'), {
    fullName: 'Y', groupId: 'grupo-1',
  }));
});
