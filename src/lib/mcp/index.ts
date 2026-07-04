import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchMedia from "./tools/search-media";
import listMyShows from "./tools/list-my-shows";
import followShow from "./tools/follow-show";

// Direct Supabase host required (RFC 8414). VITE_SUPABASE_PROJECT_ID is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tvtrackd-mcp",
  title: "tvtrackd",
  version: "0.1.0",
  instructions:
    "Outils pour tvtrackd : rechercher des séries/films TMDb, lister la bibliothèque de l'utilisateur connecté, et suivre une série/film avec un statut.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchMedia, listMyShows, followShow],
});
