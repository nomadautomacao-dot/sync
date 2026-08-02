"use client";

import Link from "next/link";
import { RightOutlined } from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import { Avatar, Flex, Tag, Typography, theme } from "antd";

import {
  STAGE_LABELS,
  formatCurrencyCompact,
  stagePastelTone,
  type CityAccount,
} from "@/core/lib/city-types";

interface RetomarStripProps {
  cidades: CityAccount[];
  /** Quantas cidades mostrar. */
  limite?: number;
}

/** Mais recente primeiro; cidade sem atividade registrada vai para o fim. */
function porAtividadeRecente(a: CityAccount, b: CityAccount): number {
  const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
  const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
  return tb - ta;
}

function atividadeRelativa(iso?: string): string | null {
  if (!iso) return null;
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return null;

  const dias = Math.floor((Date.now() - quando.getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * As últimas cidades da carteira, como atalho para a bancada.
 *
 * Existe porque rodar dois municípios seguidos hoje custa digitar o nome de cada
 * um do zero. O clique abre o levantamento com o município já carregado.
 *
 * Sem cidades na carteira, o componente não renderiza nada — a ausência de dado
 * some da tela em vez de virar um bloco vazio.
 */
export function RetomarStrip({ cidades, limite = 6 }: RetomarStripProps) {
  const { token } = theme.useToken();
  const recentes = [...cidades].sort(porAtividadeRecente).slice(0, limite);
  if (recentes.length === 0) return null;

  return (
    <ProCard
      title="Retomar de onde parou"
      subTitle="Abre o levantamento com o município já carregado."
      extra={
        <Link
          href="/pipeline"
          style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10.5, color: token.colorTextSecondary }}
        >
          ver carteira
        </Link>
      }
    >
      <Flex vertical gap={2}>
        {recentes.map((cidade) => {
          const tom = stagePastelTone(cidade.stage);
          const atividade = atividadeRelativa(cidade.lastActivityAt);

          return (
            <Link
              key={cidade.id}
              href={`/modulos/levantamento-fundeb?ibge=${cidade.codigoIbge}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "9px 10px",
                borderRadius: 12,
              }}
            >
              <Avatar
                size={30}
                style={{
                  background: token.colorFillTertiary,
                  color: token.colorText,
                  fontFamily: "var(--font-sync-mono)",
                  fontSize: 10.5,
                  fontWeight: 600,
                }}
              >
                {cidade.uf}
              </Avatar>

              <div style={{ minWidth: 0, flex: 1 }}>
                <Typography.Text strong ellipsis style={{ display: "block", fontSize: 13 }}>
                  {cidade.name}
                </Typography.Text>
                {atividade && (
                  <Typography.Text
                    type="secondary"
                    style={{ display: "block", fontFamily: "var(--font-sync-mono)", fontSize: 10.5 }}
                  >
                    {atividade}
                  </Typography.Text>
                )}
              </div>

              <Tag style={{ background: tom.bg, color: tom.text, border: "none", borderRadius: 999 }}>
                {STAGE_LABELS[cidade.stage]}
              </Tag>

              <span
                style={{
                  width: 92,
                  textAlign: "right",
                  fontFamily: "var(--font-sync-mono)",
                  fontSize: 12,
                  color: token.colorTextSecondary,
                }}
              >
                {formatCurrencyCompact(cidade.estimatedAnnualRevenue)}
              </span>

              <RightOutlined style={{ fontSize: 15, color: token.colorTextQuaternary }} />
            </Link>
          );
        })}
      </Flex>
    </ProCard>
  );
}
