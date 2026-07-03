import { Link } from "@tanstack/react-router";
import { Home, Search, Library, User } from "lucide-react";

const items = [
  { to: "/" as const, label: "Accueil", Icon: Home, exact: true },
  { to: "/search" as const, label: "Recherche", Icon: Search },
  { to: "/library" as const, label: "Bibliothèque", Icon: Library },
  { to: "/profile" as const, label: "Profil", Icon: User },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {items.map(({ to, label, Icon, exact }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: exact ?? false }}
              className="group flex flex-col items-center gap-1 py-2 text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-[10px] font-medium uppercase tracking-wider font-counter">
                {label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
