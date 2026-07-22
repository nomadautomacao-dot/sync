import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { getCollaborator, getCollaboratorDocument } from "@/core/lib/collaboration-data-access";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id, docId } = await context.params;
    const collaborator = await getCollaborator(sessionUser.groupId, id);
    if (!collaborator) {
      return NextResponse.json({ error: "Collaborator not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const doc = await getCollaboratorDocument(id, docId);
    if (!doc) {
      return NextResponse.json({ error: "Document not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Proxy the download from Supabase storage
    const response = await fetch(doc.fileUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Falha ao obter o arquivo do storage", code: "STORAGE_DOWNLOAD_FAILED" },
        { status: 500 }
      );
    }

    const fileBuffer = await response.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", doc.mimeType || "application/octet-stream");
    const safeFilename = encodeURIComponent(doc.fileName);
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${safeFilename}`);
    headers.set("Content-Length", fileBuffer.byteLength.toString());

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha no download do documento.", details, code: "DOWNLOAD_DOCUMENT_ERROR" },
      { status: 500 },
    );
  }
}
