import type { IDEBDado, RelatorioFundeb } from "@/modules/levantamento-fundeb/types";
import { DESCRICAO_CONDICIONALIDADE, type Condicionalidade } from "@/core/lib/fundeb-vaar";

/**
 * Template do Levantamento FUNDEB — "novo modelo".
 *
 * Porte fiel de `LEVANTAMENTO_FUNDEB_NOVO_MODELO.html` (raiz do repositório),
 * que substitui o gerador ReportLab (`gerador.py`, o primeiro modelo do
 * produto). O CSS de impressão é o mesmo do arquivo de referência — ele já está
 * calibrado para Letter sem margem, e reescrevê-lo só reintroduziria bugs de
 * paginação já resolvidos.
 *
 * O relatório tem 10 páginas fixas; `section.page` é o contrato que o renderer
 * confere antes de devolver o PDF.
 */

export const LEVANTAMENTO_TOTAL_PAGINAS = 15;

/** Payload do `buildGoviaMunicipioCompleto`, na parte que este template lê. */
export interface LevantamentoPayload {
  demografia?: {
    populacao?: number | null;
    populacao_ano_referencia?: string | null;
  } | null;
  educacao?: Record<string, unknown> | null;
  fiscal?: {
    situacao_lrf?: string | null;
    /**
     * Receita **realizada** do RREO — execução acumulada até o bimestre da
     * entrega, não o exercício fechado. Não confundir com RCL: o denominador
     * dos limites da LRF é `siconfi.rcl_ajustada`.
     */
    receita_total?: number | null;
    despesa_pessoal?: number | null;
    pib_per_capita?: number | null;
    historico_repasses?: Array<Record<string, unknown>> | null;
    /**
     * Bloco fiscal oficial do SICONFI. É a fonte de verdade dos limites da
     * LRF: o percentual e os limites vêm calculados na própria entrega RGF e
     * não devem ser recalculados aqui.
     */
    siconfi?: {
      ano_referencia?: number | null;
      rcl?: number | null;
      rcl_ajustada?: number | null;
      despesa_pessoal_total?: number | null;
      percentual_despesa_pessoal?: number | null;
      limite_maximo_pessoal?: number | null;
      limite_prudencial_pessoal?: number | null;
      limite_alerta_pessoal?: number | null;
      espaco_fiscal_pessoal?: number | null;
      receita_total_realizada?: number | null;
    } | null;
  } | null;
  fontes_utilizadas?: unknown[] | null;
  /**
   * Blocos já derivados pelo backend. O template **consome** estes valores em
   * vez de recalcular: duplicar a regra aqui foi o que produziu um cenário de
   * estruturação 3,4× maior que o do motor e um recurso por aluno 14% menor.
   */
  relatorio_dirigido_base?: {
    equidade?: {
      anoCenso?: number;
      municipal?: {
        total?: number;
        branca?: number;
        preta?: number;
        parda?: number;
        amarela?: number;
        indigena?: number;
        naoDeclarada?: number;
      } | null;
      escolas?: {
        municipaisTotal?: number;
        municipaisRurais?: number;
        municipaisTerraIndigena?: number;
        municipaisQuilombolas?: number;
        municipaisAssentamento?: number;
        municipaisEducacaoIndigena?: number;
      } | null;
      negraMunicipal?: number;
      naoDeclaradaPct?: number | null;
      cadastroFragil?: boolean;
    } | null;
    /**
     * Situação no VAAR — ver `core/lib/fundeb-vaar.ts`. É a única parcela do
     * FUNDEB que se perde inteira por descumprimento, e a única que o gestor
     * reverte por ato próprio.
     */
    vaar?: {
      exercicio?: number;
      habilitado?: boolean;
      beneficiario?: boolean;
      complementacao?: number;
      coeficiente?: number | null;
      condicionalidades?: Record<string, boolean | null>;
      reprovadas?: string[];
      evoluiuAtendimento?: boolean | null;
      evoluiuAprendizagem?: boolean | null;
      pendencia?: string | null;
      condIVEstadual?: boolean;
      habilitadoSemRepasse?: boolean;
      referencia?: {
        medianaNacional?: number;
        medianaUf?: number | null;
        ufBeneficiadas?: number;
        ufAvaliadas?: number;
      } | null;
    } | null;
    /**
     * Matrícula ponderada — ver `core/lib/fundeb-ponderacao.ts`. É o
     * denominador real da receita: o fundo paga Σ(matrícula × fator), não
     * matrícula.
     */
    ponderacao?: {
      exercicio?: number;
      matriculas?: number;
      ponderadaVaaf?: number;
      ponderadaVaat?: number;
      fatorMedio?: number | null;
      segmentos?: Array<{
        nome?: string;
        matriculas?: number;
        fatorVaaf?: number | null;
        equivalentes?: number;
        participacao?: number;
      }>;
      oportunidades?: Array<{
        chave?: string;
        titulo?: string;
        matriculas?: number;
        ganhoEquivalentes?: number;
        detalhe?: string;
      }>;
    } | null;
    /**
     * Vinculações da educação apuradas pelo SIOPE — ver
     * `core/lib/siope-indicadores.ts`. Não bloqueiam o FUNDEB, mas entram no
     * CAUC e viciam a prestação de contas.
     */
    conformidade?: {
      ano?: number;
      defasado?: boolean;
      indicadores?: Array<{
        cod?: string;
        chave?: string;
        rotulo?: string;
        valor?: number;
        limite?: number | null;
        sentido?: "min" | "max" | null;
        base?: string | null;
        conforme?: boolean | null;
        folga?: number | null;
      }>;
      descumpridas?: Array<{ cod?: string; rotulo?: string; valor?: number; limite?: number | null }>;
    } | null;
    /**
     * Remuneração do magistério e adimplência ao piso — ver
     * `core/lib/remuneracao-docente.ts`.
     */
    remuneracao?: {
      ano?: number;
      piso?: number;
      jornadaReferencia?: number;
      magisterioDeclarado?: number;
      magisterio?: number;
      cobertura?: number;
      confiavel?: boolean;
      docentes?: number;
      efetivos?: number;
      temporarios?: number;
      medianaMagisterio?: number | null;
      medianaDocentes?: number | null;
      abaixoDoPiso?: number;
      abaixoDoPisoPct?: number;
      razaoMedianaPiso?: number | null;
      temporariosPct?: number | null;
    } | null;
    /** Estimativa do PNAE — ver `core/lib/fundeb-pnae.ts`. */
    pnae?: {
      exercicio?: number;
      diasLetivos?: number;
      matriculasConsideradas?: number;
      valorAnual?: number;
      faixas?: Array<{ rotulo?: string; perCapita?: number; matriculas?: number; valorAnual?: number }>;
    } | null;
    /**
     * Leitura prospectiva do VAAT: quanto falta para o VAAT próprio alcançar o
     * mínimo, e sobre qual exercício a conta foi feita.
     */
    vaat?: {
      exercicio?: number;
      proprio?: number;
      minimo?: number;
      complementacao?: number;
      distanciaPercentual?: number | null;
      exercicioBaseReceita?: number;
      habilitacao?: string;
      pendencia?: string | null;
      ieiPercentual?: number | null;
    } | null;
    perfilIBGE?: {
      /** O IBGE devolve o ano como texto; não assuma número. */
      pibAnoReferencia?: string | number | null;
      populacaoUltimoCenso?: number | null;
      populacaoAnoReferencia?: string | null;
    } | null;
    /** Receita FUNDEB ÷ matrículas **municipais** — a base correta por aluno. */
    recursosPorAluno?: {
      valor?: number | null;
      receitaBase?: number | null;
      totalAlunosMunicipais?: number | null;
      anoReferencia?: number | null;
    } | null;
    cenarioEstruturacao?: {
      anoAlvo?: number | null;
      baseAtual?: Record<string, number> | null;
      metas?: Record<string, number> | null;
      ganhosMatriculas?: Record<string, number> | null;
      impactoFinanceiroIndicativo?: {
        minimo?: number | null;
        maximo?: number | null;
        basePorMatricula?: number | null;
      } | null;
      leituraExecutiva?: string | null;
      frentes?: string[] | null;
    } | null;
  } | null;
}

export interface LevantamentoTemplateInput {
  relatorio: RelatorioFundeb;
  payload?: LevantamentoPayload | null;
  /** Logo em data-URI. Ausente → a marca sai só como texto. */
  logoDataUri?: string | null;
}

// ── Formatação ──────────────────────────────────────────────────────────────

const NBSP = "\u00a0";

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Recorte municipal da rede — a base de qualquer conta de FUNDEB.
 *
 * `censoEscolar.total*` carrega a rede **pública** (municipal + estadual),
 * mantida para comparação com o QEdu. O fundo municipal remunera só a rede
 * municipal, então dividir a receita por matrícula pública subestima o
 * recurso por aluno. Em Canindé de São Francisco a diferença era de 14%:
 * R$ 11.107,99 impressos contra R$ 12.980,12 reais.
 *
 * `recursosPorAluno` já vem calculado pelo backend; recalcular aqui só
 * reintroduz a chance de usar o denominador errado.
 */
function redeMunicipal(i: LevantamentoTemplateInput) {
  const censo = i.relatorio.censoEscolar;
  const perfil = i.relatorio.perfilComercial;
  const derivado = i.payload?.relatorio_dirigido_base;

  const matriculas = num(perfil?.matriculasMunicipais) || num(censo?.totalMatriculasMunicipais);
  const escolas = num(perfil?.escolasMunicipais) || num(censo?.totalEscolasMunicipais);
  const docentes = num(censo?.totalDocentesMunicipais);

  return {
    matriculas,
    escolas,
    docentes,
    anoCenso: censo?.anoReferencia ?? null,
    recursoAluno:
      num(derivado?.recursosPorAluno?.valor) ||
      (matriculas > 0 ? i.relatorio.receitas.totalReceitas / matriculas : 0),
  };
}

/** `R$ 128.516.949,21` — usado em tabela, onde o centavo importa. */
function brl(value: unknown): string {
  return num(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** `R$ 128,52 mi` — usado em KPI, onde a ordem de grandeza é a mensagem. */
function brlCompact(value: unknown): string {
  const v = num(value);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    return `R$${NBSP}${(v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NBSP}mi`;
  }
  if (abs >= 1_000) {
    return `R$${NBSP}${(v / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${NBSP}mil`;
  }
  return `R$${NBSP}${brl(v)}`;
}

function int(value: unknown): string {
  return num(value).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function pct(value: unknown, casas = 1): string {
  return `${num(value).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Participação de `parte` sobre `total`, protegida contra divisão por zero. */
function share(parte: unknown, total: unknown): number {
  const t = num(total);
  return t > 0 ? (num(parte) / t) * 100 : 0;
}

/** Largura de barra relativa ao maior valor da série. */
function barWidth(valor: unknown, maior: number): string {
  if (maior <= 0) return "0";
  return `${Math.max(0, Math.min(100, (num(valor) / maior) * 100)).toFixed(1)}%`;
}

/** Escapa texto vindo de base externa antes de entrar no HTML. */
function esc(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto ausente vira travessão — nunca um zero que finge ser dado. */
/**
 * `perfil.faixa` é sentinela comparada em código (`=== "padrao"`), então o
 * acento entra só na exibição — renomear o valor quebraria a regra de negócio.
 */
function rotuloFaixa(faixa: unknown): string {
  const mapa: Record<string, string> = {
    padrao: "padrão",
    conservador: "conservador",
    agressivo: "agressivo",
  };
  const chave = String(faixa ?? "").trim();
  return esc(mapa[chave] ?? chave);
}

const ORDEM_CONDICIONALIDADES: Condicionalidade[] = ["I", "II", "III", "IV", "V"];

/**
 * Situação no VAAR — a parcela do FUNDEB que se perde inteira.
 *
 * VAAF e VAAT saem por fórmula: todo município recebe algo. O VAAR é filtro
 * binário — reprovar em uma das cinco condicionalidades do art. 14, §1º da Lei
 * 14.113/2020 zera a parcela. Por isso este bloco não mostra só o valor: mostra
 * *qual* condicionalidade reprovou, porque é isso que o gestor pode agir.
 *
 * A referência por UF existe para dar ordem de grandeza a quem está fora. Não é
 * previsão: o rateio entre habilitados é proporcional à evolução dos
 * indicadores, então o município que se habilitar não recebe necessariamente a
 * mediana. O texto diz isso.
 */
function blocoVaar(i: LevantamentoTemplateInput): string {
  const v = i.payload?.relatorio_dirigido_base?.vaar;
  if (!v || (v.habilitado === undefined && v.beneficiario === undefined)) return "";

  const ref = v.referencia;
  const habilitado = v.habilitado === true;
  const complementacao = num(v.complementacao);
  const medianaUf = num(ref?.medianaUf);
  const reprovadas = (v.reprovadas ?? []) as Condicionalidade[];

  const linhas = ORDEM_CONDICIONALIDADES.map((n) => {
    const estado = v.condicionalidades?.[n];
    const marca = estado === true ? "✓" : estado === false ? "✕" : "—";
    const cor = estado === false ? ' style="color:var(--red)"' : "";
    return `<tr>
      <td class="r"${cor}><b>${marca}</b></td>
      <td><b>${n}.</b> ${esc(DESCRICAO_CONDICIONALIDADE[n])}</td>
    </tr>`;
  }).join("");

  // Quem está fora precisa de um número para dimensionar o que perde; quem
  // está dentro precisa saber o que está em risco se cair.
  const chamada = habilitado
    ? `<div class="kpi"><div class="kpi-v">${brlCompact(complementacao)}</div>
       <div class="kpi-l">recebidos de VAAR em ${ou(v.exercicio, "—")}</div></div>`
    : `<div class="kpi"><div class="kpi-v" style="color:var(--red)">R$${NBSP}0</div>
       <div class="kpi-l">não habilitado ao VAAR em ${ou(v.exercicio, "—")}</div></div>`;

  const diagnostico = (() => {
    if (v.condIVEstadual) {
      return `<b>A reprovação não é do município.</b> A Condicionalidade IV é avaliada no estado, e a
        Resolução CIF nº 15/2025 (art. 3º, §2º) aplica aos municípios a habilitação do respectivo estado.
        Os ${int(ref?.ufAvaliadas)} municípios do estado ficaram sem VAAR em ${ou(v.exercicio, "—")} pelo
        mesmo motivo. <b>Nenhuma ação municipal reverte isso</b> &mdash; a agenda é de articulação junto
        ao governo estadual.`;
    }
    if (v.habilitadoSemRepasse) {
      return `O município <b>cumpriu as cinco condicionalidades</b>, mas não evoluiu em nenhum dos dois
        indicadores no período. O rateio entre habilitados é proporcional ao avanço, então habilitação sem
        evolução não gera repasse. A habilitação está preservada: basta evoluir para passar a receber.`;
    }
    if (!habilitado && reprovadas.length) {
      const nomes = reprovadas.map((n) => `<b>${n}</b>`).join(", ");
      return `Reprovado ${reprovadas.length === 1 ? "na condicionalidade" : "nas condicionalidades"} ${nomes}.
        ${
          medianaUf > 0
            ? `Os ${int(ref?.ufBeneficiadas)} municípios habilitados do estado receberam, na mediana,
               <b>${brlCompact(medianaUf)}</b> em ${ou(v.exercicio, "—")} &mdash; referência de ordem de
               grandeza, não previsão: o rateio é proporcional à evolução dos indicadores.`
            : ""
        }
        ${
          reprovadas.length === 1
            ? "Como a reprovação é isolada, a habilitação depende de corrigir um único item."
            : ""
        }`;
    }
    if (habilitado) {
      return `Habilitado nas cinco condicionalidades e beneficiário do rateio. O VAAR é reavaliado a cada
        exercício e <b>não se acumula</b>: perder uma condicionalidade zera a parcela inteira no ano
        seguinte. ${
          medianaUf > 0
            ? `A mediana dos habilitados do estado é ${brlCompact(medianaUf)}.`
            : ""
        }`;
    }
    return "";
  })();

  return `
    <div class="sec-label">Complementação VAAR &middot; exercício ${ou(v.exercicio, "—")}</div>
    <div class="grid-2">
      <div class="card">
        <h3>As cinco condicionalidades</h3>
        <table class="tb">${linhas}</table>
        ${
          v.pendencia
            ? `<p class="micro" style="margin-top:.05in">Pendência registrada pelo FNDE:
               <i>${esc(v.pendencia)}</i></p>`
            : ""
        }
      </div>
      <div class="card">
        <h3>Situação e o que está em jogo</h3>
        ${chamada}
        <p class="micro" style="margin-top:.05in">${diagnostico}</p>
        <p class="micro">Diferente do VAAF e do VAAT, que são calculados por fórmula e alcançam todo
        município, o VAAR é filtro: basta reprovar em uma condicionalidade para perder a parcela inteira.
        É a única parcela do FUNDEB que depende de ato de gestão &mdash; e o art. 26 a exclui da base dos
        70%, o que a torna também a de aplicação mais livre.</p>
      </div>
    </div>
`;
}

/**
 * Composição da rede por cor/raça e condições que a portaria do FUNDEB pondera
 * acima da matrícula urbana comum: campo, terra indígena e remanescente de
 * quilombo. Declarar errado no Censo custa receita no exercício seguinte.
 *
 * Quando a não declaração é alta, a distribuição descreve o preenchimento do
 * Censo e não os alunos — nesse caso o bloco diz isso em vez de deixar o
 * leitor concluir que o município não tem alunos negros ou indígenas.
 */
function blocoEquidade(i: LevantamentoTemplateInput): string {
  const eq = i.payload?.relatorio_dirigido_base?.equidade;
  const m = eq?.municipal;
  const total = num(m?.total);
  if (!eq || total === 0) return "";

  const esc2 = eq.escolas;
  const pctDe = (valor: unknown) => pct(share(num(valor), total));
  const negra = num(eq.negraMunicipal);
  const naoDecl = num(eq.naoDeclaradaPct);

  const condicoes = (
    [
      ["Escolas no campo", num(esc2?.municipaisRurais)],
      ["Escolas em terra indígena", num(esc2?.municipaisTerraIndigena)],
      ["Escolas quilombolas", num(esc2?.municipaisQuilombolas)],
      ["Escolas em assentamento", num(esc2?.municipaisAssentamento)],
      ["Escolas de educação indígena", num(esc2?.municipaisEducacaoIndigena)],
    ] satisfies Array<[string, number]>
  ).filter(([, valor]) => valor > 0);

  return `
    <div class="sec-label">Equidade e condições de ponderação &middot; Censo ${ou(eq.anoCenso, "—")}</div>
    <div class="grid-2">
      <div class="card">
        <h3>Matrícula por cor/raça &middot; rede municipal</h3>
        ${barras([
          { nome: "Parda", valor: num(m?.parda), rotulo: pctDe(m?.parda) },
          { nome: "Branca", valor: num(m?.branca), rotulo: pctDe(m?.branca) },
          { nome: "Preta", valor: num(m?.preta), rotulo: pctDe(m?.preta) },
          { nome: "Indígena", valor: num(m?.indigena), rotulo: pctDe(m?.indigena) },
          { nome: "Amarela", valor: num(m?.amarela), rotulo: pctDe(m?.amarela) },
          { nome: "Não declarada", valor: num(m?.naoDeclarada), rotulo: pctDe(m?.naoDeclarada) },
        ])}
        <p class="micro" style="margin-top:.05in">População negra (preta + parda): <b>${int(negra)}</b>
        matrículas, ${pct(share(negra, total))} da rede.${
          eq.cadastroFragil
            ? ` <b>Atenção:</b> ${pct(naoDecl)} da rede está sem cor/raça declarada no Censo &mdash;
              acima desse patamar a distribuição mede o preenchimento do formulário, não a composição dos alunos.`
            : ""
        }</p>
      </div>
      <div class="card">
        <h3>Condições que pesam na ponderação</h3>
        ${
          condicoes.length
            ? `<table class="tb">${condicoes
                .map(([rotulo, valor]) => `<tr><td>${rotulo}</td><td class="r"><b>${int(valor)}</b></td></tr>`)
                .join("")}<tr><td>Total de escolas municipais</td><td class="r">${int(esc2?.municipaisTotal)}</td></tr></table>`
            : `<p class="micro">Nenhuma escola municipal declarada em campo, terra indígena, quilombo ou assentamento.</p>`
        }
        <p class="micro" style="margin-top:.05in">A portaria do FUNDEB pondera matrícula de campo, indígena e
        quilombola acima da urbana comum. Condição não declarada no Censo é receita não recebida no exercício
        seguinte &mdash; e a correção só vale a partir do próximo levantamento.</p>
      </div>
    </div>
`;
}

function ou(value: unknown, fallback = "—"): string {
  if (value == null) return fallback;
  const s = String(value).trim();
  if (!s || /^n[aã]o informado$/i.test(s)) return fallback;
  return esc(s);
}

function dataCurta(iso: string | undefined): string {
  if (!iso) return new Date().toLocaleDateString("pt-BR");
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? esc(iso)
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// ── Blocos reutilizáveis ────────────────────────────────────────────────────

function cabecalho(municipio: string, secao: string): string {
  return `<div class="page-header">
    <span><strong>Diagnóstico FUNDEB</strong> &middot; ${esc(municipio)}</span>
    <span>${esc(secao)}</span>
  </div>`;
}

function rodape(pagina: number, extra = ""): string {
  return `<div class="page-footer">
    <span>Global Sync &middot; Global Company Consultorias &mdash; Inteligência municipal &middot; Confidencial</span>
    <span>${pagina} / ${LEVANTAMENTO_TOTAL_PAGINAS}${extra}</span>
  </div>`;
}

interface Barra {
  nome: string;
  valor: number;
  rotulo: string;
  tom2?: boolean;
  vermelho?: boolean;
}

function barras(itens: Barra[]): string {
  const maior = Math.max(0, ...itens.map((i) => i.valor));
  return itens
    .map(
      (i) => `<div class="hb">
        <div class="hb-name">${esc(i.nome)}</div>
        <div class="hb-track"><div class="hb-fill${i.tom2 ? " t2" : ""}" style="width:${barWidth(i.valor, maior)}"></div></div>
        <div class="hb-val"${i.vermelho ? ' style="color:var(--red)"' : ""}>${esc(i.rotulo)}</div>
      </div>`,
    )
    .join("");
}

function kpi(rotulo: string, valor: string, apoio: string, classe = ""): string {
  return `<div class="kpi${classe ? ` ${classe}` : ""}"><em>${esc(rotulo)}</em><b>${valor}</b><span>${apoio}</span></div>`;
}

// ── CSS de impressão (idêntico ao modelo de referência) ─────────────────────

const CSS = `
@page{size:letter;margin:0}*{box-sizing:border-box}
:root{--navy:#10263f;--blue:#176b87;--teal:#27a69a;--gold:#e6a23c;--red:#c75050;--ink:#19242e;--muted:#647380;--line:#d9e1e5;--paper:#fbfcfc;--wash:#eef4f5;--good:#22856f;--warn:#a66a10;
--data1:#2f6bbf;--data2:#27a69a;--data3:#e6a23c;--brandark:#0C2E29}
html,body{margin:0;padding:0;background:#dfe6e9;color:var(--ink)}
body{font-family:Arial,"Noto Sans",sans-serif;font-size:9pt;line-height:1.38}
.page{width:8.5in;height:11in;margin:0 auto;background:var(--paper);overflow:hidden;page-break-after:always;position:relative}
.page:last-child{page-break-after:auto}
.content-page{display:grid;grid-template-rows:auto 1fr auto}
.page-header{min-height:.48in;padding:.22in .62in .11in;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:end;color:var(--muted);font-size:7.4pt;letter-spacing:.07em;text-transform:uppercase}
.page-header strong{color:var(--navy);font-weight:800}
.page-body{padding:.24in .62in .16in;overflow:hidden}
.page-footer{min-height:.39in;padding:.1in .62in .2in;border-top:1px solid var(--line);color:var(--muted);font-size:7pt;display:flex;justify-content:space-between;align-items:start}
h1,h2,h3,p{margin:0}
h2{color:var(--navy);font-size:20pt;line-height:1.04;letter-spacing:-.025em}
h2:after{content:"";display:block;width:.55in;height:.03in;margin-top:.1in;background:var(--teal)}
h3{color:var(--navy);font-size:10.5pt;line-height:1.15;margin-bottom:.06in}
p+p{margin-top:.08in}
.kicker{color:var(--teal);font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.08in}
.lede{margin-top:.12in;max-width:6.7in;color:#344551;font-size:9.8pt;line-height:1.42}
.small{font-size:7.7pt;color:var(--muted)}
.micro{font-size:6.8pt;color:var(--muted)}
.strong{font-weight:800;color:var(--navy)}
.divider{height:1px;background:var(--line);margin:.14in 0}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:.15in}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.12in}
.grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.1in}
.mt-1{margin-top:.11in}.mt-2{margin-top:.18in}
.card{background:#fff;border:1px solid var(--line);border-radius:7px;padding:.13in}
.note{background:#fdf9ee;border:1px solid #eddfb8;border-radius:7px;padding:.1in .13in;color:#584416}
.insight{background:#f2f8f7;border:1px solid #cde4e0;border-radius:7px;padding:.1in .13in}
.sec-label{color:var(--muted);font-size:7.2pt;font-weight:800;letter-spacing:.11em;text-transform:uppercase;margin:.14in 0 .07in}
.sec-label:first-child{margin-top:0}
.kpi{background:#fff;border:1px solid var(--line);border-radius:7px;padding:.11in .13in}
.kpi em{display:block;font-style:normal;color:var(--muted);font-size:6.6pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
.kpi b{display:block;color:var(--navy);font-size:14pt;letter-spacing:-.02em;margin-top:.035in;line-height:1}
.kpi span{display:block;color:var(--muted);font-size:6.9pt;margin-top:.035in}
.kpi.up b{color:var(--good)}
.kpi.hero{background:#f2f8f7;border:1px solid #cde4e0;border-left:.05in solid var(--teal)}
.kpi.hero em{color:#1d6a58}.kpi.hero b{color:var(--navy);font-size:15pt}.kpi.hero span{color:#5b7a72}
.tb{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:7px;overflow:hidden}
.tb th{background:var(--wash);color:var(--navy);font-size:6.9pt;letter-spacing:.06em;text-transform:uppercase;text-align:left;padding:.06in .1in;border-bottom:1px solid var(--line)}
.tb th.r,.tb td.r{text-align:right}
.tb td{padding:.055in .1in;border-bottom:1px solid var(--line);font-size:8pt;line-height:1.28;color:#33454f;vertical-align:top}
.tb tr:last-child td{border-bottom:none}
.tb td b{color:var(--navy)}
.tb tr.total td{background:var(--wash);font-weight:800;color:var(--navy)}
.hb{display:grid;grid-template-columns:1.5in 1fr .8in;gap:.08in;align-items:center;padding:.038in 0}
.hb-name{color:#33454f;font-size:7.8pt;line-height:1.15;text-align:right}
.hb-track{height:.14in;background:var(--wash);border-radius:3px;position:relative}
.hb-fill{height:100%;border-radius:3px;background:var(--data1);min-width:2px}
.hb-fill.t2{background:var(--data2)}
.hb-val{color:var(--navy);font-size:7.8pt;font-weight:800}
.vchart{display:flex;align-items:flex-end;gap:.14in;height:1.35in;padding:0 .05in;border-bottom:1.5px solid #b9c6cd}
.vbar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
.vbar-val{color:var(--navy);font-size:7.4pt;font-weight:800;margin-bottom:.03in;white-space:nowrap}
.vbar-fill{width:70%;background:var(--data1);border-radius:4px 4px 0 0}
.vbar-fill.now{background:var(--data2)}
.vxlab{display:flex;gap:.14in;padding:.04in .05in 0}
.vxlab span{flex:1;text-align:center;color:var(--muted);font-size:7.2pt}
.pair{display:grid;grid-template-columns:.85in 1fr;gap:.1in;align-items:center;padding:.05in 0}
.pair-name{color:var(--navy);font-size:8pt;font-weight:800;text-align:right}
.pair-bars{display:grid;gap:2px}
.pair-row{display:flex;align-items:center;gap:.06in}
.pair-fill{height:.13in;border-radius:3px;min-width:2px}
.pair-fill.a{background:var(--data1)}
.pair-fill.b{background:var(--data2)}
.pair-lab{color:#33454f;font-size:7.3pt;white-space:nowrap}
.legend{display:flex;gap:.22in;align-items:center;margin:.06in 0 .02in}
.legend i{display:inline-block;width:.13in;height:.13in;border-radius:3px;margin-right:.05in;vertical-align:-.02in}
.legend span{color:#33454f;font-size:7.4pt}
.status{display:flex;align-items:center;gap:.09in;border-radius:7px;padding:.09in .13in;font-weight:800;font-size:9pt}
.status.bad{background:#faeeee;border:1px solid #e7c6c6;color:#8f3a3a}
.status.good{background:#ecf5f1;border:1px solid #cbe2d8;color:#1d6a58}
.status .dot{width:.14in;height:.14in;border-radius:50%;flex:none}
.status.bad .dot{background:var(--red)}
.status.good .dot{background:var(--good)}
.cover{background:#fff;color:var(--ink);display:grid;grid-template-rows:auto 1fr auto;position:relative;overflow:hidden;border-top:.09in solid var(--teal)}
.cover:before{content:"";position:absolute;right:-1.6in;top:-1.9in;width:5.2in;height:5.2in;border-radius:50%;border:.55in solid rgba(39,166,154,.07)}
.cover:after{content:"";position:absolute;left:-1.2in;bottom:-2.2in;width:4.4in;height:4.4in;border-radius:50%;border:.4in solid rgba(39,166,154,.05)}
.cover-top{padding:.5in .7in 0;display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
.cover-mid{padding:0 .7in;position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center}
.cover-tag{display:inline-block;background:rgba(39,166,154,.09);border:1px solid rgba(39,166,154,.35);color:#1d7d72;font-size:7.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border-radius:999px;padding:.05in .16in;margin-bottom:.22in;width:fit-content}
.cover h1{font-size:33pt;line-height:1.05;letter-spacing:-.03em;font-weight:700;max-width:6.4in;color:var(--navy)}
.cover h1 .thin{color:var(--teal);font-weight:400}
.cover-sub{margin-top:.18in;color:#44545f;font-size:10.5pt;line-height:1.45;max-width:5.6in}
.cover-muni{margin-top:.42in}
.cover-muni em{display:block;font-style:normal;color:var(--muted);font-size:7.4pt;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.cover-muni b{display:block;color:var(--navy);font-size:19pt;letter-spacing:-.02em;margin-top:.05in}
.cover-kpis{display:grid;grid-template-columns:1fr 1fr;gap:.14in;margin-top:.34in;max-width:5.4in}
.ckpi{background:#f7fafa;border:1px solid var(--line);border-left:.04in solid var(--teal);border-radius:7px;padding:.12in .14in}
.ckpi em{display:block;font-style:normal;color:var(--muted);font-size:6.6pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.ckpi b{display:block;color:var(--navy);font-size:15pt;letter-spacing:-.02em;margin-top:.04in;line-height:1}
.ckpi span{display:block;color:var(--muted);font-size:6.8pt;margin-top:.03in}
.cover-bot{padding:0 .7in .5in;display:flex;justify-content:space-between;align-items:end;position:relative;z-index:1;color:var(--muted);font-size:7.6pt;line-height:1.4}
.cover-bot b{display:block;color:var(--navy);font-size:8.4pt}
.conf{display:inline-block;border:1px solid #e2c084;color:#a66a10;background:#fdf9ee;border-radius:4px;padding:.03in .09in;font-size:6.8pt;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
`;

// ── Páginas ─────────────────────────────────────────────────────────────────

function paginaCapa(i: LevantamentoTemplateInput, pagina: number): string {
  const { relatorio: r, logoDataUri } = i;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const exercicio = id.exercicio;
  const responsavel = r.parametros?.responsavelTecnico ?? "Adriel Tavares";

  const marca = logoDataUri
    ? `<img src="${logoDataUri}" alt="" style="width:.42in;height:.42in;border-radius:8px">`
    : "";

  return `<section class="page cover">
  <div class="cover-top">
    <div style="display:flex;align-items:center;gap:.13in">
      ${marca}
      <div>
        <div style="font-size:15pt;font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--navy)">Global Sync</div>
        <div style="margin-top:.04in;font-size:7.2pt;color:var(--muted)">Global Company Consultorias</div>
      </div>
    </div>
    <span class="conf">Documento confidencial</span>
  </div>

  <div class="cover-mid">
    <span class="cover-tag">Análise corporativa FUNDEB &middot; exercício ${exercicio}</span>
    <h1>Diagnóstico<br>e análise corporativa<br><span class="thin">do FUNDEB</span></h1>
    <p class="cover-sub">Leitura executiva, financeira e comparativa da rede municipal de ensino,
    com base oficial FNDE, INEP, IBGE e SICONFI consolidada no Global Sync.</p>

    <div class="cover-muni">
      <em>Município analisado</em>
      <b>${esc(municipio)}</b>
    </div>

    <div class="cover-kpis">
      <div class="ckpi"><em>Receita FUNDEB ${exercicio}</em><b>${brlCompact(r.receitas.totalReceitas)}</b><span>base oficial do exercício</span></div>
      <div class="ckpi"><em>Estimativa ${exercicio + 1} &middot; cenário otimizado</em><b>${brlCompact(r.projecao.totalProjetado)}</b><span>condicionada à validação documental</span></div>
    </div>
  </div>

  <div class="cover-bot">
    <div>
      <b>${esc(responsavel)} &middot; Responsável Técnico</b>
      Global Company Consultorias
    </div>
    <div style="text-align:right">
      <b>Emitido em ${dataCurta(r.geradoEm)}</b>
      Exercício de análise: ${exercicio}
    </div>
  </div>
</section>`;
}

function paginaSumario(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const rec = r.receitas;
  const perfil = r.perfilComercial;
  const total = rec.totalReceitas;

  const composicao = barras([
    { nome: "Contribuição municipal", valor: rec.receitaContribuicaoMunicipal, rotulo: pct(share(rec.receitaContribuicaoMunicipal, total)) },
    { nome: "União · VAAF", valor: rec.complementacaoVAAF, rotulo: pct(share(rec.complementacaoVAAF, total)) },
    { nome: "União · VAAT", valor: rec.complementacaoVAAT, rotulo: pct(share(rec.complementacaoVAAT, total)) },
    { nome: "União · VAAR", valor: rec.complementacaoVAAR, rotulo: pct(share(rec.complementacaoVAAR, total)), vermelho: rec.complementacaoVAAR <= 0 },
  ]);

  const vaarZerado = rec.complementacaoVAAR <= 0;

  return `<section class="page content-page">
  ${cabecalho(municipio, "Sumário executivo")}
  <div class="page-body">
    <div class="kicker">Sumário executivo</div>
    <h2>O que os números dizem &mdash;<br>e onde está a alavanca</h2>

    <p class="lede">Gestor municipal de ${esc(municipio)}: ${ou(id.prefeito, "gestor não identificado na base")}.
    Este relatório organiza a leitura do FUNDEB de ${id.exercicio} em linguagem direta: quanto o município
    recebeu, qual a estimativa para o próximo ciclo e o que precisa ser conferido nas bases oficiais
    antes de qualquer decisão.</p>

    <div class="grid-4 mt-2">
      ${kpi(`Receita ${id.exercicio}`, brlCompact(rec.totalReceitas), "base oficial do ano")}
      ${kpi(`Estimativa ${id.exercicio + 1}`, brlCompact(r.projecao.totalProjetado), "cenário otimizado")}
      ${kpi("Ganho potencial", `+${brlCompact(r.projecao.totalGanho)}`, `+${pct(r.projecao.ganhoPercentual)} sobre a base`, "up")}
      ${kpi("Já evidenciado", `+${brlCompact(r.projecaoRecuperavel.totalGanho)}`, `+${pct(r.projecaoRecuperavel.ganhoPercentual)} nas bases atuais`, "up")}
    </div>

    <div class="grid-2 mt-2">
      <div class="card">
        <h3>Leitura executiva</h3>
        <p style="font-size:8.2pt;line-height:1.45;color:#33454f">
        &bull; Gestor identificado na base atual: <span class="strong">${ou(id.prefeito)}${id.partido && id.partido !== "Nao informado" ? ` (${esc(id.partido)})` : ""}</span>.<br>
        &bull; Habilitação VAAT no exercício ${id.exercicio}: <span class="strong">${ou(perfil?.habilitacaoVaat, "não informada")}</span>.<br>
        &bull; VAAR atual: <span class="strong">R$ ${brl(rec.complementacaoVAAR)}</span>${vaarZerado ? " &mdash; o município não captura a complementação de resultado." : "."}<br>
        &bull; Vetores de trabalho: condicionalidades de desempenho e regularidade informacional para VAAR.</p>
      </div>
      <div class="card">
        <h3>Composição da receita ${id.exercicio}</h3>
        ${composicao}
        <p class="micro" style="margin-top:.05in">Total: R$ ${brl(total)} &middot; ${esc(id.fonte)}</p>
      </div>
    </div>

    <div class="insight mt-2">
      <h3>A alavanca em uma frase</h3>
      <p style="font-size:8.6pt;line-height:1.42">${pct(share(rec.receitaContribuicaoMunicipal, total), 0)} da receita vem da contribuição do
      próprio município${vaarZerado ? ' &mdash; e a fatia que premia resultado (VAAR) está <span class="strong">zerada</span>' : ""}.
      Recuperar matrícula perdida no Censo, habilitar o VAAR e expandir EJA e tempo integral são os três
      movimentos que separam a base atual do cenário otimizado.</p>
    </div>

    <div class="note mt-1">
      <p style="font-size:7.8pt;line-height:1.38"><span class="strong" style="color:#584416">Nota de método:</span>
      a estimativa ${id.exercicio + 1} usa benchmark comercial Global Company${
        perfil ? ` (cenário ${rotuloFaixa(perfil.faixa)}, score ${perfil.score.toFixed(2)})` : ""
      } e inclui potencial prospectivo de VAAR condicionado a condicionalidades e desempenho. Os valores projetados têm caráter
      estimativo e dependem de validação documental nas bases oficiais FUNDEB e MEC/FNDE.</p>
    </div>

    <div class="sec-label" style="margin-top:.22in">Como este relatório está organizado</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.1in">
      ${[
        ["I", "Receita e projeção", `composição ${id.exercicio} e cenário ${id.exercicio + 1}`],
        ["II", "Série histórica", "evolução por exercício"],
        ["III", "Rede e qualidade", "Censo, IDEB e infraestrutura"],
        ["IV", "Fiscal e sistemas", "LRF e situação MEC/FNDE"],
        ["V", `Cenário ${id.exercicio + 1}`, "frentes e faixa de ganho"],
      ]
        .map(
          ([n, t, s]) => `<div class="card" style="padding:.1in .11in"><b style="color:var(--teal);font-size:9pt">${n}</b>
        <p style="font-size:7.4pt;line-height:1.3;color:#33454f;margin-top:.03in"><b style="color:var(--navy)">${t}</b><br>${s}</p></div>`,
        )
        .join("")}
    </div>
  </div>
  ${rodape(pagina)}
</section>`;
}

function paginaReceita(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const rec = r.receitas;
  const total = rec.totalReceitas;
  const demo = i.payload?.demografia;
  const fiscal = i.payload?.fiscal;
  const populacao = num(demo?.populacao);
  const perfil = r.perfilComercial;
  const anoPib = String(i.payload?.relatorio_dirigido_base?.perfilIBGE?.pibAnoReferencia ?? "").trim();
  const rclAjustada = num(fiscal?.siconfi?.rcl_ajustada) || num(fiscal?.siconfi?.rcl);
  // `censoEscolar.totalMatriculas` é da rede **pública** (municipal + estadual)
  // apesar do rótulo da fonte dizer "municipal". O recorte municipal correto
  // é o do perfil comercial — é ele que divide a receita do FUNDEB municipal.
  const matriculasMunicipais = num(perfil?.matriculasMunicipais);

  const linhas: Array<[string, number, boolean]> = [
    ["Contribuição do município", rec.receitaContribuicaoMunicipal, false],
    ["Complementação da União — VAAF", rec.complementacaoVAAF, false],
    ["Complementação da União — VAAT", rec.complementacaoVAAT, false],
    ["Complementação da União — VAAR", rec.complementacaoVAAR, rec.complementacaoVAAR <= 0],
  ];

  return `<section class="page content-page">
  ${cabecalho(municipio, `Parte I · Receita ${id.exercicio}`)}
  <div class="page-body">
    <div class="kicker">Parte I &middot; Receita e identificação</div>

    <div class="sec-label">Composição das receitas do FUNDEB &mdash; exercício ${id.exercicio}</div>
    <table class="tb">
      <tr><th>Componente da receita</th><th class="r">Valor estimado (R$)</th><th class="r">Participação</th></tr>
      ${linhas
        .map(
          ([rotulo, valor, alerta]) => `<tr><td>${rotulo}</td><td class="r">${
            alerta ? `<b style="color:var(--red)">${brl(valor)}</b>` : brl(valor)
          }</td><td class="r">${pct(share(valor, total))}</td></tr>`,
        )
        .join("")}
      <tr class="total"><td>Total de receitas</td><td class="r">${brl(total)}</td><td class="r">100,0%</td></tr>
    </table>
    ${(() => {
      // Este parágrafo já existiu como conjectura ("a ausência pode estar
      // ligada às condições de habilitação"). Desde que o dataset do VAAR
      // entrou, a razão é conhecida por município e nomeada aqui.
      if (rec.complementacaoVAAR > 0) return "";
      const v = i.payload?.relatorio_dirigido_base?.vaar;
      const reprovadas = (v?.reprovadas ?? []) as string[];
      if (!v || !reprovadas.length) {
        return `<p class="small mt-1">O município não captura hoje a complementação VAAR (vinculada a
    resultados). A Parte I detalha as condicionalidades de habilitação.</p>`;
      }
      return `<p class="small mt-1">O município <b>não captura a complementação VAAR</b> porque foi reprovado
    ${reprovadas.length === 1 ? "na condicionalidade" : "nas condicionalidades"}
    <b>${reprovadas.join(", ")}</b> do art. 14 da Lei nº 14.113/2020&nbsp;&mdash; detalhamento e agenda de
    correção na página seguinte.</p>`;
    })()}

    <div class="divider"></div>

    <div class="grid-2">
      <div>
        <div class="sec-label">Identificação do ente</div>
        <table class="tb">
          <tr><td>Município</td><td class="r"><b>${esc(municipio)}</b></td></tr>
          <tr><td>Código IBGE</td><td class="r">${esc(id.codigoIBGE)}</td></tr>
          <tr><td>Gestor municipal</td><td class="r">${ou(id.prefeito)}${id.partido && id.partido !== "Nao informado" ? ` (${esc(id.partido)})` : ""}</td></tr>
          <tr><td>Mesorregião</td><td class="r">${ou(id.mesorregiao)}</td></tr>
          <tr><td>Microrregião</td><td class="r">${ou(id.microrregiao)}</td></tr>
          <tr><td>Base legal</td><td class="r">Lei nº 14.113/2020 (Novo FUNDEB)</td></tr>
          <tr><td>Fonte primária</td><td class="r">${esc(id.fonte)}</td></tr>
        </table>
      </div>
      <div>
        <div class="sec-label">Perfil IBGE</div>
        <div class="grid-2" style="gap:.1in">
          ${kpi("População", populacao > 0 ? int(populacao) : "—", `estimativa ${ou(demo?.populacao_ano_referencia, "—")}`)}
          ${kpi("PIB per capita", num(fiscal?.pib_per_capita) > 0 ? `R$ ${int(fiscal?.pib_per_capita)}` : "—", `IBGE Cidades${anoPib ? ` &middot; ${esc(anoPib)}` : ""}`)}
          ${kpi("Receita corrente líquida", rclAjustada > 0 ? brlCompact(rclAjustada) : "—", "SICONFI &middot; RGF")}
          ${kpi("Matrículas municipais", matriculasMunicipais > 0 ? int(matriculasMunicipais) : "—", "Censo Escolar INEP &middot; rede municipal")}
        </div>
        ${kpi(
          "FUNDEB per capita",
          populacao > 0 ? `R$ ${brl(total / populacao)}` : "—",
          `receita ${id.exercicio} &divide; população${perfil ? ` &middot; score de potencial ${perfil.score.toFixed(2)}` : ""}`,
          "mt-1",
        )}
      </div>
    </div>
  </div>
  ${rodape(pagina)}
</section>`;
}

function paginaProjecao(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const p = r.projecao;
  const rc = r.projecaoRecuperavel;
  const perfil = r.perfilComercial;

  const maiorPar = Math.max(p.vaafProjetado, p.vaatProjetado, p.vaarProjetado, p.vaafAtual, p.vaatAtual, p.vaarAtual, 1);
  const par = (nome: string, atual: number, projetado: number) => `<div class="pair">
        <div class="pair-name">${nome}</div>
        <div class="pair-bars">
          <div class="pair-row"><div class="pair-fill a" style="width:${barWidth(atual, maiorPar)}"></div><span class="pair-lab">${brlCompact(atual)}</span></div>
          <div class="pair-row"><div class="pair-fill b" style="width:${barWidth(projetado, maiorPar)}"></div><span class="pair-lab"><b style="color:var(--navy)">${brlCompact(projetado)}</b></span></div>
        </div>
      </div>`;

  const crono = r.cronogramaVAAF ?? [];
  const metade = Math.ceil(crono.length / 2);
  const tabelaCrono = (fatia: typeof crono) => `<table class="tb">
        <tr><th>Mês</th><th class="r">Valor projetado (R$)</th><th class="r">Part.</th></tr>
        ${fatia
          .map(
            (m) => `<tr><td>${esc(m.mes)}</td><td class="r">${brl(m.valorProjetado)}</td><td class="r">${pct(m.percentual * (m.percentual <= 1 ? 100 : 1))}</td></tr>`,
          )
          .join("")}
      </table>`;

  return `<section class="page content-page">
  ${cabecalho(municipio, `Parte I · Projeção ${id.exercicio + 1}`)}
  <div class="page-body">
    <div class="kicker">Parte I &middot; Estimativa para o próximo ciclo</div>

    <div class="sec-label">Complementações da União &mdash; atual vs. projetado</div>
    <div class="card">
      <div class="legend"><span><i style="background:var(--data1)"></i>Cenário atual</span><span><i style="background:var(--data2)"></i>Cenário projetado ${id.exercicio + 1}</span></div>
      ${par("VAAF", p.vaafAtual, p.vaafProjetado)}
      ${par("VAAT", p.vaatAtual, p.vaatProjetado)}
      ${par("VAAR", p.vaarAtual, p.vaarProjetado)}
    </div>

    <div class="mt-1">
      <table class="tb">
        <tr><th>Componente</th><th class="r">Cenário atual</th><th class="r">Projetado</th><th class="r">Variação</th></tr>
        <tr><td>VAAF (Valor Aluno Fundo)</td><td class="r">${brl(p.vaafAtual)}</td><td class="r">${brl(p.vaafProjetado)}</td><td class="r">+${brl(p.vaafGanho)}</td></tr>
        <tr><td>VAAT (Valor Aluno Total)</td><td class="r">${brl(p.vaatAtual)}</td><td class="r">${brl(p.vaatProjetado)}</td><td class="r">+${brl(p.vaatGanho)}</td></tr>
        <tr><td>VAAR (Vinculado a Resultados)</td><td class="r">${brl(p.vaarAtual)}</td><td class="r">${brl(p.vaarProjetado)}</td><td class="r">+${brl(p.vaarGanho)}</td></tr>
        <tr class="total"><td>Receita total</td><td class="r">${brl(p.totalAtual)}</td><td class="r">${brl(p.totalProjetado)}</td><td class="r">+${brl(p.totalGanho)}</td></tr>
      </table>
    </div>

    <div class="grid-2 mt-2">
      <div class="kpi hero"><em>Receita total projetada &middot; cenário otimizado</em><b>${brlCompact(p.totalProjetado)}</b><span>potencial de incremento: +${brlCompact(p.totalGanho)} (+${pct(p.ganhoPercentual)})</span></div>
      <div class="kpi up"><em>Camada recuperável já evidenciada</em><b>+${brlCompact(rc.totalGanho)}</b><span>+${pct(rc.ganhoPercentual)} sinalizado nas bases oficiais atuais</span></div>
    </div>

    <div class="note mt-2">
      <p style="font-size:7.9pt;line-height:1.4">A estimativa mostra uma leitura possível do próximo ciclo a
      partir da receita atual, do histórico e dos pontos de conferência do FUNDEB &mdash; ela <b>não
      substitui a validação nas bases oficiais</b>.${
        perfil ? ` Referência: benchmark comercial Global Company (${rotuloFaixa(perfil.faixa)}), score ${perfil.score.toFixed(2)}, com potencial prospectivo de VAAR condicionado a condicionalidades e desempenho.` : ""
      }</p>
    </div>

    ${
      crono.length
        ? `<div class="sec-label" style="margin-top:.2in">Cronograma mensal projetado do incremento</div>
    <div class="grid-2">
      ${tabelaCrono(crono.slice(0, metade))}
      ${tabelaCrono(crono.slice(metade))}
    </div>
    <p class="micro mt-1">Rampa mensal do potencial de incremento anual (R$ ${brl(p.totalGanho)}), crescente conforme
    a maturação das frentes de trabalho ao longo do exercício.</p>`
        : ""
    }
  </div>
  ${rodape(pagina)}
</section>`;
}

interface AnoSerie {
  ano: number;
  total: number;
  contribuicao: number;
  complementacao: number;
}

function serieHistorica(i: LevantamentoTemplateInput): AnoSerie[] {
  const bruto = i.payload?.fiscal?.historico_repasses ?? [];
  return bruto
    .map((linha) => {
      // Nomes conforme `payload.fiscal.historico_repasses` (govia-compat):
      // `receita_total_prevista` / `contribuicao_estados_municipios`.
      const contribuicao = num(
        linha.contribuicao_estados_municipios ?? linha.contribuicaoEstadosMunicipios ?? linha.contribuicao_municipal,
      );
      const vaaf = num(linha.complementacao_vaaf ?? linha.complementacaoVAAF);
      const vaat = num(linha.complementacao_vaat ?? linha.complementacaoVAAT);
      const vaar = num(linha.complementacao_vaar ?? linha.complementacaoVAAR);
      const complementacao = vaaf + vaat + vaar;
      // Exercício antigo às vezes vem sem o agregado; somar as partes evita
      // descartar o ano inteiro por causa de um campo ausente.
      const total = num(linha.receita_total_prevista ?? linha.receitaTotalPrevista) || contribuicao + complementacao;
      return { ano: num(linha.ano), total, contribuicao, complementacao };
    })
    .filter((a) => a.ano > 0 && a.total > 0)
    .sort((a, b) => a.ano - b.ano);
}

/**
 * O que fazer diante de cada condicionalidade reprovada. É a parte do
 * relatório que vira plano de trabalho — sem ela o bloco diagnostica sem
 * dizer por onde começar.
 */
const AGENDA_CONDICIONALIDADE: Record<Condicionalidade, string> = {
  I: "Instituir em lei o provimento do cargo de diretor por mérito e desempenho e comprovar que mais da metade da rede foi provida por esse critério.",
  II: "Mobilizar a participação no Saeb: o corte de 80% é aferido por ano escolar avaliado, não pela média da rede — uma única série abaixo reprova.",
  III: "Atacar a desigualdade de aprendizagem entre estudantes pretos, pardos e indígenas e de menor nível socioeconômico. É a condicionalidade que mais reprova no país.",
  IV: "Articular com o governo do estado: a condicionalidade é avaliada na esfera estadual e o resultado é aplicado a todos os municípios da UF.",
  V: "Aprovar o referencial curricular alinhado à BNCC no conselho municipal de educação e registrar a homologação.",
};

/**
 * Página dedicada ao VAAR.
 *
 * Ganhou página própria porque é a única parcela do FUNDEB que se perde
 * inteira — e porque a informação que importa não é o valor, é *qual* das
 * cinco condicionalidades reprovou e o que se faz a respeito. Espremer isso
 * num canto da página de receita reduziria de novo o assunto a um número.
 */
function paginaVaar(i: LevantamentoTemplateInput, pagina: number): string {
  const id = i.relatorio.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const v = i.payload?.relatorio_dirigido_base?.vaar;
  const ref = v?.referencia;
  const habilitado = v?.habilitado === true;
  const reprovadas = (v?.reprovadas ?? []) as Condicionalidade[];

  const faixaStatus = !v
    ? `<div class="status"><span class="dot"></span> Situação no VAAR não disponível nas bases consultadas</div>`
    : habilitado
      ? `<div class="status good"><span class="dot"></span> Habilitado ao VAAR ${ou(v.exercicio, "")}${
          v.beneficiario ? ` &middot; beneficiário do rateio` : " &middot; sem repasse por ausência de evolução"
        }</div>`
      : `<div class="status bad"><span class="dot"></span> Não habilitado ao VAAR ${ou(v.exercicio, "")} &middot; ${
          reprovadas.length === 1
            ? `reprovado na condicionalidade ${reprovadas[0]}`
            : `reprovado em ${reprovadas.length} condicionalidades`
        }</div>`;

  const agenda = reprovadas.length
    ? `<div class="sec-label" style="margin-top:.16in">Agenda para recuperar a parcela</div>
       <table class="tb">
         <tr><th>Condicionalidade</th><th>Providência</th></tr>
         ${reprovadas
           .map(
             (n) =>
               `<tr><td style="white-space:nowrap"><b>${n}</b> &middot; ${esc(
                 DESCRICAO_CONDICIONALIDADE[n].split("—")[0].trim(),
               )}</td><td>${esc(AGENDA_CONDICIONALIDADE[n])}</td></tr>`,
           )
           .join("")}
       </table>`
    : `<div class="sec-label" style="margin-top:.16in">Manutenção da habilitação</div>
       <p class="small">A habilitação é aferida a cada exercício e <b>não se acumula</b>: o município recomeça
       a avaliação todo ano nas cinco condicionalidades. A prioridade deixa de ser conquistar a parcela e passa
       a ser não perdê-la &mdash; com atenção à Condicionalidade III, que sozinha responde pela maioria das
       reprovações no país, e à IV, que depende do estado e independe de esforço municipal.</p>`;

  // O VAAT tem condição única e fiscal (art. 13, §4º): publicar os dados
  // contábeis no Siconfi e no Siope. Não se confunde com as condicionalidades
  // do VAAR, e é a outra parcela que o município perde por inteiro.
  const perfil = i.relatorio.perfilComercial;
  const t = i.payload?.relatorio_dirigido_base?.vaat;
  const habilitacaoVaat = (t?.habilitacao ?? perfil?.habilitacaoVaat ?? "").trim();
  const vaatConhecida = habilitacaoVaat && !/^n[aã]o informado$/i.test(habilitacaoVaat);
  const vaatInabilitado = /inabilit|n[aã]o habilit/i.test(habilitacaoVaat);
  const pendenciaVaat = t?.pendencia ?? perfil?.pendenciaVaat ?? null;

  // Quem já encostou no VAAT-MIN perde a complementação assim que a
  // arrecadação subir — e como o cálculo usa o penúltimo exercício, isso é
  // visível dois anos antes de acontecer.
  const distancia = num(t?.distanciaPercentual);
  const recebeVaat = num(t?.complementacao) > 0;
  const proximoDoTeto = recebeVaat && distancia > 0 && distancia < 10;

  const blocoVaat = vaatConhecida
    ? `<div class="sec-label" style="margin-top:.16in">A outra parcela condicionada &middot; VAAT</div>
       <div class="status ${vaatInabilitado ? "bad" : "good"}"><span class="dot"></span>
       Habilitação VAAT ${ou(t?.exercicio ?? id.exercicio, "")}: ${esc(habilitacaoVaat)}</div>
       ${
         t && num(t.minimo) > 0
           ? `<div class="grid-3 mt-1">
                ${kpi("VAAT próprio", `R$ ${brl(t.proprio)}`, "por aluno, antes da complementação")}
                ${kpi("VAAT-MIN", `R$ ${brl(t.minimo)}`, `patamar garantido em ${ou(t.exercicio, "—")}`)}
                ${kpi(
                  "Distância até o mínimo",
                  distancia > 0 ? pct(distancia) : "—",
                  recebeVaat ? "quanto a arrecadação pode subir antes de zerar" : "não recebe complementação",
                  proximoDoTeto ? "" : "up",
                )}
              </div>`
           : ""
       }
       <p class="small mt-1">A condição do VAAT é <b>uma só, e é fiscal</b> (art. 13, §4º da Lei nº
       14.113/2020): disponibilizar os dados contábeis, orçamentários e fiscais no <b>Siconfi</b> e no
       <b>Siope</b> até <b>31 de agosto</b> do exercício seguinte ao dos dados. Não se confunde com as
       condicionalidades do VAAR acima &mdash; plano de carreira, Saeb e gestão democrática pertencem ao
       art. 14, não ao 13. A habilitação é <b>anual e não se acumula</b>, e o inabilitado não tem o VAAT
       apurado: perde 100% da complementação no exercício.${
         pendenciaVaat ? ` Pendência registrada: <i>${esc(pendenciaVaat)}</i>.` : ""
       }</p>
       ${
         t && recebeVaat
           ? `<p class="small">A complementação é <b>equalização por insuficiência</b>: a União completa a
              rede até o VAAT-MIN, então arrecadar mais reduz o repasse, por construção. E o art. 15, II
              manda calcular sobre as receitas do <b>penúltimo exercício</b> &mdash; a base deste cálculo é
              a arrecadação de <b>${ou(t.exercicioBaseReceita, "—")}</b>. Por isso a saída da faixa é
              previsível com dois anos de antecedência${
                proximoDoTeto
                  ? `, e este município está a <b>${pct(distancia)}</b> do mínimo: uma alta de arrecadação
                     nessa ordem zera a complementação.`
                  : "."
              }</p>`
           : ""
       }`
    : "";

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte I · Complementações condicionadas")}
  <div class="page-body">
    <div class="kicker">Parte I &middot; As parcelas do FUNDEB que se perdem inteiras</div>

    ${faixaStatus}

    <div class="grid-4 mt-1">
      ${kpi(
        "VAAR recebido",
        num(v?.complementacao) > 0 ? brlCompact(v?.complementacao) : "R$ 0",
        `exercício ${ou(v?.exercicio, "—")}`,
        habilitado ? "up" : "",
      )}
      ${kpi(
        "Mediana no estado",
        num(ref?.medianaUf) > 0 ? brlCompact(ref?.medianaUf) : "—",
        `${int(ref?.ufBeneficiadas)} de ${int(ref?.ufAvaliadas)} municípios habilitados`,
      )}
      ${kpi("Mediana nacional", num(ref?.medianaNacional) > 0 ? brlCompact(ref?.medianaNacional) : "—", "entre os beneficiados do país")}
      ${kpi(
        "Coeficiente de rateio",
        num(v?.coeficiente) > 0 ? v!.coeficiente!.toFixed(8).replace(".", ",") : "—",
        "participação no bolo nacional",
      )}
    </div>

    ${blocoVaar(i)}

    ${agenda}

    ${blocoVaat}

    <div class="note mt-2">
      <p style="font-size:7.9pt;line-height:1.4">Base legal: art. 14 da Lei nº 14.113/2020 e Decreto nº
      10.656/2021. As condicionalidades e os indicadores são fixados por resolução da Comissão
      Intergovernamental de Financiamento (CIF) &mdash; não por portaria do MEC. A habilitação abre o direito;
      o valor recebido é rateado entre os habilitados <b>proporcionalmente à evolução</b> dos indicadores de
      atendimento e aprendizagem, e por isso habilitar-se não garante, por si só, um valor determinado.</p>
    </div>
  </div>
  ${rodape(pagina)}
</section>`;
}

function paginaSerie(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const rede = redeMunicipal(i);
  const serie = serieHistorica(i);

  if (!serie.length) {
    return `<section class="page content-page">
  ${cabecalho(municipio, "Parte II · Série histórica")}
  <div class="page-body">
    <div class="kicker">Parte II &middot; Comparativo por ano</div>
    <h2>Série histórica<br>indisponível</h2>
    <p class="lede">As bases oficiais não retornaram série de repasses para este município no momento da
    emissão. A leitura por exercício será incorporada assim que o histórico do FNDE estiver acessível.</p>
  </div>
  ${rodape(pagina)}
</section>`;
  }

  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  const variacaoTotal = primeiro.total > 0 ? ((ultimo.total - primeiro.total) / primeiro.total) * 100 : 0;
  const maiorTotal = Math.max(...serie.map((a) => a.total));

  return `<section class="page content-page">
  ${cabecalho(municipio, `Parte II · Série ${primeiro.ano}–${ultimo.ano}`)}
  <div class="page-body">
    <div class="kicker">Parte II &middot; Comparativo por ano</div>

    <div class="grid-3">
      ${kpi(`Receita ${primeiro.ano} → ${ultimo.ano}`, `+${brlCompact(ultimo.total - primeiro.total)}`, `de ${brlCompact(primeiro.total)} para ${brlCompact(ultimo.total)} (+${pct(variacaoTotal)})`, "up")}
      ${kpi("Matrículas municipais", rede.matriculas > 0 ? int(rede.matriculas) : "—", `Censo ${ou(rede.anoCenso, "—")} &middot; rede municipal`)}
      ${kpi("Unidades escolares", rede.escolas > 0 ? int(rede.escolas) : "—", "rede municipal")}
    </div>

    <div class="card mt-2">
      <h3>Receita FUNDEB por exercício (R$ milhões)</h3>
      <div class="vchart">
        ${serie
          .map(
            (a, idx) => `<div class="vbar"><span class="vbar-val">${(a.total / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span><div class="vbar-fill${
              idx === serie.length - 1 ? " now" : ""
            }" style="height:${((a.total / maiorTotal) * 92).toFixed(0)}%"></div></div>`,
          )
          .join("")}
      </div>
      <div class="vxlab">${serie.map((a, idx) => `<span>${a.ano}${idx === serie.length - 1 ? " &middot; atual" : ""}</span>`).join("")}</div>
    </div>

    <div class="sec-label">Série oficial da receita</div>
    <table class="tb">
      <tr><th>Ano</th><th class="r">Receita total</th><th class="r">Contribuição municipal</th><th class="r">Compl. União</th><th class="r">Variação</th></tr>
      ${serie
        .map((a, idx) => {
          const anterior = idx > 0 ? serie[idx - 1].total : 0;
          const variacao = idx === 0 || anterior <= 0 ? "base" : `${a.total >= anterior ? "+" : ""}${pct(((a.total - anterior) / anterior) * 100)}`;
          return `<tr><td><b>${a.ano}</b></td><td class="r">${brl(a.total)}</td><td class="r">${brl(a.contribuicao)}</td><td class="r">${brl(a.complementacao)}</td><td class="r">${variacao}</td></tr>`;
        })
        .join("")}
    </table>

    <div class="insight mt-1">
      <p style="font-size:8.2pt;line-height:1.4"><span class="strong">O que a série mostra:</span> a receita
      variou ${pct(variacaoTotal)} entre ${primeiro.ano} e ${ultimo.ano}. Crescimento que vem de correção de valor por aluno
      e complementações &mdash; e não de rede &mdash; perde força a cada Censo sem recomposição de matrícula.</p>
    </div>
  </div>
  ${rodape(pagina)}
</section>`;
}

function paginaRede(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const censo = r.censoEscolar;
  const etapa = censo?.matriculasEtapa;
  const edu = (i.payload?.educacao ?? {}) as Record<string, unknown>;
  const rede = redeMunicipal(i);
  const matriculas = rede.matriculas;
  const recursoAluno = rede.recursoAluno;

  const porEtapa = barras([
    { nome: "Ensino Fundamental", valor: num(etapa?.ensinoFundamental), rotulo: int(etapa?.ensinoFundamental) },
    { nome: "Educação Infantil", valor: num(etapa?.educacaoInfantil), rotulo: int(etapa?.educacaoInfantil) },
    { nome: "Educação Especial", valor: num(etapa?.educacaoEspecial), rotulo: int(etapa?.educacaoEspecial) },
    { nome: "EJA", valor: num(etapa?.eja), rotulo: int(etapa?.eja) },
  ]);

  const integralTotal = num(edu.matriculas_tempo_integral);
  const coberturaIntegral = barras([
    { nome: "Creche", valor: num(edu.matriculas_creche), rotulo: int(edu.matriculas_creche), tom2: true },
    { nome: "Pré-escola", valor: num(edu.matriculas_pre_escola), rotulo: int(edu.matriculas_pre_escola), tom2: true },
    { nome: "Fund. anos iniciais", valor: num(edu.matriculas_fundamental_ai), rotulo: int(edu.matriculas_fundamental_ai), tom2: true },
    { nome: "Fund. anos finais", valor: num(edu.matriculas_fundamental_af), rotulo: int(edu.matriculas_fundamental_af), tom2: true },
    { nome: "Tempo integral", valor: integralTotal, rotulo: int(integralTotal), tom2: true },
  ]);

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte III · Rede e Censo")}
  <div class="page-body">
    <div class="kicker">Parte III &middot; A rede municipal em números</div>

    <div class="grid-4">
      ${kpi("Unidades escolares", rede.escolas > 0 ? int(rede.escolas) : "—", "rede municipal")}
      ${kpi("Matrículas municipais", matriculas > 0 ? int(matriculas) : "—", `Censo ${ou(rede.anoCenso ?? edu.censo_ano, "—")} &middot; rede municipal`)}
      ${kpi("Docentes", rede.docentes > 0 ? int(rede.docentes) : "—", "rede municipal")}
      ${kpi("Recurso por aluno", recursoAluno > 0 ? `R$ ${brl(recursoAluno)}` : "—", "receita FUNDEB &divide; matrículas municipais", "up")}
    </div>

    <div class="grid-2 mt-2">
      <div class="card">
        <h3>Matrículas por etapa &middot; rede municipal</h3>
        ${porEtapa}
        <p class="micro" style="margin-top:.05in">Detalhe: creche ${int(edu.matriculas_creche)} &middot; pré-escola ${int(edu.matriculas_pre_escola)} &middot;
        anos iniciais ${int(edu.matriculas_fundamental_ai)} &middot; anos finais ${int(edu.matriculas_fundamental_af)}.
        Ensino Médio (${int(edu.matriculas_ensino_medio_total)}) é rede estadual/federal e não compõe o FUNDEB municipal.
        Fundamental, Infantil e EJA somam o total da rede; educação especial é recorte transversal e já está
        contada nas etapas &mdash; por isso as quatro barras somam mais que ${int(matriculas)}.</p>
      </div>
      <div class="card">
        <h3>Distribuição da rede por segmento</h3>
        ${coberturaIntegral}
        <p class="micro" style="margin-top:.05in">Jornada ampliada: ${int(integralTotal)} de ${int(matriculas)} matrículas
        (${pct(share(integralTotal, matriculas))}).</p>
      </div>
    </div>

    ${blocoEquidade(i)}

    <div class="sec-label">Leitura do valor por aluno</div>
    <div class="grid-3">
      ${kpi("Recurso real por aluno", recursoAluno > 0 ? `R$ ${brl(recursoAluno)}` : "—", "receita FUNDEB &divide; matrículas municipais")}
      ${kpi("Matrículas em EJA", int(etapa?.eja), "modalidade com expansão possível")}
      ${kpi("Educação especial", int(etapa?.educacaoEspecial), "maior ponderação no fundo", "up")}
    </div>
    <p class="small mt-1">Cada matrícula migrada para jornada integral vale mais no fundo &mdash; é o elo
    entre esta página e o cenário de estruturação da Parte V.</p>
  </div>
  ${rodape(pagina)}
</section>`;
}

/**
 * Página da matrícula ponderada.
 *
 * A Parte III mostra a rede em matrículas brutas porque é assim que o gestor a
 * conhece. Esta página mostra a mesma rede no denominador que o fundo usa:
 * Σ(matrícula × fator), com fatores de 1,00 a 2,17. Sem ela o relatório
 * apresenta uma receita cuja formação não explica.
 *
 * As "oportunidades" são conferências, não acusações — a creche pode ser
 * legitimamente parcial e o AEE pode não ser devido. O texto quantifica o que
 * está em jogo e manda verificar.
 */
function paginaPonderacao(i: LevantamentoTemplateInput, pagina: number): string {
  const id = i.relatorio.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const p = i.payload?.relatorio_dirigido_base?.ponderacao;

  const segmentos = (p?.segmentos ?? []).filter((s) => num(s.matriculas) > 0);
  const brutas = num(p?.matriculas);
  const ponderada = num(p?.ponderadaVaaf);
  const fatorMedio = num(p?.fatorMedio);
  const oportunidades = p?.oportunidades ?? [];

  if (!p || brutas === 0) {
    return `<section class="page content-page">
  ${cabecalho(municipio, "Parte III · Matrícula ponderada")}
  <div class="page-body">
    <div class="kicker">Parte III &middot; O denominador real da receita</div>
    <div class="status"><span class="dot"></span> Matrícula ponderada não disponível nas bases consultadas</div>
    <p class="small mt-1">A planilha de matrículas ponderadas do FNDE não trouxe este município no exercício
    consultado. A leitura de receita por aluno das páginas anteriores permanece válida, mas usa matrícula
    bruta &mdash; que não é o denominador com que o fundo calcula o repasse.</p>
  </div>
  ${rodape(pagina)}
</section>`;
  }

  const linhas = segmentos
    .slice(0, 12)
    .map(
      (s) => `<tr>
        <td>${esc(s.nome)}</td>
        <td class="r">${int(s.matriculas)}</td>
        <td class="r">${s.fatorVaaf == null ? "—" : num(s.fatorVaaf).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
        <td class="r"><b>${int(s.equivalentes)}</b></td>
        <td class="r">${pct(s.participacao)}</td>
      </tr>`,
    )
    .join("");

  const restantes = segmentos.length - Math.min(12, segmentos.length);

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte III · Matrícula ponderada")}
  <div class="page-body">
    <div class="kicker">Parte III &middot; O denominador real da receita</div>

    <div class="grid-4">
      ${kpi("Matrículas", int(brutas), `filtragem FNDE ${ou(p.exercicio, "")}`)}
      ${kpi("Matrículas-equivalentes", int(ponderada), "após a ponderação do fundo", "up")}
      ${kpi(
        "Fator médio da rede",
        fatorMedio > 0 ? fatorMedio.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "—",
        "referência legal = 1,000",
      )}
      ${kpi("Equivalentes no VAAT", int(p.ponderadaVaat), "ponderação da complementação VAAT")}
    </div>

    <div class="sec-label" style="margin-top:.16in">Onde o peso da rede está concentrado</div>
    <table class="tb">
      <tr><th>Segmento</th><th class="r">Matrículas</th><th class="r">Fator</th><th class="r">Equivalentes</th><th class="r">Peso</th></tr>
      ${linhas}
    </table>
    ${
      restantes > 0
        ? `<p class="micro" style="margin-top:.04in">Exibidos os 12 segmentos de maior peso; outros ${int(restantes)}
           segmentos com matrícula compõem o restante.</p>`
        : ""
    }

    ${
      oportunidades.length
        ? `<div class="sec-label" style="margin-top:.16in">Pontos de conferência no Censo</div>
           <div class="grid-${oportunidades.length > 1 ? "2" : "1"}">
             ${oportunidades
               .map(
                 (o) => `<div class="card">
                   <h3>${esc(o.titulo)}</h3>
                   <p class="micro"><b>${int(o.matriculas)}</b> matrículas &middot; até
                   <b>+${int(o.ganhoEquivalentes)}</b> matrículas-equivalentes se a condição for outra.</p>
                   <p class="micro" style="margin-top:.04in">${esc(o.detalhe)}</p>
                 </div>`,
               )
               .join("")}
           </div>`
        : ""
    }

    <div class="note mt-2">
      <p style="font-size:7.9pt;line-height:1.4">A receita do FUNDEB é proporcional a
      <b>matrícula × fator de ponderação</b>, e o fator vai de 1,00 (anos iniciais urbano, a referência do
      art. 7º, §1º da Lei nº 14.113/2020) a 2,17 (creche integral indígena ou quilombola). Campo acrescenta
      15% e educação indígena ou quilombola acrescenta 40% sobre o fator da etapa. Os fatores desta página
      são os efetivamente aplicados pelo FNDE na planilha do exercício &mdash; que em alguns segmentos
      diverge da resolução da CIF. Jornada, localização e atendimento especializado declarados a menor no
      Censo rebaixam o fator e se repetem a cada exercício, porque a coleta de um ano define o repasse do
      seguinte.</p>
    </div>
  </div>
  ${rodape(pagina)}
</section>`;
}

function paginaIdeb(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const edu = (i.payload?.educacao ?? {}) as Record<string, unknown>;
  const infra = (edu.infraestrutura_rede_publica ?? {}) as Record<string, unknown>;

  /** Último ponto com IDEB verificado da série. */
  const ultimoVerificado = (serie: typeof r.idebAnosIniciais) => {
    const comDado = (serie ?? []).filter((d) => d.idebVerificado != null);
    return comDado.length ? comDado[comDado.length - 1] : null;
  };

  const cartaoIdeb = (titulo: string, dado: IDEBDado | null) => {
    if (!dado) {
      return `<div class="card" style="border-left:.045in solid var(--line)">
        <em style="font-style:normal;color:var(--muted);font-size:6.8pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase">${titulo}</em>
        <div style="margin-top:.04in"><b style="color:var(--muted);font-size:21pt">—</b></div>
        <p class="micro" style="margin-top:.04in">Sem IDEB verificado nas bases consultadas.</p>
      </div>`;
    }
    const observado = num(dado.idebVerificado);
    const meta = num(dado.metaProjetada);
    const gap = observado - meta;
    const abaixo = meta > 0 && gap < 0;
    const metaNacional = dado.metaOrigem === "nacional";
    return `<div class="card" style="border-left:.045in solid var(--${abaixo ? "gold" : "teal"})">
      <em style="font-style:normal;color:var(--muted);font-size:6.8pt;font-weight:800;letter-spacing:.09em;text-transform:uppercase">${titulo}</em>
      <div style="display:flex;align-items:baseline;gap:.12in;margin-top:.04in">
        <b style="color:var(--navy);font-size:21pt;letter-spacing:-.02em">${observado.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
        ${
          meta > 0
            ? `<span style="color:${abaixo ? "#8f6a1d" : "#1d6a58"};font-size:8pt;font-weight:800">${
                abaixo ? "&#9888; " : ""
              }${gap >= 0 ? "+" : "&minus;"}${Math.abs(gap).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${
                abaixo ? "abaixo" : "acima"
              } da ${metaNacional ? "referência nacional" : "meta"} (${meta.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })})</span>`
            : ""
        }
      </div>
      <p class="micro" style="margin-top:.04in">Referência ${dado.ano} &middot; rede municipal${
        metaNacional
          ? " &middot; o INEP projetou metas por rede apenas até 2021; o parâmetro acima é a referência nacional"
          : ""
      }</p>
    </div>`;
  };

  const totalAvaliadas = num(infra.total_escolas_publicas_avaliadas);
  const infraTodos: Array<[string, unknown]> = [
    ["Água potável", infra.escolas_com_agua_potavel],
    ["Cozinha/refeitório", infra.escolas_com_cozinha],
    ["Internet", infra.escolas_com_internet],
    ["Banda larga", infra.escolas_com_banda_larga],
    ["Acessibilidade", infra.escolas_com_acessibilidade],
    ["Esgoto sanitário", infra.escolas_com_esgoto],
    ["Quadra esportiva", infra.escolas_com_quadra],
    ["Lab. informática", infra.escolas_com_lab_informatica],
    ["Lab. ciências", infra.escolas_com_lab_ciencias],
  ];
  // Item sem leitura no Censo sai da barra — 0% inventado mentiria sobre a rede.
  const infraItens = infraTodos.filter(([, v]) => v != null);

  const metade = Math.ceil(infraItens.length / 2);
  const colunaInfra = (fatia: typeof infraItens) =>
    `<div class="card">${barras(
      fatia.map(([nome, v]) => ({
        nome,
        valor: share(v, totalAvaliadas),
        rotulo: pct(share(v, totalAvaliadas)),
      })),
    )}</div>`;

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte III · IDEB e infraestrutura")}
  <div class="page-body">
    <div class="kicker">Parte III &middot; Qualidade e infraestrutura</div>

    <div class="sec-label">IDEB &mdash; rede municipal</div>
    <div class="grid-2">
      ${cartaoIdeb("Anos iniciais", ultimoVerificado(r.idebAnosIniciais))}
      ${cartaoIdeb("Anos finais", ultimoVerificado(r.idebAnosFinais))}
    </div>
    <p class="small mt-1">O IDEB abaixo da meta pesa duas vezes: na aprendizagem e no acesso ao VAAR, cuja
    condicionalidade de desempenho premia evolução de indicador. Ensino Médio (rede estadual) é
    informativo e não compõe o FUNDEB municipal.</p>

    <div class="divider"></div>

    ${(() => {
      // Distorção e abandono vêm do INEP (TDI e taxas de rendimento 2023). Antes
      // caíam para zero quando a fonte não respondia, o que afirmava "nenhum
      // aluno atrasado" — o oposto do real na maioria das redes rurais.
      const dTotal = num(edu.distorcao_idade_serie_total);
      const dInic = num(edu.distorcao_idade_serie_anos_iniciais);
      const dFin = num(edu.distorcao_idade_serie_anos_finais);
      const abandono = num(edu.taxa_abandono);
      const reprovacao = num(edu.taxa_reprovacao);
      if (dTotal === 0 && dInic === 0 && dFin === 0 && abandono === 0 && reprovacao === 0) {
        return `<div class="sec-label">Fluxo escolar</div>
    <p class="small">O INEP não publicou distorção idade-série nem taxas de rendimento para esta rede.</p>`;
      }
      const chip = (rotulo: string, valor: number, alerta: number) =>
        `<div class="card" style="padding:.09in .11in"><div class="micro" style="text-transform:uppercase;letter-spacing:.08em">${rotulo}</div>
        <div style="font-size:15pt;font-weight:800;color:${valor >= alerta ? "var(--gold)" : "var(--teal)"};line-height:1.1">${valor ? pct(valor) : "N/D"}</div></div>`;
      return `<div class="sec-label">Fluxo escolar &mdash; distorção idade-série e rendimento</div>
    <div class="grid-4" style="gap:.09in">
      ${chip("Distorção total", dTotal, 20)}
      ${chip("Anos iniciais", dInic, 15)}
      ${chip("Anos finais", dFin, 25)}
      ${chip("Abandono", abandono, 3)}
    </div>
    <p class="small mt-1">Distorção idade-série é matrícula que já está na rede e não avança. Cada aluno
    retido consome vaga sem gerar progressão, e a concentração nos anos finais antecipa a evasão que
    esvazia o Censo do ano seguinte &mdash; e com ele a receita do FUNDEB.</p>`;
    })()}

    <div class="divider"></div>

    ${
      infraItens.length && totalAvaliadas > 0
        ? `<div class="sec-label">Infraestrutura da rede pública &mdash; ${int(totalAvaliadas)} escolas avaliadas</div>
    <div class="grid-2">
      ${colunaInfra(infraItens.slice(0, metade))}
      ${colunaInfra(infraItens.slice(metade))}
    </div>

    <div class="insight mt-1">
      <p style="font-size:8.2pt;line-height:1.4"><span class="strong">Onde a infraestrutura trava a receita:</span>
      esgoto, quadra e laboratórios são exatamente os itens que limitam a expansão de tempo integral &mdash; a
      modalidade com maior valor por aluno na tabela oficial. Investimento dirigido nesses itens habilita a
      migração de matrícula para faixas mais valorizadas.</p>
    </div>`
        : `<div class="sec-label">Infraestrutura da rede pública</div>
    <p class="small">O Censo Escolar não retornou o detalhamento de infraestrutura para esta rede no momento da emissão.</p>`
    }
  </div>
  ${rodape(pagina)}
</section>`;
}

function paginaFiscal(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const fiscal = i.payload?.fiscal;
  const siconfi = fiscal?.siconfi;

  /**
   * Os limites da LRF são medidos contra a **RCL ajustada**, não contra a
   * receita realizada. Recalcular a razão aqui já produziu 158,55% para um
   * município que está em 52,89%: a despesa de pessoal do RGF cobre 12 meses
   * e a receita realizada do RREO cobre só os bimestres entregues.
   *
   * O percentual e os limites vêm calculados na própria entrega RGF e são a
   * autoridade legal — este template exibe, não deriva.
   */
  const rcl = num(siconfi?.rcl_ajustada) || num(siconfi?.rcl);
  const pessoal = num(siconfi?.despesa_pessoal_total) || num(fiscal?.despesa_pessoal);
  const percentual = num(siconfi?.percentual_despesa_pessoal);
  const temPercentual = percentual > 0;
  // Fallback nos valores da LRF para o Executivo municipal, usados só quando a
  // entrega não traz os limites.
  const limiteMaximo = num(siconfi?.limite_maximo_pessoal) || 54;
  const limitePrudencial = num(siconfi?.limite_prudencial_pessoal) || 51.3;
  const espacoFiscal = temPercentual ? limiteMaximo - percentual : 0;
  const receitaRealizada = num(siconfi?.receita_total_realizada) || num(fiscal?.receita_total);
  const anoFiscal = num(siconfi?.ano_referencia);
  const situacao = String(fiscal?.situacao_lrf ?? "");
  const acima = /acima/i.test(situacao);
  const pdde = r.pdde ?? [];
  const totalPdde = pdde.reduce((s, p) => s + num(p.valor), 0);

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte IV · Fiscal e sistemas")}
  <div class="page-body">
    <div class="kicker">Parte IV &middot; Saúde fiscal e situação operacional</div>

    ${
      situacao
        ? `<div class="status ${acima ? "bad" : "good"}"><span class="dot"></span> Status LRF: ${esc(situacao)}${
            temPercentual ? ` (${pct(percentual, 2)} da RCL ajustada)` : ""
          }</div>`
        : `<div class="status good"><span class="dot"></span> Status LRF: sem pendência registrada nas bases consultadas</div>`
    }

    <div class="grid-2 mt-1">
      <div>
        <table class="tb">
          <tr><th>Indicador fiscal &middot; SICONFI${anoFiscal > 0 ? ` ${anoFiscal}` : ""}</th><th class="r">Valor</th></tr>
          <tr><td>Receita Corrente Líquida ajustada</td><td class="r">${rcl > 0 ? `R$ ${brl(rcl)}` : "—"}</td></tr>
          <tr><td>Despesa com pessoal <span class="micro">(12 meses)</span></td><td class="r">${pessoal > 0 ? `R$ ${brl(pessoal)}` : "—"}</td></tr>
          <tr><td>% pessoal / RCL ajustada</td><td class="r">${
            temPercentual ? `<b style="color:var(--${acima ? "red" : "good"})">${pct(percentual, 2)}</b>` : "—"
          }</td></tr>
          <tr><td>Limite máximo &middot; prudencial</td><td class="r">${pct(limiteMaximo, 2)} &middot; ${pct(limitePrudencial, 2)}</td></tr>
          <tr><td>Espaço fiscal até o limite</td><td class="r">${
            temPercentual
              ? `<b style="color:var(--${espacoFiscal < 0 ? "red" : "good"})">${espacoFiscal < 0 ? "&minus;" : "+"}${pct(Math.abs(espacoFiscal), 2)}</b>`
              : "—"
          }</td></tr>
          <tr><td>Receita realizada <span class="micro">(execução parcial)</span></td><td class="r">${receitaRealizada > 0 ? `R$ ${brl(receitaRealizada)}` : "—"}</td></tr>
          <tr><td>PIB per capita</td><td class="r">${num(fiscal?.pib_per_capita) > 0 ? `R$ ${brl(fiscal?.pib_per_capita)}` : "—"}</td></tr>
        </table>
      </div>
      <div>
        <div class="card">
          <h3>Por que isso importa para o FUNDEB</h3>
          <p style="font-size:8.2pt;line-height:1.42;color:#33454f">Acima do limite da LRF, o município perde
          liberdade para expandir folha &mdash; e 70% do FUNDEB é justamente remuneração.
          Aumentar a <span class="strong">receita do fundo</span> (Censo íntegro, VAAR, matrículas de maior
          ponderação) é o caminho que amplia a capacidade de pagamento da educação sem
          pressionar a RCL: receita nova do FUNDEB financia a folha da rede dentro da própria vinculação.</p>
        </div>
        ${
          totalPdde > 0
            ? kpi("Repasses PDDE", `R$ ${brl(totalPdde)}`, `${pdde.length} registro(s) no PDDE Info`, "mt-1")
            : ""
        }
      </div>
    </div>

    <div class="sec-label">Sistemas MEC/FNDE &mdash; situação cadastral</div>
    <table class="tb">
      <tr><th>Sistema</th><th>Situação observada</th></tr>
      ${(r.sistemas ?? [])
        .map((s) => `<tr><td><b>${esc(s.sistema)}</b>${s.instituicao ? ` (${esc(s.instituicao)})` : ""}</td><td>${esc(s.situacao)}</td></tr>`)
        .join("")}
    </table>
    <p class="small mt-1">Situação do PAR: ${ou(r.situacaoPAR)}. O acesso credenciado a SIMEC e Habilita é o
    primeiro passo operacional do plano de trabalho.</p>
  </div>
  ${rodape(pagina)}
</section>`;
}

/**
 * Piso salarial e a folha do magistério.
 *
 * O piso é o que mais pressiona os 70% do fundo, e 2026 mudou duas coisas que
 * quase ninguém absorveu: a fórmula de reajuste deixou de acompanhar o VAAF e
 * o art. 4º da Lei 11.738/2008 — que dava direito a complementação da União a
 * quem não tivesse caixa — foi revogado.
 *
 * A adimplência vem do SIOPE, proporcionalizada à jornada de 40h. Não existe
 * painel federal disso, então é o único lugar em que o gestor vê o próprio
 * número.
 */
function blocoPiso(i: LevantamentoTemplateInput): string {
  const r = i.payload?.relatorio_dirigido_base?.remuneracao;
  if (!r || num(r.magisterio) === 0) return "";

  const mediana = num(r.medianaMagisterio);
  const piso = num(r.piso);
  const abaixoPct = num(r.abaixoDoPisoPct);
  const razao = num(r.razaoMedianaPiso);
  // Cobertura baixa significa que o ente declara a jornada em outra unidade.
  // Exibir a mediana com ressalva não resolve: número errado com asterisco
  // continua sendo lido como número.
  const confiavel = r.confiavel !== false;

  return `
    <div class="sec-label" style="margin-top:.16in">Piso do magistério &middot; declaração de ${ou(r.ano, "—")}</div>
    <div class="grid-4">
      ${kpi("Piso nacional", `R$ ${brl(piso)}`, `jornada de ${int(r.jornadaReferencia)}h`)}
      ${kpi(
        "Mediana do magistério",
        confiavel && mediana > 0 ? `R$ ${brl(mediana)}` : "—",
        confiavel && razao > 0
          ? `${razao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}× o piso`
          : "jornada declarada em unidade não comparável",
        confiavel && razao >= 1 ? "up" : "",
      )}
      ${kpi(
        "Abaixo do piso",
        !confiavel ? "—" : abaixoPct > 0 ? pct(abaixoPct) : "nenhum",
        confiavel
          ? `${int(r.abaixoDoPiso)} de ${int(r.magisterio)} profissionais`
          : "não apurável nesta declaração",
        confiavel && abaixoPct === 0 ? "up" : "",
      )}
      ${kpi(
        "Magistério declarado",
        int(r.magisterioDeclarado),
        r.temporariosPct == null ? "profissionais" : `${pct(r.temporariosPct)} em vínculo temporário`,
      )}
    </div>
    ${
      !confiavel
        ? `<p class="micro" style="margin-top:.04in"><b>Por que a mediana não é exibida:</b> apenas
           ${int(r.magisterio)} dos ${int(r.magisterioDeclarado)} registros do magistério
           (${pct(r.cobertura)}) trazem jornada semanal em faixa comparável ao piso. O ente declara a carga
           horária em outra unidade, e proporcionalizar esses registros produziria uma cifra sem sentido.
           A conferência precisa ser feita na folha.</p>`
        : ""
    }
    <p class="micro" style="margin-top:.05in">Salários proporcionalizados à jornada de referência do piso, como
    admite o art. 2º, §3º da Lei nº 11.738/2008 &mdash; comparar um contrato de 20h com o piso cheio produziria
    descumprimento onde não há. <b>A fórmula do piso mudou em 2026:</b> a Lei nº 15.437/2026 substituiu o
    reajuste vinculado ao VAAF por INPC mais metade da média quinquenal da variação da receita do fundo, e
    <b>revogou o art. 4º</b> da Lei nº 11.738/2008 &mdash; o dispositivo que previa complementação da União ao
    ente sem disponibilidade orçamentária. Esse direito deixou de existir: o custo do piso é integralmente do
    município. Há ainda tese pendente no STF (Tema 1.218) sobre o piso ser vencimento inicial ou base de toda a
    carreira, sem decisão definitiva até esta emissão.</p>
`;
}

/**
 * Vinculações da educação, como o SIOPE as apura.
 *
 * O relatório cobria 25% de MDE e 70% de remuneração por estimativa e não
 * cobria nada das outras: 15% de capital do VAAT, o percentual da educação
 * infantil, o teto de 10% não aplicado e o piso de 20% de destinação ao fundo.
 *
 * A distinção que a página precisa fazer com clareza: **nenhuma delas bloqueia
 * o FUNDEB** — o repasse é automático (art. 21) e a busca textual da lei não
 * encontra hipótese de suspensão nem de devolução. O que elas travam é
 * convênio (via CAUC) e aprovação de contas no tribunal. Dizer "você perde o
 * FUNDEB" seria falso e é o erro mais comum do material de mercado.
 */
function paginaConformidade(i: LevantamentoTemplateInput, pagina: number): string {
  const id = i.relatorio.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const c = i.payload?.relatorio_dirigido_base?.conformidade;
  const indicadores = c?.indicadores ?? [];

  if (!c || indicadores.length === 0) {
    return `<section class="page content-page">
  ${cabecalho(municipio, "Parte IV · Vinculações da educação")}
  <div class="page-body">
    <div class="kicker">Parte IV &middot; O que precisa ser cumprido para usar o recurso</div>
    <div class="status"><span class="dot"></span> Declaração do município ao SIOPE não localizada</div>
    <p class="small mt-1">O SIOPE não devolveu indicadores para este município nos dois últimos exercícios.
    A ausência de declaração é, em si, um achado: o art. 38, §1º da Lei nº 14.113/2020 condiciona
    transferências voluntárias e operações de crédito ao registro no sistema em até 30 dias do encerramento
    de cada bimestre.</p>
  </div>
  ${rodape(pagina)}
</section>`;
  }

  const comParametro = indicadores.filter((ind) => ind.limite != null && ind.sentido);
  const descumpridas = comParametro.filter((ind) => ind.conforme === false);
  const cumpridas = comParametro.length - descumpridas.length;

  const linha = (ind: NonNullable<typeof indicadores>[number]) => {
    const temParametro = ind.limite != null && ind.sentido;
    const marca =
      ind.conforme === true ? "✓" : ind.conforme === false ? "✕" : "—";
    const cor = ind.conforme === false ? ' style="color:var(--red)"' : ind.conforme === true ? ' style="color:var(--good)"' : "";
    return `<tr>
      <td class="r"${cor}><b>${marca}</b></td>
      <td>${esc(ind.rotulo)}${ind.base ? ` <span class="micro">${esc(ind.base)}</span>` : ""}</td>
      <td class="r"><b>${pct(ind.valor, 2)}</b></td>
      <td class="r">${temParametro ? `${ind.sentido === "min" ? "mín." : "máx."} ${pct(ind.limite, 0)}` : "—"}</td>
      <td class="r"${cor}>${
        ind.folga == null ? "—" : `${num(ind.folga) < 0 ? "&minus;" : "+"}${pct(Math.abs(num(ind.folga)), 2)}`
      }</td>
    </tr>`;
  };

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte IV · Vinculações da educação")}
  <div class="page-body">
    <div class="kicker">Parte IV &middot; O que precisa ser cumprido para usar o recurso</div>

    ${
      descumpridas.length === 0
        ? `<div class="status good"><span class="dot"></span> As ${int(comParametro.length)} vinculações com
           parâmetro legal estão cumpridas na declaração de ${ou(c.ano, "—")}</div>`
        : `<div class="status bad"><span class="dot"></span> ${int(descumpridas.length)} de
           ${int(comParametro.length)} vinculações descumpridas na declaração de ${ou(c.ano, "—")}</div>`
    }
    ${
      c.defasado
        ? `<p class="micro" style="margin-top:.04in"><b>Atenção:</b> o município não consta com declaração no
           exercício de referência; os percentuais acima são de ${ou(c.ano, "—")}.</p>`
        : ""
    }

    <div class="sec-label" style="margin-top:.14in">Percentuais apurados pelo SIOPE</div>
    <table class="tb">
      <tr><th></th><th>Vinculação</th><th class="r">Apurado</th><th class="r">Parâmetro</th><th class="r">Folga</th></tr>
      ${indicadores.map(linha).join("")}
    </table>

    <div class="grid-2 mt-2">
      <div class="card">
        <h3>O que o descumprimento trava &mdash; e o que não trava</h3>
        <p class="micro"><b>Não trava o FUNDEB.</b> O art. 21 da Lei nº 14.113/2020 manda repassar o fundo
        automaticamente, nos mesmos prazos das demais transferências constitucionais. A lei não prevê
        hipótese de suspensão do repasse nem de devolução por descumprimento das vinculações.</p>
        <p class="micro" style="margin-top:.05in"><b>Trava convênio e contas.</b> As quatro vinculações da
        educação entraram no extrato do <b>CAUC</b> em 2025 (IN STN/MF nº 8/2025, art. 12, XIX a XXII), o que
        alcança convênios e contratos de repasse. E a repressão real acontece no <b>julgamento das contas</b>
        pelo tribunal, com imputação de débito e multa &mdash; fora da Lei do FUNDEB.</p>
      </div>
      <div class="card">
        <h3>Leituras que costumam sair erradas</h3>
        <p class="micro">&bull; Os <b>70%</b> são para <b>profissionais da educação básica em efetivo
        exercício</b>, não apenas para o magistério: incluem apoio técnico, administrativo e operacional.
        É piso de destinação, não teto.</p>
        <p class="micro" style="margin-top:.04in">&bull; O uso no exercício seguinte tem prazo de
        <b>quadrimestre</b>, não de trimestre, e exige abertura de crédito adicional &mdash; não é
        automático (art. 25, §3º).</p>
        <p class="micro" style="margin-top:.04in">&bull; Os <b>15%</b> de capital incidem sobre a
        complementação VAAT de cada rede (art. 27). O percentual da educação infantil é
        <b>individualizado</b> pelo IEI &mdash; os 50% do art. 28 são meta agregada nacional, não obrigação
        igual para todo município.</p>
      </div>
    </div>

    ${blocoPiso(i)}

    <p class="small mt-1">Declaração de ${ou(c.ano, "—")} ao SIOPE, 6º bimestre. O registro é obrigatório em
    até 30 dias do encerramento de cada bimestre; a omissão suspende transferências voluntárias e operações
    de crédito (art. 38, §1º) e, desde 2021, a ausência de dados no Siconfi e no SIOPE em 31 de agosto
    inabilita o município à complementação VAAT do exercício seguinte.</p>
  </div>
  ${rodape(pagina)}
</section>`;
}

/**
 * O Censo Escolar como fonte comum de dois fluxos.
 *
 * A tese da página: o Censo não define só o FUNDEB. A alimentação escolar é
 * rateada pelas mesmas matrículas, e a quota do salário-educação também. Um
 * erro de declaração custa três vezes, e a janela para corrigi-lo é curta e
 * anual — 30 dias após a publicação dos dados preliminares.
 */
function paginaProgramas(i: LevantamentoTemplateInput, pagina: number): string {
  const id = i.relatorio.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const p = i.payload?.relatorio_dirigido_base?.pnae;
  const faixas = (p?.faixas ?? []).filter((f) => num(f.matriculas) > 0);
  const anoCenso = id.exercicio - 1;

  const tabelaPnae = faixas.length
    ? `<table class="tb">
        <tr><th>Faixa do Anexo V</th><th class="r">Matrículas</th><th class="r">Por aluno/dia</th><th class="r">Estimativa anual</th></tr>
        ${faixas
          .map(
            (f) => `<tr>
              <td>${esc(f.rotulo)}</td>
              <td class="r">${int(f.matriculas)}</td>
              <td class="r">R$ ${num(f.perCapita).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="r"><b>R$ ${brl(f.valorAnual)}</b></td>
            </tr>`,
          )
          .join("")}
        <tr class="total"><td>Total estimado</td><td class="r">${int(p?.matriculasConsideradas)}</td><td class="r">&mdash;</td><td class="r">R$ ${brl(p?.valorAnual)}</td></tr>
      </table>`
    : `<p class="small">Matrículas insuficientes para estimar o repasse do PNAE.</p>`;

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte IV · O Censo como fonte comum")}
  <div class="page-body">
    <div class="kicker">Parte IV &middot; Um erro de declaração custa três vezes</div>

    <p class="small">O Censo Escolar não define apenas o FUNDEB. A <b>alimentação escolar</b> é rateada pelas
    mesmas matrículas, pela fórmula <b>VT = A &times; D &times; C</b> (Resolução CD/FNDE nº 4/2026, art. 47),
    com 200 dias letivos. A <b>quota do salário-educação</b> é redistribuída "proporcionalmente ao número de
    alunos matriculados na educação básica &hellip; conforme o censo escolar" (Decreto nº 6.003/2006, art. 9º,
    §1º), em crédito mensal e automático. Corrigir o cadastro melhora os três fluxos de uma vez.</p>

    ${
      p
        ? `<div class="grid-3 mt-1">
             ${kpi("PNAE estimado", brlCompact(p.valorAnual), `${int(p.matriculasConsideradas)} estudantes &middot; 200 dias`, "up")}
             ${kpi(
               "Por aluno/ano",
               num(p.matriculasConsideradas) > 0 ? `R$ ${brl(num(p.valorAnual) / num(p.matriculasConsideradas))}` : "—",
               "média ponderada das faixas",
             )}
             ${kpi("Faixas aplicadas", int(faixas.length), "modalidades do Anexo V presentes na rede")}
           </div>

           <div class="sec-label" style="margin-top:.14in">Alimentação escolar por faixa &middot; estimativa</div>
           ${tabelaPnae}
           <p class="micro" style="margin-top:.04in">Estimativa sobre as matrículas da filtragem do FUNDEB, não o
           valor empenhado: o FNDE reparte por entidade executora, admite delegação de rede entre entes e usa o
           Censo do ano anterior. Serve para comparar com o que foi de fato recebido.</p>`
        : `<div class="status mt-1"><span class="dot"></span> Estimativa do PNAE indisponível para este município</div>`
    }

    <div class="sec-label" style="margin-top:.16in">O calendário que decide o FUNDEB de ${id.exercicio + 1}</div>
    <table class="tb">
      <tr><th>Etapa</th><th>Prazo</th><th>Responsável</th></tr>
      <tr><td>Data de referência do Censo</td><td>última quarta-feira de maio</td><td>&mdash;</td></tr>
      <tr><td>Coleta e digitação no Educacenso</td><td>de maio a 31 de julho</td><td>Diretor e gestores</td></tr>
      <tr><td>Publicação dos dados preliminares no DOU</td><td>agosto</td><td>INEP</td></tr>
      <tr><td><b>Conferência, ratificação e retificação</b></td><td><b>30 dias da publicação</b></td><td>Diretor e gestor municipal</td></tr>
      <tr><td>Verificação dos dados processados</td><td>5 dias após</td><td>Gestor municipal</td></tr>
      <tr><td><b>Confirmação de matrículas duplicadas</b></td><td>10 dias, janela própria</td><td>Diretor e gestores</td></tr>
      <tr><td>Envio ao FNDE para cálculo dos coeficientes</td><td>dezembro</td><td>INEP</td></tr>
    </table>

    <div class="grid-2 mt-2">
      <div class="card">
        <h3>Por que o prazo é o produto</h3>
        <p class="micro">O art. 8º, §5º da Lei nº 14.113/2020, na redação da Lei nº 14.276/2021, deixou de
        dizer que os entes <i>poderão</i> apresentar recursos: agora é <b>dever</b>, "sob pena de
        responsabilização administrativa". E o §7º fecha a porta: <b>"fica vedada a alteração nos dados após
        realizada a publicação final"</b>.</p>
        <p class="micro" style="margin-top:.04in">A janela de <b>confirmação de matrículas duplicadas</b> é a
        etapa em que o município disputa o aluno contado em outra rede. É posterior aos 30 dias de retificação
        e costuma passar em branco.</p>
      </div>
      <div class="card">
        <h3>Quem deveria estar olhando</h3>
        <p class="micro">O art. 33, §2º, II atribui ao <b>CACS</b> o dever de "supervisionar o censo escolar
        anual &hellip; com o objetivo de concorrer para o regular e tempestivo tratamento e encaminhamento dos
        dados estatísticos e financeiros que alicerçam a operacionalização dos Fundos".</p>
        <p class="micro" style="margin-top:.04in">Conselho parado significa ninguém supervisionando o Censo &mdash;
        e erro cadastral que passa vira coeficiente do exercício seguinte, com o repasse já calculado sobre ele.</p>
      </div>
    </div>

    <p class="small mt-1">O Censo de ${anoCenso} define o FUNDEB de ${id.exercicio}; o de ${id.exercicio}
    definirá o de ${id.exercicio + 1}. A preclusão do §7º é, na prática, superável por portaria específica do
    MEC com recálculo pelo FNDE, mas os casos documentados são pontuais e vários exigiram via judicial &mdash;
    é recuperação excepcional, não rotina de gestão.</p>
  </div>
  ${rodape(pagina)}
</section>`;
}

/**
 * O que trava o quê.
 *
 * O achado estrutural da auditoria: **nenhuma pendência administrativa
 * suspende o FUNDEB**. A palavra "suspens" aparece duas vezes em toda a Lei
 * 14.113/2020 — no art. 14 (VAAR) e no art. 38, §1º — e nenhuma delas alcança
 * o repasse do fundo. O que trava são os programas complementares e os
 * convênios. Confundir os dois é o erro mais caro do material de mercado,
 * porque destrói a credibilidade do resto do diagnóstico.
 */
function paginaGovernanca(i: LevantamentoTemplateInput, pagina: number): string {
  const id = i.relatorio.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const ponderacao = i.payload?.relatorio_dirigido_base?.ponderacao;
  const equidade = i.payload?.relatorio_dirigido_base?.equidade;

  const conveniadas = (ponderacao?.segmentos ?? [])
    .filter((s) => /Conveniada/i.test(s.nome ?? ""))
    .reduce((total, s) => total + num(s.matriculas), 0);

  const escolasCampo = num(equidade?.escolas?.municipaisRurais);

  return `<section class="page content-page">
  ${cabecalho(municipio, "Parte IV · Governança e bloqueios")}
  <div class="page-body">
    <div class="kicker">Parte IV &middot; O que trava o quê</div>

    <div class="insight">
      <h3>O FUNDEB não é bloqueado por pendência administrativa</h3>
      <p style="font-size:8.2pt;line-height:1.42">O art. 21 da Lei nº 14.113/2020 manda repassar o fundo
      automaticamente, "observados os mesmos prazos, procedimentos e forma de divulgação adotados para o
      repasse do restante dessas <b>transferências constitucionais</b>". A LRF exclui expressamente as
      transferências de educação, saúde e assistência do conceito de transferência voluntária (art. 25, §3º),
      e por isso o <b>CAUC não alcança o FUNDEB</b>. A exposição real é outra: a habilitação ao VAAT, que não
      bloqueia repasse &mdash; impede que a complementação seja apurada.</p>
    </div>

    <div class="sec-label" style="margin-top:.14in">O que cada pendência efetivamente trava</div>
    <table class="tb">
      <tr><th>Pendência</th><th>Base</th><th>Recurso travado</th><th class="r">FUNDEB?</th></tr>
      <tr><td>SIOPE sem registro após 30 dias do bimestre</td><td>art. 38, §1º</td><td>Transferências voluntárias e operações de crédito</td><td class="r">não</td></tr>
      <tr><td>Dados ausentes no Siconfi/SIOPE em 31 de agosto</td><td>art. 13, §§4º e 5º</td><td><b>Inabilita à complementação VAAT</b></td><td class="r">&mdash;</td></tr>
      <tr><td>DCA fora do prazo</td><td>LRF art. 51, §2º</td><td>Voluntárias e operações de crédito</td><td class="r">não</td></tr>
      <tr><td>CACS não cadastrado no SisCACS</td><td>Port. FNDE 808/2022</td><td>PNATE, PEJA e PAR</td><td class="r">não</td></tr>
      <tr><td>CAE não constituído ou mandato vencido</td><td>Res. CD/FNDE 4/2026, art. 56</td><td>PNAE</td><td class="r">não</td></tr>
      <tr><td>Prestação de contas do PDDE omissa ou rejeitada</td><td>Res. CD/FNDE 15/2021, art. 39</td><td>PDDE e ações integradas</td><td class="r">não</td></tr>
      <tr><td>Salário-educação</td><td>&mdash;</td><td>Nenhuma condicionalidade localizada</td><td class="r">não</td></tr>
    </table>
    <p class="micro" style="margin-top:.04in">PNATE e PDDE têm janela de recuperação: parcelas retidas no
    exercício voltam a ser liberadas se a regularização ocorrer até 31 de outubro.</p>

    <div class="grid-2 mt-2">
      <div class="card">
        <h3>Conselhos: prazo e composição</h3>
        <p class="micro">O <b>SisCACS</b> é cadastro do conselho; o <b>SIGECON</b> é onde o presidente emite o
        parecer conclusivo sobre a prestação de contas. São sistemas distintos e confundi-los é comum.</p>
        <p class="micro" style="margin-top:.04in">A Lei nº 14.113/2020, art. 34, §5º, II <b>veda a
        participação no CACS de funcionário de empresa de assessoria ou consultoria</b> que preste serviços
        relacionados ao controle interno dos recursos do Fundo, e de cônjuges e parentes até 3º grau dos
        demais membros. É restrição a observar no desenho de qualquer contrato de assessoria.</p>
      </div>
      <div class="card">
        <h3>Educação do campo &mdash; a regra dos 50%</h3>
        <p class="micro">${
          escolasCampo > 0
            ? `A rede declara <b>${int(escolasCampo)}</b> escolas municipais no campo, que ponderam 15% acima da
               matrícula urbana comum.`
            : "A rede não declara escolas municipais em localização rural no Censo."
        }</p>
        <p class="micro" style="margin-top:.04in">A planilha oficial do FNDE acrescenta uma captura pouco
        usada: também é considerada educação no campo a oferta por <b>escolas de localização urbana que
        atendam 50% ou mais de alunos de residência rural</b> &mdash; incluídos assentamentos e territórios de
        povos e comunidades tradicionais. Vale conferir escola a escola: a condição existe no dado de
        residência do aluno, não na classificação da escola.</p>
      </div>
    </div>

    ${
      conveniadas > 0
        ? `<div class="note mt-2">
             <p style="font-size:7.9pt;line-height:1.4"><b>Conveniadas:</b> a rede computa
             <b>${int(conveniadas)}</b> matrículas em instituições conveniadas. O art. 7º, §4º exige cinco
             requisitos cumulativos (gratuidade e igualdade de acesso, finalidade não lucrativa comprovada,
             destinação do patrimônio, padrões mínimos com projeto pedagógico aprovado e CEBAS) e o §7º é o
             ponto decisivo: eles "deverão ser comprovados pelas instituições convenentes e <b>conferidos e
             validados pelo Poder Executivo do respectivo ente</b>, em momento <b>anterior</b> à formalização
             do convênio e ao repasse". O FNDE não audita isso na filtragem &mdash; computa o que o Censo
             declara. Convênio irregular vira passivo do município no tribunal, com o recurso já gasto.</p>
           </div>`
        : ""
    }

    <p class="small mt-1">A repressão ao descumprimento não está na Lei do FUNDEB: a palavra "glosa" não
    aparece no texto e não há dispositivo de devolução ao FNDE. Ela opera no <b>julgamento das contas</b>
    pelo tribunal, com imputação de débito e multa pelas leis orgânicas, e pelas vias de improbidade e
    Ministério Público.</p>
  </div>
  ${rodape(pagina)}
</section>`;
}

function paginaCenario(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const etapa = r.censoEscolar?.matriculasEtapa;
  const edu = (i.payload?.educacao ?? {}) as Record<string, unknown>;
  const rede = redeMunicipal(i);
  const matriculas = rede.matriculas;
  const recursoAluno = rede.recursoAluno;

  /**
   * O cenário vem do motor (`cenarioEstruturacao`), não deste template.
   *
   * A versão anterior multiplicava a base por fatores fixos — EJA × 7,4,
   * tempo integral × 5,1 — aplicados a qualquer município. Em Canindé de São
   * Francisco isso projetava 6.237 matrículas em jornada integral, 90% de toda
   * a rede municipal em um ano, e uma faixa de receita 3,4× maior que a
   * calculada pelo backend. Número irreal em proposta comercial custa a
   * credibilidade do documento inteiro.
   */
  const cenario = i.payload?.relatorio_dirigido_base?.cenarioEstruturacao;
  const baseAtual = cenario?.baseAtual ?? {};
  const metas = cenario?.metas ?? {};
  const ganhos = cenario?.ganhosMatriculas ?? {};

  const frentes = [
    { nome: "EJA", chave: "eja" },
    { nome: "Tempo integral", chave: "integral" },
    { nome: "Educação especial", chave: "educacaoEspecial" },
  ].map((f) => {
    const base = num(baseAtual[f.chave]);
    const meta = num(metas[f.chave]);
    return { ...f, base, meta, ganho: num(ganhos[f.chave]) || Math.max(0, meta - base) };
  });

  const temCenario = frentes.some((f) => f.meta > 0);
  const totalBase = frentes.reduce((s, f) => s + f.base, 0);
  const totalMeta = frentes.reduce((s, f) => s + f.meta, 0);
  const totalGanho = num(ganhos.total) || frentes.reduce((s, f) => s + f.ganho, 0);

  const impacto = cenario?.impactoFinanceiroIndicativo;
  const faixaBaixa = num(impacto?.minimo);
  const faixaAlta = num(impacto?.maximo);
  const basePorMatricula = num(impacto?.basePorMatricula) || recursoAluno;

  return `<section class="page content-page">
  ${cabecalho(municipio, `Parte V · Cenário ${id.exercicio + 1}`)}
  <div class="page-body">
    <div class="kicker">Parte V &middot; Cenário de estruturação ${id.exercicio + 1}</div>
    <h2>Onde a rede pode crescer<br>&mdash; e quanto isso vale</h2>

    <div class="mt-2">
      <table class="tb">
        <tr><th>Modalidade</th><th class="r">Base atual</th><th class="r">Meta ${id.exercicio + 1}</th><th class="r">Ganho de matrículas</th></tr>
        ${frentes
          .map(
            (f) => `<tr><td>${f.nome}</td><td class="r">${int(f.base)}</td><td class="r">${int(f.meta)}</td><td class="r"><b>+${int(f.ganho)}</b></td></tr>`,
          )
          .join("")}
        <tr class="total"><td>Total</td><td class="r">${int(totalBase)}</td><td class="r">${int(totalMeta)}</td><td class="r">+${int(totalGanho)}</td></tr>
      </table>
    </div>

    <div class="card mt-1">
      <h3>Ganho de matrículas por frente</h3>
      ${barras(frentes.map((f) => ({ nome: f.nome, valor: f.ganho, rotulo: `+${int(f.ganho)}` })))}
    </div>

    <div class="kpi hero mt-2"><em>Faixa indicativa de receita adicional &middot; se a reestruturação for bem executada</em>
      <b>${temCenario && faixaAlta > 0 ? `${brlCompact(faixaBaixa)} &ndash; ${brlCompact(faixaAlta)}` : "—"}</b>
      <span>${
        temCenario && faixaAlta > 0
          ? `${int(totalGanho)} matrículas &times; R$ ${brl(basePorMatricula)} por matrícula, monetizadas entre 40% e 60% no exercício
             &middot; caráter estimativo, sujeito a validação documental`
          : "Cenário não calculado para este município — as bases do Censo não permitiram projetar as frentes."
      }</span>
    </div>

    <p class="micro mt-1">Esta faixa mede só o efeito de <b>mais matrícula</b> na rede. Ela não se soma nem
    substitui a estimativa da Parte I, que projeta o efeito de <b>correção das complementações</b> da União
    (VAAT e VAAR): são dois mecanismos distintos sobre a mesma receita, e cada um tem sua própria validação.</p>

    <div class="sec-label">Frentes de atuação</div>
    <div class="grid-2">
      <div class="card">
        <p style="font-size:8.2pt;line-height:1.45;color:#33454f">
        <span class="strong">1. EJA:</span> busca ativa e reorganização da oferta com apoio territorial.<br>
        <span class="strong">2. Jornada ampliada:</span> expansão de tempo integral e oficinas nas escolas com capacidade de absorção.</p>
      </div>
      <div class="card">
        <p style="font-size:8.2pt;line-height:1.45;color:#33454f">
        <span class="strong">3. Educação especial:</span> qualificação cadastral e pedagógica para permanência.<br>
        <span class="strong">4. Consultoria Global Company:</span> monitoramento do Censo, sistemas FNDE e consistência da base.</p>
      </div>
    </div>
  </div>
  ${rodape(pagina)}
</section>`;
}

function paginaCaderno(i: LevantamentoTemplateInput, pagina: number): string {
  const r = i.relatorio;
  const id = r.identificacao;
  const municipio = `${id.municipioNome} — ${id.uf}`;
  const responsavel = r.parametros?.responsavelTecnico ?? "Adriel Tavares";

  const fontes = (i.payload?.fontes_utilizadas ?? [])
    .map((f) => (typeof f === "string" ? f : (f as Record<string, unknown>)?.label ?? (f as Record<string, unknown>)?.nome))
    .filter((f): f is string => typeof f === "string" && f.length > 0);

  const pares: Array<[string, string | null]> = [];
  for (let k = 0; k < fontes.length; k += 2) {
    pares.push([fontes[k], fontes[k + 1] ?? null]);
  }

  const observacoes = r.observacoesOperacionais ?? [];

  return `<section class="page content-page">
  ${cabecalho(municipio, "Caderno técnico")}
  <div class="page-body">
    <div class="kicker">Caderno técnico &middot; Recomendações e rastreabilidade</div>

    <div class="grid-2">
      <div class="card">
        <h3>Recomendações técnicas</h3>
        <p style="font-size:8pt;line-height:1.45;color:#33454f">
        &bull; Validar a base de cálculo do ICMS e a aplicação do percentual mínimo de 28% com assessoria jurídico-tributária.<br>
        &bull; Conferir documentalmente as bases que determinam a captura de VAAF, VAAT e VAAR junto ao FNDE.<br>
        &bull; Verificar atos normativos locais de EJA, tempo integral e parcerias intersetoriais com impacto no Censo Escolar.</p>
      </div>
      <div class="card">
        <h3>Próximos passos</h3>
        <p style="font-size:8pt;line-height:1.45;color:#33454f">
        <span class="strong">1.</span> Validar receitas atuais do FUNDEB nas bases oficiais.<br>
        <span class="strong">2.</span> Levantar status credenciado dos sistemas MEC/FNDE (SIMEC, Habilita).<br>
        <span class="strong">3.</span> Conferir base do Censo Escolar e indicadores da rede, escola a escola.</p>
      </div>
    </div>

    ${
      observacoes.length
        ? `<div class="sec-label">Observações operacionais da coleta</div>
    <div class="card"><p style="font-size:7.9pt;line-height:1.42;color:#33454f">${observacoes
      .map((o) => `&bull; ${esc(o)}`)
      .join("<br>")}</p></div>`
        : ""
    }

    <div class="note mt-1">
      <p style="font-size:7.9pt;line-height:1.4"><span class="strong" style="color:#584416">Alerta técnico:</span>
      os valores projetados têm caráter estimativo e dependem de validação documental nas bases
      oficiais do FUNDEB e dos sistemas MEC/FNDE. Este relatório é confidencial e destinado exclusivamente
      ao destinatário.</p>
    </div>

    ${
      pares.length
        ? `<div class="sec-label">Mapa de fontes &mdash; rastreabilidade automática do Global Sync</div>
    <table class="tb">
      <tr><th>Fonte</th><th>Status</th><th>Fonte</th><th>Status</th></tr>
      ${pares
        .map(
          ([a, b]) =>
            `<tr><td>${esc(a)}</td><td>Automático</td><td>${b ? esc(b) : ""}</td><td>${b ? "Automático" : ""}</td></tr>`,
        )
        .join("")}
    </table>
    <p class="small mt-1">A camada de rastreabilidade mostra o que entrou automaticamente, o que depende de estimativa
    e o que exige confirmação manual &mdash; ela explica a confiança operacional do relatório
    antes da emissão final.</p>`
        : ""
    }

    <div style="margin-top:.34in">
      <div style="width:3.1in">
        <hr style="border:none;border-top:1px solid #94a5b0;margin:0 0 .07in">
        <div style="color:var(--navy);font-size:9.6pt;font-weight:800">${esc(responsavel)}</div>
        <div class="small">Responsável Técnico &middot; Global Company Consultorias</div>
      </div>
    </div>
  </div>
  ${rodape(pagina, ` &middot; Emitido em ${dataCurta(r.geradoEm)}`)}
</section>`;
}

// ── Montagem ────────────────────────────────────────────────────────────────

export function generateLevantamentoHtml(input: LevantamentoTemplateInput): string {
  const id = input.relatorio.identificacao;

  const paginas = [
    paginaCapa,
    paginaSumario,
    paginaReceita,
    paginaProjecao,
    paginaVaar,
    paginaSerie,
    paginaRede,
    paginaPonderacao,
    paginaIdeb,
    paginaFiscal,
    paginaConformidade,
    paginaProgramas,
    paginaGovernanca,
    paginaCenario,
    paginaCaderno,
  ].map((fn, indice) => fn(input, indice + 1));

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Levantamento FUNDEB &mdash; ${esc(id.municipioNome)}/${esc(id.uf)} | Global Sync</title>
<style>${CSS}</style></head><body>
${paginas.join("\n\n")}
</body></html>`;
}
