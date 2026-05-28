import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

interface FundebPdfFilenameSource {
  identificacao: {
    municipioNome?: string;
    municipio?: string;
    codigoIBGE?: string;
    exercicio?: number;
  };
}

export type FundebPdfTipo = "levantamento" | "executiva" | "comparativa" | "comercial-premium";

const GERADORES: Record<FundebPdfTipo, string> = {
  levantamento: "gerador.py",
  executiva: "gerador_executiva.py",
  comparativa: "gerador_comparativa.py",
  "comercial-premium": "", // Handled by Playwright, not Python
};

const FILENAMES: Record<FundebPdfTipo, string> = {
  levantamento: "levantamento-fundeb",
  executiva: "apresentacao-executiva-fundeb",
  comparativa: "analise-comparativa-fundeb",
  "comercial-premium": "comercial-premium-fundeb",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function isFundebPdfTipo(value: string): value is FundebPdfTipo {
  return value === "levantamento" || value === "executiva" || value === "comparativa" || value === "comercial-premium";
}

export function buildFundebPdfFilename(relatorio: FundebPdfFilenameSource, tipo: FundebPdfTipo) {
  const municipio =
    relatorio.identificacao.municipioNome ||
    relatorio.identificacao.municipio ||
    relatorio.identificacao.codigoIBGE ||
    "municipio";

  const municipioSlug = slugify(municipio) || "municipio";
  const exercicio = Number.isFinite(relatorio.identificacao.exercicio)
    ? String(relatorio.identificacao.exercicio)
    : "atual";

  return `${FILENAMES[tipo]}-${municipioSlug}-${exercicio}.pdf`;
}

export async function generateFundebPdfBuffer(
  payload: unknown,
  tipo: FundebPdfTipo,
  filenameSource: FundebPdfFilenameSource,
): Promise<{ pdfBuffer: Buffer; filename: string }> {
  const gerador = GERADORES[tipo];
  const scriptPath = path.join(process.cwd(), "app/api/modulos/levantamento-fundeb/pdf", gerador);

  return await new Promise<{ pdfBuffer: Buffer; filename: string }>((resolve, reject) => {
    const pythonProcess = spawn("python", [scriptPath], { shell: true });
    let output = "";
    let errorOutput = "";

    pythonProcess.on("error", (error) => {
      reject(new Error(`Falha ao iniciar o motor PDF (${tipo}): ${error.message}`));
    });

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`Erro ao gerar PDF (${tipo}): ${errorOutput || "processo Python encerrou com falha."}`));
        return;
      }

      const pdfPath = output.trim();
      if (!pdfPath) {
        reject(new Error(`Motor PDF (${tipo}) nao retornou o caminho do arquivo gerado.`));
        return;
      }

      try {
        const pdfBuffer = await fs.readFile(pdfPath);
        await fs.unlink(pdfPath).catch(() => {});

        resolve({
          pdfBuffer,
          filename: buildFundebPdfFilename(filenameSource, tipo),
        });
      } catch (error) {
        reject(
          new Error(
            `PDF (${tipo}) foi gerado, mas nao pode ser lido pelo Sync: ${
              error instanceof Error ? error.message : "erro desconhecido"
            }`,
          ),
        );
      }
    });

    pythonProcess.stdin.write(JSON.stringify(payload));
    pythonProcess.stdin.end();
  });
}
