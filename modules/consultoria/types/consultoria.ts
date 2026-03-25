export interface ConsultoriaProject {
  id: string;
  name: string;
  companyId: string;
  status: "planned" | "in_progress" | "completed";
  dueDate: string;
}
