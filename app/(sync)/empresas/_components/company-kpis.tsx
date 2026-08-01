"use client";

import { AppstoreOutlined, BankOutlined, TeamOutlined } from "@ant-design/icons";
import { ProCard } from "@ant-design/pro-components";
import { Statistic, Typography, theme } from "antd";

interface CompanyKpisProps {
  totalCompanies: number;
  totalEmployees: number;
  totalActiveModules: number;
}

const FONTE_NUMERO = "var(--font-sync-mono)";

export function CompanyKpis({
  totalCompanies,
  totalEmployees,
  totalActiveModules,
}: CompanyKpisProps) {
  const { token } = theme.useToken();

  return (
    <ProCard gutter={16} wrap ghost>
      <ProCard colSpan={{ xs: 24, sm: 8 }}>
        <Statistic
          title={
            <>
              EMPRESAS CADASTRADAS <BankOutlined />
            </>
          }
          value={totalCompanies}
          styles={{ content: { fontFamily: FONTE_NUMERO, fontWeight: 700 } }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Entidades do grupo
        </Typography.Text>
      </ProCard>

      <ProCard colSpan={{ xs: 24, sm: 8 }}>
        <Statistic
          title={
            <>
              FUNCIONÁRIOS / QUADRO <TeamOutlined />
            </>
          }
          value={totalEmployees}
          styles={{ content: { fontFamily: FONTE_NUMERO, fontWeight: 700 } }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Total de posições vinculadas
        </Typography.Text>
      </ProCard>

      <ProCard colSpan={{ xs: 24, sm: 8 }}>
        <Statistic
          title={
            <>
              MÓDULOS ATIVOS <AppstoreOutlined />
            </>
          }
          value={totalActiveModules}
          styles={{ content: { fontFamily: FONTE_NUMERO, fontWeight: 700, color: token.colorPrimary } }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Acessos autorizados
        </Typography.Text>
      </ProCard>
    </ProCard>
  );
}
