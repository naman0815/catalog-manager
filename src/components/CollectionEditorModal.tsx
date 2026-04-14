import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  ChevronRight,
  Film,
  GripVertical,
  Grid2x2,
  Image,
  Pencil,
  Plus,
  RectangleHorizontal,
  Search,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import type { CatalogSource, Folder, ParsedManifest, TopLevelCollection } from "../types";
import { moveItem } from "../utils/manifestParser";

// ─── helpers ────────────────────────────────────────────────────────────────

const PRESET_EMOJIS = [
  "🎬", "🍿", "🎭", "🎪", "😎", "👻", "👽", "🤖", "🤠", "🧛",
  "🧟", "🧙", "🦸", "🦹", "🥷", "🕵️", "🚀", "🪐", "🌍", "⚔️",
  "🔫", "💣", "🩸", "💀", "⚽", "🏀", "🏎️", "🐎", "🎤", "🎸",
  "🎷", "🎺", "🥁", "🎨", "🧩", "🎲", "🧸", "🎉", "🔥", "✨",
  "❤️", "💔", "😂", "🤡", "👹", "👺", "🐉", "🦄", "🕊️", "🐾",
];

function createEmptyFolder(name = ""): Folder {
  return {
    id: uuidv4(),
    title: name,
    coverImageUrl: null,
    focusGifUrl: null,
    coverEmoji: null,
    tileShape: "POSTER",
    hideTitle: false,
    catalogSources: [],
    _coverMode: "none",
  };
}

const shapeAspectRatios: Record<Folder["tileShape"], string> = {
  POSTER: "2 / 3",
  SQUARE: "1 / 1",
  LANDSCAPE: "16 / 9",
};
const shapeWidths: Record<Folder["tileShape"], number> = {
  POSTER: 90,
  SQUARE: 110,
  LANDSCAPE: 160,
};

function formatCatalogType(type: string) {
  const normalized = type.trim().toLowerCase();
  if (normalized.includes("move")) return "move";
  if (normalized.includes("series")) return "series";
  return normalized.split(/[\s._/-]+/).filter(Boolean)[0] || normalized;
}

// ─── types ───────────────────────────────────────────────────────────────────

type CollectionStep = "basics" | "folders" | "appearance";

interface CollectionEditorModalProps {
  collection: TopLevelCollection;
  manifest: ParsedManifest | null;
  onClose: () => void;
  onSave: (collection: TopLevelCollection) => void;
  preventOutsideClick?: boolean;
}

// ─── FolderMiniEditor ────────────────────────────────────────────────────────
// Expanded inline editor for a single folder (opened when you click "Edit" on a folder row)

interface FolderMiniEditorProps {
  folder: Folder;
  manifest: ParsedManifest | null;
  isMobile: boolean;
  onSave: (f: Folder) => void;
  onCancel: () => void;
}

function FolderMiniEditor({ folder, manifest, isMobile, onSave, onCancel }: FolderMiniEditorProps) {
  const [draft, setDraft] = useState<Folder>(folder);
  const [tab, setTab] = useState<"basics" | "catalogs" | "appearance">("basics");
  const [catalogFilter, setCatalogFilter] = useState("");
  const deferredFilter = useDeferredValue(catalogFilter);
  const [newPosterUrl, setNewPosterUrl] = useState("");
  const [draggingCatalogKey, setDraggingCatalogKey] = useState<string | null>(null);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const catalogPickerRef = useRef<HTMLDivElement | null>(null);

  const update = <K extends keyof Folder>(field: K, value: Folder[K]) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const activeCatalogs = useMemo(
    () => new Set(draft.catalogSources.map((s) => `${s.addonId}::${s.type}::${s.catalogId}`)),
    [draft.catalogSources],
  );

  const visibleCatalogs = useMemo(() => {
    const catalogs = manifest?.catalogs ?? [];
    const q = deferredFilter.trim().toLowerCase();
    return catalogs
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [deferredFilter, manifest]);

  const catalogNameByKey = useMemo(() => {
    const catalogs = manifest?.catalogs ?? [];
    return new Map(
      catalogs.map((catalog) => [
        `${manifest?.addonId ?? ""}::${catalog.type}::${catalog.id}`,
        catalog.name,
      ]),
    );
  }, [manifest]);

  const addCatalog = (catalogId: string, type: string) => {
    if (!manifest) return;
    const src: CatalogSource = { addonId: manifest.addonId, catalogId, type };
    const key = `${src.addonId}::${src.type}::${src.catalogId}`;
    if (activeCatalogs.has(key)) return;
    update("catalogSources", [...draft.catalogSources, src]);
    setCatalogFilter("");
    setCatalogPickerOpen(false);
  };

  const removeCatalog = (src: CatalogSource) =>
    update(
      "catalogSources",
      draft.catalogSources.filter(
        (s) => !(s.addonId === src.addonId && s.catalogId === src.catalogId && s.type === src.type),
      ),
    );

  const moveCatalogByKey = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;

    update("catalogSources", (() => {
      const fromIndex = draft.catalogSources.findIndex(
        (source) => `${source.addonId}::${source.type}::${source.catalogId}` === fromKey,
      );
      const toIndex = draft.catalogSources.findIndex(
        (source) => `${source.addonId}::${source.type}::${source.catalogId}` === toKey,
      );

      return moveItem(draft.catalogSources, fromIndex, toIndex);
    })());
  };

  const moveCatalogByIndex = (fromIndex: number, toIndex: number) => {
    update("catalogSources", moveItem(draft.catalogSources, fromIndex, toIndex));
  };

  const applyPosterUrl = () => {
    if (!newPosterUrl.trim()) return;
    update("coverImageUrl", newPosterUrl.trim());
    update("_coverMode", "image");
    setNewPosterUrl("");
  };

  const pw = shapeWidths[draft.tileShape];
  const pa = shapeAspectRatios[draft.tileShape];

  const miniTabs = [
    { id: "basics" as const, label: "Basics" },
    { id: "catalogs" as const, label: `Catalogs ${draft.catalogSources.length > 0 ? `(${draft.catalogSources.length})` : ""}` },
    { id: "appearance" as const, label: "Appearance" },
  ];

  const currentTabIndex = miniTabs.findIndex((t) => t.id === tab);

  useEffect(() => {
    if (!catalogPickerOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (catalogPickerRef.current?.contains(target)) return;
      setCatalogPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [catalogPickerOpen]);

  return (
    <div className="folder-mini-editor">
      {/* sub-tab bar as stepper */}
      <div className="folder-mini-editor__tabs">
        {miniTabs.map((t, i) => (
          <button
            key={t.id}
            className={`folder-mini-editor__tab ${tab === t.id ? "is-active" : ""}`}
            type="button"
            onClick={() => setTab(t.id)}
          >
            <span style={{ marginRight: 6, opacity: 0.5 }}>{i + 1}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="folder-mini-editor__body">
        {/* ── Basics ── */}
        {tab === "basics" && (
          <div className="stack">
            <label className="field">
              <span>Folder name</span>
              <input
                id="tut-folder-title"
                type="text"
                value={draft.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Netflix"
                autoFocus
              />
            </label>

            <div className="toggle-list">
              <button id="tut-folder-hide-title" className="toggle-row" type="button" onClick={() => update("hideTitle", !draft.hideTitle)}>
                <div>
                  <strong>Hide title on the card</strong>
                  <span>Useful when the cover already contains text.</span>
                </div>
                <span className={`switch ${draft.hideTitle ? "is-on" : ""}`} />
              </button>
            </div>
          </div>
        )}

        {/* ── Appearance / poster ── */}
        {tab === "appearance" && (
          <div className="poster-builder">
            {/* preview */}
            <div className="poster-preview-pane">
              <p className="panel__eyebrow" style={{ marginBottom: "0.75rem" }}>Preview</p>
              <div className="poster-preview-stage">
                <div className="poster-preview-card" style={{ width: pw, aspectRatio: pa }}>
                  {draft._coverMode === "image" && draft.coverImageUrl ? (
                    <img src={draft.coverImageUrl} alt={draft.title} />
                  ) : draft._coverMode === "emoji" && draft.coverEmoji ? (
                    <span className="poster-preview-card__emoji">{draft.coverEmoji}</span>
                  ) : (
                    <span className="poster-preview-card__placeholder">{draft.title.slice(0, 1) || "?"}</span>
                  )}
                  {!draft.hideTitle && (
                    <div className="poster-preview-card__label">{draft.title || "Untitled"}</div>
                  )}
                </div>
              </div>
            </div>

            {/* editor */}
            <div className="poster-editor-pane">
              <div className="stack">
                <div id="tut-display-shape-box" className="poster-editor-group">
                  <div id="tut-display-shape" className="field">
                    <span>Display shape</span>
                    <div className="segmented">
                      {(["POSTER", "SQUARE", "LANDSCAPE"] as const).map((shape) => (
                        <button
                          key={shape}
                          className={`segmented__option ${draft.tileShape === shape ? "is-active" : ""}`}
                          type="button"
                          onClick={() => update("tileShape", shape)}
                        >
                          {shape === "POSTER" && <Film size={14} />}
                          {shape === "SQUARE" && <Grid2x2 size={14} />}
                          {shape === "LANDSCAPE" && <RectangleHorizontal size={14} />}
                          {shape.toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <span>Cover style</span>
                    <div className="segmented">
                      {(["none", "emoji", "image"] as const).map((mode) => (
                        <button
                          key={mode}
                          className={`segmented__option ${draft._coverMode === mode ? "is-active" : ""}`}
                          type="button"
                          onClick={() => update("_coverMode", mode)}
                        >
                          {mode === "image" && <Image size={13} />}
                          {mode === "emoji" && <Smile size={13} />}
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {draft._coverMode === "image" && (
                  <div className="stack">
                    <label className="field">
                      <span>Poster URL</span>
                      <div className="poster-url-row">
                        <input
                          type="url"
                          value={newPosterUrl}
                          onChange={(e) => setNewPosterUrl(e.target.value)}
                          placeholder="https://i.postimg.cc/..."
                          onKeyDown={(e) => e.key === "Enter" && applyPosterUrl()}
                        />
                        <button
                          className="button button--primary"
                          type="button"
                          onClick={applyPosterUrl}
                          disabled={!newPosterUrl.trim()}
                        >
                          Apply
                        </button>
                      </div>
                    </label>
                    {draft.coverImageUrl && (
                      <div className="poster-active-url">
                        <span className="cover-preview__label">Current</span>
                        <div className="poster-active-url__row">
                          <code>{draft.coverImageUrl}</code>
                          <button
                            className="icon-button icon-button--danger"
                            type="button"
                            onClick={() => { update("coverImageUrl", null); update("_coverMode", "none"); }}
                            aria-label="Remove poster"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                    <label className="field">
                      <span>Focus GIF <em style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</em></span>
                      <input
                        type="url"
                        value={draft.focusGifUrl ?? ""}
                        onChange={(e) => update("focusGifUrl", e.target.value || null)}
                        placeholder="Animated asset on focus"
                      />
                    </label>
                  </div>
                )}

                {draft._coverMode === "emoji" && (
                  <div className="field">
                    <span>Choose an emoji</span>
                    <div className="emoji-grid">
                      {PRESET_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={`emoji-btn ${draft.coverEmoji === emoji ? "is-active" : ""}`}
                          onClick={() => update("coverEmoji", emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Catalogs ── */}
        {tab === "catalogs" && (
          <div className="catalog-split">
            <div className="catalog-panel">
              <div className="catalog-panel__header">
                <div>
                  <p className="panel__eyebrow">Add catalogs</p>
                  <h3>{isMobile ? "Search manifest" : "From manifest"}</h3>
                </div>
              </div>
              {isMobile ? (
                <div ref={catalogPickerRef} className="catalog-picker">
                  <button
                    className={`catalog-picker__trigger ${catalogPickerOpen ? "is-open" : ""}`}
                    type="button"
                    onClick={() => setCatalogPickerOpen((open) => !open)}
                    disabled={!manifest}
                  >
                    <span>
                      {manifest ? "Choose a catalog" : "Sync a manifest first"}
                    </span>
                    <ChevronsUpDown size={15} />
                  </button>

                  {catalogPickerOpen && manifest && (
                    <div className="catalog-picker__menu">
                      <label id="tut-search-field" className="search-field catalog-picker__search">
                        <Search size={13} />
                        <input
                          id="tut-search-catalog"
                          type="search"
                          value={catalogFilter}
                          onChange={(e) => setCatalogFilter(e.target.value)}
                          placeholder="Search catalogs"
                          autoFocus
                        />
                      </label>
                      <div className="catalog-picker__results">
                        {visibleCatalogs.length ? (
                          visibleCatalogs.map((cat, catalogIndex) => {
                            const key = `${manifest?.addonId ?? ""}::${cat.type}::${cat.id}`;
                            const selected = activeCatalogs.has(key);
                            return (
                              <button
                                id={catalogIndex === 0 ? "tut-add-catalog" : undefined}
                                key={`${cat.type}-${cat.id}`}
                                className={`catalog-list__item catalog-picker__option ${selected ? "is-selected" : ""}`}
                                type="button"
                                onClick={() => addCatalog(cat.id, cat.type)}
                                disabled={selected}
                              >
                                <div>
                                  <strong>{cat.name}</strong>
                                  <span>
                                    {formatCatalogType(cat.type)} • {cat.id}
                                  </span>
                                </div>
                                {selected ? <Check size={14} /> : <span>Add</span>}
                              </button>
                            );
                          })
                        ) : (
                          <div className="catalog-list__empty catalog-list__empty--compact">
                            No matching catalogs.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <label id="tut-search-field" className="search-field">
                    <Search size={13} />
                    <input
                      id="tut-search-catalog"
                      type="search"
                      value={catalogFilter}
                      onChange={(e) => setCatalogFilter(e.target.value)}
                      placeholder="Search catalogs"
                    />
                  </label>
                  <div className="catalog-list">
                    {visibleCatalogs.length ? (
                      visibleCatalogs.map((cat, catalogIndex) => {
                        const key = `${manifest?.addonId ?? ""}::${cat.type}::${cat.id}`;
                        const selected = activeCatalogs.has(key);
                        return (
                          <button
                            id={catalogIndex === 0 ? "tut-add-catalog" : undefined}
                            key={`${cat.type}-${cat.id}`}
                            className={`catalog-list__item ${selected ? "is-selected" : ""}`}
                            type="button"
                            onClick={() => addCatalog(cat.id, cat.type)}
                            disabled={selected}
                          >
                            <div>
                              <strong>{cat.name}</strong>
                              <span>{formatCatalogType(cat.type)}</span>
                            </div>
                            {selected ? <Check size={14} /> : <span>Add</span>}
                          </button>
                        );
                      })
                    ) : (
                      <div className="catalog-list__empty">
                        {manifest ? "No results." : "Sync a manifest first."}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="catalog-panel">
              <div className="catalog-panel__header">
                <div>
                  <p className="panel__eyebrow">Active</p>
                  <h3>{draft.catalogSources.length} linked</h3>
                </div>
              </div>
              <div className="catalog-list">
                {draft.catalogSources.length ? (
                  draft.catalogSources.map((src, index) => {
                    const sourceKey = `${src.addonId}::${src.type}::${src.catalogId}`;
                    const displayName = catalogNameByKey.get(sourceKey) ?? src.catalogId;

                    return (
                    <div
                      key={sourceKey}
                      className={`catalog-list__item catalog-list__item--active ${src._missingFromManifest ? "catalog-list__item--missing" : ""} ${draggingCatalogKey === sourceKey ? "is-dragging" : ""}`}
                      draggable={!isMobile}
                      onDragStart={() => {
                        if (isMobile) return;
                        setDraggingCatalogKey(sourceKey);
                      }}
                      onDragEnd={() => setDraggingCatalogKey(null)}
                      onDragOver={(event) => {
                        if (isMobile) return;
                        event.preventDefault();
                        if (draggingCatalogKey) moveCatalogByKey(draggingCatalogKey, sourceKey);
                      }}
                      onDrop={(event) => {
                        if (isMobile) return;
                        event.preventDefault();
                        setDraggingCatalogKey(null);
                      }}
                    >
                      <div className="catalog-list__item-main">
                        <div className="catalog-list__drag-handle" aria-hidden="true">
                          <GripVertical size={16} />
                        </div>
                        <div>
                        <strong>{displayName}</strong>
                        <span>
                          {formatCatalogType(src.type)}
                          {displayName !== src.catalogId ? ` • ${src.catalogId}` : ""}
                          {src._missingFromManifest ? " • missing from manifest" : ""}
                        </span>
                      </div>
                      </div>
                      <button
                        className="icon-button icon-button--danger"
                        type="button"
                        onClick={() => removeCatalog(src)}
                        aria-label={`Remove ${src.catalogId}`}
                      >
                        <X size={13} />
                      </button>
                      {isMobile && (
                        <div className="mobile-reorder-controls" aria-label={`Reorder ${displayName}`}>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => moveCatalogByIndex(index, index - 1)}
                            aria-label={`Move ${displayName} up`}
                            disabled={index === 0}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => moveCatalogByIndex(index, index + 1)}
                            aria-label={`Move ${displayName} down`}
                            disabled={index === draft.catalogSources.length - 1}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )})
                ) : (
                  <div className="catalog-list__empty">No catalogs linked yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="folder-mini-editor__footer" style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="modal-card__footer-actions">
          <button className="button button--ghost" type="button" onClick={onCancel}>
            Discard
          </button>
          {currentTabIndex > 0 && (
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setTab(miniTabs[currentTabIndex - 1].id)}
            >
              Back
            </button>
          )}
        </div>
        <div className="modal-card__footer-actions">
          <button
            id={currentTabIndex === miniTabs.length - 1 ? "tut-save-folder" : undefined}
            className="button button--primary"
            type="button"
            onClick={() => onSave(draft)}
          >
            Save folder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FolderRow ───────────────────────────────────────────────────────────────

interface FolderRowProps {
  folder: Folder;
  isExpanded: boolean;
  manifest: ParsedManifest | null;
  isMobile: boolean;
  onToggle: () => void;
  onSave: (f: Folder) => void;
  onDelete: () => void;
  draggable: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function FolderRow({
  folder,
  isExpanded,
  manifest,
  isMobile,
  onToggle,
  onSave,
  onDelete,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: FolderRowProps) {
  const pa = shapeAspectRatios[folder.tileShape];

  return (
    <div
      className={`folder-row ${isExpanded ? "is-expanded" : ""} ${isDragging ? "is-dragging" : ""}`}
      draggable={draggable && !isMobile}
      onDragStart={() => {
        if (isMobile) return;
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (isMobile) return;
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        if (isMobile) return;
        event.preventDefault();
      }}
    >
      <div className="folder-row__summary" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}>
        {/* mini poster thumb */}
        <div className="folder-row__drag-handle" aria-hidden="true">
          <GripVertical size={16} />
        </div>
        <div className="folder-row__thumb" style={{ width: 36, aspectRatio: pa }}>
          {folder._coverMode === "image" && folder.coverImageUrl ? (
            <img src={folder.coverImageUrl} alt={folder.title} />
          ) : folder._coverMode === "emoji" && folder.coverEmoji ? (
            <span style={{ fontSize: "1.1rem" }}>{folder.coverEmoji}</span>
          ) : (
            <span className="folder-row__init">{folder.title.slice(0, 1) || "?"}</span>
          )}
        </div>

        <div className="folder-row__info">
          <strong>{folder.title || "Untitled folder"}</strong>
          <span>
            {folder.tileShape.toLowerCase()} • {folder.catalogSources.length} catalog
            {folder.catalogSources.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="folder-row__actions" onClick={(e) => e.stopPropagation()}>
          {isMobile && (
            <div className="mobile-reorder-controls" aria-label={`Reorder ${folder.title || "folder"}`}>
              <button
                className="icon-button"
                type="button"
                onClick={onMoveUp}
                aria-label={`Move ${folder.title} up`}
                disabled={!canMoveUp}
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={onMoveDown}
                aria-label={`Move ${folder.title} down`}
                disabled={!canMoveDown}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          )}
          <button
            className="icon-button"
            type="button"
            onClick={onToggle}
            aria-label="Edit folder"
          >
            <Pencil size={14} />
          </button>
          <button
            className="icon-button icon-button--danger"
            type="button"
            onClick={onDelete}
            aria-label="Delete folder"
          >
            <Trash2 size={14} />
          </button>
          <ChevronRight size={15} className={`folder-row__chevron ${isExpanded ? "is-open" : ""}`} />
        </div>
      </div>

      {isExpanded && (
        <FolderMiniEditor
          folder={folder}
          manifest={manifest}
          isMobile={isMobile}
          onSave={onSave}
          onCancel={onToggle}
        />
      )}
    </div>
  );
}

// ─── CollectionEditorModal ───────────────────────────────────────────────────

const TOP_STEPS: { id: CollectionStep; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "folders", label: "Folders" },
  { id: "appearance", label: "Appearance" },
];

export function CollectionEditorModal({
  collection,
  manifest,
  onClose,
  onSave,
}: CollectionEditorModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [draft, setDraft] = useState<TopLevelCollection>(collection);
  const [step, setStep] = useState<CollectionStep>("basics");
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const applyMatch = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    applyMatch(mediaQuery);
    mediaQuery.addEventListener("change", applyMatch);
    return () => mediaQuery.removeEventListener("change", applyMatch);
  }, []);

  const updateCollection = <K extends keyof TopLevelCollection>(field: K, value: TopLevelCollection[K]) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  // ── Folder CRUD ──────────────────────────────────────────────────────────
  const addFolder = () => {
    const f = createEmptyFolder("");
    if (draft.folders.length > 0) {
      const lastFolder = draft.folders[draft.folders.length - 1];
      f.hideTitle = lastFolder.hideTitle;
      f.tileShape = lastFolder.tileShape;
      f._coverMode = lastFolder._coverMode;
    }
    setDraft((prev) => ({ ...prev, folders: [...prev.folders, f] }));
    setExpandedFolderId(f.id); // open editor immediately
  };

  const saveFolder = (id: string, updated: Folder) => {
    setDraft((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === id ? updated : f)),
    }));
    setExpandedFolderId(null);
  };

  const deleteFolder = (id: string) => {
    setDraft((prev) => ({ ...prev, folders: prev.folders.filter((f) => f.id !== id) }));
    if (expandedFolderId === id) setExpandedFolderId(null);
  };

  const moveFolderById = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    setDraft((prev) => {
      const fromIndex = prev.folders.findIndex((folder) => folder.id === fromId);
      const toIndex = prev.folders.findIndex((folder) => folder.id === toId);

      return {
        ...prev,
        folders: moveItem(prev.folders, fromIndex, toIndex),
      };
    });
  };

  const moveFolderByIndex = (fromIndex: number, toIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      folders: moveItem(prev.folders, fromIndex, toIndex),
    }));
  };

  const stepIndex = TOP_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="collection-editor-title">
      <div className="modal-backdrop" />
      <section className="modal-card">
        <header className="modal-card__header">
          <div>
            <p className="panel__eyebrow">Collections editor</p>
            <h2 id="collection-editor-title">{draft.title || "Untitled collection"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {/* Top stepper */}
        <div className="stepper">
          {TOP_STEPS.map((s, i) => (
            <button
              id={s.id === "appearance" ? "tut-appearance-tab" : undefined}
              key={s.id}
              className={`stepper__item ${step === s.id ? "is-active" : ""}`}
              type="button"
              onClick={() => setStep(s.id)}
            >
              <span>{i + 1}</span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="modal-card__content">
          {/* ── Step: Folders ── */}
          {step === "folders" && (
            <div className="stack stack--lg">
              {draft.folders.length === 0 ? (
                <div className="folders-empty">
                  <p>No folders yet. Add your first one below.</p>
                </div>
              ) : (
                <div className="folder-list-stack">
                  {draft.folders.map((folder, index) => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      isExpanded={expandedFolderId === folder.id}
                      manifest={manifest}
                      isMobile={isMobile}
                      draggable={expandedFolderId === null}
                      isDragging={draggingFolderId === folder.id}
                      onToggle={() =>
                        setExpandedFolderId((id) => (id === folder.id ? null : folder.id))
                      }
                      onSave={(updated) => saveFolder(folder.id, updated)}
                      onDelete={() => deleteFolder(folder.id)}
                      onDragStart={() => setDraggingFolderId(folder.id)}
                      onDragEnd={() => setDraggingFolderId(null)}
                      onDragOver={() => {
                        if (draggingFolderId) moveFolderById(draggingFolderId, folder.id);
                      }}
                      canMoveUp={index > 0}
                      canMoveDown={index < draft.folders.length - 1}
                      onMoveUp={() => moveFolderByIndex(index, index - 1)}
                      onMoveDown={() => moveFolderByIndex(index, index + 1)}
                    />
                  ))}
                </div>
              )}

              <button id="tut-add-folder" className="add-folder-btn" type="button" onClick={addFolder}>
                <Plus size={16} />
                Add a folder
              </button>
            </div>
          )}

          {/* ── Step: Basics ── */}
          {step === "basics" && (
            <div className="stack">
              <label className="field">
                <span>Collection title</span>
                <input
                  id="tut-collection-title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => updateCollection("title", e.target.value)}
                  placeholder="Streaming Services"
                />
              </label>
              <label className="field">
                <span>Backdrop image URL <em style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</em></span>
                <input
                  type="url"
                  value={draft.backdropImageUrl ?? ""}
                  onChange={(e) => updateCollection("backdropImageUrl", e.target.value || null)}
                  placeholder="https://..."
                />
              </label>
              <p style={{ fontSize: "0.85rem", color: "var(--danger)", marginTop: "-0.5rem" }}>
                The Backdrop image URL acts as a fallback image and is not required as it's not really used.
              </p>
            </div>
          )}

          {/* ── Step: Appearance ── */}
          {step === "appearance" && (
            <div className="stack">
              <div className="field">
                <span>View mode</span>
                <div className="segmented">
                  {(["TABBED_GRID", "ROWS", "FOLLOW_HOME"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`segmented__option ${draft.viewMode === mode ? "is-active" : ""}`}
                      type="button"
                      onClick={() => updateCollection("viewMode", mode)}
                    >
                      {mode.replace(/_/g, " ").toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toggle-list">
                <button className="toggle-row" type="button" onClick={() => updateCollection("pinToTop", !draft.pinToTop)}>
                  <div>
                    <strong>Pin above catalogs</strong>
                    <span>Keep the collection visible before standard catalogs.</span>
                  </div>
                  <span className={`switch ${draft.pinToTop ? "is-on" : ""}`} />
                </button>
                <button className="toggle-row" type="button" onClick={() => updateCollection("focusGlowEnabled", !draft.focusGlowEnabled)}>
                  <div>
                    <strong>Focus glow on cards</strong>
                    <span>Preserve the immersive hover/focus treatment on the collection.</span>
                  </div>
                  <span className={`switch ${draft.focusGlowEnabled ? "is-on" : ""}`} />
                </button>
                <button className="toggle-row" type="button" onClick={() => updateCollection("showAllTab", !draft.showAllTab)}>
                  <div>
                    <strong>Show "All" tab</strong>
                    <span>Include a combined tab that aggregates every folder entry.</span>
                  </div>
                  <span className={`switch ${draft.showAllTab ? "is-on" : ""}`} />
                </button>
              </div>
            </div>
          )}

          {/* Catalog import step removed — catalogs are assigned per-folder inside the Folders tab */}
        </div>

        {expandedFolderId === null && (
          <footer className="modal-card__footer">
            <div className="modal-card__footer-actions">
              <button className="button button--ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              {stepIndex > 0 && (
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => setStep(TOP_STEPS[stepIndex - 1].id)}
                >
                  Back
                </button>
              )}
            </div>
            <div className="modal-card__footer-actions">
              <button
                id={stepIndex === TOP_STEPS.length - 1 ? "tut-save-collection" : undefined}
                className="button button--primary"
                type="button"
                onClick={() => onSave(draft)}
                disabled={step === "folders" && draft.folders.length === 0}
              >
                Save collection
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
