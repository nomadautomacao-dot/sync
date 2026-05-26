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

export function buildDirectedFundebPdfFilename(report: RelatorioDirigidoMunicipio) {
  const municipioSlug = slugify(report.municipio || report.codigoIbge || "municipio") || "municipio";
  return `relatorio-dirigido-fundeb-${municipioSlug}.pdf`;
}

export async function generateDirectedFundebPdfBuffer(
  report: RelatorioDirigidoMunicipio,
): Promise<{ pdfBuffer: Buffer; filename: string }> {
  const scriptPath = path.join(process.cwd(), "app/api/modulos/levantamento-fundeb/pdf", "gerador_dirigido.py");
  const python = resolvePythonCommand();

  return await new Promise<{ pdfBuffer: Buffer; filename: string }>((resolve, reject) => {
    const pythonProcess = spawn(python.command, [...python.argsPrefix, scriptPath], { shell: false });
    let output = "";
    let errorOutput = "";

    pythonProcess.on("error", (error) => {
      reject(
        new Error(
          `Falha ao iniciar o motor PDF dirigido: ${error.message}. Configure PYTHON_BIN ou instale Python 3 no host.`,
        ),
      );
    });

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`Erro ao gerar PDF dirigido: ${errorOutput || "processo Python encerrou com falha."}`));
        return;
      }

      const pdfPath = output.trim();
      if (!pdfPath) {
        reject(new Error("Motor PDF dirigido nao retornou o caminho do arquivo gerado."));
        return;
      }

      try {
        const pdfBuffer = await fs.readFile(pdfPath);
        await fs.unlink(pdfPath).catch(() => {});

        resolve({
          pdfBuffer,
          filename: buildDirectedFundebPdfFilename(report),
        });
      } catch (error) {
        reject(
          new Error(
            `PDF dirigido foi gerado, mas nao pode ser lido pelo Sync: ${
              error instanceof Error ? error.message : "erro desconhecido"
            }`,
          ),
        );
      }
    });

    pythonProcess.stdin.write(JSON.stringify(report));
    pythonProcess.stdin.end();
  });
}
