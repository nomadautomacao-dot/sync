"use client";

import { Empty, Flex, Space, Typography, theme } from "antd";

const { Text } = Typography;
const FONTE_MONO = "var(--font-sync-mono)";

export interface PontoDaSerie {
  /** O que vai no eixo horizontal — ano, competência. */
  rotulo: string | number;
  valor: number;
}

export interface LinhaDaSerie {
  nome: string;
  pontos: readonly PontoDaSerie[];
  /** Linha tracejada — para meta, projeção, referência. */
  tracejada?: boolean;
}

const LARGURA = 640;
const ALTURA = 220;
const MARGEM = { topo: 16, direita: 12, baixo: 28, esquerda: 34 };

/**
 * Série temporal de poucos pontos — IDEB por edição, e afins.
 *
 * SVG aqui, ao contrário das barras: a linha é geometria de verdade, com
 * interpolação entre pontos e um eixo com escala. O `viewBox` fixo com
 * `width: 100%` faz o desenho acompanhar o cartão sem recalcular nada em
 * JavaScript — e sem `preserveAspectRatio="none"`, que esticaria a espessura do
 * traço junto com a largura.
 *
 * A escala vertical **não começa no zero**, de propósito. Num IDEB que vai de
 * 3,9 a 4,8 a régua de 0 a 10 achata a série numa reta e esconde exatamente a
 * evolução que o gráfico existe para mostrar. A folga de 10% acima e abaixo
 * evita que o ponto extremo encoste na borda.
 */
export function SerieTemporal({
  linhas,
  formatar = (valor) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 1 }),
  vazio = "Sem série para este município.",
}: {
  linhas: readonly LinhaDaSerie[];
  formatar?: (valor: number) => string;
  vazio?: string;
}) {
  const { token } = theme.useToken();

  const comPontos = linhas.filter((linha) => linha.pontos.length > 0);
  const todos = comPontos.flatMap((linha) => linha.pontos);
  if (todos.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={vazio} />;
  }

  const rotulos = [...new Set(todos.map((p) => String(p.rotulo)))].sort();
  const valores = todos.map((p) => p.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  // Série constante teria amplitude zero e dividiria por zero; a folga fixa a
  // desenha como uma reta no meio, que é a verdade dela.
  const amplitude = maximo - minimo || Math.max(maximo * 0.1, 1);
  const piso = minimo - amplitude * 0.1;
  const teto = maximo + amplitude * 0.1;

  const x = (rotulo: string) => {
    const util = LARGURA - MARGEM.esquerda - MARGEM.direita;
    if (rotulos.length === 1) return MARGEM.esquerda + util / 2;
    return MARGEM.esquerda + (rotulos.indexOf(rotulo) / (rotulos.length - 1)) * util;
  };
  const y = (valor: number) => {
    const util = ALTURA - MARGEM.topo - MARGEM.baixo;
    return MARGEM.topo + (1 - (valor - piso) / (teto - piso)) * util;
  };

  const cores = [token.colorPrimary, token.colorTextQuaternary];

  return (
    <Flex vertical gap={8} style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={comPontos.map((l) => l.nome).join(" e ")}
      >
        {/* Três linhas de referência: piso, meio e teto. Mais que isso vira
            grade, e grade compete com a série numa figura deste tamanho. */}
        {[0, 0.5, 1].map((fracao) => {
          const valor = piso + (teto - piso) * fracao;
          return (
            <g key={fracao}>
              <line
                x1={MARGEM.esquerda}
                x2={LARGURA - MARGEM.direita}
                y1={y(valor)}
                y2={y(valor)}
                stroke={token.colorBorderSecondary}
                strokeWidth={1}
              />
              <text
                x={MARGEM.esquerda - 6}
                y={y(valor) + 3}
                textAnchor="end"
                fontSize={9}
                fill={token.colorTextQuaternary}
                fontFamily="var(--font-sync-mono)"
              >
                {formatar(valor)}
              </text>
            </g>
          );
        })}

        {rotulos.map((rotulo) => (
          <text
            key={rotulo}
            x={x(rotulo)}
            y={ALTURA - 8}
            textAnchor="middle"
            fontSize={10}
            fill={token.colorTextTertiary}
            fontFamily="var(--font-sync-mono)"
          >
            {rotulo}
          </text>
        ))}

        {comPontos.map((linha, indice) => {
          const ordenados = [...linha.pontos].sort((a, b) =>
            String(a.rotulo).localeCompare(String(b.rotulo)),
          );
          const caminho = ordenados
            .map((p, i) => `${i === 0 ? "M" : "L"} ${x(String(p.rotulo))} ${y(p.valor)}`)
            .join(" ");
          const cor = cores[indice % cores.length];

          return (
            <g key={linha.nome}>
              <path
                d={caminho}
                fill="none"
                stroke={cor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={linha.tracejada ? "5 4" : undefined}
              />
              {ordenados.map((p) => (
                <circle
                  key={String(p.rotulo)}
                  cx={x(String(p.rotulo))}
                  cy={y(p.valor)}
                  r={3.5}
                  fill={token.colorBgContainer}
                  stroke={cor}
                  strokeWidth={2}
                />
              ))}
            </g>
          );
        })}
      </svg>

      <Space size={16} wrap>
        {comPontos.map((linha, indice) => (
          <Space key={linha.nome} size={6}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 0,
                borderTop: `2px ${linha.tracejada ? "dashed" : "solid"} ${
                  cores[indice % cores.length]
                }`,
              }}
            />
            <Text type="secondary" style={{ fontSize: 11.5 }}>
              {linha.nome}
            </Text>
            <Text style={{ fontSize: 11.5, fontFamily: FONTE_MONO }}>
              {formatar(linha.pontos[linha.pontos.length - 1].valor)}
            </Text>
          </Space>
        ))}
      </Space>
    </Flex>
  );
}
