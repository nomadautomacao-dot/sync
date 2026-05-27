import { z } from "zod";

export const moduleKeys = [
  "consultoria",
  "fundeb",
  "levantamento-fundeb",
  "levantamento-lite-fundeb",
  "contrato-fundeb",
  "terceirizacao",
  "formacao",
  "atas-registro-preco",
  "tecnologia",
  "case-de-sucesso",
  "kit-documental",
  "propostas",
  "slides",
] as const;


export const moduleKeySchema = z.enum(moduleKeys);

export type ModuleKey = z.infer<typeof moduleKeySchema>;

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
  color: string;
}

export const moduleCatalog: ModuleDefinition[] = [
  {
    key: "consultoria",
    label: "Consultoria",
    description: "Projetos, entregas, contratos e pareceres.",
    color: "var(--sync-status-info)",
  },
  {
    key: "fundeb",
    label: "Consultoria FUNDEB",
    description: "Municipios, indicadores, projecao de faturamento e comissao do colaborador.",
    color: "var(--sync-status-active)",
  },
  {
    key: "levantamento-fundeb",
    label: "Levantamento FUNDEB",
    description: "Diagnostico automatico por codigo IBGE com projecao, preview tecnico e exportacao em PDF.",
    color: "var(--sync-accent)",
  },
  {
    key: "terceirizacao",
    label: "Terceirizacao",
    description: "Contratos, alocacoes e custos operacionais.",
    color: "var(--sync-status-warning)",
  },
  {
    key: "formacao",
    label: "Formacao",
    description: "Treinamentos, certificados e presencas.",
    color: "var(--sync-status-purple)",
  },
  {
    key: "atas-registro-preco",
    label: "Atas de Registro de Preco",
    description: "Saldos, adesoes e vigencias de itens.",
    color: "var(--sync-accent)",
  },
  {
    key: "tecnologia",
    label: "Tecnologia",
    description: "Inventario, suporte e projetos internos.",
    color: "var(--sync-text-secondary)",
  },
  {
    key: "case-de-sucesso",
    label: "Case de Sucesso",
    description: "Analise dinamica da evolucao do FUNDEB (2024-2025).",
    color: "var(--sync-accent-hover)",
  },
  {
    key: "contrato-fundeb",
    label: "Contrato FUNDEB",
    description: "Geracao modular de processo administrativo e contrato (15 anexos) sob a Lei 14.133/21.",
    color: "var(--sync-status-active)",
  },
  {
    key: "levantamento-lite-fundeb",
    label: "Levantamento Lite FUNDEB",
    description: "Resumo infografico de ate duas paginas com indicadores-chave do FUNDEB.",
    color: "var(--sync-accent)",
  },
  {
    key: "kit-documental",
    label: "Kit Documental",
    description: "Organizacao e gestao de documentos de habilitacao, certidoes e contratos.",
    color: "var(--sync-status-info)",
  },
  {
    key: "propostas",
    label: "Propostas Comerciais",
    description: "Criacao e padronizacao de propostas de servicos.",
    color: "var(--sync-status-active)",
  },
  {
    key: "slides",
    label: "Slides",
    description: "Apresentacoes corporativas com dados reais do municipio.",
    color: "var(--sync-status-purple)",
  },
];
