"use client";

import {
  CheckCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  FormOutlined,
  PaperClipOutlined,
  PhoneOutlined,
  ProjectOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { theme } from "antd";

import type { TipoDeEvento } from "@/core/domain/cidade-eventos";

/**
 * Ícone e cor de cada tipo de acontecimento.
 *
 * Mora fora das duas telas que o usam — a linha do tempo e o diálogo de
 * registro — porque a cor precisa ser **a mesma nos dois**: a pessoa escolhe
 * "visita" no verde e procura o verde na lista depois. Duas cópias seriam duas
 * chances de divergirem numa edição, e a divergência quebraria exatamente a
 * associação que a cor existe para criar.
 *
 * Sai do token, nunca de hexadecimal, para acompanhar o tema.
 */
export type TokenDoTema = ReturnType<typeof theme.useToken>["token"];

export const ICONE_DO_TIPO: Record<TipoDeEvento, React.ComponentType> = {
  reuniao: TeamOutlined,
  visita: EnvironmentOutlined,
  ligacao: PhoneOutlined,
  relatorio_campo: FileTextOutlined,
  nota: FormOutlined,
  documento: PaperClipOutlined,
  etapa: CheckCircleOutlined,
  iniciativa: ProjectOutlined,
};

export const COR_DO_TIPO: Record<TipoDeEvento, (t: TokenDoTema) => string> = {
  reuniao: (t) => t.colorPrimary,
  visita: (t) => t.colorSuccess,
  ligacao: (t) => t.cyan,
  relatorio_campo: (t) => t.gold,
  nota: (t) => t.colorTextTertiary,
  documento: (t) => t.purple,
  etapa: (t) => t.colorSuccess,
  iniciativa: (t) => t.magenta,
};

export function IconeDoTipo({ tipo }: { tipo: TipoDeEvento }) {
  const { token } = theme.useToken();
  const Icone = ICONE_DO_TIPO[tipo];
  return (
    <span style={{ color: COR_DO_TIPO[tipo](token), fontSize: 14, lineHeight: 1 }}>
      <Icone />
    </span>
  );
}
