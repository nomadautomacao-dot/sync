"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  FilterOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { ProCard, ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Segmented,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  theme,
} from "antd";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { listCities } from "@/core/lib/cities-firestore";
import { useAuth } from "@/core/providers/auth-provider";
import { listCityReports } from "@/modules/cidades/city-reports-firestore";
import { listCityDocuments } from "@/modules/documentos/documentos-firestore";

import { Mural } from "./_components/mural";

const { Text, Title } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

export interface AuditEvent {
  id: string;
  timestamp: string;
  formattedDate: string;
  formattedTime: string;
  type: "documento" | "relatorio" | "cidade" | "sistema";
  typeLabel: string;
  title: string;
  description: string;
  user: string;
  cityId?: string;
  cityName?: string;
  status: "concluido" | "em_andamento" | "alerta";
}

export default function CaixadeentradaPage() {
  const { user } = useAuth();
  const { token } = theme.useToken();
  const [filterType, setFilterType] = useState<string>("todos");

  const {
    data: cities = [],
    isPending: citiesPending,
    refetch: refetchCities,
  } = useQuery({
    queryKey: ["caixa-cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const {
    data: documents = [],
    isPending: documentsPending,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ["caixa-documents", user?.groupId],
    queryFn: () => listCityDocuments(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const {
    data: reports = [],
    isPending: reportsPending,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["caixa-reports", user?.groupId],
    queryFn: () => listCityReports(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const isPending = citiesPending || documentsPending || reportsPending;

  const events: AuditEvent[] = useMemo(() => {
    const list: AuditEvent[] = [];

    // Documentos
    for (const doc of documents) {
      /* `createdAt` é opcional no tipo do documento: o Firestore pode não ter
         gravado a data em registros antigos. Sem data o item ainda existe — só
         não finge um horário que ninguém registrou. */
      const criadoEm = doc.createdAt ?? "";
      const dt = criadoEm ? new Date(criadoEm) : null;
      list.push({
        id: `doc-${doc.id}`,
        timestamp: criadoEm,
        formattedDate: dt ? dt.toLocaleDateString("pt-BR") : "—",
        formattedTime: dt ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—",
        type: "documento",
        typeLabel: "Documento",
        title: doc.title,
        description: `Anexado à cidade ${doc.cityName} (${doc.category})`,
        user: doc.createdByName || "Sistema",
        cityId: doc.cityId,
        cityName: doc.cityName,
        status: "concluido",
      });
    }

    // Relatórios
    for (const rep of reports) {
      const geradoEm = rep.generatedAt ?? "";
      const dt = geradoEm ? new Date(geradoEm) : null;
      list.push({
        id: `rep-${rep.id}`,
        timestamp: geradoEm,
        formattedDate: dt ? dt.toLocaleDateString("pt-BR") : "—",
        formattedTime: dt ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—",
        type: "relatorio",
        typeLabel: "Relatório",
        title: rep.title,
        description: `Levantamento FUNDEB (${rep.exercise}) gerado para ${rep.cityName}`,
        user: rep.generatedByName || "Consultor",
        cityId: rep.cityId,
        cityName: rep.cityName,
        status: "concluido",
      });
    }

    // Cidades criadas/atualizadas
    for (const city of cities) {
      /* Cidade sem atividade registrada não recebe a hora de agora: fingir o
         instante da leitura a colocaria no topo do histórico como se algo
         tivesse acabado de acontecer. Ausência aqui é "—", igual ao ramo dos
         documentos logo acima. */
      const registradoEm = city.lastActivityAt ?? "";
      const dt = registradoEm ? new Date(registradoEm) : null;
      list.push({
        id: `city-${city.id}`,
        timestamp: registradoEm,
        formattedDate: dt ? dt.toLocaleDateString("pt-BR") : "—",
        formattedTime: dt
          ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "—",
        type: "cidade",
        typeLabel: "Município",
        title: `${city.name} / ${city.uf}`,
        description: `Estágio atual: ${city.stage}`,
        user: "Sistema / Pipeline",
        cityId: city.id,
        cityName: city.name,
        status: "concluido",
      });
    }

    // Ordenar do mais recente para o mais antigo
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return list;
  }, [cities, documents, reports]);

  const filteredEvents = useMemo(() => {
    if (filterType === "todos") return events;
    return events.filter((ev) => ev.type === filterType);
  }, [events, filterType]);

  const columns: ProColumns<AuditEvent>[] = [
    {
      title: "Data / Hora",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 140,
      render: (_, record) => (
        <Flex vertical gap={0}>
          <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
            {record.formattedDate}
          </Text>
          <Text type="secondary" style={{ fontFamily: FONTE_MONO, fontSize: 11 }}>
            {record.formattedTime}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Tipo",
      dataIndex: "type",
      key: "type",
      width: 120,
      render: (_, record) => {
        const tagMap = {
          documento: { color: "blue", label: "Documento" },
          relatorio: { color: "purple", label: "Relatório" },
          cidade: { color: "cyan", label: "Município" },
          sistema: { color: "default", label: "Sistema" },
        };
        const conf = tagMap[record.type] ?? { color: "default", label: record.type };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: "Evento / Ação",
      dataIndex: "title",
      key: "title",
      render: (_, record) => (
        <Flex vertical gap={0}>
          <Text strong style={{ fontSize: 13 }}>
            {record.title}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Usuário",
      dataIndex: "user",
      key: "user",
      width: 160,
      render: (_, record) => (
        <Space size={6}>
          <Avatar size={20} icon={<UserOutlined />} style={{ backgroundColor: token.colorPrimary }} />
          <Text style={{ fontSize: 12 }}>{record.user}</Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      align: "right",
      render: () => (
        <Tag icon={<CheckCircleOutlined />} color="success">
          Registrado
        </Tag>
      ),
    },
  ];

  const handleRefresh = () => {
    refetchCities();
    refetchDocuments();
    refetchReports();
  };

  return (
    <Flex vertical gap={14}>
      {/* Cabeçalho da Seção */}
      <Card size="small">
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <Flex align="center" gap={12}>
            <Avatar
              size={40}
              icon={<AuditOutlined />}
              style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Caixa de entrada
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                O mural da equipe — recados, perguntas e arquivos — e o histórico
                do que o sistema registrou.
              </Text>
            </div>
          </Flex>
          <Button icon={<ReloadOutlined />} loading={isPending} onClick={handleRefresh}>
            Atualizar
          </Button>
        </Flex>
      </Card>

      {/* Duas naturezas na mesma tela, e a ordem diz qual manda: o mural é
          onde as pessoas escrevem; a auditoria é o que o sistema registrou.
          Fundir as duas faria o recado de alguém disputar espaço com trinta
          linhas de emissão automática — e a conversa sempre perde. */}
      <Tabs
        defaultActiveKey="mural"
        items={[
          {
            key: "mural",
            label: "Mural da equipe",
            children: <Mural />,
          },
          {
            key: "auditoria",
            label: `Auditoria (${events.length})`,
            children: (
              <Flex vertical gap={14}>
          {/* Cards de Métricas */}
          <Row gutter={[14, 14]}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Total de Eventos"
                  value={events.length}
                  prefix={<HistoryOutlined style={{ color: token.colorPrimary }} />}
                  styles={{ content: { fontFamily: FONTE_MONO } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Relatórios Emitidos"
                  value={reports.length}
                  prefix={<FileTextOutlined style={{ color: token.purple }} />}
                  styles={{ content: { fontFamily: FONTE_MONO } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Acervo de Documentos"
                  value={documents.length}
                  prefix={<SafetyCertificateOutlined style={{ color: token.colorInfo }} />}
                  styles={{ content: { fontFamily: FONTE_MONO } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Municípios na Carteira"
                  value={cities.length}
                  prefix={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                  styles={{ content: { fontFamily: FONTE_MONO } }}
                />
              </Card>
            </Col>
          </Row>

          {/* Tabela Principal de Auditoria */}
          <Card size="small">
            <Flex justify="space-between" align="center" style={{ marginBottom: 12 }} wrap="wrap" gap={10}>
              <Segmented
                value={filterType}
                onChange={(val) => setFilterType(val as string)}
                options={[
                  { label: "Todos os eventos", value: "todos" },
                  { label: "Documentos", value: "documento" },
                  { label: "Relatórios", value: "relatorio" },
                  { label: "Municípios", value: "cidade" },
                ]}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {filteredEvents.length} registro(s) encontrado(s)
              </Text>
            </Flex>

            <ProTable<AuditEvent>
              rowKey="id"
              size="small"
              loading={isPending}
              dataSource={filteredEvents}
              columns={columns}
              pagination={{ pageSize: 15 }}
              search={false}
              options={{
                density: false,
                fullScreen: false,
                reload: handleRefresh,
                setting: false,
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Nenhum evento registrado até o momento."
                  />
                ),
              }}
            />
          </Card>
              </Flex>
            ),
          },
        ]}
      />
    </Flex>
  );
}
