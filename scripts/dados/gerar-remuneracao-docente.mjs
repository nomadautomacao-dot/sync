#!/usr/bin/env node
/**
 * Gera `data/fnde/remuneracao-docente.json` — remuneração do magistério e
 * adimplência ao piso nacional, por município.
 *
 * ## Por que este dataset existe
 *
 * O Piso Salarial Profissional Nacional é o principal vetor de pressão sobre
 * os 70% do FUNDEB, e **não existe painel federal de adimplência**. Há
 * painéis estaduais isolados (o Suricato, do TCE-MG, é o mais conhecido), mas
 * nada que permita dizer, para um município qualquer, quanto ele paga e
 * quantos profissionais estão abaixo do piso.
 *
 * O levantamento de fontes concluiu que isso só sairia da RAIS via BigQuery —
 * 478 GB, cobrança por bytes lidos, e um ano de defasagem. Sai daqui: o SIOPE
 * publica remuneração individual na API OData aberta, com carga horária, o que
 * permite proporcionalizar ao piso e agregar por município.
 *
 * ## Privacidade
 *
 * A fonte devolve **nome do servidor, escola e salário individual**. É dado
 * público de transparência, mas não há razão para replicá-lo: o dataset
 * guarda apenas agregados municipais — contagem, mediana, média e proporção
 * abaixo do piso. Nenhum nome, nenhuma escola, nenhum registro individual é
 * persistido.
 *
 * ## Uso
 *
 *     npm run dados:remuneracao
 *
 * A varredura das 27 UFs baixa algumas centenas de MB e leva dezenas de
 * minutos. Regerar anualmente, após o fechamento do 6º período.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const BASE = "https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata";

const ANO = 2025;
const PERIODO = 6;
/** Dezembro: mês com folha fechada e menor incidência de admissão parcial. */
const MES = 12;

/**
 * Piso Salarial Profissional Nacional para jornada de 40h, por exercício.
 * 2026: Portaria MEC nº 82, de 29/01/2026 (DOU 30/01/2026), conferida no
 * texto publicado. 2025: Portaria MEC nº 77/2025. 2024: Portaria MEC nº 61/2024.
 */
const PISO_POR_ANO = { 2024: 4580.57, 2025: 4867.77, 2026: 5130.63 };

/** Jornada de referência do piso (Lei 11.738/2008, art. 2º). */
const JORNADA_REFERENCIA = 40;

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const DESTINO = join(process.cwd(), "data", "fnde", "remuneracao-docente.json");

/**
 * Faixa de jornada semanal em que a declaração é inequívoca.
 *
 * Vários entes não declaram a carga em horas semanais. A Paraíba é o caso
 * mais visível: numa amostra de 400 registros, 101 vêm com `"7"` e 22 com
 * `"2"` — jornadas diárias, ou outra unidade. Proporcionalizar `salário × 40 /
 * 2` transforma um salário comum em R$ 100 mil, e foi exatamente isso que
 * produziu medianas municipais de meio milhão na primeira geração.
 *
 * Não há como distinguir um contrato legítimo de 7h semanais de uma unidade
 * trocada. A saída honesta é restringir a estatística à faixa em que a leitura
 * não é ambígua — 20h a 44h cobre a quase totalidade dos contratos reais do
 * magistério — e **declarar a cobertura**, para que o relatório saiba dizer
 * sobre quantos profissionais a mediana foi calculada.
 */
const JORNADA_MINIMA = 20;
const JORNADA_MAXIMA = 44;

/**
 * Salário mensal, já proporcionalizado, fora desta faixa é resíduo de
 * admissão ou rescisão parcial, valor anual declarado no lugar do mensal, ou
 * erro de digitação. Abaixo do mínimo nacional de 2025 (R$ 1.518) ninguém é
 * contratado em jornada de 20h ou mais.
 */
const SALARIO_MINIMO_PLAUSIVEL = 1518;
const SALARIO_MAXIMO_PLAUSIVEL = 60_000;

/**
 * Cobertura mínima para a mediana ser publicável. Abaixo disso o número
 * descreve o subconjunto que sobrou, não a rede — e o relatório precisa
 * dizer isso em vez de exibir uma cifra.
 */
const COBERTURA_MINIMA = 60;
const REGISTROS_MINIMOS = 5;

function log(mensagem) {
  console.log(`[remuneracao] ${mensagem}`);
}

async function consultarUf(uf) {
  const url =
    `${BASE}/Remuneracao_Siope(Ano_Declaracao=@a,Num_Peri=@p,Mes_Exercicio=@m,Sig_UF=@u)` +
    `?@a=${ANO}&@p=${PERIODO}&@m=${MES}&@u='${uf}'&$format=json`;

  const resposta = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Sync/1.0" },
    signal: AbortSignal.timeout(900_000),
  });

  if (!resposta.ok) throw new Error(`SIOPE respondeu HTTP ${resposta.status} para ${uf}`);

  const texto = await resposta.text();
  return { registros: JSON.parse(texto).value ?? [], bytes: texto.length };
}

function mediana(valores) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const valor =
    ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
  return Math.round(valor * 100) / 100;
}

/**
 * Salário proporcionalizado à jornada de 40h. O piso é fixado para essa
 * jornada e o art. 2º, §3º da Lei 11.738/2008 admite o pagamento proporcional
 * para as demais — comparar um salário de 20h com o piso cheio produziria
 * descumprimento onde não há.
 */
function normalizar(salario, cargaHoraria) {
  const carga = Number.parseFloat(cargaHoraria);
  if (!Number.isFinite(carga) || carga < JORNADA_MINIMA || carga > JORNADA_MAXIMA) return null;

  const normalizado = (salario * JORNADA_REFERENCIA) / carga;
  if (normalizado < SALARIO_MINIMO_PLAUSIVEL || normalizado > SALARIO_MAXIMO_PLAUSIVEL) return null;

  return normalizado;
}

function agregar(registros, destino) {
  const porMunicipio = new Map();
  let descartados = 0;

  for (const registro of registros) {
    if (!registro.COD_MUNI) continue;

    const codigo = String(registro.COD_MUNI);
    let ente = porMunicipio.get(codigo);
    if (!ente) {
      ente = {
        uf: registro.SIG_UF ?? "",
        nome: registro.NOM_MUNI ?? "",
        magisterio: [],
        docentes: [],
        efetivos: 0,
        temporarios: 0,
        outrosProfissionais: 0,
        magisterioDeclarado: 0,
      };
      porMunicipio.set(codigo, ente);
    }

    const ehMagisterio = registro.TP_CATEGORIA === "Profissionais do magistério";
    // Contado antes de qualquer filtro: é o denominador da cobertura, e sem
    // ele não dá para saber se a mediana descreve a rede ou uma sobra dela.
    if (ehMagisterio) ente.magisterioDeclarado += 1;

    const salario = Number.parseFloat(registro.VL_SALARIO);
    const normalizado = Number.isFinite(salario) && salario > 0
      ? normalizar(salario, registro.NU_CARGA_HORARIA)
      : null;

    if (normalizado === null) {
      descartados += 1;
      continue;
    }

    if (ehMagisterio) {
      ente.magisterio.push(normalizado);
      // "Docente ..." separa quem está em regência de quem exerce direção ou
      // coordenação — ambos são magistério, mas a remuneração docente é a
      // pergunta que o relatório responde.
      if (/^Docente/i.test(registro.NO_CATEGORIA_PROFISSIONAL ?? "")) {
        ente.docentes.push(normalizado);
      }
      if (registro.DS_SITUACAO_PROFISSIONAL === "Efetivo") ente.efetivos += 1;
      else if (registro.DS_SITUACAO_PROFISSIONAL === "Temporário") ente.temporarios += 1;
    } else {
      ente.outrosProfissionais += 1;
    }
  }

  const piso = PISO_POR_ANO[ANO];

  for (const [codigo, ente] of porMunicipio) {
    if (ente.magisterio.length === 0) continue;

    const abaixoDoPiso = ente.magisterio.filter((s) => s < piso).length;
    const cobertura =
      ente.magisterioDeclarado > 0
        ? Math.round((ente.magisterio.length / ente.magisterioDeclarado) * 10000) / 100
        : 0;

    destino[codigo] = {
      uf: ente.uf,
      nome: ente.nome,
      /** Profissionais do magistério declarados, antes dos filtros. */
      magisterioDeclarado: ente.magisterioDeclarado,
      /** Subconjunto com jornada e salário em faixa inequívoca. */
      magisterio: ente.magisterio.length,
      docentes: ente.docentes.length,
      efetivos: ente.efetivos,
      temporarios: ente.temporarios,
      outros: ente.outrosProfissionais,
      cobertura,
      /**
       * Cobertura baixa não invalida o dado — indica que a declaração do ente
       * usa outra unidade de jornada ou tem muito registro parcial. O leitor
       * usa isto para omitir a cifra em vez de exibir um número que descreve
       * a sobra e não a rede.
       */
      confiavel: cobertura >= COBERTURA_MINIMA && ente.magisterio.length >= REGISTROS_MINIMOS,
      medianaMagisterio: mediana(ente.magisterio),
      medianaDocentes: mediana(ente.docentes),
      abaixoDoPiso,
      abaixoDoPisoPct: Math.round((abaixoDoPiso / ente.magisterio.length) * 10000) / 100,
    };
  }

  return { municipios: porMunicipio.size, descartados };
}

async function main() {
  const municipios = {};
  let bytesTotal = 0;
  let descartadosTotal = 0;

  for (const uf of UFS) {
    const inicio = Date.now();
    const { registros, bytes } = await consultarUf(uf);
    const { municipios: quantos, descartados } = agregar(registros, municipios);
    bytesTotal += bytes;
    descartadosTotal += descartados;
    log(
      `${uf}: ${(bytes / 1024 / 1024).toFixed(0)} MB, ${registros.length.toLocaleString("pt-BR")} registros, ` +
        `${quantos} municípios, ${descartados} descartados, ${((Date.now() - inicio) / 1000).toFixed(0)}s`,
    );
  }

  const total = Object.keys(municipios).length;
  if (total === 0) throw new Error("Nenhum município agregado — o formato da API mudou.");

  const conteudo = {
    _comentario:
      "Gerado por scripts/dados/gerar-remuneracao-docente.mjs. Não editar à mão. Regerar com: npm run dados:remuneracao",
    fonte: "FNDE — SIOPE, API OData de dados abertos (Remuneracao_Siope), agregado por município",
    aviso:
      "A fonte publica registros individuais com nome e escola. Este arquivo guarda apenas agregados municipais; nenhum dado pessoal é persistido.",
    anoReferencia: ANO,
    mesReferencia: MES,
    pisoNacional: PISO_POR_ANO[ANO],
    pisoPorAno: PISO_POR_ANO,
    jornadaReferencia: JORNADA_REFERENCIA,
    geradoEm: new Date().toISOString(),
    municipios,
  };

  mkdirSync(dirname(DESTINO), { recursive: true });
  const json = JSON.stringify(conteudo);
  writeFileSync(DESTINO, json, "utf8");

  const confiaveis = Object.values(municipios).filter((m) => m.confiavel);
  const abaixo = confiaveis.filter((m) => m.abaixoDoPisoPct > 50).length;
  log(
    `escrito ${DESTINO} — ${(json.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${total.toLocaleString("pt-BR")} municípios, ${(bytesTotal / 1024 / 1024).toFixed(0)} MB lidos, ` +
      `${descartadosTotal.toLocaleString("pt-BR")} registros descartados`,
  );
  log(
    `${confiaveis.length.toLocaleString("pt-BR")} municípios com cobertura suficiente; ` +
      `${abaixo.toLocaleString("pt-BR")} deles com mais da metade do magistério abaixo do piso`,
  );
}

main().catch((erro) => {
  console.error(`[remuneracao] falhou: ${erro.message}`);
  process.exit(1);
});
