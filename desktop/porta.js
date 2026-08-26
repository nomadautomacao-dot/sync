/**
 * Em que porta o servidor do app sobe.
 *
 * Mora fora de `servidor.js` porque `servidor.js` importa `electron` na
 * primeira linha e, com isso, não pode ser carregado por um teste comum. Esta
 * decisão tem um caminho de exceção — a porta preferida ocupada — e caminho de
 * exceção sem teste é onde o erro se esconde.
 *
 * ## Por que uma porta preferida, e não sempre a efêmera
 *
 * **A origem do browser inclui a porta**, e é a origem que separa o `IndexedDB`
 * onde o Firebase Auth grava a sessão. Enquanto o app pedia porta efêmera a
 * cada abertura, ele também estreava um armazenamento a cada abertura: a
 * sessão do dia anterior continuava gravada, só que num `127.0.0.1:51423` que
 * nunca mais voltaria. O efeito para quem usa é pedir a senha todo dia por mais
 * que a configuração diga "manter sessão ativa".
 *
 * A efêmera continua como plano B — porta fixa não pode virar `EADDRINUSE` na
 * cara de quem só queria abrir o app.
 */

const net = require("node:net");

/**
 * A porta que o app tenta antes de qualquer outra.
 *
 * Escolhida no intervalo efêmero alto do IANA (49152–65535), longe das portas
 * que alguém usaria à mão em desenvolvimento (3000, 3100, 5173, 8080) — a
 * colisão que se quer evitar é justamente com o `npm run dev`, que usa a 3100.
 *
 * Trocar este número desloga todo mundo uma vez: a origem muda junto, e o
 * armazenamento vai com ela.
 */
const PORTA_PREFERIDA = 51737;

/**
 * Abre e fecha um servidor na porta pedida só para saber se ela está livre, e
 * devolve a porta que o sistema concedeu. `0` pede uma efêmera qualquer.
 *
 * Há uma janela de corrida entre fechar aqui e o Next abrir lá; na prática é
 * irrelevante numa máquina de trabalho, e o alternativo — deixar o Next
 * escolher — não serve porque ele não informa de volta qual porta pegou.
 *
 * @param {number} porta
 * @param {Pick<typeof net, "createServer">} [rede] injetável no teste
 * @returns {Promise<number>}
 */
function tentarPorta(porta, rede = net) {
  return new Promise((resolve, reject) => {
    const sonda = rede.createServer();
    sonda.unref();
    sonda.on("error", reject);
    sonda.listen(porta, "127.0.0.1", () => {
      const { port } = sonda.address();
      sonda.close(() => resolve(port));
    });
  });
}

/**
 * A porta preferida quando ela está livre; qualquer uma quando não está.
 *
 * Qualquer falha ao abrir a preferida — ocupada, negada por política, o que for
 * — cai para a efêmera. Não se distingue o motivo de propósito: nenhum deles
 * muda o que há a fazer, e o app precisa subir.
 *
 * `preferida` é parâmetro para que o teste possa escolher uma porta que ele
 * mesmo acabou de liberar. Fixá-la na constante tornava a suíte dependente do
 * ambiente: com o app aberto nesta máquina, a 51737 está ocupada e o teste
 * falhava sem que houvesse nada errado no código.
 *
 * @param {Pick<typeof net, "createServer">} [rede] injetável no teste
 * @param {number} [preferida] injetável no teste
 * @returns {Promise<number>}
 */
async function escolherPorta(rede = net, preferida = PORTA_PREFERIDA) {
  try {
    return await tentarPorta(preferida, rede);
  } catch {
    return tentarPorta(0, rede);
  }
}

module.exports = { escolherPorta, tentarPorta, PORTA_PREFERIDA };
