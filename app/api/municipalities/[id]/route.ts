import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/core/lib/auth";
import { prisma } from "@/core/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const resolvedParams = await params;
  const { id } = resolvedParams;
  const body = await request.json();

  try {
    const updateData: any = {};
    
    if (body.currentStage !== undefined) {
      updateData.currentStage = body.currentStage;
    }
    if (body.municipalityName !== undefined || body.name !== undefined) {
      updateData.municipalityName = body.municipalityName ?? body.name;
    }
    if (body.state !== undefined || body.uf !== undefined) {
      updateData.state = body.state ?? body.uf;
    }
    if (body.ibgeCode !== undefined || body.codigoIbge !== undefined) {
      updateData.ibgeCode = body.ibgeCode ?? body.codigoIbge;
    }
    if (body.estimatedAnnualRevenue !== undefined) {
      updateData.estimatedAnnualRevenue = body.estimatedAnnualRevenue;
    }
    if (body.probability !== undefined) {
      updateData.forecastProbability = body.probability;
    }

    const updated = await prisma.municipalityAccount.update({
      where: {
        id,
        groupId: sessionUser.groupId,
      },
      data: updateData,
    });

    // Create an audit log entry for the update action
    await prisma.auditLog.create({
      data: {
        action: "municipality.updated",
        userId: sessionUser.id,
        targetId: id,
        metadata: { 
          municipalityName: updated.municipalityName, 
          state: updated.state,
          changedFields: Object.keys(updateData)
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
