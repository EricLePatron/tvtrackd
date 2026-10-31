import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Link2, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { APP_NAME } from "@/lib/app-config";
import { buildShareCard, type ShareCardInput, type ShareFormat } from "@/lib/share-card";
import { SHARE_FORMATS } from "@/lib/share-layout";
import { cn } from "@/lib/utils";

export type ShareWatchProps = {
  card: ShareCardInput;
  /** Lien partagé (fiche série, ou accueil pour la semaine). */
  shareUrl: string;
  /** Légende (copiée / jointe au partage natif). */
  caption: string;
  /** Texte descriptif de l'aperçu (accessibilité). */
  previewAlt: string;
  /** Habillage du déclencheur ; "none" pour un usage contrôlé (open/onOpenChange). */
  triggerVariant?: "icon" | "button" | "none";
  triggerLabel?: string;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const FORMAT_KEY = "share-format";
const FORMAT_LABELS: Record<ShareFormat, string> = { story: "Story", post: "Publication" };

function fileSlug(card: ShareCardInput) {
  const p = (n: number) => String(n).padStart(2, "0");
  if (card.kind === "episode") return `s${p(card.season)}e${p(card.episode)}`;
  if (card.kind === "season") return `s${p(card.season)}`;
  return "semaine";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Révocation différée : certains navigateurs lisent le blob après le clic.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function withUtm(url: string, source: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=${source}&utm_medium=social&utm_campaign=share_watch`;
}

const secondaryBtn =
  "flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function ShareBody({
  card,
  shareUrl,
  caption,
  previewAlt,
}: Pick<ShareWatchProps, "card" | "shareUrl" | "caption" | "previewAlt">) {
  const [format, setFormat] = useState<ShareFormat>("story");
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const blobRef = useRef<Blob | null>(null);
  const previewRef = useRef<string | null>(null);

  // Format mémorisé (lecture après montage : SSR-safe).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORMAT_KEY);
      if (saved === "story" || saved === "post") setFormat(saved);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const cardKey = JSON.stringify(card);

  useEffect(() => {
    let cancelled = false;
    setPending(true);
    setFailed(false);
    blobRef.current = null;
    buildShareCard(JSON.parse(cardKey) as ShareCardInput, { format })
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = URL.createObjectURL(blob);
        setPreview(previewRef.current);
      })
      .catch(() => {
        if (cancelled) return;
        // Plus d'ancien aperçu : sinon « Partager » semblerait actif sans blob.
        blobRef.current = null;
        setPreview(null);
        setFailed(true);
        toast.error("Impossible de générer l'image de partage");
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cardKey, format, attempt]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const chooseFormat = (f: ShareFormat) => {
    setFormat(f);
    try {
      localStorage.setItem(FORMAT_KEY, f);
    } catch {
      /* ignore */
    }
  };

  const filename = `${APP_NAME}-${fileSlug(card)}-${format}.jpg`;
  const ready = !!preview && !pending && !failed;
  const spec = SHARE_FORMATS[format];

  const makeFile = () =>
    blobRef.current ? new File([blobRef.current], filename, { type: "image/jpeg" }) : null;

  const canShareFiles = (file: File) =>
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    const blob = blobRef.current;
    const file = makeFile();
    if (!blob || !file) {
      toast.error("Image indisponible, réessayez");
      return;
    }

    // Le lien est copié AVANT le partage natif : l'activation utilisateur est
    // encore valide (iOS la consomme dès le `await navigator.share`).
    const linkCopied = Promise.resolve(
      navigator.clipboard?.writeText(withUtm(shareUrl, "instagram")),
    ).then(
      () => true,
      () => false,
    );

    if (canShareFiles(file)) {
      try {
        await navigator.share({ files: [file], text: caption, url: withUtm(shareUrl, "share") });
        if (await linkCopied) toast.success("Lien copié, à coller en sticker");
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    // Repli desktop / navigateurs sans partage de fichier : un seul toast.
    downloadBlob(blob, filename);
    toast.success(
      (await linkCopied)
        ? "Image enregistrée et lien copié"
        : "Image enregistrée, à publier depuis votre téléphone",
    );
  };

  const save = async () => {
    const blob = blobRef.current;
    const file = makeFile();
    if (!blob || !file) {
      toast.error("Image indisponible, réessayez");
      return;
    }
    // iOS Safari ouvre un aperçu avec <a download> : on passe par la feuille
    // de partage (« Enregistrer l'image »).
    if (isIOS() && canShareFiles(file)) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    downloadBlob(blob, filename);
  };

  const shareOnX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(withUtm(shareUrl, "twitter"))}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const copyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${caption}\n${shareUrl}`);
      flashCopied();
      toast.success("Légende et lien copiés");
    } catch {
      toast.error("Copie impossible");
    }
  }, [caption, shareUrl]);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2 sm:px-0 sm:pb-0">
      <div
        role="radiogroup"
        aria-label="Format"
        className="mx-auto grid w-full max-w-[280px] grid-cols-2 rounded-md bg-surface-elevated p-1"
      >
        {(Object.keys(FORMAT_LABELS) as ShareFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={format === f}
            onClick={() => chooseFormat(f)}
            className={cn(
              "h-9 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              format === f
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {FORMAT_LABELS[f]}
          </button>
        ))}
      </div>

      <div
        aria-busy={pending}
        className="relative mx-auto h-[min(52vh,520px)] max-w-full overflow-hidden rounded-md bg-surface-elevated"
        style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
      >
        {!ready && !failed && (
          <div className="absolute inset-0 animate-pulse bg-surface-elevated" />
        )}
        {failed && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Génération de l'image impossible.</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="mt-3 h-10 rounded-md border border-white/[0.07] px-4 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}
        {preview && (
          <img
            src={preview}
            alt={previewAlt}
            className={cn("h-full w-full object-contain", pending && "opacity-0")}
          />
        )}
      </div>

      <p className="line-clamp-1 text-center text-xs text-muted-foreground">{caption}</p>

      <div>
        <button
          type="button"
          disabled={!ready}
          onClick={share}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Share2 className="h-5 w-5" />
          Partager
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Choisissez Instagram puis Story
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" disabled={!ready} onClick={save} className={secondaryBtn}>
          <Download className="h-4 w-4" />
          Enregistrer
        </button>
        <button type="button" onClick={shareOnX} className={secondaryBtn}>
          <Twitter className="h-4 w-4" />X
        </button>
        <button type="button" onClick={copyCaption} className={secondaryBtn}>
          {copied ? <Check className="h-4 w-4 text-cyan-accent" /> : <Link2 className="h-4 w-4" />}
          {copied ? "Copié" : "Légende"}
        </button>
      </div>
    </div>
  );
}

/**
 * Fenêtre « Partager » : bottom sheet sur mobile, dialogue sur desktop.
 * Aperçu au ratio réel du format (Story / Publication), bouton principal
 * unique. Instagram n'expose aucune URL d'intention web : le partage natif de
 * fichier (`navigator.share` avec `files`) est le seul chemin fiable sur
 * mobile ; sur desktop on retombe sur l'enregistrement de l'image.
 */
export function ShareWatchDialog({
  triggerVariant = "icon",
  triggerLabel = "Partager",
  triggerClassName,
  open: openProp,
  onOpenChange,
  ...body
}: ShareWatchProps) {
  const isMobile = useIsMobile();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };

  const trigger =
    triggerVariant === "icon" ? (
      <button
        type="button"
        aria-label={triggerLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.07] bg-white/[0.02] text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary",
          triggerClassName,
        )}
      >
        <Share2 className="h-4 w-4" />
      </button>
    ) : triggerVariant === "button" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
          triggerClassName,
        )}
      >
        <Share2 className="h-3.5 w-3.5" />
        {triggerLabel}
      </button>
    ) : null;

  return (
    <>
      {trigger}
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader className="pb-0">
              <DrawerTitle>Partager</DrawerTitle>
              <DrawerDescription className="sr-only">{body.caption}</DrawerDescription>
            </DrawerHeader>
            <ShareBody {...body} />
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Partager</DialogTitle>
              <DialogDescription className="sr-only">{body.caption}</DialogDescription>
            </DialogHeader>
            <ShareBody {...body} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
