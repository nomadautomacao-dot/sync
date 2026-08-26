"use client";

import { useQuery } from "@tanstack/react-query";
import { FileDoneOutlined, ReadOutlined, TrophyOutlined } from "@ant-design/icons";
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
 * (Contrato FUNDEB, Propostas, Slides, Kit Documental) ou nunca saíram de chave
 * no catálogo (Terceirização, Formação, Atas, Tecnologia). Cada um volta para
 * esta lista quando ganhar tela — a grade já é de duas colunas.
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
  {
    href: "/modulos/case-de-sucesso",
    icone: TrophyOutlined,
    nome: "Case de Sucesso",
    descricao:
      "O deck comercial das redes atendidas: evolução do FUNDEB ano a ano, com a janela de atuação de cada município e a posição dela entre os municípios do país.",
    fontes: "FNDE · portarias de complementação do FUNDEB",
    // Sem contagem fixa: o deck cresce com o número de municípios do case.
    documentos: [{ nome: "Case de Sucesso (deck 16:9)" }],
  },
  {
    href: "/modulos/contratos",
    icone: FileDoneOutlined,
    nome: "Contrato",
    descricao:
      "A proposta comercial que fecha o cliente — dispensa de licitação, Art. 75 da Lei 14.133/21 — gerada a partir da cidade, arquivada no acervo e acompanhada da minuta à assinatura.",
    fontes: "Identidade da Global Company · carteira de cidades",
    documentos: [{ nome: "Proposta Comercial (DOCX)" }],
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
