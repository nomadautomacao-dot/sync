"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { SaveOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Input,
  InputNumber,
  Row,
  Select,
  Typography,
} from "antd";

import { updateCityPipeline } from "@/core/lib/cities-firestore";
import {
  STAGE_KEYS,
  STAGE_LABELS,
  formatCurrency,
  stageProbability,
  type CityAccount,
  type StageKey,
} from "@/core/lib/city-types";
import { getFirebaseDb } from "@/core/lib/firebase-client";

const { Text, Title } = Typography;

/**
 * Estágio, probabilidade, receita estimada e próxima ação comercial.
 *
 * Componente separado porque é o pedaço do Panorama que **não** pode aparecer
 * quando a consultora gira o notebook para o secretário municipal. Quem o
 * renderiza confere `podeVer(permissoes, "pipeline")` antes; tê-lo em arquivo
 * próprio deixa essa fronteira visível, em vez de escondida no meio de
 * quatrocentas linhas de painel.
 */
export function BlocoComercial({ city }: { city: CityAccount }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState<StageKey>(city.stage);
  const [probability, setProbability] = useState(city.probability);
  const [revenue, setRevenue] = useState(city.estimatedAnnualRevenue);
  const [nextStep, setNextStep] = useState(city.nextStepDescription ?? "");
  const [dueDate, setDueDate] = useState(city.nextStepDueDate ?? "");

  const salvar = useMutation({
    mutationFn: () =>
      updateCityPipeline(getFirebaseDb(), city.id, {
        stage,
        probability,
        estimatedAnnualRevenue: revenue,
        nextStepDescription: nextStep,
        nextStepDueDate: dueDate,
        lastActivityAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["city", city.id] });
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      message.success("Pipeline da cidade atualizado.");
    },
    onError: (erro) =>
      message.error(
        erro instanceof Error ? erro.message : "Não foi possível salvar o pipeline.",
      ),
  });

  return (
    <Card>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <div>
          <Title level={5} style={{ margin: 0 }}>
            Pipeline e próxima ação
          </Title>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Este status alimenta o Kanban e o painel comercial. Não aparece para
            quem não tem acesso a Pipeline.
          </Text>
        </div>
        <Text type="secondary" style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11 }}>
          {probability}% · {formatCurrency(revenue)}
        </Text>
      </Flex>

      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={24} sm={12}>
          <Flex vertical gap={6}>
            <Text strong style={{ fontSize: 11 }}>
              Estágio atual
            </Text>
            <Select<StageKey>
              value={stage}
              onChange={(valor) => {
                setStage(valor);
                // A probabilidade acompanha o estágio por padrão; quem quiser
                // divergir ajusta no campo ao lado, e o valor digitado fica.
                setProbability(stageProbability(valor));
              }}
              options={STAGE_KEYS.map((key) => ({ value: key, label: STAGE_LABELS[key] }))}
            />
          </Flex>
        </Col>
        <Col xs={24} sm={12}>
          <Flex vertical gap={6}>
            <Text strong style={{ fontSize: 11 }}>
              Probabilidade (%)
            </Text>
            <InputNumber
              min={0}
              max={100}
              value={probability}
              onChange={(valor) => setProbability(valor ?? 0)}
              style={{ width: "100%", fontFamily: "var(--font-sync-mono)" }}
            />
          </Flex>
        </Col>
        <Col xs={24} sm={12}>
          <Flex vertical gap={6}>
            <Text strong style={{ fontSize: 11 }}>
              Receita anual estimada
            </Text>
            <InputNumber
              min={0}
              step={1000}
              value={revenue}
              onChange={(valor) => setRevenue(valor ?? 0)}
              style={{ width: "100%", fontFamily: "var(--font-sync-mono)" }}
              prefix="R$"
            />
          </Flex>
        </Col>
        <Col xs={24} sm={12}>
          <Flex vertical gap={6}>
            <Text strong style={{ fontSize: 11 }}>
              Prazo da próxima ação
            </Text>
            <DatePicker
              value={dueDate ? dayjs(dueDate) : null}
              onChange={(data) => setDueDate(data ? data.format("YYYY-MM-DD") : "")}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
            />
          </Flex>
        </Col>
      </Row>

      <Flex vertical gap={6} style={{ marginTop: 16 }}>
        <Text strong style={{ fontSize: 11 }}>
          Próxima ação
        </Text>
        <Input.TextArea
          value={nextStep}
          onChange={(evento) => setNextStep(evento.target.value)}
          rows={3}
          placeholder="Ex.: Apresentar diagnóstico ao secretário de educação"
        />
      </Flex>

      <Flex justify="flex-end" style={{ marginTop: 20 }}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          Salvar acompanhamento
        </Button>
      </Flex>
    </Card>
  );
}
