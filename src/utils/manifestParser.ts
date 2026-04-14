import { v4 as uuidv4 } from "uuid";
import type {
  CatalogSource,
  Folder,
  ManifestCatalog,
  ParsedManifest,
  TopLevelCollection,
} from "../types";

const DEFAULT_VIEW_MODE: TopLevelCollection["viewMode"] = "TABBED_GRID";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function getCatalogSourceKey(source: CatalogSource): string {
  return `${source.addonId}::${source.type}::${source.catalogId}`;
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function normalizeFolder(input: unknown): Folder {
  const folder = (input ?? {}) as Partial<Folder>;

  return {
    id: asString(folder.id) || uuidv4(),
    title: asString(folder.title) || "Untitled Folder",
    coverImageUrl: asNullableString(folder.coverImageUrl),
    focusGifUrl: asNullableString(folder.focusGifUrl),
    coverEmoji: asNullableString(folder.coverEmoji),
    tileShape:
      folder.tileShape === "SQUARE" ||
      folder.tileShape === "LANDSCAPE" ||
      folder.tileShape === "POSTER"
        ? folder.tileShape
        : "POSTER",
    hideTitle: Boolean(folder.hideTitle),
    catalogSources: Array.isArray(folder.catalogSources)
      ? folder.catalogSources
          .map((source) => ({
            addonId: asString((source as { addonId?: unknown }).addonId),
            type: asString((source as { type?: unknown }).type),
            catalogId: asString((source as { catalogId?: unknown }).catalogId),
            _missingFromManifest: Boolean(
              (source as { _missingFromManifest?: unknown })._missingFromManifest,
            ),
          }))
          .filter((source) => source.addonId && source.type && source.catalogId)
      : [],
    _coverMode:
      folder._coverMode === "emoji" || folder._coverMode === "image" || folder._coverMode === "none"
        ? folder._coverMode
        : folder.coverImageUrl
          ? "image"
          : folder.coverEmoji
            ? "emoji"
            : "none",
  };
}

export function createEmptyCollection(): TopLevelCollection {
  return {
    id: uuidv4(),
    title: "",
    backdropImageUrl: null,
    pinToTop: false,
    focusGlowEnabled: true,
    viewMode: DEFAULT_VIEW_MODE,
    showAllTab: true,
    folders: [],
  };
}

export function normalizeCollection(input: unknown): TopLevelCollection {
  const raw = Array.isArray(input) ? input[0] : input;
  const collection = (raw ?? {}) as Partial<TopLevelCollection>;

  return {
    id: asString(collection.id) || uuidv4(),
    title: asString(collection.title) || "Imported Catalog",
    backdropImageUrl: asNullableString(collection.backdropImageUrl),
    pinToTop: Boolean(collection.pinToTop),
    focusGlowEnabled:
      typeof collection.focusGlowEnabled === "boolean" ? collection.focusGlowEnabled : true,
    viewMode:
      collection.viewMode === "ROWS" ||
      collection.viewMode === "FOLLOW_HOME" ||
      collection.viewMode === "TABBED_GRID"
        ? collection.viewMode
        : DEFAULT_VIEW_MODE,
    showAllTab: typeof collection.showAllTab === "boolean" ? collection.showAllTab : true,
    folders: Array.isArray(collection.folders) ? collection.folders.map(normalizeFolder) : [],
  };
}

export function extractCollectionsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const collections = (payload as { collections?: unknown }).collections;
    if (Array.isArray(collections)) return collections;
  }

  return [payload];
}

export function applyManifestAvailability(
  collections: TopLevelCollection[],
  manifest: ParsedManifest | null,
): TopLevelCollection[] {
  if (!manifest) {
    return collections.map((collection) => ({
      ...collection,
      folders: collection.folders.map((folder) => ({
        ...folder,
        catalogSources: folder.catalogSources.map((source) => ({
          ...source,
          _missingFromManifest: false,
        })),
      })),
    }));
  }

  const available = new Set(
    manifest.catalogs.map((catalog) =>
      getCatalogSourceKey({
        addonId: manifest.addonId,
        type: catalog.type,
        catalogId: catalog.id,
      }),
    ),
  );

  return collections.map((collection) => ({
    ...collection,
    folders: collection.folders.map((folder) => ({
      ...folder,
      catalogSources: folder.catalogSources.map((source) => ({
        ...source,
        _missingFromManifest: !available.has(getCatalogSourceKey(source)),
      })),
    })),
  }));
}

function normalizeManifestUrl(input: string): string {
  const candidate = input.trim();
  const parsed = new URL(candidate);

  if (parsed.pathname.endsWith("/manifest.json") || parsed.pathname.endsWith(".json")) {
    return parsed.toString();
  }

  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/manifest.json`;
  return parsed.toString();
}

function normalizeManifestCatalog(input: unknown): ManifestCatalog | null {
  const catalog = input as Partial<ManifestCatalog>;
  const id = asString(catalog.id);
  const type = asString(catalog.type);

  if (!id || !type) {
    return null;
  }

  return {
    id,
    type,
    name: asString(catalog.name) || id,
    extra: Array.isArray(catalog.extra)
      ? catalog.extra.map((item) => ({
          name: asString((item as { name?: unknown }).name) || undefined,
          isRequired: Boolean((item as { isRequired?: unknown }).isRequired),
          options: Array.isArray((item as { options?: unknown[] }).options)
            ? (item as { options?: unknown[] }).options
                ?.map((option) => asString(option))
                .filter(Boolean)
            : undefined,
        }))
      : undefined,
  };
}

export async function fetchManifest(manifestInput: string): Promise<ParsedManifest> {
  const manifestUrl = normalizeManifestUrl(manifestInput);
  const response = await fetch(manifestUrl);

  if (!response.ok) {
    throw new Error(`Manifest request failed with status ${response.status}`);
  }

  const manifest = (await response.json()) as {
    id?: unknown;
    catalogs?: unknown[];
  };

  const addonId = asString(manifest.id);
  const catalogs = Array.isArray(manifest.catalogs)
    ? manifest.catalogs.map(normalizeManifestCatalog).filter((value): value is ManifestCatalog => Boolean(value))
    : [];

  if (!addonId) {
    throw new Error("Manifest is missing an addon id.");
  }

  return {
    addonId,
    catalogs,
    manifestUrl,
  };
}
