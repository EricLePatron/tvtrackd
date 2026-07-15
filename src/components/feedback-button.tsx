import { useState } from "react";
import { MessageSquarePlus, Bug, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { submitFeedback } from "@/lib/feedback.functions";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FeedbackType = "Bug" | "Improvement";

export function FeedbackButton({
  triggerClassName,
  triggerLabel,
}: {
  triggerClassName?: string;
  triggerLabel?: string;
} = {}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("Improvement");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = useServerFn(submitFeedback);

  const reset = () => {
    setMessage("");
    setEmail("");
    setType("Improvement");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      toast.error("Décrivez un peu plus votre retour (5 caractères min).");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        data: {
          type,
          message: message.trim(),
          email: email.trim() || (user?.email ?? ""),
        },
      });
      toast.success("Merci ! Votre retour a bien été envoyé.");
      reset();
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Envoi impossible. Réessayez dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Envoyer un retour"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageSquarePlus className="h-3 w-3" />
          Feedback
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Un bug ? Une idée ?
          </DialogTitle>
          <DialogDescription>
            Votre retour arrive directement dans notre backlog. Merci 🙏
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <TypeCard
              active={type === "Bug"}
              onClick={() => setType("Bug")}
              icon={<Bug className="h-4 w-4" />}
              label="Bug"
              hint="Quelque chose ne marche pas"
            />
            <TypeCard
              active={type === "Improvement"}
              onClick={() => setType("Improvement")}
              icon={<Sparkles className="h-4 w-4" />}
              label="Idée"
              hint="Suggestion d'amélioration"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="feedback-message"
              className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              Votre message
            </label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "Bug"
                  ? "Que s'est-il passé ? Sur quel écran ?"
                  : "Racontez-nous votre idée…"
              }
              rows={5}
              maxLength={2000}
              autoFocus
              required
            />
            <div className="text-right font-counter text-[10px] text-muted-foreground">
              {message.length}/2000
            </div>
          </div>

          {!user?.email && (
            <div className="space-y-1.5">
              <label
                htmlFor="feedback-email"
                className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Email (optionnel — pour vous répondre)
              </label>
              <Input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                maxLength={255}
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || message.trim().length < 5}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi…
              </>
            ) : (
              "Envoyer mon retour"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TypeCard({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-counter text-[10px] uppercase tracking-widest",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {icon}
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
