"use client";

import { CheckOutlined, WarningOutlined } from "@ant-design/icons";
import { Flex, Tooltip, Typography, theme } from "antd";

import { estaAtrasada, ordenarCronograma, type EtapaDoCronograma } from "@/core/domain/cronograma";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

/**
 * O cronograma desenhado como fluxo.
 *
 * É o "fluxograma" que a implantação já é — e a diferença para um quadro de
 * caixas arrastáveis é que aqui **ninguém arruma nada**: a posição sai da ordem
 * das etapas e a cor sai do estado real. Um canvas livre teria de ser montado à
 * mão em cada município da carteira, e ficaria em branco nos que ninguém teve
 * tempo de desenhar.
 *
 * Etapa avulsa aparece com marca própria: ver de relance o que é o processo
 * padrão e o que foi acrescentado por causa daquele município é metade da
 * leitura.
 */
export function FluxoDoCronograma({
  etapas,
  agora,
  aoClicar,
}: {
  etapas: readonly EtapaDoCronograma[];
  agora: Date;
  aoClicar?: (etapa: EtapaDoCronograma) => void;
}) {
  const { token } = theme.useToken();
  const ordenadas = ordenarCronograma(etapas);

  const corDaEtapa = (etapa: EtapaDoCronograma) => {
    if (etapa.estado === "concluida") return token.colorSuccess;
    if (estaAtrasada(etapa, agora)) return token.colorError;
    if (etapa.estado === "em_andamento") return token.colorPrimary;
    return token.colorTextQuaternary;
  };

  return (
    <Flex
      align="stretch"
      gap={0}
      /* Rola no eixo próprio: com dez etapas o fluxo passa da largura do cartão,
         e a página inteira nunca deve rolar de lado por causa de um componente. */
      style={{ width: "100%", overflowX: "auto", paddingBottom: 8 }}
    >
      {ordenadas.map((etapa, indice) => {
        const cor = corDaEtapa(etapa);
        const concluida = etapa.estado === "concluida";
        const atrasada = estaAtrasada(etapa, agora);

        return (
          <Flex key={etapa.id} align="flex-start" style={{ flex: "0 0 auto" }}>
            {indice > 0 && (
              <div
                aria-hidden
                style={{
                  width: 28,
                  height: 2,
                  marginTop: 15,
                  flex: "0 0 auto",
                  /* O traço até uma etapa concluída fica cheio; daí em diante,
                     apagado. A linha vira a barra de progresso do fluxo. */
                  background: concluida ? token.colorSuccess : token.colorBorderSecondary,
                }}
              />
            )}

            <Tooltip
              title={
                <Flex vertical gap={2}>
                  <Text style={{ color: token.colorTextLightSolid, fontSize: 12 }}>
                    {etapa.nome}
                  </Text>
                  <Text style={{ color: token.colorTextLightSolid, fontSize: 11, opacity: 0.75 }}>
                    prazo {formatarPrazo(etapa.prazo)}
                    {etapa.concluidaPor ? ` · concluída por ${etapa.concluidaPor}` : ""}
                  </Text>
                </Flex>
              }
            >
              <Flex
                vertical
                align="center"
                gap={6}
                onClick={aoClicar ? () => aoClicar(etapa) : undefined}
                style={{
                  width: 116,
                  cursor: aoClicar ? "pointer" : "default",
                  padding: "0 4px",
                }}
              >
                <Flex
                  align="center"
                  justify="center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    flex: "0 0 auto",
                    border: `2px ${etapa.modeloKey ? "solid" : "dashed"} ${cor}`,
                    background: concluida ? cor : token.colorBgContainer,
                    color: concluida ? token.colorBgContainer : cor,
                    fontFamily: FONTE_MONO,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {concluida ? <CheckOutlined /> : atrasada ? <WarningOutlined /> : indice + 1}
                </Flex>

                <Text
                  style={{
                    fontSize: 11,
                    textAlign: "center",
                    lineHeight: 1.25,
                    color: concluida ? token.colorTextTertiary : token.colorText,
                  }}
                >
                  {etapa.nome}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: FONTE_MONO,
                    color: atrasada ? token.colorError : token.colorTextQuaternary,
                  }}
                >
                  {formatarPrazo(etapa.prazo)}
                </Text>
              </Flex>
            </Tooltip>
          </Flex>
        );
      })}
    </Flex>
  );
}

function formatarPrazo(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}` : "—";
}
