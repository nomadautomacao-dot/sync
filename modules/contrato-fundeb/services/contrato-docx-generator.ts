import fs from "fs";
import path from "path";
import JSZip from "jszip";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { ContratosFundebData } from "../types";
import { estadoBySigla } from "./contrato-fundeb-service";
import { collectDefaults } from "./collectors/defaults-collector";
import { collectComputedFields } from "./collectors/computed-collector";
import { contratosAssetsDir, templatesDeContrato } from "@/core/lib/assets-paths";
import {
  camposDaVia,
  type ViaDeContratacao,
} from "@/core/domain/contratacao-direta";

/**
 * Interface representando o arquivo mapeado de template em formato DOCX
 */
interface TemplateConfig {
  filename: string;
  docIndex: string;
  outputName: string;
}

const TEMPLATES_MAP: TemplateConfig[] = [
  // Proposta removida do Kit ZIP — gerada separadamente para assinatura
  { filename: "01 - CAPA DO PROCESSO.docx", docIndex: "01", outputName: "01 - Capa do Processo" },
  { filename: "02.1 DFD Administração.docx", docIndex: "02.1", outputName: "02.1 - Documento de Formalização da Demanda (DFD)" },
  { filename: "02.2 ETP.docx", docIndex: "02.2", outputName: "02.2 - Estudo Técnico Preliminar (ETP)" },
  { filename: "02.3 TR.docx", docIndex: "02.3", outputName: "02.3 - Termo de Referência (TR)" },
  { filename: "02.4 - PROCESSO ADMINISTRATIVO.docx", docIndex: "02.4", outputName: "02.4 - Memorando de Processo Administrativo" },
  { filename: "02.5 - JUSTIFICATIVA DA ESCOLHA DO FORNECEDOR.docx", docIndex: "02.5", outputName: "02.5 - Justificativa da Escolha do Fornecedor" },
  { filename: "03 - Solicitação Dotacao.docx", docIndex: "03", outputName: "03 - Solicitação de Reserva de Dotação" },
  { filename: "04 - Resposta Dotacao.docx", docIndex: "04", outputName: "04 - Certidão de Resposta de Dotação" },
  { filename: "05 - Enc. PA  Prefeito.docx", docIndex: "05", outputName: "05 - Encaminhamento do PA ao Prefeito" },
  // Nomes neutros desde 2026-08-14: os templates da era Rocha Prime traziam
  // ano e marca no nome do arquivo, e cada virada de exercício quebrava o mapa.
  { filename: "06 - PARECER.docx", docIndex: "06", outputName: "06 - Parecer da Comissão de Contratação (CPL)" },
  { filename: "07 - Parecer Juridico.docx", docIndex: "07", outputName: "07 - Parecer Jurídico da {VIA}" },
  { filename: "08 - Ratificacao.docx", docIndex: "08", outputName: "08 - Despacho de Ratificação de {VIA}" },
  { filename: "09 - Homologação.docx", docIndex: "09", outputName: "09 - Termo de Homologação e Adjudicação" },
  { filename: "10 - MINUTA - CONTRATO ASSESSORIA.docx", docIndex: "10", outputName: "10 - Minuta do Contrato de Assessoria" },
];

/** Template da Proposta Técnica — gerada separadamente para assinatura */
const PROPOSTA_TEMPLATE: TemplateConfig = {
  filename: "00 - PROPOSTA TECNICA COMERCIAL.docx",
  docIndex: "00",
  outputName: "Proposta Técnica e Comercial",
};

/**
 * "001/2026" → "001".
 *
 * Os coletores devolvem o número já com o ano, e os templates escrevem
 * "{numero}/{exercicio}" — juntos, produziam "Nº 001/2026/2026" na capa do
 * processo. Quem numera é o setor de licitação da prefeitura, e um número
 * malformado na capa é a primeira coisa que ele vê.
 */
/**
 * O número de meses por extenso. A tabela cobria só 6, 7, 8 e 12 — um contrato
 * de 5 meses saía como "5 (5) meses" no papel. Fora da tabela devolve o
 * próprio número, que é feio mas nunca errado.
 */
export function mesesPorExtenso(meses: unknown): string {
  const nomes: Record<number, string> = {
    1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco", 6: "seis",
    7: "sete", 8: "oito", 9: "nove", 10: "dez", 11: "onze", 12: "doze",
    18: "dezoito", 24: "vinte e quatro", 30: "trinta", 36: "trinta e seis",
    48: "quarenta e oito", 60: "sessenta",
  };
  const n = Number(meses);
  return nomes[n] ?? String(meses ?? "");
}

export function numeroSemAno(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  return texto.replace(/\s*\/\s*\d{2,4}\s*$/, "");
}

/**
 * O que vai no papel no lugar do campo que nenhuma fonte soube preencher.
 *
 * Maiúsculo e sem acento de propósito: quem recebe o kit precisa **achar** as
 * lacunas, e um `Ctrl+F` por "A INFORMAR" percorre as 14 peças. A alternativa
 * óbvia — deixar em branco — produz um contrato que parece pronto e chega ao
 * protocolo com o CNPJ do fundo faltando no meio de um parágrafo.
 *
 * A alternativa oposta, abortar a geração, foi o comportamento até
 * 2026-08-20 e é o que este marcador substitui: dado público de prefeitura
 * pequena falta o tempo todo (CPF e RG do prefeito não estão em lugar nenhum
 * consultável), e um kit que só sai quando as 61 informações existem é um kit
 * que não sai. Peça faltando continua abortando — isso é outra coisa, e a
 * regra está em `gerarKitContratoZip`.
 */
export const PENDENTE = "A INFORMAR";

/**
 * Tira do objeto os campos vazios, para que o `nullGetter` do Docxtemplater
 * assuma — é ele quem escreve o marcador e anota a pendência, num lugar só.
 *
 * Sem isto haveria dois caminhos para "campo sem valor": o vazio explícito
 * (`""`, que o template imprimiria como nada) e a chave ausente. O primeiro é
 * o mais comum aqui, porque os coletores devolvem `""` quando não acham.
 */
export function semVazios<T extends Record<string, unknown>>(dados: T): Partial<T> {
  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor === null || valor === undefined) continue;
    if (typeof valor === "string" && valor.trim() === "") continue;
    limpo[chave] = valor;
  }
  return limpo as Partial<T>;
}

/**
 * Um `nullGetter` que escreve o marcador e conta quem ficou faltando.
 *
 * Só entra em tag simples: `{#lista}`/`{/lista}` e `{@xml}` têm significado
 * estrutural, e devolver texto neles corromperia o DOCX em vez de sinalizar
 * lacuna.
 */
export function marcadorDePendencia(
  registrar: (tag: string) => void,
): (part?: { value?: string; module?: string; type?: string }) => string {
  return (part) => {
    if (part?.module) return "";
    if (part?.type && part.type !== "placeholder") return "";
    const tag = String(part?.value ?? "").trim();
    if (!tag) return "";
    registrar(tag);
    return PENDENTE;
  };
}

/**
 * O nome do campo em português, para quem vai preencher.
 *
 * A lista não precisa ser exaustiva — tag sem rótulo sai com o próprio nome,
 * que é feio e ainda assim localizável. Exaustiva ela ficaria desatualizada no
 * primeiro template novo, e um rótulo errado é pior que nenhum.
 */
const ROTULOS: Record<string, string> = {
  municipioCNPJ: "CNPJ da Prefeitura",
  municipioEndereco: "Endereço da Prefeitura",
  municipioCEP: "CEP da Prefeitura",
  fundoCNPJ: "CNPJ do Fundo Municipal de Educação",
  prefeitoNome: "Nome do(a) prefeito(a)",
  prefeitoCPF: "CPF do(a) prefeito(a)",
  prefeitoRG: "RG do(a) prefeito(a)",
  prefeitoEndereco: "Endereço do(a) prefeito(a)",
  secretarioNome: "Secretário(a) Municipal de Educação",
  secretarioDecreto: "Decreto de nomeação do(a) secretário(a)",
  fiscalNome: "Fiscal do contrato",
  fiscalPortaria: "Portaria de designação do fiscal",
  assessorJuridicoNome: "Assessor(a) jurídico(a) do município",
  assessorJuridicoOAB: "OAB do(a) assessor(a) jurídico(a)",
  agenteContratacaoNome: "Agente de contratação",
  agenteContratacaoDecreto: "Decreto do agente de contratação",
  representanteCPF: "CPF do representante da Global",
  representanteRG: "RG do representante da Global",
  representanteOrgaoExp: "Órgão expedidor do RG do representante",
  dataDocumento: "Data da peça",
};

export function rotuloDoCampo(campo: string): string {
  return ROTULOS[campo] ?? campo;
}

/** O relatório que vai dentro do ZIP quando alguma coisa ficou de fora. */
export function textoDePendencias(
  campos: readonly string[],
  avisos: readonly string[],
): string {
  const linhas = [
    "PENDÊNCIAS DO KIT",
    "=================",
    "",
    "O kit foi gerado por completo — as 14 peças estão aqui. Este arquivo lista",
    `o que nenhuma fonte pública soube preencher e por isso saiu como "${PENDENTE}"`,
    "no corpo dos documentos. Procure por esse texto nas peças para achar cada",
    "lacuna.",
    "",
  ];

  if (campos.length) {
    linhas.push(`Campos a preencher à mão (${campos.length}):`, "");
    /* O nome cru vai junto do rótulo: é ele que aparece na tela de revisão e
       na resposta da API, e sem a correspondência quem lê aqui não sabe qual
       campo destravar lá. */
    const rotulados = campos
      .map((campo) => {
        const rotulo = rotuloDoCampo(campo);
        return rotulo === campo ? campo : `${rotulo} (${campo})`;
      })
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    for (const campo of rotulados) linhas.push(`  - ${campo}`);
    linhas.push("");
  } else {
    linhas.push("Nenhum campo ficou em branco.", "");
  }

  if (avisos.length) {
    linhas.push("Avisos:", "");
    for (const aviso of avisos) linhas.push(`  - ${aviso}`);
    linhas.push("");
  }

  return linhas.join("\n");
}

/**
 * Os nomes de arquivo a tentar, na ordem, para uma peça e uma via.
 *
 * Existe porque nem toda peça vira dispensa trocando a palavra: o parecer
 * jurídico e o ETP **argumentam** inviabilidade de competição e notória
 * especialização, que são conceitos do Art. 74. Uma dispensa com esse texto
 * concluiria pelo Art. 75 depois de três parágrafos provando o Art. 74 — e
 * quem lê isso é o jurídico da prefeitura.
 *
 * A convenção é `<nome> [via].docx`. Quem não tem variante usa o arquivo
 * comum, que serve às duas vias.
 */
export function nomesDeTemplate(filename: string, via: string): string[] {
  const base = filename.replace(/\.docx$/i, "");
  return [`${base} [${via}].docx`, filename];
}

/**
 * Completa o payload com tudo que o sistema sabe deduzir sozinho.
 *
 * São três camadas, e a ordem entre elas é o ponto: **o que o chamador mandou
 * ganha**, mas só quando mandou de verdade — campo vazio não apaga o que os
 * coletores sabem preencher. Era o que acontecia com `{ ...defaults, ...data }`
 * puro, porque os coletores devolvem `""` (e não `undefined`) quando não acham.
 *
 * 1. `collectDefaults` — o lado da Global: razão social, CNPJ, representante,
 *    percentuais. Nunca falta, porque é constante do código.
 * 2. `collectComputedFields` — números de processo, datas do fluxo, valor
 *    global e por extenso, foro, nome do fundo. Tudo derivável de município,
 *    UF, valor e prazo.
 * 3. O payload recebido.
 *
 * Sem isto, um `POST` com quatro campos produzia um kit com dezoito lacunas
 * que ninguém precisava ter: metade delas o próprio sistema calcula.
 */
export function completarDados(data: ContratosFundebData): ContratosFundebData {
  const preenchido = semVazios(data) as ContratosFundebData;

  const defaults = collectDefaults({
    valorMensal: preenchido.valorMensal,
    quantidadeMeses: preenchido.quantidadeMeses,
  });

  const exercicio = Number(preenchido.exercicio) || new Date().getFullYear();
  const computed = collectComputedFields({
    exercicio,
    municipioNome: preenchido.municipioNome ?? "",
    municipioUF: preenchido.municipioUF ?? "",
    valorMensal: defaults.valorMensal,
    quantidadeMeses: defaults.quantidadeMeses,
  });

  return {
    ...defaults,
    ...computed,
    exercicio: String(exercicio),
    ...preenchido,
  };
}

/**
 * As variáveis que os templates leem, montadas a partir do payload já
 * completado.
 *
 * Existe em função única porque o kit e a proposta pediam exatamente as mesmas
 * — e mantinham duas cópias literais do mesmo objeto, a poucas linhas de
 * distância. Quando uma ganhava campo novo, a outra ficava para trás e a
 * proposta saía diferente do contrato que ela acompanha.
 */
export function montarTemplateData(data: ContratosFundebData) {
  const completo = completarDados(data);
  const estadoNome = estadoBySigla(completo.municipioUF);
  const formatNumberStr = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Cálculo proporcional da Planilha Orçamentária da Proposta ──
  // Os 6 itens mantêm proporções fixas em relação ao valor mensal total.
  // Proporções originais baseadas no template base (total = R$ 15.000):
  //   Item 1: 2.700 (18%), Item 2: 2.400 (16%), Item 3: 2.800 (18.67%)
  //   Item 4: 2.450 (16.33%), Item 5: 2.250 (15%), Item 6: 2.400 (16%)
  const valorMensalNum = completo.valorMensal || 0;
  const qtdMeses = completo.quantidadeMeses || 12;
  const PROPORCOES = [0.18, 0.16, 0.1867, 0.1633, 0.15, 0.16];
  const itemValues = PROPORCOES.map((prop) => {
    const unitario = Math.round(valorMensalNum * prop * 100) / 100;
    const total = Math.round(unitario * qtdMeses * 100) / 100;
    return { unitario, total };
  });

  /* A via de contratação — dispensa (Art. 75) ou inexigibilidade (Art. 74) —
     decide a nomenclatura de todas as peças e o fundamento que vai no parecer.
     Vem depois de `...completo` de propósito: sobrescreve o `baseLegal` que o
     coletor de padrões traz fixo, senão um processo de dispensa sairia
     fundamentado no artigo da inexigibilidade.

     O padrão é dispensa, por decisão do dono (2026-08-14). Sem padrão nenhum a
     peça sairia com o campo em branco — e "Nº 012/2026" sem dizer de quê é o
     tipo de defeito que só o setor de licitação percebe. */
  const via = (completo.via as ViaDeContratacao) ?? "dispensa";
  const camposVia = camposDaVia(via, completo.fundamentoId as string | undefined);
  const agora = new Date();

  const templateData = {
    ...completo,
    ...camposVia,
    municipioNomeUpper: (completo.municipioNome ?? "").toUpperCase(),
    empresaRazaoSocialUpper: (completo.empresaRazaoSocial ?? "").toUpperCase(),
    municipioEstado: estadoNome,
    municipioEstadoUpper: estadoNome.toUpperCase(),
    valorMensal: formatNumberStr(completo.valorMensal || 0),
    valorGlobal: formatNumberStr(completo.valorGlobal || 0),
    quantidadeMesesExtenso: mesesPorExtenso(completo.quantidadeMeses),
    quantidadeMeses: String(completo.quantidadeMeses || 12),
    secretarioCargo: "Secretário(a) Municipal de Educação",
    // Só a parte sequencial: o ano vem do `{exercicio}` no próprio template.
    processoNumero: numeroSemAno(completo.processoNumero),
    inexigibilidadeNumero: numeroSemAno(completo.inexigibilidadeNumero),
    contratoNumero: numeroSemAno(completo.contratoNumero),
    /* CNPJ do fundo, RG e CPF do prefeito, fiscal do contrato: cada um destes
       tinha aqui o seu próprio texto de "falta preencher" — "A ser informado",
       "A definir". Três frases diferentes para a mesma coisa, e nenhuma
       localizável no meio de 14 peças. Hoje todos caem no mesmo marcador, pelo
       `nullGetter`; ver `semVazios`. */
    // Variáveis específicas da Proposta Técnica
    valorMensalFormatado: formatNumberStr(completo.valorMensal || 0),
    valorGlobalFormatado: formatNumberStr(completo.valorGlobal || 0),
    cidadeAssinatura: completo.municipioNome,
    // ── Planilha Orçamentária — valores proporcionais ──
    item1Unit: formatNumberStr(itemValues[0].unitario),
    item1Total: formatNumberStr(itemValues[0].total),
    item2Unit: formatNumberStr(itemValues[1].unitario),
    item2Total: formatNumberStr(itemValues[1].total),
    item3Unit: formatNumberStr(itemValues[2].unitario),
    item3Total: formatNumberStr(itemValues[2].total),
    item4Unit: formatNumberStr(itemValues[3].unitario),
    item4Total: formatNumberStr(itemValues[3].total),
    item5Unit: formatNumberStr(itemValues[4].unitario),
    item5Total: formatNumberStr(itemValues[4].total),
    item6Unit: formatNumberStr(itemValues[5].unitario),
    item6Total: formatNumberStr(itemValues[5].total),
    // ── Data — sempre usa data atual para a proposta ──
    diaAssinatura: String(agora.getDate()),
    mesAssinatura: ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][agora.getMonth()],
    anoAssinatura: String(agora.getFullYear()),
  };

  return { via, camposVia, dados: completo, templateData };
}

/**
 * Um documento de habilitação vindo do acervo da empresa (Firestore/Storage),
 * já resolvido para caminho dentro do ZIP e URL de download.
 */
export interface AnexoDeHabilitacao {
  /** `Habilitacao/02 Certidões/cnd-federal.pdf` — ver `caminhoNoKit`. */
  caminho: string;
  url: string;
}

/**
 * Gera um arquivo ZIP contendo todos os documentos reais no formato .docx, mantendo formatação
 * e preenchendo as tags via docxtemplater.
 *
 * `habilitacao` são os documentos da empresa cadastrados em Documentos ›
 * Habilitação. Quando vem preenchida, é ela que manda: a pasta local de
 * habilitação (que só existe na máquina de quem a montou) fica de fora, senão
 * o kit sairia com dois conjuntos do mesmo documento — um atual e um
 * possivelmente vencido.
 *
 * **Dado faltando não impede o kit.** Campo que nenhuma fonte preencheu sai
 * como `PENDENTE` no papel e entra em `pendencias`; o ZIP ganha um
 * `PENDENCIAS.txt` com a lista. O que continua abortando é peça faltando —
 * ver o `throw` no laço dos templates.
 */
export async function gerarKitContratoZip(
  data: ContratosFundebData,
  habilitacao?: readonly AnexoDeHabilitacao[],
): Promise<{ buffer: Buffer; pendencias: string[]; avisos: string[] }> {
  const resultZip = new JSZip();
  const templatesDir = templatesDeContrato();
  const pendencias = new Set<string>();
  const avisos: string[] = [];

  const { via, camposVia, dados, templateData } = montarTemplateData(data);

  for (const item of TEMPLATES_MAP) {
    const templatePath =
      nomesDeTemplate(item.filename, via)
        .map((nome) => path.join(templatesDir, nome))
        .find((caminho) => fs.existsSync(caminho)) ??
      path.join(templatesDir, item.filename);

    if (fs.existsSync(templatePath)) {
      try {
        const content = fs.readFileSync(templatePath, "binary");
        const zip = new PizZip(content);
        
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: marcadorDePendencia((tag) => pendencias.add(tag)),
        });

        // Resolve data based on doc context
        /* As datas saem de `dados`, e não do payload cru: o fluxo processual
           inteiro é derivável do exercício, e lê-lo de `data` fazia cada peça
           sair com "A INFORMAR" no lugar da data sempre que o chamador não
           mandasse as cinco. */
        let dataDocumento = dados.dataAssinatura;
        if (["02.1", "02.2", "02.3", "02.4", "02.5", "03"].includes(item.docIndex)) {
          dataDocumento = dados.dataSolicitacao;
        } else if (["04", "05", "06", "07"].includes(item.docIndex)) {
          dataDocumento = dados.dataParecerJuridico;
        } else if (item.docIndex === "08") {
          dataDocumento = dados.dataRatificacao;
        } else if (item.docIndex === "09") {
          dataDocumento = dados.dataHomologacao;
        }

        doc.render(semVazios({ ...templateData, dataDocumento }));

        const buf = doc.getZip().generate({
          type: "nodebuffer",
          compression: "DEFLATE",
        });

        // `{VIA}` no `outputName` vira a via escolhida: um processo de dispensa
        // não pode entregar um arquivo chamado "Parecer da Inexigibilidade".
        const nomeDaPeca = item.outputName.replace("{VIA}", camposVia.modalidadeCurta);
        resultZip.file(`${nomeDaPeca}.docx`, buf);
      } catch (err) {
        /* Falha aqui era um `.txt` de aviso dentro do ZIP — um kit
           aparentemente completo com documento faltando, que ninguém percebia
           antes de protocolar. Peça de processo administrativo incompleta é
           pior que geração nenhuma: o erro sobe. */
        throw new Error(
          `Falha ao processar o template "${item.filename}" (${item.outputName}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    } else {
      throw new Error(
        `Template "${item.filename}" não encontrado em ${templatesDir}. ` +
          `O kit não sai incompleto: reponha o arquivo e gere de novo.`,
      );
    }
  }

  // ── Habilitação vinda do acervo da empresa (Documentos › Habilitação) ──
  /* Documento que não desce **não** derruba mais o kit.

     A regra anterior era a do template faltando — "kit sem habilitação é kit
     que inabilita", e o erro subia. A diferença é quem consegue reagir: peça
     do processo é arquivo nosso, reponível na hora; certidão do acervo é URL
     do Storage que expira, e perder as 14 peças por causa de uma delas deixa
     quem está na prefeitura sem nada. O que falta sai nomeado no
     PENDENCIAS.txt e na resposta da rota — anexar à mão é trabalho de um
     minuto, refazer o kit inteiro não. */
  let habilitacaoAnexada = 0;
  if (habilitacao?.length) {
    for (const anexo of habilitacao) {
      try {
        const resposta = await fetch(anexo.url);
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        resultZip.file(anexo.caminho, Buffer.from(await resposta.arrayBuffer()));
        habilitacaoAnexada += 1;
      } catch (err) {
        avisos.push(
          `Documento de habilitação "${anexo.caminho}" não entrou no kit (${
            err instanceof Error ? err.message : String(err)
          }). Anexe-o à mão antes de protocolar.`,
        );
      }
    }
  }

  // ── Retrocompatibilidade: a pasta local de habilitação ──
  // Só entra quando o acervo não trouxe nada. "Habilitacao" é a pasta da
  // Global Company; "Habilitacao_PRIME" é o nome da era Rocha Prime, mantido
  // para quem ainda tem a pasta antiga montada.
  const habilitacaoDir = habilitacao?.length
    ? undefined
    : ["Habilitacao", "Habilitacao_PRIME"]
        .map((nome) => path.join(contratosAssetsDir(), nome))
        .find((caminho) => fs.existsSync(caminho));
  if (habilitacaoDir) {
    const categorias = fs.readdirSync(habilitacaoDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    /* A pasta só nasce quando há o que pôr dentro. A pasta de habilitação
       desta máquina existe com as nove categorias e nenhum arquivo, e criá-la
       à toa punha um `Habilitacao/` vazio no ZIP — que lido do outro lado
       parece certidão que se perdeu no caminho. */
    let totalAnexos = 0;
    let habilitacaoFolder: JSZip | null = null;

    for (const categoria of categorias) {
      const catPath = path.join(habilitacaoDir, categoria.name);
      const arquivos = fs.readdirSync(catPath, { withFileTypes: true })
        .filter((f) => f.isFile())
        .sort((a, b) => a.name.localeCompare(b.name));

      if (arquivos.length > 0) {
        habilitacaoFolder ??= resultZip.folder("Habilitacao");
        const catFolder = habilitacaoFolder?.folder(categoria.name);
        for (const arquivo of arquivos) {
          try {
            const filePath = path.join(catPath, arquivo.name);
            const fileBuffer = fs.readFileSync(filePath);
            catFolder?.file(arquivo.name, fileBuffer);
            totalAnexos++;
          } catch (err) {
            console.error(`Erro ao incluir anexo ${arquivo.name}:`, err);
          }
        }
      }
    }

    if (totalAnexos > 0) {
      console.log(`[gerarKitContratoZip] ${totalAnexos} documento(s) habilitatório(s) incluído(s) automaticamente.`);
      habilitacaoAnexada += totalAnexos;
    }
  }

  if (habilitacaoAnexada === 0) {
    avisos.push(
      "O kit saiu sem documentos de habilitação. Cadastre-os em Documentos › " +
        "Habilitação, ou anexe-os à mão ao processo.",
    );
  }

  /* O relatório do que ficou faltando viaja **dentro** do ZIP.

     Isto não é o `.txt` de aviso que substituía peça faltando, e que saiu daqui
     em 2026-08-14 — aquele fingia kit completo. Este acompanha um kit que está
     completo mesmo: as 14 peças estão lá, e ele diz onde procurar as lacunas.
     Fora do ZIP a informação se perde: quem baixa o arquivo hoje e protocola na
     semana que vem não tem mais a tela aberta. */
  const listaDePendencias = [...pendencias];
  if (listaDePendencias.length || avisos.length) {
    resultZip.file("PENDENCIAS.txt", textoDePendencias(listaDePendencias, avisos));
  }

  // Gera o buffer binário do arquivo ZIP compactado
  const zipBuffer = await resultZip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return { buffer: zipBuffer, pendencias: listaDePendencias, avisos };
}

/**
 * Representa um arquivo anexo de habilitação para inclusão no ZIP
 */
export interface AnexoHabilitacao {
  /** Categoria do documento (societario, certidoes, atestados, contratos, notas_fiscais, proposta, documentos_socios) */
  categoria: string;
  /** Nome original do arquivo */
  nomeArquivo: string;
  /** Conteúdo binário do arquivo */
  buffer: Buffer;
}

/** Mapeamento de categorias para nomes de pasta legíveis no ZIP */
const CATEGORIA_PASTA_MAP: Record<string, string> = {
  societario: "01_Societario",
  certidoes: "02_Certidoes",
  atestados: "03_Atestados",
  contratos: "04_Contratos_Referencia",
  notas_fiscais: "05_Notas_Fiscais",
  proposta: "06_Proposta",
  documentos_socios: "07_Documentos_Socios",
};

/**
 * Gera um arquivo ZIP contendo:
 *  - Os 14 documentos DOCX preenchidos (processo administrativo)
 *  - Pasta Habilitacao/ com os documentos anexados organizados por categoria
 */
export async function gerarKitContratoComAnexosZip(
  data: ContratosFundebData,
  anexos: AnexoHabilitacao[],
): Promise<Buffer> {
  // 1. Gerar o ZIP base com os 14 DOCXs
  const { buffer: baseZipBuffer } = await gerarKitContratoZip(data);

  // Se não há anexos, retorna o ZIP padrão
  if (!anexos || anexos.length === 0) {
    return baseZipBuffer;
  }

  // 2. Reabrir o ZIP e adicionar os anexos
  const resultZip = await JSZip.loadAsync(baseZipBuffer);

  // Criar pasta raiz de habilitação
  const habilitacaoFolder = resultZip.folder("Habilitacao");

  if (habilitacaoFolder) {
    for (const anexo of anexos) {
      const pastaCategoria = CATEGORIA_PASTA_MAP[anexo.categoria] || anexo.categoria;
      const categoriaFolder = habilitacaoFolder.folder(pastaCategoria);
      if (categoriaFolder) {
        categoriaFolder.file(anexo.nomeArquivo, anexo.buffer);
      }
    }
  }

  // 3. Gerar o ZIP final com tudo
  const zipBuffer = await resultZip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return zipBuffer;
}

/**
 * Gera apenas a Proposta Técnica e Comercial como DOCX standalone.
 * Separada do ZIP para que possa ser assinada individualmente.
 */
export async function gerarPropostaDocx(
  data: ContratosFundebData,
): Promise<{ buffer: Buffer; filename: string; pendencias: string[] }> {
  const templatesDir = templatesDeContrato();
  const templatePath = path.join(templatesDir, PROPOSTA_TEMPLATE.filename);
  const pendencias = new Set<string>();

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template da proposta não encontrada: ${PROPOSTA_TEMPLATE.filename}`);
  }

  const { dados, templateData: base } = montarTemplateData(data);
  const templateData = { ...base, dataDocumento: dados.dataAssinatura };

  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: marcadorDePendencia((tag) => pendencias.add(tag)),
  });

  doc.render(semVazios(templateData));

  const buffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  // Gerar nome do arquivo com slug do município
  const slug = (data.municipioNome || "municipio")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const filename = `Proposta_Tecnica_Comercial_${slug}.docx`;

  return { buffer, filename, pendencias: [...pendencias] };
}
