import { useDeferredValue, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Check,
  ChevronRight,
  Film,
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
  onSave: (f: Folder) => void;
  onCancel: () => void;
}

function FolderMiniEditor({ folder, manifest, onSave, onCancel }: FolderMiniEditorProps) {
  const [draft, setDraft] = useState<Folder>(folder);
  const [tab, setTab] = useState<"basics" | "catalogs" | "appearance">("basics");
  const [catalogFilter, setCatalogFilter] = useState("");
  const deferredFilter = useDeferredValue(catalogFilter);
  const [newPosterUrl, setNewPosterUrl] = useState("");

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

  const addCatalog = (catalogId: string, type: string) => {
    if (!manifest) return;
    const src: CatalogSource = { addonId: manifest.addonId, catalogId, type };
    const key = `${src.addonId}::${src.type}::${src.catalogId}`;
    if (activeCatalogs.has(key)) return;
    update("catalogSources", [...draft.catalogSources, src]);
  };

  const removeCatalog = (src: CatalogSource) =>
    update(
      "catalogSources",
      draft.catalogSources.filter(
        (s) => !(s.addonId === src.addonId && s.catalogId === src.catalogId && s.type === src.type),
      ),
    );

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
            {/* left: available */}
            <div className="catalog-panel">
              <div className="catalog-panel__header">
                <div>
                  <p className="panel__eyebrow">Available</p>
                  <h3>From manifest</h3>
                </div>
              </div>
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
                  visibleCatalogs.map((cat) => {
                    const key = `${manifest?.addonId ?? ""}::${cat.type}::${cat.id}`;
                    const selected = activeCatalogs.has(key);
                    return (
                      <button
                        id={visibleCatalogs.indexOf(cat) === 0 ? "tut-add-catalog" : undefined}
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
            </div>

            {/* right: active */}
            <div className="catalog-panel">
              <div className="catalog-panel__header">
                <div>
                  <p className="panel__eyebrow">Active</p>
                  <h3>{draft.catalogSources.length} linked</h3>
                </div>
              </div>
              <div className="catalog-list">
                {draft.catalogSources.length ? (
                  draft.catalogSources.map((src) => (
                    <div
                      key={`${src.addonId}-${src.type}-${src.catalogId}`}
                      className="catalog-list__item catalog-list__item--active"
                    >
                      <div>
                        <strong>{src.catalogId}</strong>
                        <span>{formatCatalogType(src.type)}</span>
                      </div>
                      <button
                        className="icon-button icon-button--danger"
                        type="button"
                        onClick={() => removeCatalog(src)}
                        aria-label={`Remove ${src.catalogId}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))
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
          {currentTabIndex < miniTabs.length - 1 ? (
            <button
              id={currentTabIndex === 0 ? "tut-folder-continue-1" : currentTabIndex === 1 ? "tut-folder-continue-2" : undefined}
              className="button button--primary"
              type="button"
              onClick={() => setTab(miniTabs[currentTabIndex + 1].id)}
            >
              Continue
            </button>
          ) : (
            <button id="tut-save-folder" className="button button--primary" type="button" onClick={() => onSave(draft)}>
              Save folder
            </button>
          )}
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
  onToggle: () => void;
  onSave: (f: Folder) => void;
  onDelete: () => void;
}

function FolderRow({ folder, isExpanded, manifest, onToggle, onSave, onDelete }: FolderRowProps) {
  const pa = shapeAspectRatios[folder.tileShape];

  return (
    <div className={`folder-row ${isExpanded ? "is-expanded" : ""}`}>
      <div className="folder-row__summary" onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}>
        {/* mini poster thumb */}
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
  const [draft, setDraft] = useState<TopLevelCollection>(collection);
  const [step, setStep] = useState<CollectionStep>("basics");
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);

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
                  {draft.folders.map((folder) => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      isExpanded={expandedFolderId === folder.id}
                      manifest={manifest}
                      onToggle={() =>
                        setExpandedFolderId((id) => (id === folder.id ? null : folder.id))
                      }
                      onSave={(updated) => saveFolder(folder.id, updated)}
                      onDelete={() => deleteFolder(folder.id)}
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
              {stepIndex < TOP_STEPS.length - 1 ? (
                <button
                  id={step === "basics" ? "tut-collection-continue-1" : step === "folders" ? "tut-collection-continue-2" : undefined}
                  className="button button--primary"
                  type="button"
                  onClick={() => setStep(TOP_STEPS[stepIndex + 1].id)}
                  disabled={step === "folders" && draft.folders.length === 0}
                >
                  Continue
                </button>
              ) : (
                <button id="tut-save-collection" className="button button--primary" type="button" onClick={() => onSave(draft)}>
                  Save collection
                </button>
              )}
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
