/**
 * A escolha de porta decide onde o app fica, e onde o app fica decide se a
 * sessão do Firebase sobrevive à próxima abertura — a origem do browser inclui
 * a porta. O caminho feliz se percebe abrindo o app; o de exceção, não: com a
 * porta preferida ocupada, um app que caísse de pé continuaria abrindo, só que
 * pedindo a senha de novo. É esse caminho que os testes seguram.
 */

import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { escolherPorta, tentarPorta, PORTA_PREFERIDA } from "./porta";

/** Servidores abertos pelo teste, fechados ao fim de cada caso. */
const abertos: net.Server[] = [];

function ocupar(porta: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer();
    abertos.push(servidor);
    servidor.on("error", reject);
    servidor.listen(porta, "127.0.0.1", () => resolve());
  });
}

afterEach(async () => {
  await Promise.all(
    abertos.splice(0).map((servidor) => new Promise((r) => servidor.close(() => r(null)))),
  );
});

describe("escolherPorta", () => {
  /**
   * A porta de teste é pedida ao sistema e devolvida — nunca a 51737 real.
   *
   * Com a constante, a suíte passava a depender de o app estar fechado: numa
   * máquina com o Global Sync aberto a 51737 está ocupada, o código cai
   * corretamente para a efêmera e o teste acusava falha onde não havia.
   */
  const portaLivreDeTeste = () => tentarPorta(0);

  it("usa a porta preferida quando ela está livre — é o que mantém a sessão", async () => {
    const preferida = await portaLivreDeTeste();

    await expect(escolherPorta(net, preferida)).resolves.toBe(preferida);
  });

  it("cai para uma porta efêmera quando a preferida está ocupada, em vez de falhar", async () => {
    const preferida = await portaLivreDeTeste();
    await ocupar(preferida);

    const porta = await escolherPorta(net, preferida);

    // Abrir é o que não pode faltar: sem porta, não há app. Perder a sessão
    // daquela abertura é o preço aceito, e está documentado em `porta.js`.
    expect(porta).not.toBe(preferida);
    expect(porta).toBeGreaterThan(0);
  });

  it("devolve uma porta de fato livre — a sonda fecha o que abriu", async () => {
    const porta = await escolherPorta();

    // Se a sonda deixasse o servidor de pé, o Next herdaria `EADDRINUSE` na
    // porta que acabamos de dizer que estava livre.
    await expect(ocupar(porta)).resolves.toBeUndefined();
  });

  it("fica na faixa efêmera alta do IANA, longe das portas de desenvolvimento", () => {
    // 3100 é o `npm run dev`; a colisão com ele foi o motivo original de não
    // usar porta fixa. O intervalo é o registro dessa escolha.
    expect(PORTA_PREFERIDA).toBeGreaterThanOrEqual(49152);
    expect(PORTA_PREFERIDA).toBeLessThanOrEqual(65535);
  });
});
