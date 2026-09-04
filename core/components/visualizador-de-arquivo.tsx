"use client";

import { useEffect, useState } from "react";
import { DownloadOutlined, ExportOutlined } from "@ant-design/icons";
import { Button, Empty, Flex, Modal, Result, Skeleton, Space, Tag, Typography, theme } from "antd";

const { Text } = Typography;

/**
 * Abre um arquivo arquivado **dentro** do app — PDF, DOCX ou imagem.
 *
 * ## Por que ver antes de baixar
 *
 * Antes, todo arquivo era um `<a target="_blank">`: no navegador virava outra
 * aba, e no app desktop virava o navegador do sistema — o consultor saía do
 * Sync no meio da reunião para ver o próprio relatório. E, fora do PDF, a única
 * forma de saber o que havia dentro de um arquivo era baixá-lo: a pessoa
 * acumulava downloads para descobrir qual era o certo.
 *
 * Aqui o conteúdo aparece por cima da tela e baixar vira escolha.
 *
 * ## O DOCX é convertido aqui, no navegador
 *
 * `mammoth` lê o .docx e devolve HTML **sem que o arquivo saia da máquina**. É
 * o motivo de não usar o visualizador do Office nem o do Google, que são uma
 * linha de código e mandariam contrato e ofício de prefeitura para servidor de
 * terceiro. A conversão perde fidelidade de layout — não é um editor, é uma
 * pré-visualização para decidir se é este o arquivo.
 *
 * A biblioteca entra por `import()` dinâmico: ela só é baixada por quem abre um
 * DOCX, e não pesa no carregamento de quem nunca abre.
 *
 * ## O que não dá para pré-visualizar
 *
 * XLSX, ZIP e `.doc` antigo caem num aviso com o botão de baixar. Dizer "não dá
 * para mostrar este aqui" é melhor que um quadro em branco que a pessoa lê como
 * defeito do sistema.
 */
interface VisualizadorDeArquivoProps {
  url: string;
  titulo: string;
  /** Nome com que o arquivo é salvo se o usuário mandar baixar. */
  nomeArquivo?: string;
  /** Linha fina sob o título — município, exercício, tamanho. */
  detalhe?: string;
  mimeType?: string;
  onFechar: () => void;
}

type Formato = "pdf" | "imagem" | "docx" | "desconhecido";

/**
 * O nome do arquivo escondido na URL do Storage.
 *
 * Nem toda chamada tem o nome em mãos: o anexo da linha do tempo guarda só
 * título e URL, e sem o nome o formato caía em "desconhecido" — um PDF abrindo
 * como "não dá para mostrar aqui". A URL do Firebase traz o caminho do objeto
 * percent-encoded depois de `/o/`, e o nome é o último trecho dele.
 */
export function nomeArquivoDaUrl(url: string): string | undefined {
  try {
    const caminho = new URL(url).pathname;
    const depoisDoO = caminho.split("/o/")[1] ?? caminho;
    const decodificado = decodeURIComponent(depoisDoO);
    const ultimo = decodificado.split("/").pop()?.trim();
    return ultimo && ultimo.includes(".") ? ultimo : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A extensão, em maiúsculas, para mostrar ao lado do nome.
 *
 * Existe porque o título de um documento é escrito por quem sobe o arquivo, e
 * "Certificado da capacitação" não diz se o que está lá dentro é um DOCX ou um
 * ZIP. Descobrir isso só depois de baixar — ou de abrir e ver o aviso de que
 * não dá para pré-visualizar — é o atrito que a etiqueta remove.
 *
 * O nome do arquivo manda, e o mime é o reforço: `.docx` renomeado para `.pdf`
 * continuaria dizendo PDF, mas é o mime que decide se abre no visor.
 */
export function extensaoDoArquivo(nomeArquivo?: string, url?: string): string | undefined {
  const nome = nomeArquivo || (url ? nomeArquivoDaUrl(url) : undefined);
  if (!nome) return undefined;
  const partes = nome.split(".");
  if (partes.length < 2) return undefined;
  const extensao = partes.pop()!.trim().toUpperCase();
  return /^[A-Z0-9]{1,5}$/.test(extensao) ? extensao : undefined;
}

export function formatoDoArquivo(nomeArquivo = "", mimeType = ""): Formato {
  const nome = nomeArquivo.toLowerCase();
  if (mimeType === "application/pdf" || nome.endsWith(".pdf")) return "pdf";
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/.test(nome)) {
    return "imagem";
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    nome.endsWith(".docx")
  ) {
    return "docx";
  }
  return "desconhecido";
}

export function VisualizadorDeArquivo({
  url,
  titulo,
  nomeArquivo,
  detalhe,
  mimeType,
  onFechar,
}: VisualizadorDeArquivoProps) {
  const { token } = theme.useToken();
  const [baixando, setBaixando] = useState(false);

  const nomeEfetivo = nomeArquivo || nomeArquivoDaUrl(url);
  const formato = formatoDoArquivo(nomeEfetivo, mimeType);
  const extensao = extensaoDoArquivo(nomeEfetivo, url);

  const baixar = async () => {
    setBaixando(true);
    try {
      await baixarArquivo(url, nomeEfetivo || titulo);
    } finally {
      setBaixando(false);
    }
  };

  return (
    <Modal
      open
      onCancel={onFechar}
      /* `centered` e altura calculada a partir da janela: com 900px fixos e
         sem centralizar, o corpo somado a cabeçalho e rodapé passava da altura
         da tela e o diálogo abria transbordando para baixo. Os 220px
         descontados são o cabeçalho, o rodapé e a margem do próprio Modal. */
      centered
      width="min(1200px, 94vw)"
      styles={{
        body: {
          height: "min(calc(100vh - 220px), 900px)",
          padding: 0,
          overflow: "auto",
        },
      }}
      title={
        <Flex vertical style={{ minWidth: 0 }}>
          <Space size={8} align="center">
            <Text strong ellipsis style={{ fontSize: 14 }}>
              {titulo}
            </Text>
            {extensao && (
              <Tag
                color={formato === "desconhecido" ? "warning" : "default"}
                style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10, marginInlineEnd: 0 }}
              >
                {extensao}
              </Tag>
            )}
          </Space>
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
      {formato === "pdf" && (
        /* O visor é o do próprio Chromium. No app empacotado isso exige
           `plugins: true` no `webPreferences` da janela (`desktop/main.js`) —
           sem essa opção o Electron não carrega o leitor e o quadro fica em
           branco. */
        <iframe
          src={url}
          title={titulo}
          style={{ width: "100%", height: "100%", border: 0, background: token.colorFillTertiary }}
        />
      )}

      {formato === "imagem" && (
        <Flex
          align="center"
          justify="center"
          style={{ height: "100%", background: token.colorFillTertiary, padding: 16 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo do
              Storage com URL assinada em runtime: `next/image` exigiria o host
              na allowlist e otimizaria um arquivo que já é o original. */}
          <img
            src={url}
            alt={titulo}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </Flex>
      )}

      {formato === "docx" && <PreVisualizacaoDocx url={url} />}

      {formato === "desconhecido" && (
        <Flex align="center" justify="center" style={{ height: "100%", padding: 24 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Flex vertical gap={4}>
                {/* Nomeia a extensão em vez de dizer só "este tipo": quem
                    achava que tinha um DOCX precisa ler que é um ZIP. */}
                <Text strong>
                  {extensao ? `Arquivo ${extensao} não abre aqui dentro` : "Este arquivo não abre aqui dentro"}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {nomeEfetivo ?? "O arquivo"} precisa do programa do seu computador. PDF, DOCX e
                  imagem abrem aqui; planilha, ZIP e .doc antigo, não.
                </Text>
              </Flex>
            }
          />
        </Flex>
      )}
    </Modal>
  );
}

/**
 * Converte o .docx em HTML no próprio navegador e o mostra.
 *
 * O HTML sai da árvore do documento, não de marcação embutida nele: o mammoth
 * monta parágrafo, título, lista, tabela e imagem a partir do XML do Word, e
 * não repassa tag que o autor tenha escrito. Mesmo assim a saída é neutralizada
 * antes de entrar na página — `href` com `javascript:` é o vetor que
 * sobreviveria à conversão, e o arquivo pode ter sido enviado por qualquer
 * pessoa da equipe.
 */
function PreVisualizacaoDocx({ url }: { url: string }) {
  const { token } = theme.useToken();
  const [html, setHtml] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const [{ default: mammoth }, resposta] = await Promise.all([
          import("mammoth/mammoth.browser"),
          fetch(url),
        ]);
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const arrayBuffer = await resposta.arrayBuffer();
        const { value } = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelado) setHtml(neutralizar(value));
      } catch (falha) {
        if (!cancelado) {
          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível ler o arquivo.",
          );
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [url]);

  if (erro) {
    return (
      <Result
        status="warning"
        title="Não deu para pré-visualizar aqui"
        subTitle={`${erro}. O arquivo está íntegro — use "Baixar" ou "Abrir fora do app".`}
      />
    );
  }

  if (html === null) {
    return (
      <div style={{ padding: 32 }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px", background: token.colorBgContainer }}>
      {/* O HTML vem do Word e não passa por componente do Ant, então as poucas
          regras que ele precisa vão aqui, presas a esta classe. A que não pode
          faltar é a da imagem: o cartaz de uma capacitação tem 2000px de
          largura e, sem `max-width`, atravessa o quadro e força rolagem
          horizontal — e cartaz e certificado, que são uma imagem de página
          inteira, é justamente o caso comum de DOCX nesta pasta. */}
      <style>{`
        .docx-convertido { max-width: 760px; margin: 0 auto; font-size: 14px; line-height: 1.7; }
        .docx-convertido img { max-width: 100%; height: auto; display: block; margin: 12px auto; }
        .docx-convertido table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        .docx-convertido td, .docx-convertido th {
          border: 1px solid ${token.colorBorderSecondary};
          padding: 6px 10px;
          text-align: left;
        }
        .docx-convertido p { margin: 0 0 10px; }
        .docx-convertido h1, .docx-convertido h2, .docx-convertido h3 { margin: 20px 0 8px; }
      `}</style>
      <div
        /* A conversão é aproximada de propósito: isto é pré-visualização para
           decidir se é este o arquivo, não um editor de Word. */
        className="docx-convertido"
        style={{ color: token.colorText }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/**
 * Tira da conversão o que poderia executar.
 *
 * O mammoth não repassa `<script>`, mas monta `<a href>` a partir do
 * hiperlink do documento — e `javascript:` num hiperlink atravessa a conversão
 * intacto. Como qualquer pessoa da equipe envia arquivo para a pasta, a saída
 * passa por aqui antes de entrar na página.
 */
export function neutralizar(html: string): string {
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*script[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi,
      "",
    );
}

/**
 * Salva o arquivo no computador, com o nome certo.
 *
 * O atributo `download` de um link é ignorado quando o arquivo vem de outra
 * origem — e o Storage é outra origem. Sem isto, "Baixar" num PDF abria mais
 * uma aba e num DOCX salvava com o nome opaco do objeto no bucket.
 *
 * Buscar o blob e salvar a partir dele exige CORS liberado no bucket para a
 * origem do app (`gcloud storage buckets update --cors-file`). Se o `fetch`
 * falhar — bucket sem CORS, rede caída dentro de uma prefeitura — resta abrir
 * fora, que é pior mas não é nada.
 */
export async function baixarArquivo(url: string, nomeArquivo: string): Promise<void> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const blob = await resposta.blob();
    const objeto = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objeto;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objeto);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
