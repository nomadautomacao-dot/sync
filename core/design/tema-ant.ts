import type { ThemeConfig } from "antd";

/**
 * O tema do Global Sync sobre o Ant Design.
 *
 * A base é o tema padrão do Ant, de propósito: ele já resolve estado de foco,
 * desabilitado, hover, contraste e densidade em cerca de setenta componentes.
 * Cada valor sobrescrito aqui é um valor que passa a ser nosso para manter, e a
 * razão de trocar para o Ant foi justamente parar de manter aparência.
 *
 * Por isso a lista abaixo é curta e tem justificativa item a item. Se ela
 * crescer muito, o certo não é continuar somando: é perguntar se ainda faz
 * sentido usar o Ant.
 *
 * ## O que não mudamos, e por quê
 *
 * - **Densidade**: o padrão do Ant já é denso. `size="small"` nas tabelas
 *   resolve o resto, sem tocar em token.
 * - **Cores de estado** (sucesso, alerta, erro): as do Ant são calibradas para
 *   contraste AA sobre os fundos dele. As nossas antigas não eram.
 */

/** Quase-preto da marca. Era o accent do Console Soft e continua sendo. */
const PRETO_MARCA = "#16181D";

export const temaSync: ThemeConfig = {
  token: {
    /* O azul padrão do Ant é o traço mais reconhecível dele, e num material
       que vai para prefeitura ele lê como "sistema genérico". O quase-preto
       mantém a sobriedade que a marca já tinha. */
    colorPrimary: PRETO_MARCA,
    colorLink: PRETO_MARCA,

    /* As duas famílias já carregadas pelo `next/font` no layout raiz. A
       separação interface/dado é a única regra tipográfica do produto: número
       em monoespaçada alinha em coluna e permite varrer a tabela. */
    fontFamily: "var(--font-sync-sans), system-ui, sans-serif",
    fontFamilyCode: "var(--font-sync-mono), ui-monospace, monospace",

    /* O Ant usa 6px; 8px aproxima do arredondado que o produto já tinha sem
       cair no excesso de 16–20px do Console Soft, que era o que fazia a tela
       parecer aplicativo de consumo. */
    borderRadius: 8,
  },

  components: {
    /* A tabela é a espinha do produto: carteira, pipeline, documentos, pasta da
       cidade. Cabeçalho mais claro que o padrão para a linha de dados dominar. */
    Table: {
      headerBg: "#FAFAFC",
      headerColor: "#767A86",
      rowHoverBg: "#F7F6FA",
      borderColor: "#F0F1F5",
    },

    /* Botão sem sombra: o padrão do Ant tem uma sombra sutil no primário que,
       repetida numa barra de ferramentas, vira ruído. */
    Button: {
      primaryShadow: "none",
    },

    Layout: {
      siderBg: "#FFFFFF",
      headerBg: "#FFFFFF",
      bodyBg: "#F5F5F7",
    },
  },
};
