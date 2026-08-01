"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, ExternalLinkIcon, LoaderIcon, XIcon } from "lucide-react";

/**
 * Abre um PDF arquivado dentro do app.
 *
 * Antes, todo PDF era um `<a target="_blank">`: no navegador virava outra aba,
 * e no app desktop virava o navegador do sistema — o consultor saía do Sync no
 * meio da reunião para ver o próprio relatório. Aqui o arquivo abre numa camada
 * por cima da tela, e baixar vira uma escolha, não o único caminho.
 *
 * O visor é o do próprio Chromium, via `iframe`. No app empacotado isso exige
 * `plugins: true` no `webPreferences` da janela (`desktop/main.js`) — sem essa
 * opção o Electron não carrega o leitor de PDF e o quadro fica em branco.
 */
interface VisualizadorPdfProps {
  url: string;
  titulo: string;
  /** Nome com que o arquivo é salvo se o usuário mandar baixar. */
  nomeArquivo?: string;
  /** Linha fina sob o título — município, exercício, tamanho. */
  detalhe?: string;
  onFechar: () => void;
}

export function VisualizadorPdf({
  url,
  titulo,
  nomeArquivo,
  detalhe,
  onFechar,
}: VisualizadorPdfProps) {
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  /* O atributo `download` de um link é ignorado quando o arquivo vem de outra
     origem — e o Storage é outra origem. Buscar o blob e salvar a partir dele é
     o que faz o arquivo chegar com o nome certo; se o bucket não liberar CORS,
     resta abrir fora, que é o comportamento antigo. */
  const baixar = async () => {
    setBaixando(true);
    try {
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const blob = await resposta.blob();
      const objeto = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objeto;
      link.download = nomeArquivo || `${titulo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objeto);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onFechar}
      className="fixed inset-0 z-[80] flex bg-[#16181D]/45 p-3 backdrop-blur-[2px] md:p-5"
    >
      <div
        onClick={(evento) => evento.stopPropagation()}
        className="mx-auto flex h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-[18px] border border-white/95 bg-white shadow-[0_30px_80px_rgba(22,24,29,.35)]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[#F0F1F5] px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[12.5px] font-bold text-[#16181D]">
              {titulo}
            </h2>
            {detalhe && (
              <p className="truncate font-mono text-[9.5px] text-[#A2A6B2]">
                {detalhe}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={baixar}
            disabled={baixando}
            className="flex h-8 items-center gap-1.5 rounded-full bg-[#16181D] px-3 text-[10.5px] font-bold text-white transition-colors hover:bg-[#2C2F38] disabled:opacity-50"
          >
            {baixando ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
            Baixar
          </button>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Abrir fora do app"
            aria-label="Abrir fora do app"
            className="flex size-8 items-center justify-center rounded-full text-[#767A86] transition-colors hover:bg-[#F2F1F7] hover:text-[#16181D]"
          >
            <ExternalLinkIcon className="size-3.5" />
          </a>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex size-8 items-center justify-center rounded-full text-[#767A86] transition-colors hover:bg-[#F2F1F7] hover:text-[#16181D]"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <iframe
          src={url}
          title={titulo}
          className="min-h-0 w-full flex-1 border-0 bg-[#ECEAF1]"
        />
      </div>
    </div>
  );
}
