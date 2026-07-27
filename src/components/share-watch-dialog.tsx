import { useEffect, useRef, useState } from "react";
import { Download, Instagram, Link2, Loader2, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buildShareCard, type ShareCardInput } from "@/lib/share-card";
import { cn } from "@/lib/utils";

export type ShareWatchProps = ShareCardInput & {
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
 * copie de la légende. Twitter/X, lui, accepte une intention web mais
 * n'attache pas d'image : on y envoie la légende + le lien de la fiche.
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
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPending(true);
    buildShareCard(card)
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        setPreview(URL.createObjectURL(blob));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const filename = `tvtrackd-${card.counter.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  const shareInstagram = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${caption}\n${shareUrl}` });
        return;
      } catch {
        return; // partage annulé par l'utilisateur
      }
    }
    downloadBlob(blob, filename);
    try {
      await navigator.clipboard.writeText(`${caption}\n${shareUrl}`);
      toast.success("Image téléchargée et légende copiée — à publier dans Instagram");
    } catch {
      toast.success("Image téléchargée — à publier dans Instagram");
    }
  };

  const shareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      caption,
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${caption}\n${shareUrl}`);
      toast.success("Lien copié");
    } catch {
      toast.error("Copie impossible");
    }
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

        <div className="grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-md bg-surface-elevated">
          {pending || !preview ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <img src={preview} alt="Aperçu de la carte de partage" className="h-full w-full object-contain" />
          )}
        </div>

        <div className="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!preview}
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
            disabled={!preview}
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
            <Link2 className="h-4 w-4" />
            Copier
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
