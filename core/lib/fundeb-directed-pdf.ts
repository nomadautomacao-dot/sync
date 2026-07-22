import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { RelatorioDirigidoMunicipio } from "@/modules/levantamento-fundeb/types";
import { resolvePythonCommand } from "@/core/lib/python-runtime";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function buildDirectedFundebPdfFilename(report: RelatorioDirigidoMunicipio) {
  const municipioSlug = slugify(report.municipio || report.codigoIbge || "municipio") || "municipio";
  return `relatorio-dirigido-fundeb-${municipioSlug}.pdf`;
}

