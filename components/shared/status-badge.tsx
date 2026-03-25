import { Badge } from "@/components/ui/badge";

type StatusType = "active" | "inactive" | "on_leave" | "warning" | "error";

interface StatusBadgeProps {
  status: StatusType;
}

const statusMap: Record<
  StatusType,
  {
    label: string;
    variant: "active" | "default" | "warning" | "error";
    className: string;
  }
> = {
  active: {
    label: "ATIVO",
    variant: "active",
    className:
      "rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium tracking-normal text-green-400",
  },
  inactive: {
    label: "INATIVO",
    variant: "default",
    className:
      "rounded bg-neutral-700/25 px-2 py-0.5 text-xs font-medium tracking-normal text-neutral-300",
  },
  on_leave: {
    label: "AFASTADO",
    variant: "warning",
    className:
      "rounded bg-orange-500/10 px-2 py-0.5 text-xs font-medium tracking-normal text-orange-400",
  },
  warning: {
    label: "ATENCAO",
    variant: "warning",
    className:
      "rounded bg-orange-500/10 px-2 py-0.5 text-xs font-medium tracking-normal text-orange-400",
  },
  error: {
    label: "ERRO",
    variant: "error",
    className:
      "rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium tracking-normal text-red-400",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
