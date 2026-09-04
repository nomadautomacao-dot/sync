"use client";

import { EditOutlined } from "@ant-design/icons";
import {
  Avatar,
  Button,
  Descriptions,
  Drawer,
  Flex,
  Space,
  Tabs,
  Tag,
  Typography,
  theme,
} from "antd";
import type { TabsProps } from "antd";

import type { CollaboratorItem } from "@/core/lib/people-types";
import {
  collaboratorInitials,
  collaboratorLinkCategory,
  formatCompactCurrency,
  linkDeWhatsapp,
  whatsappDoColaborador,
} from "@/core/lib/people-types";
import { AcessoDaPessoa } from "@/core/components/acessos/acesso-da-pessoa";
import { podeAdministrarAcessos, podeVerAdministrativo } from "@/core/domain/rbac";
import { useAuth } from "@/core/providers/auth-provider";

interface CollaboratorDetailPanelProps {
  /* `null` fecha a gaveta — a página mantém sempre montado o mesmo componente
     em vez de montar/desmontar condicionalmente. */
  collaborator: CollaboratorItem | null;
  onClose: () => void;
  onEdit: (collaborator: CollaboratorItem) => void;
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
  onEdit,
}: CollaboratorDetailPanelProps) {
  const { token } = theme.useToken();
  const { user } = useAuth();

  const whatsapp = collaborator ? whatsappDoColaborador(collaborator) : null;
  const urlDoWhatsapp = whatsapp ? linkDeWhatsapp(whatsapp.numero) : null;

  /* A aba de acesso carrega a grade de áreas, que é uma tabela de duas colunas:
     em 450px ela espreme o rótulo da área contra os três botões de nível. */
  const administraAcessos = podeAdministrarAcessos(user?.groupRole ?? "viewer");
  /* Remuneração, PIX e dados bancários são do mesmo eixo do contrato. A área
     Pessoas continua aberta à colaboradora — ela precisa do telefone e do
     WhatsApp da colega —, e o que sai é a faixa financeira dentro dela.

     Aqui a trava é só de tela, e isso é limitação do Firestore, não escolha:
     `pixKey` e `bankAccountInfo` são campos do documento de `collaborators`, e
     regra de segurança concede ou nega o documento inteiro — não dá para
     esconder campo na leitura. Fechar de verdade exige mover esses campos para
     uma subcoleção própria, com migração dos cadastros que já existem. */
  const veAdministrativo = podeVerAdministrativo(user?.groupRole);

  const abasDeAcesso: NonNullable<TabsProps["items"]> =
    collaborator && administraAcessos
      ? [
          {
            key: "acesso",
            label: "Acesso ao sistema",
            children: (
              <AcessoDaPessoa
                nome={collaborator.fullName}
                email={collaborator.email}
                papelDeQuemEdita={user?.groupRole ?? "viewer"}
                uidDeQuemEdita={user?.id ?? ""}
              />
            ),
          },
        ]
      : [];

  return (
    <Drawer
      open={Boolean(collaborator)}
      onClose={onClose}
      size={administraAcessos ? 720 : 450}
      destroyOnHidden
      extra={
        collaborator && (
          <Button icon={<EditOutlined />} onClick={() => onEdit(collaborator)}>
            Editar
          </Button>
        )
      }
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
                        children: whatsapp ? (
                          <Space size={6} wrap>
                            {urlDoWhatsapp ? (
                              <Typography.Link
                                href={urlDoWhatsapp}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {whatsapp.numero}
                              </Typography.Link>
                            ) : (
                              whatsapp.numero
                            )}
                            {/* Dizer de onde veio o número evita a dúvida de
                                quem procura o campo próprio e o encontra vazio. */}
                            {whatsapp.mesmoDoTelefone && (
                              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                                mesmo do telefone
                              </Typography.Text>
                            )}
                          </Space>
                        ) : (
                          "—"
                        ),
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
                    title={veAdministrativo ? "Configuração de Comissão" : "Vínculo"}
                    column={1}
                    size="small"
                    items={[
                      ...(veAdministrativo
                        ? [{
                            key: "comissao",
                            label: "Comissão Padrão",
                            children: `${collaborator.defaultCommissionPercent}%`,
                          }]
                        : []),
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
            ...(veAdministrativo
              ? [{
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
            }]
              : []),
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
            ...abasDeAcesso,
          ]}
        />
      )}
    </Drawer>
  );
}
