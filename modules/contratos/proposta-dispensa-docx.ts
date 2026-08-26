/**
 * O DOCX da Proposta Comercial (dispensa), montado por código — sem template
 * em disco. A alternativa (docxtemplater sobre um .docx em
 * `CONTRATOS_ASSETS_DIR`) é a do kit de inexigibilidade, e o custo dela já se
 * pagou caro: os templates moram fora do git, não viajam para a nuvem e a
 * geração quebra em qualquer máquina que não tenha a pasta. Gerado por código,
 * a proposta sai igual no Cloud Run, no desktop e nesta máquina.
 *
 * Sai DOCX, não PDF, de propósito: a peça vai para a prefeitura e é normal o
 * setor de compras pedir um ajuste de última hora — DOCX eles editam.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import {
  EMPRESA,
  MARCA,
  MARCA_ASSINATURA,
  enderecoCompleto,
  linhasDeContato,
} from "@/core/domain/empresa";
import {
  VALIDADE_DA_PROPOSTA,
  aberturaDaProposta,
  dataPorExtenso,
  formatarReais,
  prazoPorExtenso,
  valorGlobalCents,
  type PropostaDispensa,
} from "./proposta-dispensa";

/** A4 (11906 DXA) menos 2,5 cm de margem de cada lado. */
const LARGURA_UTIL = 11906 - 2 * 1418;
const COLUNA_ITEM = 900;
const COLUNA_ESPECIFICACAO = LARGURA_UTIL - COLUNA_ITEM;
const COLUNA_DESCRICAO = Math.round(LARGURA_UTIL * 0.6);
const COLUNA_VALOR = LARGURA_UTIL - COLUNA_DESCRICAO;

const MARCADORES = "marcadores-proposta";

/** Quase-preto e cinza da marca — os mesmos do tema da interface. */
const COR_MARCA = "16181D";
const COR_APOIO = "5A5E6A";

/** A linha de posicionamento, sem repetir a marca que já está acima dela. */
const TAGLINE = MARCA_ASSINATURA.split("—")[1]?.trim() ?? MARCA_ASSINATURA;

/**
 * O timbre da casa. O mesmo desenho vive nos templates DOCX do kit de
 * inexigibilidade (Sync-Arquivos/assets-contratos) — mudar um é mudar o outro,
 * senão a proposta e o processo saem com papéis diferentes.
 */
/**
 * A assinatura da marca, em PNG de 2680px — larga o bastante para imprimir sem
 * serrilhar. A fonte é o SVG em `public/global-company-logo-horizontal.svg`;
 * o PNG é o que o DOCX aceita.
 *
 * Lido do disco a cada geração, e não embutido em base64 no código: trocar a
 * arte passa a ser substituir um arquivo, sem recompilar nada.
 */
function marcaDoTimbre(): ImageRun | null {
  try {
    const arquivo = path.join(process.cwd(), "public", "global-company-logo.png");
    return new ImageRun({
      type: "png",
      data: readFileSync(arquivo),
      // 48mm de largura; a altura acompanha a proporção 1340×300 do vetor.
      transformation: { width: 136, height: 30 },
    });
  } catch {
    // Sem a arte, o timbre cai no nome em tipografia — melhor um cabeçalho
    // sóbrio do que uma proposta que não sai.
    return null;
  }
}

function timbre(): Header {
  const marca = marcaDoTimbre();
  return new Header({
    children: [
      new Paragraph({
        spacing: { after: 0 },
        children: [
          marca ??
            new TextRun({
              text: MARCA.toLocaleUpperCase("pt-BR"),
              bold: true,
              size: 30,
              color: COR_MARCA,
              characterSpacing: 40,
            }),
        ],
      }),
      new Paragraph({
        spacing: { after: 240 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 12, space: 6, color: COR_MARCA },
        },
        children: [new TextRun({ text: TAGLINE, size: 17, color: COR_APOIO })],
      }),
    ],
  });
}

function rodape(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, space: 6, color: "A2A6B2" },
        },
        children: [
          new TextRun({
            text: `${EMPRESA.razaoSocial} · CNPJ ${EMPRESA.cnpj}`,
            size: 15,
            color: COR_APOIO,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [
          new TextRun({
            text: [
              `${EMPRESA.endereco} — ${EMPRESA.cidade}/${EMPRESA.uf}`,
              EMPRESA.telefone,
              EMPRESA.email,
            ]
              .filter(Boolean)
              .join(" · "),
            size: 15,
            color: COR_APOIO,
          }),
        ],
      }),
    ],
  });
}

function titulo(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text: texto, bold: true, size: 24 })],
  });
}

function corpo(texto: string, opts?: { bold?: boolean; after?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: opts?.after ?? 120 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text: texto, bold: opts?.bold })],
  });
}

function marcador(texto: string): Paragraph {
  return new Paragraph({
    numbering: { reference: MARCADORES, level: 0 },
    spacing: { after: 10 },
    children: [new TextRun({ text: texto })],
  });
}

function celula(children: Paragraph[], width: number, opts?: { header?: boolean }) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    shading: opts?.header ? { fill: "F2F2F2" } : undefined,
    children,
  });
}

export async function gerarPropostaDispensaDocx(
  proposta: PropostaDispensa,
): Promise<Buffer> {
  const valorMensal = formatarReais(proposta.valorMensalCents);
  const valorGlobal = formatarReais(valorGlobalCents(proposta));

  const linhasDeServico = proposta.itens.map(
    (item, indice) =>
      new TableRow({
        children: [
          celula(
            [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(indice + 1), bold: true })],
              }),
            ],
            COLUNA_ITEM,
          ),
          celula(
            [
              new Paragraph({
                spacing: { after: item.detalhes.length ? 60 : 0 },
                children: [new TextRun({ text: item.titulo, bold: true })],
              }),
              ...item.detalhes.map(marcador),
            ],
            COLUNA_ESPECIFICACAO,
          ),
        ],
      }),
  );

  const documento = new Document({
    styles: {
      default: {
        document: { run: { font: "Arial", size: 22 } },
      },
    },
    numbering: {
      config: [
        {
          reference: MARCADORES,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 340, hanging: 170 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 },
          },
        },
        headers: { default: timbre() },
        footers: { default: rodape() },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: "PROPOSTA COMERCIAL", bold: true, size: 32 })],
          }),

          corpo(
            `À PREFEITURA MUNICIPAL DE ${proposta.municipioNome.toLocaleUpperCase("pt-BR")} — ${proposta.municipioUf.toUpperCase()}`,
            { bold: true },
          ),
          corpo(`Empresa: ${EMPRESA.razaoSocial}`, { after: 40 }),
          corpo(`CNPJ: ${EMPRESA.cnpj}`, { after: 40 }),
          corpo(
            `${enderecoCompleto()}, ${EMPRESA.cidade}/${EMPRESA.uf}`,
            { after: 40 },
          ),
          corpo(linhasDeContato().join(" · "), { after: 200 }),

          corpo(aberturaDaProposta(proposta.via)),

          titulo("OBJETO"),
          corpo(
            "Contratação de empresa especializada para prestação de serviços de assessoria técnica e consultoria junto à Secretaria Municipal de Educação, visando o acompanhamento, gerenciamento, alimentação, monitoramento e suporte técnico dos programas, sistemas e plataformas vinculados ao FNDE, ao MEC e à Secretaria Estadual de Educação.",
          ),

          titulo("DESCRIÇÃO DOS SERVIÇOS"),
          new Table({
            width: { size: LARGURA_UTIL, type: WidthType.DXA },
            columnWidths: [COLUNA_ITEM, COLUNA_ESPECIFICACAO],
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  celula(
                    [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: "ITEM", bold: true })],
                      }),
                    ],
                    COLUNA_ITEM,
                    { header: true },
                  ),
                  celula(
                    [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: "ESPECIFICAÇÃO", bold: true })],
                      }),
                    ],
                    COLUNA_ESPECIFICACAO,
                    { header: true },
                  ),
                ],
              }),
              ...linhasDeServico,
            ],
          }),

          titulo("PRAZO"),
          corpo(`Prazo de execução: ${prazoPorExtenso(proposta.prazoMeses)}.`),

          titulo("PROPOSTA DE PREÇO"),
          new Table({
            width: { size: LARGURA_UTIL, type: WidthType.DXA },
            columnWidths: [COLUNA_DESCRICAO, COLUNA_VALOR],
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  celula([corpo("Descrição", { bold: true, after: 0 })], COLUNA_DESCRICAO, {
                    header: true,
                  }),
                  celula([corpo("Valor", { bold: true, after: 0 })], COLUNA_VALOR, {
                    header: true,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  celula([corpo("Valor mensal", { after: 0 })], COLUNA_DESCRICAO),
                  celula([corpo(valorMensal, { bold: true, after: 0 })], COLUNA_VALOR),
                ],
              }),
              new TableRow({
                children: [
                  celula(
                    [corpo(`Valor global (${proposta.prazoMeses} meses)`, { after: 0 })],
                    COLUNA_DESCRICAO,
                  ),
                  celula([corpo(valorGlobal, { bold: true, after: 0 })], COLUNA_VALOR),
                ],
              }),
            ],
          }),

          titulo("CONDIÇÕES"),
          marcador(`Validade da proposta: ${VALIDADE_DA_PROPOSTA}.`),
          marcador("Pagamento conforme definido pela Administração."),
          marcador(
            "Todos os tributos, encargos e despesas estão inclusos nos valores apresentados.",
          ),

          new Paragraph({
            spacing: { before: 300, after: 40 },
            // A data e o bloco de assinatura não se separam: assinatura sozinha
            // no alto de uma folha em branco parece documento truncado.
            keepNext: true,
            children: [
              new TextRun({
                text: `${EMPRESA.cidade}/${EMPRESA.uf}, ${dataPorExtenso(proposta.emitidaEm)}.`,
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 260, after: 0 },
            keepNext: true,
            alignment: AlignmentType.CENTER,
            border: {
              // Linha de assinatura: borda de parágrafo, não sublinhado digitado.
              top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 },
            },
            indent: { left: 2400, right: 2400 },
            children: [new TextRun({ text: EMPRESA.representante.nome, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [new TextRun({ text: EMPRESA.representante.qualificacao })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
              new TextRun({ text: `${EMPRESA.razaoSocial} · CNPJ ${EMPRESA.cnpj}` }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(documento);
}
