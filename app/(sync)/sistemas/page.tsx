"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ApiOutlined,
  ArrowRightOutlined,
  BankOutlined,
  DatabaseOutlined,
  ExportOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Result,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";

import { podeAdministrarSistemas } from "@/core/domain/rbac";
import { useAuth } from "@/core/providers/auth-provider";

import { listarSistemas } from "./_lib/api";

const { Text, Title, Paragraph } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/**
 * O console dos produtos Global.
 *
 * Todos vivem no mesmo projeto Firebase, cada um no seu banco nomeado, e o
 * servidor do Sync alcança todos com a service account que já tem. Esta tela é
 * a porta: escolher o produto e entrar na administração dele.
 */
export default function SistemasPage() {
  const { user, loading: carregandoSessao } = useAuth();
  const { token } = theme.useToken();
  const autorizado = podeAdministrarSistemas(user?.groupRole);

  const {
    data: sistemas = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sistemas"],
    queryFn: listarSistemas,
    enabled: autorizado,
  });

  if (carregandoSessao) return <Skeleton active paragraph={{ rows: 6 }} />;

  // A guarda de verdade está na rota (`core/lib/sistemas-http.ts`). Aqui é só
  // para não mostrar uma tela vazia a quem nunca vai receber dado.
  if (!autorizado) {
    return (
      <Result
        status="403"
        title="Área restrita"
        subTitle="O console de sistemas é de administradores do grupo. Peça acesso a quem administra o workspace."
      />
    );
  }

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          Sistemas
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 720 }}>
          Os produtos Global e o que cada um tem dentro. Daqui você cadastra prefeitura, cria
          usuário e concede papel — as contas são criadas no Firebase pelo servidor do Sync, com
          permissão de administrador.
        </Paragraph>
      </div>

      {isError && (
        <Alert
          type="error"
          showIcon
          message="Não foi possível carregar o catálogo"
          description={error instanceof Error ? error.message : "Erro desconhecido."}
          action={
            <Button size="small" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          }
        />
      )}

      {isPending && !isError && (
        <Row gutter={[16, 16]}>
          {[0, 1].map((i) => (
            <Col key={i} xs={24} lg={12} xxl={8}>
              <Card>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {!isPending && !isError && sistemas.length === 0 && (
        <Card>
          <Empty
            description={
              <Space orientation="vertical" size={4}>
                <Text strong>Nenhum sistema cadastrado</Text>
                <Text type="secondary">
                  O catálogo fica em <Text code>core/domain/sistemas.ts</Text>. Cada produto é uma
                  entrada com o banco nomeado e os papéis dele.
                </Text>
              </Space>
            }
          />
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {sistemas.map((sistema) => (
          <Col key={sistema.id} xs={24} lg={12} xxl={8}>
            <Card
              title={
                <Space>
                  <ApiOutlined />
                  <span>{sistema.nome}</span>
                </Space>
              }
              extra={
                sistema.url && (
                  <Button
                    type="text"
                    size="small"
                    icon={<ExportOutlined />}
                    href={sistema.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir
                  </Button>
                )
              }
              actions={[
                <Link key="admin" href={`/sistemas/${sistema.id}`}>
                  <Space>
                    Administrar
                    <ArrowRightOutlined />
                  </Space>
                </Link>,
              ]}
            >
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                <Text type="secondary">{sistema.descricao}</Text>

                <Space size={6} wrap>
                  <DatabaseOutlined style={{ color: token.colorTextQuaternary }} />
                  <Tag style={{ fontFamily: FONTE_MONO }}>
                    {sistema.databaseId || "(default)"}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    banco nomeado no projeto globalconsultorias
                  </Text>
                </Space>

                {/* Dado parcial: o catálogo respondeu, o banco daquele produto
                    não. Os números vão a zero, mas o card continua acessível —
                    a falha pode ser só o banco ainda não existir. */}
                {sistema.erro ? (
                  <Alert type="warning" showIcon message="Banco não respondeu" description={sistema.erro} />
                ) : (
                  <Row>
                    <Col span={12}>
                      <Statistic
                        title={
                          <Space size={4}>
                            <BankOutlined />
                            Prefeituras
                          </Space>
                        }
                        value={sistema.prefeituras}
                        styles={{ content: { fontFamily: FONTE_MONO, fontSize: 20 } }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title={
                          <Space size={4}>
                            <TeamOutlined />
                            Usuários
                          </Space>
                        }
                        value={sistema.usuarios}
                        styles={{ content: { fontFamily: FONTE_MONO, fontSize: 20 } }}
                      />
                    </Col>
                  </Row>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  );
}
