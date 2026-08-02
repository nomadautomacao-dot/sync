"use client";

import { useState } from "react";
import {
  ApiOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { ProCard, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  Col,
  Descriptions,
  Flex,
  Row,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  theme,
} from "antd";

import { DadosLocaisCaged } from "@/core/components/ajustes/dados-locais-caged";
import { useAuth } from "@/core/providers/auth-provider";

const { Text, Title, Paragraph } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

interface IntegracaoFonte {
  id: string;
  nome: string;
  orgao: string;
  tipo: "API Pública" | "Dataset Local" | "Chave API";
  status: "operacional" | "instavel" | "manutencao";
  anoBase: string;
  descricao: string;
}

const FONTES_INTEGRACAO: IntegracaoFonte[] = [
  { id: "ibge", nome: "IBGE Cidades", orgao: "IBGE", tipo: "API Pública", status: "operacional", anoBase: "2022-2024", descricao: "População, PIB municipal e limites territoriais" },
  { id: "fnde", nome: "FNDE Repasses FUNDEB", orgao: "FNDE", tipo: "API Pública", status: "operacional", anoBase: "2024", descricao: "Transferências VAAF, VAAT e VAAR" },
  { id: "inep-censo", nome: "Censo Escolar", orgao: "INEP", tipo: "Dataset Local", status: "operacional", anoBase: "2023-2024", descricao: "Matrículas ponderadas, redes e escolas municipais" },
  { id: "inep-ideb", nome: "IDEB Municipal", orgao: "INEP", tipo: "Dataset Local", status: "operacional", anoBase: "2023", descricao: "Indicadores e metas de aprendizagem por ciclo" },
  { id: "siconfi", nome: "SICONFI Fiscal", orgao: "Tesouro Nacional", tipo: "API Pública", status: "operacional", anoBase: "2023-2024", descricao: "Relatórios fiscais, RREO e DCA" },
  { id: "tse", nome: "Prefeitos Eleitos", orgao: "TSE", tipo: "Dataset Local", status: "operacional", anoBase: "2024", descricao: "Prefeitos, partidos e coligações municipais" },
  { id: "caged", nome: "Novo CAGED", orgao: "MTE / IPEADATA", tipo: "Dataset Local", status: "operacional", anoBase: "2024", descricao: "Saldo de emprego formal e movimentação econômica" },
  { id: "simec", nome: "SIMEC Obras", orgao: "MEC / FNDE", tipo: "API Pública", status: "operacional", anoBase: "2024", descricao: "Monitoramento de obras da educação" },
  { id: "qedu", nome: "QEdu Indicadores", orgao: "Fundação Lemann", tipo: "Chave API", status: "operacional", anoBase: "2023", descricao: "Proficiência e distorção idade-série" },
];

export default function AjustesPage() {
  const { user } = useAuth();
  const { token } = theme.useToken();
  const emDesenvolvimento = process.env.NODE_ENV !== "production";
  const [activeTab, setActiveTab] = useState("workspace");

  const colunasFontes: ProColumns<IntegracaoFonte>[] = [
    {
      title: "Fonte / Integração",
      dataIndex: "nome",
      key: "nome",
      render: (_, record) => (
        <Flex vertical gap={0}>
          <Text strong style={{ fontSize: 13 }}>
            {record.nome}
          </Text>
          <Text type="secondary" style={{ fontSize: 11.5 }}>
            {record.descricao}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Órgão Fonte",
      dataIndex: "orgao",
      key: "orgao",
      width: 140,
      render: (_, record) => <Tag>{record.orgao}</Tag>,
    },
    {
      title: "Tipo de Conexão",
      dataIndex: "tipo",
      key: "tipo",
      width: 130,
      render: (_, record) => (
        <Tag color={record.tipo === "API Pública" ? "blue" : record.tipo === "Dataset Local" ? "purple" : "orange"}>
          {record.tipo}
        </Tag>
      ),
    },
    {
      title: "Ano Base",
      dataIndex: "anoBase",
      key: "anoBase",
      width: 100,
      align: "center",
      render: (_, record) => (
        <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
          {record.anoBase}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      align: "right",
      render: (_, record) => (
        <Badge status="success" text={<Text type="success" style={{ fontSize: 12, fontWeight: 500 }}>Operacional</Text>} />
      ),
    },
  ];

  return (
    <Flex vertical gap={14}>
      {/* Cabeçalho */}
      <Card size="small">
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <Flex align="center" gap={12}>
            <Avatar
              size={40}
              icon={<SettingOutlined />}
              style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Ajustes e Configurações
              </Title>

              <Text type="secondary" style={{ fontSize: 12 }}>
                Gestão do grupo, parâmetro de integrações oficiais, perfis de acesso e dev tools.
              </Text>
            </div>
          </Flex>
          <Tag color="geekblue" style={{ fontFamily: FONTE_MONO }}>
            Workspace: {user?.groupId ?? "Rocha Prime"}
          </Tag>
        </Flex>
      </Card>

      {/* Conteúdo em Abas */}
      <Card size="small">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "workspace",
              label: (
                <span>
                  <UserOutlined /> Workspace & Conta
                </span>
              ),
              children: (
                <Flex vertical gap={16} style={{ paddingTop: 8 }}>
                  <Descriptions
                    title="Informações da Sessão e Grupo"
                    size="small"
                    bordered
                    column={{ xs: 1, sm: 2 }}
                    items={[
                      { key: "grupo", label: "Grupo Operacional", children: user?.groupId ?? "Rocha Prime Consultoria" },
                      { key: "usuario", label: "Usuário Logado", children: user?.name ?? user?.email },
                      { key: "email", label: "E-mail de Acesso", children: user?.email },
                      {
                        key: "papel",
                        label: "Papel de Acesso",
                        children: (
                          <Tag color="gold" icon={<LockOutlined />}>
                            {user?.groupRole?.toUpperCase() ?? "ADMIN / OWNER"}
                          </Tag>
                        ),
                      },
                      { key: "versao", label: "Versão do Ant Design", children: "v6.5.3 (ProComponents v3.1)" },
                      { key: "ambiente", label: "Ambiente de Execução", children: emDesenvolvimento ? "Desenvolvimento Local" : "Produção (Cloud Run)" },
                    ]}
                  />

                  <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    title="Dois Perfis de Uso"
                    description="O perfil de Técnico (dono) possui visão completa das margens, estimativas e comissões. O perfil de Consultora Pedagoga oculta automaticamente dados comerciais sensíveis ao girar a tela do notebook para o cliente público."
                  />
                </Flex>
              ),
            },
            {
              key: "integracoes",
              label: (
                <span>
                  <ApiOutlined /> Fontes & Integrações ({FONTES_INTEGRACAO.length})
                </span>
              ),
              children: (
                <Flex vertical gap={12} style={{ paddingTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    O Sync consome 19 fontes públicas de dados para montagem dinâmica de relatórios em PDF e diagnósticos municipais.
                  </Text>
                  <ProTable<IntegracaoFonte>
                    rowKey="id"
                    size="small"
                    dataSource={FONTES_INTEGRACAO}
                    columns={colunasFontes}
                    pagination={false}
                    search={false}
                    options={false}
                  />
                </Flex>
              ),
            },
            {
              key: "rbac",
              label: (
                <span>
                  <SafetyCertificateOutlined /> Controle de Acesso (RBAC)
                </span>
              ),
              children: (
                <Flex vertical gap={14} style={{ paddingTop: 8 }}>
                  <Row gutter={[14, 14]}>
                    <Col xs={24} sm={12}>
                      <Card size="small" title="Perfil Técnico / Owner">
                        <Tag color="gold">Acesso Total</Tag>
                        <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                          Visualiza densidade completa, ordenação por qualquer coluna, probabilidade de fechamento, receita estimada, margem e comissões de colaboradores.
                        </Paragraph>
                      </Card>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Card size="small" title="Perfil Consultora Pedagoga">
                        <Tag color="blue">Modo Apresentação</Tag>
                        <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                          Projetado para reuniões presenciais com gestores públicos. Oculta margens e pipeline comercial, mantendo o foco nos diagnósticos do município.
                        </Paragraph>
                      </Card>
                    </Col>
                  </Row>
                </Flex>
              ),
            },
            ...(emDesenvolvimento
              ? [
                  {
                    key: "dev",
                    label: (
                      <span>
                        <CodeOutlined /> Dados Locais (Dev)
                      </span>
                    ),
                    children: (
                      <div style={{ paddingTop: 8 }}>
                        <DadosLocaisCaged />
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </Flex>
  );
}
