import type { Metadata } from "next";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { AppProviders } from "@/core/providers/app-providers";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-sync-sans",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  variable: "--font-sync-mono",
  subsets: ["latin"],
  display: "swap",
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
      <body className={`${instrumentSans.variable} ${ibmPlexMono.variable} antialiased font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
