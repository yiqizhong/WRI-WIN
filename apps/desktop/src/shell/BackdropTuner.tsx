import { useEffect, useState } from "react";

type Material = "none" | "mica" | "acrylic" | "tabbed";

/**
 * DEV-ONLY backdrop tuner. Floating panel with sliders to mix the navy gradient
 * against the native Win11 material in real time, plus a material switcher.
 *
 * - "Gradient opacity" → --writer-tint-opacity (1 = solid gradient, 0 = full blur)
 * - "Gradient alpha"   → --writer-tint-alpha   (extra multiplier on the fill alphas)
 * - "Overlay darken"   → --writer-tint-overlay (extra black overlay on top)
 *
 * Toggle with Ctrl+Shift+B. Values are not persisted — read them off the panel
 * and bake the ones you like into writer-window-background.css.
 */
export function BackdropTuner() {
  const [open, setOpen] = useState(true);
  const [opacity, setOpacity] = useState(0.92);
  const [material, setMaterial] = useState<Material>("mica");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drive the glass layer's CSS var live.
  useEffect(() => {
    const glass = document.querySelector<HTMLElement>(".writer-window-frame__glass");
    if (glass) {
      glass.style.setProperty("--writer-tint-opacity", String(opacity));
    }
  }, [opacity]);

  const applyMaterial = (next: Material) => {
    setMaterial(next);
    void window.writerDesktop?.setBackgroundMaterial?.(next);
  };

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        right: 16,
        zIndex: 9999,
        width: 260,
        padding: 14,
        borderRadius: 10,
        background: "rgba(10, 16, 32, 0.92)",
        border: "1px solid rgba(157, 202, 251, 0.35)",
        color: "#e5f1ff",
        font: "12px/1.5 system-ui, sans-serif",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        // Never let this panel become a drag region.
        WebkitAppRegion: "no-drag"
      } as React.CSSProperties}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <strong>Backdrop tuner</strong>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "#e5f1ff",
            cursor: "pointer",
            fontSize: 14
          }}
          aria-label="Close tuner"
        >
          ×
        </button>
      </div>

      <label style={{ display: "block", marginBottom: 4 }}>
        Material
      </label>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {(["none", "mica", "acrylic", "tabbed"] as Material[]).map((m) => (
          <button
            key={m}
            onClick={() => applyMaterial(m)}
            style={{
              flex: "1 0 auto",
              padding: "4px 8px",
              borderRadius: 6,
              cursor: "pointer",
              border: "1px solid rgba(157,202,251,0.3)",
              background: material === m ? "var(--writer-accent-blue, #2083ea)" : "transparent",
              color: "#e5f1ff",
              fontSize: 11
            }}
          >
            {m === "tabbed" ? "mica-alt" : m}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span>Mix (gradient ⟷ blur)</span>
        <span>{opacity.toFixed(2)}</span>
      </label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={opacity}
        onChange={(e) => setOpacity(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <div style={{ marginTop: 4, opacity: 0.6, fontSize: 10 }}>
        1.0 = solid gradient · 0.0 = full blur
      </div>

      <div style={{ marginTop: 10, opacity: 0.6, fontSize: 10 }}>
        Ctrl+Shift+B to toggle
      </div>
    </div>
  );
}
