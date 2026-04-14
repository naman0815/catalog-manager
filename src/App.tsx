import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  ArrowDown,
  ArrowUp,
  Box,
  CheckCircle2,
  ChevronRight,
  Download,
  GripVertical,
  Import,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { CollectionEditorModal } from "./components/CollectionEditorModal";
import { TutorialOverlay } from "./components/Tutorial";

import type { ParsedManifest, TopLevelCollection } from "./types";
import {
  applyManifestAvailability,
  createEmptyCollection,
  extractCollectionsFromPayload,
  fetchManifest,
  moveItem,
  normalizeCollection,
} from "./utils/manifestParser";

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [isMobile, setIsMobile] = useState(false);
  // ── Manifest state ──
  const [manifestUrl, setManifestUrl] = useState("");
  const [manifestState, setManifestState] = useState<{
    loading: boolean;
    error: string | null;
    data: ParsedManifest | null;
  }>({ loading: false, error: null, data: null });

  // ── Collections state (array) ──
  const [collections, setCollections] = useState<TopLevelCollection[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  // Tracks when user imported JSON without having a manifest URL → triggers red highlight
  const [importedWithoutSync, setImportedWithoutSync] = useState(false);

  // ── Modal state: null = closed, TopLevelCollection = editing ──
  const [editingCollection, setEditingCollection] = useState<TopLevelCollection | null>(null);
  const [draggingCollectionId, setDraggingCollectionId] = useState<string | null>(null);

  // ── Persist manifest URL to localStorage ──
  useEffect(() => {
    if (manifestUrl) localStorage.setItem("cm_manifestUrl", manifestUrl);
  }, [manifestUrl]);

  // ── Persist collections to localStorage ──
  useEffect(() => {
    localStorage.setItem("cm_collections", JSON.stringify(collections));
  }, [collections]);

  // ── Restore from localStorage on mount and auto-sync ──
  useEffect(() => {
    const savedCols = localStorage.getItem("cm_collections");
    if (savedCols) {
      try {
        const parsed = JSON.parse(savedCols);
        const normalized = extractCollectionsFromPayload(parsed).map((item) => normalizeCollection(item));
        setCollections(normalized);
      } catch {
        /* ignore */
      }
    }
    const savedUrl = localStorage.getItem("cm_manifestUrl");
    if (savedUrl) {
      setManifestUrl(savedUrl);
      setManifestState({ loading: true, error: null, data: null });
      fetchManifest(savedUrl)
        .then((data) => setManifestState({ loading: false, error: null, data }))
        .catch(() => setManifestState({ loading: false, error: null, data: null }));
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const applyMatch = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    applyMatch(mediaQuery);
    mediaQuery.addEventListener("change", applyMatch);
    return () => mediaQuery.removeEventListener("change", applyMatch);
  }, []);

  useEffect(() => {
    setCollections((prev) => applyManifestAvailability(prev, manifestState.data));
  }, [manifestState.data]);

  const manifestSynced = !!manifestState.data;

  const totalFolders = useMemo(
    () => collections.reduce((sum, c) => sum + c.folders.length, 0),
    [collections],
  );
  const totalSources = useMemo(
    () =>
      collections.reduce(
        (sum, c) => sum + c.folders.reduce((s, f) => s + f.catalogSources.length, 0),
        0,
      ),
    [collections],
  );

  // ── Manifest ──
  const handleSyncManifest = async () => {
    if (!manifestUrl.trim()) return;
    setImportedWithoutSync(false);
    setManifestState({ loading: true, error: null, data: null });
    try {
      const data = await fetchManifest(manifestUrl);
      setManifestState({ loading: false, error: null, data });
    } catch (error) {
      setManifestState({
        loading: false,
        error:
          error instanceof Error
            ? `${error.message} This usually means the URL is invalid or the manifest server is not allowing CORS.`
            : "Failed to fetch the manifest.",
        data: null,
      });
    }
  };

  // ── Collection CRUD ──
  const handleAddCollection = () => {
    if (!manifestSynced) return;
    setEditingCollection(createEmptyCollection());
  };

  const handleEditCollection = (col: TopLevelCollection) => {
    setEditingCollection(col);
  };

  const handleSaveCollection = (updated: TopLevelCollection) => {
    setCollections((prev) =>
      prev.some((c) => c.id === updated.id)
        ? prev.map((c) => (c.id === updated.id ? updated : c))
        : [...prev, updated],
    );
    setEditingCollection(null);
  };

  const handleDeleteCollection = (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  const moveCollectionById = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    setCollections((prev) => {
      const fromIndex = prev.findIndex((collection) => collection.id === fromId);
      const toIndex = prev.findIndex((collection) => collection.id === toId);
      return moveItem(prev, fromIndex, toIndex);
    });
  };

  const moveCollectionByIndex = (fromIndex: number, toIndex: number) => {
    setCollections((prev) => moveItem(prev, fromIndex, toIndex));
  };

  // ── Import ──
  const handleImportPayload = (payload: unknown) => {
    try {
      const normalized = extractCollectionsFromPayload(payload).map((item) =>
        normalizeCollection(item),
      );
      setCollections(applyManifestAvailability(normalized, manifestState.data));
      setImportError(null);
      // Flag to highlight sync panel only when this was triggered by an actual import action
      if (!manifestSynced) setImportedWithoutSync(true);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import JSON.");
    }
  };

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    file
      .text()
      .then((contents) => handleImportPayload(JSON.parse(contents)))
      .catch(() => setImportError("The selected file is not valid JSON."));
  };

  // ── Export ──
  const handleExport = () => {
    if (!collections.length) return;
    const payload = JSON.stringify(collections, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "collections.json";
    link.click();
    URL.revokeObjectURL(url);
  };



  return (
    <div className="app-shell">
      {/* ━━━━━ Sidebar ━━━━━ */}
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-card__icon">
            <Box size={20} />
          </div>
          <div>
            <h1>Catalog Manager</h1>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* Workspace navigation removed — single page app */}
        </nav>

        <div className="sidebar-panel">
          <div className="sidebar-panel__label">Summary</div>
          <strong>
            {collections.length
              ? `${collections.length} collection${collections.length !== 1 ? "s" : ""}`
              : "No collections yet"}
          </strong>
          <span>
            {totalFolders} folder{totalFolders !== 1 ? "s" : ""} • {totalSources} source{totalSources !== 1 ? "s" : ""}
          </span>
          <div className="stack stack--sm" style={{ marginTop: "0.5rem" }}>
            <button
              className="button button--ghost button--full"
              type="button"
              onClick={handleExport}
              disabled={!collections.length}
            >
              <Download size={14} />
              Download JSON
            </button>
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            id="tut-retake-tutorial"
            className="button button--ghost button--full"
            style={{ fontSize: "0.75rem", padding: "0.5rem" }}
            onClick={() => window.dispatchEvent(new CustomEvent("restart-tutorial"))}
          >
            Retake Tutorial
          </button>
        </div>
      </aside>

      {/* ━━━━━ Main content ━━━━━ */}
      <main className="content">
        {importError ? <p className="error-text" style={{ marginBottom: "0.75rem" }}>{importError}</p> : null}

        {/* ── STEP 1: Manifest sync ── */}
        <section className={`panel${importedWithoutSync ? " panel--sync-needed" : ""}`}>
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">
                <span className="step-badge">Step 1</span>
                AIOStreams manifest
              </p>
              <h2>
                {manifestSynced ? (
                  <>
                    <CheckCircle2
                      size={16}
                      style={{ color: "var(--accent)", verticalAlign: "middle", marginRight: 6 }}
                    />
                    Manifest synced — {manifestState.data!.catalogs.length} catalogs loaded
                  </>
                ) : (
                  "Sync your manifest before creating collections"
                )}
              </h2>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <label className="button button--ghost file-button" style={{ padding: "0.4rem 0.8rem" }}>
                <Import size={14} />
                Import JSON
                <input type="file" accept=".json,application/json" onChange={handleImportFile} />
              </label>
              {manifestSynced && (
                <div className="panel__badge">{manifestState.data!.catalogs.length} catalogs</div>
              )}
            </div>
          </div>

          <div className="manifest-bar">
            <input
              id="tut-manifest-input"
              type="url"
              value={manifestUrl}
              placeholder={importedWithoutSync ? "Paste your manifest URL" : ""}
              onChange={(event) => { setImportedWithoutSync(false); setManifestUrl(event.target.value); }}
              onFocus={() => setImportedWithoutSync(false)}
              onKeyDown={(e) => e.key === "Enter" && handleSyncManifest()}
            />
            <button
              id="tut-sync-btn"
              className="button button--primary"
              type="button"
              onClick={handleSyncManifest}
              disabled={manifestState.loading || !manifestUrl.trim()}
            >
              <RefreshCcw size={16} />
              {manifestState.loading ? "Syncing…" : manifestState.data ? "Resync" : "Sync manifest"}
            </button>
          </div>


          {manifestState.error ? <p className="error-text">{manifestState.error}</p> : null}
        </section>

        {/* ── STEP 2: Collections ── */}
        <section className={`panel panel--collections ${!manifestSynced ? "panel--locked" : ""}`}>
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">
                <span className="step-badge">Step 2</span>
                Collections
              </p>
              <h2>Create and manage your collections</h2>
            </div>
            {!manifestSynced && (
              <div className="panel__badge panel__badge--warn">Sync manifest first</div>
            )}
          </div>

          {!manifestSynced ? (
            <div className="locked-hint">
              <ChevronRight size={15} />
              Complete Step 1 above to unlock the collection builder.
            </div>
          ) : (
            <>
              <div className="folder-grid">
                {collections.map((col, index) => (
                  <div
                    key={col.id}
                    className={`folder-card collection-card ${draggingCollectionId === col.id ? "is-dragging" : ""}`}
                    draggable={!isMobile}
                    onDragStart={() => {
                      if (isMobile) return;
                      setDraggingCollectionId(col.id);
                    }}
                    onDragEnd={() => setDraggingCollectionId(null)}
                    onDragOver={(event) => {
                      if (isMobile) return;
                      event.preventDefault();
                      if (draggingCollectionId) moveCollectionById(draggingCollectionId, col.id);
                    }}
                    onDrop={(event) => {
                      if (isMobile) return;
                      event.preventDefault();
                      setDraggingCollectionId(null);
                    }}
                  >
                    {!isMobile && (
                      <div className="collection-card__drag-badge" aria-hidden="true">
                      <GripVertical size={14} />
                      <span>Drag to reorder</span>
                      </div>
                    )}
                    <div
                      className="folder-card__media"
                      onClick={() => handleEditCollection(col)}
                    >
                      {col.folders.length > 0 ? (
                        <div className="folder-card__poster-stack">
                          {col.folders.slice(0, 3).map((f) =>
                            f._coverMode === "image" && f.coverImageUrl ? (
                              <img key={f.id} src={f.coverImageUrl} alt={f.title} />
                            ) : (
                              <span key={f.id} className="folder-card__poster-init">
                                {f.title.slice(0, 1) || "?"}
                              </span>
                            ),
                          )}
                        </div>
                      ) : (
                        <span className="folder-card__poster-init">
                          {col.title.slice(0, 1) || "C"}
                        </span>
                      )}
                    </div>
                    <div
                      className="folder-card__body"
                      onClick={() => handleEditCollection(col)}
                    >
                      <div className="folder-card__eyebrow">Collection</div>
                      <h3>{col.title || "Untitled collection"}</h3>
                      <p>
                        {col.folders.length} folder{col.folders.length !== 1 ? "s" : ""} •{" "}
                        {col.folders.reduce((s, f) => s + f.catalogSources.length, 0)} catalog
                        sources
                      </p>
                    </div>
                    <div className="collection-card__actions">
                      {isMobile && (
                        <div className="mobile-reorder-controls" aria-label={`Reorder ${col.title || "collection"}`}>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => moveCollectionByIndex(index, index - 1)}
                            aria-label={`Move ${col.title} up`}
                            disabled={index === 0}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => moveCollectionByIndex(index, index + 1)}
                            aria-label={`Move ${col.title} down`}
                            disabled={index === collections.length - 1}
                          >
                            <ArrowDown size={15} />
                          </button>
                        </div>
                      )}
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => handleEditCollection(col)}
                        aria-label={`Edit ${col.title}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button icon-button--danger"
                        type="button"
                        onClick={() => handleDeleteCollection(col.id)}
                        aria-label={`Delete ${col.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add collection card */}
                <button
                  id="tut-add-collection"
                  className="folder-card folder-card--add"
                  style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%" }}
                  type="button"
                  onClick={handleAddCollection}
                >
                  <Plus size={32} style={{ marginBottom: "0.5rem", opacity: 0.8 }} />
                  <span style={{ fontSize: "1.05rem", fontWeight: 600 }}>Add a collection</span>
                </button>
              </div>

              {collections.length > 0 && (
                <div className="collection-export-hint">
                  <CheckCircle2 size={15} style={{ color: "var(--accent)" }} />
                  <span>
                    {collections.length} collection{collections.length !== 1 ? "s" : ""} ready —
                    use <strong>Export JSON</strong> in the sidebar when done.
                  </span>
                </div>
              )}
            </>
          )}
        </section>

        {/* Stats row */}
        <div className="stats-row">
          <div className="stat-card">
            <span>Collections</span>
            <strong>{collections.length}</strong>
          </div>
          <div className="stat-card">
            <span>Folders</span>
            <strong>{totalFolders}</strong>
          </div>
          <div className="stat-card">
            <span>Catalog sources</span>
            <strong>{totalSources}</strong>
          </div>
        </div>
      </main>

      {/* ── Collection editor modal ── */}
      {editingCollection && (
        <CollectionEditorModal
          collection={editingCollection}
          manifest={manifestState.data}
          onClose={() => setEditingCollection(null)}
          onSave={handleSaveCollection}
          preventOutsideClick={collections.length === 0}
        />
      )}

      {/* ── Tutorial ── */}
      <TutorialOverlay />
    </div>
  );
}

export default App;
