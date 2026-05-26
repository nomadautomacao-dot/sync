import fs from "fs";
import path from "path";
import JSZip from "jszip";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { ContratosFundebData } from "../types";
import { estadoBySigla } from "./contrato-fundeb-service";

/**
 * Interface representando o arquivo mapeado de template em formato DOCX
 */
interface TemplateConfig {
  filename: string;
  docIndex: string;
  outputName: string;
}

const TEMPLATES_MAP: TemplateConfig[] = [
  { filename: "00 - PROPOSTA TECNICA COMERCIAL.docx", docIndex: "00", outputName: "00 - Proposta Técnica e Comercial" },
  { filename: "01 - CAPA DO PROCESSO.docx", docIndex: "01", outputName: "01 - Capa do Processo" },
  { filename: "02.1 DFD Administração.docx", docIndex: "02.1", outputName: "02.1 - Documento de Formalização da Demanda (DFD)" },
  { filename: "02.2 ETP.docx", docIndex: "02.2", outputName: "02.2 - Estudo Técnico Preliminar (ETP)" },
  { filename: "02.3 TR.docx", docIndex: "02.3", outputName: "02.3 - Termo de Referência (TR)" },
  { filename: "02.4 - PROCESSO ADMINISTRATIVO.docx", docIndex: "02.4", outputName: "02.4 - Memorando de Processo Administrativo" },
  { filename: "02.5 - JUSTIFICATIVA DA ESCOLHA DO FORNECEDOR.docx", docIndex: "02.5", outputName: "02.5 - Justificativa da Escolha do Fornecedor" },
  { filename: "03 - Solicitação Dotacao.docx", docIndex: "03", outputName: "03 - Solicitação de Reserva de Dotação" },
  { filename: "04 - Resposta Dotacao.docx", docIndex: "04", outputName: "04 - Certidão de Resposta de Dotação" },
  { filename: "05 - Enc. PA  Prefeito.docx", docIndex: "05", outputName: "05 - Encaminhamento do PA ao Prefeito" },
  { filename: "06 - PARECER 2025.docx", docIndex: "06", outputName: "06 - Parecer da Comissão de Contratação (CPL)" },
  { filename: "07 - Parecer da Dispensa 000.26.docx", docIndex: "07", outputName: "07 - Parecer Jurídico da Inexigibilidade" },
  { filename: "08 - Ratificação de Inexigibilidade  000.2026.docx", docIndex: "08", outputName: "08 - Despacho de Ratificação de Inexigibilidade" },
  { filename: "09 - Homologação - Inex. 000.2026.docx", docIndex: "09", outputName: "09 - Termo de Homologação e Adjudicação" },
  { filename: "10 - MINUTA - 000 - 00.00.2026 - CONTRATO ASSESSORIA - ROCHA PRIME - INEX 001.docx", docIndex: "10", outputName: "10 - Minuta do Contrato de Assessoria" },
];

/**
 * Gera um arquivo ZIP contendo todos os documentos reais no formato .docx, mantendo formatação
 * e preenchendo as tags via docxtemplater.
 */
export async function gerarKitContratoZip(data: ContratosFundebData): Promise<Buffer> {
  const resultZip = new JSZip();
  const templatesDir = path.join(process.cwd(), "contratos", "Anexos_DOCX");

  const estadoNome = estadoBySigla(data.municipioUF);

  const formatNumberStr = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const templateData = {
    ...data,
    municipioNomeUpper: data.municipioNome ? data.municipioNome.toUpperCase() : "",
    empresaRazaoSocialUpper: data.empresaRazaoSocial ? data.empresaRazaoSocial.toUpperCase() : "",
    municipioEstado: estadoNome,
    municipioEstadoUpper: estadoNome.toUpperCase(),
    valorMensal: formatNumberStr(data.valorMensal || 0),
    valorGlobal: formatNumberStr(data.valorGlobal || 0),
    quantidadeMesesExtenso: data.quantidadeMeses === 12 ? 'doze' : data.quantidadeMeses === 8 ? 'oito' : data.quantidadeMeses === 7 ? 'sete' : data.quantidadeMeses === 6 ? 'seis' : String(data.quantidadeMeses),
    quantidadeMeses: String(data.quantidadeMeses || 12),
    secretarioCargo: 'Secretário(a) Municipal de Educação',
    // Ensure fundoCNPJ has a display value
    fundoCNPJ: data.fundoCNPJ || 'A ser informado',
    municipioCNPJ: data.municipioCNPJ || 'A ser informado',
    municipioEndereco: data.municipioEndereco || 'A ser informado',
    prefeitoRG: data.prefeitoRG || 'A ser informado',
    prefeitoCPF: data.prefeitoCPF || 'A ser informado',
    prefeitoEndereco: data.prefeitoEndereco || 'A ser informado',
    fiscalNome: data.fiscalNome || 'A definir',
    // Variáveis específicas da Proposta Técnica
    valorMensalFormatado: formatNumberStr(data.valorMensal || 0),
    valorGlobalFormatado: formatNumberStr(data.valorGlobal || 0),
    valorGlobalExtenso: data.valorGlobalExtenso || '',
    cidadeAssinatura: data.municipioNome || '',
    diaAssinatura: (() => {
      const d = data.dataAssinatura;
      if (!d) return new Date().getDate().toString();
      const match = d.match(/(\d{1,2})/);
      return match ? match[1] : new Date().getDate().toString();
    })(),
    mesAssinatura: (() => {
      const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      const d = data.dataAssinatura;
      if (!d) return meses[new Date().getMonth()];
      // Try DD/MM/YYYY format
      const match = d.match(/\/(\d{1,2})\//);
      if (match) return meses[parseInt(match[1]) - 1] || meses[new Date().getMonth()];
      return meses[new Date().getMonth()];
    })(),
    anoAssinatura: (() => {
      const d = data.dataAssinatura;
      if (!d) return new Date().getFullYear().toString();
      const match = d.match(/(\d{4})/);
      return match ? match[1] : new Date().getFullYear().toString();
    })(),
  };

  for (const item of TEMPLATES_MAP) {
    const templatePath = path.join(templatesDir, item.filename);
    
    if (fs.existsSync(templatePath)) {
      try {
        const content = fs.readFileSync(templatePath, "binary");
        const zip = new PizZip(content);
        
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: () => "", // Não colocar "undefined" se faltar a tag
        });

        // Resolve data based on doc context
        let dataDocumento = data.dataAssinatura;
        if (["02.1", "02.2", "02.3", "02.4", "02.5", "03"].includes(item.docIndex)) {
          dataDocumento = data.dataSolicitacao;
        } else if (["04", "05", "06", "07"].includes(item.docIndex)) {
          dataDocumento = data.dataParecerJuridico;
        } else if (item.docIndex === "08") {
          dataDocumento = data.dataRatificacao;
        } else if (item.docIndex === "09") {
          dataDocumento = data.dataHomologacao;
        }

        doc.render({
          ...templateData,
          dataDocumento: dataDocumento || "",
        });

        const buf = doc.getZip().generate({
          type: "nodebuffer",
          compression: "DEFLATE",
        });

        resultZip.file(`${item.outputName}.docx`, buf);
      } catch (err) {
        console.error(`Erro processando template ${item.filename}:`, err);
        resultZip.file(`${item.outputName}_ERRO.txt`, `Falha ao processar template ${item.filename}.`);
      }
    } else {
      console.warn(`Template não encontrada no caminho: ${templatePath}`);
      resultZip.file(`${item.outputName}.txt`, `Documento ${item.outputName} - Template original não localizada no servidor.`);
    }
  }

  // ── Incluir automaticamente a Documentação Habilitatória da empresa ──
  const habilitacaoDir = path.join(process.cwd(), "contratos", "Habilitacao_PRIME");
  if (fs.existsSync(habilitacaoDir)) {
    const categorias = fs.readdirSync(habilitacaoDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    let totalAnexos = 0;
    const habilitacaoFolder = resultZip.folder("Habilitacao");

    for (const categoria of categorias) {
      const catPath = path.join(habilitacaoDir, categoria.name);
      const arquivos = fs.readdirSync(catPath, { withFileTypes: true })
        .filter((f) => f.isFile())
        .sort((a, b) => a.name.localeCompare(b.name));

      if (arquivos.length > 0 && habilitacaoFolder) {
        const catFolder = habilitacaoFolder.folder(categoria.name);
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
    }
  }

  // Gera o buffer binário do arquivo ZIP compactado
  const zipBuffer = await resultZip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return zipBuffer;
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
 *  - Os 15 documentos DOCX preenchidos (processo administrativo)
 *  - Pasta Habilitacao/ com os documentos anexados organizados por categoria
 */
export async function gerarKitContratoComAnexosZip(
  data: ContratosFundebData,
  anexos: AnexoHabilitacao[],
): Promise<Buffer> {
  // 1. Gerar o ZIP base com os 15 DOCXs
  const baseZipBuffer = await gerarKitContratoZip(data);

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
