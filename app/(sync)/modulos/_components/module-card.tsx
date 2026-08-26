"use client";

import Link from "next/link";
import { ArrowRightOutlined } from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import { Avatar, Flex, Typography, theme } from "antd";

export interface DocumentoDoModulo {
  nome: string;
  /**
   * Opcional porque nem todo documento tem tamanho fixo: o Case de Sucesso
   * cresce com o número de municípios, e anunciar um número redondo ali seria
   * anunciar uma contagem que muda a cada emissão.
   */
  paginas?: number;
}

interface ModuleCardProps {
  /** Rota da tela do módulo. */
  href: string;
  icone: React.ElementType;
  nome: string;
  /** Uma frase sobre o que o módulo faz. */
  descricao: string;
  /** Bases oficiais que o módulo cruza, já formatadas. */
  fontes: string;
  /** O que o módulo entrega — é o que dá corpo ao card. */
  documentos: DocumentoDoModulo[];
}

/**
 * Card de um módulo no hub.
 *
 * Ele lista os documentos que o módulo produz em vez de só nomear o módulo.
 * Essa é a diferença entre um card e um botão inflado: com um módulo só na
 * grade, é o conteúdo do rodapé que impede o card de parecer órfão.
 */
export function ModuleCard({ href, icone: Icone, nome, descricao, fontes, documentos }: ModuleCardProps) {
  const { token } = theme.useToken();

  return (
    <Link href={href} style={{ display: "block", height: "100%" }}>
      <ProCard hoverable style={{ height: "100%" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 14,
              background: token.colorFillTertiary,
              flexShrink: 0,
            }}
          >
            <Icone style={{ fontSize: 19, color: token.colorText }} />
          </div>

          <Avatar
            size={28}
            icon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
            style={{ background: token.colorFillTertiary, color: token.colorTextTertiary, flexShrink: 0 }}
          />
        </div>

        <Typography.Title level={5} style={{ marginTop: 14, marginBottom: 0 }}>
          {nome}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 5, marginBottom: 0, fontSize: 12 }}>
          {descricao}
        </Typography.Paragraph>

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Typography.Text
            type="secondary"
            style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.3, textTransform: "uppercase" }}
          >
            Entrega
          </Typography.Text>

          <Flex vertical gap={4} style={{ marginTop: 6 }}>
            {documentos.map((doc) => (
              <Flex
                key={doc.nome}
                align="baseline"
                justify="space-between"
                style={{ width: "100%", gap: 12 }}
              >
                <Typography.Text strong style={{ fontSize: 12.5 }}>
                  {doc.nome}
                </Typography.Text>
                {doc.paginas !== undefined && (
                  <Typography.Text
                    type="secondary"
                    style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10.5 }}
                  >
                    {doc.paginas} pg
                  </Typography.Text>
                )}
              </Flex>
            ))}
          </Flex>
        </div>

        <Typography.Text type="secondary" style={{ marginTop: 14, fontSize: 11, display: "block" }}>
          {fontes}
        </Typography.Text>
      </ProCard>
    </Link>
  );
}
