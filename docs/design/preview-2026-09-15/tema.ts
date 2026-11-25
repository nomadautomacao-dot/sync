import type { ThemeConfig } from 'antd';

// Proposta isolada: não altera temaSync nem o ConfigProvider da aplicação.
export const identidade = { lima: '#E4FB02', tinta: '#171A17', papel: '#F7F7F2' };
export const tema: ThemeConfig = {
  token: {
    colorPrimary: identidade.tinta, colorLink: identidade.tinta,
    colorText: identidade.tinta, colorTextSecondary: '#62665D',
    colorBgLayout: identidade.papel, colorBgContainer: '#FFFFFF',
    colorBorder: '#DDDFD5', colorBorderSecondary: '#E6E7DF',
    colorFillAlter: '#F0F0E9', borderRadius: 8, fontSize: 14,
    fontFamily: '"Instrument Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    fontFamilyCode: '"IBM Plex Mono", ui-monospace, monospace',
  },
  components: {
    Button: { primaryShadow: 'none', controlHeight: 36 },
    Table: { headerBg: '#F0F0E9', headerColor: '#62665D', rowHoverBg: '#F7F7F2', cellPaddingBlockSM: 7 },
    Card: { borderRadiusLG: 12 },
    Menu: { itemSelectedBg: identidade.lima, itemSelectedColor: identidade.tinta },
  },
};
