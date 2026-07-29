#!/usr/bin/env node
/**
 * Gera `data/ipea/violencia-municipios.json` — homicídios por município
 * (total, jovens de 15 a 29 anos e taxa por 100 mil), últimos 5 anos
 * disponíveis do Atlas da Violência (IPEA/FBSP, base SIM/DataSUS).
 *
 * ## Por que este dataset existe
 *
 * Território conflagrado não aparece em nenhuma base educacional, mas aparece
 * aqui — e explica o que as bases educacionais mostram sem explicar: escola
 * com participação retida no Saeb (Cond. II do VAAR), abandono concentrado
 * nos anos finais, evasão masculina no 9º ano. Os jovens de 15 a 29 anos são
 * exatamente a faixa do EJA e do médio. O indicador entra no relatório como
 * contexto explicativo, nunca como rótulo do município (regra do roadmap).
 *
 * ## Fonte e mecânica
 *
 * IPEADATA OData (mesma infra do CAGED): a API ignora `$filter`/`$top`, então
 * cada série vem inteira e o recorte municipal é feito aqui. Séries:
 * AVIOL12_HOMIC (total), AVIOL12_HOMICJ (15–29), AVIOL12_THOMIC (taxa).
 * O Atlas publica com ~2 anos de defasagem; regerar a cada edição anual.
 *
 * ## Uso
 *
 *     npm run dados:violencia
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ODATA = "https://www.ipeadata.gov.br/api/odata4/ValoresSerie";
const SERIES = [
  { chave: "total", codigo: "AVIOL12_HOMIC" },
  { chave: "jovens", codigo: "AVIOL12_HOMICJ" },
  { chave: "taxa", codigo: "AVIOL12_THOMIC" },
];
const ULTIMOS_ANOS = 5;

const DESTINO = join(process.cwd(), "data", "ipea", "violencia-municipios.json");

function log(mensagem) {
  console.log(`[violencia] ${mensagem}`);
}

async function baixarSerie(codigo) {
  log(`baixando ${codigo}…`);
  const resposta = await fetch(`${ODATA}(SERCODIGO='${codigo}')`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(600_000),
  });
  if (!resposta.ok) throw new Error(`IPEADATA respondeu HTTP ${resposta.status} para ${codigo}`);
  const json = await resposta.json();
  return json.value ?? [];
}

async function main() {
  const porMunicipio = {};
  let anosSelecionados = null;
  let referenciaBrasil = null;

  for (const { chave, codigo } of SERIES) {
    const valores = await baixarSerie(codigo);
    const municipais = valores.filter((v) => v.NIVNOME === "Municípios" && Number.isFinite(v.VALVALOR));

    if (!anosSelecionados) {
      const anos = [...new Set(municipais.map((v) => Number(v.VALDATA?.slice(0, 4))))].sort((a, b) => a - b);
      anosSelecionados = anos.slice(-ULTIMOS_ANOS);
      log(`anos selecionados: ${anosSelecionados.join(", ")}`);
    }
    const conjunto = new Set(anosSelecionados);

    for (const v of municipais) {
      const ano = Number(v.VALDATA?.slice(0, 4));
      if (!conjunto.has(ano)) continue;
      const codigoIbge = String(v.TERCODIGO ?? "");
      if (!/^\d{7}$/.test(codigoIbge)) continue;
      let registro = porMunicipio[codigoIbge];
      if (!registro) {
        registro = {};
        porMunicipio[codigoIbge] = registro;
      }
      let serie = registro[chave];
      if (!serie) {
        serie = {};
        registro[chave] = serie;
      }
      serie[ano] = Math.round(v.VALVALOR * 10) / 10;
    }

    // A taxa nacional é a régua de comparação da página — do MESMO ano do
    // último dado municipal, senão a comparação mistura exercícios.
    if (chave === "taxa") {
      const anoReferencia = anosSelecionados[anosSelecionados.length - 1];
      const brasil = valores.find(
        (v) => v.NIVNOME === "Brasil" && Number(v.VALDATA?.slice(0, 4)) === anoReferencia && Number.isFinite(v.VALVALOR),
      );
      if (brasil) {
        referenciaBrasil = { ano: anoReferencia, taxa: Math.round(brasil.VALVALOR * 10) / 10 };
      }
    }
  }

  const totalMunicipios = Object.keys(porMunicipio).length;
  if (totalMunicipios < 5000) {
    throw new Error(`só ${totalMunicipios} municípios aproveitados — o layout do IPEADATA mudou.`);
  }

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-violencia-municipios.mjs. Não editar à mão. Regerar com: npm run dados:violencia",
    fonte: "Atlas da Violência (IPEA/FBSP, base SIM/DataSUS), via IPEADATA — AVIOL12_HOMIC, AVIOL12_HOMICJ e AVIOL12_THOMIC",
    anos: anosSelecionados,
    brasil: referenciaBrasil,
    geradoEm: new Date().toISOString(),
    municipios: porMunicipio,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");
  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${totalMunicipios.toLocaleString("pt-BR")} municípios`,
  );
}

main().catch((erro) => {
  console.error(`[violencia] falhou: ${erro.message}`);
  process.exit(1);
});
