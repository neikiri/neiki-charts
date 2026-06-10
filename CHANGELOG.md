# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-06-10

### Added

- **Web Component registration** — `<neiki-chart>` custom element via `customElements.define`; Shadow DOM for style encapsulation; `observedAttributes` for reactive attribute changes.
- **Line chart** (`type="line"`) — smooth Bézier curves, optional area fill, and per-point markers.
- **Bar chart** (`type="bar"`) — grouped vertical bars by default; horizontal orientation via `orientation="horizontal"`.
- **Pie / donut chart** (`type="pie"`) — pie slices with optional donut hole controlled by `inner-radius`.
- **Scatter chart** (`type="scatter"`) — x/y `<circle>` elements; optional `size` field scales each point's radius.
- **JS API** — `setData({ labels, datasets })` and `setOptions(opts)` for programmatic control and re-render.
- **Responsive redraws** — `ResizeObserver`-based layout updates debounced at 100 ms, with graceful fallback for unsupported browsers.
- **Theming** — light and dark palettes via `theme` attribute; automatic `prefers-color-scheme` detection when no `theme` is set.
- **Tooltip** — hover and touch support, viewport-clamped positioning to prevent overflow.
- **Legend** — rendered when `legend="true"`; click or keyboard activation toggles individual dataset visibility.
- **Accessibility** — SVG root has `role="img"` and a descriptive `aria-label`; interactive elements (`<circle>`, `<rect>`) carry `aria-label` and `tabindex="0"`; legend items are `<button>` elements with `role="checkbox"` and `aria-checked`.
- **CSS animations** — bar scale-in, line draw, and pie fade transitions; all gated behind `prefers-reduced-motion: no-preference`.
- **Build pipeline** — `minify.py` concatenates `src/charts/line.js`, `bar.js`, `pie.js`, `scatter.js`, and `src/neiki-charts.js`; inlines minified CSS at the `NEIKI-CHARTS / CSS-INJECT` marker; outputs `dist/neiki-charts.min.js` (with `/* neiki-charts 1.0.0 | MIT */` banner) and `dist/neiki-charts.min.css`.
