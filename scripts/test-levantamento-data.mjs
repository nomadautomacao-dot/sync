#!/usr/bin/env node
/**
 * Test script: Validates all data sources for FUNDEB levantamento
 * Usage: node --import tsx scripts/test-levantamento-data.mjs [codigoIBGE]
 * 
 * Default: 5200258 (Águas Lindas de Goiás)
 * 
 * Run with: npx tsx scripts/test-levantamento-data.mjs
 */
import { getFundebReceitasOficiais, getFundebReceitasHistoricas, getFundebVaatContext } from "../core/lib/fundeb-fnde.ts";
import { getInepCensoMunicipalRecord } from "../core/lib/inep-censo.ts";
import { getIbgeCidadeIndicators } from "../core/lib/ibge-cidade-indicators.ts";
import { getIdebMunicipalRecord } from "../core/lib/ideb-municipal.ts";
import { getTsePrefeitoRecord } from "../core/lib/tse-prefeitos.ts";
import { getSiconfiFiscalRecord } from "../core/lib/siconfi-fiscal.ts";
import { getQeduMunicipalApiSnapshot } from "../core/lib/qedu-api.ts";

const codigoIbge = process.argv[2] || "5200258";
const exercicio = new Date().getFullYear();

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function ok(label, value) {
  console.log(`  ${GREEN}✓${RESET} ${label}: ${BOLD}${value}${RESET}`);
}

function warn(label, reason) {
  console.log(`  ${YELLOW}⚠${RESET} ${label}: ${DIM}${reason}${RESET}`);
}

function fail(label, reason) {
  console.log(`  ${RED}✗${RESET} ${label}: ${reason}`);
}

function check(label, value, formatter) {
  if (value == null || value === "" || value === undefined) {
    fail(label, "VAZIO / null");
    return false;
  }
  ok(label, formatter ? formatter(value) : value);
  return true;
}

function money(v) {
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  TESTE DE DADOS - LEVANTAMENTO FUNDEB${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`  Código IBGE: ${codigoIbge} | Exercício: ${exercicio}\n`);

  // ─── 1. RECEITAS FUNDEB ──────────────────────────────────────────
  console.log(`${BOLD}📊 1. Receitas FUNDEB (FNDE)${RESET}`);
  try {
    const receitas = await getFundebReceitasOficiais(codigoIbge, exercicio);
    if (receitas) {
      check("Município", receitas.municipio);
      check("UF", receitas.uf);
      check("Total Receitas", receitas.totalReceitas, money);
      check("Contribuição Municipal", receitas.receitaContribuicaoMunicipal, money);
      check("VAAF", receitas.complementacaoVAAF, money);
      check("VAAT", receitas.complementacaoVAAT, money);
      check("VAAR", receitas.complementacaoVAAR, money);
    } else {
      fail("Receitas", "Nenhum dado retornado");
    }
  } catch (e) {
    fail("Receitas", e.message);
  }

  // ─── 2. VAAT / HABILITAÇÃO ───────────────────────────────────────
  console.log(`\n${BOLD}🎯 2. VAAT & Habilitação (FNDE)${RESET}`);
  try {
    const vaat = await getFundebVaatContext(codigoIbge, exercicio);
    if (vaat) {
      check("VAAT Anterior", vaat.vaatAnterior, money);
      check("VAAT c/ Complementação", vaat.vaatComComplementacao, money);
      check("Complementação VAAT", vaat.complementacaoVAAT, money);
      check("IEI %", vaat.ieiPercentual, (v) => `${v}%`);
      
      // ★ CRITICAL CHECK: habilitação must be a status string, NOT a monetary value
      const hab = vaat.habilitacao;
      if (hab && /^\d/.test(hab.replace(/\s/g, ""))) {
        fail("Habilitação VAAT", `"${hab}" ← PARECE VALOR MONETÁRIO! Bug não corrigido.`);
      } else {
        check("Habilitação VAAT", hab);
      }
      check("Pendência", vaat.pendencia || "(nenhuma)");
    } else {
      warn("VAAT Context", "Nenhum dado retornado");
    }
  } catch (e) {
    fail("VAAT", e.message);
  }

  // ─── 3. IBGE INDICADORES ─────────────────────────────────────────
  console.log(`\n${BOLD}🌎 3. Indicadores IBGE${RESET}`);
  try {
    // Need municipio name first
    const receitas = await getFundebReceitasOficiais(codigoIbge, exercicio);
    const censo = await getInepCensoMunicipalRecord(codigoIbge);
    const mun = receitas?.municipio || censo?.municipio || "Aguas Lindas de Goias";
    const uf = receitas?.uf || censo?.uf || "GO";
    
    const ibge = await getIbgeCidadeIndicators(mun, uf, codigoIbge);
    if (ibge) {
      check("População Estimada", ibge.populacaoEstimada, (v) => v.toLocaleString("pt-BR"));
      check("PIB per capita", ibge.pibPerCapita, money);
      
      if (ibge.idhm != null) {
        ok("IDHM", ibge.idhm.toFixed(3));
      } else {
        warn("IDHM", "Indisponível no IBGE para este município (normal para alguns)");
      }
      
      check("Escolarização 6-14", ibge.escolarizacao614, (v) => `${v}%`);
      check("Área Territorial", ibge.areaTerritorial, (v) => `${v} km²`);
      
      if (ibge.mortalidadeInfantil != null) {
        ok("Mortalidade Infantil", `${ibge.mortalidadeInfantil} ‰`);
      } else {
        warn("Mortalidade Infantil", "Indisponível via API (requer DataSUS/scraper)");
      }
    } else {
      fail("IBGE", "Nenhum dado retornado");
    }
  } catch (e) {
    fail("IBGE", e.message);
  }

  // ─── 4. CENSO ESCOLAR (INEP) ─────────────────────────────────────
  console.log(`\n${BOLD}🏫 4. Censo Escolar (INEP)${RESET}`);
  try {
    const censo = await getInepCensoMunicipalRecord(codigoIbge);
    if (censo) {
      check("Ano Referência", censo.anoReferencia);
      check("Escolas Municipais", censo.escolasMunicipaisTotal);
      check("Escolas Públicas", censo.escolasPublicasTotal);
      check("Matrículas Municipais", censo.matriculasMunicipaisTotal?.toLocaleString("pt-BR"));
      check("Docentes Municipais", censo.docentesMunicipaisTotal);
      check("Ed. Infantil Municipal", censo.educacaoInfantilMunicipal);
      check("Ens. Fundamental Municipal", censo.ensinoFundamentalMunicipal);
      check("EJA Municipal", censo.ejaMunicipal);
      check("Tempo Integral", censo.tempoIntegralMunicipal);
      check("Ed. Especial", censo.educacaoEspecialMunicipal);
    } else {
      fail("Censo", "Nenhum dado retornado");
    }
  } catch (e) {
    fail("Censo", e.message);
  }

  // ─── 5. IDEB ─────────────────────────────────────────────────────
  console.log(`\n${BOLD}📈 5. IDEB (Local + QEdu)${RESET}`);
  try {
    const ideb = getIdebMunicipalRecord(codigoIbge);
    if (ideb) {
      check("Ano Referência", ideb.anoReferencia);
      check("Anos Iniciais", ideb.anosIniciaisPublica);
      check("Anos Finais", ideb.anosFinaisPublica);
      check("Ensino Médio", ideb.ensinoMedioPublica ?? "(não aplicável - rede municipal)");
    } else {
      fail("IDEB Local", "Nenhum dado retornado");
    }
  } catch (e) {
    fail("IDEB Local", e.message);
  }

  // QEdu API
  console.log(`\n  ${DIM}Buscando série histórica via QEdu API...${RESET}`);
  try {
    const qedu = await getQeduMunicipalApiSnapshot(codigoIbge);
    if (qedu?.historicoIdeb) {
      const ai = qedu.historicoIdeb.anosIniciais.filter(a => a.idebVerificado != null);
      const af = qedu.historicoIdeb.anosFinais.filter(a => a.idebVerificado != null);
      ok("QEdu - Anos Iniciais", `${ai.length} anos com dados (${ai.map(a => a.ano).join(", ")})`);
      ok("QEdu - Anos Finais", `${af.length} anos com dados (${af.map(a => a.ano).join(", ")})`);
      
      if (ai.length === 0 && af.length === 0) {
        warn("QEdu API", "Retornou mas sem dados verificados");
      }
    } else {
      warn("QEdu API", "Sem dados ou API indisponível (QEDU_TOKEN configurado?)");
    }
  } catch (e) {
    fail("QEdu API", e.message);
  }

  // ─── 6. PREFEITO (TSE) ───────────────────────────────────────────
  console.log(`\n${BOLD}🏛️  6. Gestor Municipal (TSE)${RESET}`);
  try {
    const prefeito = await getTsePrefeitoRecord(codigoIbge);
    if (prefeito) {
      check("Prefeito", prefeito.prefeito || prefeito.nomeCompleto);
      check("Partido", prefeito.partido);
    } else {
      warn("TSE", "Nenhum dado retornado");
    }
  } catch (e) {
    fail("TSE", e.message);
  }

  // ─── 7. SAÚDE FISCAL (SICONFI) ──────────────────────────────────
  console.log(`\n${BOLD}💰 7. Saúde Fiscal (SICONFI)${RESET}`);
  try {
    const fiscal = await getSiconfiFiscalRecord(codigoIbge, exercicio);
    if (fiscal) {
      check("RCL", fiscal.rcl, money);
      check("Despesa Pessoal", fiscal.despesaPessoalTotal, money);
      check("% Despesa Pessoal", fiscal.percentualDespesaPessoal, (v) => `${v}%`);
      check("Situação LRF", fiscal.situacaoLrf);
      
      // ★ CHECK: Espaço fiscal should be % not R$
      const espaco = fiscal.limiteMaximoPessoal != null && fiscal.percentualDespesaPessoal != null
        ? (fiscal.limiteMaximoPessoal - fiscal.percentualDespesaPessoal)
        : null;
      if (espaco != null) {
        ok("Espaço Fiscal", `${espaco.toFixed(2)}% (deve ser %, NÃO R$)`);
      }
    } else {
      warn("SICONFI", "Nenhum dado retornado");
    }
  } catch (e) {
    fail("SICONFI", e.message);
  }

  // ─── SÉRIE HISTÓRICA ────────────────────────────────────────────
  console.log(`\n${BOLD}📅 8. Série Histórica FUNDEB${RESET}`);
  try {
    const historicas = await getFundebReceitasHistoricas(codigoIbge, exercicio, { anosRetroativos: 4 });
    if (historicas && historicas.length > 0) {
      ok("Anos disponíveis", historicas.length);
      for (const h of historicas) {
        console.log(`  ${DIM}  ${h.ano}: ${money(h.totalReceitas)} | Escolas: ${h.escolasMunicipaisTotal ?? "—"} | Matrículas: ${h.totalMatriculasMunicipais ?? "—"}${RESET}`);
      }
    } else {
      warn("Série Histórica", "Nenhum dado retornado");
    }
  } catch (e) {
    fail("Série Histórica", e.message);
  }

  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  TESTE CONCLUÍDO${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════${RESET}\n`);
}

main().catch((error) => {
  console.error("Erro fatal:", error);
  process.exit(1);
});
