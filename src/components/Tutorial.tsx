import { type CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TutorialStepConfig = {
  id: string; // The query selector of the target element
  text?: string;
  autoAdvanceMs?: number;
  advanceOnEvent?: "input" | "click" | "blur";
  pulseFocus?: boolean;
  padding?: number; // Extra padding around highlight box (px)
};

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  // Step 1: Manifest input
  { id: "#tut-manifest-input", text: "Add AIOStreams URL or a manifest URL with catalogs", advanceOnEvent: "input", padding: 6 },
  // Step 2: Sync button
  { id: "#tut-sync-btn", text: "", advanceOnEvent: "click", padding: 6 },
  // Step 3: Add collection card
  { id: "#tut-add-collection", text: "Add a collection", advanceOnEvent: "click", padding: 1 },
  // Step 4: Collection title input (in modal)
  { id: "#tut-collection-title", text: "", advanceOnEvent: "input", padding: 6 },
  // Step 5: Continue from basics → folders
  { id: "#tut-collection-continue-1", text: "", advanceOnEvent: "click", padding: 6 },
  // Step 6: Add a folder button
  { id: "#tut-add-folder", text: "Add a folder", advanceOnEvent: "click", padding: 8 },
  // Step 7: Folder title input
  { id: "#tut-folder-title", text: "", advanceOnEvent: "input", padding: 6 },
  // Step 8: Hide title toggle (pulse & auto-advance)
  { id: "#tut-folder-hide-title", text: "", autoAdvanceMs: 1500, pulseFocus: true, padding: 6 },
  // Step 9: Continue from basics → catalogs in folder
  { id: "#tut-folder-continue-1", text: "", advanceOnEvent: "click", padding: 6 },
  // Step 10: Search catalog (highlight the outer search-field wrapper)
  { id: "#tut-search-field", text: "", advanceOnEvent: "input", padding: 8 },
  // Step 11: Add catalog (first item, pulse)
  { id: "#tut-add-catalog", text: "", autoAdvanceMs: 1200, padding: 6 },
  // Step 12: Continue from catalogs → appearance in folder
  { id: "#tut-folder-continue-2", text: "", advanceOnEvent: "click", padding: 6 },
  // Step 13: Display shape + cover style combined box
  { id: "#tut-display-shape-box", text: "Display shape and cover style", autoAdvanceMs: 2000, pulseFocus: true, padding: 10 },
  // Step 14: Save folder
  { id: "#tut-save-folder", text: "", advanceOnEvent: "click", padding: 6 },
  // Step 15: Continue to collection appearance step
  { id: "#tut-collection-continue-2", text: "", advanceOnEvent: "click", padding: 8 },
  // Step 16: Save collection
  { id: "#tut-save-collection", text: "", advanceOnEvent: "click", padding: 6 },
];

function lerp(start: number, end: number, t: number) {
  return start * (1 - t) + end * t;
}

type OverlayRect = { x: number; y: number; w: number; h: number };
const INSTANT_STEP_IDS = new Set(["#tut-add-collection", "#tut-collection-title", "#tut-add-catalog", "#tut-collection-continue-2"]);

export function TutorialOverlay() {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  // Show "done" flash on Retake Tutorial button
  const [highlightRetake, setHighlightRetake] = useState(false);
  const [retakeRect, setRetakeRect] = useState<OverlayRect | null>(null);

  const rectRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 });
  const targetRectRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 });
  const [renderedRect, setRenderedRect] = useState(rectRef.current);
  const hadTargetRef = useRef(false);

  // Track if element is offscreen so we can show a trail arrow
  const [offscreenDir, setOffscreenDir] = useState<null | "up" | "down" | "left" | "right">(null);

  const step = TUTORIAL_STEPS[stepIdx];

  useEffect(() => {
    const seen = localStorage.getItem("tutorial_seen");
    if (!seen) {
      setShowPrompt(true);
    }
  }, []);

  // Snap rect to a new target immediately (no lerp)
  const snapToStep = (idx: number) => {
    const s = TUTORIAL_STEPS[idx];
    if (!s) return;
    const pad = s.padding ?? 6;
    const el = document.querySelector(s.id) as HTMLElement | null;
    if (el) {
      const b = el.getBoundingClientRect();
      const newRect = { x: b.left - pad, y: b.top - pad, w: b.width + pad * 2, h: b.height + pad * 2 };
      rectRef.current = { ...newRect };
      targetRectRef.current = { ...newRect };
      hadTargetRef.current = true;
      setRenderedRect({ ...newRect });
    }
  };

  // Update target rect in loop
  useEffect(() => {
    if (!active || !step) return;

    let rafId: number;

    hadTargetRef.current = false;

    const loop = () => {
      const el = document.querySelector(step.id) as HTMLElement | null;
      const pad = step.padding ?? 6;
      if (el) {
        const bounds = el.getBoundingClientRect();
        const nextRect = {
          x: bounds.left - pad,
          y: bounds.top - pad,
          w: bounds.width + pad * 2,
          h: bounds.height + pad * 2,
        };
        targetRectRef.current = nextRect;

        // When target appears after async UI changes, snap once to avoid wandering animation.
        if (!hadTargetRef.current) {
          rectRef.current = { ...nextRect };
          setRenderedRect({ ...nextRect });
          hadTargetRef.current = true;
        }

        // Detect if the element's centre is offscreen
        const cx = bounds.left + bounds.width / 2;
        const cy = bounds.top + bounds.height / 2;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (cy < 0) setOffscreenDir("up");
        else if (cy > vh) setOffscreenDir("down");
        else if (cx < 0) setOffscreenDir("left");
        else if (cx > vw) setOffscreenDir("right");
        else setOffscreenDir(null);
      } else {
        // Element not in DOM yet — keep size 0 to hide glow until target mounts.
        targetRectRef.current.w = 0;
        targetRectRef.current.h = 0;
        setOffscreenDir(null);
        hadTargetRef.current = false;
      }

      // Lerp (smooth follow)
      rectRef.current.x = lerp(rectRef.current.x, targetRectRef.current.x, 0.12);
      rectRef.current.y = lerp(rectRef.current.y, targetRectRef.current.y, 0.12);
      rectRef.current.w = lerp(rectRef.current.w, targetRectRef.current.w, 0.12);
      rectRef.current.h = lerp(rectRef.current.h, targetRectRef.current.h, 0.12);

      setRenderedRect({ ...rectRef.current });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [active, step]);

  // Restart tutorial listener
  useEffect(() => {
    const handleRestart = () => {
      setStepIdx(0);
      setActive(false);
      setShowPrompt(true);
      setHighlightRetake(false);
      localStorage.removeItem("tutorial_seen");
    };
    window.addEventListener("restart-tutorial", handleRestart);
    return () => window.removeEventListener("restart-tutorial", handleRestart);
  }, []);

  // Advance step — snap when the element is likely in a new location
  const advanceStep = (nextIdx: number) => {
    setStepIdx(nextIdx);
    // Give DOM a moment to update (modals open, etc.) then snap.
    const nextStepId = TUTORIAL_STEPS[nextIdx]?.id;
    const delay = nextStepId && INSTANT_STEP_IDS.has(nextStepId) ? 0 : 80;
    setTimeout(() => snapToStep(nextIdx), delay);
    setTimeout(() => snapToStep(nextIdx), delay + 140);
  };

  // If user adds an extra folder mid-tutorial, jump to the folder "Continue" step.
  useEffect(() => {
    if (!active) return;
    const continueIdx = TUTORIAL_STEPS.findIndex((s) => s.id === "#tut-folder-continue-1");
    if (continueIdx === -1) return;

    const handleAddAnotherFolder = (e: Event) => {
      const addFolderBtn = document.querySelector("#tut-add-folder");
      if (!addFolderBtn) return;
      if (addFolderBtn === e.target || addFolderBtn.contains(e.target as Node)) {
        if (stepIdx >= 6 && stepIdx <= 13 && stepIdx !== continueIdx) {
          setTimeout(() => advanceStep(continueIdx), 0);
        }
      }
    };

    document.addEventListener("click", handleAddAnotherFolder, true);
    return () => document.removeEventListener("click", handleAddAnotherFolder, true);
  }, [active, stepIdx]);

  // Event listener logic
  useEffect(() => {
    if (!active || !step) return;

    if (step.autoAdvanceMs) {
      const t = setTimeout(() => {
        advanceStep(stepIdx + 1);
      }, step.autoAdvanceMs);
      return () => clearTimeout(t);
    }

    if (step.advanceOnEvent) {
      const handleEvent = (e: Event) => {
        const el = document.querySelector(step.id);
        if (el && (e.target === el || el.contains(e.target as Node))) {
          if (step.id === "#tut-sync-btn") {
            let tries = 0;
            const waitForCollectionCard = () => {
              tries += 1;
              const nextVisible = document.querySelector("#tut-add-collection");
              if (nextVisible) {
                advanceStep(stepIdx + 1);
                return;
              }
              if (tries < 40) window.setTimeout(waitForCollectionCard, 120);
            };
            window.setTimeout(waitForCollectionCard, 120);
            return;
          }

          setTimeout(() => {
            advanceStep(stepIdx + 1);
          }, 80);
        }
      };

      const eventType =
        step.advanceOnEvent === "input" ? "input" :
        step.advanceOnEvent === "blur" ? "focusout" :
        step.advanceOnEvent;

      document.addEventListener(eventType, handleEvent, true);
      return () => document.removeEventListener(eventType, handleEvent, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, stepIdx]);

  const handleStart = () => {
    setShowPrompt(false);
    setActive(true);
    localStorage.setItem("tutorial_seen", "true");

    // Jump strictly to the first element's position immediately
    setTimeout(() => {
      const el = document.querySelector(TUTORIAL_STEPS[0].id);
      if (el) {
        const b = el.getBoundingClientRect();
        const pad = TUTORIAL_STEPS[0].padding ?? 6;
        rectRef.current = { x: b.left - pad, y: b.top - pad, w: b.width + pad * 2, h: b.height + pad * 2 };
        setRenderedRect({ ...rectRef.current });
      }
    }, 50);
  };

  const handleDecline = () => {
    setShowPrompt(false);
    localStorage.setItem("tutorial_seen", "true");
  };

  // When tutorial completes
  useEffect(() => {
    if (active && stepIdx >= TUTORIAL_STEPS.length) {
      setActive(false);
      setHighlightRetake(true);
      const t = setTimeout(() => setHighlightRetake(false), 3000);
      return () => clearTimeout(t);
    }
  }, [active, stepIdx]);

  useEffect(() => {
    if (!highlightRetake) {
      setRetakeRect(null);
      return;
    }

    const syncRetakeRect = () => {
      const el = document.querySelector("#tut-retake-tutorial") as HTMLElement | null;
      if (!el) return;
      const b = el.getBoundingClientRect();
      setRetakeRect({ x: b.left - 6, y: b.top - 6, w: b.width + 12, h: b.height + 12 });
    };

    syncRetakeRect();
    const t = setTimeout(syncRetakeRect, 120);
    window.addEventListener("resize", syncRetakeRect);
    window.addEventListener("scroll", syncRetakeRect, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", syncRetakeRect);
      window.removeEventListener("scroll", syncRetakeRect, true);
    };
  }, [highlightRetake]);

  // Compute offscreen arrow position
  const arrowStyle = (() => {
    if (!offscreenDir) return null;
    const base: CSSProperties = {
      position: "fixed",
      zIndex: 10000,
      pointerEvents: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
    };
    // Arrow sits near the edge pointing toward the element
    switch (offscreenDir) {
      case "down":
        return { ...base, bottom: 24, left: "50%", transform: "translateX(-50%)" };
      case "up":
        return { ...base, top: 24, left: "50%", transform: "translateX(-50%)" };
      case "left":
        return { ...base, left: 24, top: "50%", transform: "translateY(-50%)" };
      case "right":
        return { ...base, right: 24, top: "50%", transform: "translateY(-50%)" };
      default:
        return null;
    }
  })();

  if (active && stepIdx >= TUTORIAL_STEPS.length && !highlightRetake) {
    return null;
  }

  return createPortal(
    <>
      {showPrompt && (
        <div className="tut-modal-backdrop">
          <div className="tut-modal">
            <h3>Need a tutorial?</h3>
            <p>Would you like a quick walkthrough on how to create your first catalog?</p>
            <div className="tut-modal-actions">
              <button className="button button--ghost" onClick={handleDecline}>No</button>
              <button className="button button--primary" onClick={handleStart}>Yes, start tour</button>
            </div>
          </div>
        </div>
      )}

      {/* Highlight retake button after finishing */}
      {highlightRetake && retakeRect && (
        <div
          className="tut-retake-highlight"
          style={{
            transform: `translate(${retakeRect.x}px, ${retakeRect.y}px)`,
            width: retakeRect.w,
            height: retakeRect.h,
          }}
        >
          <div className="tut-retake-copy">incase you forget</div>
        </div>
      )}

      {active && renderedRect.w > 2 && (
        <>
          <div
            className={`tut-glow ${step?.pulseFocus ? "tut-glow--pulse" : ""}`}
            style={{
              transform: `translate(${renderedRect.x}px, ${renderedRect.y}px)`,
              width: renderedRect.w,
              height: renderedRect.h,
            }}
          >
            {step?.text && (
              <div className="tut-tooltip">
                {step.text}
              </div>
            )}
          </div>

          {/* Offscreen arrow trail */}
          {offscreenDir && arrowStyle && (
            <div style={arrowStyle} className={`tut-offscreen-arrow tut-offscreen-arrow--${offscreenDir}`}>
              <div className="tut-offscreen-chevron">
                <span className="tut-offscreen-chevron__icon">▼</span>
              </div>
              <div className="tut-offscreen-trail">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </>
      )}
    </>,
    document.body
  );
}
