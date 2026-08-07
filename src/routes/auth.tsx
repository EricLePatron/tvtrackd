import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup"]).optional(),
});

function safeRedirect(path: string | undefined): string {
  if (!path) return "/";
  // Only allow same-origin absolute paths.
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  // Wrapped in try/catch rather than passing `authSearchSchema` directly:
  // TanStack Router's zod-schema shorthand throws uncaught on a malformed
  // `mode` (anything outside the enum — typo'd marketing link, empty
  // `?mode=`, etc.), which bubbles up to the root `errorComponent` and
  // replaces the entire auth screen with a generic "This page didn't load"
  // — on the signup/signin flow, the single most critical route in the app.
  // Falling back to `{}` (→ `mode: undefined` → default "signin") keeps the
  // form usable no matter what garbage lands in the query string.
  validateSearch: (search: Record<string, unknown>) => {
    try {
      return authSearchSchema.parse(search);
    } catch {
      return {};
    }
  },
  head: () => ({
    meta: [
      { title: "Connexion — tvtrackd" },
      { name: "description", content: "Connectez-vous ou créez un compte tvtrackd." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const target = safeRedirect(search.redirect);
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Connexion Google impossible");
        return;
      }
      if (result.redirected) return;
      navigate({ to: target });
    } catch {
      toast.error("Connexion Google impossible");
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target });
    });
  }, [navigate, target]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Compte créé", { description: "Vous pouvez maintenant vous connecter." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: target });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-counter text-xs uppercase tracking-[0.2em] text-muted-foreground">
              N/F · 001
            </span>
          </div>
          <h1 className="font-display text-4xl text-foreground">tvtrackd</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Le carnet nocturne de vos séries & films.
          </p>
        </div>

        <div className="rounded-xl bg-card border border-border p-6">
          <div className="flex mb-6 rounded-lg bg-background p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "signin" ? "bg-surface-elevated text-foreground" : "text-muted-foreground"
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "signup" ? "bg-surface-elevated text-foreground" : "text-muted-foreground"
              }`}
            >
              Inscription
            </button>
          </div>

          <Button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            variant="outline"
            className="w-full h-11 gap-2 border-border bg-surface-elevated text-foreground hover:bg-surface-elevated/70"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.5 5.5 0 0 1-2.4 3.6v3h3.88c2.27-2.09 3.58-5.17 3.58-8.78Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.08 7.94-2.93l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.29 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.28a12 12 0 0 0 0 10.74l4.01-3.1Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.17 15.23 0 12 0A12 12 0 0 0 1.28 6.63l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
              />
            </svg>
            {googleLoading ? "…" : "Continuer avec Google"}
          </Button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
              ou
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>



          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Pseudo
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nightowl"
                  className="bg-background border-border h-11"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@tvtrackd.app"
                className="bg-background border-border h-11"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-background border-border h-11 font-counter"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              {loading ? "…" : mode === "signin" ? "Se connecter" : "Créer un compte"}
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground font-counter uppercase tracking-widest">
          <Link to="/">← retour</Link>
        </p>
      </div>
    </main>
  );
}
