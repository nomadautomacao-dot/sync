import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

// Colecao `notifications` (roadmap multiusuario, fase 2): leitura das proprias
// e das do grupo, create com shape validado, update so do campo `lida` na
// propria notificacao, delete proibido. O carimbo de leitura das de grupo vive
// em workspace_settings/{groupId}/leituras/{uid} — cada pessoa so mexe no seu.

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
const outroGrupo = { groupId: 'g2', groupRole: 'member' };

function notificacao(extra = {}) {
  return {
    groupId: 'g1',
    destinatarioUid: 'u2',
    tipo: 'comentario_evento',
    titulo: 'Comentário no seu registro',
    lida: false,
    criadoEm: '2026-08-23T12:00:00.000Z',
    origemUid: 'u1',
    origemNome: 'Tais',
    ...extra,
  };
}

test('destinataria le a sua; a do grupo, todo mundo le; a de outro, nao', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'notifications/n1'), notificacao());
    await setDoc(doc(db, 'notifications/n2'), notificacao({ destinatarioUid: null }));
    await setDoc(doc(db, 'notifications/n3'), notificacao({ destinatarioUid: 'u9' }));
  });

  const db = ctx('u2', member);
  await assertSucceeds(getDocs(query(collection(db, 'notifications'),
    where('groupId', '==', 'g1'), where('destinatarioUid', 'in', ['u2', null]))));
  await assertFails(getDocs(query(collection(db, 'notifications'),
    where('groupId', '==', 'g1'), where('destinatarioUid', '==', 'u9'))));
});

test('membro cria notificacao com shape valido', async () => {
  const db = ctx('u1', member);
  await assertSucceeds(setDoc(doc(db, 'notifications/n1'), notificacao()));
  await assertSucceeds(setDoc(doc(db, 'notifications/n2'),
    notificacao({ destinatarioUid: null, tipo: 'pergunta_mural' })));
});

test('create exige grupo proprio, tipo conhecido e autoria real', async () => {
  const db = ctx('u1', member);
  await assertFails(setDoc(doc(db, 'notifications/n1'), notificacao({ groupId: 'g2' })));
  await assertFails(setDoc(doc(db, 'notifications/n1'), notificacao({ tipo: 'promocao' })));
  // Notificacao forjada em nome de outra pessoa nao passa.
  await assertFails(setDoc(doc(db, 'notifications/n1'), notificacao({ origemUid: 'u9' })));
  // Nascer lida nao faz sentido — e abriria brecha para aviso que nunca acende badge.
  await assertFails(setDoc(doc(db, 'notifications/n1'), notificacao({ lida: true })));
  await assertFails(setDoc(doc(db, 'notifications/n1'), notificacao({ titulo: '' })));
  await assertFails(setDoc(doc(db, 'notifications/n1'), notificacao({ extra: 'campo' })));
});

test('update so mexe em `lida`, e so na propria notificacao', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'notifications/n1'), notificacao());
    await setDoc(doc(db, 'notifications/n2'), notificacao({ destinatarioUid: null }));
  });

  const destinatario = ctx('u2', member);
  await assertSucceeds(updateDoc(doc(destinatario, 'notifications/n1'), { lida: true }));
  // Nao e so o campo que importa: mudar mais nada junto tambem falha.
  await assertFails(updateDoc(doc(destinatario, 'notifications/n1'), { titulo: 'Editado' }));
  await assertFails(updateDoc(doc(destinatario, 'notifications/n1'),
    { lida: false, titulo: 'Editado' }));
  // A notificacao de grupo e compartilhada: ninguem grava `lida` nela.
  await assertFails(updateDoc(doc(destinatario, 'notifications/n2'), { lida: true }));
  // E ninguem marca a notificacao de outra pessoa.
  const terceiro = ctx('u3', member);
  await assertFails(updateDoc(doc(terceiro, 'notifications/n1'), { lida: true }));
});

test('delete proibido para todo mundo', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'notifications/n1'), notificacao());
  });
  const admin = ctx('u0', { groupId: 'g1', groupRole: 'admin' });
  await assertFails(deleteDoc(doc(admin, 'notifications/n1')));
});

test('carimbo de leitura: cada pessoa so le e grava o seu, no proprio grupo', async () => {
  const db = ctx('u1', member);
  await assertSucceeds(setDoc(doc(db, 'workspace_settings/g1/leituras/u1'),
    { ultimaLeituraEm: '2026-08-23T12:00:00.000Z' }));
  await assertFails(setDoc(doc(db, 'workspace_settings/g1/leituras/u2'),
    { ultimaLeituraEm: '2026-08-23T12:00:00.000Z' }));
  await assertFails(setDoc(doc(db, 'workspace_settings/g2/leituras/u1'),
    { ultimaLeituraEm: '2026-08-23T12:00:00.000Z' }));
  await assertFails(setDoc(doc(db, 'workspace_settings/g1/leituras/u1'),
    { ultimaLeituraEm: '2026-08-23T12:00:00.000Z', outro: 1 }));

  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'workspace_settings/g1/leituras/u9'),
      { ultimaLeituraEm: '2026-08-23T10:00:00.000Z' });
  });
  await assertFails(getDocs(query(collection(db, 'workspace_settings/g1/leituras'))));

  const estranho = ctx('u9', outroGrupo);
  await assertFails(setDoc(doc(estranho, 'workspace_settings/g1/leituras/u9'),
    { ultimaLeituraEm: '2026-08-23T12:00:00.000Z' }));
});
