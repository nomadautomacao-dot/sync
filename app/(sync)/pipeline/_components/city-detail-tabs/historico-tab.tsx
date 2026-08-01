"use client";

import { Empty, Typography } from "antd";

import type { CityAccount } from "@/core/lib/city-types";

interface HistoricoTabProps {
  city: CityAccount;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura mantida para quando a aba ganhar conteúdo por cidade
export function HistoricoTab({ city }: HistoricoTabProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 320,
        padding: 32,
        textAlign: "center",
      }}
    >
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <Typography.Text strong>Histórico de atividades</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Em breve — timeline de ações e mudanças de estágio
            </Typography.Text>
          </>
        }
      />
    </div>
  );
}
