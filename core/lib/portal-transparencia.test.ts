import { describe, expect, it } from "vitest";
import {
  ehEnteMunicipal,
  ehOrgaoDoMunicipio,
  resumirConvenios,
} from "./portal-transparencia";

function convenio(sobrescreve: Record<string, unknown> = {}) {
  return {
    dimConvenio: { objeto: "Construção de creche" },
    orgao: { nome: "FNDE" },
    situacao: "NORMAL",
    dataFinalVigencia: "2027-06-30",
    valor: 1_000_000,
    valorLiberado: 400_000,
    subfuncao: { funcao: { codigoFuncao: "12" } },
    ...sobrescreve,
  };
}

describe("resumirConvenios", () => {
  const hoje = new Date("2026-07-29T12:00:00Z");

  it("separa vigentes por data e situação, com o recorte de educação", () => {
    const resumo = resumirConvenios(
      [
        convenio(),
        convenio({ dataFinalVigencia: "2020-01-01" }),
        convenio({ situacao: "CANCELADO" }),
        convenio({ subfuncao: { funcao: { codigoFuncao: "15" } }, valor: 3_000_000, valorLiberado: 0 }),
      ],
      false,
      hoje,
    );
    expect(resumo.total).toBe(4);
    expect(resumo.vigentes).toBe(2);
    expect(resumo.valorVigentes).toBe(4_000_000);
    expect(resumo.educacaoVigentes).toBe(1);
    expect(resumo.valorEducacaoVigentes).toBe(1_000_000);
    expect(resumo.semLiberacao).toBe(1);
    expect(resumo.topVigentes[0].valor).toBe(3_000_000);
  });

  it("CONCLUÍDO não conta como vigente mesmo com vigência aberta", () => {
    const resumo = resumirConvenios([convenio({ situacao: "CONCLUÍDO" })], false, hoje);
    expect(resumo.vigentes).toBe(0);
  });

  it("propaga o truncamento para o leitor saber que o total é piso", () => {
    expect(resumirConvenios([], true, hoje).truncado).toBe(true);
  });
});

describe("filtros de sanção", () => {
  it("reconhece o ente municipal pelo nome, com acento e caixa livres", () => {
    expect(ehEnteMunicipal("MUNICIPIO DE SÃO PAULO", "São Paulo")).toBe(true);
    expect(ehEnteMunicipal("PREFEITURA MUNICIPAL DE MANAUS", "Manaus")).toBe(true);
    expect(ehEnteMunicipal("FUNDO MUNICIPAL DE SAUDE DE BETIM", "Betim")).toBe(true);
    // Empresa com o nome da cidade não é o ente.
    expect(ehEnteMunicipal("TRANSPORTES MANAUS LTDA", "Manaus")).toBe(false);
    // Ente de outro município não entra.
    expect(ehEnteMunicipal("MUNICIPIO DE BELEM", "Manaus")).toBe(false);
  });

  it("reconhece o órgão sancionador do próprio município nas grafias do cadastro", () => {
    expect(ehOrgaoDoMunicipio("PREFEITURA MUNICIPAL DE CAMPO BELO-MG", "Campo Belo")).toBe(true);
    expect(ehOrgaoDoMunicipio("PREFEITURA DE CAMBE - PR", "Cambé")).toBe(true);
    expect(ehOrgaoDoMunicipio("SUPERINTENDENCIA DA ZONA FRANCA DE MANAUS", "Manaus")).toBe(false);
    expect(ehOrgaoDoMunicipio("PREFEITURA MUNICIPAL DE JUIZ DE FORA - MG", "Manaus")).toBe(false);
  });
});
