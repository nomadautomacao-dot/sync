import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]);
const DEFAULT_BUCKET = "company-logos";

function extensionFromFile(file: File) {
  const byName = file.name.split(".").pop()?.toLowerCase();
  if (byName && /^[a-z0-9]+$/.test(byName)) {
    return byName;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "jpg";
  if (file.type === "image/svg+xml") return "svg";
  return "bin";
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_COMPANY_LOGOS_BUCKET?.trim() || DEFAULT_BUCKET;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "Supabase Storage nao configurado",
        code: "SUPABASE_STORAGE_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo nao informado", code: "FILE_REQUIRED" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Arquivo excede 2MB", code: "FILE_TOO_LARGE" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo de arquivo nao suportado", code: "INVALID_FILE_TYPE" },
      { status: 400 },
    );
  }

  const extension = extensionFromFile(file);
  const filePath = `logos/${sessionUser.groupId}/${Date.now()}-${randomUUID()}.${extension}`;
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
      {
        error: "Falha ao enviar arquivo para Storage",
        details: message,
        code: "UPLOAD_FAILED",
      },
      { status: 500 },
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
  return NextResponse.json({ url: publicUrl });
}
