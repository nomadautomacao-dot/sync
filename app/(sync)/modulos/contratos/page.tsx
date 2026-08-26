"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileDoneOutlined, RightOutlined } from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import { Button, Card, Empty, Flex, Typography, theme } from "antd";

import { listCities } from "@/core/lib/cities-firestore";
import type { CityAccount } from "@/core/lib/city-types";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { useAuth } from "@/core/providers/auth-provider";

const { Text, Title } = Typography;

/**
 * A porta do módulo Contrato pelo catálogo.
 *
 * O contrato vive na ficha da cidade — é lá que ele arquiva, anota a linha do
 * tempo e acompanha o estado. Esta página só responde "de qual cidade?" e leva
 * para a aba certa, em vez de duplicar o fluxo inteiro fora da ficha.
 */
export default function ContratosPage() {
  const { user } = useAuth();
  const { token } = theme.useToken();

  const { data: cidades = [], isPending } = useQuery({
    queryKey: ["modulos-cities", user?.groupId],
    queryFn: () => listCities(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
  });

  const colunas: ProColumns<CityAccount>[] = [
    {
      title: "UF",
      dataIndex: "uf",
      width: 64,
      search: false,
      render: (_, cidade) => (
        <span style={{ fontFamily: "var(--font-sync-mono)" }}>{cidade.uf}</span>
      ),
    },
    {
      title: "Município",
      dataIndex: "name",
      sorter: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
      render: (_, cidade) => (
        <Link href={`/cidades/${cidade.id}?aba=contrato`} style={{ fontWeight: 600 }}>
          {cidade.name}
        </Link>
      ),
    },
    {
      title: "",
      width: 160,
      align: "right",
      search: false,
      render: (_, cidade) => (
        <Link href={`/cidades/${cidade.id}?aba=contrato`}>
          <Button size="small" icon={<FileDoneOutlined />}>
            Abrir contrato <RightOutlined />
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <Flex vertical gap={14}>
      <div>
        <Title level={3} style={{ margin: 0 }}>
          Contrato
        </Title>
        <Text type="secondary">
          Escolha o município: a proposta é gerada na ficha da cidade e fica
          arquivada lá, junto do estado do contrato.
        </Text>
      </div>

      <Card>
        {!isPending && cidades.length === 0 ? (
          <Empty
            image={<FileDoneOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />}
            description="Nenhuma cidade na carteira ainda — cadastre o município em Cidades para gerar a proposta."
            style={{ padding: "48px 0" }}
          >
            <Link href="/cidades">
              <Button type="primary">Ir para Cidades</Button>
            </Link>
          </Empty>
        ) : (
          <ProTable<CityAccount>
            rowKey="id"
            size="small"
            loading={isPending}
            search={false}
            options={false}
            toolBarRender={false}
            pagination={false}
            dataSource={cidades}
            columns={colunas}
          />
        )}
      </Card>
    </Flex>
  );
}
