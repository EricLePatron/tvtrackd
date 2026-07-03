import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    supabase
      .from("profiles")
      .select("username")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setUsername(data.username);
      });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <>
      <ScreenHeader eyebrow="Compte" title="Profil" />
      <div className="mx-5 space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-surface-elevated flex items-center justify-center">
              <span className="font-display text-lg text-primary">
                {(username ?? email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg text-foreground truncate">
                {username ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{email ?? "…"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Séries", value: "0" },
            { label: "Épisodes", value: "0" },
            { label: "Heures", value: "0" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="font-counter text-2xl text-foreground">{s.value}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <Button
          onClick={signOut}
          variant="outline"
          className="w-full h-11 border-border bg-card text-foreground hover:bg-surface-elevated"
        >
          Se déconnecter
        </Button>
      </div>
    </>
  );
}
