"use client";

import { RightOutlined } from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { Avatar, Empty, Input, Segmented, Space, Tag, Typography, theme } from "antd";

import type { CompanyItem } from "@/core/lib/company-types";
import { companyInitials, formatCnpj } from "@/core/lib/company-types";

interface CompanyTableProps {
  companies: CompanyItem[];
  selectedId?: string;
  onSelect: (item: CompanyItem) => void;
  /* Busca e filtro de status entram como estado controlado vindo da página:
     quem decide o que aparece continua sendo a mesma `useQuery` de sempre —
     aqui só muda onde a caixa de busca é desenhada (dentro da própria
     ProTable, no lugar do campo escrito à mão). */
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

/**
 * Mesma categorização de `companyStatusTone` (core/lib/company-types.ts), só
 * que devolvendo cor de `Tag` do Ant em vez de classe Tailwind — a função
 * original não dá para reaproveitar depois da migração porque o retorno dela
 * é pensado para `className`. A ordem dos `includes` importa: "inativo"
 * também contém "ativ", então o cheque de inatividade vem primeiro.
 */
function tonalidadeDoStatus(status: string): "success" | "warning" | "default" {
  const s = status.toLowerCase();
  if (s.includes("inativ")) return "default";
  if (s.includes("ativ")) return "success";
  if (s.includes("pend")) return "warning";
  return "default";
}

export function CompanyTable({
  companies,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: CompanyTableProps) {
  const { token } = theme.useToken();

  const columns: ProColumns<CompanyItem>[] = [
    {
      title: "Empresa / Razão Social",
      dataIndex: "razaoSocial",
      search: false,
      sorter: (a, b) =>
        (a.nomeFantasia || a.razaoSocial).localeCompare(
          b.nomeFantasia || b.razaoSocial,
          "pt-BR",
        ),
      render: (_, item) => (
        <Space size={10}>
          <Avatar
            shape="square"
            style={{
              background: token.colorFillTertiary,
              color: token.colorText,
              fontWeight: 700,
              fontFamily: "var(--font-sync-mono)",
              fontSize: 11,
            }}
          >
            {companyInitials(item.nomeFantasia || item.razaoSocial)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              {item.nomeFantasia || item.razaoSocial}
            </div>
            <div
              style={{
                fontFamily: "var(--font-sync-mono)",
                fontSize: 11,
                color: token.colorTextTertiary,
              }}
            >
              {item.razaoSocial}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "CNPJ",
      dataIndex: "cnpj",
      width: 150,
      search: false,
      sorter: (a, b) => a.cnpj.localeCompare(b.cnpj),
      render: (_, item) => (
        <span style={{ fontFamily: "var(--font-sync-mono)" }}>
          {formatCnpj(item.cnpj)}
        </span>
      ),
    },
    {
      title: "Responsável",
      dataIndex: "responsavelNome",
      search: false,
      responsive: ["lg"],
      sorter: (a, b) =>
        (a.responsavelNome ?? "").localeCompare(b.responsavelNome ?? "", "pt-BR"),
      render: (_, item) => (
        <div>
          <div style={{ fontSize: 12 }}>{item.responsavelNome || "—"}</div>
          <div
            style={{
              fontFamily: "var(--font-sync-mono)",
              fontSize: 10,
              color: token.colorTextTertiary,
            }}
          >
            {item.responsavelEmail || ""}
          </div>
        </div>
      ),
    },
    {
      title: "Módulos Habilitados",
      dataIndex: "activeModules",
      search: false,
      responsive: ["xl"],
      render: (_, item) =>
        item.activeModules.length > 0 ? (
          <Space size={4} wrap>
            {item.activeModules.slice(0, 3).map((mod) => (
              <Tag key={mod} style={{ textTransform: "uppercase", fontSize: 10 }}>
                {mod.replace("_", " ")}
              </Tag>
            ))}
            {item.activeModules.length > 3 && (
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                +{item.activeModules.length - 3}
              </Typography.Text>
            )}
          </Space>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Nenhum
          </Typography.Text>
        ),
    },
    {
      title: "Quadro",
      dataIndex: "employeeCount",
      width: 88,
      align: "right",
      search: false,
      sorter: (a, b) => (a.employeeCount || 0) - (b.employeeCount || 0),
      render: (_, item) => (
        <span style={{ fontFamily: "var(--font-sync-mono)", fontWeight: 600 }}>
          {item.employeeCount || 0}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      align: "center",
      search: false,
      sorter: (a, b) => a.status.localeCompare(b.status, "pt-BR"),
      render: (_, item) => (
        <Tag color={tonalidadeDoStatus(item.status)} style={{ textTransform: "capitalize" }}>
          {item.status}
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
    <ProTable<CompanyItem>
      rowKey="id"
      size="small"
      cardBordered
      search={false}
      dataSource={companies}
      columns={columns}
      pagination={false}
      scroll={{ x: 960 }}
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
          <Empty description="Nenhuma empresa encontrada com os filtros selecionados." />
        ),
      }}
      toolBarRender={() => [
        <Segmented
          key="status"
          value={statusFilter}
          onChange={(value) => onStatusFilterChange(String(value))}
          options={[
            { label: "Todos", value: "todos" },
            { label: "Ativo", value: "ativo" },
            { label: "Inativo", value: "inativo" },
          ]}
        />,
        <Input.Search
          key="busca"
          allowClear
          placeholder="Buscar por razão, CNPJ, responsável..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          style={{ width: 260 }}
        />,
      ]}
    />
  );
}
