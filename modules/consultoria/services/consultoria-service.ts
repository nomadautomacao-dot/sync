import type { ConsultoriaProject } from "@/modules/consultoria/types/consultoria";

const projects: ConsultoriaProject[] = [
  {
    id: "prj_1",
    name: "Plano diretor de compras",
    companyId: "cmp_alpha",
    status: "in_progress",
    dueDate: "2026-05-10",
  },
  {
    id: "prj_2",
    name: "Revisao de contratos de transporte",
    companyId: "cmp_beta",
    status: "planned",
    dueDate: "2026-07-15",
  },
];

export function listConsultoriaProjects() {
  return projects;
}
