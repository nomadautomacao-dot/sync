/**
 * O que a rota do kit conta sobre o arquivo que acabou de emitir — e como isso
 * atravessa uma resposta cujo corpo já é o ZIP.
 *
 * ## Por que cabeçalho, e por que Base64
 *
 * A resposta de `/api/contratos-fundeb/generate-kit` é o próprio ZIP: não
 * sobra corpo para um JSON de aviso. E cabeçalho HTTP é ASCII — "Secretário"
 * cru derruba a resposta inteira, a mesma armadilha do `Content-Disposition`
 * com nome de município acentuado. Daí o Base64.
 *
 * ## Por que codificar e decodificar moram juntos
 *
 * Porque são um contrato de duas pontas: o servidor escreve, a tela lê. Em
 * arquivos separados, mudar o formato de um lado só produz um aviso que some
 * em silêncio — e o aviso existe justamente para o kit com lacuna não passar
 * por kit pronto.
 */

/** Campos que ficaram sem valor e recados sobre o que não entrou no ZIP. */
export interface ResumoDoKit {
  pendencias: string[];
  avisos: string[];
}

const VAZIO: ResumoDoKit = { pendencias: [], avisos: [] };

export function codificarResumoDoKit(resumo: ResumoDoKit): string {
  const bytes = new TextEncoder().encode(JSON.stringify(resumo));
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

/**
 * Cabeçalho ausente ou malformado vira resumo vazio, nunca exceção.
 *
 * Quando esta função roda, o ZIP já está na mão de quem pediu — derrubar o
 * download por causa do aviso sobre ele seria trocar o problema pequeno pelo
 * grande.
 */
export function lerResumoDoKit(cabecalho: string | null | undefined): ResumoDoKit {
  if (!cabecalho) return VAZIO;
  try {
    const binario = atob(cabecalho);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const bruto = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ResumoDoKit>;
    return {
      pendencias: Array.isArray(bruto.pendencias) ? bruto.pendencias.map(String) : [],
      avisos: Array.isArray(bruto.avisos) ? bruto.avisos.map(String) : [],
    };
  } catch {
    return VAZIO;
  }
}
