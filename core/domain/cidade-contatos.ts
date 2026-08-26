/**
 * Os contatos de um município — prefeito, secretária de educação, chefe de
 * gabinete: as pessoas que a equipe precisa achar quando liga para a
 * prefeitura.
 *
 * É diretório, não fato: ao contrário dos eventos da linha do tempo, um
 * contato se edita e se apaga sem cerimônia — a pessoa muda de cargo, o
 * telefone muda de dono, a eleição troca a prefeitura inteira. Por isso não há
 * trava de autor aqui.
 */

export interface ContatoDaCidade {
  id: string;
  nome: string;
  /** Texto livre com sugestões: cargo de prefeitura não cabe em enum. */
  cargo?: string;
  telefone?: string;
  email?: string;
  observacao?: string;
  criadoEm: string;
  atualizadoEm?: string;
  criadoPorNome?: string;
}

/** O que o formulário entrega. Identidade e datas são responsabilidade nossa. */
export interface EntradaDeContato {
  nome: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  observacao?: string;
}

/**
 * Os cargos que aparecem em toda prefeitura. São sugestões de AutoComplete,
 * não opções fechadas — cada município inventa a própria nomenclatura, e um
 * enum viraria "Outro" na metade dos cadastros.
 */
export const CARGOS_SUGERIDOS = [
  "Prefeito(a)",
  "Vice-prefeito(a)",
  "Secretário(a) de Educação",
  "Secretário(a) de Finanças",
  "Secretário(a) de Administração",
  "Chefe de Gabinete",
  "Controlador(a) Interno",
  "Contador(a) da Prefeitura",
  "Presidente do CACS-FUNDEB",
  "Assessor(a) Jurídico(a)",
] as const;

function limpo(valor: string | undefined): string | undefined {
  const resultado = valor?.trim();
  return resultado ? resultado : undefined;
}

/** Monta o documento novo: apara os campos e descarta os vazios. */
export function novoContato(
  entrada: EntradaDeContato,
  agora: Date,
  criadoPorNome?: string,
): Omit<ContatoDaCidade, "id"> {
  return {
    nome: entrada.nome.trim(),
    cargo: limpo(entrada.cargo),
    telefone: limpo(entrada.telefone),
    email: limpo(entrada.email),
    observacao: limpo(entrada.observacao),
    criadoEm: agora.toISOString(),
    criadoPorNome: limpo(criadoPorNome),
  };
}

/**
 * O link de WhatsApp de um telefone brasileiro, ou `null` quando o número não
 * dá para um. O DDI 55 entra sozinho quando falta: ninguém cadastra o código
 * do país no telefone do secretário, e sem ele o wa.me abre conversa com um
 * número dos Estados Unidos.
 */
export function linkWhatsApp(telefone: string | undefined): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  // Fixo com DDD tem 10 dígitos; celular, 11. Menos que isso não é número
  // completo, e link para número pela metade é pior que link nenhum.
  if (digitos.length < 10) return null;
  const comPais = digitos.startsWith("55") && digitos.length >= 12
    ? digitos
    : `55${digitos}`;
  return `https://wa.me/${comPais}`;
}
