"use client";

import {
  AlertOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import { Statistic, Tag, Typography, theme } from "antd";

import { formatCurrency, formatCurrencyCompact } from "@/core/lib/city-types";

/**
 * Os três números do topo do pipeline.
 *
 * São informação do perfil técnico — receita e previsão não entram em tela que
 * a consultora gira para o gestor municipal.
 */
interface PipelineKpisProps {
  /** Pipeline bruto do ano. */
  totalRevenue: number;
  /** Ajustado pela probabilidade de cada estágio. */
  weightedRevenue: number;
  /** Cidades sem contato há mais de sete dias. */
  inactiveCities: number;
}

const FONTE_NUMERO = "var(--font-sync-mono)";

export function PipelineKpis({
  totalRevenue,
  weightedRevenue,
  inactiveCities,
}: PipelineKpisProps) {
  const { token } = theme.useToken();
  const emDia = inactiveCities === 0;

  return (
    <ProCard gutter={16} wrap ghost>
      {/* O cartão escuro carrega o número principal. É o único lugar da tela
          com fundo cheio: dois competindo tiram o destaque um do outro. */}
      <ProCard
        colSpan={{ xs: 24, sm: 8 }}
        style={{
          background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #3B3F4A 100%)`,
        }}
      >
        <Statistic
          title={
            <span style={{ color: "rgba(255,255,255,.75)", fontSize: 11 }}>
              PIPELINE BRUTO (YTD) <RiseOutlined />
            </span>
          }
          value={formatCurrencyCompact(totalRevenue)}
          valueStyle={{
            color: "#FFFFFF",
            fontFamily: FONTE_NUMERO,
            fontWeight: 700,
          }}
        />
        <Typography.Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>
          Estimativa anual total ({formatCurrency(totalRevenue)})
        </Typography.Text>
      </ProCard>

      <ProCard colSpan={{ xs: 24, sm: 8 }}>
        <Statistic
          title={
            <>
              VALOR PONDERADO <SafetyCertificateOutlined />
            </>
          }
          value={formatCurrencyCompact(weightedRevenue)}
          valueStyle={{ fontFamily: FONTE_NUMERO, fontWeight: 700 }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Ajustado pela probabilidade de cada estágio
        </Typography.Text>
      </ProCard>

      <ProCard colSpan={{ xs: 24, sm: 8 }}>
        <Statistic
          title={
            <>
              SEM CONTATO HÁ MAIS DE 7 DIAS <AlertOutlined />
            </>
          }
          value={inactiveCities}
          valueStyle={{
            fontFamily: FONTE_NUMERO,
            fontWeight: 700,
            color: emDia ? token.colorText : token.colorWarningText,
          }}
          suffix={
            <Tag color={emDia ? "success" : "warning"} style={{ marginLeft: 8 }}>
              {emDia ? "Em dia" : "Requer ação"}
            </Tag>
          }
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Cidades que precisam de retomada
        </Typography.Text>
      </ProCard>
    </ProCard>
  );
}
