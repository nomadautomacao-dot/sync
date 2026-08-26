export type CollaboratorType =
  | 'socio_executivo'
  | 'consultor_parceiro'
  | 'articulador_politico'
  | 'equipe_interna'
  | 'suporte_tecnico';

export type PartnershipStatus = 'ativo' | 'inativo' | 'pendente' | 'pausado';

export type LinkFilter = 'todos' | 'parceiros' | 'internos';

export interface CollaboratorItem {
  id: string;
  fullName: string;
  shortName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  state?: string;
  collaboratorType: CollaboratorType | string;
  primaryRole: string;
  partnershipStatus: PartnershipStatus | string;
  defaultCommissionPercent: number;
  lastActivityDate?: string;
  createdAt?: string;
  sourcedCitiesCount: number;
  commissionPaidYtd: number;
  commissionForecastYtd: number;
  profitAccruedYtd: number;
  companyOrOrganization?: string;
  pixKey?: string;
  bankAccountInfo?: string;
}

export function isInternalCollaborator(type: string): boolean {
  const lower = type.toLowerCase();
  return (
    lower.includes('intern') ||
    lower.includes('socio') ||
    lower.includes('suporte') ||
    lower.includes('executivo')
  );
}

export function collaboratorLinkCategory(type: string): 'Interno' | 'Parceiro' {
  return isInternalCollaborator(type) ? 'Interno' : 'Parceiro';
}

export function statusTone(status: string): { bg: string; fg: string } {
  const s = status.toLowerCase();
  if (s.includes('inativ') || s.includes('encerrad') || s.includes('desligad')) {
    return { bg: 'bg-surface-subtle', fg: 'text-muted' };
  }
  if (s.includes('ativ')) {
    return { bg: 'bg-success-light', fg: 'text-success-dark' };
  }
  if (s.includes('pend') || s.includes('pausad')) {
    return { bg: 'bg-warning-light', fg: 'text-warning-dark' };
  }
  return { bg: 'bg-surface-subtle', fg: 'text-body' };
}

/**
 * O WhatsApp de quem só tem um número — que é quase todo mundo.
 *
 * O celular do colaborador **é** o WhatsApp na prática. Manter os dois campos
 * independentes fazia a ficha mostrar "—" logo abaixo de um número perfeitamente
 * utilizável, e ninguém ia preencher o mesmo dado duas vezes. O campo próprio
 * continua existindo para quem tem dois números; quando está vazio, o telefone
 * responde por ele.
 *
 * Devolve `null`, e não string vazia, quando não há número nenhum: ausência não
 * é dado, e é a tela que decide como mostrar o que falta.
 */
export function whatsappDoColaborador(pessoa: {
  phone?: string;
  whatsapp?: string;
}): { numero: string; mesmoDoTelefone: boolean } | null {
  const proprio = pessoa.whatsapp?.trim();
  if (proprio) return { numero: proprio, mesmoDoTelefone: false };

  const telefone = pessoa.phone?.trim();
  if (telefone) return { numero: telefone, mesmoDoTelefone: true };

  return null;
}

/**
 * O número no formato do `wa.me`: só dígitos, com o código do país na frente.
 *
 * Devolve `null` para o que não tem cara de telefone brasileiro. Link montado
 * na base do "vai que dá" abre conversa com um desconhecido — pior que não ter
 * link, porque a consultora só descobre depois de mandar a mensagem.
 */
export function linkDeWhatsapp(numero: string): string | null {
  const digitos = numero.replace(/\D/g, "");
  const brasileiroComCodigo =
    (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55");

  /* O `+` é declaração de código de país, e precisa ser respeitada. Sem esta
     checagem, `+1 415 555 0100` — onze dígitos, como um celular daqui — ganhava
     um 55 na frente e virava link para um número brasileiro que não é de
     ninguém conhecido. Foi o teste que pegou. */
  if (numero.trim().startsWith("+")) {
    return brasileiroComCodigo ? `https://wa.me/${digitos}` : null;
  }

  // Sem código: fixo com DDD (10) ou celular com DDD (11).
  if (digitos.length === 10 || digitos.length === 11) return `https://wa.me/55${digitos}`;

  return brasileiroComCodigo ? `https://wa.me/${digitos}` : null;
}

export function collaboratorInitials(name: string): string {
  if (!name) return '??';
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000000) {
    return `R$ ${(value / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  }
  if (abs >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}
