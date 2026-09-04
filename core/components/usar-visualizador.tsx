"use client";

import { useState } from "react";

import { VisualizadorDeArquivo } from "./visualizador-de-arquivo";

export interface ArquivoParaVer {
  url: string;
  titulo: string;
  nomeArquivo?: string;
  detalhe?: string;
  mimeType?: string;
}

/**
 * Abre qualquer arquivo do acervo dentro do app, de qualquer tela.
 *
 * ## Por que um gancho e não um componente por tela
 *
 * Link de arquivo aparece em seis lugares — linha do tempo, projetos, pasta,
 * mesa de emissão, ficha do FUNDEB e a lista de análises. Cada um mantendo o
 * próprio `useState` do visor significa seis chances de alguém acrescentar um
 * `<a href>` e não perceber que acabou de recriar o comportamento antigo: o
 * arquivo baixando em vez de abrir, ou saindo do Sync para o navegador do
 * sistema no meio de uma reunião.
 *
 * Aqui a tela pede `abrir(...)` e põe `{visor}` no fim do JSX. É a diferença
 * entre "cada tela decide" e "existe um jeito de abrir arquivo neste app".
 *
 * ## Baixar continua existindo, como escolha
 *
 * O botão de download explícito é outra coisa e continua sendo um link de
 * verdade. O que este gancho remove é o download **implícito** — o que acontece
 * quando a pessoa só queria conferir se era aquele o arquivo.
 */
export function useVisualizador() {
  const [arquivo, setArquivo] = useState<ArquivoParaVer | null>(null);

  const visor = arquivo ? (
    <VisualizadorDeArquivo {...arquivo} onFechar={() => setArquivo(null)} />
  ) : null;

  return { abrir: (proximo: ArquivoParaVer) => setArquivo(proximo), visor };
}
