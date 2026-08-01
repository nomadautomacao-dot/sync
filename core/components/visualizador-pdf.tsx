"use client";

import { useState } from "react";
import { DownloadOutlined, ExportOutlined } from "@ant-design/icons";
import { Button, Flex, Modal, Typography, theme } from "antd";

const { Text } = Typography;

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
 *
 * O componente só é montado pelo pai enquanto deve aparecer — por isso `open`
 * é constante: não há transição fechado→aberto para animar, e `keyboard` /
 * `maskClosable` (ambos padrão do `Modal`) já cobrem Esc e clique fora, sem
 * precisar de listener de teclado próprio.
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
  const { token } = theme.useToken();
  const [baixando, setBaixando] = useState(false);

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
    <Modal
      open
      onCancel={onFechar}
      width={1200}
      styles={{ body: { height: "min(80vh, 900px)", padding: 0 } }}
      title={
        <Flex vertical style={{ minWidth: 0 }}>
          <Text strong ellipsis style={{ fontSize: 14 }}>
            {titulo}
          </Text>
          {detalhe && (
            <Text
              type="secondary"
              ellipsis
              style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11, fontWeight: 400 }}
            >
              {detalhe}
            </Text>
          )}
        </Flex>
      }
      footer={
        <Flex justify="space-between" align="center">
          <Button type="link" href={url} target="_blank" rel="noreferrer" icon={<ExportOutlined />}>
            Abrir fora do app
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} loading={baixando} onClick={baixar}>
            Baixar
          </Button>
        </Flex>
      }
    >
      <iframe
        src={url}
        title={titulo}
        style={{ width: "100%", height: "100%", border: 0, background: token.colorFillTertiary }}
      />
    </Modal>
  );
}
