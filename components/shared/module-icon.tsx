import { BookOpen, BriefcaseBusiness, Cpu, Handshake, MapPinned, ShieldCheck, Trophy, Users2, FileText } from "lucide-react";
import type { ModuleKey } from "@/core/domain/module";

interface ModuleIconProps {
  moduleKey: ModuleKey;
  className?: string;
}

const iconMap = {
  consultoria: BriefcaseBusiness,
  fundeb: ShieldCheck,
  "levantamento-fundeb": MapPinned,
  terceirizacao: Users2,
  formacao: BookOpen,
  "atas-registro-preco": Handshake,
  tecnologia: Cpu,
  "case-de-sucesso": Trophy,
  propostas: FileText,
} as const;

export function ModuleIcon({ moduleKey, className }: ModuleIconProps) {
  const Icon = iconMap[moduleKey as keyof typeof iconMap] || BriefcaseBusiness;
  return <Icon className={className ?? "h-4 w-4"} />;
}
