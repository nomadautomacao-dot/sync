"use client";

import { RightOutlined } from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { Avatar, Empty, Input, Segmented, Tag, theme } from "antd";

import type { CollaboratorItem, LinkFilter } from "@/core/lib/people-types";
import {
  collaboratorInitials,
  collaboratorLinkCategory,
  formatCompactCurrency,
} from "@/core/lib/people-types";

interface PeopleTableProps {
  collaborators: CollaboratorItem[];
  selectedId?: string;
  onSelect: (item: CollaboratorItem) => void;
  /* Busca e filtro de vínculo entram como estado controlado vindo da página —
     a mesma `useQuery` de sempre decide o que aparece; só muda onde a caixa
     de busca é desenhada (dentro da própria ProTable). */
  search: string;
  onSearchChange: (value: string) => void;
  linkFilter: LinkFilter;
  onLinkFilterChange: (value: LinkFilter) => void;
}

/**
 * Mesma categorização de `statusTone` (core/lib/people-types.ts), devolvendo
 * cor de `Tag` do Ant em vez de classe Tailwind. A ordem dos `includes`
 * importa: "inativo"/"pausado" também contêm substrings de "ativ".
 */
function tonalidadeDoStatus(status: string): "success" | "warning" | "default" {
  const s = status.toLowerCase();
  if (s.includes("inativ") || s.includes("encerrad") || s.includes("desligad")) return "default";
  if (s.includes("ativ")) return "success";
  if (s.includes("pend") || s.includes("pausad")) return "warning";
  return "default";
}

export function PeopleTable({
  collaborators,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  linkFilter,
  onLinkFilterChange,
}: PeopleTableProps) {
  const { token } = theme.useToken();

  const columns: ProColumns<CollaboratorItem>[] = [
    {
      title: "Nome / Função",
      dataIndex: "fullName",
      search: false,
      sorter: (a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"),
      render: (_, item) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar
            style={{
              background: token.colorFillTertiary,
              color: token.colorText,
              fontWeight: 700,
              fontFamily: "var(--font-sync-mono)",
              fontSize: 11,
            }}
          >
            {collaboratorInitials(item.fullName)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{item.fullName}</div>
            <div
              style={{
                fontFamily: "var(--font-sync-mono)",
                fontSize: 11,
                color: token.colorTextTertiary,
              }}
            >
              {item.primaryRole}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Vínculo",
      dataIndex: "collaboratorType",
      width: 110,
      search: false,
      sorter: (a, b) =>
        collaboratorLinkCategory(a.collaboratorType).localeCompare(
          collaboratorLinkCategory(b.collaboratorType),
          "pt-BR",
        ),
      render: (_, item) => <Tag>{collaboratorLinkCategory(item.collaboratorType)}</Tag>,
    },
    {
      title: "UF",
      dataIndex: "state",
      width: 64,
      align: "center",
      search: false,
      sorter: (a, b) => (a.state ?? "").localeCompare(b.state ?? "", "pt-BR"),
      render: (_, item) => (
        <span style={{ fontFamily: "var(--font-sync-mono)" }}>{item.state || "—"}</span>
      ),
    },
    {
      title: "Cidades",
      dataIndex: "sourcedCitiesCount",
      width: 88,
      align: "right",
      search: false,
      sorter: (a, b) => (a.sourcedCitiesCount || 0) - (b.sourcedCitiesCount || 0),
      render: (_, item) => (
        <span style={{ fontFamily: "var(--font-sync-mono)", fontWeight: 600 }}>
          {item.sourcedCitiesCount || 0}
        </span>
      ),
    },
    {
      title: "Lucro YTD",
      dataIndex: "profitAccruedYtd",
      width: 110,
      align: "right",
      search: false,
      sorter: (a, b) => (a.profitAccruedYtd || 0) - (b.profitAccruedYtd || 0),
      render: (_, item) => (
        <span style={{ fontFamily: "var(--font-sync-mono)" }}>
          {formatCompactCurrency(item.profitAccruedYtd || 0)}
        </span>
      ),
    },
    {
      title: "Comissão YTD",
      dataIndex: "commissionPaidYtd",
      width: 120,
      align: "right",
      search: false,
      sorter: (a, b) => (a.commissionPaidYtd || 0) - (b.commissionPaidYtd || 0),
      render: (_, item) => (
        <span
          style={{
            fontFamily: "var(--font-sync-mono)",
            fontWeight: 600,
            color: token.colorPrimary,
          }}
        >
          {formatCompactCurrency(item.commissionPaidYtd || 0)}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "partnershipStatus",
      width: 110,
      align: "center",
      search: false,
      sorter: (a, b) => a.partnershipStatus.localeCompare(b.partnershipStatus, "pt-BR"),
      render: (_, item) => (
        <Tag color={tonalidadeDoStatus(item.partnershipStatus)} style={{ textTransform: "capitalize" }}>
          {item.partnershipStatus}
        </Tag>
      ),
    },
    {
      title: "",
      width: 40,
      align: "right",
      search: false,
      render: () => <RightOutlined style={{ color: token.colorTextQuaternary }} />,
    },
  ];

  return (
    <ProTable<CollaboratorItem>
      rowKey="id"
      size="small"
      cardBordered
      search={false}
      dataSource={collaborators}
      columns={columns}
      pagination={false}
      scroll={{ x: 980 }}
      options={{ density: false, fullScreen: false, reload: false, setting: false }}
      onRow={(record) => ({
        onClick: () => onSelect(record),
        style: {
          cursor: "pointer",
          background: record.id === selectedId ? token.colorPrimaryBg : undefined,
        },
      })}
      locale={{
        emptyText: (
          <Empty description="Nenhuma pessoa encontrada com os filtros selecionados." />
        ),
      }}
      toolBarRender={() => [
        <Segmented
          key="vinculo"
          value={linkFilter}
          onChange={(value) => onLinkFilterChange(value as LinkFilter)}
          options={[
            { label: "Todos", value: "todos" },
            { label: "Parceiros", value: "parceiros" },
            { label: "Internos", value: "internos" },
          ]}
        />,
        <Input.Search
          key="busca"
          allowClear
          placeholder="Buscar por nome, função, UF..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          style={{ width: 260 }}
        />,
      ]}
    />
  );
}
