import { useState } from "react";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  buildCategories,
  MAX_VISIBLE_PER_CATEGORY,
  providerInitials,
  type Category,
  type NetworkRef,
  type WatchProvider,
  type WatchProviders,
} from "@/lib/watch-providers";

// La route `show.$mediaType.$tmdbId.tsx` importe `WatchProviders`/`NetworkRef`
// depuis ce module : ré-exportés ici pour ne pas avoir à toucher la route.
export type { WatchProviders, NetworkRef } from "@/lib/watch-providers";

function ProviderTile({
  provider,
  showTitle,
  categoryLabel,
}: {
  provider: WatchProvider;
  showTitle: string;
  categoryLabel: string;
}) {
  const altText = `Regarder ${showTitle} sur ${provider.provider_name} (${categoryLabel})`;
  return (
    <div
      className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60"
      title={provider.provider_name}
    >
      {provider.logo_path ? (
        <img src={provider.logo_path} alt={altText} className="h-full w-full object-cover" />
      ) : (
        <span
          role="img"
          aria-label={altText}
          className="grid h-full w-full place-items-center bg-surface-elevated font-counter text-xs text-muted-foreground"
        >
          {providerInitials(provider.provider_name)}
        </span>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  showTitle,
  onShowAll,
}: {
  category: Category;
  showTitle: string;
  onShowAll: () => void;
}) {
  const visible = category.providers.slice(0, MAX_VISIBLE_PER_CATEGORY);
  const overflowCount = category.providers.length - visible.length;

  return (
    <div>
      <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
        {category.label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {visible.map((p) => (
          <ProviderTile
            key={p.provider_id}
            provider={p}
            showTitle={showTitle}
            categoryLabel={category.label}
          />
        ))}
        {overflowCount > 0 && (
          <button
            type="button"
            onClick={onShowAll}
            aria-label={`Voir toutes les offres (${overflowCount} de plus)`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border/60 bg-surface-elevated font-counter text-[11px] text-muted-foreground"
          >
            +{overflowCount}
          </button>
        )}
      </div>
    </div>
  );
}

function JustWatchAttribution({ link }: { link?: string | null }) {
  if (link) {
    return (
      <p className="mt-2 text-[10px] text-muted-foreground">
        Disponibilité fournie par{" "}
        <a href={link} target="_blank" rel="noreferrer" className="underline">
          JustWatch
        </a>
      </p>
    );
  }
  return (
    <p className="mt-2 text-[10px] text-muted-foreground">Disponibilité fournie par JustWatch</p>
  );
}

/**
 * Bloc "Où regarder" de la page série/film : offres de streaming FR
 * (abonnement / gratuit uniquement — Location/Achat volontairement exclus,
 * cf. CATEGORY_LABELS dans `@/lib/watch-providers`), issues de TMDb (motorisé
 * par JustWatch, attribution obligatoire). Tuiles non cliquables au P0 (pas
 * de deep-link), à l'exception de la tuile "+N" qui ouvre un drawer listant
 * toutes les offres groupées par catégorie.
 */
export function WhereToWatch({
  showTitle,
  watchProviders,
}: {
  showTitle: string;
  watchProviders: WatchProviders | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const categories = buildCategories(watchProviders);
  const link = watchProviders?.link;

  return (
    <div className="mx-5 mt-4">
      <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
        Où regarder
      </p>

      {categories.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Non disponible en streaming pour le moment en France.
        </p>
      ) : (
        <>
          <div className="mt-1.5 space-y-3">
            {categories.map((category) => (
              <CategoryRow
                key={category.key}
                category={category}
                showTitle={showTitle}
                onShowAll={() => setDrawerOpen(true)}
              />
            ))}
          </div>
          <JustWatchAttribution link={link} />
        </>
      )}

      {categories.length > 0 && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Où regarder {showTitle}</DrawerTitle>
            </DrawerHeader>
            <div className="space-y-4 px-4 pb-6">
              {categories.map((category) => (
                <div key={category.key}>
                  <p className="font-counter text-[10px] uppercase tracking-widest text-muted-foreground">
                    {category.label}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {category.providers.map((p) => (
                      <ProviderTile
                        key={p.provider_id}
                        provider={p}
                        showTitle={showTitle}
                        categoryLabel={category.label}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

/**
 * Ligne inline discrète "Diffusé sur X" sous les chips genres, séries
 * uniquement. N'affiche que la chaîne d'origine principale (premier élément
 * de `networks`, TMDb la renvoie déjà triée avec la chaîne principale en
 * tête) — pas de liste exhaustive au P0.
 */
export function NetworkLine({ networks }: { networks: NetworkRef[] | null }) {
  if (!networks || networks.length === 0) return null;
  const network = networks[0];
  return (
    <div className="mx-5 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      {network.logo_path && (
        <img src={network.logo_path} alt="" className="h-[18px] w-[18px] object-contain" />
      )}
      <span>Diffusé sur {network.name}</span>
    </div>
  );
}
