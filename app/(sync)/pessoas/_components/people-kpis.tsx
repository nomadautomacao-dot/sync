"use client";

import { CheckCircleOutlined, TeamOutlined, WalletOutlined } from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import { Statistic, Typography, theme } from "antd";

import { formatCompactCurrency } from "@/core/lib/people-types";

interface PeopleKpisProps {
  totalPeople: number;
  activeCount: number;
  totalCommissionsYtd: number;
}

const FONTE_NUMERO = "var(--font-sync-mono)";

export function PeopleKpis({
  totalPeople,
  activeCount,
  totalCommissionsYtd,
}: PeopleKpisProps) {
  const { token } = theme.useToken();

  return (
    <ProCard gutter={16} wrap ghost>
      <ProCard colSpan={{ xs: 24, sm: 8 }}>
        <Statistic
          title={
            <>
              TOTAL DE PESSOAS <TeamOutlined />
            </>
          }
          value={totalPeople}
          valueStyle={{ fontFamily: FONTE_NUMERO, fontWeight: 700 }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Cadastrados no sistema
        </Typography.Text>
      </ProCard>

      <ProCard colSpan={{ xs: 24, sm: 8 }}>
        <Statistic
          title={
            <>
              EM ACOMPANHAMENTO <CheckCircleOutlined />
            </>
          }
          value={activeCount}
          valueStyle={{ fontFamily: FONTE_NUMERO, fontWeight: 700 }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Com auxílio/parceria ativa
        </Typography.Text>
      </ProCard>

      <ProCard colSpan={{ xs: 24, sm: 8 }}>
        <Statistic
          title={
            <>
              COMISSÕES PAGAS (YTD) <WalletOutlined />
            </>
          }
          value={formatCompactCurrency(totalCommissionsYtd)}
          valueStyle={{ fontFamily: FONTE_NUMERO, fontWeight: 700, color: token.colorPrimary }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Acumulado do ano
        </Typography.Text>
      </ProCard>
    </ProCard>
  );
}
