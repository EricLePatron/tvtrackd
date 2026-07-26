import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Library, CalendarDays, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const publicItems = [
  { to: "/" as const, label: "Accueil", Icon: Home, exact: true },
  { to: "/calendar" as const, label: "Calendrier", Icon: CalendarDays },
  { to: "/search" as const, label: "Recherche", Icon: Search },
];

const authedItems = [
  { to: "/" as const, label: "Accueil", Icon: Home, exact: true },
  { to: "/calendar" as const, label: "Calendrier", Icon: CalendarDays },
  { to: "/search" as const, label: "Recherche", Icon: Search },
  { to: "/library" as const, label: "Bibliothèque", Icon: Library },
];

export function BottomNav() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = user ? authedItems : publicItems;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
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
        {!user && !loading && (
          <li className="flex-1">
            <Link
              to="/auth"
              search={{ redirect: pathname }}
              className="group flex flex-col items-center gap-1 py-2 text-primary"
            >
              <LogIn className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-[10px] font-medium uppercase tracking-wider font-counter">
                Connexion
              </span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
