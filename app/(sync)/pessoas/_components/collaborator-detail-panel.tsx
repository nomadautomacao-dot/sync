"use client";

import { Avatar, Descriptions, Drawer, Flex, Space, Tabs, Tag, Typography, theme } from "antd";

import type { CollaboratorItem } from "@/core/lib/people-types";
import {
  collaboratorInitials,
  collaboratorLinkCategory,
  formatCompactCurrency,
} from "@/core/lib/people-types";

interface CollaboratorDetailPanelProps {
  /* `null` fecha a gaveta — a página mantém sempre montado o mesmo componente
     em vez de montar/desmontar condicionalmente. */
  collaborator: CollaboratorItem | null;
  onClose: () => void;
}

function tonalidadeDoStatus(status: string): "success" | "warning" | "default" {
  const s = status.toLowerCase();
  if (s.includes("inativ") || s.includes("encerrad") || s.includes("desligad")) return "default";
  if (s.includes("ativ")) return "success";
  if (s.includes("pend") || s.includes("pausad")) return "warning";
  return "default";
}

export function CollaboratorDetailPanel({
  collaborator,
  onClose,
}: CollaboratorDetailPanelProps) {
  const { token } = theme.useToken();

  return (
    <Drawer
      open={Boolean(collaborator)}
      onClose={onClose}
      size={450}
      destroyOnHidden
      title={
        collaborator && (
          <Space size={12} align="start">
            <Avatar
              size={40}
              style={{
                background: token.colorFillTertiary,
                color: token.colorText,
                fontWeight: 700,
                fontFamily: "var(--font-sync-mono)",
              }}
            >
              {collaboratorInitials(collaborator.fullName)}
            </Avatar>
            <div>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {collaborator.fullName}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {collaborator.primaryRole} · {collaboratorLinkCategory(collaborator.collaboratorType)}
              </Typography.Text>
              <div style={{ marginTop: 4 }}>
                <Tag
                  color={tonalidadeDoStatus(collaborator.partnershipStatus)}
                  style={{ textTransform: "capitalize" }}
                >
                  {collaborator.partnershipStatus}
                </Tag>
              </div>
            </div>
          </Space>
        )
      }
    >
      {collaborator && (
        <Tabs
          items={[
            {
              key: "cadastrais",
              label: "Dados Cadastrais",
              children: (
                <Flex vertical gap={20} style={{ width: "100%" }}>
                  <Descriptions
                    title="Contato & Vínculo"
                    column={1}
                    size="small"
                    items={[
                      { key: "email", label: "E-mail", children: collaborator.email || "—" },
                      { key: "phone", label: "Telefone", children: collaborator.phone || "—" },
                      {
                        key: "whatsapp",
                        label: "WhatsApp",
                        children: collaborator.whatsapp || "—",
                      },
                      { key: "uf", label: "UF", children: collaborator.state || "—" },
                      {
                        key: "empresa",
                        label: "Empresa/Organização",
                        children: collaborator.companyOrOrganization || "—",
                      },
                    ]}
                  />
                  <Descriptions
                    title="Configuração de Comissão"
                    column={1}
                    size="small"
                    items={[
                      {
                        key: "comissao",
                        label: "Comissão Padrão",
                        children: `${collaborator.defaultCommissionPercent}%`,
                      },
                      {
                        key: "tipo",
                        label: "Tipo de Colaborador",
                        children: collaborator.collaboratorType,
                      },
                    ]}
                  />
                </Flex>
              ),
            },
            {
              key: "financeiro",
              label: "Financeiro & PIX",
              children: (
                <Flex vertical gap={20} style={{ width: "100%" }}>
                  <Descriptions
                    title="Dados de Pagamento"
                    column={1}
                    size="small"
                    items={[
                      { key: "pix", label: "Chave PIX", children: collaborator.pixKey || "—" },
                      {
                        key: "banco",
                        label: "Dados Bancários",
                        children: collaborator.bankAccountInfo || "—",
                      },
                    ]}
                  />
                  <Descriptions
                    title="Resumo Financeiro (YTD)"
                    column={1}
                    size="small"
                    items={[
                      {
                        key: "pago",
                        label: "Comissão Paga YTD",
                        children: formatCompactCurrency(collaborator.commissionPaidYtd || 0),
                      },
                      {
                        key: "previsto",
                        label: "Comissão Prevista YTD",
                        children: formatCompactCurrency(collaborator.commissionForecastYtd || 0),
                      },
                      {
                        key: "lucro",
                        label: "Lucro Acumulado Cidades",
                        children: formatCompactCurrency(collaborator.profitAccruedYtd || 0),
                      },
                    ]}
                  />
                </Flex>
              ),
            },
            {
              key: "cidades",
              label: "Cidades",
              children: (
                <Flex vertical gap={16} style={{ width: "100%" }}>
                  <Descriptions
                    title="Municípios sob Responsabilidade"
                    column={1}
                    size="small"
                    items={[
                      {
                        key: "total",
                        label: "Total de Cidades",
                        children: `${collaborator.sourcedCitiesCount || 0} cidades`,
                      },
                    ]}
                  />
                  <Typography.Text type="secondary">
                    Cidades vinculadas a esta pessoa aparecem destacadas no Kanban do Pipeline.
                  </Typography.Text>
                </Flex>
              ),
            },
          ]}
        />
      )}
    </Drawer>
  );
}
