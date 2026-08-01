"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppstoreOutlined,
  BankOutlined,
  CloseOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  RiseOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Drawer,
  Grid,
  Layout,
  Menu,
  Popover,
  Typography,
  theme,
} from "antd";
import type { MenuProps } from "antd";

import { useAuth } from "@/core/providers/auth-provider";

const { Sider } = Layout;
const { useBreakpoint } = Grid;
const { Text, Paragraph } = Typography;

interface ItemDeNavegacao {
  rotulo: string;
  rota: string;
  icone: React.ComponentType;
}

interface SyncSidebarProps {
  abertaNoMobile: boolean;
  aoFecharNoMobile: () => void;
}

const NAV_ITEMS: readonly ItemDeNavegacao[] = [
  { rotulo: "Painel", rota: "/painel", icone: DashboardOutlined },
  { rotulo: "Caixa de entrada", rota: "/caixa", icone: InboxOutlined },
  { rotulo: "Cidades", rota: "/cidades", icone: EnvironmentOutlined },
  { rotulo: "Pipeline", rota: "/pipeline", icone: RiseOutlined },
  { rotulo: "Empresas", rota: "/empresas", icone: BankOutlined },
  { rotulo: "Pessoas", rota: "/pessoas", icone: TeamOutlined },
  { rotulo: "Documentos", rota: "/documentos", icone: FolderOpenOutlined },
  { rotulo: "Módulos", rota: "/modulos", icone: AppstoreOutlined },
  { rotulo: "Ajustes", rota: "/ajustes", icone: SettingOutlined },
];

function formatarNomeExibicao(name?: string | null, email?: string | null): string {
  if (name && name.trim()) return name.trim();
  if (email) {
    const handle = email.split("@")[0];
    const semNumeros = handle.replace(/\d+/g, " ").trim();
    if (semNumeros) {
      return semNumeros
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }
  return "Marcos Rocha";
}

export function SyncSidebar({ abertaNoMobile, aoFecharNoMobile }: SyncSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { token } = theme.useToken();
  // `Grid.useBreakpoint` é o jeito do próprio Ant de decidir layout por
  // largura de tela — substitui os breakpoints `md:`/`xl:` do Tailwind sem
  // precisar de CSS à parte.
  const screens = useBreakpoint();
  const [recolhida, setRecolhida] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);

  useEffect(() => {
    const abrirAjudaPorAtalho = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAjudaAberta(false);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();
        setAjudaAberta((aberta) => !aberta);
      }
    };

    window.addEventListener("keydown", abrirAjudaPorAtalho);
    return () => window.removeEventListener("keydown", abrirAjudaPorAtalho);
  }, []);

  const fecharNavegacaoMobile = () => {
    aoFecharNoMobile();
    setAjudaAberta(false);
  };

  const nomeExibicao = formatarNomeExibicao(user?.name, user?.email);
  const iniciais =
    nomeExibicao
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "GS";

  const chaveAtiva = NAV_ITEMS.find(
    (item) =>
      pathname === item.rota ||
      (item.rota !== "/painel" && pathname.startsWith(`${item.rota}/`)),
  )?.rota;

  const itensDoMenu: MenuProps["items"] = NAV_ITEMS.map((item) => {
    const Icone = item.icone;
    return {
      key: item.rota,
      icon: <Icone />,
      // `title` fixa o texto do tooltip que o Menu mostra sozinho quando
      // recolhido — sem isso ele tentaria usar o `label` (um <Link>) inteiro.
      title: item.rotulo,
      label: (
        <Link href={item.rota} onClick={fecharNavegacaoMobile}>
          {item.rotulo}
        </Link>
      ),
    };
  });

  /**
   * Conteúdo compartilhado entre a barra fixa (desktop) e a gaveta (mobile).
   * `compacta` só vale no desktop recolhido: a gaveta abre por cima da tela e
   * sempre mostra os rótulos por extenso, porque não precisa economizar
   * largura como a barra fixa precisa.
   */
  const conteudo = (compacta: boolean) => (
    <div style={{ display: "flex", height: "100%", minHeight: 0, flexDirection: "column" }}>
      <Menu
        mode="inline"
        inlineCollapsed={compacta}
        selectedKeys={chaveAtiva ? [chaveAtiva] : []}
        items={itensDoMenu}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", borderInlineEnd: "none" }}
      />

      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <Popover
          open={ajudaAberta}
          onOpenChange={setAjudaAberta}
          trigger="click"
          placement="topLeft"
          content={
            <div style={{ width: 260 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text strong style={{ fontSize: 12.5 }}>
                  Atalhos rápidos
                </Text>
                <Button
                  type="text"
                  size="small"
                  shape="circle"
                  icon={<CloseOutlined style={{ fontSize: 11 }} />}
                  onClick={() => setAjudaAberta(false)}
                  aria-label="Fechar ajuda"
                />
              </div>
              <Paragraph type="secondary" style={{ fontSize: 10.5, marginTop: 4, marginBottom: 8 }}>
                Acesse as áreas do workspace pelo menu e use o atalho para consultar esta ajuda.
              </Paragraph>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
                <span>Abrir esta ajuda</span>
                <Text keyboard>Ctrl /</Text>
              </div>
            </div>
          }
        >
          <Button
            type="text"
            icon={<QuestionCircleOutlined />}
            block
            aria-expanded={ajudaAberta}
            aria-label="Ajuda e atalhos"
            style={compacta ? undefined : { display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8 }}
          >
            {!compacta && (
              <>
                <span style={{ flex: 1, textAlign: "left" }}>Ajuda e atalhos</span>
                <Text keyboard style={{ fontSize: 9 }}>
                  Ctrl /
                </Text>
              </>
            )}
          </Button>
        </Popover>

        <Link href="/ajustes" onClick={fecharNavegacaoMobile} aria-label={`Abrir ajustes do perfil de ${nomeExibicao}`}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: compacta ? 6 : "8px 10px",
              borderRadius: token.borderRadiusLG,
              background: token.colorFillTertiary,
              justifyContent: compacta ? "center" : "flex-start",
            }}
          >
            <Avatar size={32} style={{ backgroundColor: token.colorPrimary, fontWeight: 700, fontSize: 11.5 }}>
              {iniciais}
            </Avatar>

            {!compacta && (
              <>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text strong ellipsis style={{ display: "block", fontSize: 12.5 }}>
                    {nomeExibicao}
                  </Text>
                  <Text type="secondary" style={{ display: "block", fontSize: 10 }}>
                    Admin do grupo
                  </Text>
                </div>
                <RightOutlined style={{ color: token.colorTextQuaternary, fontSize: 13 }} />
              </>
            )}
          </div>
        </Link>
      </div>
    </div>
  );

  const logo = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Image src="/global-sync-icon.png" alt="Global Sync" width={28} height={28} priority style={{ borderRadius: 6 }} />
      <Text strong style={{ fontSize: 16 }}>
        Global Sync
      </Text>
    </div>
  );

  // Abaixo do breakpoint md a barra vira gaveta: mesmo conteúdo, outra casca.
  // Ant `Drawer` já resolve backdrop, foco preso e fechar por Esc — o overlay
  // manual (bg + backdrop-blur + translate-x) que existia antes some inteiro.
  if (!screens.md) {
    return (
      <Drawer
        title={logo}
        placement="left"
        open={abertaNoMobile}
        onClose={fecharNavegacaoMobile}
        width={280}
        aria-label="Barra lateral"
        styles={{ body: { padding: 0, display: "flex" } }}
      >
        {conteudo(false)}
      </Drawer>
    );
  }

  return (
    <Sider
      id="sync-sidebar"
      aria-label="Barra lateral"
      theme="light"
      trigger={null}
      collapsed={recolhida}
      collapsedWidth={68}
      width={240}
    >
      <div style={{ display: "flex", height: "100%", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: recolhida ? "center" : "space-between",
            padding: 12,
          }}
        >
          {recolhida ? (
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setRecolhida(false)}
              aria-label="Expandir barra lateral"
              title="Expandir barra lateral"
            />
          ) : (
            <>
              {logo}
              <Button
                type="text"
                icon={<MenuFoldOutlined />}
                onClick={() => setRecolhida(true)}
                aria-label="Recolher barra lateral"
                title="Recolher barra lateral"
              />
            </>
          )}
        </div>

        {conteudo(recolhida)}
      </div>
    </Sider>
  );
}
