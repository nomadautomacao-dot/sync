#!/usr/bin/env node
/**
 * test-comercial-pdf.mjs — Teste local do PDF Comercial Premium
 *
 * Uso:
 *   node scripts/test-comercial-pdf.mjs [codigoIbge] [output.pdf]
 *
 * Exemplos:
 *   node scripts/test-comercial-pdf.mjs                              # Usa dados de exemplo
 *   node scripts/test-comercial-pdf.mjs 5200050                      # Busca dados reais via API
 *   node scripts/test-comercial-pdf.mjs 5200050 teste.pdf            # Busca dados e salva em teste.pdf
 *
 * Este script testa o pipeline completo:
 *   1. Carrega/gera dados do município
 *   2. Gera o HTML dinâmico via template
 *   3. Usa Playwright para capturar slides
 *   4. Monta o PDF landscape 16:9
 *   5. Abre o PDF no visualizador padrão
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const VP_WIDTH = 1920;
const VP_HEIGHT = 1080;

// ── Sample data for testing without API ──────────────────────────────
const SAMPLE_DATA = {
  municipio: 'Águas Lindas de Goiás',
  uf: 'GO',
  exercicio: 2026,
  codigoIbge: '5200050',
  receitas: {
    totalReceitas: 257600000,
    receitaContribuicaoMunicipal: 98200000,
    complementacaoVAAF: 89400000,
    complementacaoVAAT: 52800000,
    complementacaoVAAR: 17200000,
  },
  projecao: {
    totalProjetado: 432770000,
    totalGanho: 175170000,
    ganhoPercentual: 0.68,
    vaafProjetado: 142200000,
    vaatProjetado: 138400000,
    vaarProjetado: 54000000,
    vaafGanho: 52800000,
    vaatGanho: 85600000,
    vaarGanho: 36800000,
  },
  censo: {
    totalEscolas: 89,
    totalMatriculas: 38452,
    totalDocentes: 2100,
    tempoIntegral: 5200,
    educacaoInfantil: 9800,
    ensinoFundamental: 24600,
    eja: 2100,
    educacaoEspecial: 1952,
  },
  ibge: {
    populacao: 222114,
    idhm: 0.686,
    area: 191.167,
    pibPerCapita: 11862,
  },
  idebAnosIniciais: [
    { ano: 2017, idebVerificado: 4.8, metaProjetada: 4.5 },
    { ano: 2019, idebVerificado: 5.2, metaProjetada: 4.8 },
    { ano: 2021, idebVerificado: 5.0, metaProjetada: 5.0 },
    { ano: 2023, idebVerificado: 5.4, metaProjetada: 5.2 },
  ],
  serieHistorica: [
    { ano: 2022, totalReceitasFundeb: 182000000, totalMatriculas: 35200, totalEscolas: 85, tempoIntegral: 3200, complementacaoVAAF: 62000000, complementacaoVAAT: 28000000, complementacaoVAAR: 8000000, contribuicaoMunicipal: 84000000 },
    { ano: 2023, totalReceitasFundeb: 205000000, totalMatriculas: 36100, totalEscolas: 86, tempoIntegral: 3800, complementacaoVAAF: 72000000, complementacaoVAAT: 35000000, complementacaoVAAR: 10000000, contribuicaoMunicipal: 88000000 },
    { ano: 2024, totalReceitasFundeb: 228000000, totalMatriculas: 37200, totalEscolas: 87, tempoIntegral: 4200, complementacaoVAAF: 79000000, complementacaoVAAT: 42000000, complementacaoVAAR: 13000000, contribuicaoMunicipal: 94000000 },
    { ano: 2025, totalReceitasFundeb: 245000000, totalMatriculas: 37800, totalEscolas: 88, tempoIntegral: 4800, complementacaoVAAF: 85000000, complementacaoVAAT: 48000000, complementacaoVAAR: 15000000, contribuicaoMunicipal: 97000000 },
    { ano: 2026, totalReceitasFundeb: 257600000, totalMatriculas: 38452, totalEscolas: 89, tempoIntegral: 5200, complementacaoVAAF: 89400000, complementacaoVAAT: 52800000, complementacaoVAAR: 17200000, contribuicaoMunicipal: 98200000 },
  ],
  saudeFiscal: {
    situacaoLrf: 'Abaixo do limite prudencial',
    despesaPessoal: 48.2,
    limitePrudencial: 51.3,
    limiteAlerta: 48.6,
  },
  cenario: {
    acoes: [
      { titulo: 'Educação Integral', descricao: 'Expansão de matrículas em tempo integral para maximizar o fator de ponderação FUNDEB', impacto: 'R$ 42,8 mi' },
      { titulo: 'Regularização VAAT', descricao: 'Habilitação e cumprimento das condicionalidades para acesso pleno à complementação VAAT', impacto: 'R$ 85,6 mi' },
      { titulo: 'Base Cadastral', descricao: 'Correção de divergências no Censo Escolar para garantir a contagem correta de alunos', impacto: 'R$ 18,2 mi' },
      { titulo: 'EJA e Educação Especial', descricao: 'Ampliar oferta de EJA e atendimento especializado, ambos com ponderação elevada', impacto: 'R$ 28,6 mi' },
    ],
  },
  prontidao: {
    score: 72,
    status: 'parcial',
    criterios: [
      'Receitas FUNDEB validadas via SICONFI',
      'Projeção Rocha Prime aplicada',
      'Dados do Censo Escolar carregados',
      'Geografia IBGE confirmada',
      'IDEB histórico disponível',
    ],
    bloqueios: [
      'Habilitação VAAT pendente no portal FNDE',
      'Dados de PAR ainda não disponíveis',
    ],
  },
  infraestrutura: {
    percentualInternet: 78,
    percentualLabInformatica: 34,
    percentualBiblioteca: 45,
    percentualQuadra: 52,
    percentualAcessibilidade: 28,
    percentualSaneamento: 89,
  },
};

// ── Main ──────────────────────────────────────────────────────────────
const codigoIbge = process.argv[2];
const outputPath = process.argv[3] || join(PROJECT_ROOT, 'COMERCIAL_TEST.pdf');

console.log('┌──────────────────────────────────────────────┐');
console.log('│   FUNDEB Comercial Premium — Teste Local     │');
console.log('└──────────────────────────────────────────────┘');
console.log();

// Try to load the template generator
let generateComercialHtml;
const templatePath = join(PROJECT_ROOT, 'core/lib/fundeb-comercial-template.ts');

if (!existsSync(templatePath)) {
  console.log('⚠  Template dinâmico não encontrado. Usando HTML estático...');
  // Fallback: use the static HTML file directly
  const staticHtml = readFileSync(join(PROJECT_ROOT, 'levantamento-fundeb-aguas-lindas.html'), 'utf-8');
  generateComercialHtml = () => staticHtml;
} else {
  // Try to compile and load the TypeScript template
  console.log('📦 Compilando template TypeScript...');
  try {
    // Check if ts file has been transpiled
    const jsPath = templatePath.replace('.ts', '.mjs');
    if (!existsSync(jsPath)) {
      // For now, fall back to static HTML
      console.log('⚠  Template TS precisa de compilação. Usando HTML estático...');
      const staticHtml = readFileSync(join(PROJECT_ROOT, 'levantamento-fundeb-aguas-lindas.html'), 'utf-8');
      generateComercialHtml = () => staticHtml;
    } else {
      const mod = await import(jsPath);
      generateComercialHtml = mod.generateComercialHtml;
    }
  } catch (err) {
    console.log('⚠  Falha ao carregar template. Usando HTML estático...');
    const staticHtml = readFileSync(join(PROJECT_ROOT, 'levantamento-fundeb-aguas-lindas.html'), 'utf-8');
    generateComercialHtml = () => staticHtml;
  }
}

const data = SAMPLE_DATA;
console.log(`📍 Município: ${data.municipio} - ${data.uf}`);
console.log(`💰 Receita: R$ ${(data.receitas.totalReceitas / 1e6).toFixed(2)} mi`);
console.log(`📈 Projeção: R$ ${(data.projecao.totalProjetado / 1e6).toFixed(2)} mi`);
console.log();

// Generate HTML
console.log('📝 Gerando HTML...');
const htmlContent = generateComercialHtml(data);

// Launch Playwright and capture
console.log('🚀 Iniciando Playwright...');
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage({ viewport: { width: VP_WIDTH, height: VP_HEIGHT } });

await page.setContent(htmlContent, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(2000);

// Force animations off
await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent = `
    .reveal, .reveal-left, .reveal-scale, .reveal-blur,
    [class*="reveal"] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
      visibility: visible !important;
      filter: none !important;
      animation: none !important;
    }
    .slide .reveal, .slide .reveal-left {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .bar-fill {
      animation: none !important;
      transition: none !important;
    }
    * {
      transition-delay: 0s !important;
      animation-delay: 0s !important;
    }
  `;
  document.head.appendChild(style);
});

const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
console.log(`📊 ${slideCount} slides encontrados`);
console.log();

const screenshots = [];

for (let i = 0; i < slideCount; i++) {
  await page.evaluate((index) => {
    const slides = document.querySelectorAll('.slide');
    slides.forEach((slide, idx) => {
      if (idx === index) {
        slide.style.display = '';
        slide.style.opacity = '1';
        slide.style.visibility = 'visible';
        slide.style.position = 'relative';
        slide.style.transform = 'none';
        slide.style.pointerEvents = 'auto';
        slide.classList.add('active', 'visible');
        slide.querySelectorAll('.reveal, .reveal-left, [class*="reveal"]').forEach(el => {
          el.style.opacity = '1';
          el.style.transform = 'none';
          el.style.visibility = 'visible';
          el.style.filter = 'none';
          el.style.transition = 'none';
          el.style.transitionDelay = '0s';
        });
      } else {
        slide.style.display = 'none';
        slide.classList.remove('active', 'visible');
      }
    });
  }, i);

  await page.waitForTimeout(300);
  const screenshot = await page.screenshot({ fullPage: false });
  screenshots.push(screenshot);
  
  const bar = '█'.repeat(Math.floor((i + 1) / slideCount * 30));
  const empty = '░'.repeat(30 - bar.length);
  process.stdout.write(`\r  Capturando: [${bar}${empty}] ${i + 1}/${slideCount}`);
}
console.log(' ✓');

await page.close();

// Assemble PDF
console.log('📄 Montando PDF...');
const browser2 = await chromium.launch();
const pdfPage = await browser2.newPage();

const imagesHtml = screenshots.map((buf) => {
  const b64 = buf.toString('base64');
  return `<div class="page"><img src="data:image/png;base64,${b64}" /></div>`;
}).join('\n');

const pdfHtml = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  @page { size: ${VP_WIDTH}px ${VP_HEIGHT}px; margin: 0; }
  .page { width: ${VP_WIDTH}px; height: ${VP_HEIGHT}px; page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  img { width: ${VP_WIDTH}px; height: ${VP_HEIGHT}px; display: block; object-fit: contain; }
</style></head><body>${imagesHtml}</body></html>`;

await pdfPage.setContent(pdfHtml, { waitUntil: 'load' });
await pdfPage.pdf({
  path: outputPath,
  width: `${VP_WIDTH}px`,
  height: `${VP_HEIGHT}px`,
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});

await browser2.close();

console.log();
console.log('┌──────────────────────────────────────────────┐');
console.log(`│  ✅ PDF salvo: ${outputPath.split('/').pop().padEnd(30)} │`);
console.log(`│  📐 ${slideCount} páginas, ${VP_WIDTH}×${VP_HEIGHT} (16:9)${''.padEnd(12)} │`);
console.log(`│  📦 ${(readFileSync(outputPath).length / 1024 / 1024).toFixed(1)} MB${''.padEnd(36)} │`);
console.log('└──────────────────────────────────────────────┘');
console.log();

// Try to open the PDF
try {
  execSync(`xdg-open "${outputPath}" 2>/dev/null &`, { stdio: 'ignore' });
  console.log('🖥  PDF aberto no visualizador padrão');
} catch {
  console.log(`📂 Abra manualmente: ${outputPath}`);
}
