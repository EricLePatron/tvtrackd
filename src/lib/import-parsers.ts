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
};

export type ImportItem = GranularImportItem | AggregateImportItem;

export type DetectedFormat = "granular" | "betaseries";

export type ParseResult = {
  items: ImportItem[];
  detectedFormats: DetectedFormat[];
  warnings: string[];
};

export const FORMAT_LABELS: Record<DetectedFormat, string> = {
  granular: "TV Time / générique (historique épisode par épisode)",
  betaseries: "Betaseries (progression agrégée par série)",
};

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

  const items: ImportItem[] = [];
  const detectedFormats = new Set<DetectedFormat>();
  const warnings: string[] = [];

  for (const src of sources) {
    const isJson = /\.json$/i.test(src.name);
    const result = isJson ? parseJsonSource(src.text) : parseCsvSource(src.text);
    if (!result) {
      warnings.push(`${src.name} : format non reconnu, fichier ignoré.`);
      continue;
    }
    detectedFormats.add(result.format);
    items.push(...result.items);
    warnings.push(...result.warnings);
  }

  if (!items.length) {
    warnings.push("Aucune ligne exploitable trouvée dans le fichier.");
  }

  return { items, detectedFormats: [...detectedFormats], warnings };
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

const TITLE_KEYS = ["title", "tv_show_name", "show", "show_name", "series", "name"];
const YEAR_KEYS = ["year", "first_air_year", "release_year"];
const SEASON_KEYS = ["season", "season_number", "s"];
const EPISODE_KEYS = ["episode", "episode_number", "e"];
const WATCHED_KEYS = ["watched_at", "updated_at", "date", "seen_at", "created_at"];

function normalizeGranularRow(raw: unknown): GranularImportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const lower = lowerKeys(raw as Record<string, unknown>);

  const title = pick(lower, TITLE_KEYS);
  if (!title) return null;
  const season = pick(lower, SEASON_KEYS);
  const episode = pick(lower, EPISODE_KEYS);
  const year = pick(lower, YEAR_KEYS);
  const watched = pick(lower, WATCHED_KEYS);
  return {
    kind: "granular",
    title,
    year: year ? Number(year) : null,
    season: season ? Number(season) : null,
    episode: episode ? Number(episode) : null,
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
