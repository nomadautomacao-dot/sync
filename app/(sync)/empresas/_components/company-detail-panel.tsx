"use client";

import { CheckCircleFilled } from "@ant-design/icons";
import {
  Avatar,
  Descriptions,
  Drawer,
  List,
  Space,
  Tabs,
  Tag,
  Typography,
  theme,
} from "antd";

import type { CompanyItem } from "@/core/lib/company-types";
import { companyInitials, formatCnpj } from "@/core/lib/company-types";

interface CompanyDetailPanelProps {
  /* `null` fecha a gaveta — a página mantém sempre montado o mesmo componente
     em vez de montar/desmontar condicionalmente, como o resto do app faz com
     `Drawer` do Ant. */
  company: CompanyItem | null;
  onClose: () => void;
}

function tonalidadeDoStatus(status: string): "success" | "warning" | "default" {
  const s = status.toLowerCase();
  if (s.includes("inativ")) return "default";
  if (s.includes("ativ")) return "success";
  if (s.includes("pend")) return "warning";
  return "default";
}

export function CompanyDetailPanel({ company, onClose }: CompanyDetailPanelProps) {
  const { token } = theme.useToken();

  return (
    <Drawer
      open={Boolean(company)}
      onClose={onClose}
      width={450}
      destroyOnHidden
      title={
        company && (
          <Space size={12} align="start">
            <Avatar
              shape="square"
              size={40}
              style={{
                background: token.colorFillTertiary,
                color: token.colorText,
                fontWeight: 700,
                fontFamily: "var(--font-sync-mono)",
              }}
            >
              {companyInitials(company.nomeFantasia || company.razaoSocial)}
            </Avatar>
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {company.nomeFantasia || company.razaoSocial}
              </Typography.Title>
              <Typography.Text
                type="secondary"
                style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}
              >
                {formatCnpj(company.cnpj)}
              </Typography.Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={tonalidadeDoStatus(company.status)} style={{ textTransform: "capitalize" }}>
                  {company.status}
                </Tag>
              </div>
            </div>
          </Space>
        )
      }
    >
      {company && (
        <Tabs
          items={[
            {
              key: "cadastrais",
              label: "Dados Cadastrais",
              children: (
                <Space direction="vertical" size={20} style={{ width: "100%" }}>
                  <Descriptions
                    title="Identificação"
                    column={1}
                    size="small"
                    items={[
                      { key: "razao", label: "Razão Social", children: company.razaoSocial },
                      {
                        key: "fantasia",
                        label: "Nome Fantasia",
                        children: company.nomeFantasia || "—",
                      },
                      { key: "cnpj", label: "CNPJ", children: formatCnpj(company.cnpj) },
                      {
                        key: "local",
                        label: "UF / Cidade",
                        children: `${company.cidade || "—"} / ${company.uf || "—"}`,
                      },
                    ]}
                  />
                  <Descriptions
                    title="Contato / Responsável"
                    column={1}
                    size="small"
                    items={[
                      {
                        key: "nome",
                        label: "Nome",
                        children: company.responsavelNome || "—",
                      },
                      {
                        key: "email",
                        label: "E-mail",
                        children: company.responsavelEmail || "—",
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: "modulos",
              label: "Módulos",
              children: (
                <div>
                  <Typography.Title level={5} style={{ fontSize: 12 }}>
                    Módulos Contratados e Autorizados
                  </Typography.Title>
                  {company.activeModules.length > 0 ? (
                    <List
                      size="small"
                      dataSource={company.activeModules}
                      renderItem={(mod) => (
                        <List.Item>
                          <Typography.Text strong style={{ textTransform: "uppercase" }}>
                            {mod.replace("_", " ")}
                          </Typography.Text>
                          <Tag color="success" icon={<CheckCircleFilled />}>
                            Ativo
                          </Tag>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Typography.Text type="secondary" italic>
                      Nenhum módulo ativo.
                    </Typography.Text>
                  )}
                </div>
              ),
            },
            {
              key: "quadro",
              label: "Quadro",
              children: (
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Descriptions
                    title="Quadro de Pessoal"
                    column={1}
                    size="small"
                    items={[
                      {
                        key: "total",
                        label: "Total Posições Alocadas",
                        children: `${company.employeeCount || 0} pessoas`,
                      },
                    ]}
                  />
                  <Typography.Text type="secondary">
                    Quadro de colaboradores alocados para atendimento desta empresa.
                  </Typography.Text>
                </Space>
              ),
            },
          ]}
        />
      )}
    </Drawer>
  );
}
