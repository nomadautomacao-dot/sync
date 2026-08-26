"use client";

import { Alert, Flex, Radio, Table, Typography, theme } from "antd";

import {
  AREAS,
  GROUP_ROLES,
  NIVEIS,
  NIVEL_LABELS,
  permissoesPadrao,
  type Area,
  type GroupRole,
  type NivelAcesso,
  type Permissoes,
} from "@/core/domain/rbac";

const { Text } = Typography;

/**
 * Uma linha por área, um nível por linha.
 *
 * Mora fora da tela de Ajustes porque existem **dois** lugares que concedem
 * acesso — a aba de Ajustes, que olha o grupo inteiro, e a ficha da pessoa em
 * Pessoas, que olha uma só. Duas cópias desta grade seriam duas chances de uma
 * delas deixar de aplicar a trava de Ajustes depois de um refactor, e a que
 * esquecesse viraria caminho de escalar privilégio sem ninguém notar.
 *
 * `Table` do Ant e não `ProTable`: aqui não há dado que cresça nem que se
 * ordene — são as áreas do catálogo, sempre as mesmas, e o que a tabela carrega
 * são controles de formulário.
 */
export function GradeDePermissoes({
  papel,
  valor,
  aoMudar,
}: {
  papel: GroupRole;
  valor: Permissoes;
  aoMudar: (novo: Permissoes) => void;
}) {
  const { token } = theme.useToken();
  const padrao = permissoesPadrao(papel);
  const donaDeTudo = papel === "owner";

  return (
    <Flex vertical gap={8}>
      {donaDeTudo && (
        <Alert
          type="warning"
          showIcon
          title="Dona alcança tudo, sempre"
          description="O papel de dona ignora restrição por área — é o que garante que sempre exista alguém capaz de destravar o sistema. Para limitar o alcance de alguém, use Administradora ou Colaboradora."
        />
      )}
      <Table<Area>
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={[...AREAS]}
        columns={[
          {
            title: "Área",
            dataIndex: "rotulo",
            render: (_, area) => (
              <Flex vertical gap={0}>
                <Text strong style={{ fontSize: 13 }}>
                  {area.rotulo}
                </Text>
                <Text type="secondary" style={{ fontSize: 11.5 }}>
                  {area.descricao}
                </Text>
              </Flex>
            ),
          },
          {
            title: "Acesso",
            width: 290,
            align: "right",
            render: (_, area) => {
              const trava = papel !== "owner" && papel !== "admin" && area.key === "ajustes";
              return (
                <Flex vertical align="flex-end" gap={2}>
                  <Radio.Group
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                    disabled={donaDeTudo}
                    value={donaDeTudo ? "editar" : valor[area.key]}
                    onChange={(e) =>
                      aoMudar({ ...valor, [area.key]: e.target.value as NivelAcesso })
                    }
                    options={NIVEIS.filter(
                      (nivel) => !(trava && nivel === "editar"),
                    ).map((nivel) => ({ value: nivel, label: NIVEL_LABELS[nivel] }))}
                  />
                  {!donaDeTudo && valor[area.key] !== padrao[area.key] && (
                    <Text style={{ fontSize: 10.5, color: token.colorWarningText }}>
                      fora do padrão do papel
                    </Text>
                  )}
                </Flex>
              );
            },
          },
        ]}
      />
      <Text type="secondary" style={{ fontSize: 11.5 }}>
        Editar Ajustes é conceder acesso — por isso só Dona e Administradora
        chegam a esse nível.
      </Text>
    </Flex>
  );
}

/** Só a dona cria outra dona — mesma regra que a rota aplica no servidor. */
export function papeisDisponiveis(papelDeQuemEdita: GroupRole): GroupRole[] {
  return GROUP_ROLES.filter((p) => p !== "owner" || papelDeQuemEdita === "owner");
}

export function contarLiberadas(permissoes: Permissoes): number {
  return AREAS.filter((a) => permissoes[a.key] !== "nenhum").length;
}

export function resumoDeAreas(permissoes: Permissoes): string {
  const liberadas = AREAS.filter((a) => permissoes[a.key] !== "nenhum");
  if (liberadas.length === 0) return "Nenhuma área liberada.";
  return liberadas
    .map((a) => `${a.rotulo}: ${NIVEL_LABELS[permissoes[a.key]].toLowerCase()}`)
    .join(" · ");
}
