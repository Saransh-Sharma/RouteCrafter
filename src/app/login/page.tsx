"use client";

import {
  useState,
  useCallback,
  useRef,
  Suspense,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Compass,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  User,
  ArrowRight,
  KeyRound,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

type Tab = "password" | "otp";

const TAB_ITEMS: { id: Tab; label: string; icon: typeof Lock }[] = [
  { id: "password", label: "Password", icon: Lock },
  { id: "otp", label: "Email OTP", icon: Mail },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectPath(searchParams.get("redirect"));

  const { login, sendOtp, verifyOtp, error, isSubmitting, clearError } =
    useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>("password");

  /* ---- Password state ---- */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /* ---- OTP state ---- */
  const [otpUsername, setOtpUsername] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* Clear errors on tab switch */
  const switchTab = useCallback(
    (tab: Tab) => {
      clearError();
      setActiveTab(tab);
    },
    [clearError],
  );

  const handleTabKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + TAB_ITEMS.length) % TAB_ITEMS.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % TAB_ITEMS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TAB_ITEMS.length - 1;
    }

    switchTab(TAB_ITEMS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  /* ---- Password submit ---- */
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    try {
      await login(username.trim(), password);
      router.push(redirectTo);
    } catch {
      /* error handled by store */
    }
  };

  /* ---- OTP send ---- */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpUsername.trim()) return;
    try {
      await sendOtp(otpUsername.trim());
      setOtpSent(true);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 120);
    } catch {
      /* error handled by store */
    }
  };

  /* ---- OTP verify ---- */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.join("");
    if (code.length < 6) return;
    try {
      await verifyOtp(otpUsername.trim(), code);
      router.push(redirectTo);
    } catch {
      /* error handled by store */
    }
  };

  /* ---- OTP input handling ---- */
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const next = [...otpCode];
    next[index] = value.slice(-1); // single digit
    setOtpCode(next);
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...otpCode];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || "";
    setOtpCode(next);
    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
  };

  const passwordValid = username.trim().length > 0 && password.trim().length > 0;
  const otpCodeComplete = otpCode.every((d) => d !== "");

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      {/* Brand */}
      <header className="mb-8 text-center">
        <div
          id="login-brand"
          className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-forest text-paper shadow-[var(--shadow-soft)]"
        >
          <Compass className="size-7" strokeWidth={1.6} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-muted">
          RouteCrafter
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in to your itinerary studio
        </p>
      </header>

      {/* Card */}
      <div className="rc-card overflow-hidden p-0">
        {/* ---- Tab bar ---- */}
        <div
          id="login-tabs"
          role="tablist"
          className="flex border-b border-border-soft"
        >
          {TAB_ITEMS.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              id={`login-tab-${id}`}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              type="button"
              aria-selected={activeTab === id}
              aria-controls={`login-panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => switchTab(id)}
              onKeyDown={(event) => handleTabKeyDown(index, event)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors",
                activeTab === id
                  ? "text-forest"
                  : "text-ink-muted hover:text-ink-soft",
              )}
            >
              <Icon className="size-4" />
              {label}
              {/* Active indicator */}
              {activeTab === id && (
                <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-forest animate-[scaleX_0.25s_ease-out]" />
              )}
            </button>
          ))}
        </div>

        {/* ---- Error banner ---- */}
        {error && (
          <div
            id="login-error"
            role="alert"
            className="flex items-start gap-2.5 border-b border-terracotta/20 bg-terracotta-soft/60 px-5 py-3 text-sm text-terracotta animate-[fadeSlideUp_0.2s_ease-out]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ---- Tab panels ---- */}
        <div className="px-5 pb-6 pt-5 sm:px-6">
          {/* === Password tab === */}
          {activeTab === "password" && (
            <form
              id="login-panel-password"
              role="tabpanel"
              aria-labelledby="login-tab-password"
              onSubmit={handlePasswordLogin}
              className="space-y-4 animate-[fadeSlideUp_0.3s_ease-out]"
            >
              {/* Username */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  Username
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    required
                    placeholder="your-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border-soft bg-paper-2/50 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted/60 transition focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/30"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border-soft bg-paper-2/50 pl-10 pr-11 text-sm text-ink placeholder:text-ink-muted/60 transition focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/30"
                  />
                  <button
                    id="login-toggle-password"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-ink-muted transition hover:text-ink-soft"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="login-submit-password"
                type="submit"
                disabled={!passwordValid || isSubmitting}
                className={cn(
                  "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                  "bg-forest text-paper shadow-[var(--shadow-soft)] hover:bg-forest-deep active:scale-[0.98]",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* === OTP tab === */}
          {activeTab === "otp" && (
            <div
              id="login-panel-otp"
              role="tabpanel"
              aria-labelledby="login-tab-otp"
              className="animate-[fadeSlideUp_0.3s_ease-out]"
            >
              {!otpSent ? (
                <form
                  id="login-form-otp-username"
                  onSubmit={handleSendOtp}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-otp-username"
                      className="block text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                      <input
                        id="login-otp-username"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        required
                        placeholder="your-username"
                        value={otpUsername}
                        onChange={(e) => setOtpUsername(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border-soft bg-paper-2/50 pl-10 pr-4 text-sm text-ink placeholder:text-ink-muted/60 transition focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/30"
                      />
                    </div>
                  </div>

                  <button
                    id="login-send-otp"
                    type="submit"
                    disabled={!otpUsername.trim() || isSubmitting}
                    className={cn(
                      "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                      "bg-forest text-paper shadow-[var(--shadow-soft)] hover:bg-forest-deep active:scale-[0.98]",
                      "disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Send code
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* OTP code entry */
                <form
                  id="login-form-otp-verify"
                  onSubmit={handleVerifyOtp}
                  className="space-y-5 animate-[fadeSlideUp_0.3s_ease-out]"
                >
                  {/* Confirmation message */}
                  <div className="rounded-xl bg-sage-soft/60 px-4 py-3 text-center">
                    <p className="text-sm text-forest">
                      <KeyRound className="mr-1.5 inline-block size-4 -translate-y-px" />
                      Code sent to the registered email for{" "}
                      <span className="font-semibold">{otpUsername}</span>
                    </p>
                  </div>

                  {/* OTP boxes */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      6-digit code
                    </label>
                    <div
                      className="flex items-center justify-between gap-2"
                      onPaste={handleOtpPaste}
                    >
                      {otpCode.map((digit, i) => (
                        <input
                          key={i}
                          id={`login-otp-${i}`}
                          ref={(element) => {
                            otpInputRefs.current[i] = element;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          aria-label={`Digit ${i + 1}`}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className={cn(
                            "h-12 w-12 rounded-xl border bg-paper-2/50 text-center font-display text-xl font-semibold text-ink transition",
                            digit
                              ? "border-forest/40 ring-1 ring-sage/30"
                              : "border-border-soft",
                            "focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-sage/30",
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    id="login-verify-otp"
                    type="submit"
                    disabled={!otpCodeComplete || isSubmitting}
                    className={cn(
                      "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
                      "bg-forest text-paper shadow-[var(--shadow-soft)] hover:bg-forest-deep active:scale-[0.98]",
                      "disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Verify &amp; sign in
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-3 text-xs text-ink-muted">
                    <button
                      id="login-change-username"
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode(["", "", "", "", "", ""]);
                        clearError();
                      }}
                      className="font-medium text-forest hover:text-forest-deep transition"
                    >
                      Change username
                    </button>
                    <span className="text-border-strong">·</span>
                    <button
                      id="login-resend-otp"
                      type="button"
                      disabled={isSubmitting}
                      onClick={async () => {
                        try {
                          await sendOtp(otpUsername.trim());
                        } catch {
                          /* error handled by store */
                        }
                      }}
                      className="font-medium text-forest hover:text-forest-deep transition disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-[26rem] animate-[fadeSlideUp_0.5s_ease-out_both]">
      <Suspense fallback={<div className="h-96 flex items-center justify-center"><Loader2 className="size-6 animate-spin text-forest" /></div>}>
        <LoginContent />
      </Suspense>

      {/* Footer note */}
      <p className="mt-6 text-center text-xs text-ink-muted/80">
        Craft beautiful itineraries, effortlessly.
      </p>

      {/* Keyframes for animations */}
      <style>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleX {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
      `}</style>
    </div>
  );
}
