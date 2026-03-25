"use client";

import Link from "next/link";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanies } from "@/core/hooks/use-companies";

export function CompanyCards() {
  const { data: companies = [] } = useCompanies();

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {companies.map((company) => (
        <Link key={company.id} href={`/companies/${company.id}`}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CompanyAvatar name={company.tradingName} />
                  <CardTitle>{company.tradingName}</CardTitle>
                </div>
                <StatusBadge status={company.status} />
              </div>
              <CardDescription>{company.segment}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-[var(--sync-text-tertiary)]">
                CNPJ: {company.cnpj}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {company.enabledModules.map((module) => (
                  <span
                    key={module}
                    className="rounded-[var(--sync-radius-sm)] border border-[var(--sync-border-subtle)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--sync-text-secondary)]"
                  >
                    {module}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
