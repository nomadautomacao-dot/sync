"use client";

import { Empty, Flex, Typography, theme } from "antd";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

export interface FatiaDaBarra {
  rotulo: string;
  valor: number;
}

/**
 * Barras horizontais para composição — matrícula por etapa, e afins.
 *
 * HTML e CSS, não SVG. Para barra horizontal o texto é metade do gráfico, e
 * texto em SVG não quebra linha, não se ajusta à largura do cartão e não é
 * selecionável. O desenho aqui é só um retângulo com largura percentual; usar
 * SVG traria os problemas do SVG sem nenhuma das vantagens dele.
 *
 * A escala é sobre o **maior valor**, não sobre a soma: a leitura que interessa
 * é "os anos iniciais são o dobro da creche", e comparar cada fatia com o total
 * achata todas as pequenas contra a margem esquerda.
 */
export function BarrasHorizontais({
  dados,
  formatar = (valor) => valor.toLocaleString("pt-BR"),
  vazio = "Sem dados para este município.",
}: {
  dados: readonly FatiaDaBarra[];
  formatar?: (valor: number) => string;
  vazio?: string;
}) {
  const { token } = theme.useToken();

  const comValor = dados.filter((fatia) => fatia.valor > 0);
  if (comValor.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={vazio} />;
  }

  const maior = Math.max(...comValor.map((fatia) => fatia.valor));
  const total = comValor.reduce((soma, fatia) => soma + fatia.valor, 0);

  return (
    <Flex vertical gap={10} style={{ width: "100%" }}>
      {comValor.map((fatia) => {
        const proporcao = fatia.valor / maior;
        return (
          <Flex key={fatia.rotulo} vertical gap={4}>
            <Flex justify="space-between" align="baseline" gap={12}>
              <Text style={{ fontSize: 12 }}>{fatia.rotulo}</Text>
              <Flex gap={8} align="baseline">
                <Text strong style={{ fontFamily: FONTE_MONO, fontSize: 12 }}>
                  {formatar(fatia.valor)}
                </Text>
                <Text
                  type="secondary"
                  style={{ fontFamily: FONTE_MONO, fontSize: 11, minWidth: 38, textAlign: "right" }}
                >
                  {Math.round((fatia.valor / total) * 100)}%
                </Text>
              </Flex>
            </Flex>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: token.colorFillTertiary,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  // `max` para que a menor fatia não vire um traço invisível: um
                  // valor que existe precisa aparecer, ainda que desprezível.
                  width: `${Math.max(proporcao * 100, 1.5)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: token.colorPrimary,
                }}
              />
            </div>
          </Flex>
        );
      })}
    </Flex>
  );
}
