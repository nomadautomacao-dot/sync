import { loadFundebReceitasByYear } from "@/core/lib/fundeb-fnde";

import {
  ANO_INICIO_SERIE,
  type CaseSucesso,
  type EntradaCase,
  type ExercicioCase,
  type MunicipioApurado,
} from "./types";

/**
 * Monta o Case de Sucesso a partir das portarias de complementação do FUNDEB.
 *
 * ## O que este módulo garante
 *
 * 1. **Nenhum ano fora da janela de atuação.** Cada município traz o seu `fim`,
 *    e a série para ali. Reivindicar exercício em que a consultoria não estava
 *    na rede é o tipo de afirmação que uma consulta ao portal do FNDE desmonta
 *    na frente do cliente — e o documento é feito para ser conferido.
 * 2. **A posição é apurada na janela do próprio município.** Um município de
 *    janela 2024–2025 é comparado com o que todos os outros fizeram de 2024 a
 *    2025, não de 2024 a 2026. Misturar períodos produziria um percentil que
 *    não corresponde a nada.
 * 3. **O universo exclui quem não recebia complementação no ano de início.**
 *    Quem entrou do zero teria variação infinita e envenenaria a comparação.
 *
 * Tudo vem dos CSV do FNDE em `data/fnde/`, lidos por `loadFundebReceitasByYear`
 * e mantidos em cache por exercício. A emissão não vai à rede.
 */
export async function montarCaseSucesso(
  entradas: EntradaCase[],
  agora: Date = new Date(),
): Promise<CaseSucesso> {
  if (entradas.length === 0) {
    throw new Error("Informe ao menos um município.");
  }

  const inicioPadrao = 2024;
  const fimMaximo = Math.max(...entradas.map((e) => e.fim));
  const anos = intervalo(ANO_INICIO_SERIE, fimMaximo);

  // Carrega uma vez cada exercício que alguém pediu — inclusive os anos de
  // início, que as comparações usam como base.
  const anosNecessarios = new Set<number>(anos);
  for (const e of entradas) anosNecessarios.add(e.inicio ?? inicioPadrao);
  const tabelas = new Map<number, Awaited<ReturnType<typeof loadFundebReceitasByYear>>>();
  await Promise.all(
    [...anosNecessarios].map(async (ano) => {
      tabelas.set(ano, await loadFundebReceitasByYear(ano));
    }),
  );

  const municipios: MunicipioApurado[] = [];

  for (const entrada of entradas) {
    const inicio = entrada.inicio ?? inicioPadrao;
    if (entrada.fim <= inicio) {
      throw new Error(
        `O exercício final (${entrada.fim}) precisa ser posterior ao inicial (${inicio}).`,
      );
    }

    const serie: ExercicioCase[] = [];
    for (const ano of intervalo(ANO_INICIO_SERIE, entrada.fim)) {
      const linha = tabelas.get(ano)?.get(entrada.codigoIbge);
      // Ano sem linha não vira zero: some da série. Zero afirmaria que a rede
      // não recebeu nada, e o que houve foi a portaria não trazer o município.
      if (!linha) continue;
      serie.push({
        ano,
        vaaf: linha.complementacaoVAAF,
        vaat: linha.complementacaoVAAT,
        vaar: linha.complementacaoVAAR,
        complementacao:
          linha.complementacaoVAAF + linha.complementacaoVAAT + linha.complementacaoVAAR,
        total: linha.totalReceitas,
      });
    }

    const base = serie.find((s) => s.ano === inicio);
    const fim = serie.find((s) => s.ano === entrada.fim);
    if (!base || !fim) {
      throw new Error(
        `As portarias de ${inicio} e ${entrada.fim} não trazem o município ${entrada.codigoIbge}.`,
      );
    }
    if (base.total <= 0) {
      throw new Error(
        `O município ${entrada.codigoIbge} não tem receita de FUNDEB em ${inicio}; não há base de comparação.`,
      );
    }

    const identificacao = tabelas.get(entrada.fim)?.get(entrada.codigoIbge);
    const variacaoTotal = ((fim.total - base.total) / base.total) * 100;
    const { percentil, universo } = posicaoNoPais(tabelas, inicio, entrada.fim, variacaoTotal);

    municipios.push({
      codigoIbge: entrada.codigoIbge,
      // O nome do IBGE quando veio; o do FNDE só como último recurso — ver o
      // porquê em `EntradaCase.nome`.
      nome: entrada.nome?.trim() || identificacao?.municipio || entrada.codigoIbge,
      uf: identificacao?.uf ?? "",
      inicio,
      fim: entrada.fim,
      serie,
      totalInicio: base.total,
      totalFim: fim.total,
      complementacaoInicio: base.complementacao,
      complementacaoFim: fim.complementacao,
      ganhoTotal: fim.total - base.total,
      ganhoComplementacao: fim.complementacao - base.complementacao,
      variacaoTotal,
      variacaoComplementacao:
        base.complementacao > 0
          ? ((fim.complementacao - base.complementacao) / base.complementacao) * 100
          : 0,
      percentilBR: percentil,
      universoBR: universo,
      anoHabilitacaoVaat: serie.find((s) => s.vaat > 0)?.ano ?? null,
    });
  }

  // O mais forte primeiro: o documento abre pelo melhor resultado.
  municipios.sort((a, b) => b.percentilBR - a.percentilBR);

  const soma = (f: (m: MunicipioApurado) => number) =>
    municipios.reduce((acc, m) => acc + f(m), 0);

  return {
    municipios,
    agregado: {
      totalInicio: soma((m) => m.totalInicio),
      totalFim: soma((m) => m.totalFim),
      complementacaoInicio: soma((m) => m.complementacaoInicio),
      complementacaoFim: soma((m) => m.complementacaoFim),
      ganhoTotal: soma((m) => m.ganhoTotal),
      ganhoComplementacao: soma((m) => m.ganhoComplementacao),
      noTopo10: municipios.filter((m) => m.percentilBR >= 90).length,
    },
    anos,
    geradoEm: agora.toISOString(),
  };
}

/**
 * Onde a variação da rede cai entre as dos municípios brasileiros, na mesma
 * janela. Devolve o percentil (0 a 100) e o tamanho do universo comparado.
 */
function posicaoNoPais(
  tabelas: Map<number, Awaited<ReturnType<typeof loadFundebReceitasByYear>>>,
  inicio: number,
  fim: number,
  variacao: number,
): { percentil: number; universo: number } {
  const tabelaInicio = tabelas.get(inicio);
  const tabelaFim = tabelas.get(fim);
  if (!tabelaInicio || !tabelaFim) return { percentil: 0, universo: 0 };

  const variacoes: number[] = [];
  for (const [codigo, base] of tabelaInicio) {
    const destino = tabelaFim.get(codigo);
    if (!destino || base.totalReceitas <= 0) continue;
    // Só entra quem já recebia complementação no ano-base: quem entrou do zero
    // teria variação infinita e distorceria a régua para todo mundo.
    const complBase =
      base.complementacaoVAAF + base.complementacaoVAAT + base.complementacaoVAAR;
    if (complBase <= 0) continue;
    variacoes.push(((destino.totalReceitas - base.totalReceitas) / base.totalReceitas) * 100);
  }

  if (variacoes.length === 0) return { percentil: 0, universo: 0 };
  const abaixo = variacoes.filter((v) => v < variacao).length;
  return { percentil: (abaixo / variacoes.length) * 100, universo: variacoes.length };
}

function intervalo(de: number, ate: number): number[] {
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}
