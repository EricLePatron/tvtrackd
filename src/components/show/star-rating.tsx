import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { cn } from "@/lib/utils";

type Props = {
  showId: number | undefined;
};

export function StarRating({ showId }: Props) {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const qc = useQueryClient();
  const [hover, setHover] = useState<number | null>(null);

  const key = ["show-rating", user?.id, showId];
  const { data: rating } = useQuery({
    queryKey: key,
    enabled: !!user && !!showId,
    queryFn: async () => {
      const { data } = await supabase
        .from("show_ratings")
        .select("rating")
        .eq("user_id", user!.id)
        .eq("show_id", showId!)
        .maybeSingle();
      return data?.rating ?? 0;
    },
  });

  const mutate = useMutation({
    mutationFn: async (value: number) => {
      if (!user || !showId) throw new Error("no user");
      if (value === 0) {
        const { error } = await supabase
          .from("show_ratings")
          .delete()
          .eq("user_id", user.id)
          .eq("show_id", showId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("show_ratings").upsert(
          { user_id: user.id, show_id: showId, rating: value },
          { onConflict: "user_id,show_id" },
        );
        if (error) throw error;
      }
    },
    onMutate: async (value) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<number>(key);
      qc.setQueryData<number>(key, value);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev);
      toast.error("Impossible d'enregistrer votre note.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const current = hover ?? rating ?? 0;

  const handleClick = (value: number) => {
    requireAuth(
      () => {
        const next = rating === value ? 0 : value;
        mutate.mutate(next);
      },
      { reason: "noter cette série" },
    );
  };

  return (
    <div className="mx-5 mt-6">
      <p className="font-counter text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        Votre note
      </p>
      <div
        className="mt-1.5 flex items-center gap-1"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleClick(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`Noter ${n} étoile${n > 1 ? "s" : ""}`}
            className="p-1 -m-1 transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                n <= current
                  ? "fill-[hsl(var(--accent-amber))] text-[hsl(var(--accent-amber))]"
                  : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
        {rating ? (
          <span className="ml-2 font-counter text-xs text-muted-foreground">
            {rating}/5
          </span>
        ) : null}
      </div>
    </div>
  );
}
