#!/usr/bin/env node
/**
 * Leva as credenciais do `.env.local` para o arquivo que o app desktop lê.
 *
 * ## Por que existe
 *
 * O app procura as credenciais num arquivo fora do pacote — ver
 * `desktop/ambiente.js` para o porquê. Na primeira abertura esse arquivo está
 * em branco, e o app mostra a tela "Faltam credenciais". Não é defeito: é a
 * recusa deliberada de subir sem o que verifica o login.
 *
 * Preencher à mão é onde as coisas dão errado. A service account tem mais de
 * 2 mil caracteres numa linha só, com `\n` escapados dentro da chave privada;
 * um editor que quebre linha ou "conserte" as aspas produz um JSON inválido, e
 * o sintoma aparece longe da causa — o app sobe e toda rota responde 401.
 *
 * É o mesmo cuidado que `scripts/deploy/aplicar-credenciais.sh` teve de tomar
 * para levar as mesmas chaves ao Cloud Run.
 *
 * ## O que ele não faz
 *
 * Não imprime valor nenhum. A saída diz quais chaves entraram e com quantos
 * caracteres — o suficiente para conferir que nada chegou truncado, e nada além
 * disso. Log é lugar de onde a informação não sai mais.
 *
 * ## Uso
 *
 *     node scripts/desktop/credenciais-locais.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORIGEM = path.join(RAIZ, ".env.local");

/**
 * O mesmo caminho que o `app.getPath("userData")` do Electron devolve, e o
 * mesmo que `desktop/ambiente.js` vai ler. Este script roda como Node puro,
 * sem Electron carregado, então a regra é reproduzida aqui — e ela é fixa:
 * é o nome passado a `app.setName("Global Sync")` dentro da pasta de dados de
 * aplicativo de cada sistema.
 */
function pastaDoApp() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Global Sync");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Global Sync");
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "Global Sync");
}

const DESTINO = path.join(pastaDoApp(), "credenciais.env");

const CHAVES = [
  { nome: "FIREBASE_SERVICE_ACCOUNT", obrigatoria: true, json: true },
  { nome: "PORTAL_TRANSPARENCIA_TOKEN", obrigatoria: false },
  { nome: "QEDU_TOKEN", obrigatoria: false },
  { nome: "OPENROUTER_API_KEY", obrigatoria: false },
];

/**
 * Parser mínimo de propósito: `CHAVE=valor`, aspas das pontas removidas, e
 * nada mais. Sem expansão de `${}` e sem interpretar escape — qualquer
 * esperteza aqui quebraria os `\n` literais da chave privada.
 */
function lerEnv(arquivo) {
  const valores = {};
  if (!fs.existsSync(arquivo)) return valores;
  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    if (linha.trimStart().startsWith("#")) continue;
    const corte = linha.indexOf("=");
    if (corte < 1) continue;
    const chave = linha.slice(0, corte).trim();
    let valor = linha.slice(corte + 1).trim();
    if (valor.length >= 2 && valor[0] === valor[valor.length - 1] && (valor[0] === '"' || valor[0] === "'")) {
      valor = valor.slice(1, -1);
    }
    valores[chave] = valor;
  }
  return valores;
}

if (!fs.existsSync(ORIGEM)) {
  console.error(`erro: ${ORIGEM} não existe.`);
  process.exit(1);
}

const origem = lerEnv(ORIGEM);
// O que já estava no destino é preservado: se você preencheu uma chave à mão
// que não existe no `.env.local`, ela não deve sumir por causa desta cópia.
const destino = lerEnv(DESTINO);

const entraram = [];
const faltando = [];

for (const { nome, obrigatoria, json } of CHAVES) {
  const valor = origem[nome];
  if (!valor) {
    if (!destino[nome]) faltando.push({ nome, obrigatoria });
    continue;
  }
  // Falhar aqui é muito melhor que 401 depois: JSON truncado sobe normalmente e
  // só quebra no primeiro login.
  if (json) {
    try {
      JSON.parse(valor);
    } catch {
      console.error(`erro: ${nome} não é um JSON válido no .env.local. Nada foi escrito.`);
      process.exit(1);
    }
  }
  destino[nome] = valor;
  entraram.push({ nome, tamanho: valor.length });
}

const corpo = [
  "# Credenciais do Global Sync — geradas a partir do .env.local do repositório",
  "# por `node scripts/desktop/credenciais-locais.mjs`.",
  "#",
  "# Este arquivo fica fora do aplicativo de propósito: atualizar uma chave não",
  "# exige reinstalar, e o instalador não carrega segredo de ninguém.",
  "",
  ...Object.entries(destino).map(([chave, valor]) => `${chave}=${valor}`),
  "",
].join("\n");

fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
// `mode` é ignorado no Windows, e ali a proteção vem de onde o arquivo está:
// `%APPDATA%` fica dentro do perfil do usuário, cuja ACL já barra os outros.
fs.writeFileSync(DESTINO, corpo, { mode: 0o600 });

console.log(`Escrito em ${DESTINO.replace(os.homedir(), "~")}\n`);
for (const { nome, tamanho } of entraram) console.log(`  ${nome} — ${tamanho} caracteres`);
for (const { nome, obrigatoria } of faltando) {
  console.log(`  ${nome} — AUSENTE${obrigatoria ? " (obrigatória: o app não vai abrir)" : " (opcional)"}`);
}
console.log(
  faltando.some((f) => f.obrigatoria)
    ? "\nPreencha a obrigatória no .env.local e rode de novo."
    : "\nFeche o Global Sync e abra de novo.",
);
