"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
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
  DatePicker,
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
import { listCollaborators } from "@/core/lib/collaborators-firestore";
import { collaboratorLinkCategory } from "@/core/lib/people-types";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { podeVer } from "@/core/domain/rbac";
import { useAuth } from "@/core/providers/auth-provider";

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
  parceiroId?: string;
  responsavelId?: string;
  inicio?: dayjs.Dayjs;
}

export function NewCityDialog({
  open,
  onClose,
  onSubmit,
  context = "pipeline",
}: NewCityDialogProps) {
  const { token } = theme.useToken();
  const { user } = useAuth();
  const [form] = Form.useForm<CamposDoFormulario>();
  const [search, setSearch] = useState("");

  /* Receita estimada e próximo passo comercial são do funil. E cadastrar um
     município é exatamente o momento em que a consultora está com o notebook
     virado para o gestor — os dois campos ficavam à vista dele. Mesma régua da
     ficha da cidade: quem não tem Pipeline não os vê aqui. */
  const verComercial = user ? podeVer(user.permissoes, "pipeline") : false;

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["collaborators", user?.groupId],
    queryFn: () => listCollaborators(getFirebaseDb(), user!.groupId),
    enabled: open && Boolean(user?.groupId),
    staleTime: 5 * 60 * 1000,
  });

  /* A data de início só aparece a partir do contratual: antes disso não há
     implantação para datar, e um campo de data num município que ainda está em
     mapeamento convida a preencher qualquer coisa. */
  const stageEscolhido = Form.useWatch("stage", form);
  const pedeDataDeInicio = stageEscolhido === "contractual";
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
      const responsavel = colaboradores.find((c) => c.id === values.responsavelId);
      const parceiro = colaboradores.find((c) => c.id === values.parceiroId);

      await onSubmit({
        name: selected.nome,
        uf: selected.uf,
        codigoIbge: selected.codigoIbge,
        region: selected.regiao,
        stage: values.stage,
        estimatedAnnualRevenue: values.revenue ?? 0,
        nextStepDescription: values.nextStep?.trim() || undefined,
        collaboratorId: responsavel?.id,
        // O nome vai copiado junto: a carteira lista dezenas de municípios e
        // buscar o nome de cada responsável seria uma leitura por linha.
        collaboratorName: responsavel?.fullName,
        parceiroId: parceiro?.id,
        parceiroName: parceiro?.fullName,
        implantacaoInicio:
          pedeDataDeInicio && values.inicio ? values.inicio.format("YYYY-MM-DD") : undefined,
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

        <Form.Item
          label="Parceiro que agenciou a entrada"
          name="parceiroId"
          extra={
            <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
              Quem abriu a porta da prefeitura para a Global. Pode ficar vazio e
              ser definido depois, pela ficha da cidade.
            </Typography.Text>
          }
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Escolha o parceiro"
            options={colaboradores
              .filter(
                (colaborador) =>
                  collaboratorLinkCategory(colaborador.collaboratorType) ===
                  "Parceiro",
              )
              .map((colaborador) => ({
                value: colaborador.id,
                label: `${colaborador.fullName}${
                  colaborador.primaryRole ? ` · ${colaborador.primaryRole}` : ""
                }`,
              }))}
            notFoundContent="Nenhum parceiro cadastrado em Pessoas."
          />
        </Form.Item>

        <Form.Item
          label="Responsável técnico"
          name="responsavelId"
          extra={
            <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
              Quem a equipe procura quando esta cidade travar. Pode ficar vazio e
              ser definido depois.
            </Typography.Text>
          }
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Escolha quem responde por esta cidade"
            options={colaboradores.map((colaborador) => ({
              value: colaborador.id,
              label: `${colaborador.fullName}${
                colaborador.primaryRole ? ` · ${colaborador.primaryRole}` : ""
              }`,
            }))}
            notFoundContent="Nenhuma pessoa cadastrada em Pessoas."
          />
        </Form.Item>

        {pedeDataDeInicio && (
          <Form.Item
            label="Início da implantação"
            name="inicio"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                Normalmente a assinatura do contrato. É a partir dela que os
                prazos do cronograma são contados.
              </Typography.Text>
            }
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
        )}

        {verComercial && (
          <>
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
          </>
        )}
      </Form>
    </Modal>
  );
}
