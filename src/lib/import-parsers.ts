// Parsers pour l'import d'historique (TV Time, Betaseries, exports génériques).
//
// Deux familles de format sont reconnues :
// - "granular"   : une ligne = un épisode vu (avec saison/épisode, et une date si dispo).
//                  Couvre les exports type TV Time et la plupart des outils tiers.
// - "betaseries" : export CSV agrégé par série de Betaseries
//                  (colonnes réelles observées : id,title,archive,episode,remaining,status,tags —
//                  `episode` est le dernier épisode vu au format SxxEyy, `status` un pourcentage
//                  de complétion, `archive` un booléen 0/1). Aucune date par épisode n'est fournie.
//
// Un fichier .zip (export GDPR TV Time) est dézippé côté client (fflate, import dynamique)
// et chacune de ses entrées .csv/.json est analysée indépendamment avec la même logique.
//
// Volontairement conservateur : un format non reconnu ne doit jamais être deviné silencieusement —
// il est signalé via `warnings` et ignoré plutôt que de produire un import incorrect.

export type GranularImportItem = {
  kind: "granular";
  title: string;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
  watched_at?: string | null;
};

export type AggregateImportItem = {
  kind: "aggregate";
  title: string;
  year?: number | null;
  lastSeason: number;
  lastEpisode: number;
  archived: boolean;
  percent: number | null;
  // Nombre d'épisodes vus déclaré par la source (TV Time user_tv_show_data),
  // utilisé quand aucun couple (saison, épisode) n'est fourni : le backend
  // marquera les N premiers épisodes comme vus.
  episodesSeenCount?: number | null;
};

export type ImportItem = GranularImportItem | AggregateImportItem;

export type DetectedFormat = "granular" | "betaseries";

export type ParseResult = {
  items: ImportItem[];
  detectedFormats: DetectedFormat[];
  warnings: string[];
};

export const FORMAT_LABELS: Record<DetectedFormat, string> = {
  granular: "TV Time / historique épisode par épisode",
  betaseries: "Betaseries (progression par série)",
};

// Fichiers du zip GDPR TV Time qui contiennent réellement l'historique de
// visionnage. Tout le reste (devices, notifications, ratings, movies, chats,
// etc.) est ignoré silencieusement — sinon les warnings noient l'utilisateur.
const TVTIME_HISTORY_FILE_HINTS = [
  "tracking-prod-records",
  "seen_episode",
  "watched",
  "history",
  "episodes",
  "user_tv_show_data", // liste des séries suivies + nb_episodes_seen (statut global)
];

function looksLikeTvTimeHistoryFile(name: string): boolean {
  const base = name.toLowerCase().replace(/^.*\//, "");
  return TVTIME_HISTORY_FILE_HINTS.some((h) => base.includes(h));
}

// ------- Point d'entrée -------

export async function parseImportFile(file: File): Promise<ParseResult> {
  const isZip = /\.zip$/i.test(file.name) || file.type === "application/zip";
  const sources = isZip
    ? await extractZipEntries(file)
    : [{ name: file.name, text: await file.text() }];

  if (!sources.length) {
    return {
      items: [],
      detectedFormats: [],
      warnings: ["Le fichier .zip ne contient aucune entrée .csv ou .json reconnaissable."],
    };
  }

  // Sur un zip TV Time on ne garde que les fichiers d'historique connus.
  // Les autres CSV (devices, ratings…) matcheraient parfois `title` et
  // pollueraient l'import avec des lignes bruit → unmatched trompeurs.
  const relevantSources = isZip
    ? sources.filter((s) => looksLikeTvTimeHistoryFile(s.name))
    : sources;
  const effectiveSources = relevantSources.length ? relevantSources : sources;

  const items: ImportItem[] = [];
  const detectedFormats = new Set<DetectedFormat>();
  const warnings: string[] = [];

  for (const src of effectiveSources) {
    const isJson = /\.json$/i.test(src.name);
    const result = isJson ? parseJsonSource(src.text) : parseCsvSource(src.text);
    if (!result) {
      // Silencieux dans un zip : on ne peut pas savoir à l'avance quels
      // fichiers TV Time contiennent des colonnes exploitables selon la
      // version de l'export.
      if (!isZip) warnings.push(`${src.name} : format non reconnu, fichier ignoré.`);
      continue;
    }
    detectedFormats.add(result.format);
    items.push(...result.items);
    warnings.push(...result.warnings);
  }

  const deduped = dedupeItems(items);

  if (!deduped.length) {
    warnings.push("Aucune ligne exploitable trouvée dans le fichier.");
  }

  return { items: deduped, detectedFormats: [...detectedFormats], warnings };
}

// Un même épisode apparaît souvent plusieurs fois dans un export TV Time
// (rewatch, resync appareil). On dédup sur (title|year|season|episode|jour)
// pour éviter un watch_count faussement gonflé côté serveur.
function dedupeItems(items: ImportItem[]): ImportItem[] {
  const seen = new Set<string>();
  const out: ImportItem[] = [];
  for (const it of items) {
    if (it.kind === "aggregate") {
      const k = `A|${it.title.toLowerCase()}|${it.year ?? ""}|${it.lastSeason}|${it.lastEpisode}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
      continue;
    }
    const day = it.watched_at ? String(it.watched_at).slice(0, 10) : "";
    const k = `G|${it.title.toLowerCase()}|${it.year ?? ""}|${it.season ?? ""}|${it.episode ?? ""}|${day}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

// ------- Dézippage (.zip GDPR TV Time) -------

async function extractZipEntries(file: File): Promise<{ name: string; text: string }[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const { unzipSync, strFromU8 } = await import("fflate");
  const unzipped = unzipSync(buf);
  const out: { name: string; text: string }[] = [];
  for (const [name, data] of Object.entries(unzipped)) {
    if (/\.(csv|json)$/i.test(name)) {
      out.push({ name, text: strFromU8(data) });
    }
  }
  return out;
}

// ------- Détection + parsing par source -------

type SourceResult = { format: DetectedFormat; items: ImportItem[]; warnings: string[] };

function parseCsvSource(text: string): SourceResult | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cells[idx] ?? ""));
    rows.push(row);
  }

  if (isBetaseriesShowsHeader(headers)) {
    const unrecognizedEpisodeTitles: string[] = [];
    const items = rows
      .map((row) => parseBetaseriesRow(row, unrecognizedEpisodeTitles))
      .filter((r): r is AggregateImportItem => !!r);
    if (!items.length) return null;
    return {
      format: "betaseries",
      items,
      warnings: summarizeUnrecognizedEpisodeWarnings(unrecognizedEpisodeTitles),
    };
  }

  // TV Time user_tv_show_data.csv : agrégé par série avec nb_episodes_seen —
  // seule source qui décrit vraiment le statut "suivi / à voir / vu partiellement"
  // pour l'ensemble de la bibliothèque (les CSV granulaires ne couvrent qu'une
  // fenêtre d'événements récents).
  if (isTvTimeShowsHeader(headers)) {
    const items = rows
      .map(parseTvTimeShowRow)
      .filter((r): r is AggregateImportItem => !!r);
    if (!items.length) return null;
    return { format: "granular", items, warnings: [] };
  }

  const items = rows.map(normalizeGranularRow).filter((r): r is GranularImportItem => !!r);
  if (!items.length) return null;
  return { format: "granular", items, warnings: [] };
}

function parseJsonSource(text: string): SourceResult | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const flatRows = flattenJsonRows(raw);
  const items = flatRows.map(normalizeGranularRow).filter((r): r is GranularImportItem => !!r);
  if (!items.length) return null;
  return { format: "granular", items, warnings: [] };
}

// ------- Betaseries (export agrégé par série) -------

function isBetaseriesShowsHeader(headers: string[]): boolean {
  return (
    headers.includes("archive") &&
    headers.includes("remaining") &&
    headers.includes("status") &&
    headers.includes("title")
  );
}

// Regroupe les avertissements par motif plutôt qu'un par ligne : un export avec
// beaucoup de lignes au format non standard ne doit jamais produire une liste de
// warnings non bornée (voir profile.tsx pour le plafond d'affichage côté UI).
function summarizeUnrecognizedEpisodeWarnings(titles: string[]): string[] {
  if (!titles.length) return [];
  const preview = titles.slice(0, 3).join(", ");
  const ellipsis = titles.length > 3 ? ", …" : "";
  return [
    `Format d'épisode non reconnu pour ${titles.length} entrée(s) Betaseries (ex. ${preview}${ellipsis}) — elles seront suivies sans épisode marqué vu.`,
  ];
}

function parseBetaseriesRow(
  row: Record<string, string>,
  unrecognizedEpisodeTitles: string[],
): AggregateImportItem | null {
  const title = row["title"]?.trim();
  if (!title) return null;
  const episodeRaw = (row["episode"] ?? "").trim();
  const epMatch = /^s(\d+)e(\d+)$/i.exec(episodeRaw);
  if (!epMatch) {
    unrecognizedEpisodeTitles.push(title);
  }
  const lastSeason = epMatch ? Number(epMatch[1]) : 0;
  const lastEpisode = epMatch ? Number(epMatch[2]) : 0;
  const archived = row["archive"]?.trim() === "1";
  const percentRaw = row["status"]?.trim();
  const percent = percentRaw && Number.isFinite(Number(percentRaw)) ? Number(percentRaw) : null;
  return {
    kind: "aggregate",
    title,
    year: null,
    lastSeason,
    lastEpisode,
    archived,
    percent,
  };
}

// ------- Format granulaire (TV Time / outils tiers / générique) -------

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function lowerKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) lower[k.toLowerCase()] = raw[k];
  return lower;
}

const TITLE_KEYS = [
  "title",
  "tv_show_name",
  "series_name",
  "show",
  "show_name",
  "series",
  "name",
];
const YEAR_KEYS = ["year", "first_air_year", "release_year"];
const SEASON_KEYS = ["season", "season_number", "episode_season_number", "s"];
const EPISODE_KEYS = ["episode", "episode_number", "e"];
const WATCHED_KEYS = ["watched_at", "updated_at", "date", "seen_at", "created_at"];
// TV Time écrit `entity_type` = "episode" | "movie" | "show" dans son log
// unifié (tracking-prod-records.csv). Le format v2 utilise plutôt `bulk_type`
// avec la valeur "season" pour un épisode vu (clé `watch-episode-…`). On
// accepte les deux et on ignore les autres types (follow, count-watch-movie…).
const TYPE_KEYS = ["entity_type", "type", "media_type", "bulk_type"];
const TYPE_EPISODE_VALUES = new Set([
  "episode",
  "tv",
  "tv_episode",
  "show_episode",
  "season", // tracking-prod-records-v2 : bulk_type=season pour un watch d'épisode
]);

function normalizeGranularRow(raw: unknown): GranularImportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const lower = lowerKeys(raw as Record<string, unknown>);

  const type = pick(lower, TYPE_KEYS)?.toLowerCase();
  // Filtre uniquement quand un `entity_type` explicite non-épisode est présent
  // — sinon on reste permissif (beaucoup d'exports tiers n'ont pas ce champ).
  if (type && !TYPE_EPISODE_VALUES.has(type)) return null;

  const title = pick(lower, TITLE_KEYS);
  if (!title) return null;
  const season = pick(lower, SEASON_KEYS);
  const episode = pick(lower, EPISODE_KEYS);
  // Sans saison ni épisode, un item granulaire est inexploitable côté serveur
  // (searchTv le compterait en unmatched trompeur). On l'écarte tôt.
  if (!season || !episode) return null;
  const year = pick(lower, YEAR_KEYS);
  const watched = pick(lower, WATCHED_KEYS);
  return {
    kind: "granular",
    title,
    year: year ? Number(year) : null,
    season: Number(season),
    episode: Number(episode),
    watched_at: watched ?? null,
  };
}

// Aplatit une structure JSON imbriquée (série -> liste d'épisodes, éventuellement
// sur deux niveaux série -> saisons -> épisodes) en lignes plates exploitables par
// normalizeGranularRow. Reste volontairement permissif : plusieurs clés de tableau
// imbriqué possibles, car le format JSON réel des exports tiers n'est pas figé.
const NESTED_LIST_KEYS = ["episodes", "seen_episodes", "watched_episodes", "seasons"];

function flattenJsonRows(raw: unknown): Record<string, unknown>[] {
  let top: unknown[];
  if (Array.isArray(raw)) {
    top = raw;
  } else {
    const wrapper = (raw ?? {}) as Record<string, unknown>;
    const candidate = wrapper.items ?? wrapper.episodes ?? wrapper.data ?? wrapper.shows ?? [];
    top = Array.isArray(candidate) ? candidate : [];
  }

  const flat: Record<string, unknown>[] = [];
  for (const row of top) {
    flattenInto(row, {}, flat, 0);
  }
  return flat;
}

function flattenInto(
  row: unknown,
  inherited: Record<string, unknown>,
  out: Record<string, unknown>[],
  depth: number,
): void {
  if (!row || typeof row !== "object") return;
  const rowObj = row as Record<string, unknown>;
  const lower = lowerKeys(rowObj);
  const nestedKey = depth < 2 ? NESTED_LIST_KEYS.find((k) => Array.isArray(rowObj[k])) : undefined;

  if (nestedKey) {
    const carried: Record<string, unknown> = {
      ...inherited,
      title: pick(lower, TITLE_KEYS) ?? inherited["title"],
      year: pick(lower, YEAR_KEYS) ?? inherited["year"],
      season: pick(lower, SEASON_KEYS) ?? inherited["season"],
    };
    for (const sub of rowObj[nestedKey] as unknown[]) {
      flattenInto(sub, carried, out, depth + 1);
    }
    return;
  }

  out.push({ ...inherited, ...rowObj });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === "," || c === ";") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}
