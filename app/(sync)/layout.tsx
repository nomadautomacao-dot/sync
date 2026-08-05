"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { MenuOutlined } from "@ant-design/icons";
import { Button, Grid, Layout, Result, Skeleton, theme } from "antd";

import { areaDaRota, podeVer } from "@/core/domain/rbac";
import { SyncHeader } from "@/core/components/sync-shell/header";
import { SyncSidebar } from "@/core/components/sync-shell/sidebar";
import { useAuth } from "@/core/providers/auth-provider";
import { FilaEmissaoProvider } from "@/core/providers/fila-emissao-provider";

const { useBreakpoint } = Grid;

interface SyncLayoutProps {
  children: ReactNode;
}

/**
 * A barra de cima ficou só no painel.
 *
 * Nas telas de trabalho ela repetia o título que a página já dá e gastava 74px
 * de altura (60 da barra + 14 do respiro) — numa tabela isso é uma linha e meia
 * de município. No painel ela continua fazendo sentido: é lá que a busca
 * global, o estado da carteira e os alertas têm onde morar.
 */
const ROTAS_COM_BARRA = ["/painel"];

export default function SyncLayout({ children }: SyncLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const [sidebarMobileAberta, setSidebarMobileAberta] = useState(false);
  const comBarra = ROTAS_COM_BARRA.includes(pathname);

  useEffect(() => {
    if (!loading && !user) router.replace("/entrar");
  }, [loading, user, router]);

  if (loading || !user) return <EsqueletoDoShell />;

  /**
   * Esconder o item do menu é conveniência; a guarda é aqui.
   *
   * O caminho continua alcançável por URL colada, por link antigo e por voltar
   * no histórico — sem esta conferência, tirar a área do menu daria a
   * impressão de bloqueio sem bloquear nada. Caminho fora do catálogo
   * (`null`) passa: é tela que não é área, como um detalhe solto.
   */
  const area = areaDaRota(pathname);
  const areaBloqueada = area !== null && !podeVer(user.permissoes, area);

  return (
    <FilaEmissaoProvider>
      <Layout style={{ height: "100dvh", background: token.colorBgLayout, padding: 10, gap: 10 }}>
        {/* A `SyncSidebar` decide sozinha se é `Layout.Sider` (desktop) ou
            `Drawer` (mobile) — ver o comentário no topo do componente. */}
        <SyncSidebar
          abertaNoMobile={sidebarMobileAberta}
          aoFecharNoMobile={() => setSidebarMobileAberta(false)}
        />

        <Layout style={{ background: "transparent", minWidth: 0, gap: 10, display: "flex", flexDirection: "column" }}>
          {comBarra ? (
            <SyncHeader
              sidebarMobileAberta={sidebarMobileAberta}
              aoAbrirSidebarMobile={() => setSidebarMobileAberta(true)}
            />
          ) : (
            // Sem a barra, o celular perderia o único caminho para a navegação —
            // no desktop a lateral está sempre visível e este botão não aparece.
            !screens.md && (
              <Button
                type="text"
                shape="circle"
                icon={<MenuOutlined />}
                onClick={() => setSidebarMobileAberta(true)}
                aria-label="Abrir navegação"
                aria-controls="sync-sidebar"
                aria-expanded={sidebarMobileAberta}
                style={{
                  alignSelf: "flex-start",
                  background: token.colorBgContainer,
                  boxShadow: token.boxShadowTertiary,
                }}
              />
            )
          )}

          <Layout.Content style={{ minWidth: 0, flex: 1, overflowY: "auto" }}>
            {areaBloqueada ? <SemAcesso /> : children}
          </Layout.Content>
        </Layout>
      </Layout>
    </FilaEmissaoProvider>
  );
}

const soLeitorDeTela: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function SemAcesso() {
  return (
    <Result
      status="403"
      title="Esta área não está liberada para você"
      subTitle="Se você precisa dela para trabalhar, peça a quem administra o grupo para liberar em Ajustes › Acessos."
      extra={
        <Button type="primary" href="/painel">
          Voltar ao painel
        </Button>
      }
    />
  );
}

function EsqueletoDoShell() {
  const { token } = theme.useToken();
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ display: "flex", height: "100dvh", width: "100%", gap: 10, padding: 10 }}
    >
      <span style={soLeitorDeTela}>Carregando sua sessão…</span>
      <div
        style={{
          width: 240,
          flexShrink: 0,
          borderRadius: token.borderRadiusLG,
          background: token.colorFillTertiary,
        }}
      />
      <div style={{ display: "flex", minWidth: 0, flex: 1, flexDirection: "column", gap: 10 }}>
        <Skeleton.Button active block style={{ height: 60, borderRadius: token.borderRadiusLG }} />
        <Skeleton active paragraph={{ rows: 6 }} style={{ flex: 1 }} />
      </div>
    </div>
  );
}
