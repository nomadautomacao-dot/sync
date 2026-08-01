"use client";

import Link from "next/link";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Avatar, Button, Card, Flex, Space, Tag, Typography, theme } from "antd";

interface CabecalhoMunicipioProps {
  nome: string;
  uf: string;
  codigoIbge: string;
  mesorregiao?: string;
  regiao?: string;
  prefeito?: string;
  partido?: string;
  onTrocar: () => void;
}

/** O IBGE devolve a string literal quando não tem o dado — não é nome de gestor. */
function informado(valor?: string): boolean {
  if (!valor) return false;
  const limpo = valor.trim().toLowerCase();
  return limpo !== "" && limpo !== "nao informado" && limpo !== "não informado";
}

/**
 * Identificação do município no topo da bancada.
 *
 * As ações que não produzem documento moram aqui — trocar de município e mandar
 * a cidade para o pipeline comercial. Os documentos ficam nos cards de saída,
 * para que a fileira de geração contenha só o que gera arquivo.
 */
export function CabecalhoMunicipio({
  nome,
  uf,
  codigoIbge,
  mesorregiao,
  regiao,
  prefeito,
  partido,
  onTrocar,
}: CabecalhoMunicipioProps) {
  const { token } = theme.useToken();

  const localizacao = [
    informado(mesorregiao) ? mesorregiao : null,
    informado(regiao) ? `Região ${regiao}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card size="small">
      <Flex align="center" justify="space-between" gap={16} wrap="wrap">
        <Flex align="center" gap={12} style={{ minWidth: 0 }}>
          <Avatar
            size={44}
            style={{
              flexShrink: 0,
              backgroundColor: token.colorPrimary,
              color: token.colorTextLightSolid,
              fontFamily: "var(--font-sync-mono)",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {uf}
          </Avatar>

          <div style={{ minWidth: 0 }}>
            <Flex align="center" gap={8} wrap="wrap">
              <Typography.Title level={4} style={{ margin: 0 }}>
                {nome}
              </Typography.Title>
              <Tag style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10.5, fontWeight: 600 }}>
                IBGE {codigoIbge}
              </Tag>
            </Flex>

            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 3 }}>
              {localizacao || "Localização não informada"}
              {informado(prefeito) && (
                <>
                  {" · "}
                  <Typography.Text style={{ fontSize: 12 }}>{prefeito}</Typography.Text>
                  {informado(partido) && ` (${partido})`}
                </>
              )}
            </Typography.Text>
          </div>
        </Flex>

        <Space size={8}>
          <Button type="text" icon={<ReloadOutlined />} onClick={onTrocar}>
            Trocar município
          </Button>

          <Link href="/pipeline">
            <Button icon={<PlusOutlined />}>Enviar ao pipeline</Button>
          </Link>
        </Space>
      </Flex>
    </Card>
  );
}
