"use client";

import { useRef, useState } from "react";
import { EnvironmentOutlined, LoadingOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, AutoComplete, Card, Flex, Input, Space, Tag, Typography, theme } from "antd";

import { searchMunicipios, type IbgeMunicipio } from "@/core/lib/ibge-client";

interface BuscaMunicipioProps {
  onSelecionar: (municipio: IbgeMunicipio) => void;
}

/** Opção do `AutoComplete`: carrega o município inteiro, não só o texto exibido. */
interface OpcaoDeMunicipio {
  key: string;
  value: string;
  municipio: IbgeMunicipio;
  label: React.ReactNode;
}

/**
 * Busca de município na base IBGE, com autocomplete.
 *
 * Cada consulta carrega um número de sequência e só a mais recente pode escrever
 * na lista: digitando rápido, uma resposta lenta de duas letras atrás chegaria
 * depois da atual e sobrescreveria os resultados certos.
 */
export function BuscaMunicipio({ onSelecionar }: BuscaMunicipioProps) {
  const { token } = theme.useToken();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<IbgeMunicipio[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState("");
  const sequenciaRef = useRef(0);

  const aoDigitar = async (valor: string) => {
    setTermo(valor);
    setErroBusca("");

    const sequencia = ++sequenciaRef.current;
    if (valor.trim().length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    try {
      const encontrados = await searchMunicipios(valor);
      if (sequencia !== sequenciaRef.current) return;
      setResultados(encontrados);
    } catch (error) {
      if (sequencia !== sequenciaRef.current) return;
      setResultados([]);
      setErroBusca(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar a base IBGE.",
      );
    } finally {
      if (sequencia === sequenciaRef.current) setBuscando(false);
    }
  };

  const semResultado =
    !buscando &&
    !erroBusca &&
    termo.trim().length >= 2 &&
    resultados.length === 0;

  const opcoes: OpcaoDeMunicipio[] = resultados.map((municipio) => ({
    key: municipio.codigoIbge,
    value: `${municipio.nome} (${municipio.uf})`,
    municipio,
    label: (
      <Flex justify="space-between" align="center" gap={12}>
        <Space size={8}>
          <EnvironmentOutlined style={{ color: token.colorTextTertiary, fontSize: 13 }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{municipio.nome}</span>
          <Tag style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10 }}>
            {municipio.uf}
          </Tag>
        </Space>
        <Typography.Text
          type="secondary"
          style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10.5 }}
        >
          {municipio.codigoIbge}
        </Typography.Text>
      </Flex>
    ),
  }));

  return (
    <Card>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Pesquisar município
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 3, marginBottom: 16, fontSize: 12 }}>
        Nome ou código IBGE. Carrega repasses VAAF, VAAT e VAAR, Censo Escolar e saúde fiscal.
      </Typography.Paragraph>

      <div style={{ maxWidth: 560 }}>
        <AutoComplete<string, OpcaoDeMunicipio>
          style={{ width: "100%" }}
          options={opcoes}
          value={termo}
          onSearch={aoDigitar}
          onChange={setTermo}
          onSelect={(_valor, opcao) => {
            setTermo("");
            setResultados([]);
            onSelecionar(opcao.municipio);
          }}
          notFoundContent={
            semResultado ? `Nenhum município encontrado para “${termo.trim()}”.` : null
          }
        >
          <Input
            size="large"
            allowClear
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            suffix={buscando ? <LoadingOutlined /> : undefined}
            placeholder="Ex.: Bom Jesus da Lapa, Inhapi, Palmeira dos Índios…"
            aria-label="Nome ou código IBGE do município"
            aria-busy={buscando}
            onKeyDown={(evento) => evento.key === "Escape" && setResultados([])}
          />
        </AutoComplete>

        {erroBusca && (
          <Alert type="error" showIcon message={erroBusca} style={{ marginTop: 10 }} />
        )}
      </div>
    </Card>
  );
}
