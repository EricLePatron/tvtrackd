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
import { buildShareCard, type ShareCardInput } from "@/lib/share-card";
import { cn } from "@/lib/utils";

export type ShareWatchProps = Omit<ShareCardInput, "format"> & {
  /** Lien canonique de la fiche (partagé en texte). */
  shareUrl: string;
  /** Légende pré-remplie (copiée pour Instagram). */
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
 * Partage social d'un épisode vu / d'une saison vue — flow simplifié :
 * un seul format (story 9:16) et un seul geste principal (« Story
 * Instagram »). Instagram n'expose aucune URL d'intention web : le partage
 * natif de fichier (`navigator.share` avec `files`) est le seul chemin
 * fiable sur mobile ; sur desktop on retombe sur le téléchargement de
 * l'image + copie de la légende.
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
  const [copied, setCopied] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const previewRef = useRef<string | null>(null);

  const cardKey = JSON.stringify(card);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPending(true);
    blobRef.current = null;
    buildShareCard({ ...(JSON.parse(cardKey) as ShareCardInput), format: "story" })
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
  }, [open, cardKey]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const slug = card.counter.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename = `tvtrackd-${slug}-story.png`;
  const text = `${caption}\n${shareUrl}`;

  const copyText = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);

  const shareInstagram = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      // Instagram ne rend pas l'image cliquable : le seul moyen de renvoyer
      // vers la fiche est le sticker « Lien ». On copie donc l'URL de la
      // série en amont pour un simple collage dans ce sticker.
      await copyText(shareUrl);
      try {
        await navigator.share({ files: [file], url: shareUrl });
        toast.success("Lien de la série copié — collez-le dans le sticker « Lien »");
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    downloadBlob(blob, filename);
    const ok = await copyText(shareUrl);
    toast.success(
      ok
        ? "Image téléchargée et lien copié — ajoutez un sticker « Lien » à la story"
        : "Image téléchargée — à publier en story",
    );
  };

  const shareTwitter = async () => {
    // X n'accepte pas de fichier via une URL d'intention : on télécharge
    // l'image pour que l'utilisateur l'attache au tweet pré-rempli.
    if (blobRef.current) downloadBlob(blobRef.current, filename);
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
    toast.success("Image téléchargée — attachez-la à votre tweet");
  };

  const copyLink = async () => {
    if (await copyText(text)) toast.success("Lien et légende copiés");
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
          <DialogTitle>Partager en story</DialogTitle>
          <DialogDescription>{caption}</DialogDescription>
        </DialogHeader>

        <div className="grid aspect-[9/16] max-h-[48vh] w-full place-items-center overflow-hidden rounded-md bg-surface-elevated">
          {pending || !preview ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <img
              src={preview}
              alt="Aperçu de la story"
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <button
          type="button"
          disabled={!preview || pending}
          onClick={shareInstagram}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Instagram className="h-5 w-5" />
          Partager en story
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!preview || pending}
            onClick={shareTwitter}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <Twitter className="h-4 w-4" />X
          </button>
          <button
            type="button"
            disabled={!preview || pending}
            onClick={() => blobRef.current && downloadBlob(blobRef.current, filename)}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Image
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-cyan-accent" /> : <Link2 className="h-4 w-4" />}
            {copied ? "Copié" : "Lien"}
          </button>
        </div>


      </DialogContent>
    </Dialog>
  );
}
