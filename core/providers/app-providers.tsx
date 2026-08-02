"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { App, ConfigProvider } from "antd";
import ptBR from "antd/locale/pt_BR";

import { temaSync } from "@/core/design/tema-ant";
import { AuthProvider } from "@/core/providers/auth-provider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* `locale` em pt-BR não é detalhe: sem ele a tabela diz "No data",
          o seletor de data abre em inglês e a paginação escreve "items". */}
      <ConfigProvider theme={temaSync} locale={ptBR}>
        <App>
          <AuthProvider>{children}</AuthProvider>
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
