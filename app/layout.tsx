import type { Metadata } from "next";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProviders } from "@/core/providers/app-providers";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-sync-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * A monoespaçada é a fonte dos números, e número só existe depois do login.
 *
 * Com `preload` ligado, o navegador baixava os três pesos já na tela de
 * entrada e depois avisava, com razão, que os baixou à toa — era esse o
 * "preloaded but not used" que enchia o console. Sem o preload ela é buscada
 * quando a primeira tabela aparece, e `display: swap` garante que o texto não
 * fique invisível durante a busca.
 */
const ibmPlexMono = IBM_Plex_Mono({
  /* O 700 entra porque 33 pontos da interface pedem negrito em número; sem ele
     o navegador engorda a letra por conta própria e o dígito sai borrado. */
  weight: ["400", "500", "600", "700"],
  variable: "--font-sync-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Global Sync — Console Operacional",
  description: "Plataforma de automação e gestão para consultoria FUNDEB",
  icons: {
    icon: "/sync-mark.svg",
    shortcut: "/sync-mark.svg",
    apple: "/sync-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      {/* As classes daqui eram do Tailwind. O que elas faziam — suavizar a
          fonte e aplicar a família de interface — passou para `globals.css`;
          o `className` continua só para expor as variáveis do `next/font`. */}
      <body className={`${instrumentSans.variable} ${ibmPlexMono.variable}`}>
        {/* O Ant gera estilo em tempo de execução. Sem este registro, o
            servidor manda HTML sem CSS e a primeira tela pisca sem estilo
            antes de o JavaScript assumir. */}
        <AntdRegistry>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
