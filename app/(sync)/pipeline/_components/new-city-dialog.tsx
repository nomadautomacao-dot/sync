"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightOutlined,
  BankOutlined,
  CheckCircleFilled,
  EnvironmentOutlined,
  LoadingOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  AutoComplete,
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";

import type { CityAccount, StageKey } from "@/core/lib/city-types";
import { STAGE_LABELS, BOARD_STAGES } from "@/core/lib/city-types";
import { searchMunicipios, preloadMunicipios, type IbgeMunicipio } from "@/core/lib/ibge-client";

interface NewCityDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<CityAccount> & { name: string; uf: string }) => Promise<void>;
  context?: "pipeline" | "cities";
}

const CREATION_STAGES: StageKey[] = [
  ...BOARD_STAGES,
  "institutional_validation",
];

const STAGE_OPTIONS = CREATION_STAGES.map((s) => ({
  value: s,
  label: STAGE_LABELS[s],
}));

/** Campos que ficam de fato dentro do `Form` do Ant — o autocomplete IBGE mora
 *  fora dele porque a seleção precisa do objeto `IbgeMunicipio` inteiro, não só
 *  de um valor de texto. */
interface CamposDoFormulario {
  stage: StageKey;
  revenue: number | null;
  nextStep: string;
}

export function NewCityDialog({
  open,
  onClose,
  onSubmit,
  context = "pipeline",
}: NewCityDialogProps) {
  const { token } = theme.useToken();
  const [form] = Form.useForm<CamposDoFormulario>();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<IbgeMunicipio[]>([]);
  const [selected, setSelected] = useState<IbgeMunicipio | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) preloadMunicipios();
  }, [open]);

  // Busca IBGE — mesma lógica de antes: dispara a cada mudança de texto, sem
  // debounce, e só enquanto não houver município selecionado.
  useEffect(() => {
    let cancelled = false;
    if (search.trim().length >= 2 && !selected) {
      searchMunicipios(search)
        .then((res) => {
          if (cancelled) return;
          setResults(res);
        })
        .catch((error) => {
          if (cancelled) return;
          setResults([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "Não foi possível consultar a base IBGE.",
          );
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [search, selected]);

  const handleSelect = (m: IbgeMunicipio) => {
    setSelected(m);
    setSearch(`${m.nome} (${m.uf})`);
    setResults([]);
    setSearchError("");
  };

  const reset = () => {
    setSearch("");
    setResults([]);
    setSelected(null);
    setSearching(false);
    setSearchError("");
    setSubmitting(false);
    form.resetFields();
    onClose();
  };

  const handleFinish = async (values: CamposDoFormulario) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: selected.nome,
        uf: selected.uf,
        codigoIbge: selected.codigoIbge,
        region: selected.regiao,
        stage: values.stage,
        estimatedAnnualRevenue: values.revenue ?? 0,
        nextStepDescription: values.nextStep?.trim() || undefined,
      });
      reset();
    } catch {
      setSubmitting(false);
    }
  };

  // Opções do AutoComplete. `key` carrega o código IBGE (identidade real do
  // resultado); `value` é o texto que vai para a caixa quando o item é
  // escolhido, igual ao `handleSelect` de antes.
  const autoCompleteOptions = results.map((m) => ({
    key: m.codigoIbge,
    value: `${m.nome} (${m.uf})`,
    municipio: m,
    label: (
      <Flex justify="space-between" align="center" gap={8}>
        <Space size={6}>
          <EnvironmentOutlined style={{ color: token.colorText, fontSize: 12 }} />
          <span style={{ fontWeight: 700, fontSize: 12 }}>{m.nome}</span>
          <Tag style={{ fontFamily: "var(--font-sync-mono)", fontSize: 10 }}>
            {m.uf}
          </Tag>
        </Space>
        <Typography.Text
          type="secondary"
          style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}
        >
          IBGE {m.codigoIbge}
        </Typography.Text>
      </Flex>
    ),
  }));

  return (
    <Modal
      open={open}
      onCancel={reset}
      // O `<dialog>` nativo que este componente substitui só fechava por Esc
      // ou pelos botões — clique no fundo não fechava. `mask={{ closable: false }}`
      // mantém o mesmo comportamento.
      mask={{ closable: false }}
      destroyOnHidden
      width={540}
      centered
      title={
        <Space size={10} align="start">
          <Flex
            align="center"
            justify="center"
            style={{
              width: 36,
              height: 36,
              borderRadius: token.borderRadiusLG,
              background: token.colorFillTertiary,
              color: token.colorText,
              flexShrink: 0,
            }}
          >
            <BankOutlined />
          </Flex>
          <div>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {context === "cities"
                ? "Adicionar cidade à carteira"
                : "Adicionar município ao pipeline"}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Busque e selecione o município na base oficial do IBGE
            </Typography.Text>
          </div>
        </Space>
      }
      footer={
        <Space>
          <Button onClick={reset}>Cancelar</Button>
          <Button
            type="primary"
            disabled={!selected}
            loading={submitting}
            onClick={() => form.submit()}
          >
            {submitting
              ? "Salvando…"
              : context === "cities"
                ? "Adicionar e abrir cidade"
                : "Adicionar ao pipeline"}
          </Button>
        </Space>
      }
    >
      {/* Integração entre carteira, relatórios e pipeline */}
      <Flex
        align="center"
        justify="space-between"
        style={{
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: "8px 12px",
          marginBottom: 16,
        }}
      >
        <Space size={8}>
          <ThunderboltOutlined style={{ color: token.colorText }} />
          <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>
            {context === "cities"
              ? "Relatórios e dados FUNDEB serão vinculados pelo código IBGE"
              : "Precisa criar o relatório primeiro?"}
          </Typography.Text>
        </Space>
        {context === "pipeline" && (
          <Link href="/modulos">
            <Button size="small" type="text">
              Aba de Relatórios <ArrowRightOutlined />
            </Button>
          </Link>
        )}
      </Flex>

      <Form<CamposDoFormulario>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ stage: "mapping", revenue: null, nextStep: "" }}
      >
        <Form.Item label="Selecionar município (base oficial IBGE)">
          <AutoComplete
            options={autoCompleteOptions}
            value={search}
            // `onSearch` só dispara na digitação real (não na seleção de um
            // item), então é aqui — e não em `onChange` — que vive a lógica
            // de "usuário está buscando de novo".
            onSearch={(value) => {
              setSearchError("");
              if (value.trim().length < 2) {
                setResults([]);
                setSearching(false);
              } else {
                setSearching(true);
              }
              if (selected) setSelected(null);
            }}
            onChange={(value) => setSearch(value)}
            onSelect={(_value, option) =>
              handleSelect((option as (typeof autoCompleteOptions)[number]).municipio)
            }
            notFoundContent={null}
          >
            <Input
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              suffix={searching ? <LoadingOutlined /> : undefined}
              placeholder="Busque por nome do município (ex: Inhapi, Palmeira dos Índios)..."
              autoFocus
            />
          </AutoComplete>

          {searchError && (
            <Alert
              type="error"
              showIcon
              title={searchError}
              style={{ marginTop: 8 }}
            />
          )}

          {selected && (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleFilled />}
              title={
                <span>
                  <strong>
                    {selected.nome}/{selected.uf}
                  </strong>{" "}
                  · IBGE {selected.codigoIbge} · Região {selected.regiao}
                </span>
              }
              style={{ marginTop: 8 }}
            />
          )}
        </Form.Item>

        <Form.Item
          label="Estágio inicial no pipeline"
          name="stage"
        >
          <Select options={STAGE_OPTIONS} />
        </Form.Item>

        <Form.Item label="Receita anual estimada FUNDEB (R$)" name="revenue">
          <InputNumber<number>
            style={{ width: "100%", fontFamily: "var(--font-sync-mono)" }}
            min={0}
            step={1000}
            placeholder={
              context === "cities"
                ? "Opcional — o levantamento preencherá quando disponível"
                : "Ex: 1250000"
            }
          />
        </Form.Item>

        <Form.Item label="Próximo passo comercial" name="nextStep">
          <Input placeholder="Ex: Agendar apresentação executiva com prefeito" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
