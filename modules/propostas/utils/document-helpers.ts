import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  PageNumber,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from "docx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
// @ts-expect-error numero-por-extenso has no types available
import * as extenso from "numero-por-extenso";
import type { Company } from "@/core/domain/organization";
import {
  DEFAULT_EMPRESA_CONFIG,
  type EmpresaConfig,
  type GeneroAutoridade,
} from "../types";

export const PAGE_MARGINS = {
  top: 900,
  right: 900,
  bottom: 900,
  left: 900,
  header: 420,
  footer: 420,
};

export function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateLong(value: string) {
  return format(new Date(`${value}T12:00:00`), "d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

export function formatDateMonthYear(value: string) {
  return format(new Date(`${value}T12:00:00`), "MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

export function toUpper(value: string) {
  return value.toLocaleUpperCase("pt-BR");
}

export function monetaryExtenso(value: number) {
  return extenso.porExtenso(value, extenso.estilo.monetario);
}

export function numberExtenso(value: number) {
  return extenso.porExtenso(value);
}

export function resolveGenderTerms(gender: GeneroAutoridade) {
  return {
    tituloSocial: gender === "feminino" ? "Sra." : "Sr.",
    possessivo: gender === "feminino" ? "sua" : "seu",
    residente: gender === "feminino" ? "residente e domiciliada" : "residente e domiciliado",
  };
}

export function buildCompanyAddress(config: EmpresaConfig) {
  return `${config.endereco}, CEP ${config.cep}, ${config.cidade} - ${config.uf}`;
}

export function buildEmitterConfig(config?: EmpresaConfig, company?: Company | null): EmpresaConfig {
  if (!company) {
    return config ?? DEFAULT_EMPRESA_CONFIG;
  }

  return {
    nome: company.name || company.tradingName || DEFAULT_EMPRESA_CONFIG.nome,
    cnpj: company.cnpj || DEFAULT_EMPRESA_CONFIG.cnpj,
    endereco: [company.street, company.number, company.neighborhood].filter(Boolean).join(", "),
    cep: company.zipCode || DEFAULT_EMPRESA_CONFIG.cep,
    cidade: company.city || DEFAULT_EMPRESA_CONFIG.cidade,
    uf: company.state || DEFAULT_EMPRESA_CONFIG.uf,
    representanteNome: company.contactName || DEFAULT_EMPRESA_CONFIG.representanteNome,
    representanteCargo: company.contactPosition || DEFAULT_EMPRESA_CONFIG.representanteCargo,
    representanteRg: DEFAULT_EMPRESA_CONFIG.representanteRg,
    representanteCpf: DEFAULT_EMPRESA_CONFIG.representanteCpf,
  };
}

export function createText(
  text: string,
  options?: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    break?: number;
  },
) {
  return new TextRun({
    text,
    bold: options?.bold,
    italics: options?.italics,
    size: options?.size,
    break: options?.break,
  });
}

export function createParagraph(
  text: string,
  options?: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bold?: boolean;
    italics?: boolean;
    size?: number;
    spacingAfter?: number;
    spacingBefore?: number;
    indentLeft?: number;
  },
) {
  return new Paragraph({
    alignment: options?.align ?? AlignmentType.JUSTIFIED,
    spacing: {
      before: options?.spacingBefore ?? 0,
      after: options?.spacingAfter ?? 120,
      line: 276,
    },
    indent: options?.indentLeft ? { left: options.indentLeft } : undefined,
    children: [
      createText(text, {
        bold: options?.bold,
        italics: options?.italics,
        size: options?.size,
      }),
    ],
  });
}

export function createBulletedParagraph(label: string, text: string) {
  return new Paragraph({
    spacing: { after: 90, line: 276 },
    indent: { left: 360 },
    children: [createText(`${label} ${text}`)],
  });
}

export function createStandardSection(children: ISectionOptions["children"], header: Header, footer: Footer): ISectionOptions {
  return {
    properties: {
      page: {
        margin: PAGE_MARGINS,
      },
    },
    headers: { default: header },
    footers: { default: footer },
    children,
  };
}

export function createStandardFooter(prefix: string) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          createText(prefix),
          new TextRun({ children: [PageNumber.CURRENT] }),
          createText(" de "),
          new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
        ],
      }),
    ],
  });
}

export function createProposalHeader(company: EmpresaConfig) {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          createText(company.nome, { bold: true, size: 24 }),
          createText(` | CNPJ: ${company.cnpj}`, { size: 22 }),
        ],
      }),
    ],
  });
}

export function createMinutaHeader() {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          createText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS ESPECIALIZADOS", {
            bold: true,
            size: 24,
          }),
        ],
      }),
    ],
  });
}

export function createCellBorders() {
  return {
    top: { color: "CBD5E1", style: BorderStyle.SINGLE, size: 1 },
    right: { color: "CBD5E1", style: BorderStyle.SINGLE, size: 1 },
    bottom: { color: "CBD5E1", style: BorderStyle.SINGLE, size: 1 },
    left: { color: "CBD5E1", style: BorderStyle.SINGLE, size: 1 },
  };
}

export function triggerDocumentDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
