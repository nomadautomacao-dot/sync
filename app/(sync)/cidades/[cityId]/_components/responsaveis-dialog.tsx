"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Form, Modal, Select, Typography } from "antd";

import { updateCityResponsaveis } from "@/core/lib/cities-firestore";
import type { CityAccount } from "@/core/lib/city-types";
import { listCollaborators } from "@/core/lib/collaborators-firestore";
import { getFirebaseDb } from "@/core/lib/firebase-client";
import { collaboratorLinkCategory } from "@/core/lib/people-types";
import { useAuth } from "@/core/providers/auth-provider";

interface ResponsaveisDialogProps {
  city: CityAccount;
  onClose: () => void;
}

interface CamposDoFormulario {
  parceiroId?: string;
  tecnicoId?: string;
}

/**
 * Edita os dois papéis da cidade: o parceiro que agenciou a entrada e o
 * responsável técnico. São perguntas diferentes — quem abriu a porta e quem
 * responde pela operação — e até aqui os campos só se definiam no cadastro,
 * sem caminho para corrigir depois.
 */
export function ResponsaveisDialog({ city, onClose }: ResponsaveisDialogProps) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<CamposDoFormulario>();

  const { data: colaboradores = [], isPending } = useQuery({
    queryKey: ["collaborators", user?.groupId],
    queryFn: () => listCollaborators(getFirebaseDb(), user!.groupId),
    enabled: Boolean(user?.groupId),
    staleTime: 5 * 60 * 1000,
  });

  const salvar = useMutation({
    mutationFn: async (values: CamposDoFormulario) => {
      const parceiro = colaboradores.find((c) => c.id === values.parceiroId);
      const tecnico = colaboradores.find((c) => c.id === values.tecnicoId);
      // O nome vai copiado junto do id: a carteira lista dezenas de municípios
      // e buscar o nome de cada responsável seria uma leitura por linha.
      await updateCityResponsaveis(getFirebaseDb(), city.id, {
        parceiroId: parceiro?.id,
        parceiroName: parceiro?.fullName,
        collaboratorId: tecnico?.id,
        collaboratorName: tecnico?.fullName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["city", city.id] });
      queryClient.invalidateQueries({ queryKey: ["cities"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-cities"] });
      message.success("Responsáveis da cidade atualizados.");
      onClose();
    },
    onError: (error) =>
      message.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar os responsáveis.",
      ),
  });

  /* O parceiro se escolhe entre os parceiros; o técnico, entre qualquer pessoa
     da equipe. Se o vínculo salvo apontar para alguém que mudou de categoria,
     a opção dele entra mesmo assim — senão o Select mostraria o id cru. */
  const parceiros = colaboradores.filter(
    (c) =>
      collaboratorLinkCategory(c.collaboratorType) === "Parceiro" ||
      c.id === city.parceiroId,
  );

  const opcao = (c: (typeof colaboradores)[number]) => ({
    value: c.id,
    label: `${c.fullName}${c.primaryRole ? ` · ${c.primaryRole}` : ""}`,
  });

  return (
    <Modal
      open
      centered
      width={480}
      title="Responsáveis pela cidade"
      okText={salvar.isPending ? "Salvando…" : "Salvar"}
      cancelText="Cancelar"
      confirmLoading={salvar.isPending}
      onOk={() => form.submit()}
      onCancel={() => {
        if (!salvar.isPending) onClose();
      }}
      destroyOnHidden
    >
      <Form<CamposDoFormulario>
        form={form}
        layout="vertical"
        onFinish={(values) => salvar.mutate(values)}
        initialValues={{
          parceiroId: city.parceiroId,
          tecnicoId: city.collaboratorId,
        }}
        style={{ marginTop: 12 }}
      >
        <Form.Item
          label="Parceiro que agenciou a entrada"
          name="parceiroId"
          extra={
            <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
              Quem abriu a porta da prefeitura para a Global. É sobre esse
              vínculo que a comissão se calcula.
            </Typography.Text>
          }
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            loading={isPending}
            placeholder="Escolha o parceiro"
            options={parceiros.map(opcao)}
            notFoundContent="Nenhum parceiro cadastrado em Pessoas."
          />
        </Form.Item>

        <Form.Item
          label="Responsável técnico"
          name="tecnicoId"
          extra={
            <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
              Quem a equipe procura quando esta cidade travar.
            </Typography.Text>
          }
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            loading={isPending}
            placeholder="Escolha quem responde pela operação"
            options={colaboradores.map(opcao)}
            notFoundContent="Nenhuma pessoa cadastrada em Pessoas."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
