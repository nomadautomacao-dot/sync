import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS das rotas de API.
 *
 * O app Flutter foi removido do repositório: a interface é o React deste mesmo
 * projeto. O bloqueio de `/flutter-web/` que existia aqui saiu junto — sem
 * bundle em `public/`, não há o que trancar. URLs antigas caem no redirect
 * declarado em `next.config.ts`.
 */
export function middleware(request: NextRequest) {
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
  matcher: ["/api/:path*"],
};
