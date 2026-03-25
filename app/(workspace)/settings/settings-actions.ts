"use server";

import { prisma as db } from "@/core/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getWorkspaceSettings() {
    const group = await db.group.findFirst({
        select: {
            id: true,
            name: true,
            slug: true,
            settings: true,
        }
    });

    if (!group) {
        return null; // Group should ideally be seeded
    }

    const defaultSettings = {
        empresaPadrao: {
            nome: "ROCHA PRIME SERVIÇOS ESPECIALIZADOS LTDA",
            cnpj: "29.342.691/0001-93",
            endereco: "Rua PLANALTO n° 305, Sandra Regina",
            cep: "47.802-064",
            cidade: "Barreiras",
            uf: "BA",
        }
    };

    const mergedSettings = { ...defaultSettings, ...(group.settings as Record<string, unknown> || {}) };

    return {
        id: group.id,
        name: group.name,
        slug: group.slug,
        settings: mergedSettings
    };
}

export async function updateWorkspaceSettings(id: string, name: string, slug: string, settingsData: any) {
    try {
        await db.group.update({
            where: { id },
            data: {
                name,
                slug,
                settings: settingsData
            }
        });
        revalidatePath("/(workspace)/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update settings:", error);
        return { success: false, error: "Failed to update settings" };
    }
}
