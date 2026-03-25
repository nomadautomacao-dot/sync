"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/core/lib/utils";

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed?: boolean;
}

export function SidebarItem({ href, label, icon: Icon, collapsed }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        collapsed ? "justify-center px-2.5" : "justify-start",
        isActive
          ? "bg-neutral-800 text-white"
          : "text-neutral-300 hover:bg-neutral-800 hover:text-white",
      )}
      title={label}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-colors",
        isActive ? "text-neutral-200" : "text-neutral-400 group-hover:text-neutral-200",
      )} />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}
