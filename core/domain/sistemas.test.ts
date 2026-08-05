import { describe, expect, it } from "vitest";

import { podeAdministrarSistemas } from "@/core/domain/rbac";
import {
  CATALOGO_DE_SISTEMAS,
  claimsDoSistema,
  divergenciaDeClaims,
  documentoDaPrefeitura,
  documentoDoUsuario,
  lerPrefeitura,
  lerUsuario,
  mesclarClaims,
  novaPrefeituraSchema,
  novoUsuarioSchema,
  removerClaims,
  sistemaPorId,
  slugDePrefeitura,
  statusDaPrefeitura,
  validarContraCatalogo,
} from "@/core/domain/sistemas";

const globaledu = sistemaPorId("globaledu")!;

describe("catálogo", () => {
  it("conhece o GlobalEdu e devolve null para produto inexistente", () => {
    expect(globaledu.nome).toBe("GlobalEdu");
    expect(sistemaPorId("nao-existe")).toBeNull();
  });

  it("não repete id nem databaseId entre sistemas", () => {
    const ids = CATALOGO_DE_SISTEMAS.map((s) => s.id);
    const bancos = CATALOGO_DE_SISTEMAS.map((s) => s.databaseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(bancos).size).toBe(bancos.length);
  });

  it("declara papel padrão que existe na própria lista de papéis", () => {
    for (const sistema of CATALOGO_DE_SISTEMAS) {
      expect(sistema.papeis.some((p) => p.id === sistema.papelPadrao)).toBe(true);
    }
  });

  it("cai para um status neutro quando o valor gravado é desconhecido", () => {
    expect(statusDaPrefeitura(globaledu, "ativo").cor).toBe("success");
    expect(statusDaPrefeitura(globaledu, "inventado").cor).toBe("default");
  });
});

describe("slug da prefeitura", () => {
  it("normaliza acento, caixa e espaço", () => {
    expect(slugDePrefeitura("Senhor do Bonfim")).toBe("senhor-do-bonfim");
    expect(slugDePrefeitura("Açu da Torre")).toBe("acu-da-torre");
    expect(slugDePrefeitura("  Igaci  ")).toBe("igaci");
  });

  it("não deixa hífen sobrando nas pontas nem repetido", () => {
    expect(slugDePrefeitura("--São João--")).toBe("sao-joao");
    expect(slugDePrefeitura("Foo / Bar")).toBe("foo-bar");
  });
});

describe("tradução para o dialeto do produto", () => {
  it("escreve o documento da prefeitura com os nomes de campo do GlobalEdu", () => {
    const doc = documentoDaPrefeitura(globaledu, {
      nome: "Igaci",
      slug: "igaci",
      uf: "al",
      status: "ativo",
      criadoEm: "2026-08-02T12:00:00.000Z",
    });
    expect(doc).toEqual({
      name: "Igaci",
      slug: "igaci",
      uf: "AL",
      status: "ativo",
      createdAt: "2026-08-02T12:00:00.000Z",
    });
  });

  it("grava os indicadores do município e lê de volta", () => {
    const censo = {
      ano: 2025,
      escolasMunicipais: 41,
      escolasNoMunicipio: 52,
      matriculasMunicipais: 7344,
      docentesMunicipais: 563,
      porEtapa: {
        creche: 762,
        preEscola: 1209,
        anosIniciais: 2733,
        anosFinais: 2309,
        eja: 331,
        educacaoEspecial: 627,
      },
    };
    const doc = documentoDaPrefeitura(globaledu, {
      nome: "Serra do Ramalho",
      slug: "serra-do-ramalho",
      uf: "BA",
      status: "ativo",
      codigoIbge: "2930154",
      regiao: "Nordeste",
      populacao: 34222,
      prefeito: "Eli Carlos dos Anjos Santos",
      partido: "PSDB",
      referenciaCenso: censo,
    });

    expect(doc.ibgeCode).toBe("2930154");
    expect(doc.populacao).toBe(34222);
    expect(doc.partidoPrefeito).toBe("PSDB");
    expect(doc.referenciaCenso).toEqual(censo);

    const lida = lerPrefeitura(globaledu, "serra-do-ramalho", doc);
    expect(lida.referenciaCenso?.escolasMunicipais).toBe(41);
    expect(lida.populacao).toBe(34222);
  });

  // O Firestore recusa `undefined`: campo opcional sem valor não pode virar chave.
  it("não cria chave para indicador ausente", () => {
    const doc = documentoDaPrefeitura(globaledu, {
      nome: "Igaci",
      slug: "igaci",
      uf: "AL",
      status: "ativo",
    });
    for (const chave of ["ibgeCode", "populacao", "prefeito", "partidoPrefeito", "referenciaCenso", "ideb"]) {
      expect(chave in doc).toBe(false);
    }
    expect(Object.values(doc).every((v) => v !== undefined)).toBe(true);
  });

  it("lê de volta o que escreveu", () => {
    const doc = documentoDaPrefeitura(globaledu, {
      nome: "Igaci",
      slug: "igaci",
      uf: "AL",
      status: "trial",
    });
    expect(lerPrefeitura(globaledu, "igaci", doc)).toMatchObject({
      id: "igaci",
      nome: "Igaci",
      uf: "AL",
      status: "trial",
    });
  });

  it("preenche a lista de vínculos com o vínculo principal quando ela falta", () => {
    const usuario = lerUsuario(globaledu, "uid1", {
      email: "maria@igaci.al.gov.br",
      nome: "Maria",
      role: "sec_educacao",
      tenantId: "igaci",
    });
    expect(usuario.prefeituras).toEqual(["igaci"]);
  });

  it("trata ausência de `ativo` como conta ativa, e false como inativa", () => {
    expect(lerUsuario(globaledu, "u", { email: "a@b.c" }).ativo).toBe(true);
    expect(lerUsuario(globaledu, "u", { email: "a@b.c", ativo: false }).ativo).toBe(false);
  });

  it("grava o vínculo nos dois campos que o GlobalEdu consulta", () => {
    const doc = documentoDoUsuario(globaledu, {
      email: "maria@igaci.al.gov.br",
      nome: "Maria",
      papel: "sec_educacao",
      prefeitura: "igaci",
    });
    expect(doc.tenantId).toBe("igaci");
    expect(doc.tenantIds).toEqual(["igaci"]);
    expect(doc.ativo).toBe(true);
  });
});

describe("custom claims", () => {
  it("monta as claims que o GlobalEdu lê do ID token", () => {
    expect(claimsDoSistema(globaledu, { papel: "diretor", prefeitura: "igaci" })).toEqual({
      role: "diretor",
      tenantId: "igaci",
      tenantIds: ["igaci"],
    });
  });

  // Este é o teste que protege o acesso ao Sync: o Auth é um só para o projeto,
  // e `setCustomUserClaims` substitui o objeto inteiro em vez de mesclar.
  it("preserva as claims do Sync ao provisionar a mesma pessoa no GlobalEdu", () => {
    const antes = { groupId: "rocha-prime", groupRole: "member" };
    const depois = mesclarClaims(
      antes,
      claimsDoSistema(globaledu, { papel: "consultor", prefeitura: "igaci" }),
    );
    expect(depois).toEqual({
      groupId: "rocha-prime",
      groupRole: "member",
      role: "consultor",
      tenantId: "igaci",
      tenantIds: ["igaci"],
    });
  });

  it("remove só as chaves do produto ao desvincular", () => {
    const claims = {
      groupId: "rocha-prime",
      groupRole: "owner",
      role: "consultor",
      tenantId: "igaci",
      tenantIds: ["igaci"],
    };
    expect(removerClaims(globaledu, claims)).toEqual({
      groupId: "rocha-prime",
      groupRole: "owner",
    });
  });

  it("acusa divergência entre o documento e a claim", () => {
    const usuario = { papel: "diretor", prefeitura: "igaci", prefeituras: ["igaci"] };
    const emDia = { role: "diretor", tenantId: "igaci", tenantIds: ["igaci"] };
    expect(divergenciaDeClaims(globaledu, usuario, emDia)).toBe(false);
    expect(divergenciaDeClaims(globaledu, usuario, { ...emDia, role: "professor" })).toBe(true);
    expect(divergenciaDeClaims(globaledu, usuario, { ...emDia, tenantIds: [] })).toBe(true);
    expect(divergenciaDeClaims(globaledu, usuario, undefined)).toBe(true);
  });
});

describe("validação", () => {
  it("exige UF da federação e nome com conteúdo", () => {
    expect(novaPrefeituraSchema.safeParse({ nome: "Igaci", uf: "AL" }).success).toBe(true);
    expect(novaPrefeituraSchema.safeParse({ nome: "Igaci", uf: "XX" }).success).toBe(false);
    expect(novaPrefeituraSchema.safeParse({ nome: "I", uf: "AL" }).success).toBe(false);
  });

  // Regressão: o formulário manda `slug: ""` quando o campo fica em branco —
  // que é o caso normal, já que o identificador é gerado do nome. `.optional()`
  // sozinho reprovava a string vazia e devolvia 400 num campo não preenchido.
  it("aceita o payload da tela com os campos opcionais em branco", () => {
    const daTela = {
      nome: "Serra do Ramalho",
      uf: "BA",
      slug: "",
      status: "ativo",
      codigoIbge: "2930154",
      regiao: "Nordeste",
      populacao: 34222,
      prefeito: "Eli Carlos dos Anjos Santos",
      partido: "PSDB",
      referenciaCenso: {
        ano: 2025,
        escolasMunicipais: 41,
        escolasNoMunicipio: 52,
        matriculasMunicipais: 7344,
        docentesMunicipais: 563,
        porEtapa: {
          creche: 762,
          preEscola: 1209,
          anosIniciais: 2733,
          anosFinais: 2309,
          eja: 331,
          educacaoEspecial: 627,
        },
      },
      ideb: { anosIniciais: 5, anosFinais: 4, ano: 2023 },
    };

    const r = novaPrefeituraSchema.safeParse(daTela);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    // Vazio vira ausência, não string vazia: quem grava decide o padrão.
    expect(r.success && r.data.slug).toBeUndefined();
    expect(r.success && r.data.referenciaCenso?.escolasMunicipais).toBe(41);
  });

  it("continua recusando identificador com conteúdo inválido", () => {
    const base = { nome: "Igaci", uf: "AL" as const };
    expect(novaPrefeituraSchema.safeParse({ ...base, slug: "Igaci Alagoas" }).success).toBe(false);
    expect(novaPrefeituraSchema.safeParse({ ...base, slug: "i" }).success).toBe(false);
    expect(novaPrefeituraSchema.safeParse({ ...base, slug: "   " }).success).toBe(true);
  });

  it("recusa código IBGE fora dos 7 dígitos", () => {
    const base = { nome: "Igaci", uf: "AL" as const };
    expect(novaPrefeituraSchema.safeParse({ ...base, codigoIbge: "2703106" }).success).toBe(true);
    expect(novaPrefeituraSchema.safeParse({ ...base, codigoIbge: "270310" }).success).toBe(false);
  });

  it("aceita usuário sem senha — a conta nasce para redefinição por e-mail", () => {
    const entrada = {
      email: "Maria@Igaci.AL.gov.br",
      nome: "Maria",
      papel: "sec_educacao",
      prefeitura: "igaci",
    };
    const r = novoUsuarioSchema.safeParse(entrada);
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe("maria@igaci.al.gov.br");
  });

  it("recusa senha curta e slug com maiúscula", () => {
    const base = { email: "a@b.co", nome: "Ana", papel: "diretor", prefeitura: "igaci" };
    expect(novoUsuarioSchema.safeParse({ ...base, senha: "1234" }).success).toBe(false);
    expect(novoUsuarioSchema.safeParse({ ...base, prefeitura: "Igaci" }).success).toBe(false);
  });

  it("valida papel e status contra o catálogo do sistema, não contra o schema", () => {
    expect(validarContraCatalogo(globaledu, { papel: "diretor" })).toBeNull();
    expect(validarContraCatalogo(globaledu, { papel: "prefeito" })).toContain("prefeito");
    expect(validarContraCatalogo(globaledu, { status: "suspenso" })).toBeNull();
    expect(validarContraCatalogo(globaledu, { status: "cancelado" })).toContain("cancelado");
  });
});

describe("quem entra no console", () => {
  it("libera owner e admin, barra member, viewer e sessão ausente", () => {
    expect(podeAdministrarSistemas("owner")).toBe(true);
    expect(podeAdministrarSistemas("admin")).toBe(true);
    expect(podeAdministrarSistemas("member")).toBe(false);
    expect(podeAdministrarSistemas("viewer")).toBe(false);
    expect(podeAdministrarSistemas(null)).toBe(false);
  });
});
