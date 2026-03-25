import type { ReactNode } from "react";
import { ThreePaneLayout } from "@/components/layout/three-pane-layout";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <ThreePaneLayout>{children}</ThreePaneLayout>;
}
