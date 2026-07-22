import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { listCollaboratorDocuments, createCollaboratorDocument, getCollaborator } from "@/core/lib/collaboration-data-access";
import { collaboratorDocumentCreateSchema } from "@/core/domain/collaboration";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

function extensionFromFile(file: File) {
  const byName = file.name.split(".").pop()?.toLowerCase();
  if (byName && /^[a-z0-9]+$/.test(byName)) {
    return byName;
  }
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "jpg";
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  return "bin";
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const collaborator = await getCollaborator(sessionUser.groupId, id);
    if (!collaborator) {
      return NextResponse.json({ error: "Collaborator not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const documents = await listCollaboratorDocuments(id);
    return NextResponse.json(documents);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao obter documentos do colaborador.", details, code: "GET_DOCUMENTS_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await context.params;
    const collaborator = await getCollaborator(sessionUser.groupId, id);
    if (!collaborator) {
      return NextResponse.json({ error: "Collaborator not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category")?.toString() || "";
    const documentType = formData.get("documentType")?.toString() || "";
    const name = formData.get("name")?.toString() || "";
    const issuedAt = formData.get("issuedAt")?.toString() || "";
    const expiresAt = formData.get("expiresAt")?.toString() || "";
    const notes = formData.get("notes")?.toString() || "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo nao informado", code: "FILE_REQUIRED" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Arquivo excede o limite de 10MB", code: "FILE_TOO_LARGE" }, { status: 400 });
    }

    // Standard checking
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isDocxOrXlsx = ext === "docx" || ext === "xlsx" || ext === "doc" || ext === "xls" || ext === "pdf";
    if (!ALLOWED_TYPES.has(file.type) && !isDocxOrXlsx) {
      return NextResponse.json({ error: "Tipo de arquivo nao suportado", code: "INVALID_FILE_TYPE" }, { status: 400 });
    }

    const payload = collaboratorDocumentCreateSchema.safeParse({
      category,
      documentType,
      name,
      fileName: file.name,
      fileUrl: "http://temp.url", // temporary placeholder for validation
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      issuedAt: issuedAt || undefined,
      expiresAt: expiresAt || undefined,
      notes: notes || undefined,
    });

    if (!payload.success) {
      return NextResponse.json(
        { error: "Dados do documento invalidos", details: payload.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    // Now upload to Supabase Storage
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const bucket = "company-documents"; // The standard document bucket

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase Storage nao configurado", code: "SUPABASE_STORAGE_NOT_CONFIGURED" },
        { status: 500 },
      );
    }

    const extension = extensionFromFile(file);
    const filePath = `collaborators/${id}/${category}/${Date.now()}-${randomUUID()}.${extension}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
    const fileBuffer = await file.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const message = await uploadResponse.text();
      return NextResponse.json(
        { error: "Falha ao enviar arquivo para Storage", details: message, code: "UPLOAD_FAILED" },
        { status: 500 },
      );
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;

    const doc = await createCollaboratorDocument(id, sessionUser.id, {
      ...payload.data,
      fileUrl: publicUrl,
    });

    return NextResponse.json(doc);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao fazer upload do documento.", details, code: "UPLOAD_DOCUMENT_ERROR" },
      { status: 500 },
    );
  }
}
