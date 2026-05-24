# Window Background — Glass Shell Implementation Notes

The Writer desktop window background is a custom frosted-glass shell built to
match Figma frame `1063:811` from the `AI-test` file
(`https://www.figma.com/design/TDKHEFDzfQNicoeJ9MWupw/AI-test?node-id=1063-811`).

The journey to the current implementation involved discovering several hard
limits in how transparent Electron windows compose against the macOS desktop.
This document captures **what each iteration tried, why it failed, and what
finally worked** — so future changes do not relitigate the same dead ends.

## Source spec (Figma node 1063:811)

```css
border-radius: 8px;
border: 1px solid var(--Radial, #9DCAFB);
background:
  linear-gradient(0deg, rgba(0, 0, 0, 0.09) 0%, rgba(0, 0, 0, 0.09) 100%),
  linear-gradient(176deg,
    rgba(26, 61, 76, 0.78)  -3.04%,
    rgba(14, 26, 62, 0.95)  41.61%,
    rgba(1, 3, 17, 0.95)    96.95%);
backdrop-filter: blur(25.15px);
```

Plus, separately, a radial-gradient border:
```css
border: radial-gradient(141.91% 107.01% at 19.5% 8.33%,
  rgba(157, 202, 251, 0.70)  0%,
  rgba(33, 54, 107, 0.70)    56.25%,
  rgba(157, 202, 251, 0.21)  100%);
```

## Iteration log

### 1. Direct CSS port → looked right on paper, wrong on screen

Translated the Figma values 1:1 into CSS variables on
[writer-window-background.css](../../apps/desktop/src/styles/writer-window-background.css)
with `backdrop-filter: blur(25.15px)` on an inner `.writer-window-frame__glass`
layer. Result: a dark gradient with no visible glass effect.

### 2. Black 1px line at the window edge

The earlier implementation set `roundedCorners: false` on the BrowserWindow to
avoid the older "black halo" issue. On modern macOS (Electron 39+ / Chromium
134+), that flag tells the OS compositor "this window is rectangular" and the
compositor draws a 1px dark separator at the edge.

**Fix:** removed `roundedCorners: false`. Modern Electron handles the halo
issue without it. The compositor artifact disappeared.

### 3. Gradient border with rounded corners

CSS `border` does not support gradients. Used the standard mask technique on a
`::before` pseudo-element to draw the 1px radial-gradient border:

```css
.writer-window-frame::before {
  inset: 0;
  padding: 1px;
  background: var(--writer-border-gradient);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: destination-out;
  mask-composite: exclude;
}
```

This is the only way to combine `border-radius` with a gradient stroke.

### 4. The traffic lights came back

Re-enabling native rounded corners brought back the macOS window control
buttons (the red/yellow/green dots). Hid them via
`window.setWindowButtonVisibility(false)` in
[create-main-window.cjs](../../apps/desktop/electron/create-main-window.cjs).

### 5. CSS `backdrop-filter` does NOT blur the OS desktop

The biggest discovery. We expected `backdrop-filter: blur()` on the glass layer
to blur the wallpaper behind the window. It did not — at any value, including
extreme ones (200px+).

**Why:** Electron transparent windows show the desktop via OS-level
compositing. The Chromium renderer process never receives the desktop pixels
into its own framebuffer. `backdrop-filter` can only blur content that exists
in Chromium's compositor tree, which for a transparent window with empty
backing is effectively nothing.

We also tried moving `backdrop-filter` from the inner glass layer to the
outermost `.writer-window-frame` element to bypass the
nested-stacking-context theory. Same result: no visible blur of the desktop.

### 6. macOS NSVisualEffectView via Electron `vibrancy`

The correct path on macOS is the OS's own visual effect API. Electron exposes
it as `BrowserWindow.vibrancy`. We added:

```js
vibrancy: "under-window",
visualEffectState: "active",
```

This made the wallpaper genuinely blur behind the window — frosted glass at
the OS level.

### 7. The Figma alpha values cover the vibrancy

With vibrancy working, switching to the Figma fill gradient (78–95% alpha)
covered the blur almost completely. The dark navy stops are essentially opaque
at those alpha values, leaving the frosted glass invisible.

### 8. `mix-blend-mode` cannot reach the OS vibrancy layer

We tried `mix-blend-mode: multiply` (and every other mode) hoping the
gradient would *stain* the vibrancy rather than cover it. All blend modes
produced identical output, because `mix-blend-mode` only blends with
**siblings in the same web stacking context**. The vibrancy is composited at
the OS level, below the web content — Chromium's blend pipeline never sees it.

This is the second fundamental CSS limit we hit, after `backdrop-filter`.

### 9. Practical compromise: alpha reduction + saturate compensation

There is no way to keep the full Figma alpha *and* show the vibrancy. The
only honest option is to reduce alpha so the vibrancy shows through, then
boost saturation so the lower-alpha colors still read as rich navy:

```css
.writer-window-frame__glass {
  background-image: var(--writer-figma-background-image);
  opacity:  var(--writer-tint-opacity,  0.88);
  filter:   saturate(var(--writer-tint-saturate, 0.98));
}
```

### 10. Top color: lifted out of the same family

The original Figma top stop (`rgba(26, 61, 76, 0.78)`) is a very dark teal.
After the alpha reduction in step 9 it barely registered against the deep
navy middle and bottom — the three-band gradient looked flat.

Shifted the top stop to a noticeably lighter version of the *same* hue
(roughly the same R:G:B ratio, scaled up in luminance, alpha down):

| Position    | Figma value                | Current value                |
|-------------|----------------------------|------------------------------|
| Top (-3%)   | `rgba(26, 61, 76, 0.78)`   | `rgba(48, 100, 125, 0.62)`   |
| Mid (41%)   | `rgba(14, 26, 62, 0.95)`   | unchanged                    |
| Bottom (97%)| `rgba(1, 3, 17, 0.95)`     | unchanged                    |

The result is a visible three-band gradient — lighter blue-teal at the top,
deep navy through the middle, near-black at the bottom — matching the visual
intent of the Figma frame.

### 11. Vibrancy slider: pick the material, not the radius

`backdrop-filter` cannot vary the vibrancy blur strength because the blur
lives on the OS layer. The only knob available is the
**NSVisualEffectMaterial**, chosen at window creation (or via
`win.setVibrancy()`). A debug overlay (`BlurDebugSlider`) was added to switch
materials live for design exploration. `under-window` was chosen as the final
material — balanced blur depth without the heaviest fullscreen-UI tint.

## Final values

CSS (`writer-window-background.css`):
- `--writer-border-radius: 16px`
- `--writer-backdrop-blur: 80px` (unused at runtime; kept for reference)
- `--writer-tint-opacity: 0.88`
- `--writer-tint-saturate: 0.98`
- Top stop: `rgba(48, 100, 125, 0.62)` (custom, lifted from Figma top)
- Mid stop: `rgba(14, 26, 62, 0.95)` (Figma)
- Bottom stop: `rgba(1, 3, 17, 0.95)` (Figma)
- Border gradient: unchanged from Figma radial spec

Electron (`create-main-window.cjs`):
- `frame: false`
- `titleBarStyle: "hidden"`
- `transparent: true`
- `vibrancy: "under-window"`
- `visualEffectState: "active"`
- `hasShadow: false`
- `roundedCorners` left at default (`true`) — macOS handles the edge
- `window.setWindowButtonVisibility(false)` to hide traffic lights

## Lessons for future glass surfaces

1. **CSS `backdrop-filter` only blurs web content.** It does not see the OS
   desktop in a transparent Electron window. If you need to blur the desktop,
   you need OS vibrancy.

2. **CSS `mix-blend-mode` only blends with web siblings.** It does not blend
   with OS vibrancy. Reaching across the OS / web boundary is not possible
   from CSS.

3. **Figma's `backdrop-filter` is not the same effect.** Figma renders the
   entire canvas and has pixel access to whatever is behind a frame. In a
   running app the OS controls those pixels. "Looks like Figma in Figma"
   does not imply "looks like Figma at runtime."

4. **Tint alpha and visible blur trade off directly.** There is no math that
   lets a high-alpha overlay show vibrancy through it. Pick a balance and
   compensate with `saturate()` for color richness.

5. **For rectangular transparent windows on macOS, do not set
   `roundedCorners: false` on Electron 39+.** It triggers a 1px compositor
   separator at the window edge.
