"use client";

import { useMemo, useState } from "react";
import { EyeOutlined, RocketOutlined, SyncOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Flex,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from "antd";

import { DOCUMENTOS, RELATORIOS_PADRAO } from "@/modules/cidades/documentos-emissiveis";
import type { CityAccount } from "@/core/lib/city-types";
import type { CityReport } from "@/modules/cidades/reports-types";
import { useVisualizador } from "@/core/components/usar-visualizador";
import { useFilaDeEmissao } from "@/core/providers/fila-emissao-provider";

const { Text, Title } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

type Emissivel = (typeof DOCUMENTOS)[number];

interface Linha {
  documento: Emissivel;
  /** A emissão mais recente deste tipo para esta cidade, se houver. */
  ultimo?: CityReport;
  naFila: boolean;
  emissaoAgora: boolean;
  erro?: string;
}

/**
 * A mesa de emissão da cidade: os treze documentos, o que já saiu e o que falta.
 *
 * Antes era preciso sair para o módulo, buscar o município de novo e emitir de
 * lá — e a cidade só ficava sabendo depois, pelo arquivo que aparecia na aba de
 * Relatórios. Aqui os dois lados são o mesmo lugar: o catálogo mostra, para
 * cada documento, **se ele já existe para este município e de quando é**.
 *
 * A emissão vai para a fila que já existe (`useFilaDeEmissao`), e não é
 * disparada direto. Isso não é preferência de arquitetura: cada relatório abre
 * um Chromium no servidor e consulta uma dúzia de fontes públicas, então dois
 * em paralelo competem por memória e multiplicam a chance de a fonte responder
 * com bloqueio. A fila também sobrevive a fechar a janela — quem clicar em
 * "emitir os quatro" pode ir embora.
 */
export function DocumentosDaCidade({
  city,
  reports,
}: {
  city: CityAccount;
  reports: CityReport[];
}) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { abrir: abrirArquivo, visor } = useVisualizador();
  const { jobs, processando, enfileirar } = useFilaDeEmissao();
  const [enfileirando, setEnfileirando] = useState(false);

  const linhas = useMemo<Linha[]>(() => {
    const daCidade = jobs.filter((job) => job.cityId === city.id);

    return DOCUMENTOS.map((documento) => {
      // O mais recente do tipo: o histórico guarda todas as versões, e o que
      // interessa aqui é se existe uma atual.
      const doTipo = reports
        .filter((report) => report.type === documento.reportType)
        .sort((a, b) => (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""));

      const job = daCidade.find((j) => j.documentoId === documento.id);

      return {
        documento,
        ultimo: doTipo[0],
        naFila: job?.status === "pendente",
        emissaoAgora: processando?.cityId === city.id && processando.documentoId === documento.id,
        erro: job?.status === "erro" ? job.erro : undefined,
      };
    });
  }, [city.id, jobs, processando, reports]);

  const emitir = async (ids: readonly string[]) => {
    setEnfileirando(true);
    try {
      const criados = await enfileirar(
        {
          cityId: city.id,
          cityName: city.name,
          cityUf: city.uf,
          codigoIbge: city.codigoIbge,
          regiao: city.region,
        },
        ids,
      );
      if (criados === 0) {
        // `enfileirarDocumentos` não duplica o que já está na fila.
        message.info("Esses documentos já estão na fila.");
      } else {
        message.success(
          `${criados} documento(s) na fila. Pode sair desta tela — a emissão continua.`,
        );
      }
    } catch (erro) {
      message.error(erro instanceof Error ? erro.message : "Não foi possível enfileirar.");
    } finally {
      setEnfileirando(false);
    }
  };

  const semCodigo = !city.codigoIbge;

  return (
    <Card>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            Documentos deste município
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            O que já foi emitido fica arquivado na aba Relatórios. Emitir daqui
            entra na mesma fila do módulo.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<RocketOutlined />}
          loading={enfileirando}
          disabled={semCodigo}
          onClick={() => emitir(RELATORIOS_PADRAO)}
        >
          Emitir os {RELATORIOS_PADRAO.length} de sempre
        </Button>
      </Flex>

      {semCodigo && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          title="Esta cidade não tem código IBGE"
          description="Todo documento é montado a partir dele. Cadastre o código na ficha da cidade para poder emitir."
        />
      )}

      <Table<Linha>
        rowKey={(linha) => linha.documento.id}
        size="small"
        pagination={false}
        style={{ marginTop: 16 }}
        scroll={{ x: 720 }}
        dataSource={linhas}
        locale={{ emptyText: <Empty description="Catálogo vazio." /> }}
        columns={[
          {
            title: "Documento",
            render: (_, { documento }) => (
              <Flex vertical gap={0}>
                <Text strong style={{ fontSize: 13 }}>
                  {documento.nome}
                </Text>
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  {documento.descricao}
                </Text>
              </Flex>
            ),
          },
          {
            title: "Folhas",
            width: 80,
            align: "right",
            render: (_, { documento }) => (
              <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
                {/* Dossiê não tem contagem fixa: o volume é função do município. */}
                {documento.paginas ?? "varia"}
              </Text>
            ),
          },
          {
            title: "Última emissão",
            width: 150,
            align: "right",
            render: (_, { ultimo }) =>
              ultimo ? (
                <Text style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
                  {formatarData(ultimo.generatedAt)}
                </Text>
              ) : (
                /* Nunca emitido é ausência, não zero. */
                <Text style={{ fontSize: 12, color: token.colorTextQuaternary }}>—</Text>
              ),
          },
          {
            title: "",
            width: 210,
            align: "right",
            render: (_, linha) => (
              <Space size={4} wrap>
                {linha.ultimo?.downloadUrl && (
                  <Tooltip title="Abrir o PDF arquivado">
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      /* Abre dentro do app: `href` aqui mandava o consultor
                         para o navegador do sistema no meio da reunião. */
                      onClick={() =>
                        abrirArquivo({
                          url: linha.ultimo!.downloadUrl!,
                          titulo: linha.documento.nome,
                          nomeArquivo: linha.ultimo!.fileName,
                          detalhe: `${city.name} · ${city.uf}`,
                        })
                      }
                    />
                  </Tooltip>
                )}

                {linha.emissaoAgora ? (
                  <Tag icon={<SyncOutlined spin />} color="processing">
                    Emitindo
                  </Tag>
                ) : linha.naFila ? (
                  <Tag color="default">Na fila</Tag>
                ) : (
                  <Button
                    size="small"
                    type={linha.ultimo ? "default" : "primary"}
                    disabled={semCodigo || enfileirando}
                    onClick={() => emitir([linha.documento.id])}
                  >
                    {linha.ultimo ? "Emitir de novo" : "Emitir"}
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
        expandable={{
          // O erro da última tentativa fica escondido até alguém abrir: ele é
          // técnico, e uma coluna de erro vermelha para um dossiê que falhou
          // por fonte fora do ar dominaria a leitura da tabela inteira.
          expandedRowRender: (linha) => (
            <Text type="danger" style={{ fontSize: 12 }}>
              {linha.erro}
            </Text>
          ),
          rowExpandable: (linha) => Boolean(linha.erro),
        }}
      />

      {visor}
    </Card>
  );
}

function formatarData(iso?: string): string {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
