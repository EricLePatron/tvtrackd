import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Instagram, Link2, Loader2, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buildShareCard, type ShareCardInput, type ShareFormat } from "@/lib/share-card";
import { cn } from "@/lib/utils";

export type ShareWatchProps = Omit<ShareCardInput, "format"> & {
  /** Lien canonique de la fiche (partagé en texte). */
  shareUrl: string;
  /** Légende pré-remplie (Twitter / presse-papier Instagram). */
  caption: string;
  /** Habillage du déclencheur. */
  triggerVariant?: "icon" | "button";
  triggerLabel?: string;
  triggerClassName?: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Partage social d'un épisode vu / d'une saison vue.
 *
 * Instagram n'expose aucune URL d'intention web : le seul chemin fiable est
 * le partage natif de fichier (`navigator.share` avec `files`, disponible
 * sur iOS/Android) et, à défaut (desktop), le téléchargement de l'image +
 * copie de la légende. On propose donc les deux formats attendus par
 * Instagram (post 4:5 et story 9:16) plutôt qu'un seul. Twitter/X, lui,
 * accepte une intention web mais n'attache pas d'image : on y envoie la
 * légende + le lien de la fiche.
 */
export function ShareWatchDialog({
  shareUrl,
  caption,
  triggerVariant = "icon",
  triggerLabel = "Partager",
  triggerClassName,
  ...card
}: ShareWatchProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShareFormat>("post");
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const previewRef = useRef<string | null>(null);

  const cardKey = JSON.stringify(card);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPending(true);
    blobRef.current = null;
    buildShareCard({ ...(JSON.parse(cardKey) as ShareCardInput), format })
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = URL.createObjectURL(blob);
        setPreview(previewRef.current);
      })
      .catch(() => {
        if (!cancelled) toast.error("Impossible de générer l'image de partage");
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, format, cardKey]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const slug = card.counter.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename = `tvtrackd-${slug}-${format}.png`;
  const text = `${caption}\n${shareUrl}`;

  const copyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, [text]);

  const shareInstagram = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      // La légende n'est pas reprise par Instagram lors d'un partage de
      // fichier : on la copie en amont pour un simple collage.
      await copyCaption();
      try {
        await navigator.share({ files: [file] });
        toast.success("Légende copiée — collez-la dans Instagram");
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    downloadBlob(blob, filename);
    const ok = await copyCaption();
    toast.success(
      ok
        ? "Image téléchargée et légende copiée — à publier dans Instagram"
        : "Image téléchargée — à publier dans Instagram",
    );
  };

  const shareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      caption,
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    if (await copyCaption()) toast.success("Lien et légende copiés");
    else toast.error("Copie impossible");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === "icon" ? (
          <button
            type="button"
            aria-label={triggerLabel}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.07] bg-white/[0.02] text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary",
              triggerClassName,
            )}
          >
            <Share2 className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              triggerClassName,
            )}
          >
            <Share2 className="h-3.5 w-3.5" />
            {triggerLabel}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Partager</DialogTitle>
          <DialogDescription>{caption}</DialogDescription>
        </DialogHeader>

        {/* Choix du format attendu par Instagram */}
        <div
          role="tablist"
          aria-label="Format de l'image"
          className="grid grid-cols-2 gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] p-1"
        >
          {(
            [
              { id: "post", label: "Post 4:5" },
              { id: "story", label: "Story 9:16" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              role="tab"
              type="button"
              aria-selected={format === f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                "h-8 rounded-sm font-mono text-[11px] uppercase tracking-wider transition-colors",
                format === f.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "grid w-full place-items-center overflow-hidden rounded-md bg-surface-elevated",
            format === "story" ? "aspect-[9/16] max-h-[46vh]" : "aspect-[4/5] max-h-[46vh]",
          )}
        >
          {pending || !preview ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <img
              src={preview}
              alt="Aperçu de la carte de partage"
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!preview || pending}
            onClick={shareInstagram}
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            <Instagram className="h-4 w-4" />
            Instagram
          </button>
          <button
            type="button"
            onClick={shareTwitter}
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-accent/40 bg-cyan-accent/10 text-xs font-medium text-cyan-accent transition-colors hover:bg-cyan-accent/20"
          >
            <Twitter className="h-4 w-4" />
            Twitter / X
          </button>
          <button
            type="button"
            disabled={!preview || pending}
            onClick={() => blobRef.current && downloadBlob(blobRef.current, filename)}
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Image
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-cyan-accent" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Instagram n'accepte pas de légende automatique : on la copie pour vous, il ne reste qu'à
          la coller.
        </p>
      </DialogContent>
    </Dialog>
  );
}
