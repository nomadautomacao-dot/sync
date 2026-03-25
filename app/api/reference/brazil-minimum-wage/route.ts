import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    country: "Brasil",
    currency: "BRL",
    value: 1621,
    effectiveDate: "2026-01-01",
    sourceLabel: "Decreto nº 12.797, de 23 de dezembro de 2025",
    sourceUrl:
      "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12797.htm",
    supportUrl:
      "https://www.gov.br/esocial/pt-br/noticias/novo-salario-minimo-2026-veja-como-registrar-o-reajuste-no-esocial-domestico",
  });
}
