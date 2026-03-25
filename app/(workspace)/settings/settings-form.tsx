"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateWorkspaceSettings } from "./settings-actions";

interface SettingsData {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown> | null;
}

export function SettingsForm({ initialData }: { initialData: SettingsData }) {
    const [name, setName] = useState(initialData.name || "");
    const [slug, setSlug] = useState(initialData.slug || "");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateWorkspaceSettings(
                initialData.id,
                name,
                slug,
                initialData.settings ?? {}
            );

            if (result.success) {
                toast.success("Configuracoes atualizadas com sucesso");
            } else {
                toast.error("Erro ao atualizar configuracoes");
            }
        } catch {
            toast.error("Ocorreu um erro ao salvar.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Dados do Grupo</CardTitle>
                    <CardDescription>Configuracoes gerais do ambiente Sync.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="groupName">Nome do grupo</label>
                        <Input id="groupName" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-[var(--sync-text-secondary)]" htmlFor="slug">Slug</label>
                        <Input id="slug" value={slug} onChange={e => setSlug(e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Empresas</CardTitle>
                    <CardDescription>
                        A criacao de empresas ja funciona pelo botao + na sidebar. Aqui fica apenas o atalho de consulta.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[var(--sync-text-secondary)]">
                        Abra a lista completa de empresas cadastradas no workspace.
                    </p>
                    <Button asChild variant="outline">
                        <Link href="/companies">Visualizar empresas</Link>
                    </Button>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar configuracoes"}
                </Button>
            </div>
        </div>
    );
}
