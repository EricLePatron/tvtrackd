import { supabase } from "@/integrations/supabase/client";

/**
 * Crée (ou laisse intacte) la ligne `user_shows` pour un follow.
 *
 * Si la ligne existe déjà (`alreadyFollowed`), ne fait RIEN : `status` et
 * `manual_override` sont déjà en place et ne doivent jamais être écrasés par
 * une re-écriture de "a_voir" (c'est le garde-fou défense-en-profondeur déjà
 * en place pour les clics "+" sur un item déjà suivi, cf. use-quick-follow).
 *
 * Si la ligne n'existe pas encore, calcule le statut initial via le RPC
 * `compute_my_show_status` plutôt que de figer "a_voir" en dur : le tracking
 * épisode par épisode ne requiert pas d'avoir suivi la série au préalable
 * (voir show.$mediaType.$tmdbId.tsx), un utilisateur peut donc avoir déjà des
 * `watch_status` pour cette série avant son tout premier "Suivre" — le statut
 * initial doit refléter cette progression plutôt que de repartir de zéro.
 * Le RPC est scopé sur `auth.uid()` côté SQL (jamais de user_id arbitraire).
 * Pour les films, le RPC renvoie toujours NULL (pas de progression
 * calculable) : on retombe alors sur "a_voir", comme avant.
 */
export async function followShow(userId: string, showId: number, alreadyFollowed: boolean) {
  if (alreadyFollowed) return;

  const { data: computed } = await supabase.rpc("compute_my_show_status", {
    p_show_id: showId,
  });

  const { error } = await supabase
    .from("user_shows")
    .upsert(
      { user_id: userId, show_id: showId, status: computed ?? "a_voir" },
      { onConflict: "user_id,show_id" },
    );
  if (error) throw error;
}

/**
 * Supprime la ligne `user_shows` d'un utilisateur pour une série ("Ne plus
 * suivre"). Ne touche jamais `watch_status` : l'historique de visionnage est
 * conservé (cf. CLAUDE.md — ne jamais coupler l'archivage/désarchivage et
 * l'historique d'épisodes vus dans la même table). Si l'utilisateur suit à
 * nouveau la série plus tard, `followShow` retrouvera cet historique via
 * `compute_my_show_status` et recalculera le bon statut initial.
 */
export async function unfollowShow(userId: string, showId: number) {
  const { error } = await supabase
    .from("user_shows")
    .delete()
    .eq("user_id", userId)
    .eq("show_id", showId);
  if (error) throw error;
}
