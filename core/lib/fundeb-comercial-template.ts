// ============================================================================
// fundeb-comercial-template.ts
// Dynamic HTML template generator for FUNDEB Commercial Premium Presentation
//
// Generates a pixel-perfect 16:9 slide deck identical to the static version
// when fed the same data. All CSS is inlined; no external dependencies except
// Google Fonts. SVG logo embedded inline.
// ============================================================================

// ---------------------------------------------------------------------------
// DATA INTERFACE
// ---------------------------------------------------------------------------

interface ComercialPdfData {
  municipio: string;
  uf: string;
  exercicio: number;
  codigoIbge?: string;

  // Gestor / política
  gestor?: {
    nome?: string;
    partido?: string;
    mandato?: string;            // e.g. "2025–2028"
    classificacaoMandato?: string; // e.g. "Primeiro mandato"
  };

  // Geografia
  mesorregiao?: string;
  microrregiao?: string;

  // Receitas
  receitas: {
    totalReceitas: number;
    receitaContribuicaoMunicipal: number;
    complementacaoVAAF: number;
    complementacaoVAAT: number;
    complementacaoVAAR: number;
  };

  // Projeção
  projecao: {
    totalProjetado: number;
    totalGanho: number;
    ganhoPercentual: number;
    vaafProjetado: number;
    vaatProjetado: number;
    vaarProjetado: number;
    vaafGanho: number;
    vaatGanho: number;
    vaarGanho: number;
  };

  // Ganhos evidenciados
  ganhosEvidenciados?: {
    valor?: number;
    percentual?: number;
  };

  // Habilitação VAAT
  habilitacaoVaat?: string; // e.g. "Habilitado", "Não habilitado"

  // Vetores observados
  vetoresObservados?: string;

  // Indicadores de eficiência
  eficiencia?: {
    indiceEficiencia?: number;
    fatorAjusteRegional?: number;
    fundebPerCapita?: string;
    matriculasPerCapita?: string;
    edInfantilPerCapita?: string;
    crechePerCapita?: string;
    valorAlunoMedio?: string;
    regiao?: string; // e.g. "Centro-Oeste"
  };

  // Sistemas/Programas federais
  sistemasFederais?: Array<{
    instituicao: string;
    sistema: string;
    situacao: string;
  }>;

  // PDDE
  pdde?: {
    historico?: Array<{ ano: number; valor: number }>;
  };

  // Censo escolar
  censo?: {
    totalEscolas?: number;
    totalMatriculas?: number;
    totalDocentes?: number;
    tempoIntegral?: number;
    educacaoInfantil?: number;
    ensinoFundamental?: number;
    eja?: number;
    educacaoEspecial?: number;
    dadosPublicosTotal?: {
      totalEscolas: number;
      totalMatriculas: number;
      totalDocentes: number;
    };
  };

  // IBGE
  ibge?: {
    populacao?: number;
    idhm?: number;
    area?: number;
    pibPerCapita?: number;
  };

  // IDEB
  idebAnosIniciais?: Array<{
    ano: number;
    idebVerificado?: number;
    metaProjetada?: number;
  }>;

  idebAnosFinais?: Array<{
    ano: number;
    idebVerificado?: number;
    metaProjetada?: number;
  }>;

  idebEnsinoMedio?: Array<{
    ano: number;
    idebVerificado?: number;
    metaProjetada?: number;
  }>;

  // Série histórica
  serieHistorica?: Array<{
    ano: number;
    totalReceitasFundeb?: number;
    contribuicaoMunicipal?: number;
    complementacaoVAAF?: number;
    complementacaoVAAT?: number;
    complementacaoVAAR?: number;
    totalMatriculas?: number;
    totalEscolas?: number;
    tempoIntegral?: number;
    educacaoEspecial?: number;
    eja?: number;
    variacao?: number; // YoY variation in %
  }>;

  // Saúde fiscal
  saudeFiscal?: {
    situacaoLrf?: string;
    despesaPessoal?: number;
    limitePrudencial?: number;
    limiteAlerta?: number;
  };

  // Cenário estruturação
  cenario?: {
    acoes?: Array<{
      titulo: string;
      descricao: string;
      impacto?: string;
    }>;
  };

  // Prontidão
  prontidao?: {
    score: number;
    status: string;
    criterios?: string[];
    bloqueios?: string[];
  };

  // Infraestrutura
  infraestrutura?: {
    percentualInternet?: number;
    percentualLabInformatica?: number;
    percentualBiblioteca?: number;
    percentualQuadra?: number;
    percentualAcessibilidade?: number;
    percentualSaneamento?: number;
  };

  // Rastreabilidade
  rastreabilidade?: Array<{
    fonte: string;
    status: 'auto' | 'estimated' | 'manual';
    statusLabel?: string;
    leitura: string;
  }>;

  // Recomendações
  recomendacoes?: string[];

  // Próximos passos
  proximosPassos?: string[];

  // Alertas técnicos
  alertas?: Array<{
    tipo: 'warning' | 'danger' | 'info';
    icone: string;
    texto: string;
  }>;

  // Observações rastreabilidade
  observacoesRastreabilidade?: number;
}

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Formats a number as BRL currency, automatically using millions abbreviation
 * for values ≥ 1 000 000. e.g. 257601696.97 → "R$ 257,60 mi"
 */
function formatBRL(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `R$ ${millions.toFixed(1).replace('.', ',')} mi`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Short BRL for cover KPIs — uses 1 decimal for millions.
 * 257601696.97 → "R$ 257,6 mi"
 */
function formatBRLShort(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `R$ ${millions.toFixed(1).replace('.', ',')} mi`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Full BRL formatting with cents: 257601696.97 → "R$ 257.601.696,97"
 */
function formatBRLFull(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * BRL formatted without cents: 257601696.97 → "R$ 257.601.697"
 */
function formatBRLNoCents(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
}

/**
 * Format a percentage: 68.1 → "68,1%" or 0 → "0,0%"
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(value)) return '—';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

/**
 * Format an integer with thousands separators: 12345 → "12.345"
 */
export function formatInteger(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  return Math.round(value).toLocaleString('pt-BR');
}

/**
 * Format current date as DD/MM/YYYY
 */
function formatDate(d?: Date): string {
  const now = d || new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format timestamp for footer: "28/05/2026 14:47"
 */
function formatDateTime(d?: Date): string {
  const now = d || new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * Safe access — returns fallback when value is nullish
 */
function safe<T>(val: T | null | undefined, fallback: T): T {
  return val != null ? val : fallback;
}

function safeStr(val: string | null | undefined, fallback = '—'): string {
  return val != null && val !== '' ? val : fallback;
}

// ---------------------------------------------------------------------------
// SVG LOGO (inline, used in cover + headers)
// ---------------------------------------------------------------------------
const SVG_LOGO = `<svg viewBox="110 10 300 210" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="translate(180 24)"><path d="M64 0L122 40V102L64 142V102L92 81L64 64V0Z" fill="#FFFFFF"/><path d="M64 34L92 54L64 75V34Z" fill="#071D34"/><path d="M64 142L28 116V80L64 55V90L42 105L64 121V142Z" fill="#FFFFFF"/></g></svg>`;

// ---------------------------------------------------------------------------
// CSS (verbatim from the static file)
// ---------------------------------------------------------------------------
const CSS = `
        /* ===========================================
           CSS CUSTOM PROPERTIES — ROCHA PRIME THEME
           =========================================== */
        :root {
            /* Rocha Prime brand colors */
            --navy: #1B2A4A;
            --navy-deep: #0F1B33;
            --navy-light: #243B5E;
            --blue-accent: #3B82C4;
            --blue-light: #5BA3E6;
            --orange: #E67E22;
            --orange-glow: rgba(230, 126, 34, 0.25);
            --orange-light: #F5A623;
            --green: #27AE60;
            --green-light: #2ECC71;
            --red: #E74C3C;
            --red-light: #FF6B6B;
            --gray-100: #F8F9FA;
            --gray-200: #E9ECEF;
            --gray-300: #DEE2E6;
            --gray-400: #ADB5BD;
            --gray-600: #6C757D;
            --gray-800: #343A40;
            --white: #FFFFFF;
            --text-dark: #1a1a2e;

            /* Stage */
            --stage-bg: var(--navy-deep);
            --slide-bg: var(--white);

            /* Typography */
            --font-display: 'DM Serif Display', Georgia, serif;
            --font-body: 'DM Sans', system-ui, sans-serif;
            --title-size: 56px;
            --subtitle-size: 30px;
            --body-size: 22px;
            --small-size: 16px;

            /* Spacing */
            --slide-padding: 72px;
            --content-gap: 28px;

            /* Animation */
            --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
            --duration-normal: 0.6s;
        }

        /* ===========================================
           RESET
           =========================================== */
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        /* ===========================================
           FIXED 16:9 STAGE: MANDATORY BASE STYLES
           =========================================== */
        html, body {
            width: 100%; height: 100%; margin: 0;
            overflow: hidden;
            background: var(--stage-bg);
        }

        .deck-viewport {
            position: fixed; inset: 0;
            overflow: hidden;
            background: var(--stage-bg);
        }

        .deck-stage {
            position: absolute; left: 0; top: 0;
            width: 1920px; height: 1080px;
            overflow: hidden;
            transform-origin: 0 0;
            background: var(--slide-bg);
        }

        .slide {
            position: absolute; inset: 0;
            width: 1920px; height: 1080px;
            overflow: hidden;
            display: block;
            visibility: hidden; opacity: 0;
            pointer-events: none;
            background: var(--slide-bg);
        }

        .slide.active, .slide.visible {
            visibility: visible; opacity: 1;
            pointer-events: auto; z-index: 1;
        }

        img, video, canvas, svg { max-width: 100%; max-height: 100%; }

        .deck-controls {
            position: fixed; left: 50%; bottom: 22px;
            transform: translateX(-50%);
            z-index: 1000;
        }

        @media print {
            html, body { width: 1920px; height: auto; overflow: visible; background: #fff; }
            .deck-viewport { position: static; overflow: visible; background: #fff; }
            .deck-stage { position: static; width: auto; height: auto; transform: none !important; background: none; }
            .slide {
                position: relative; display: block !important;
                visibility: visible !important; opacity: 1 !important;
                pointer-events: auto !important;
                width: 1920px; height: 1080px;
                break-after: page; page-break-after: always;
            }
            .slide:last-child { break-after: auto; page-break-after: auto; }
            .deck-controls { display: none !important; }
        }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                transition-duration: 0.2s !important;
            }
        }

        /* ===========================================
           EXPORT / PRINT MODE
           Force all animated elements visible for PDF capture.
           The export-pdf.sh script forces .reveal opacity via JS,
           but inline transition-delays and opacity:0 in base CSS
           can override. This class on <html> overrides everything.
           =========================================== */
        @media print {
            .reveal, .reveal-left {
                opacity: 1 !important;
                transform: none !important;
                transition: none !important;
            }
        }

        /* ===========================================
           ANIMATIONS
           =========================================== */
        .reveal {
            opacity: 0; transform: translateY(24px);
            transition: opacity var(--duration-normal) var(--ease-out-expo),
                        transform var(--duration-normal) var(--ease-out-expo);
        }
        .slide.visible .reveal { opacity: 1; transform: translateY(0); }
        .reveal:nth-child(1) { transition-delay: 0.08s; }
        .reveal:nth-child(2) { transition-delay: 0.16s; }
        .reveal:nth-child(3) { transition-delay: 0.24s; }
        .reveal:nth-child(4) { transition-delay: 0.32s; }
        .reveal:nth-child(5) { transition-delay: 0.40s; }
        .reveal:nth-child(6) { transition-delay: 0.48s; }

        .reveal-left {
            opacity: 0; transform: translateX(-40px);
            transition: opacity 0.6s var(--ease-out-expo), transform 0.6s var(--ease-out-expo);
        }
        .slide.visible .reveal-left { opacity: 1; transform: translateX(0); }

        @keyframes countUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes barGrow { from { width: 0; } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }

        /* ===========================================
           GLOBAL SLIDE LAYOUT
           =========================================== */
        .slide-header {
            position: absolute; top: 0; left: 0; right: 0;
            height: 72px;
            background: var(--navy);
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 48px;
            z-index: 10;
        }
        .slide-header .logo-area {
            display: flex; align-items: center; gap: 16px;
            color: var(--white); font-family: var(--font-body);
        }
        .slide-header .logo-area .logo-icon {
            width: 36px; height: 36px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .slide-header .logo-area .logo-icon svg {
            width: 100%; height: 100%;
        }
        .slide-header .logo-area span {
            font-size: 14px; font-weight: 500; letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .slide-header .header-right {
            display: flex; align-items: center; gap: 24px;
            font-size: 12px; color: rgba(255,255,255,0.6);
            font-family: var(--font-body);
        }
        .slide-header .badge-confidencial {
            background: var(--orange);
            color: var(--white);
            padding: 4px 14px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .slide-body {
            position: absolute;
            top: 72px; left: 0; right: 0; bottom: 48px;
            padding: 40px 64px;
            overflow: hidden;
        }

        .slide-footer {
            position: absolute; bottom: 0; left: 0; right: 0;
            height: 48px;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 64px;
            font-family: var(--font-body);
            font-size: 11px; color: var(--gray-400);
            border-top: 1px solid var(--gray-200);
            background: var(--gray-100);
        }
        .slide-footer .page-num {
            font-weight: 600; color: var(--navy);
        }

        /* ===========================================
           SECTION TITLE BAR
           =========================================== */
        .section-bar {
            background: linear-gradient(135deg, var(--navy), var(--navy-light));
            color: var(--white);
            padding: 14px 28px;
            border-radius: 8px;
            font-family: var(--font-body);
            font-size: 13px; font-weight: 600;
            letter-spacing: 2px;
            text-transform: uppercase;
            display: inline-block;
            margin-bottom: 20px;
        }

        .slide-title {
            font-family: var(--font-display);
            font-size: var(--title-size);
            color: var(--navy);
            line-height: 1.15;
            margin-bottom: 16px;
        }
        .slide-subtitle {
            font-family: var(--font-body);
            font-size: var(--subtitle-size);
            color: var(--gray-600);
            line-height: 1.4;
            font-weight: 400;
        }

        /* ===========================================
           KPI CARDS
           =========================================== */
        .kpi-row {
            display: flex; gap: 24px; margin: 24px 0;
        }
        .kpi-card {
            flex: 1;
            background: var(--white);
            border: 1px solid var(--gray-200);
            border-radius: 16px;
            padding: 28px 32px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .kpi-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
        .kpi-card::before {
            content: '';
            position: absolute; top: 0; left: 0;
            width: 4px; height: 100%;
        }
        .kpi-card.blue::before { background: var(--blue-accent); }
        .kpi-card.orange::before { background: var(--orange); }
        .kpi-card.green::before { background: var(--green); }
        .kpi-card.red::before { background: var(--red); }
        .kpi-card.navy::before { background: var(--navy); }

        .kpi-label {
            font-family: var(--font-body);
            font-size: 13px; font-weight: 600;
            color: var(--gray-600);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        .kpi-value {
            font-family: var(--font-display);
            font-size: 42px; color: var(--navy);
            line-height: 1.1;
        }
        .kpi-value.large { font-size: 52px; }
        .kpi-detail {
            font-family: var(--font-body);
            font-size: 14px; color: var(--gray-600);
            margin-top: 6px;
        }
        .kpi-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 13px; font-weight: 600;
            font-family: var(--font-body);
            margin-top: 6px;
        }
        .kpi-badge.positive { background: rgba(39,174,96,0.1); color: var(--green); }
        .kpi-badge.negative { background: rgba(231,76,60,0.1); color: var(--red); }
        .kpi-badge.neutral { background: rgba(59,130,196,0.1); color: var(--blue-accent); }

        /* ===========================================
           DATA TABLES
           =========================================== */
        .data-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 8px rgba(0,0,0,0.06);
            font-family: var(--font-body);
            font-size: 18px;
        }
        .data-table thead th {
            background: var(--navy);
            color: var(--white);
            padding: 16px 20px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .data-table thead th:last-child { text-align: right; }
        .data-table tbody td {
            padding: 14px 20px;
            border-bottom: 1px solid var(--gray-200);
            color: var(--text-dark);
        }
        .data-table tbody td:last-child { text-align: right; font-weight: 500; }
        .data-table tbody tr:nth-child(even) { background: var(--gray-100); }
        .data-table tbody tr:last-child td { border-bottom: none; }
        .data-table tbody tr:hover { background: rgba(59,130,196,0.05); }
        .data-table .total-row td {
            background: var(--navy-deep) !important;
            color: var(--white) !important;
            font-weight: 700;
        }

        /* ===========================================
           CHART CONTAINERS
           =========================================== */
        .chart-container {
            background: var(--white);
            border-radius: 16px;
            padding: 28px;
            border: 1px solid var(--gray-200);
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }
        .chart-title {
            font-family: var(--font-body);
            font-size: 15px; font-weight: 700;
            color: var(--navy);
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Bar chart (CSS only) */
        .bar-chart { display: flex; flex-direction: column; gap: 12px; }
        .bar-item { display: flex; align-items: center; gap: 16px; }
        .bar-label {
            width: 80px; font-family: var(--font-body);
            font-size: 16px; font-weight: 600; color: var(--navy);
            text-align: right; flex-shrink: 0;
        }
        .bar-track {
            flex: 1; height: 36px;
            background: var(--gray-200);
            border-radius: 8px; overflow: hidden;
            position: relative;
        }
        .bar-fill {
            height: 100%;
            border-radius: 8px;
            background: linear-gradient(90deg, var(--blue-accent), var(--blue-light));
            display: flex; align-items: center;
            padding-left: 12px;
            font-family: var(--font-body);
            font-size: 13px; font-weight: 600; color: var(--white);
            transition: width 1.2s var(--ease-out-expo);
        }
        .slide.visible .bar-fill { animation: barGrow 1.2s var(--ease-out-expo) forwards; }

        /* Donut chart (SVG) */
        .donut-chart {
            display: flex; align-items: center; gap: 40px;
        }
        .donut-svg { width: 220px; height: 220px; flex-shrink: 0; }
        .donut-legend {
            display: flex; flex-direction: column; gap: 14px;
        }
        .donut-legend-item {
            display: flex; align-items: center; gap: 12px;
            font-family: var(--font-body); font-size: 16px;
        }
        .donut-legend-dot {
            width: 14px; height: 14px;
            border-radius: 4px; flex-shrink: 0;
        }
        .donut-legend-value {
            font-weight: 700; color: var(--navy);
            margin-left: auto;
        }

        /* ===========================================
           CALLOUT / ALERTS
           =========================================== */
        .callout {
            padding: 20px 28px;
            border-radius: 12px;
            font-family: var(--font-body);
            font-size: 17px;
            line-height: 1.5;
            display: flex; align-items: flex-start; gap: 16px;
            margin: 16px 0;
        }
        .callout-icon {
            font-size: 22px; flex-shrink: 0;
            margin-top: 2px;
        }
        .callout.info {
            background: rgba(59,130,196,0.08);
            border-left: 4px solid var(--blue-accent);
            color: var(--navy);
        }
        .callout.success {
            background: rgba(39,174,96,0.08);
            border-left: 4px solid var(--green);
            color: #1a5c35;
        }
        .callout.warning {
            background: rgba(230,126,34,0.08);
            border-left: 4px solid var(--orange);
            color: #7a4a12;
        }
        .callout.danger {
            background: rgba(231,76,60,0.08);
            border-left: 4px solid var(--red);
            color: #8b2020;
        }

        /* ===========================================
           STATUS BADGES
           =========================================== */
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 12px; font-weight: 700;
            font-family: var(--font-body);
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .status-badge.auto { background: rgba(39,174,96,0.12); color: var(--green); }
        .status-badge.estimated { background: rgba(230,126,34,0.12); color: var(--orange); }
        .status-badge.manual { background: rgba(231,76,60,0.12); color: var(--red); }
        .status-badge.historico { background: rgba(59,130,196,0.12); color: var(--blue-accent); }

        /* ===========================================
           TWO-COLUMN LAYOUT
           =========================================== */
        .two-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            height: 100%;
        }
        .two-col.ratio-60-40 { grid-template-columns: 3fr 2fr; }
        .two-col.ratio-40-60 { grid-template-columns: 2fr 3fr; }

        /* ===========================================
           BULLET LIST
           =========================================== */
        .bullet-list {
            list-style: none; padding: 0;
            font-family: var(--font-body);
            font-size: 18px;
            color: var(--text-dark);
        }
        .bullet-list li {
            padding: 10px 0 10px 28px;
            position: relative;
            line-height: 1.5;
            border-bottom: 1px solid var(--gray-200);
        }
        .bullet-list li:last-child { border-bottom: none; }
        .bullet-list li::before {
            content: '';
            position: absolute; left: 0; top: 18px;
            width: 8px; height: 8px;
            border-radius: 2px;
            background: var(--orange);
        }

        /* ===========================================
           COVER SLIDE (SPECIAL)
           =========================================== */
        .cover-slide {
            background: linear-gradient(135deg, var(--navy-deep) 0%, var(--navy) 40%, var(--navy-light) 100%);
            color: var(--white);
        }
        .cover-slide .slide-body { padding: 0; top: 0; bottom: 0; }
        .cover-grid {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            height: 100%;
        }
        .cover-left {
            padding: 80px 72px;
            display: flex; flex-direction: column;
            justify-content: center;
        }
        .cover-right {
            background: rgba(255,255,255,0.04);
            padding: 80px 56px;
            display: flex; flex-direction: column;
            justify-content: center;
            border-left: 1px solid rgba(255,255,255,0.08);
        }
        .cover-logo {
            display: flex; align-items: center; gap: 16px;
            margin-bottom: 48px;
        }
        .cover-logo-icon {
            width: 56px; height: 56px;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .cover-logo-icon svg {
            width: 100%; height: 100%;
        }
        .cover-logo-text {
            font-family: var(--font-body);
            font-size: 16px; font-weight: 600;
            color: rgba(255,255,255,0.8);
            letter-spacing: 1px; text-transform: uppercase;
        }
        .cover-title {
            font-family: var(--font-display);
            font-size: 68px; line-height: 1.1;
            color: var(--white);
            margin-bottom: 20px;
        }
        .cover-subtitle {
            font-family: var(--font-body);
            font-size: 22px; color: rgba(255,255,255,0.6);
            line-height: 1.5;
            margin-bottom: 36px;
        }
        .cover-badge {
            display: inline-block;
            background: var(--orange);
            color: var(--white);
            padding: 8px 20px;
            border-radius: 6px;
            font-family: var(--font-body);
            font-size: 13px; font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
        }
        .cover-kpi {
            margin-bottom: 36px;
        }
        .cover-kpi-label {
            font-family: var(--font-body);
            font-size: 12px; font-weight: 600;
            color: rgba(255,255,255,0.5);
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .cover-kpi-value {
            font-family: var(--font-display);
            font-size: 52px; color: var(--white);
            line-height: 1.1;
        }
        .cover-kpi-detail {
            font-family: var(--font-body);
            font-size: 14px; color: rgba(255,255,255,0.5);
            margin-top: 4px;
        }
        .cover-separator {
            width: 60px; height: 3px;
            background: var(--orange);
            border-radius: 2px;
            margin: 24px 0;
        }
        .cover-info-list {
            list-style: none; padding: 0;
            font-family: var(--font-body);
        }
        .cover-info-list li {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 10px 0;
            color: rgba(255,255,255,0.7);
            font-size: 15px; line-height: 1.4;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .cover-info-list li:last-child { border-bottom: none; }
        .cover-info-list .info-icon {
            color: var(--orange); font-size: 16px; flex-shrink: 0; margin-top: 2px;
        }

        .cover-footer {
            position: absolute; bottom: 0; left: 0; right: 0;
            height: 48px;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 72px;
            font-family: var(--font-body);
            font-size: 11px;
            color: rgba(255,255,255,0.3);
            border-top: 1px solid rgba(255,255,255,0.06);
        }

        /* ===========================================
           SECTION DIVIDER SLIDE
           =========================================== */
        .section-slide {
            background: linear-gradient(135deg, var(--navy-deep), var(--navy));
            color: var(--white);
        }
        .section-slide .slide-body {
            display: flex; flex-direction: column;
            justify-content: center;
            padding: 80px 120px;
        }
        .section-number {
            font-family: var(--font-display);
            font-size: 120px;
            color: var(--orange);
            opacity: 0.3;
            line-height: 1;
            margin-bottom: -20px;
        }
        .section-label {
            font-family: var(--font-body);
            font-size: 14px; font-weight: 600;
            color: var(--orange);
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-bottom: 16px;
        }
        .section-title {
            font-family: var(--font-display);
            font-size: 64px; color: var(--white);
            line-height: 1.15;
        }
        .section-desc {
            font-family: var(--font-body);
            font-size: 22px; color: rgba(255,255,255,0.5);
            margin-top: 16px;
            max-width: 700px;
        }

        /* ===========================================
           HIGHLIGHT BOX
           =========================================== */
        .highlight-box {
            background: linear-gradient(135deg, var(--navy), var(--navy-light));
            border-radius: 16px;
            padding: 36px 40px;
            color: var(--white);
        }
        .highlight-box .hl-label {
            font-family: var(--font-body);
            font-size: 13px; font-weight: 600;
            color: var(--orange);
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .highlight-box .hl-value {
            font-family: var(--font-display);
            font-size: 48px;
            line-height: 1.1;
        }
        .highlight-box .hl-detail {
            font-family: var(--font-body);
            font-size: 16px;
            color: rgba(255,255,255,0.6);
            margin-top: 8px;
        }

        /* ===========================================
           PROGRESS BAR (navigation)
           =========================================== */
        .nav-bar {
            position: fixed; bottom: 0; left: 0; right: 0;
            height: 4px; background: rgba(0,0,0,0.1);
            z-index: 1001;
        }
        .nav-bar-fill {
            height: 100%;
            background: var(--orange);
            transition: width 0.4s ease;
        }
        .page-indicator {
            position: fixed; bottom: 12px; right: 24px;
            font-family: var(--font-body);
            font-size: 13px; font-weight: 600;
            color: rgba(255,255,255,0.5);
            z-index: 1001;
        }

        /* ===========================================
           MISC UTILITIES
           =========================================== */
        .text-orange { color: var(--orange); }
        .text-green { color: var(--green); }
        .text-blue { color: var(--blue-accent); }
        .text-navy { color: var(--navy); }
        .text-muted { color: var(--gray-600); }
        .fw-600 { font-weight: 600; }
        .fw-700 { font-weight: 700; }
        .mb-8 { margin-bottom: 8px; }
        .mb-16 { margin-bottom: 16px; }
        .mb-24 { margin-bottom: 24px; }
        .mt-16 { margin-top: 16px; }
        .mt-24 { margin-top: 24px; }
        .font-body { font-family: var(--font-body); }
        .font-display { font-family: var(--font-display); }
        .small-text { font-size: var(--small-size); }

        /* Decorative line */
        .accent-line {
            width: 48px; height: 3px;
            background: var(--orange);
            border-radius: 2px;
            margin-bottom: 16px;
        }
`;

// ---------------------------------------------------------------------------
// JAVASCRIPT (navigation controller — verbatim from the static file)
// ---------------------------------------------------------------------------
const NAVIGATION_JS = `
        /* ===========================================
           SLIDE PRESENTATION CONTROLLER
           =========================================== */
        class SlidePresentation {
            constructor() {
                this.slides = document.querySelectorAll('.slide');
                this.currentSlide = 0;
                this.stage = document.getElementById('deckStage');
                this.navFill = document.getElementById('navBarFill');
                this.pageIndicator = document.getElementById('pageIndicator');
                this.isAnimating = false;
                this.setupStageScale();
                this.setupKeyboardNav();
                this.setupTouchNav();
                this.setupWheelNav();
                this.showSlide(0);
            }

            setupStageScale() {
                const scale = () => {
                    const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
                    const x = (window.innerWidth - 1920 * factor) / 2;
                    const y = (window.innerHeight - 1080 * factor) / 2;
                    this.stage.style.transform = \`translate(\${x}px, \${y}px) scale(\${factor})\`;
                };
                scale();
                window.addEventListener('resize', scale);
            }

            setupKeyboardNav() {
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
                        e.preventDefault();
                        this.next();
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
                        e.preventDefault();
                        this.prev();
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        this.showSlide(0);
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        this.showSlide(this.slides.length - 1);
                    }
                });
            }

            setupTouchNav() {
                let startX = 0, startY = 0;
                this.stage.addEventListener('touchstart', (e) => {
                    startX = e.changedTouches[0].screenX;
                    startY = e.changedTouches[0].screenY;
                }, { passive: true });
                this.stage.addEventListener('touchend', (e) => {
                    const dx = e.changedTouches[0].screenX - startX;
                    const dy = e.changedTouches[0].screenY - startY;
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
                        dx < 0 ? this.next() : this.prev();
                    }
                }, { passive: true });
            }

            setupWheelNav() {
                let lastWheel = 0;
                document.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const now = Date.now();
                    if (now - lastWheel < 600) return;
                    lastWheel = now;
                    e.deltaY > 0 ? this.next() : this.prev();
                }, { passive: false });
            }

            next() {
                if (this.currentSlide < this.slides.length - 1) {
                    this.showSlide(this.currentSlide + 1);
                }
            }

            prev() {
                if (this.currentSlide > 0) {
                    this.showSlide(this.currentSlide - 1);
                }
            }

            showSlide(index) {
                this.currentSlide = Math.max(0, Math.min(index, this.slides.length - 1));
                this.slides.forEach((slide, i) => {
                    slide.classList.toggle('active', i === this.currentSlide);
                    slide.classList.toggle('visible', i === this.currentSlide);
                });

                // Update progress
                const progress = ((this.currentSlide + 1) / this.slides.length) * 100;
                this.navFill.style.width = progress + '%';
                this.pageIndicator.textContent = \`\${this.currentSlide + 1} / \${this.slides.length}\`;
            }
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            new SlidePresentation();
        });
`;

// ---------------------------------------------------------------------------
// DONUT CHART GENERATOR
// ---------------------------------------------------------------------------

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * Generates the SVG donut chart + legend for the Composição das Receitas slide.
 * circumference = 2 * π * r = 2 * π * 85 ≈ 534.07
 */
function generateDonutChart(
  segments: DonutSegment[],
  totalValue: number,
  centerLabel: string,
): string {
  const r = 85;
  const circumference = 2 * Math.PI * r; // ≈534.07
  let offset = 0;

  const circles = segments
    .filter(s => s.value > 0)
    .map(s => {
      const pct = totalValue > 0 ? s.value / totalValue : 0;
      const dashLen = pct * circumference;
      const circle = `<circle cx="110" cy="110" r="${r}" fill="none" stroke="${s.color}" stroke-width="30"
                    stroke-dasharray="${dashLen.toFixed(0)} ${circumference.toFixed(0)}" stroke-dashoffset="${offset === 0 ? 0 : -offset.toFixed(0)}"
                    transform="rotate(-90 110 110)"
                    style="transition:stroke-dasharray 1.2s ease;"/>`;
      offset += dashLen;
      return circle;
    })
    .join('\n                                ');

  const legendItems = segments
    .filter(s => s.value > 0)
    .map(s => {
      const pct = totalValue > 0 ? ((s.value / totalValue) * 100) : 0;
      return `<div class="donut-legend-item">
                                    <span class="donut-legend-dot" style="background:${s.color}"></span>
                                    <span>${s.label}</span>
                                    <span class="donut-legend-value">${formatPercent(pct)}</span>
                                </div>`;
    })
    .join('\n                                ');

  return `<svg class="donut-svg" viewBox="0 0 220 220" style="width:200px;height:200px;">
                                <!-- Fundo -->
                                <circle cx="110" cy="110" r="${r}" fill="none" stroke="var(--gray-200)" stroke-width="30"/>
                                ${circles}
                                <!-- Center text -->
                                <text x="110" y="105" text-anchor="middle" font-family="var(--font-display)" font-size="28" fill="var(--navy)">${centerLabel}</text>
                                <text x="110" y="130" text-anchor="middle" font-family="var(--font-body)" font-size="13" fill="var(--gray-600)">milhões</text>
                            </svg>
                            <div class="donut-legend" style="margin-top:20px;width:100%;">
                                ${legendItems}
                            </div>`;
}

// ---------------------------------------------------------------------------
// BAR CHART HELPERS
// ---------------------------------------------------------------------------

interface BarItem {
  label: string;
  value: number;
  displayValue: string;
  isHighlight?: boolean;
  gradient?: string;
}

/**
 * Generates horizontal bar chart HTML items. The largest value = 100%.
 */
function generateBarChart(items: BarItem[]): string {
  if (!items.length) return '<div class="bar-chart"></div>';
  const maxVal = Math.max(...items.map(i => i.value));

  return items
    .map(item => {
      const widthPct = maxVal > 0 ? ((item.value / maxVal) * 100).toFixed(1) : '0';
      const gradient = item.gradient || 'linear-gradient(90deg, var(--blue-accent), var(--blue-light))';
      const labelStyle = item.isHighlight
        ? ' style="color:var(--orange);font-weight:700;"'
        : '';
      const fillStyle = item.isHighlight
        ? `width:${widthPct}%;background:linear-gradient(90deg,var(--orange),var(--orange-light));`
        : `width:${widthPct}%;${item.gradient ? `background:${gradient};` : ''}`;
      return `<div class="bar-item"><span class="bar-label"${labelStyle}>${item.label}</span><div class="bar-track"><div class="bar-fill" style="${fillStyle}">${item.displayValue}</div></div></div>`;
    })
    .join('\n                                ');
}

// ---------------------------------------------------------------------------
// SLIDE HEADER / FOOTER TEMPLATES
// ---------------------------------------------------------------------------

function slideHeader(data: ComercialPdfData): string {
  return `<div class="slide-header">
                    <div class="logo-area"><div class="logo-icon">${SVG_LOGO}</div><span>Rocha Prime Serviços Especializados</span></div>
                    <div class="header-right"><span>${data.municipio} - ${data.uf}</span><span class="badge-confidencial">Documento Confidencial</span></div>
                </div>`;
}

function slideHeaderText(data: ComercialPdfData): string {
  return `<div class="slide-header">
                    <div class="logo-area"><div class="logo-icon">RP</div><span>Rocha Prime Serviços Especializados</span></div>
                    <div class="header-right"><span>${data.municipio} - ${data.uf}</span><span class="badge-confidencial">Documento Confidencial</span></div>
                </div>`;
}

function slideFooter(pageNum: number, totalPages: number): string {
  return `<div class="slide-footer">
                    <span>Rocha Prime Serviços Especializados Ltda | CNPJ: 29.342.691/0001-93</span>
                    <span class="page-num">${pageNum} / ${totalPages}</span>
                </div>`;
}

function sectionFooter(pageNum: number, totalPages: number): string {
  return `<div class="cover-footer">
                    <span>Rocha Prime Serviços Especializados Ltda</span>
                    <span class="page-num" style="color:rgba(255,255,255,0.4)">${pageNum} / ${totalPages}</span>
                </div>`;
}

// ---------------------------------------------------------------------------
// SÉRIE HISTÓRICA RANGE LABEL
// ---------------------------------------------------------------------------
function serieRange(data: ComercialPdfData): string {
  const sh = data.serieHistorica;
  if (!sh || sh.length === 0) return `Série ${data.exercicio}`;
  const anos = sh.map(s => s.ano).sort((a, b) => a - b);
  return `Série ${anos[0]} a ${anos[anos.length - 1]}`;
}

// ---------------------------------------------------------------------------
// MAIN GENERATOR FUNCTION
// ---------------------------------------------------------------------------

/**
 * Generates the full HTML for the FUNDEB Commercial Premium Presentation.
 *
 * @param data - All dynamic data for the presentation
 * @returns Complete HTML string ready to be rendered or exported to PDF
 */
export function generateComercialHtml(data: ComercialPdfData): string {
  const totalPages = 20; // fixed to match the original deck numbering
  const now = new Date();
  const r = data.receitas;
  const p = data.projecao;
  const shRaw = data.serieHistorica ?? [];
  // Filter out years where totalReceitasFundeb is 0/null AND totalMatriculas is 0/null (no real data)
  const sh = shRaw.filter(s =>
    (s.totalReceitasFundeb != null && s.totalReceitasFundeb > 0) ||
    (s.totalMatriculas != null && s.totalMatriculas > 0)
  );
  const gestorNome = data.gestor?.nome ?? '—';
  const gestorPartido = data.gestor?.partido ?? '—';
  const mandato = data.gestor?.mandato ?? '—';
  const classificacaoMandato = data.gestor?.classificacaoMandato ?? '—';

  // Compute receita percentages
  const pctMunicipal = r.totalReceitas > 0 ? (r.receitaContribuicaoMunicipal / r.totalReceitas) * 100 : 0;
  const pctVAAF = r.totalReceitas > 0 ? (r.complementacaoVAAF / r.totalReceitas) * 100 : 0;
  const pctVAAT = r.totalReceitas > 0 ? (r.complementacaoVAAT / r.totalReceitas) * 100 : 0;
  const pctVAAR = r.totalReceitas > 0 ? (r.complementacaoVAAR / r.totalReceitas) * 100 : 0;

  // Série histórica – compute bar widths (by total receita, relative to max)
  // Only show bars for years with actual revenue data
  const shReceitas = sh.filter(s => s.totalReceitasFundeb != null && s.totalReceitasFundeb > 0);
  const maxShReceita = shReceitas.length > 0 ? Math.max(...shReceitas.map(s => s.totalReceitasFundeb!)) : 1;

  // IDEB latest
  const idebIniciais = data.idebAnosIniciais ?? [];
  const idebFinais = data.idebAnosFinais ?? [];
  const idebEM = data.idebEnsinoMedio ?? [];
  const latestIniciais = idebIniciais.length > 0 ? idebIniciais[idebIniciais.length - 1] : null;
  const latestFinais = idebFinais.length > 0 ? idebFinais[idebFinais.length - 1] : null;
  const latestEM = idebEM.length > 0 ? idebEM[idebEM.length - 1] : null;

  // Sanitize encoding artifacts in VAAT text (e.g., "C☐LCULO" → "CÁLCULO")
  const vaatHabilitado = (data.habilitacaoVaat ?? 'Não informado')
    .replace(/C[\u2610\u25A1\uFFFD]LCULO/gi, 'CÁLCULO')
    .replace(/[\uFFFD]/g, '');
  const vaatIsHabilitado = vaatHabilitado.toLowerCase().includes('habilit');
  const vaatCalloutClass = vaatIsHabilitado ? 'success' : 'warning';
  const vaatCalloutIcon = vaatIsHabilitado ? '✅' : '⚠️';
  const vaatBadgeClass = vaatIsHabilitado ? 'auto' : 'estimated';

  // Eficiência
  const ef = data.eficiencia;

  // PDDE
  const pddeItems = data.pdde?.historico ?? [];
  const latestPdde = pddeItems.length > 0 ? pddeItems[pddeItems.length - 1] : null;
  const maxPdde = pddeItems.length > 0 ? Math.max(...pddeItems.map(p => p.valor)) : 1;

  // Rastreabilidade
  const rastreabilidade = data.rastreabilidade ?? [
    { fonte: 'IBGE', status: 'auto' as const, leitura: 'Busca territorial e identificação municipal resolvidas automaticamente.' },
    { fonte: 'FNDE / SICONFI', status: 'auto' as const, leitura: 'Base fiscal consolidada automaticamente com suporte do SICONFI/Tesouro.' },
    { fonte: 'MEC / FNDE', status: 'estimated' as const, leitura: 'Consultas públicas e evidências operacionais localizadas automaticamente.' },
    { fonte: 'INEP / QEdu', status: 'auto' as const, leitura: 'Censo escolar carregado automaticamente pela base interna.' },
    { fonte: 'PDDE / FNDE', status: 'auto' as const, leitura: 'PDDE consolidado automaticamente para o município.' },
  ];

  // Recomendações
  const recomendacoes = data.recomendacoes ?? [
    'Validar a base de cálculo do ICMS e a aplicação do percentual mínimo de 28% com assessoria jurídico-tributária especializada.',
    'Conferir documentalmente as bases que determinam a captura de VAAF, VAAT e VAAR junto ao FNDE.',
    'Verificar atos normativos locais referentes à oferta de EJA, educação em tempo integral e parcerias intersetoriais com impacto no Censo Escolar.',
  ];

  // Próximos passos
  const proximosPassos = data.proximosPassos ?? [
    'Validar receitas atuais do FUNDEB',
    'Levantar status dos sistemas MEC/FNDE',
    'Conferir bases do Censo Escolar e indicadores da rede municipal',
  ];

  // Alertas técnicos
  const alertas = data.alertas ?? [
    { tipo: 'warning' as const, icone: '⚠️', texto: 'Os valores projetados têm <strong>caráter estimativo</strong> e dependem de validação documental nas bases oficiais do FUNDEB e dos sistemas MEC/FNDE.' },
    { tipo: 'danger' as const, icone: '🚫', texto: 'Não atribuir variação de receita a falha de gestão sem evidência oficial devidamente apurada.' },
  ];

  // Sistemas federais
  const sistemasFederais = data.sistemasFederais ?? [
    { instituicao: 'MEC', sistema: 'SIMEC', situacao: 'Requer credencial do ente para status operacional detalhado.' },
    { instituicao: 'FNDE', sistema: 'Habilita', situacao: 'Requer credencial do ente para acompanhamento operacional.' },
    { instituicao: 'FNDE', sistema: 'SIGARPWEB', situacao: `Consulta pública disponível no FNDE. Entidade localizada: PREF MUN DE ${data.municipio.toUpperCase()}.` },
    { instituicao: 'FNDE', sistema: 'SIGPC', situacao: 'Consulta pública de prestação de contas disponível no FNDE.' },
    { instituicao: 'FNDE', sistema: 'PDDE Info', situacao: `Consulta pública localizou ${data.censo?.totalEscolas ?? '—'} escola(s) neste município.` },
  ];

  // Série histórica metrics for comparison slide
  // Use only years with real receita data for financial deltas
  const shWithReceita = sh.filter(s => s.totalReceitasFundeb != null && s.totalReceitasFundeb > 0);
  const firstSh = shWithReceita.length > 0 ? shWithReceita[0] : null;
  const lastSh = shWithReceita.length > 0 ? shWithReceita[shWithReceita.length - 1] : null;
  // Use only years with real matrícula data (> 0) for educational deltas
  const shWithMatriculas = sh.filter(s => s.totalMatriculas != null && s.totalMatriculas > 0);
  const firstShWithMatriculas = shWithMatriculas.length > 0 ? shWithMatriculas[0] : null;
  const lastShWithMatriculas = shWithMatriculas.length > 0 ? shWithMatriculas[shWithMatriculas.length - 1] : null;
  // Use only years with real TI data (> 0) for integral deltas
  const shWithTI = sh.filter(s => s.tempoIntegral != null && s.tempoIntegral > 0);
  const firstShWithTI = shWithTI.length > 0 ? shWithTI[0] : null;
  const lastShWithTI = shWithTI.length > 0 ? shWithTI[shWithTI.length - 1] : null;

  const receitaDelta = (firstSh && lastSh && firstSh !== lastSh)
    ? lastSh.totalReceitasFundeb! - firstSh.totalReceitasFundeb! : null;
  const receitaDeltaPct = (firstSh?.totalReceitasFundeb && receitaDelta != null)
    ? (receitaDelta / firstSh.totalReceitasFundeb) * 100 : null;
  const matriculasDelta = (firstShWithMatriculas?.totalMatriculas != null && lastShWithMatriculas?.totalMatriculas != null && firstShWithMatriculas !== lastShWithMatriculas)
    ? lastShWithMatriculas.totalMatriculas - firstShWithMatriculas.totalMatriculas : null;
  const matriculasDeltaPct = (firstShWithMatriculas?.totalMatriculas && matriculasDelta != null)
    ? (matriculasDelta / firstShWithMatriculas.totalMatriculas) * 100 : null;
  const tiDelta = (firstShWithTI?.tempoIntegral != null && lastShWithTI?.tempoIntegral != null && firstShWithTI !== lastShWithTI)
    ? lastShWithTI.tempoIntegral - firstShWithTI.tempoIntegral : null;
  const tiDeltaPct = (firstShWithTI?.tempoIntegral && tiDelta != null)
    ? (tiDelta / firstShWithTI.tempoIntegral) * 100 : null;

  // Observações rastreabilidade
  const obsRastreabilidade = data.observacoesRastreabilidade ?? 1;

  // Vetores
  const vetores = data.vetoresObservados ?? 'conferência de matrículas ponderadas e redistribuição intraestadual do VAAF.';

  // Ganhos evidenciados
  const ganhosValor = data.ganhosEvidenciados?.valor;
  const ganhosPct = data.ganhosEvidenciados?.percentual;

  // VAAT/VAAR callout for composição slide
  const vaarZero = r.complementacaoVAAR === 0;

  // Eficiência index gauge
  const efIndex = ef?.indiceEficiencia ?? 0;
  const efRadius = 60;
  const efCircumference = 2 * Math.PI * efRadius; // ≈376.99
  const efDash = (efIndex / 100) * efCircumference;

  // Próximos passos border colors
  const stepColors = ['var(--blue-accent)', 'var(--orange)', 'var(--green)', 'var(--navy)', 'var(--red)'];
  const stepEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

  // Build the full HTML
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Levantamento FUNDEB — ${data.municipio}/${data.uf}</title>

    <!-- Fonts: DM Serif Display (títulos) + DM Sans (corpo) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Serif+Display&display=swap" rel="stylesheet">

    <style>${CSS}
    </style>
</head>
<body>
    <div class="deck-viewport">
        <main class="deck-stage" id="deckStage">

            <!-- ============================================
                 SLIDE 1: CAPA
                 ============================================ -->
            <section class="slide cover-slide active">
                <div class="slide-body">
                    <div class="cover-grid">
                        <div class="cover-left">
                            <div class="cover-logo reveal">
                                <div class="cover-logo-icon">${SVG_LOGO}</div>
                                <div>
                                    <div class="cover-logo-text">Rocha Prime</div>
                                    <div style="font-family:var(--font-body);font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.5px;">Serviços Especializados</div>
                                </div>
                            </div>

                            <div class="section-label reveal" style="transition-delay:0.1s">ANÁLISE CORPORATIVA FUNDEB</div>
                            <h1 class="cover-title reveal" style="transition-delay:0.2s">
                                Diagnóstico e análise<br>corporativa do FUNDEB
                            </h1>
                            <p class="cover-subtitle reveal" style="transition-delay:0.3s">
                                Leitura executiva, financeira e comparativa com base oficial consolidada no PrimeOS.
                            </p>
                            <div class="reveal" style="transition-delay:0.4s">
                                <span class="cover-badge">${serieRange(data)}</span>
                            </div>
                        </div>

                        <div class="cover-right">
                            <div class="cover-kpi reveal" style="transition-delay:0.3s">
                                <div class="cover-kpi-label">Receita ${data.exercicio}</div>
                                <div class="cover-kpi-value">${formatBRL(r.totalReceitas)}</div>
                                <div class="cover-kpi-detail">valor base do exercício</div>
                            </div>

                            <div class="cover-kpi reveal" style="transition-delay:0.4s">
                                <div class="cover-kpi-label">Estimativa ${data.exercicio + 1}</div>
                                <div class="cover-kpi-value" style="color:var(--orange-light);">${formatBRL(p.totalProjetado)}</div>
                                <div class="cover-kpi-detail">projeção para o próximo ciclo</div>
                            </div>

                            <div class="cover-separator reveal" style="transition-delay:0.5s"></div>

                            <div class="reveal" style="transition-delay:0.55s;font-family:var(--font-body);font-size:20px;color:rgba(255,255,255,0.8);line-height:1.5;font-style:italic;margin-bottom:24px;">
                                "Uma leitura clara do que evoluiu, do que recuou e de onde está a alavanca financeira."
                            </div>

                            <ul class="cover-info-list reveal" style="transition-delay:0.6s">
                                <li><span class="info-icon">▸</span> Receita oficial do FUNDEB e complementações federais</li>
                                <li><span class="info-icon">▸</span> Base pública comparável por ano no histórico consolidado</li>
                                <li><span class="info-icon">▸</span> Alertas de evolução, retração ou estagnação</li>
                                <li><span class="info-icon">▸</span> Análise técnica para suporte à tomada de decisão</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="cover-footer">
                    <span>TÉCNICO: ADRIEL TAVARES | EMITIDO ${formatDate(now)}</span>
                    <span>Fontes: FNDE, INEP, IBGE e bases oficiais consolidadas no PrimeOS</span>
                    <span>${data.municipio.toUpperCase()} - ${data.uf}</span>
                </div>
            </section>

            <!-- ============================================
                 SLIDE 2: ABERTURA EXECUTIVA
                 ============================================ -->
            <section class="slide">
                ${slideHeader(data)}
                <div class="slide-body">
                    <div class="accent-line reveal"></div>
                    <h2 class="slide-title reveal">Abertura Executiva</h2>
                    <p class="slide-subtitle reveal" style="max-width:1200px;margin-bottom:28px;">
                        Ilmo(a). Sr(a). <strong>${gestorNome}</strong>, gestor(a) municipal. Este relatório organiza a
                        leitura do FUNDEB de ${data.exercicio} em linguagem direta: quanto o município recebeu, qual é a estimativa
                        para o próximo ciclo e quais pontos precisam ser conferidos.
                    </p>

                    <div class="kpi-row reveal" style="transition-delay:0.3s">
                        <div class="kpi-card blue">
                            <div class="kpi-label">Receita ${data.exercicio}</div>
                            <div class="kpi-value">${formatBRLShort(r.totalReceitas)}</div>
                            <div class="kpi-detail">valor usado como base do ano</div>
                        </div>
                        <div class="kpi-card orange">
                            <div class="kpi-label">Estimativa ${data.exercicio + 1}</div>
                            <div class="kpi-value">${formatBRLShort(p.totalProjetado)}</div>
                            <div class="kpi-detail">estimativa para o próximo ciclo</div>
                        </div>
                        <div class="kpi-card green">
                            <div class="kpi-label">Ganho Potencial</div>
                            <div class="kpi-value" style="color:var(--green);">${formatBRLShort(p.totalGanho)}</div>
                            <div class="kpi-badge positive">+${formatPercent(p.ganhoPercentual)} sobre a base atual</div>
                        </div>
                    </div>

                    <div class="callout info reveal" style="transition-delay:0.4s;margin-top:8px;">
                        <span class="callout-icon">📋</span>
                        <div>
                            <strong>Ganhos já evidenciados nas bases atuais:</strong> ${ganhosValor != null ? `${formatBRLFull(ganhosValor)} (+${formatPercent(ganhosPct)})` : 'dados não disponíveis'}. Os valores
                            projetados têm caráter estimativo e dependem de validação documental nas bases oficiais.
                        </div>
                    </div>

                    <div style="display:flex;gap:24px;margin-top:20px;">
                        <div class="callout ${vaatCalloutClass} reveal" style="flex:1;transition-delay:0.45s;">
                            <span class="callout-icon">${vaatCalloutIcon}</span>
                            <div><strong>Habilitação VAAT:</strong> ${vaatHabilitado}.</div>
                        </div>
                        <div class="callout warning reveal" style="flex:1;transition-delay:0.5s;">
                            <span class="callout-icon">🔍</span>
                            <div><strong>Vetores observados:</strong> ${vetores}</div>
                        </div>
                    </div>
                </div>
                ${slideFooter(2, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 3: IDENTIFICAÇÃO DO ENTE FEDERATIVO
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <div class="two-col ratio-60-40">
                        <div>
                            <div class="section-bar reveal">Seção 1</div>
                            <h2 class="slide-title reveal">Identificação do<br>Ente Federativo</h2>

                            <table class="data-table reveal" style="transition-delay:0.3s;margin-top:20px;">
                                <thead><tr><th>Campo</th><th>Valor</th></tr></thead>
                                <tbody>
                                    <tr><td>Município</td><td>${data.municipio} - ${data.uf}</td></tr>
                                    <tr><td>Código IBGE</td><td>${safeStr(data.codigoIbge)}</td></tr>
                                    <tr><td>Gestor Municipal</td><td>${gestorNome}</td></tr>
                                    <tr><td>Partido</td><td>${gestorPartido}</td></tr>
                                    <tr><td>Exercício de Análise</td><td>${data.exercicio}</td></tr>
                                    <tr><td>Base Legal</td><td>Lei nº 14.113/2020 (Novo FUNDEB)</td></tr>
                                    <tr><td>Fonte de Dados</td><td>Portaria FNDE / MEC - FUNDEB ${data.exercicio}</td></tr>
                                    <tr><td>Mesorregião</td><td>${safeStr(data.mesorregiao)}</td></tr>
                                    <tr><td>Microrregião</td><td>${safeStr(data.microrregiao)}</td></tr>
                                    <tr><td>Metodologia</td><td>Análise comparativa baseada em dados oficiais</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div style="display:flex;flex-direction:column;justify-content:center;gap:20px;">
                            <div class="highlight-box reveal" style="transition-delay:0.4s">
                                <div class="hl-label">Exercício</div>
                                <div class="hl-value">${data.exercicio}</div>
                                <div class="hl-detail">Série histórica: ${sh.length} exercícios${sh.length > 0 ? ` (${sh[0].ano}-${sh[sh.length - 1].ano})` : ''}</div>
                            </div>
                            <div class="highlight-box reveal" style="transition-delay:0.5s">
                                <div class="hl-label">Mandato</div>
                                <div class="hl-value" style="font-size:36px">${mandato}</div>
                                <div class="hl-detail">${classificacaoMandato} — ${gestorPartido}</div>
                            </div>
                        </div>
                    </div>
                </div>
                ${slideFooter(3, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 4: COMPOSIÇÃO DAS RECEITAS (com donut)
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <div class="section-bar reveal">Seção 2</div>
                    <h2 class="slide-title reveal">Composição das Receitas do FUNDEB</h2>
                    <p class="text-muted font-body reveal" style="font-size:17px;margin-bottom:24px;">Valores estimados conforme Portaria FNDE vigente e dados consolidados do exercício ${data.exercicio}.</p>

                    <div class="two-col reveal" style="transition-delay:0.3s;">
                        <div>
                            <table class="data-table">
                                <thead><tr><th>Componente</th><th>Valor (R$)</th><th>%</th></tr></thead>
                                <tbody>
                                    <tr><td>Contribuição do Município</td><td>${formatBRLFull(r.receitaContribuicaoMunicipal)}</td><td style="text-align:right">${formatPercent(pctMunicipal)}</td></tr>
                                    <tr><td>Complementação VAAF</td><td>${formatBRLFull(r.complementacaoVAAF)}</td><td style="text-align:right">${formatPercent(pctVAAF)}</td></tr>
                                    <tr><td>Complementação VAAT</td><td>${formatBRLFull(r.complementacaoVAAT)}</td><td style="text-align:right">${formatPercent(pctVAAT)}</td></tr>
                                    <tr><td>Complementação VAAR</td><td>${formatBRLFull(r.complementacaoVAAR)}</td><td style="text-align:right">${formatPercent(pctVAAR)}</td></tr>
                                    <tr class="total-row"><td>Total</td><td>${formatBRLFull(r.totalReceitas)}</td><td style="text-align:right">100,0%</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="chart-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
                            <div class="chart-title" style="text-align:center;">Composição da Receita</div>
                            ${generateDonutChart(
                              [
                                { label: 'Contribuição Municipal', value: r.receitaContribuicaoMunicipal, color: 'var(--navy)' },
                                { label: 'Complementação VAAF', value: r.complementacaoVAAF, color: 'var(--blue-accent)' },
                                { label: 'Complementação VAAT', value: r.complementacaoVAAT, color: 'var(--orange)' },
                                { label: 'Complementação VAAR', value: r.complementacaoVAAR, color: 'var(--green)' },
                              ],
                              r.totalReceitas,
                              `R$ ${(r.totalReceitas / 1_000_000).toFixed(1).replace('.', ',')}`,
                            )}
                        </div>
                    </div>

                    <div class="callout info reveal" style="transition-delay:0.5s;margin-top:16px;">
                        <span class="callout-icon">ℹ️</span>
                        <div>${vaarZero
                          ? `O município <strong>não está recebendo VAAR</strong> (vinculado a resultados). A ausência pode estar relacionada às condições de habilitação junto ao FNDE.`
                          : `O município está recebendo <strong>VAAR</strong> (vinculado a resultados) no valor de ${formatBRLFull(r.complementacaoVAAR)}.`
                        }</div>
                    </div>
                </div>
                ${slideFooter(4, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 5: ESTIMATIVA PRÓXIMO CICLO
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <div class="section-bar reveal">Seção 3</div>
                    <h2 class="slide-title reveal">Estimativa para o próximo ciclo</h2>

                    <div class="kpi-row reveal" style="transition-delay:0.25s;">
                        <div class="kpi-card navy">
                            <div class="kpi-label">VAAF</div>
                            <div class="kpi-value" style="font-size:36px;">${formatBRLShort(p.vaafProjetado)}</div>
                        </div>
                        <div class="kpi-card orange">
                            <div class="kpi-label">VAAT</div>
                            <div class="kpi-value" style="font-size:36px;">${formatBRLShort(p.vaatProjetado)}</div>
                            ${p.vaatGanho > 0 ? `<div class="kpi-badge positive">+${formatPercent(p.vaatProjetado && r.complementacaoVAAT > 0 ? ((p.vaatProjetado - r.complementacaoVAAT) / r.complementacaoVAAT) * 100 : p.ganhoPercentual)}</div>` : ''}
                        </div>
                        <div class="kpi-card blue">
                            <div class="kpi-label">VAAR</div>
                            <div class="kpi-value" style="font-size:36px;">${formatBRLShort(p.vaarProjetado)}</div>
                            ${p.vaarProjetado > 0 && r.complementacaoVAAR === 0 ? '<div class="kpi-badge positive">novo</div>' : (p.vaarGanho > 0 ? `<div class="kpi-badge positive">+${formatBRLShort(p.vaarGanho)}</div>` : '')}
                        </div>
                        <div class="kpi-card green">
                            <div class="kpi-label">Ganho Total</div>
                            <div class="kpi-value" style="font-size:36px;color:var(--green);">${formatBRLShort(p.totalGanho)}</div>
                            <div class="kpi-badge positive">+${formatPercent(p.ganhoPercentual)}</div>
                        </div>
                    </div>

                    <table class="data-table reveal" style="transition-delay:0.35s;margin-top:16px;">
                        <thead><tr><th>Componente</th><th>Cenário Atual</th><th>Cenário Projetado</th><th>Variação</th></tr></thead>
                        <tbody>
                            <tr><td>VAAF (Valor Aluno Fundo)</td><td>${formatBRLFull(r.complementacaoVAAF)}</td><td>${formatBRLFull(p.vaafProjetado)}</td><td style="text-align:right">${p.vaafGanho !== 0 ? `<span style="color:var(--green);font-weight:700">+${formatBRLFull(p.vaafGanho)}</span>` : formatBRLFull(0)}</td></tr>
                            <tr><td>VAAT (Valor Aluno Total)</td><td>${formatBRLFull(r.complementacaoVAAT)}</td><td>${formatBRLFull(p.vaatProjetado)}</td><td style="text-align:right${p.vaatGanho > 0 ? ';color:var(--green);font-weight:700' : ''}">${p.vaatGanho > 0 ? '+' : ''}${formatBRLFull(p.vaatGanho)}</td></tr>
                            <tr><td>VAAR (Vinculado a Resultados)</td><td>${formatBRLFull(r.complementacaoVAAR)}</td><td>${formatBRLFull(p.vaarProjetado)}</td><td style="text-align:right${p.vaarGanho > 0 ? ';color:var(--green);font-weight:700' : ''}">${p.vaarGanho > 0 ? '+' : ''}${formatBRLFull(p.vaarGanho)}</td></tr>
                            <tr class="total-row"><td>Total</td><td>${formatBRLFull(r.totalReceitas)}</td><td>${formatBRLFull(p.totalProjetado)}</td><td style="text-align:right">${p.totalGanho > 0 ? '+' : ''}${formatBRLFull(p.totalGanho)}</td></tr>
                        </tbody>
                    </table>

                    <div class="highlight-box reveal" style="transition-delay:0.5s;margin-top:20px;">
                        <div class="hl-label">Receita Total Projetada (Cenário Otimizado)</div>
                        <div style="display:flex;align-items:baseline;gap:24px;">
                            <div class="hl-value">${formatBRLFull(p.totalProjetado)}</div>
                            <div class="hl-detail" style="font-size:20px;">Potencial de incremento: ${formatBRLFull(p.totalGanho)} (+${formatPercent(p.ganhoPercentual)})</div>
                        </div>
                    </div>
                </div>
                ${slideFooter(5, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 6: PARTE I — RECEITA E PROJEÇÃO
                 ============================================ -->
            <section class="slide section-slide">
                <div class="slide-body">
                    <div class="section-number reveal">I</div>
                    <div class="section-label reveal" style="transition-delay:0.15s">Parte I</div>
                    <h2 class="section-title reveal" style="transition-delay:0.25s">Receita e Projeção</h2>
                    <p class="section-desc reveal" style="transition-delay:0.35s">Indicadores de eficiência arrecadatória, ajuste regional e fundamentação técnica dos valores.</p>
                </div>
                ${sectionFooter(6, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 7: INDICADORES DE EFICIÊNCIA
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <div class="section-bar reveal">Seção 5</div>
                    <h2 class="slide-title reveal">Indicadores de Eficiência Arrecadatória</h2>

                    <div class="two-col reveal" style="transition-delay:0.3s;">
                        <div>
                            <table class="data-table">
                                <thead><tr><th>Indicador Técnico</th><th>Valor</th></tr></thead>
                                <tbody>
                                    <tr><td>Índice de Eficiência Arrecadatória</td><td>${ef?.indiceEficiencia != null ? ef.indiceEficiencia.toFixed(1).replace('.', ',') : '—'}</td></tr>
                                    <tr><td>Fator de ajuste regional aplicado</td><td>${ef?.fatorAjusteRegional != null ? (ef.fatorAjusteRegional >= 0 ? '+' : '') + ef.fatorAjusteRegional.toFixed(4).replace('.', ',') : '—'}</td></tr>
                                    <tr><td>FUNDEB per capita</td><td>${safeStr(ef?.fundebPerCapita)}</td></tr>
                                    <tr><td>Valor aluno médio municipal</td><td>${safeStr(ef?.valorAlunoMedio)}</td></tr>
                                    <tr><td>Matrículas municipais por habitante</td><td>${safeStr(ef?.matriculasPerCapita)}</td></tr>
                                    <tr><td>Ed. infantil municipal por habitante</td><td>${safeStr(ef?.edInfantilPerCapita)}</td></tr>
                                    <tr><td>Creche municipal por habitante</td><td>${safeStr(ef?.crechePerCapita)}</td></tr>
                                    <tr><td>Habilitação VAAT</td><td><span class="status-badge ${vaatBadgeClass}">${vaatHabilitado}</span></td></tr>
                                    <tr><td>UF / fundo estadual</td><td>${data.uf} / ${safeStr(ef?.regiao)}</td></tr>
                                    <tr><td>Ajuste estadual aplicado</td><td>${ef?.fatorAjusteRegional != null ? (ef.fatorAjusteRegional >= 0 ? '+' : '') + ef.fatorAjusteRegional.toFixed(4).replace('.', ',') : '—'}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:20px;">
                            <div class="chart-container">
                                <div class="chart-title">Eficiência Arrecadatória</div>
                                <div style="display:flex;align-items:center;gap:20px;">
                                    <div style="position:relative;width:140px;height:140px;">
                                        <svg viewBox="0 0 140 140" style="width:140px;height:140px;">
                                            <circle cx="70" cy="70" r="${efRadius}" fill="none" stroke="var(--gray-200)" stroke-width="12"/>
                                            <circle cx="70" cy="70" r="${efRadius}" fill="none" stroke="var(--orange)" stroke-width="12"
                                                stroke-dasharray="${efDash.toFixed(1)} ${efCircumference.toFixed(2)}"
                                                transform="rotate(-90 70 70)"/>
                                            <text x="70" y="68" text-anchor="middle" font-family="var(--font-display)" font-size="32" fill="var(--navy)">${efIndex > 0 ? efIndex.toFixed(1).replace('.', ',') : '—'}</text>
                                            <text x="70" y="88" text-anchor="middle" font-family="var(--font-body)" font-size="11" fill="var(--gray-600)">índice</text>
                                        </svg>
                                    </div>
                                    <div style="font-family:var(--font-body);font-size:14px;color:var(--gray-600);line-height:1.6;">
                                        <p><strong>Fator regional:</strong> ${ef?.fatorAjusteRegional != null ? ef.fatorAjusteRegional.toFixed(2).replace('.', ',') : '—'}</p>
                                        <p><strong>UF:</strong> ${data.uf} — ${safeStr(ef?.regiao)}</p>
                                        <p style="margin-top:8px;color:var(--orange);font-weight:600;">${efIndex >= 60 ? 'Score alto — boa eficiência' : efIndex >= 30 ? 'Score moderado — margem para otimização' : 'Score baixo — atenção necessária'}</p>
                                    </div>
                                </div>
                            </div>

                            <div class="callout ${vaatCalloutClass}">
                                <span class="callout-icon">${vaatCalloutIcon}</span>
                                <div><strong>Habilitação VAAT atual:</strong> ${vaatHabilitado}. O município ${vaatIsHabilitado ? 'está apto para receber a complementação VAAT' : 'não está apto para receber a complementação VAAT'}.</div>
                            </div>
                        </div>
                    </div>
                </div>
                ${slideFooter(7, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 8: PARTE II — SITUAÇÃO OPERACIONAL
                 ============================================ -->
            <section class="slide section-slide">
                <div class="slide-body">
                    <div class="section-number reveal">II</div>
                    <div class="section-label reveal" style="transition-delay:0.15s">Parte II</div>
                    <h2 class="section-title reveal" style="transition-delay:0.25s">Situação Operacional<br>MEC/FNDE</h2>
                    <p class="section-desc reveal" style="transition-delay:0.35s">Sistemas, obras, programas federais e histórico de repasses PDDE.</p>
                </div>
                ${sectionFooter(8, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 9: SISTEMAS E PROGRAMAS FEDERAIS
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <div class="section-bar reveal">Seção 6</div>
                    <h2 class="slide-title reveal">Sistemas, Obras e Programas Federais</h2>

                    <div class="two-col ratio-60-40">
                        <div>
                            <table class="data-table reveal" style="transition-delay:0.3s;">
                                <thead><tr><th>Instituição</th><th>Sistema</th><th>Situação Cadastral</th></tr></thead>
                                <tbody>
                                    ${sistemasFederais.map(sf => `<tr><td>${sf.instituicao}</td><td>${sf.sistema}</td><td>${sf.situacao}</td></tr>`).join('\n                                    ')}
                                </tbody>
                            </table>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:20px;justify-content:flex-start;">
                            <div class="chart-container reveal" style="transition-delay:0.4s;">
                                <div class="chart-title">Histórico de Repasses PDDE</div>
                                <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px;">
                                    <span style="font-family:var(--font-display);font-size:36px;color:var(--navy);">${latestPdde ? formatBRLFull(latestPdde.valor) : '—'}</span>
                                    <span style="font-family:var(--font-body);font-size:14px;color:var(--gray-600);">${latestPdde ? `em ${latestPdde.ano}` : ''}</span>
                                </div>
                                <div class="bar-chart">
                                    ${pddeItems.map(item => {
                                      const w = maxPdde > 0 ? ((item.valor / maxPdde) * 100).toFixed(0) : '0';
                                      return `<div class="bar-item">
                                        <span class="bar-label">${item.ano}</span>
                                        <div class="bar-track">
                                            <div class="bar-fill" style="width:${w}%;background:linear-gradient(90deg,var(--navy),var(--blue-accent));">${formatBRLNoCents(item.valor)}</div>
                                        </div>
                                    </div>`;
                                    }).join('\n                                    ')}
                                </div>
                            </div>

                            <div class="callout info reveal" style="transition-delay:0.5s;">
                                <span class="callout-icon">📊</span>
                                <div>O histórico de repasses do PDDE reforça a leitura operacional do ente e evidencia movimentação recente de recursos federais na rede pública local.</div>
                            </div>
                        </div>
                    </div>
                </div>
                ${slideFooter(9, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 10: PARTE III — INDICADORES EDUCACIONAIS
                 ============================================ -->
            <section class="slide section-slide">
                <div class="slide-body">
                    <div class="section-number reveal">III</div>
                    <div class="section-label reveal" style="transition-delay:0.15s">Parte III</div>
                    <h2 class="section-title reveal" style="transition-delay:0.25s">Indicadores<br>Educacionais</h2>
                    <p class="section-desc reveal" style="transition-delay:0.35s">IDEB, série histórica do censo escolar e evolução da rede municipal.</p>
                </div>
                ${sectionFooter(10, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 11: IDEB + SÉRIE HISTÓRICA CENSO
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <div class="two-col">
                        <div>
                            <div class="section-bar reveal">Seção 11</div>
                            <h2 class="slide-title reveal" style="font-size:44px;">Série Histórica do IDEB</h2>

                            <div class="kpi-row reveal" style="transition-delay:0.3s;margin-top:24px;">
                                <div class="kpi-card blue">
                                    <div class="kpi-label">Anos Iniciais${latestIniciais ? ` (${latestIniciais.ano})` : ''}</div>
                                    <div style="display:flex;align-items:baseline;gap:16px;">
                                        <div>
                                            <div style="font-family:var(--font-body);font-size:12px;color:var(--gray-400);margin-bottom:4px;">Meta</div>
                                            <div class="kpi-value" style="font-size:48px;">${latestIniciais?.metaProjetada != null ? latestIniciais.metaProjetada.toFixed(1).replace('.', ',') : '—'}</div>
                                        </div>
                                        <div style="font-size:24px;color:var(--gray-400);">→</div>
                                        <div>
                                            <div style="font-family:var(--font-body);font-size:12px;color:var(--gray-400);margin-bottom:4px;">Verificado</div>
                                            <div class="kpi-value" style="font-size:48px;color:${latestIniciais?.idebVerificado != null && latestIniciais?.metaProjetada != null && latestIniciais.idebVerificado < latestIniciais.metaProjetada ? 'var(--orange)' : 'var(--green)'};">${latestIniciais?.idebVerificado != null ? latestIniciais.idebVerificado.toFixed(1).replace('.', ',') : '—'}</div>
                                        </div>
                                    </div>
                                    ${latestIniciais?.idebVerificado != null && latestIniciais?.metaProjetada != null
                                      ? `<div class="kpi-badge ${latestIniciais.idebVerificado >= latestIniciais.metaProjetada ? 'positive' : 'negative'}" style="margin-top:8px;">${(latestIniciais.idebVerificado - latestIniciais.metaProjetada) >= 0 ? '+' : '−'}${Math.abs(latestIniciais.idebVerificado - latestIniciais.metaProjetada).toFixed(1).replace('.', ',')} ${latestIniciais.idebVerificado >= latestIniciais.metaProjetada ? 'acima da meta' : 'abaixo da meta'}</div>`
                                      : ''}
                                </div>
                                <div class="kpi-card orange">
                                    <div class="kpi-label">Anos Finais${latestFinais ? ` (${latestFinais.ano})` : ''}</div>
                                    <div style="display:flex;align-items:baseline;gap:16px;">
                                        <div>
                                            <div style="font-family:var(--font-body);font-size:12px;color:var(--gray-400);margin-bottom:4px;">Meta</div>
                                            <div class="kpi-value" style="font-size:48px;">${latestFinais?.metaProjetada != null ? latestFinais.metaProjetada.toFixed(1).replace('.', ',') : '—'}</div>
                                        </div>
                                        <div style="font-size:24px;color:var(--gray-400);">→</div>
                                        <div>
                                            <div style="font-family:var(--font-body);font-size:12px;color:var(--gray-400);margin-bottom:4px;">Verificado</div>
                                            <div class="kpi-value" style="font-size:48px;color:${latestFinais?.idebVerificado != null && latestFinais?.metaProjetada != null && latestFinais.idebVerificado < latestFinais.metaProjetada ? 'var(--red)' : 'var(--green)'};">${latestFinais?.idebVerificado != null ? latestFinais.idebVerificado.toFixed(1).replace('.', ',') : '—'}</div>
                                        </div>
                                    </div>
                                    ${latestFinais?.idebVerificado != null && latestFinais?.metaProjetada != null
                                      ? `<div class="kpi-badge ${latestFinais.idebVerificado >= latestFinais.metaProjetada ? 'positive' : 'negative'}" style="margin-top:8px;">${(latestFinais.idebVerificado - latestFinais.metaProjetada) >= 0 ? '+' : '−'}${Math.abs(latestFinais.idebVerificado - latestFinais.metaProjetada).toFixed(1).replace('.', ',')} ${latestFinais.idebVerificado >= latestFinais.metaProjetada ? 'acima da meta' : 'abaixo da meta'}</div>`
                                      : ''}
                                </div>
                            </div>

                            ${(() => {
                              // IDEB historical table — show all available years
                              const idebI = data.idebAnosIniciais ?? [];
                              const idebF = data.idebAnosFinais ?? [];
                              const idebE = data.idebEnsinoMedio ?? [];
                              const allYears = [...new Set([...idebI.map(x => x.ano), ...idebF.map(x => x.ano), ...idebE.map(x => x.ano)])].sort((a, b) => a - b);
                              if (allYears.length > 0) {
                                const hasEM = idebE.length > 0;
                                const rows = allYears.map(ano => {
                                  const ini = idebI.find(x => x.ano === ano);
                                  const fin = idebF.find(x => x.ano === ano);
                                  const em = idebE.find(x => x.ano === ano);
                                  return `<tr>
                                    <td style="font-weight:600;">${ano}</td>
                                    <td>${ini?.metaProjetada != null ? ini.metaProjetada.toFixed(1).replace('.', ',') : '—'}</td>
                                    <td style="color:${ini?.idebVerificado != null && ini?.metaProjetada != null && ini.idebVerificado < ini.metaProjetada ? 'var(--orange)' : 'var(--green)'};font-weight:600;">${ini?.idebVerificado != null ? ini.idebVerificado.toFixed(1).replace('.', ',') : '—'}</td>
                                    <td>${fin?.metaProjetada != null ? fin.metaProjetada.toFixed(1).replace('.', ',') : '—'}</td>
                                    <td style="color:${fin?.idebVerificado != null && fin?.metaProjetada != null && fin.idebVerificado < fin.metaProjetada ? 'var(--red)' : 'var(--green)'};font-weight:600;">${fin?.idebVerificado != null ? fin.idebVerificado.toFixed(1).replace('.', ',') : '—'}</td>
                                    ${hasEM ? `<td style="opacity:0.7;">${em?.metaProjetada != null ? em.metaProjetada.toFixed(1).replace('.', ',') : '—'}</td>
                                    <td style="opacity:0.7;color:${em?.idebVerificado != null && em?.metaProjetada != null && em.idebVerificado < em.metaProjetada ? 'var(--red)' : 'var(--green)'};font-weight:600;">${em?.idebVerificado != null ? em.idebVerificado.toFixed(1).replace('.', ',') : '—'}</td>` : ''}
                                  </tr>`;
                                }).join('');
                                return `<table class="data-table reveal" style="transition-delay:0.4s;margin-top:16px;font-size:15px;">
                                  <thead><tr><th>Ano</th><th colspan="2">Anos Iniciais</th><th colspan="2">Anos Finais</th>${hasEM ? '<th colspan="2" style="opacity:0.7;">Ensino Médio ℹ️</th>' : ''}</tr>
                                  <tr style="font-size:12px;color:var(--gray-400);"><th></th><th>Meta</th><th>Verificado</th><th>Meta</th><th>Verificado</th>${hasEM ? '<th>Meta</th><th>Verificado</th>' : ''}</tr></thead>
                                  <tbody>${rows}</tbody>
                                </table>${hasEM ? '<div style="font-size:11px;color:var(--gray-400);margin-top:6px;font-style:italic;">ℹ️ Ensino Médio: dados da rede estadual/federal (informativo, não compõe cálculo FUNDEB municipal)</div>' : ''}`;
                              }
                              return '';
                            })()}

                            ${(() => {
                              const bothBelow = latestIniciais?.idebVerificado != null && latestIniciais?.metaProjetada != null && latestIniciais.idebVerificado < latestIniciais.metaProjetada
                                && latestFinais?.idebVerificado != null && latestFinais?.metaProjetada != null && latestFinais.idebVerificado < latestFinais.metaProjetada;
                              if (bothBelow) {
                                return `<div class="callout warning reveal" style="transition-delay:0.5s;margin-top:16px;">
                                <span class="callout-icon">⚠️</span>
                                <div>O IDEB verificado ficou <strong>abaixo da meta projetada</strong> em ambas as etapas. Ponto de atenção para condicionalidades VAAR.</div>
                            </div>`;
                              }
                              return '';
                            })()}
                        </div>

                        <div>
                            <div class="section-bar reveal" style="transition-delay:0.1s">Seção 12</div>
                            <h2 class="slide-title reveal" style="font-size:44px;transition-delay:0.15s;">Linha do Tempo<br>${sh.length > 0 ? `${sh[0].ano} a ${sh[sh.length - 1].ano}` : data.exercicio}</h2>

                            <div class="chart-container reveal" style="transition-delay:0.35s;margin-top:24px;">
                                <div class="chart-title">Evolução da Receita FUNDEB</div>
                                <div class="bar-chart">
                                    ${shReceitas.map((item, idx) => {
                                      const w = maxShReceita > 0 ? ((item.totalReceitasFundeb! / maxShReceita) * 100).toFixed(1) : '0';
                                      const isLast = idx === shReceitas.length - 1;
                                      return `<div class="bar-item">
                                        <span class="bar-label"${isLast ? ' style="color:var(--orange);font-weight:700;"' : ''}>${item.ano}</span>
                                        <div class="bar-track"><div class="bar-fill" style="width:${w}%;${isLast ? 'background:linear-gradient(90deg,var(--orange),var(--orange-light));' : ''}">${formatBRLShort(item.totalReceitasFundeb!)}</div></div>
                                    </div>`;
                                    }).join('\n                                    ')}
                                </div>
                                ${receitaDeltaPct != null ? `<div style="font-family:var(--font-body);font-size:13px;color:var(--green);font-weight:600;margin-top:12px;text-align:right;">
                                    Variação total: ${receitaDeltaPct >= 0 ? '+' : ''}${formatPercent(receitaDeltaPct)}
                                </div>` : ''}
                                ${shReceitas.length <= 1 ? `<div class="callout info" style="margin-top:12px;font-size:13px;">
                                    <span class="callout-icon">📌</span>
                                    <div>Receitas de exercícios anteriores não estão disponíveis nas bases FNDE/SICONFI consultadas. A série será expandida conforme novas fontes forem integradas.</div>
                                </div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                ${slideFooter(11, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 12: PARTE IV — COMPARATIVO POR ANO
                 ============================================ -->
            <section class="slide section-slide">
                <div class="slide-body">
                    <div class="section-number reveal">IV</div>
                    <div class="section-label reveal" style="transition-delay:0.15s">Parte IV</div>
                    <h2 class="section-title reveal" style="transition-delay:0.25s">Comparativo por Ano</h2>
                    <p class="section-desc reveal" style="transition-delay:0.35s">Evolução financeira e base escolar ${sh.length > 0 ? `${sh[0].ano} a ${sh[sh.length - 1].ano}` : data.exercicio}.</p>
                </div>
                ${sectionFooter(12, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 13: COMPARATIVO VISUAL
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <h2 class="slide-title reveal" style="font-size:44px;">Comparativo Anual ${sh.length > 0 ? `${sh[0].ano} a ${sh[sh.length - 1].ano}` : data.exercicio}</h2>

                    <div class="kpi-row reveal" style="transition-delay:0.2s;">
                        <div class="kpi-card green">
                            <div class="kpi-label">Receita ${firstSh?.ano ?? '—'} → ${lastSh?.ano ?? '—'}</div>
                            <div class="kpi-value" style="font-size:36px;color:var(--green);">${receitaDelta != null ? `${receitaDelta >= 0 ? '+' : ''}${formatBRLShort(receitaDelta)}` : '—'}</div>
                            <div class="kpi-detail">de ${firstSh?.totalReceitasFundeb != null ? formatBRLShort(firstSh.totalReceitasFundeb) : '—'} para ${lastSh?.totalReceitasFundeb != null ? formatBRLShort(lastSh.totalReceitasFundeb) : '—'}</div>
                            ${receitaDeltaPct != null ? `<div class="kpi-badge ${receitaDeltaPct >= 0 ? 'positive' : 'negative'}">${receitaDeltaPct >= 0 ? '+' : ''}${formatPercent(receitaDeltaPct)}</div>` : ''}
                        </div>
                        <div class="kpi-card blue">
                            <div class="kpi-label">Matrículas (Municipal) ${firstShWithMatriculas?.ano ?? '—'} → ${lastShWithMatriculas?.ano ?? '—'}</div>
                            <div class="kpi-value" style="font-size:36px;">${matriculasDelta != null ? `${matriculasDelta >= 0 ? '+' : ''}${formatInteger(matriculasDelta)}` : '—'}</div>
                            <div class="kpi-detail">de ${firstShWithMatriculas?.totalMatriculas != null ? formatInteger(firstShWithMatriculas.totalMatriculas) : '—'} para ${lastShWithMatriculas?.totalMatriculas != null ? formatInteger(lastShWithMatriculas.totalMatriculas) : '—'}</div>
                            ${data.censo?.dadosPublicosTotal?.fundamentalMedio ? `<div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:8px;">Referência Pública (QEdu): ${formatInteger(data.censo.dadosPublicosTotal.fundamentalMedio)} matrículas</div>` : ''}
                            ${matriculasDeltaPct != null ? `<div class="kpi-badge ${matriculasDeltaPct >= 0 ? 'positive' : 'negative'}">${matriculasDeltaPct >= 0 ? '+' : ''}${formatPercent(matriculasDeltaPct)}</div>` : ''}
                        </div>
                        <div class="kpi-card orange">
                            <div class="kpi-label">Tempo Integral ${firstShWithTI?.ano ?? '—'} → ${lastShWithTI?.ano ?? '—'}</div>
                            <div class="kpi-value" style="font-size:36px;color:var(--orange);">${tiDelta != null ? `${tiDelta >= 0 ? '+' : ''}${formatInteger(tiDelta)}` : '—'}</div>
                            <div class="kpi-detail">de ${firstShWithTI?.tempoIntegral != null ? formatInteger(firstShWithTI.tempoIntegral) : '—'} para ${lastShWithTI?.tempoIntegral != null ? formatInteger(lastShWithTI.tempoIntegral) : '—'}</div>
                            ${tiDeltaPct != null ? `<div class="kpi-badge ${tiDeltaPct >= 0 ? 'positive' : 'negative'}">${tiDeltaPct >= 0 ? '+' : ''}${formatPercent(tiDeltaPct, 0)}</div>` : ''}
                        </div>
                    </div>

                    <table class="data-table reveal" style="transition-delay:0.35s;margin-top:16px;font-size:15px;">
                        <thead><tr><th>Ano</th><th>Receita FUNDEB</th><th>Matr.</th><th>Valor/Aluno</th><th>T. integral</th><th>Ed. especial</th><th>EJA</th><th>Escolas</th><th>Variação</th></tr></thead>
                        <tbody>
                            ${sh.map((item, idx) => {
                              const isLast = idx === sh.length - 1;
                              const hasMatriculas = item.totalMatriculas != null && item.totalMatriculas > 0;
                              const hasReceita = item.totalReceitasFundeb != null && item.totalReceitasFundeb > 0;
                              const valorAluno = hasReceita && hasMatriculas
                                ? `R$ ${Math.round(item.totalReceitasFundeb! / item.totalMatriculas!).toLocaleString('pt-BR')}`
                                : '—';
                              const variacaoStr = idx === 0
                                ? '<span class="status-badge historico">base</span>'
                                : item.variacao != null
                                  ? `${item.variacao >= 0 ? '+' : ''}${formatPercent(item.variacao)}`
                                  : '—';
                              const varStyle = idx === 0
                                ? ''
                                : item.variacao != null && item.variacao >= 0
                                  ? 'color:var(--green);font-weight:600'
                                  : item.variacao != null
                                    ? 'color:var(--red);font-weight:600'
                                    : '';
                              return `<tr><td${isLast ? ' style="font-weight:700;color:var(--orange)"' : ''}>${item.ano}</td><td${isLast ? ' style="font-weight:700"' : ''}>${hasReceita ? formatBRLNoCents(item.totalReceitasFundeb!) : '—'}</td><td>${hasMatriculas ? formatInteger(item.totalMatriculas!) : '—'}</td><td style="font-weight:600;">${valorAluno}</td><td>${item.tempoIntegral != null ? formatInteger(item.tempoIntegral) : '—'}</td><td>${item.educacaoEspecial != null ? formatInteger(item.educacaoEspecial) : '—'}</td><td>${item.eja != null ? formatInteger(item.eja) : '—'}</td><td>${item.totalEscolas != null ? formatInteger(item.totalEscolas) : '—'}</td><td style="text-align:right${varStyle ? `;${varStyle}` : ''}">${variacaoStr}</td></tr>`;
                            }).join('\n                            ')}
                        </tbody>
                    </table>

                    <div class="callout info reveal" style="transition-delay:0.5s;margin-top:12px;">
                        <span class="callout-icon">📌</span>
                        <div>O ano de ${data.exercicio} não possui dados de matrículas porque o <strong>Censo Escolar ${data.exercicio}</strong> ainda está em fase de coleta pelo INEP e só será publicado em ${data.exercicio + 1}.</div>
                    </div>
                </div>
                ${slideFooter(13, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 14: EVOLUÇÃO EM GRÁFICO DE BARRAS
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <h2 class="slide-title reveal" style="font-size:44px;">Evolução Visual da Rede</h2>

                    <div class="two-col reveal" style="transition-delay:0.25s;">
                        <div class="chart-container">
                            <div class="chart-title">Matrículas Públicas</div>
                            <div class="bar-chart">
                                ${(() => {
                                  const items = sh.filter(s => s.totalMatriculas != null);
                                  const max = items.length > 0 ? Math.max(...items.map(s => s.totalMatriculas!)) : 1;
                                  return items.map((item, idx) => {
                                    const w = max > 0 ? ((item.totalMatriculas! / max) * 100).toFixed(1) : '0';
                                    const isLast = idx === items.length - 1;
                                    return `<div class="bar-item"><span class="bar-label">${item.ano}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%;${isLast ? 'background:linear-gradient(90deg,var(--green),var(--green-light));' : ''}">${formatInteger(item.totalMatriculas!)}</div></div></div>`;
                                  }).join('\n                                ');
                                })()}
                            </div>
                        </div>

                        <div class="chart-container">
                            <div class="chart-title">Tempo Integral</div>
                            <div class="bar-chart">
                                ${(() => {
                                  const items = sh.filter(s => s.tempoIntegral != null);
                                  const max = items.length > 0 ? Math.max(...items.map(s => s.tempoIntegral!)) : 1;
                                  return items.map((item, idx) => {
                                    const w = max > 0 ? ((item.tempoIntegral! / max) * 100).toFixed(1) : '0';
                                    const isLast = idx === items.length - 1;
                                    return `<div class="bar-item"><span class="bar-label">${item.ano}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:linear-gradient(90deg,var(--orange),var(--orange-light));">${formatInteger(item.tempoIntegral!)}${isLast ? ' 🔥' : ''}</div></div></div>`;
                                  }).join('\n                                ');
                                })()}
                            </div>
                            ${tiDeltaPct != null ? `<div style="font-family:var(--font-body);font-size:13px;color:${tiDeltaPct >= 0 ? 'var(--green)' : 'var(--orange)'};font-weight:600;margin-top:12px;text-align:right;">
                                ${tiDeltaPct >= 0 ? '+' : ''}${formatPercent(tiDeltaPct, 0)} em ${shWithTI.length > 1 ? shWithTI.length - 1 : '—'} anos${tiDeltaPct >= 0 ? '!' : ''}
                            </div>` : ''}
                        </div>
                    </div>

                    <div class="two-col reveal" style="transition-delay:0.45s;margin-top:20px;">
                        <div class="chart-container">
                            <div class="chart-title">Educação Especial</div>
                            <div class="bar-chart">
                                ${(() => {
                                  const items = sh.filter(s => s.educacaoEspecial != null);
                                  const max = items.length > 0 ? Math.max(...items.map(s => s.educacaoEspecial!)) : 1;
                                  return items.map(item => {
                                    const w = max > 0 ? ((item.educacaoEspecial! / max) * 100).toFixed(1) : '0';
                                    return `<div class="bar-item"><span class="bar-label">${item.ano}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:linear-gradient(90deg,#7C3AED,#A78BFA);">${formatInteger(item.educacaoEspecial!)}</div></div></div>`;
                                  }).join('\n                                ');
                                })()}
                            </div>
                        </div>

                        <div class="chart-container">
                            <div class="chart-title">EJA</div>
                            <div class="bar-chart">
                                ${(() => {
                                  const items = sh.filter(s => s.eja != null);
                                  const max = items.length > 0 ? Math.max(...items.map(s => s.eja!)) : 1;
                                  const lastItem = items.length > 0 ? items[items.length - 1] : null;
                                  const firstItem = items.length > 0 ? items[0] : null;
                                  const ejaDecline = lastItem && firstItem && lastItem.eja! < firstItem.eja!;
                                  const result = items.map(item => {
                                    const w = max > 0 ? ((item.eja! / max) * 100).toFixed(1) : '0';
                                    return `<div class="bar-item"><span class="bar-label">${item.ano}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:linear-gradient(90deg,#059669,#34D399);">${formatInteger(item.eja!)}</div></div></div>`;
                                  }).join('\n                                ');

                                  // Find peak year for EJA
                                  const peakItem = items.length > 0 ? items.reduce((a, b) => (a.eja! > b.eja! ? a : b)) : null;
                                  const trendMsg = ejaDecline && peakItem
                                    ? `<div style="font-family:var(--font-body);font-size:13px;color:var(--red);font-weight:600;margin-top:12px;text-align:right;">
                                ⚠ Retração desde ${peakItem.ano}
                            </div>`
                                    : '';
                                  return result + trendMsg;
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
                ${slideFooter(14, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 15: PARTE V — CADERNO TÉCNICO
                 ============================================ -->
            <section class="slide section-slide">
                <div class="slide-body">
                    <div class="section-number reveal">V</div>
                    <div class="section-label reveal" style="transition-delay:0.15s">Parte V</div>
                    <h2 class="section-title reveal" style="transition-delay:0.25s">Caderno Técnico</h2>
                    <p class="section-desc reveal" style="transition-delay:0.35s">Perfil da gestão municipal, nota técnica de validação, recomendações e alertas.</p>
                </div>
                ${sectionFooter(15, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 16: GESTÃO + RECOMENDAÇÕES
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <div class="two-col">
                        <div>
                            <div class="section-bar reveal">Seção 15</div>
                            <h2 class="slide-title reveal" style="font-size:40px;">Perfil da Gestão<br>Municipal</h2>

                            <table class="data-table reveal" style="transition-delay:0.3s;margin-top:20px;">
                                <thead><tr><th>Campo</th><th>Leitura</th></tr></thead>
                                <tbody>
                                    <tr><td>Prefeito atual</td><td>${gestorNome}</td></tr>
                                    <tr><td>Partido atual</td><td>${gestorPartido}</td></tr>
                                    <tr><td>Classificação de mandato</td><td>${classificacaoMandato} (${mandato})</td></tr>
                                </tbody>
                            </table>

                            <div class="section-bar reveal mt-24" style="transition-delay:0.4s">Seção 16</div>
                            <h3 class="reveal" style="font-family:var(--font-display);font-size:32px;color:var(--navy);transition-delay:0.45s;margin-bottom:12px;">Recomendações Técnicas</h3>

                            <ul class="bullet-list reveal" style="transition-delay:0.5s;">
                                ${recomendacoes.map(rec => `<li>${rec}</li>`).join('\n                                ')}
                            </ul>
                        </div>

                        <div>
                            <div class="section-bar reveal" style="transition-delay:0.1s">Seção 17</div>
                            <h3 class="reveal" style="font-family:var(--font-display);font-size:32px;color:var(--navy);transition-delay:0.15s;margin-bottom:12px;">Próximos Passos</h3>

                            <div style="display:flex;flex-direction:column;gap:12px;" class="reveal" style="transition-delay:0.25s;">
                                ${proximosPassos.map((passo, idx) => `<div style="background:var(--gray-100);padding:16px 20px;border-radius:12px;display:flex;align-items:center;gap:14px;border-left:4px solid ${stepColors[idx % stepColors.length]};">
                                    <span style="font-size:20px;">${stepEmojis[idx] ?? `${idx + 1}️⃣`}</span>
                                    <span style="font-family:var(--font-body);font-size:17px;color:var(--text-dark);">${passo}</span>
                                </div>`).join('\n                                ')}
                            </div>

                            <div class="section-bar reveal mt-24" style="transition-delay:0.35s">Seção 18</div>
                            <h3 class="reveal" style="font-family:var(--font-display);font-size:32px;color:var(--navy);transition-delay:0.4s;margin-bottom:12px;">Alertas Técnicos</h3>

                            ${alertas.map((alerta, idx) => `<div class="callout ${alerta.tipo} reveal" style="transition-delay:${(0.45 + idx * 0.05).toFixed(2)}s;">
                                <span class="callout-icon">${alerta.icone}</span>
                                <div>${alerta.texto}</div>
                            </div>`).join('\n                            ')}
                        </div>
                    </div>
                </div>
                ${slideFooter(16, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 17: ANEXO — RASTREABILIDADE
                 ============================================ -->
            <section class="slide">
                ${slideHeaderText(data)}
                <div class="slide-body">
                    <div class="section-bar reveal">Anexo A.1</div>
                    <h2 class="slide-title reveal">Rastreabilidade e Fontes</h2>
                    <p class="text-muted font-body reveal" style="font-size:17px;margin-bottom:24px;">Mapa de fontes — transparência e confiança operacional do relatório.</p>

                    <table class="data-table reveal" style="transition-delay:0.3s;">
                        <thead><tr><th>Fonte</th><th>Status</th><th>Leitura Operacional</th></tr></thead>
                        <tbody>
                            ${rastreabilidade.map(r => `<tr>
                                <td><strong>${r.fonte}</strong></td>
                                <td><span class="status-badge ${r.status}">${r.statusLabel ?? (r.status === 'auto' ? 'Automático' : r.status === 'estimated' ? 'Estimado' : 'Manual')}</span></td>
                                <td>${r.leitura}</td>
                            </tr>`).join('\n                            ')}
                        </tbody>
                    </table>

                    <div class="callout info reveal" style="transition-delay:0.5s;margin-top:24px;">
                        <span class="callout-icon">🔍</span>
                        <div>
                            <strong>Como ler a rastreabilidade:</strong> As fontes acima mostram o que entrou automaticamente, o que depende de
                            estimativa e o que ainda exige confirmação manual. Esta camada ajuda a explicar a confiança operacional do relatório
                            antes da emissão final. A versão atual registra <strong>${obsRastreabilidade} observação${obsRastreabilidade !== 1 ? 'ões' : ''} operacional${obsRastreabilidade !== 1 ? 'is' : ''}</strong> relevante${obsRastreabilidade !== 1 ? 's' : ''} para leitura técnica.
                        </div>
                    </div>
                </div>
                ${slideFooter(17, totalPages)}
            </section>

            <!-- ============================================
                 SLIDE 18: ENCERRAMENTO
                 ============================================ -->
            <section class="slide cover-slide">
                <div class="slide-body">
                    <div class="cover-grid" style="grid-template-columns:1fr 1fr;">
                        <div class="cover-left" style="justify-content:center;">
                            <div class="cover-logo reveal">
                                <div class="cover-logo-icon">${SVG_LOGO}</div>
                                <div>
                                    <div class="cover-logo-text">Rocha Prime</div>
                                    <div style="font-family:var(--font-body);font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.5px;">Serviços Especializados Ltda</div>
                                </div>
                            </div>

                            <h2 class="cover-title reveal" style="font-size:52px;transition-delay:0.15s;">
                                Obrigado pela confiança.
                            </h2>
                            <p class="cover-subtitle reveal" style="transition-delay:0.25s;">
                                Este documento é confidencial e destinado exclusivamente ao destinatário.
                                Reprodução proibida.
                            </p>

                            <div class="cover-separator reveal" style="transition-delay:0.35s"></div>

                            <div class="reveal" style="transition-delay:0.4s;font-family:var(--font-body);color:rgba(255,255,255,0.5);font-size:14px;line-height:1.8;">
                                <div>CNPJ: 29.342.691/0001-93</div>
                                <div>Tel: (61) 99866-7834</div>
                                <div>Técnico responsável: Adriel Tavares</div>
                                <div style="margin-top:8px;">Emitido em ${formatDateTime(now)}</div>
                            </div>
                        </div>

                        <div class="cover-right" style="justify-content:center;">
                            <div class="cover-kpi reveal" style="transition-delay:0.3s">
                                <div class="cover-kpi-label">Resumo Executivo</div>
                                <div class="cover-kpi-value" style="font-size:40px">${data.municipio}</div>
                                <div class="cover-kpi-detail">${data.uf}${data.microrregiao ? ` — ${data.microrregiao}` : ''}</div>
                            </div>

                            <div class="cover-separator reveal" style="transition-delay:0.4s"></div>

                            <div class="cover-kpi reveal" style="transition-delay:0.45s">
                                <div class="cover-kpi-label">Receita ${data.exercicio}</div>
                                <div class="cover-kpi-value">${formatBRLShort(r.totalReceitas)}</div>
                            </div>

                            <div class="cover-kpi reveal" style="transition-delay:0.5s">
                                <div class="cover-kpi-label">Projeção ${data.exercicio + 1}</div>
                                <div class="cover-kpi-value" style="color:var(--orange-light);">${formatBRLShort(p.totalProjetado)}</div>
                                <div class="kpi-badge positive" style="background:rgba(39,174,96,0.2);color:#2ecc71;margin-top:8px;">+${formatPercent(p.ganhoPercentual)} potencial de crescimento</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="cover-footer">
                    <span>DOCUMENTO CONFIDENCIAL — Rocha Prime Serviços Especializados Ltda</span>
                    <span>Fontes: FNDE, INEP, IBGE e bases oficiais consolidadas no PrimeOS</span>
                    <span>18 / ${totalPages}</span>
                </div>
            </section>

        </main>
    </div>

    <!-- Progress bar -->
    <div class="nav-bar"><div class="nav-bar-fill" id="navBarFill"></div></div>
    <div class="page-indicator" id="pageIndicator"></div>

    <script>${NAVIGATION_JS}
    </script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// MAPPER: API payload → ComercialPdfData
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPayloadToComercialData(payload: any): ComercialPdfData {
  const rel = payload?.relatorio_fundeb ?? {};
  const ident = rel?.identificacao ?? {};
  const receitas = rel?.receitas ?? {};
  const proj = rel?.projecaoComercial ?? rel?.projecaoRecuperavel ?? rel?.projecao ?? {};
  const censo = rel?.censoEscolar ?? {};
  const dirigido = payload?.relatorio_dirigido_base ?? {};
  const demo = payload?.demografia ?? {};
  const perfil = dirigido?.perfilIBGE ?? {};
  const fiscal = dirigido?.saudeFiscal ?? {};
  const infra = dirigido?.infraestruturaEscolar ?? {};
  const prontidao = dirigido?.prontidao ?? {};
  const historico = dirigido?.historico ?? {};
  const narrativas = dirigido?.narrativas ?? {};
  const cenario = dirigido?.cenarioEstruturacao;
  const ctx = dirigido?.contextoPolitico ?? {};

  // Build série histórica from the dirigido report
  // Preserve null for missing data so the template can filter out years with no real data
  const serieHistorica = (historico.anos ?? []).map((a: any) => ({
    ano: a.ano,
    totalReceitasFundeb: a.totalReceitasFundeb ?? null,
    contribuicaoMunicipal: a.contribuicaoMunicipal ?? null,
    complementacaoVAAF: a.complementacaoVAAF ?? null,
    complementacaoVAAT: a.complementacaoVAAT ?? null,
    complementacaoVAAR: a.complementacaoVAAR ?? null,
    totalMatriculas: a.totalMatriculasMunicipais ?? null,
    totalEscolas: a.totalEscolas ?? null,
    tempoIntegral: a.tempoIntegral ?? null,
    educacaoEspecial: a.educacaoEspecial ?? null,
    eja: a.eja ?? null,
  }));

  // IDEB
  const idebIniciais = (rel?.idebAnosIniciais ?? []).map((i: any) => ({
    ano: i.ano,
    idebVerificado: i.idebVerificado,
    metaProjetada: i.metaProjetada,
  }));
  const idebFinais = (rel?.idebAnosFinais ?? []).map((i: any) => ({
    ano: i.ano,
    idebVerificado: i.idebVerificado,
    metaProjetada: i.metaProjetada,
  }));
  const idebEnsinoMedio = (rel?.idebEnsinoMedio ?? []).map((i: any) => ({
    ano: i.ano,
    idebVerificado: i.idebVerificado,
    metaProjetada: i.metaProjetada,
  }));

  // Build rastreabilidade from fontes_utilizadas
  const fontes = payload?.fontes_utilizadas ?? payload?.metadata?.fontes ?? [];
  const rastreabilidade = fontes.slice(0, 10).map((f: string) => ({
    fonte: f,
    status: 'auto' as const,
    statusLabel: 'Automático',
    leitura: `Dados carregados de ${f}`,
  }));

  // Build cenário ações
  const cenarioAcoes = cenario?.acoes ?? cenario?.oportunidades ?? [];

  // Infraestrutura from INEP
  const infraIndicadores = infra?.indicadores ?? [];
  const findInfra = (nome: string) => {
    const item = infraIndicadores.find((i: any) =>
      i.nome?.toLowerCase().includes(nome.toLowerCase()),
    );
    return item?.percentual ?? 0;
  };

  return {
    municipio: ident.municipioNome || payload?.dados_basicos?.nome || '',
    uf: ident.uf || payload?.dados_basicos?.uf || '',
    exercicio: ident.exercicio || new Date().getFullYear(),
    codigoIbge: ident.codigoIBGE || payload?.dados_basicos?.codigo_ibge || '',
    mesorregiao: ident.mesorregiao,
    microrregiao: ident.microrregiao,

    gestor: {
      nome: ctx.prefeitoAtual || ident.prefeito || undefined,
      partido: ctx.partidoAtual || ident.partido || undefined,
      mandato: '2025–2028',
      classificacaoMandato: ctx.classificacaoMandato || undefined,
    },

    receitas: {
      totalReceitas: receitas.totalReceitas ?? 0,
      receitaContribuicaoMunicipal: receitas.receitaContribuicaoMunicipal ?? 0,
      complementacaoVAAF: receitas.complementacaoVAAF ?? 0,
      complementacaoVAAT: receitas.complementacaoVAAT ?? 0,
      complementacaoVAAR: receitas.complementacaoVAAR ?? 0,
    },

    projecao: {
      totalProjetado: proj.totalProjetado ?? 0,
      totalGanho: proj.totalGanho ?? 0,
      ganhoPercentual: proj.ganhoPercentual ?? 0,
      vaafProjetado: proj.vaafProjetado ?? 0,
      vaatProjetado: proj.vaatProjetado ?? 0,
      vaarProjetado: proj.vaarProjetado ?? 0,
      vaafGanho: proj.vaafGanho ?? 0,
      vaatGanho: proj.vaatGanho ?? 0,
      vaarGanho: proj.vaarGanho ?? 0,
    },

    habilitacaoVaat: rel?.perfilComercial?.habilitacaoVaat || undefined,

    eficiencia: {
      indiceEficiencia: rel?.perfilComercial?.score ?? undefined,
      fatorAjusteRegional: rel?.perfilComercial?.camadaEstadual?.ajusteMultiplicadorAplicado ?? undefined,
      fundebPerCapita: rel?.perfilComercial?.fundebPerCapita
        ? `R$ ${Math.round(rel.perfilComercial.fundebPerCapita).toLocaleString('pt-BR')}`
        : undefined,
      matriculasPerCapita: rel?.perfilComercial?.matriculasMunicipaisPorHabitante != null
        ? rel.perfilComercial.matriculasMunicipaisPorHabitante.toFixed(1) + '%'
        : undefined,
      edInfantilPerCapita: rel?.perfilComercial?.educacaoInfantilMunicipalPorHabitante != null
        ? rel.perfilComercial.educacaoInfantilMunicipalPorHabitante.toFixed(1) + '%'
        : undefined,
      crechePerCapita: rel?.perfilComercial?.crecheMunicipalPorHabitante != null
        ? rel.perfilComercial.crecheMunicipalPorHabitante.toFixed(1) + '%'
        : undefined,
      valorAlunoMedio: (() => {
        const totalReceita = receitas.totalReceitas ?? 0;
        const totalMatriculas = rel?.perfilComercial?.matriculasMunicipais ?? censo.totalMatriculas ?? 0;
        return totalReceita > 0 && totalMatriculas > 0
          ? `R$ ${Math.round(totalReceita / totalMatriculas).toLocaleString('pt-BR')}`
          : undefined;
      })(),
      regiao: ident.regiao || ident.mesorregiao || undefined,
    },

    censo: {
      totalEscolas: censo.totalEscolas ?? 0,
      totalMatriculas: censo.totalMatriculas ?? 0,
      totalDocentes: censo.totalDocentes ?? 0,
      tempoIntegral: censo.tempoIntegral?.total ?? 0,
      educacaoInfantil: (censo.matriculasEtapa?.educacaoInfantil) ?? 0,
      ensinoFundamental: (censo.matriculasEtapa?.ensinoFundamental) ?? 0,
      eja: censo.matriculasEtapa?.eja ?? 0,
      educacaoEspecial: censo.matriculasEtapa?.educacaoEspecial ?? 0,
      dadosPublicosTotal: censo.dadosPublicosTotal ?? undefined,
    },

    ibge: {
      populacao: perfil.populacaoEstimada ?? demo.populacao ?? 0,
      idhm: perfil.idhm ?? demo.idh ?? 0,
      area: perfil.areaTerritorial ?? 0,
      pibPerCapita: perfil.pibPerCapita ?? 0,
    },

    idebAnosIniciais: idebIniciais.length > 0 ? idebIniciais : undefined,
    idebAnosFinais: idebFinais.length > 0 ? idebFinais : undefined,
    idebEnsinoMedio: idebEnsinoMedio.length > 0 ? idebEnsinoMedio : undefined,

    serieHistorica: serieHistorica.length > 0 ? serieHistorica : undefined,

    saudeFiscal: fiscal.disponivel ? {
      situacaoLrf: fiscal.situacaoLrf,
      despesaPessoal: fiscal.percentualDespesaPessoal,
      limitePrudencial: fiscal.limitePrudencialPessoal,
      limiteAlerta: fiscal.limiteAlertaPessoal,
    } : undefined,

    cenario: cenarioAcoes.length > 0 ? {
      acoes: cenarioAcoes.map((a: any) => ({
        titulo: a.titulo || a.acao || '',
        descricao: a.descricao || a.detalhe || '',
        impacto: a.impacto || a.valor_estimado
          ? `R$ ${(a.valor_estimado / 1_000_000).toFixed(1).replace('.', ',')} mi`
          : undefined,
      })),
    } : undefined,

    prontidao: {
      score: prontidao.score ?? 0,
      status: prontidao.status ?? 'parcial',
      criterios: prontidao.criterios ?? [],
      bloqueios: [...(prontidao.bloqueios ?? []), ...(prontidao.avisos ?? [])],
    },

    infraestrutura: infra.disponivel ? {
      percentualInternet: findInfra('internet') || findInfra('banda larga'),
      percentualLabInformatica: findInfra('lab. inform'),
      percentualBiblioteca: findInfra('alimenta'),
      percentualQuadra: findInfra('quadra'),
      percentualAcessibilidade: findInfra('acessibilidade'),
      percentualSaneamento: findInfra('esgoto') || findInfra('água'),
    } : undefined,

    rastreabilidade: rastreabilidade.length > 0 ? rastreabilidade : undefined,

    recomendacoes: dirigido.proximosPassos ?? undefined,
    proximosPassos: dirigido.proximosPassos ?? undefined,
  };
}
