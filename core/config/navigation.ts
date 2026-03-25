import {
  Building2,
  Inbox,
  Layers3,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

export const workspaceNavigation = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/inbox",
    label: "Inbox",
    icon: Inbox,
  },
  {
    href: "/companies",
    label: "Empresas",
    icon: Building2,
  },
  {
    href: "/people",
    label: "Colaboradores",
    icon: Users,
  },
  {
    href: "/modules",
    label: "Modulos",
    icon: Layers3,
  },
  {
    href: "/settings",
    label: "Configuracoes",
    icon: Settings,
  },
];
