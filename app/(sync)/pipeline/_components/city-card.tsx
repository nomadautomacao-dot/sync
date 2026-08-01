"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Avatar, Progress, Space, Tag, Typography, theme } from "antd";

import type { CityAccount } from "@/core/lib/city-types";
import { formatCurrencyCompact } from "@/core/lib/city-types";

import { cardAlert, isHot, initials, nextStepLine } from "./stage-helpers";

/**
 * O cartão que se arrasta entre as colunas do pipeline.
 *
 * Continua sendo `div` própria, e não `Card` do Ant, por um motivo: o
 * `useDraggable` precisa aplicar `ref`, `style` e os ouvintes de evento no
 * mesmo elemento que recebe o clique. Passar isso por um componente que
 * envolve o nó em camadas próprias é onde o arrasto começa a falhar de formas
 * difíceis de enxergar. O conteúdo interno é todo Ant.
 */
interface CityCardProps {
  city: CityAccount;
  isSelected: boolean;
  onSelect: (city: CityAccount) => void;
}

export function CityCard({ city, isSelected, onSelect }: CityCardProps) {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: city.id, data: { city } });

  const alerta = cardAlert(city);
  const quente = isHot(city);
  const passo = nextStepLine(city);

  const corDaProbabilidade =
    city.probability >= 70
      ? token.colorSuccess
      : city.probability >= 40
        ? token.colorPrimary
        : token.colorWarning;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(city)}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.6 : 1,
        background: token.colorBgContainer,
        border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorderSecondary}`,
        boxShadow: isSelected ? `0 0 0 2px ${token.colorPrimaryBg}` : token.boxShadowTertiary,
        borderRadius: token.borderRadiusLG,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Space size={4}>
            <Typography.Text strong ellipsis style={{ fontSize: 12 }}>
              {city.name}
            </Typography.Text>
            <Tag
              style={{ marginInlineEnd: 0, fontFamily: "var(--font-sync-mono)", fontSize: 9 }}
            >
              {city.uf}
            </Tag>
          </Space>
          <div
            style={{
              fontFamily: "var(--font-sync-mono)",
              fontSize: 14,
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {city.estimatedAnnualRevenue
              ? formatCurrencyCompact(city.estimatedAnnualRevenue)
              : "R$ 0"}
          </div>
        </div>

        <div style={{ width: 52, textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-sync-mono)", fontSize: 11, fontWeight: 600 }}>
            {city.probability}%
          </div>
          <Progress
            percent={city.probability}
            showInfo={false}
            size="small"
            strokeColor={corDaProbabilidade}
          />
        </div>
      </div>

      {passo && (
        <Typography.Text
          type="secondary"
          ellipsis
          style={{
            fontSize: 11,
            background: token.colorFillQuaternary,
            borderRadius: token.borderRadius,
            padding: "4px 8px",
          }}
        >
          <ClockCircleOutlined /> {passo}
        </Typography.Text>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          paddingTop: 6,
        }}
      >
        <Space size={6}>
          <Avatar
            size={22}
            style={{
              fontSize: 9,
              fontFamily: "var(--font-sync-mono)",
              backgroundColor: quente
                ? token.colorPrimary
                : alerta === "due"
                  ? token.colorWarning
                  : token.colorFillSecondary,
              color: quente || alerta === "due" ? "#FFFFFF" : token.colorText,
            }}
          >
            {initials(city.name)}
          </Avatar>
          <Typography.Text type="secondary" ellipsis style={{ fontSize: 10, maxWidth: 100 }}>
            {city.collaboratorName || "Sem responsável"}
          </Typography.Text>
        </Space>

        {alerta !== "none" && (
          <Tag color="warning" style={{ marginInlineEnd: 0, fontSize: 10 }}>
            {alerta === "idle" ? (
              <>
                <ClockCircleOutlined /> +7d
              </>
            ) : (
              <>
                <CalendarOutlined /> Prazo
              </>
            )}
          </Tag>
        )}
      </div>
    </div>
  );
}
