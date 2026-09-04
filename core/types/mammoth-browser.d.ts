/**
 * A build de navegador do mammoth, que não traz tipos próprios.
 *
 * O pacote publica tipos apenas para o ponto de entrada de Node
 * (`mammoth`), e é o de navegador que este projeto usa — o de Node arrasta
 * `fs` e não sobrevive ao bundle do cliente. A superfície declarada aqui é só
 * o que a pré-visualização de DOCX chama: converter um `ArrayBuffer` em HTML.
 *
 * `messages` traz os avisos de conversão (estilo não mapeado, elemento
 * ignorado). A pré-visualização não os mostra: são ruído para quem só quer
 * saber se é este o arquivo, e a fidelidade aproximada já está dita na tela.
 */
declare module "mammoth/mammoth.browser" {
  interface MensagemDeConversao {
    type: string;
    message: string;
  }

  interface ResultadoDaConversao {
    value: string;
    messages: MensagemDeConversao[];
  }

  interface EntradaDaConversao {
    arrayBuffer: ArrayBuffer;
  }

  const mammoth: {
    convertToHtml(entrada: EntradaDaConversao): Promise<ResultadoDaConversao>;
    extractRawText(entrada: EntradaDaConversao): Promise<ResultadoDaConversao>;
  };

  export default mammoth;
}
