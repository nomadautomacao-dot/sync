/**
 * A notação de célula do IBGE — um leitor só, em vez de seis divergentes.
 *
 * ## O símbolo que importa
 *
 * O IBGE publica uma tabela de notação, e ela distingue **zero** de **ausência**
 * com símbolos diferentes:
 *
 * | símbolo | significado |
 * |---|---|
 * | `-`   | dado numérico **igual a zero** não resultante de arredondamento |
 * | `0`   | zero resultante de arredondamento de valor positivo |
 * | `..`  | não se aplica dado numérico |
 * | `...` | dado numérico não disponível |
 * | `x`   | omitido para não individualizar a informação |
 *
 * Tratar `-` como ausência é o erro fácil, e ele já custou caro aqui: a folha
 * de densidade imprimia "N/D" na população rural de **toda capital**, porque o
 * SIDRA devolve `-` para quem tem zero morador em área rural. O número existia,
 * era zero, e o relatório dizia que não o tinha. Pior que errar o valor é
 * sugerir falha de coleta onde a fonte respondeu.
 *
 * ## Por que num arquivo próprio
 *
 * A mesma regra estava reimplementada em `densidade-rede.ts`, `saude.ts`,
 * `saneamento.ts`, `emprego.ts`, `assistencia.ts` e `ibge-cidade-indicators.ts`
 * — três delas certas, três erradas, nenhuma sabendo das outras. Regra de fonte
 * externa que se repete é regra que diverge; aqui ela tem um lugar e um teste.
 *
 * ## Onde usar, e onde não
 *
 * Use quando **zero é um valor plausível e informativo**: mortalidade infantil,
 * população rural, contagem de notificações, saldo. Nesses casos confundir zero
 * com ausência apaga um achado.
 *
 * Onde zero seria absurdo — população total, PIB, área territorial —, tanto faz:
 * a fonte nunca devolve `-` ali, e as duas leituras dão no mesmo. Esses pontos
 * seguem com o parser local deles de propósito, para não trocar comportamento
 * testado por um ganho que não existe.
 */

/** Valor pt-BR do IBGE → número, respeitando a notação acima. */
export function numeroIbge(bruto: unknown): number | null {
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
  if (typeof bruto !== "string") return null;

  const texto = bruto.trim();

  // O caso todo desta função.
  if (texto === "-") return 0;

  if (texto === "" || texto === ".." || texto === "..." || texto.toLowerCase() === "x") return null;

  // Separadores pt-BR: "1.234,56" tem os dois; "99,93" só a vírgula decimal;
  // "78,090" é milhar disfarçado — grupos de exatamente três dígitos.
  let normalizado = texto;
  if (texto.includes(".") && texto.includes(",")) {
    normalizado = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    normalizado = /^\d{1,3}(,\d{3})+$/.test(texto) ? texto.replace(/,/g, "") : texto.replace(",", ".");
  }

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}
