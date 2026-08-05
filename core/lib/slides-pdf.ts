import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { resolvePythonCommand } from "@/core/lib/python-runtime";

type SlidesTemplateId = "institucional" | "proposta-fundeb" | "resumo-executivo";

const GERADORES: Record<SlidesTemplateId, string> = {
  "institucional": "gerador_institucional.py",
  "proposta-fundeb": "gerador_proposta_fundeb.py",
  "resumo-executivo": "gerador_resumo_executivo.py",
};

const FILENAMES: Record<SlidesTemplateId, string> = {
  "institucional": "slides-institucional-global-company",
  "proposta-fundeb": "slides-proposta-fundeb",
  "resumo-executivo": "slides-resumo-executivo",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function isSlidesTemplateId(value: string): value is SlidesTemplateId {
  return value === "institucional" || value === "proposta-fundeb" || value === "resumo-executivo";
}

function buildSlidesPdfFilename(templateId: SlidesTemplateId, municipioNome?: string) {
  const base = FILENAMES[templateId];
  if (municipioNome) {
    const slug = slugify(municipioNome) || "municipio";
    return `${base}-${slug}.pdf`;
  }
  return `${base}.pdf`;
}

export async function generateSlidesPdf(
  payload: unknown,
  templateId: SlidesTemplateId,
  municipioNome?: string,
): Promise<{ pdfBuffer: Buffer; filename: string }> {
  const gerador = GERADORES[templateId];
  const scriptPath = path.join(process.cwd(), "app/api/modulos/slides/pdf", gerador);

  return await new Promise<{ pdfBuffer: Buffer; filename: string }>((resolve, reject) => {
    const python = resolvePythonCommand();
    const pythonProcess = spawn(python.command, [...python.argsPrefix, scriptPath]);
    let output = "";
    let errorOutput = "";

    pythonProcess.on("error", (error) => {
      reject(new Error(`Falha ao iniciar o motor de slides (${templateId}): ${error.message}`));
    });

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`Erro ao gerar slides (${templateId}): ${errorOutput || "processo Python encerrou com falha."}`));
        return;
      }

      const pdfPath = output.trim();
      if (!pdfPath) {
        reject(new Error(`Motor de slides (${templateId}) nao retornou o caminho do arquivo gerado.`));
        return;
      }

      try {
        const pdfBuffer = await fs.readFile(pdfPath);
        await fs.unlink(pdfPath).catch(() => {});

        resolve({
          pdfBuffer,
          filename: buildSlidesPdfFilename(templateId, municipioNome),
        });
      } catch (error) {
        reject(
          new Error(
            `Slides (${templateId}) foram gerados, mas nao puderam ser lidos pelo Sync: ${
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
