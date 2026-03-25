"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Lock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCallbackUrl(rawValue: string | null) {
  if (!rawValue) return "/dashboard";
  if (!rawValue.startsWith("/") || rawValue.startsWith("//")) return "/dashboard";
  return rawValue;
}

// ─── Right-panel slides ───────────────────────────────────────────────────────

const slides = [
  {
    id: 0,
    headline: "Portal oficial de serviços da Sync para sua empresa.",
    sub: "Este login é a porta de entrada para atendimento, entregas e acompanhamento operacional.",
    accent: "#3b82f6",
    pattern: "grid",
  },
  {
    id: 1,
    headline: "Frentes especializadas para rotina pública e corporativa.",
    sub: "Consultoria, FUNDEB, terceirização, formação e atas de registro de preço em um único fluxo.",
    accent: "#8b5cf6",
    pattern: "dots",
  },
  {
    id: 2,
    headline: "Relação de serviço com governança, histórico e rastreabilidade.",
    sub: "Acesse solicitações, documentos e timeline de execução com transparência e controle.",
    accent: "#06b6d4",
    pattern: "lines",
  },
];

// ─── Architectural background pattern ─────────────────────────────────────────

function GridPattern({ accent }: { accent: string }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path
            d="M 60 0 L 0 0 0 60"
            fill="none"
            stroke={`${accent}18`}
            strokeWidth="1"
          />
        </pattern>
        <radialGradient id="glow" cx="60%" cy="40%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#glow)" />

      {/* corner lines */}
      <line x1="0" y1="0" x2="100%" y2="100%" stroke={`${accent}10`} strokeWidth="1" />
      <line x1="100%" y1="0" x2="0" y2="100%" stroke={`${accent}08`} strokeWidth="1" />

      {/* accent circle */}
      <circle cx="60%" cy="38%" r="140" fill="none" stroke={`${accent}20`} strokeWidth="1" />
      <circle cx="60%" cy="38%" r="90" fill="none" stroke={`${accent}15`} strokeWidth="1" />
      <circle cx="60%" cy="38%" r="40" fill={`${accent}14`} />
    </svg>
  );
}

function DotsPattern({ accent }: { accent: string }) {
  return (
    <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill={`${accent}22`} />
        </pattern>
        <radialGradient id="glow2" cx="55%" cy="45%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.15" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
      <rect width="100%" height="100%" fill="url(#glow2)" />
      <rect x="20%" y="20%" width="60%" height="60%" rx="24" fill="none" stroke={`${accent}18`} strokeWidth="1" />
      <rect x="30%" y="30%" width="40%" height="40%" rx="16" fill="none" stroke={`${accent}14`} strokeWidth="1" />
    </svg>
  );
}

function LinesPattern({ accent }: { accent: string }) {
  return (
    <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="lines" width="40" height="40" patternUnits="userSpaceOnUse">
          <line x1="0" y1="40" x2="40" y2="0" stroke={`${accent}18`} strokeWidth="1" />
        </pattern>
        <radialGradient id="glow3" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.14" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#lines)" />
      <rect width="100%" height="100%" fill="url(#glow3)" />
      <polygon points="50%,18% 82%,72% 18%,72%" fill="none" stroke={`${accent}18`} strokeWidth="1" />
    </svg>
  );
}

function SlidePattern({ pattern, accent }: { pattern: string; accent: string }) {
  if (pattern === "dots") return <DotsPattern accent={accent} />;
  if (pattern === "lines") return <LinesPattern accent={accent} />;
  return <GridPattern accent={accent} />;
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function RightPanel() {
  const [current, setCurrent] = useState(0);

  const prev = useCallback(
    () => setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1)),
    [],
  );
  const next = useCallback(
    () => setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1)),
    [],
  );

  const slide = slides[current];

  return (
    <motion.div
      className="relative hidden h-full overflow-hidden bg-neutral-900 lg:flex lg:flex-col"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      {/* Background pattern */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <SlidePattern pattern={slide.pattern} accent={slide.accent} />
        </motion.div>
      </AnimatePresence>

      {/* Dark overlay gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,12,0.45)_0%,rgba(10,10,12,0.82)_100%)]" />

      {/* Logo top-left */}
      <div className="relative z-10 p-10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 760 230"
          className="h-10 w-auto"
          aria-label="SYNC"
        >
          <defs>
            <filter id="rp-glow" x="-25%" y="-35%" width="170%" height="190%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#rp-glow)" transform="translate(20 0)">
            <line x1="36" y1="104" x2="126" y2="104" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.42" />
            <line x1="144" y1="104" x2="258" y2="104" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M 112 34 L 258 104 L 112 182" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M 112 34 L 138 104 L 112 182" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx="138" cy="104" r="10" fill="#14151a" stroke="#ffffff" strokeWidth="2.2" />
            <circle cx="138" cy="104" r="3.2" fill="#ffffff" />
          </g>
          <text x="310" y="114" fontFamily="'Segoe UI', Arial, sans-serif" fontWeight="700" fontSize="92" letterSpacing="20" fill="#ffffff">
            SYNC
          </text>
          <text x="284" y="170" fontFamily="'Segoe UI', Helvetica, sans-serif" fontWeight="300" fontSize="17" letterSpacing="3.6" fill="#a0a4ab">
            SERVIÇOS E OPERAÇÕES CORPORATIVAS
          </text>
        </svg>
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex flex-1 flex-col justify-end px-10 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="space-y-3"
          >
            {/* accent dot */}
            <span
              className="inline-block h-1.5 w-6 rounded-full"
              style={{ backgroundColor: slide.accent }}
            />
            <h2 className="max-w-sm text-2xl font-semibold leading-snug text-white">
              {slide.headline}
            </h2>
            <p className="max-w-xs text-sm leading-relaxed text-neutral-400">
              {slide.sub}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slider controls — bottom right */}
      <div className="absolute bottom-8 right-8 z-10 flex items-center gap-2">
        {/* dots */}
        <div className="mr-3 flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrent(i)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === current ? 20 : 6,
                backgroundColor: i === current ? slide.accent : "#4b5563",
              }}
              aria-label={`Slide ${i + 1} de ${slides.length}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={prev}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-400 backdrop-blur-sm transition-colors hover:border-neutral-500 hover:text-white"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={next}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-400 backdrop-blur-sm transition-colors hover:border-neutral-500 hover:text-white"
          aria-label="Próximo"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Ripple Overlay ───────────────────────────────────────────────────────────

function RippleOverlay({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 bg-blue-600"
          initial={{ clipPath: "circle(0% at 50% 50%)" }}
          animate={{ clipPath: "circle(150% at 50% 50%)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}

// ─── Left Panel / Form ────────────────────────────────────────────────────────

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const callbackUrl = resolveCallbackUrl(searchParams.get("next"));

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const handleSignIn = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);

    // Brief pause to let the ripple start, then trigger actual sign-in
    setTimeout(async () => {
      await signIn("google", { callbackUrl });
    }, 600);
  };

  return (
    <>
      <RippleOverlay active={isAuthenticating} />

      <div className="grid h-screen w-screen overflow-hidden bg-neutral-950 lg:grid-cols-2">
        {/* ── Left: Form ── */}
        <motion.div
          className="relative flex flex-col items-center justify-center px-6 py-10"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {/* Logo mobile */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 760 230"
              className="h-8 w-auto"
              aria-label="SYNC"
            >
              <defs>
                <filter id="mob-glow" x="-25%" y="-35%" width="170%" height="190%">
                  <feGaussianBlur stdDeviation="1.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g filter="url(#mob-glow)" transform="translate(20 0)">
                <line x1="36" y1="104" x2="126" y2="104" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.42" />
                <line x1="144" y1="104" x2="258" y2="104" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M 112 34 L 258 104 L 112 182" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M 112 34 L 138 104 L 112 182" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx="138" cy="104" r="10" fill="#050505" stroke="#fff" strokeWidth="2.2" />
                <circle cx="138" cy="104" r="3.2" fill="#fff" />
              </g>
              <text x="310" y="114" fontFamily="'Segoe UI', Arial, sans-serif" fontWeight="700" fontSize="92" letterSpacing="20" fill="#fff">SYNC</text>
            </svg>
          </div>

          {/* Form card */}
          <div className="w-full max-w-md space-y-8">
            {/* Header */}
            <div className="space-y-1">
              <h1 className="text-[2rem] font-semibold text-white">Entrar</h1>
              <p className="text-sm text-neutral-500">
                Entre com sua conta Google para acessar o portal de serviços da empresa.
              </p>
            </div>

            {/* Inputs — decorativos (auth real é Google OAuth) */}
            <div className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="text-xs font-medium uppercase tracking-widest text-neutral-500"
                >
                  Usuário
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                  <input
                    id="username"
                    type="text"
                    placeholder="seu@email.com"
                    autoComplete="username"
                    defaultValue=""
                    className="h-11 w-full rounded-lg border border-neutral-800 bg-neutral-900 pl-10 pr-4 text-sm text-white placeholder:text-neutral-700 transition-colors focus:border-neutral-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-widest text-neutral-500"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    defaultValue=""
                    className="h-11 w-full rounded-lg border border-neutral-800 bg-neutral-900 pl-10 pr-4 text-sm text-white placeholder:text-neutral-700 transition-colors focus:border-neutral-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Esqueci a senha */}
              <div className="flex justify-start pt-0.5">
                <button
                  type="button"
                  className="text-[11px] font-medium uppercase tracking-widest text-neutral-600 transition-colors hover:text-neutral-400"
                >
                  Esqueci a senha
                </button>
              </div>
            </div>

            {/* Sign In button */}
            <motion.button
              ref={btnRef}
              type="button"
              id="sign-in-btn"
              onClick={handleSignIn}
              disabled={isAuthenticating}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-blue-600 text-[13px] font-semibold uppercase tracking-widest text-white shadow-[0_0_28px_rgba(59,130,246,0.28)] transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {isAuthenticating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isAuthenticating ? "Entrando..." : "Entrar"}
            </motion.button>

            {/* Divisor */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-800" />
              <span className="text-[11px] uppercase tracking-widest text-neutral-700">
                ou continue com
              </span>
              <div className="h-px flex-1 bg-neutral-800" />
            </div>

            {/* Google button */}
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900 text-sm text-neutral-400 transition-colors hover:border-neutral-700 hover:text-white disabled:opacity-60"
            >
              {/* Google SVG icon */}
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Entrar com Google
            </button>
          </div>

          {/* Rodapé */}
          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-xs text-neutral-700">
            Precisa de acesso?{" "}
            <span className="cursor-pointer text-neutral-500 underline underline-offset-2 transition-colors hover:text-white">
              Fale com o gestor responsável
            </span>
          </p>
        </motion.div>

        {/* ── Right: Visual panel ── */}
        <RightPanel />
      </div>
    </>
  );
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function LoginFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950">
      <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
