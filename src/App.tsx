import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  Box,
  CheckCircle2,
  ChevronRight,
  Download,
  Import,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  CloudUpload,
} from "lucide-react";
import { CollectionEditorModal } from "./components/CollectionEditorModal";

import type { ParsedManifest, TopLevelCollection } from "./types";
import { createEmptyCollection, fetchManifest, normalizeCollection } from "./utils/manifestParser";

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
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

  // ── Modal state: null = closed, TopLevelCollection = editing ──
  const [editingCollection, setEditingCollection] = useState<TopLevelCollection | null>(null);

  // ── Publish state ──
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

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

  // ── Import ──
  const handleImportPayload = (payload: unknown) => {
    try {
      const raw = Array.isArray(payload) ? payload : [payload];
      const normalized = raw.map((item) => normalizeCollection(item));
      setCollections(normalized);
      setImportError(null);
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
    link.download = "nuvio-collections.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Publish ──
  const handlePublish = async () => {
    if (!collections.length) return;
    setIsPublishing(true);
    setPublishUrl(null);
    setPublishError(null);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collections),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish");
      }
      setPublishUrl(data.url);
    } catch (err: any) {
      setPublishError(err.message || "An error occurred");
    } finally {
      setIsPublishing(false);
    }
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
            <p>Nuvio</p>
            <h1>Catalog Manager</h1>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-nav__label">Workspace</div>
          <button className="sidebar-nav__item is-active" type="button">
            <Layers3 size={16} />
            Catalog builder
          </button>
        </nav>

        <div className="sidebar-panel">
          <div className="sidebar-panel__label">Summary</div>
          <strong>
            {collections.length
              ? `${collections.length} collection${collections.length !== 1 ? "s" : ""}`
              : "No collections yet"}
          </strong>
          <span>
            {totalFolders} folder{totalFolders !== 1 ? "s" : ""} • {totalSources} linked catalog
            {totalSources !== 1 ? "s" : ""}
          </span>
          <button
            className="button button--primary button--full"
            type="button"
            onClick={handleExport}
            disabled={!collections.length}
          >
            <Download size={16} />
            Export JSON
          </button>

          <button
            className="button button--primary button--full"
            style={{ marginTop: "0.4rem" }}
            type="button"
            onClick={handlePublish}
            disabled={!collections.length || isPublishing}
          >
            {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
            {isPublishing ? "Publishing..." : "Publish to Vercel"}
          </button>
          
          {publishError && (
            <p className="error-text" style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}>
              {publishError}
            </p>
          )}

          {publishUrl && (
            <div style={{ marginTop: "1rem" }}>
              <div className="sidebar-nav__label" style={{ marginBottom: "0.5rem" }}>Hosted URL <span style={{color: "var(--accent)"}}>Live</span></div>
              <input 
                type="url" 
                readOnly 
                value={publishUrl}
                style={{ 
                  width: "100%", 
                  fontSize: "0.75rem", 
                  padding: "0.5rem", 
                  borderRadius: "6px", 
                  border: "1px solid rgba(89, 118, 255, 0.4)", 
                  background: "rgba(89, 118, 255, 0.08)",
                  color: "var(--text-main)" 
                }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>
          )}

          {collections.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <div className="sidebar-nav__label" style={{ marginBottom: "0.5rem" }}>Export Data URL</div>
              <input 
                type="url" 
                readOnly 
                value={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(collections))}`}
                style={{ 
                  width: "100%", 
                  fontSize: "0.75rem", 
                  padding: "0.5rem", 
                  borderRadius: "6px", 
                  border: "1px solid var(--border)", 
                  background: "var(--background)",
                  color: "var(--foreground)" 
                }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <span>Browser-only build</span>
          <span>Manifest sync depends on CORS from the source host.</span>
        </div>
      </aside>

      {/* ━━━━━ Main content ━━━━━ */}
      <main className="content">
        {/* Hero */}
        <section className="hero-panel">
          <div className="hero-panel__copy">
            <p className="panel__eyebrow">Nuvio catalog workspace</p>
            <h2>Build your catalog, step by step.</h2>
            <p>
              Sync your AIOStreams manifest, then create as many collections as you need — each with
              its own folders and catalog sources.
            </p>
          </div>
          <div className="hero-panel__actions">
            <label className="button button--ghost file-button">
              <Import size={16} />
              Import JSON
              <input type="file" accept=".json,application/json" onChange={handleImportFile} />
            </label>
          </div>
        </section>

        {importError ? <p className="error-text" style={{ marginTop: "0.75rem" }}>{importError}</p> : null}

        {/* CORS notice */}
        <section className="notice-panel">
          <Sparkles size={16} />
          <p>
            Manifest syncing is client-side. Requires the manifest host to allow CORS browser
            fetches.
          </p>
        </section>

        {/* ── STEP 1: Manifest sync ── */}
        <section className="panel">
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
                      size={18}
                      style={{ color: "var(--accent)", verticalAlign: "middle", marginRight: 6 }}
                    />
                    Manifest synced — {manifestState.data!.catalogs.length} catalogs loaded
                  </>
                ) : (
                  "Sync your manifest before creating collections"
                )}
              </h2>
            </div>
            {manifestSynced && (
              <div className="panel__badge">{manifestState.data!.catalogs.length} catalogs</div>
            )}
          </div>

          <div className="manifest-bar">
            <input
              type="url"
              value={manifestUrl}
              onChange={(event) => setManifestUrl(event.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSyncManifest()}
            />
            <button
              className="button button--primary"
              type="button"
              onClick={handleSyncManifest}
              disabled={manifestState.loading || !manifestUrl.trim()}
            >
              <RefreshCcw size={16} />
              {manifestState.loading ? "Syncing…" : manifestState.data ? "Resync" : "Sync manifest"}
            </button>
          </div>

          <p className="note">
            Load the manifest once here. Every folder inside every collection will pick from the
            same catalog list.
          </p>
          {manifestState.error ? <p className="error-text">{manifestState.error}</p> : null}
        </section>

        {/* ── STEP 2: Collections ── */}
        <section className={`panel ${!manifestSynced ? "panel--locked" : ""}`}>
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
                {collections.map((col) => (
                  <div key={col.id} className="folder-card collection-card">
                    <div className="folder-card__media">
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
                    <div className="folder-card__body">
                      <div className="folder-card__eyebrow">Collection</div>
                      <h3>{col.title || "Untitled collection"}</h3>
                      <p>
                        {col.folders.length} folder{col.folders.length !== 1 ? "s" : ""} •{" "}
                        {col.folders.reduce((s, f) => s + f.catalogSources.length, 0)} catalog
                        sources
                      </p>
                    </div>
                    <div className="collection-card__actions">
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
                  className="folder-card folder-card--add"
                  type="button"
                  onClick={handleAddCollection}
                >
                  <div className="folder-card__media folder-card__media--add">
                    <Plus size={26} />
                  </div>
                  <div className="folder-card__body">
                    <div className="folder-card__eyebrow">Create</div>
                    <h3>Add Collection</h3>
                    <p>Set up folders, posters, and catalog sources.</p>
                  </div>
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
          manifestError={manifestState.error}
          onClose={() => setEditingCollection(null)}
          onSave={handleSaveCollection}
        />
      )}
    </div>
  );
}

export default App;
