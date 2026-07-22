import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { getCollaborator, deleteCollaboratorDocument, getCollaboratorDocument } from "@/core/lib/collaboration-data-access";

export async function DELETE(
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

    // Try deleting from Supabase storage
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const bucket = "company-documents";

    if (supabaseUrl && serviceRoleKey) {
      const urlMarker = `/storage/v1/object/public/${bucket}/`;
      const idx = doc.fileUrl.indexOf(urlMarker);
      if (idx !== -1) {
        const filePath = doc.fileUrl.substring(idx + urlMarker.length);
        const deleteUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;
        await fetch(deleteUrl, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        });
      }
    }

    await deleteCollaboratorDocument(id, docId, sessionUser.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Falha ao excluir o documento.", details, code: "DELETE_DOCUMENT_ERROR" },
      { status: 500 },
    );
  }
}
