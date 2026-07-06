import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
});

function safeRedirect(path: string | undefined): string {
  if (!path) return "/";
  // Only allow same-origin absolute paths.
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: authSearchSchema,
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

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
                mode === "signin"
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Inscription
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs uppercase tracking-wider text-muted-foreground">
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
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
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
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
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
