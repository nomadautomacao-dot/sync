"use client";

import { useQuery } from "@tanstack/react-query";
import { ReadOutlined } from "@ant-design/icons";
import { Col, Flex, Row, Skeleton, Typography } from "antd";
import { ProCard } from "@ant-design/pro-components";

import { getFirebaseDb } from "@/core/lib/firebase-client";
import { listCities } from "@/core/lib/cities-firestore";
import { useAuth } from "@/core/providers/auth-provider";

import { ModuleCard, type DocumentoDoModulo } from "./_components/module-card";
import { RetomarStrip } from "./_components/retomar-strip";

interface ModuloDisponivel {
  href: string;
  icone: React.ElementType;
  nome: string;
  descricao: string;
  fontes: string;
  documentos: DocumentoDoModulo[];
}

/**
 * Só entram aqui os módulos que abrem de verdade.
 *
 * Os outros do `moduleCatalog` ou perderam a interface junto com o Flutter
 * (Contrato FUNDEB, Case de Sucesso, Propostas, Slides, Kit Documental) ou nunca
 * saíram de chave no catálogo (Terceirização, Formação, Atas, Tecnologia). Cada
 * um volta para esta lista quando ganhar tela — a grade já é de duas colunas.
 */
const MODULOS: ModuloDisponivel[] = [
  {
    href: "/modulos/levantamento-fundeb",
    icone: ReadOutlined,
    nome: "Levantamento FUNDEB",
    descricao:
      "Diagnóstico automático por código IBGE: repasses VAAF, VAAT e VAAR, projeção de ganho e o retrato completo do município.",
    fontes: "IBGE · FNDE · INEP · DATASUS · CAGED · CadÚnico · SICONFI · TSE",
    documentos: [
      { nome: "Raio-X Municipal", paginas: 18 },
      { nome: "Diagnóstico FUNDEB", paginas: 10 },
    ],
  },
];

export default function ModulosPage() {
  const { user } = useAuth();

  const { data: cidades = [], isLoading } = useQuery({
    queryKey: ["modulos-cities", user?.groupId],
    queryFn: async () => {
      if (!user?.groupId) return [];
      return await listCities(getFirebaseDb(), user.groupId);
    },
    enabled: !!user?.groupId,
  });

  return (
    <Flex vertical gap={14}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Módulos
        </Typography.Title>
        <Typography.Text type="secondary">
          As ferramentas que produzem os documentos da consultoria, a partir das bases oficiais.
        </Typography.Text>
      </div>

      <Row gutter={[14, 14]}>
        {MODULOS.map((modulo) => (
          <Col key={modulo.href} xs={24} lg={12}>
            <ModuleCard {...modulo} />
          </Col>
        ))}
      </Row>

      {isLoading ? (
        <ProCard>
          <Skeleton active paragraph={{ rows: 4 }} />
        </ProCard>
      ) : (
        <RetomarStrip cidades={cidades} />
      )}
    </Flex>
  );
}
