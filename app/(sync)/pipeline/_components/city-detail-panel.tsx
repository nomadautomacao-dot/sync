"use client";

import Link from "next/link";
import { ExportOutlined } from "@ant-design/icons";
import { Drawer, Space, Tabs, Tag, Typography, theme } from "antd";

import type { CityAccount } from "@/core/lib/city-types";
import { STAGE_LABELS } from "@/core/lib/city-types";
import { stagePastelColor } from "./stage-helpers";
import { ResumoTab } from "./city-detail-tabs/resumo-tab";
import { FundebTab } from "./city-detail-tabs/fundeb-tab";
import { HistoricoTab } from "./city-detail-tabs/historico-tab";
import { NotasTab } from "./city-detail-tabs/notas-tab";

interface CityDetailPanelProps {
  city: CityAccount;
  onClose: () => void;
  onSave: (cityId: string, data: Record<string, unknown>) => void;
}

/**
 * Painel de detalhe do município selecionado, agora um `Drawer`. O pai só
 * monta este componente quando há cidade selecionada, então `open` fica fixo
 * em `true`; fechar (X, tecla Esc ou clique fora) chama `onClose`, que
 * desmonta — mesma seleção/deseleção de antes, só que via overlay do Ant em
 * vez de painel fixo empurrando o layout.
 */
export function CityDetailPanel({ city, onClose, onSave }: CityDetailPanelProps) {
  const { token } = theme.useToken();
  const tone = stagePastelColor(city.stage);

  return (
    <Drawer
      open
      onClose={onClose}
      size={450}
      styles={{ body: { padding: 0 } }}
      title={
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {city.name}
          </Typography.Title>
          <Typography.Text
            type="secondary"
            style={{ fontFamily: "var(--font-sync-mono)", fontSize: 12 }}
          >
            {city.uf}
          </Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Space size={10} align="center">
              <Tag
                style={{
                  backgroundColor: tone.bg,
                  color: tone.text,
                  border: "none",
                  borderRadius: 999,
                }}
              >
                {STAGE_LABELS[city.stage] ?? city.stage}
              </Tag>
              <Link href={`/cidades/${city.id}`}>
                <Typography.Text
                  style={{ fontSize: 11, fontWeight: 600, color: token.colorPrimary }}
                >
                  Abrir ficha completa <ExportOutlined />
                </Typography.Text>
              </Link>
            </Space>
          </div>
        </div>
      }
    >
      <Tabs
        defaultActiveKey="resumo"
        tabBarStyle={{ marginBottom: 0, paddingLeft: 16 }}
        items={[
          {
            key: "resumo",
            label: "Resumo",
            children: <ResumoTab city={city} onSave={onSave} />,
          },
          {
            key: "fundeb",
            label: "FUNDEB",
            children: <FundebTab city={city} />,
          },
          {
            key: "historico",
            label: "Histórico",
            children: <HistoricoTab city={city} />,
          },
          {
            key: "notas",
            label: "Notas",
            children: <NotasTab city={city} />,
          },
        ]}
      />
    </Drawer>
  );
}
