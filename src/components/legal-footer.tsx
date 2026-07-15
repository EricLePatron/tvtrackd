import { Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-config";
import { FeedbackButton } from "@/components/feedback-button";

export function LegalFooter() {
  return (
    <footer className="mt-12 border-t border-border/40 px-4 py-6 text-xs text-muted-foreground">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link to="/legal/mentions-legales" className="hover:text-foreground transition-colors">
          Mentions légales
        </Link>
        <span aria-hidden className="opacity-40">·</span>
        <Link to="/legal/confidentialite" className="hover:text-foreground transition-colors">
          Confidentialité
        </Link>
        <span aria-hidden className="opacity-40">·</span>
        <Link to="/legal/cgu" className="hover:text-foreground transition-colors">
          CGU
        </Link>
        <span aria-hidden className="opacity-40">·</span>
        <Link to="/legal/cookies" className="hover:text-foreground transition-colors">
          Cookies
        </Link>
      </nav>
      <div className="mt-3 flex items-center justify-center gap-3">
        <FeedbackButton />
        <span aria-hidden className="opacity-40">·</span>
        <span className="opacity-70">© {new Date().getFullYear()} {APP_NAME}</span>
      </div>
    </footer>
  );
}
