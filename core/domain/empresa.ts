/**
 * Identidade da empresa, num lugar só.
 *
 * Antes destes valores existirem aqui, a marca aparecia escrita à mão em onze
 * lugares — dois serviços de contrato, cinco geradores de PDF, a tela de
 * ajustes — e a troca de "Rocha Prime" por "Global Company" foi exatamente o
 * tipo de mudança que esse espalhamento torna cara e arriscada.
 *
 * ## Marca e identidade jurídica são coisas separadas
 *
 * `MARCA` é como a empresa se apresenta: capa de deck, rodapé de relatório,
 * cabeçalho da interface. Muda quando o marketing quer.
 *
 * `EMPRESA` é quem assina contrato. Vai na minuta de assessoria, no parecer de
 * inexigibilidade e na proposta comercial — peças que entram em processo
 * administrativo municipal. Errar um dígito de CNPJ aqui não é bug de tela.
 *
 * Por isso os dois blocos não se misturam, e por isso o bloco jurídico carrega
 * `pendente`: enquanto o dado novo não chega, o gerador tem como saber que o
 * que ele tem em mãos não descreve mais a empresa e agir de acordo — omitir a
 * linha em vez de imprimir contato morto.
 *
 * O espelho em Python vive em `kit_padrao_pdf/empresa.py`. Os geradores
 * ReportLab não conseguem importar TypeScript, então os dois arquivos precisam
 * andar juntos — mesma disciplina da lista `COMPLEMENTOS` do empacotador.
 */

/** Como a empresa se apresenta. Forma curta, a que vai na arte. */
export const MARCA = "Global Company";

/** Uma linha de posicionamento, usada em capa de deck e assinatura de e-mail. */
export const MARCA_ASSINATURA =
  "Global Company — Inteligência Técnica para Gestão Educacional";

/** Quem assina pela empresa. Vai na qualificação das partes e na procuração. */
export interface RepresentanteLegal {
  nome: string;
  cpf: string;
  rg: string;
  orgaoExpedidor: string;
  nacionalidade: string;
  estadoCivil: string;
  qualificacao: string;
}

export interface IdentidadeJuridica {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  /** Vazio enquanto o domínio novo não existe. Gerador omite linha vazia. */
  email: string;
  /** Vazio enquanto o domínio novo não existe. Gerador omite linha vazia. */
  site: string;
  representante: RepresentanteLegal;
  /**
   * `true` significa: falta dado para este bloco assinar contrato sozinho.
   *
   * Hoje o que falta é o CPF e o RG do sócio-administrador — a Receita publica
   * o nome no quadro societário, não os documentos. Sem eles a qualificação
   * das partes na minuta sai incompleta.
   *
   * Para encerrar a pendência: preencher `representante.cpf`, `.rg` e
   * `.orgaoExpedidor`, e virar para `false`.
   */
  pendente: boolean;
}

/**
 * Confirmado na Receita Federal em 2026-08-05 (CNPJ 26.137.996/0001-75,
 * situação cadastral ATIVA desde 2016-09-09).
 */
export const EMPRESA: IdentidadeJuridica = {
  razaoSocial: "GLOBAL SERVICES COMPANY LTDA",
  cnpj: "26.137.996/0001-75",
  endereco: "Pe. Orthon Vieira Lima, S/N, Centro",
  cidade: "Santa Maria da Vitória",
  uf: "BA",
  cep: "47640-058",
  telefone: "(61) 98155-1533",
  email: "globalconsultorias@icloud.com",
  site: "",
  representante: {
    nome: "ADRIEL PEREIRA TAVARES",
    cpf: "",
    rg: "",
    orgaoExpedidor: "",
    nacionalidade: "brasileiro",
    estadoCivil: "solteiro",
    qualificacao: "Sócio-Administrador",
  },
  pendente: true,
};

/** Endereço em uma linha, como sai impresso na qualificação das partes. */
export function enderecoCompleto(empresa: IdentidadeJuridica = EMPRESA): string {
  return empresa.cep
    ? `${empresa.endereco}, CEP: ${empresa.cep}`
    : empresa.endereco;
}

/** As linhas de contato que existem — sem buracos e sem contato morto. */
export function linhasDeContato(
  empresa: IdentidadeJuridica = EMPRESA,
): string[] {
  return [
    empresa.telefone && `Tel: ${empresa.telefone}`,
    empresa.email && `E-mail: ${empresa.email}`,
    empresa.site && `Site: ${empresa.site}`,
  ].filter((linha): linha is string => Boolean(linha));
}
