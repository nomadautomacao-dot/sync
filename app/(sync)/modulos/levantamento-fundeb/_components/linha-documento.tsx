"use client";

import { DownloadOutlined } from "@ant-design/icons";
import { Button, Flex, Grid, List, Typography, theme } from "antd";

const { useBreakpoint } = Grid;
const { Text } = Typography;

/**
 * Um documento por linha, não por card.
 *
 * São doze documentos. Em card de 200px eles ocupavam quatro fileiras e ~800px
 * de altura para dizer doze nomes — a tela virava catálogo, e escolher exigia
 * rolar. Em linha o mesmo conteúdo cabe de uma vez: nome, tamanho medido e
 * botão sempre na mesma coluna, que é o que deixa comparar e disparar rápido.
 */
interface LinhaDocumentoProps {
  icone: React.ElementType;
  nome: string;
  paginas: number;
  /** Substitui "N pg" quando o volume é função do município (dossiês). */
  medida?: string;
  descricao: string;
  variante: "primario" | "secundario";
  gerando: boolean;
  desabilitado: boolean;
  onGerar: () => void;
}

export function LinhaDocumento({
  icone: Icone,
  nome,
  paginas,
  medida,
  descricao,
  variante,
  gerando,
  desabilitado,
  onGerar,
}: LinhaDocumentoProps) {
  const { token } = theme.useToken();
  /* A descrição só cabe a partir de telas largas — abaixo disso ela empurraria
     o botão para fora da coluna fixa que o consultor aprendeu a mirar. */
  const telas = useBreakpoint();

  return (
    <List.Item style={{ padding: "8px 12px", border: "none" }}>
      <Flex align="center" gap={12} style={{ width: "100%" }}>
        <Flex
          align="center"
          justify="center"
          style={{
            width: 28,
            height: 28,
            flex: "0 0 auto",
            borderRadius: token.borderRadius,
            background: token.colorFillTertiary,
          }}
        >
          <Icone style={{ fontSize: 14, color: token.colorText }} />
        </Flex>

        <div style={{ width: 230, flex: "0 0 auto", minWidth: 0 }}>
          <Text strong ellipsis={{ tooltip: nome }} style={{ fontSize: 12.5, display: "block" }}>
            {nome}
          </Text>
          <Text
            type="secondary"
            ellipsis={{ tooltip: medida ?? `${paginas} páginas` }}
            style={{ fontFamily: "var(--font-sync-mono)", fontSize: 9.5, display: "block" }}
          >
            {medida ?? `${paginas} páginas`}
          </Text>
        </div>

        {telas.xl && (
          <Text
            type="secondary"
            ellipsis={{ tooltip: descricao }}
            style={{ flex: "1 1 auto", minWidth: 0, fontSize: 11.5 }}
          >
            {descricao}
          </Text>
        )}

        <Button
          type={variante === "primario" ? "primary" : "default"}
          shape="round"
          icon={<DownloadOutlined />}
          loading={gerando}
          disabled={desabilitado || gerando}
          aria-label={`Gerar ${nome}`}
          onClick={onGerar}
          style={{ marginLeft: "auto", flex: "0 0 auto", minWidth: 108 }}
        >
          {gerando ? "Gerando…" : "Gerar PDF"}
        </Button>
      </Flex>
    </List.Item>
  );
}
