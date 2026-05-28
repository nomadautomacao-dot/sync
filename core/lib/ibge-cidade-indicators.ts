import populacaoCenso2022 from "@/data/ibge-populacao-2022.json";

const populacaoDataset = populacaoCenso2022 as Record<string, number>;

function slugifyMunicipio(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseBrazilianNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&ccedil;/gi, "c")
    .replace(/&atilde;/gi, "a")
    .replace(/&aacute;/gi, "a")
    .replace(/&acirc;/gi, "a")
    .replace(/&eacute;/gi, "e")
    .replace(/&ecirc;/gi, "e")
    .replace(/&iacute;/gi, "i")
    .replace(/&oacute;/gi, "o")
    .replace(/&ocirc;/gi, "o")
    .replace(/&otilde;/gi, "o")
    .replace(/&uacute;/gi, "u")
    .replace(/&uuml;/gi, "u")
    .replace(/&sup2;/gi, "2")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractIndicators(html: string) {
  const regex =
    /<div class='ind-label'>[\s\S]*?<p>(.*?)<\/p><\/div><p class='ind-value'>(.*?)<span class='indicador-unidade'>(.*?)<\/span><small>[\s\S]*?\[(.*?)\]<\/small>/g;
  const indicators = new Map<string, { value: string; unit: string; year: string }>();

  for (const match of html.matchAll(regex)) {
    const label = decodeHtml(match[1]);
    indicators.set(label, {
      value: decodeHtml(match[2]),
      unit: decodeHtml(match[3]),
      year: decodeHtml(match[4]),
    });
  }

  return indicators;
}

export interface IbgeCidadeIndicators {
  populacaoEstimada: number | null;
  populacaoAnoReferencia: string | null;
  populacaoUltimoCenso: number | null;
  receitasBrutasMunicipais: number | null;
  receitasAnoReferencia: string | null;
  escolarizacao614: number | null;
  pibPerCapita: number | null;
  pibAnoReferencia: string | null;
  idhm: number | null;
  idhmAnoReferencia: string | null;
  mortalidadeInfantil: number | null;
  mortalidadeAnoReferencia: string | null;
  areaTerritorial: number | null;
}

const cache = new Map<string, Promise<IbgeCidadeIndicators | null>>();

export async function getIbgeCidadeIndicators(
  municipioNome: string,
  uf: string,
  codigoIBGE?: string,
): Promise<IbgeCidadeIndicators | null> {
  const key = `${municipioNome}|${uf}`.toUpperCase();
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const slug = slugifyMunicipio(municipioNome);
    const url = `https://www.ibge.gov.br/cidades-e-estados/${uf.toLowerCase()}/${slug}.html`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const indicators = extractIndicators(html);
    const entries = Array.from(indicators.entries());
    const findIndicator = (...fragments: string[]) =>
      entries.find(([label]) => fragments.every((fragment) => label.toLowerCase().includes(fragment.toLowerCase())))?.[1];

    const estimada = findIndicator("Populacao estimada");
    const ultimoCenso = findIndicator("Populacao no ultimo censo");
    const receitas = findIndicator("Total de receitas brutas realizadas");
    const escolarizacao = findIndicator("Escolarizacao", "6 a 14 anos");
    const pibPerCapita = findIndicator("PIB per capita");
    const idhm = findIndicator("idhm");
    const mortalidadeInfantil = findIndicator("Mortalidade infantil");
    const areaTerritorial = findIndicator("Area Territorial");

    return {
      populacaoEstimada: parseBrazilianNumber(estimada?.value),
      populacaoAnoReferencia: estimada?.year ?? ultimoCenso?.year ?? null,
      populacaoUltimoCenso: parseBrazilianNumber(ultimoCenso?.value),
      receitasBrutasMunicipais: parseBrazilianNumber(receitas?.value),
      receitasAnoReferencia: receitas?.year ?? null,
      escolarizacao614: parseBrazilianNumber(escolarizacao?.value),
      pibPerCapita: parseBrazilianNumber(pibPerCapita?.value),
      pibAnoReferencia: pibPerCapita?.year ?? null,
      idhm: parseBrazilianNumber(idhm?.value),
      idhmAnoReferencia: idhm?.year ?? null,
      mortalidadeInfantil: parseBrazilianNumber(mortalidadeInfantil?.value),
      mortalidadeAnoReferencia: mortalidadeInfantil?.year ?? null,
      areaTerritorial: parseBrazilianNumber(areaTerritorial?.value),
    } satisfies IbgeCidadeIndicators;
  })().catch((error) => {
    console.warn(`[ibge] Scraping failed for ${municipioNome}/${uf}:`, error instanceof Error ? error.message : error);
    return null;
  }).then((result) => {
    // Fallback: se o scraping falhou ou retornou null, usar dataset local
    if (!result || (result.populacaoEstimada == null && result.populacaoUltimoCenso == null)) {
      const ibgeCode = codigoIBGE?.replace(/\D/g, "") ?? "";
      const populacaoLocal = ibgeCode ? populacaoDataset[ibgeCode] : undefined;
      if (populacaoLocal) {
        console.info(`[ibge] Usando fallback local para ${municipioNome} (${ibgeCode}): pop=${populacaoLocal}`);
        return {
          populacaoEstimada: null,
          populacaoAnoReferencia: "2022",
          populacaoUltimoCenso: populacaoLocal,
          receitasBrutasMunicipais: result?.receitasBrutasMunicipais ?? null,
          receitasAnoReferencia: result?.receitasAnoReferencia ?? null,
          escolarizacao614: result?.escolarizacao614 ?? null,
          pibPerCapita: result?.pibPerCapita ?? null,
          pibAnoReferencia: result?.pibAnoReferencia ?? null,
          idhm: result?.idhm ?? null,
          idhmAnoReferencia: result?.idhmAnoReferencia ?? null,
          mortalidadeInfantil: result?.mortalidadeInfantil ?? null,
          mortalidadeAnoReferencia: result?.mortalidadeAnoReferencia ?? null,
          areaTerritorial: result?.areaTerritorial ?? null,
        } satisfies IbgeCidadeIndicators;
      }
    }
    return result;
  });

  cache.set(key, promise);
  return promise;
}
