import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Trava do app Flutter legado.
 *
 * O produto passou a ser a interface React. O Flutter continua no repositório
 * como fonte de consulta durante a migração (o Dart em `sync_flutter/lib/` é a
 * especificação de cada tela a portar), mas não é mais servido: o bundle em
 * `public/flutter-web/` fica inacessível pelo browser.
 *
 * Bloquear aqui, e não em `app/flutter-web/route.ts`, é o único jeito que
 * funciona: arquivos sob `public/` são servidos como estáticos antes de
 * qualquer rota, então uma Route Handler não intercepta `main.dart.js` e
 * companhia. O middleware roda antes de tudo.
 *
 * Efeito colateral bem-vindo: com o Flutter fora do ar, ele não tem como zerar
 * o `firebaseLocalStorage` da origem — era o que derrubava a sessão do React
 * quando as duas interfaces conviviam.
 *
 * Para comparar uma tela antiga durante a migração, rode o dev server com
 * `SYNC_FLUTTER_LEGADO=1 npm run dev:next`. A variável só vale fora de
 * produção; em produção o bundle fica trancado de qualquer forma.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/flutter-web" || pathname.startsWith("/flutter-web/")) {
    const liberado =
      process.env.NODE_ENV !== "production" && process.env.SYNC_FLUTTER_LEGADO === "1";
    if (!liberado) {
      const destino = new URL("/", request.url);
      destino.searchParams.set("legado", "trancado");
      return NextResponse.redirect(destino, 307);
    }
    return NextResponse.next();
  }

  // Preflight de CORS das rotas de API.
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/flutter-web", "/flutter-web/:path*"],
};
