import { describe, it, expect } from "vitest";

import {
  AREAS,
  AREA_KEYS,
  ajustesDaClaim,
  ajustesParaClaim,
  areaDaRota,
  areasVisiveis,
  permissoesEfetivas,
  permissoesPadrao,
  podeAdministrarAcessos,
  podeAdministrarSistemas,
  podeApagarDefinitivamente,
  podeVerAdministrativo,
  podeEditar,
  podeVer,
  type Permissoes,
} from "./rbac";

describe("catálogo de áreas", () => {
  it("não repete key nem rota", () => {
    expect(new Set(AREAS.map((a) => a.key)).size).toBe(AREAS.length);
    expect(new Set(AREAS.map((a) => a.rota)).size).toBe(AREAS.length);
  });

  it("toda rota começa com barra e nenhuma termina com barra", () => {
    for (const area of AREAS) {
      expect(area.rota.startsWith("/")).toBe(true);
      expect(area.rota.endsWith("/")).toBe(false);
    }
  });
});

describe("areaDaRota", () => {
  it("resolve a própria rota e as filhas", () => {
    expect(areaDaRota("/cidades")).toBe("cidades");
    expect(areaDaRota("/cidades/abc123")).toBe("cidades");
    expect(areaDaRota("/modulos/levantamento-fundeb")).toBe("modulos");
  });

  it("devolve null para caminho fora do catálogo", () => {
    expect(areaDaRota("/entrar")).toBeNull();
    expect(areaDaRota("/")).toBeNull();
  });

  it("não deixa uma rota roubar o caminho de outra que a tenha por prefixo", () => {
    // "/cidades" não pode capturar "/cidadesfoo": o corte é no separador.
    expect(areaDaRota("/cidadesfoo")).toBeNull();
  });
});

describe("permissoesPadrao", () => {
  it("dá tudo a owner e admin", () => {
    for (const papel of ["owner", "admin"] as const) {
      const p = permissoesPadrao(papel);
      expect(AREA_KEYS.every((area) => p[area] === "editar")).toBe(true);
    }
  });

  it("member opera o dia a dia, olha cadastro alheio e não entra em ajustes", () => {
    const p = permissoesPadrao("member");
    expect(p.cidades).toBe("editar");
    expect(p.pipeline).toBe("editar");
    expect(p.modulos).toBe("editar");
    expect(p.pessoas).toBe("ver");
    expect(p.ajustes).toBe("nenhum");
  });

  it("viewer só olha, e nem isso em ajustes", () => {
    const p = permissoesPadrao("viewer");
    expect(p.cidades).toBe("ver");
    expect(p.ajustes).toBe("nenhum");
  });
});

describe("permissoesEfetivas — as travas que não se configuram", () => {
  it("owner mantém tudo mesmo com ajuste tentando restringir", () => {
    const tentativa: Partial<Permissoes> = {
      cidades: "nenhum",
      ajustes: "nenhum",
      pipeline: "ver",
    };
    const p = permissoesEfetivas("owner", tentativa);
    expect(AREA_KEYS.every((area) => p[area] === "editar")).toBe(true);
  });

  it("member não alcança editar em ajustes nem com ajuste explícito", () => {
    const p = permissoesEfetivas("member", { ajustes: "editar" });
    expect(p.ajustes).toBe("ver");
    expect(podeEditar(p, "ajustes")).toBe(false);
  });

  it("viewer promovida a editar em ajustes também cai para ver", () => {
    const p = permissoesEfetivas("viewer", { ajustes: "editar" });
    expect(p.ajustes).toBe("ver");
  });

  it("Sistemas é mais duro que Ajustes: abaixo de admin nem 'ver' passa", () => {
    // Ajustes cai para "ver"; Sistemas cai para "nenhum", porque a tela já
    // lista contas e prefeituras de outro produto.
    for (const papel of ["member", "viewer"] as const) {
      const p = permissoesEfetivas(papel, { sistemas: "editar" });
      expect(p.sistemas).toBe("nenhum");
      expect(podeVer(p, "sistemas")).toBe(false);
      expect(permissoesEfetivas(papel, { sistemas: "ver" }).sistemas).toBe("nenhum");
    }
  });

  it("owner e admin alcançam Sistemas", () => {
    expect(permissoesEfetivas("owner", null).sistemas).toBe("editar");
    expect(permissoesEfetivas("admin", null).sistemas).toBe("editar");
    expect(podeAdministrarSistemas("admin")).toBe(true);
    expect(podeAdministrarSistemas("member")).toBe(false);
    expect(podeAdministrarSistemas(null)).toBe(false);
  });

  it("admin edita ajustes — é quem concede acesso", () => {
    expect(permissoesEfetivas("admin", null).ajustes).toBe("editar");
    expect(podeAdministrarAcessos("admin")).toBe(true);
    expect(podeAdministrarAcessos("member")).toBe(false);
  });

  it("ajuste por área sobrescreve o padrão do papel", () => {
    const p = permissoesEfetivas("member", { pessoas: "editar", cidades: "nenhum" });
    expect(p.pessoas).toBe("editar");
    expect(p.cidades).toBe("nenhum");
    expect(podeVer(p, "cidades")).toBe(false);
    // O que não foi tocado segue o padrão.
    expect(p.pipeline).toBe("editar");
  });

  it("sem ajustes é igual ao padrão do papel", () => {
    expect(permissoesEfetivas("member", null)).toEqual(permissoesPadrao("member"));
  });
});

describe("areasVisiveis", () => {
  it("esconde o que está em nenhum e preserva a ordem do catálogo", () => {
    const p = permissoesEfetivas("member", { cidades: "nenhum" });
    const chaves = areasVisiveis(p).map((a) => a.key);
    expect(chaves).not.toContain("cidades");
    expect(chaves).not.toContain("ajustes");
    expect(chaves).toContain("pipeline");
    const ordemCatalogo = AREAS.map((a) => a.key).filter((k) => chaves.includes(k));
    expect(chaves).toEqual(ordemCatalogo);
  });
});

describe("ida e volta das claims", () => {
  it("grava só os desvios do padrão", () => {
    const p = permissoesEfetivas("member", { pessoas: "editar" });
    expect(ajustesParaClaim("member", p)).toEqual({ pessoas: "editar" });
  });

  it("não grava nada quando a pessoa está no padrão do papel", () => {
    expect(ajustesParaClaim("member", permissoesPadrao("member"))).toBeNull();
  });

  it("fecha o ciclo: o que sai da claim reconstrói as mesmas permissões", () => {
    const original = permissoesEfetivas("member", {
      pessoas: "editar",
      cidades: "nenhum",
    });
    const claim = ajustesParaClaim("member", original);
    expect(permissoesEfetivas("member", ajustesDaClaim(claim))).toEqual(original);
  });

  it("descarta área desconhecida e nível inválido vindos da claim", () => {
    expect(
      ajustesDaClaim({ cidades: "editar", inexistente: "editar", pessoas: "chefe" }),
    ).toEqual({ cidades: "editar" });
  });

  it("devolve null para claim ausente, vazia ou de outro formato", () => {
    expect(ajustesDaClaim(null)).toBeNull();
    expect(ajustesDaClaim(undefined)).toBeNull();
    expect(ajustesDaClaim({})).toBeNull();
    expect(ajustesDaClaim("editar")).toBeNull();
    expect(ajustesDaClaim(["cidades"])).toBeNull();
  });

  it("claim corrompida não vira acesso: cai no padrão do papel", () => {
    const p = permissoesEfetivas("viewer", ajustesDaClaim({ lixo: 1 }));
    expect(p).toEqual(permissoesPadrao("viewer"));
  });
});

describe("eixo administrativo", () => {
  it("dona e administradora enxergam; colaboradora e visitante, não", () => {
    expect(podeVerAdministrativo("owner")).toBe(true);
    expect(podeVerAdministrativo("admin")).toBe(true);
    expect(podeVerAdministrativo("member")).toBe(false);
    expect(podeVerAdministrativo("viewer")).toBe(false);
  });

  it("sem papel não enxerga — sessão a meio carregar não abre contrato", () => {
    expect(podeVerAdministrativo(undefined)).toBe(false);
    expect(podeVerAdministrativo(null)).toBe(false);
  });

  /*
   * A colaboradora opera a cidade inteira e não vê o administrativo dela. É o
   * caso que motivou o eixo: quem organiza a capacitação precisa da ficha do
   * município, e não do valor do contrato.
   */
  it("não se alcança pela permissão de área: editar Cidades não abre contrato", () => {
    const permissoes = permissoesEfetivas("member");
    expect(podeEditar(permissoes, "cidades")).toBe(true);
    expect(podeVerAdministrativo("member")).toBe(false);
  });

  /*
   * Ajuste de claim mexe em área, e o administrativo não é área. Uma claim que
   * tentasse abri-lo não teria onde encostar — é o que esta expectativa fixa,
   * para que ninguém transforme o eixo em chave configurável sem perceber que
   * está mudando a régua combinada.
   */
  it("nenhum ajuste de área abre o administrativo para member", () => {
    const permissoes = permissoesEfetivas("member", { pipeline: "editar", cidades: "editar" });
    expect(podeVer(permissoes, "pipeline")).toBe(true);
    expect(podeVerAdministrativo("member")).toBe(false);
  });
});

describe("apagar definitivamente", () => {
  it("só a dona; nem a administradora", () => {
    expect(podeApagarDefinitivamente("owner")).toBe(true);
    expect(podeApagarDefinitivamente("admin")).toBe(false);
    expect(podeApagarDefinitivamente("member")).toBe(false);
    expect(podeApagarDefinitivamente("viewer")).toBe(false);
  });

  it("sem papel não apaga", () => {
    expect(podeApagarDefinitivamente(undefined)).toBe(false);
    expect(podeApagarDefinitivamente(null)).toBe(false);
  });

  /*
   * É a única trava mais dura que `admin`. Se um dia alguém a igualar às
   * outras "para ficar consistente", este teste é o que explica por que ela
   * não é: as outras dizem quem opera, esta diz quem destrói.
   */
  it("é mais dura que o eixo administrativo", () => {
    expect(podeVerAdministrativo("admin")).toBe(true);
    expect(podeApagarDefinitivamente("admin")).toBe(false);
  });
});
