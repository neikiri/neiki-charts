/**
 * Neiki's Charts — ScatterChart renderer
 * neiki-charts 1.0.0 | MIT
 *
 * Renders scatter charts with per-point radius control, optional grid,
 * tooltips, and entrance animations.
 *
 * Concatenation note: this file is bundled BEFORE `neiki-charts.js` by minify.py,
 * so `NChart` and `SVG_NS` are not yet declared when this script is parsed.
 * Prototype wiring (`Object.setPrototypeOf`) is performed at the bottom of
 * `neiki-charts.js` once `NChart` is defined.
 * `SVG_NS` is guarded with `var` so it works both standalone (dev) and in the bundle.
 */

'use strict';

/* global SVG_NS */

// Guard: defined here for standalone / ESM dev use; no-op redeclaration in bundle
// because `var` declarations do not throw on re-declaration.
var SVG_NS = (typeof SVG_NS !== 'undefined' ? SVG_NS : 'http://www.w3.org/2000/svg'); // eslint-disable-line no-redeclare, no-use-before-define

/** Default dot radius when no `size` field is provided on a data point. */
var SCATTER_DEFAULT_RADIUS = 5;

/* =============================================================================
   ScatterChart
   ============================================================================= */

/**
 * Renders a scatter chart into an SVG element.
 *
 * Each data point must have `x` and `y` numeric fields.
 * An optional `size` field overrides the default dot radius for that point.
 *
 * Inherits from `NChart` — prototype chain is wired in `neiki-charts.js`
 * after `NChart` is declared.
 *
 * @extends NChart
 */
class ScatterChart {
  /**
   * @param {object}  options               - Merged chart options from `NChartElement`.
   * @param {boolean} [options.grid=false]  - Draw grid lines and axis labels.
   * @param {boolean} [options.tooltip=false] - Enable hover / touch tooltips.
   * @param {boolean} [options.animated=false] - Add animation CSS class to dot elements.
   * @param {string[]} [options.colors=[]]  - Custom color palette.
   */
  constructor(options) {
    this.options = options || {};
  }

  /**
   * Entry point — renders the full scatter chart into `svg`.
   *
   * @param {SVGSVGElement} svg - Target SVG element (inside Shadow DOM).
   * @param {number}        w   - Available width in pixels.
   * @param {number}        h   - Available height in pixels.
   * @param {{ labels: string[], datasets: Array<{label: string, data: Array<{x: number, y: number, size?: number}>, color?: string, _hidden: boolean}> }} data
   */
  render(svg, w, h, data) {
    const datasets = data.datasets || [];

    const pad = { top: 20, right: 20, bottom: 40, left: 50 };

    // ------------------------------------------------------------------
    // 7.2  Compute x/y scales from data range across all visible datasets
    // ------------------------------------------------------------------
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    datasets.forEach((ds) => {
      if (ds._hidden) return;
      (ds.data || []).forEach((pt) => {
        const x = Number(pt.x);
        const y = Number(pt.y);
        if (!isNaN(x)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
        if (!isNaN(y)) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      });
    });

    // Fallbacks when no visible data or all values identical
    if (!isFinite(minX)) { minX = 0; maxX = 1; }
    if (!isFinite(minY)) { minY = 0; maxY = 1; }
    if (minX === maxX) { minX -= 1; maxX += 1; }
    if (minY === maxY) { minY -= 1; maxY += 1; }

    // Add a small padding margin so points on the edge aren't clipped
    const xPad = (maxX - minX) * 0.05 || 1;
    const yPad = (maxY - minY) * 0.05 || 1;
    minX -= xPad; maxX += xPad;
    minY -= yPad; maxY += yPad;

    /**
     * Maps a data x-value to a pixel x-coordinate.
     * @param {number} v
     * @returns {number}
     */
    const xScale = (v) =>
      pad.left + ((v - minX) / (maxX - minX)) * (w - pad.left - pad.right);

    /**
     * Maps a data y-value to a pixel y-coordinate (inverted: higher values → smaller y).
     * @param {number} v
     * @returns {number}
     */
    const yScale = (v) =>
      h - pad.bottom - ((v - minY) / (maxY - minY)) * (h - pad.top - pad.bottom);

    // Build tick descriptors for drawGrid
    const X_TICK_COUNT = 5;
    const xTicks = [];
    for (let t = 0; t <= X_TICK_COUNT; t++) {
      const val = minX + (t / X_TICK_COUNT) * (maxX - minX);
      xTicks.push({ value: _formatScatterTick(val), x: xScale(val) });
    }

    const Y_TICK_COUNT = 5;
    const yTicks = [];
    for (let t = 0; t <= Y_TICK_COUNT; t++) {
      const val = minY + (t / Y_TICK_COUNT) * (maxY - minY);
      yTicks.push({ value: _formatScatterTick(val), y: yScale(val) });
    }

    // ------------------------------------------------------------------
    // Grid (calls NChart.drawGrid via prototype chain)
    // ------------------------------------------------------------------
    if (this.options.grid) {
      this.drawGrid(svg, xTicks, yTicks, w, h, pad);
    }

    // Shadow root for tooltip attachment
    const shadowRoot = svg.getRootNode();

    // ------------------------------------------------------------------
    // 7.3 & 7.4  Draw <circle> per data point with ARIA + tooltip
    // ------------------------------------------------------------------
    datasets.forEach((ds, dsIdx) => {
      if (ds._hidden || !ds.data || ds.data.length === 0) return;

      const color   = ds.color || this.colorAt(dsIdx);
      const dsLabel = ds.label || ('Dataset ' + (dsIdx + 1));
      const self    = this;

      ds.data.forEach((pt) => {
        const px = Number(pt.x);
        const py = Number(pt.y);
        if (isNaN(px) || isNaN(py)) return;

        const cx = xScale(px);
        const cy = yScale(py);

        // 7.3  Use `size` from data point if present, otherwise default radius
        const r = (pt.size !== undefined && pt.size !== null && !isNaN(Number(pt.size)))
          ? Number(pt.size)
          : SCATTER_DEFAULT_RADIUS;

        const ariaLabel = dsLabel + ': (' + px + ', ' + py + ')';

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', color);
        circle.setAttribute('class', 'nc-dot');
        circle.setAttribute('aria-label', ariaLabel);
        circle.setAttribute('tabindex', '0');
        circle.setAttribute('role', 'img');

        // 7.4  Hover + touch tooltip listeners
        if (self.options.tooltip) {
          const content = { label: '(' + px + ', ' + py + ')', value: '', dataset: dsLabel };

          circle.addEventListener('mouseover', function (e) {
            self.drawTooltip(shadowRoot, e.clientX, e.clientY, content);
          });
          circle.addEventListener('mousemove', function (e) {
            self.drawTooltip(shadowRoot, e.clientX, e.clientY, content);
          });
          circle.addEventListener('mouseout', function () {
            self.drawTooltip(shadowRoot, 0, 0, null);
          });
          circle.addEventListener('touchstart', function (e) {
            var t = e.touches[0];
            self.drawTooltip(shadowRoot, t.clientX, t.clientY, content);
          }, { passive: true });
          circle.addEventListener('touchend', function () {
            self.drawTooltip(shadowRoot, 0, 0, null);
          });
          // Keyboard accessibility
          circle.addEventListener('focus', function () {
            var rect = circle.getBoundingClientRect();
            self.drawTooltip(shadowRoot, rect.left + rect.width / 2, rect.top, content);
          });
          circle.addEventListener('blur', function () {
            self.drawTooltip(shadowRoot, 0, 0, null);
          });
        }

        svg.appendChild(circle);
      });
    });
  }
}

/* =============================================================================
   Module-private helpers
   ============================================================================= */

/**
 * Formats a numeric axis tick value for display.
 * Rounds to at most one decimal place; returns integers without a decimal point.
 *
 * @param {number} val
 * @returns {string}
 */
function _formatScatterTick(val) {
  var rounded = Math.round(val * 10) / 10;
  return String(rounded);
}

/* ESM export — used by neiki-charts.js when loaded as modules in the browser. */
export { ScatterChart };
