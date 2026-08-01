"use client";

import { RightOutlined } from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { Empty, Tag, Typography, theme } from "antd";

import type { CityAccount } from "@/core/lib/city-types";
import { STAGE_LABELS, formatCurrency } from "@/core/lib/city-types";
import { daysToDue, stagePastelColor } from "./stage-helpers";

interface PipelineTableProps {
  cities: CityAccount[];
  selectedCityId?: string;
  onSelectCity: (city: CityAccount) => void;
}

const FONTE_NUMERO = "var(--font-sync-mono)";

/**
 * Modo lista do pipeline, agora `ProTable` — mesmo padrão de `/cidades`: sem
 * paginação (a carteira do estágio inteira à vista) e ordenação por coluna.
 * A seleção de linha continua sendo clique; o destaque da linha selecionada
 * troca o `className` manual por `onRow` com token de cor.
 */
export function PipelineTable({
  cities,
  selectedCityId,
  onSelectCity,
}: PipelineTableProps) {
  const { token } = theme.useToken();

  const columns: ProColumns<CityAccount>[] = [
    {
      title: "Município",
      dataIndex: "name",
      ellipsis: true,
      sorter: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
      render: (_, city) => {
        const isClosed = city.stage === "paused" || city.stage === "lost";
        return (
          <span>
            <Typography.Text
              strong
              style={{ color: isClosed ? token.colorTextTertiary : token.colorText }}
            >
              {city.name}
            </Typography.Text>{" "}
            <Typography.Text type="secondary" style={{ fontFamily: FONTE_NUMERO, fontSize: 11 }}>
              {city.uf}
            </Typography.Text>
          </span>
        );
      },
    },
    {
      title: "Responsável",
      dataIndex: "collaboratorName",
      ellipsis: true,
      sorter: (a, b) =>
        (a.collaboratorName ?? "").localeCompare(b.collaboratorName ?? "", "pt-BR"),
      render: (_, city) => city.collaboratorName ?? "—",
    },
    {
      title: "Estágio",
      dataIndex: "stage",
      width: 160,
      sorter: (a, b) =>
        (STAGE_LABELS[a.stage] ?? a.stage).localeCompare(
          STAGE_LABELS[b.stage] ?? b.stage,
          "pt-BR",
        ),
      render: (_, city) => {
        const tone = stagePastelColor(city.stage);
        return (
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
        );
      },
    },
    {
      title: "Receita est.",
      dataIndex: "estimatedAnnualRevenue",
      width: 150,
      align: "right",
      sorter: (a, b) => a.estimatedAnnualRevenue - b.estimatedAnnualRevenue,
      render: (_, city) => (
        <Typography.Text strong style={{ fontFamily: FONTE_NUMERO }}>
          {formatCurrency(city.estimatedAnnualRevenue)}
        </Typography.Text>
      ),
    },
    {
      title: "Próximo passo",
      dataIndex: "nextStepDescription",
      ellipsis: true,
      render: (_, city) => {
        const due = daysToDue(city);
        const rawDue = city.nextStepDueDate;
        const dueDate = rawDue ? new Date(rawDue) : null;
        const validDueDate = dueDate && !isNaN(dueDate.getTime()) ? dueDate : null;
        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Typography.Text type="secondary" ellipsis>
              {city.nextStepDescription ?? "Nenhum próximo passo registrado"}
            </Typography.Text>
            {validDueDate && (
              <Typography.Text
                style={{
                  fontFamily: FONTE_NUMERO,
                  fontSize: 11,
                  color:
                    due !== null && due <= 7
                      ? token.colorWarningText
                      : token.colorTextTertiary,
                }}
              >
                {validDueDate.toLocaleDateString("pt-BR")}
              </Typography.Text>
            )}
          </div>
        );
      },
    },
    {
      title: "",
      width: 40,
      align: "right",
      render: () => <RightOutlined style={{ color: token.colorTextQuaternary }} />,
    },
  ];

  return (
    <ProTable<CityAccount>
      rowKey="id"
      size="small"
      cardBordered
      search={false}
      options={false}
      pagination={false}
      dataSource={cities}
      columns={columns}
      scroll={{ x: 760 }}
      locale={{
        emptyText: (
          <Empty description="Nenhum município neste recorte" />
        ),
      }}
      onRow={(city) => ({
        onClick: () => onSelectCity(city),
        style: {
          cursor: "pointer",
          backgroundColor: city.id === selectedCityId ? token.colorPrimaryBg : undefined,
        },
      })}
    />
  );
}
