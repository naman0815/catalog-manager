export interface CatalogSource {
  addonId: string;
  type: string;
  catalogId: string;
}

export interface ManifestCatalog {
  id: string;
  type: string;
  name: string;
  extra?: Array<{
    name?: string;
    isRequired?: boolean;
    options?: string[];
  }>;
}

export interface ParsedManifest {
  addonId: string;
  catalogs: ManifestCatalog[];
  manifestUrl: string;
}

export interface Folder {
  id: string;
  title: string;
  coverImageUrl: string | null;
  focusGifUrl: string | null;
  coverEmoji: string | null;
  tileShape: "SQUARE" | "POSTER" | "LANDSCAPE";
  hideTitle: boolean;
  catalogSources: CatalogSource[];
  _coverMode: "image" | "emoji" | "none";
}

export interface TopLevelCollection {
  id: string;
  title: string;
  backdropImageUrl: string | null;
  pinToTop: boolean;
  focusGlowEnabled: boolean;
  viewMode: "TABBED_GRID" | "ROWS" | "FOLLOW_HOME";
  showAllTab: boolean;
  folders: Folder[];
}

export interface CatalogFilePayload extends Array<TopLevelCollection> {}
