/**
 * Neiki's Charts — BarChart renderer
 * neiki-charts 1.0.0 | MIT
 *
 * Renders grouped vertical or horizontal bar charts with optional grid,
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

/* =============================================================================
   BarChart
   ============================================================================= */

/**
 * Renders a bar chart (grouped, vertical or horizontal) into an SVG element.
 *
 * Inherits from `NChart` — prototype chain is wired in `neiki-charts.js`
 * after `NChart` is declared.
 *
 * @extends NChart
 */
class BarChart {
  /**
   * @param {object}  options                        - Merged chart options from `NChartElement`.
   * @param {string}  [options.orientation='vertical'] - `'vertical'` or `'horizontal'`.
   * @param {boolean} [options.grid=false]           - Draw grid lines and axis labels.
   * @param {boolean} [options.tooltip=false]        - Enable hover / touch tooltips.
   * @param {boolean} [options.animated=false]       - Add animation CSS class to bar elements.
   * @param {string[]} [options.colors=[]]           - Custom color palette.
   */
  constructor(options) {
    this.options = options || {};
  }

  /**
   * Entry point — renders the full bar chart into `svg`.
   *
   * @param {SVGSVGElement} svg - Target SVG element (inside Shadow DOM).
   * @param {number}        w   - Available width in pixels.
   * @param {number}        h   - Available height in pixels.
   * @param {{ labels: string[], datasets: Array<{label: string, data: number[], color?: string, _hidden: boolean}> }} data
   */
  render(svg, w, h, data) {
    const labels   = data.labels   || [];
    const datasets = data.datasets || [];

    const pad = { top: 20, right: 20, bottom: 40, left: 50 };

    // Visible datasets only
    const visibleDatasets = datasets.filter((ds) => !ds._hidden);

    // NOTE: we intentionally do NOT bail out when every dataset is hidden.
    // Returning here would skip drawing the grid and axis labels, making the
    // whole chart frame (including the numbers) vanish. Instead we fall through
    // with a sensible fallback range so the empty axes stay on screen.

    // ------------------------------------------------------------------
    // Compute value range across all visible datasets
    // ------------------------------------------------------------------
    let minVal = Infinity;
    let maxVal = -Infinity;

    visibleDatasets.forEach((ds) => {
      (ds.data || []).forEach((v) => {
        const n = Number(v);
        if (!isNaN(n)) {
          if (n < minVal) minVal = n;
          if (n > maxVal) maxVal = n;
        }
      });
    });

    // Fallback when no visible data or all values identical
    if (!isFinite(minVal)) { minVal = 0; maxVal = 1; }
    if (minVal === maxVal) { minVal -= 1; maxVal += 1; }

    // Bar charts always start at 0 (bars extend from baseline)
    minVal = Math.min(0, minVal);

    const isHorizontal = this.options.orientation === 'horizontal';

    if (isHorizontal) {
      this._renderHorizontal(svg, w, h, data, labels, visibleDatasets, datasets, minVal, maxVal, pad);
    } else {
      this._renderVertical(svg, w, h, data, labels, visibleDatasets, datasets, minVal, maxVal, pad);
    }
  }

  /**
   * Renders vertical (default) grouped bars.
   *
   * @param {SVGSVGElement} svg
   * @param {number} w
   * @param {number} h
   * @param {object} data          - Full data object (for shadow root resolution).
   * @param {string[]} labels
   * @param {Array}  visibleDatasets
   * @param {Array}  allDatasets   - All datasets including hidden ones (for index-based color lookup).
   * @param {number} minVal
   * @param {number} maxVal
   * @param {{top:number, right:number, bottom:number, left:number}} pad
   * @private
   */
  _renderVertical(svg, w, h, data, labels, visibleDatasets, allDatasets, minVal, maxVal, pad) {
    const plotWidth  = w - pad.left - pad.right;
    const plotHeight = h - pad.top  - pad.bottom;

    const groupCount      = labels.length || 1;
    const groupBandWidth  = plotWidth / groupCount;
    const barW            = groupBandWidth / visibleDatasets.length * 0.8;

    /**
     * Maps a group index to the center x-coordinate of that group's band.
     * @param {number} i
     * @returns {number}
     */
    const xScale = (i) => pad.left + (i + 0.5) * groupBandWidth;

    /**
     * Maps a data value to a pixel y-coordinate.
     * @param {number} v
     * @returns {number}
     */
    const yScale = (v) =>
      h - pad.bottom - ((v - minVal) / (maxVal - minVal)) * plotHeight;

    // Build tick descriptors for drawGrid
    const xTicks = labels.map((lbl, i) => ({ value: lbl, x: xScale(i) }));

    const Y_TICK_COUNT = 5;
    const yTicks = [];
    for (let t = 0; t <= Y_TICK_COUNT; t++) {
      const val = minVal + (t / Y_TICK_COUNT) * (maxVal - minVal);
      yTicks.push({ value: _formatTickValue(val), y: yScale(val) });
    }

    if (this.options.grid) {
      this.drawGrid(svg, xTicks, yTicks, w, h, pad);
    }

    const shadowRoot = svg.getRootNode();
    const self = this;

    // Draw bars for each visible dataset
    visibleDatasets.forEach((ds, dsIdx) => {
      if (!ds.data || ds.data.length === 0) return;

      // Resolve color using original dataset index for consistent palette cycling
      const originalIdx = allDatasets.indexOf(ds);
      const color  = ds.color || this.colorAt(originalIdx >= 0 ? originalIdx : dsIdx);
      const dsLabel = ds.label || ('Dataset ' + (dsIdx + 1));

      labels.forEach((lbl, groupIdx) => {
        const v = Number(ds.data[groupIdx]);
        if (isNaN(v)) return;

        const groupX = xScale(groupIdx);
        const barX   = groupX - (visibleDatasets.length / 2) * barW + dsIdx * barW + barW * 0.1;
        const barY   = yScale(Math.max(v, 0));
        const barH   = Math.abs(yScale(0) - yScale(v));

        const barClass = 'nc-bar nc-bar-v';

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x',      barX);
        rect.setAttribute('y',      barY);
        rect.setAttribute('width',  barW * 0.8);
        rect.setAttribute('height', Math.max(barH, 0));
        rect.setAttribute('fill',   color);
        rect.setAttribute('class',  barClass);
        rect.setAttribute('aria-label', lbl + ': ' + v);
        rect.setAttribute('tabindex', '0');
        rect.setAttribute('role',   'img');

        if (self.options.tooltip) {
          const content = { label: lbl, value: v, dataset: dsLabel };
          _attachTooltipListeners(rect, content, shadowRoot, self);
        }

        svg.appendChild(rect);
      });
    });
  }

  /**
   * Renders horizontal grouped bars (categories on Y, values on X).
   *
   * @param {SVGSVGElement} svg
   * @param {number} w
   * @param {number} h
   * @param {object} data
   * @param {string[]} labels
   * @param {Array}  visibleDatasets
   * @param {Array}  allDatasets
   * @param {number} minVal
   * @param {number} maxVal
   * @param {{top:number, right:number, bottom:number, left:number}} pad
   * @private
   */
  _renderHorizontal(svg, w, h, data, labels, visibleDatasets, allDatasets, minVal, maxVal, pad) {
    const plotWidth  = w - pad.left - pad.right;
    const plotHeight = h - pad.top  - pad.bottom;

    const groupCount     = labels.length || 1;
    const groupBandH     = plotHeight / groupCount;
    const barH           = groupBandH / visibleDatasets.length * 0.8;

    /**
     * Maps a data value to a pixel x-coordinate.
     * @param {number} v
     * @returns {number}
     */
    const xScale = (v) =>
      pad.left + ((v - minVal) / (maxVal - minVal)) * plotWidth;

    /**
     * Maps a group index to the center y-coordinate of that group's band.
     * @param {number} i
     * @returns {number}
     */
    const yScale = (i) => pad.top + (i + 0.5) * groupBandH;

    // Build tick descriptors — for horizontal: xTicks carry value labels, yTicks carry category labels
    const X_TICK_COUNT = 5;
    const xTicks = [];
    for (let t = 0; t <= X_TICK_COUNT; t++) {
      const val = minVal + (t / X_TICK_COUNT) * (maxVal - minVal);
      xTicks.push({ value: _formatTickValue(val), x: xScale(val) });
    }

    const yTicks = labels.map((lbl, i) => ({ value: lbl, y: yScale(i) }));

    if (this.options.grid) {
      this.drawGrid(svg, xTicks, yTicks, w, h, pad);
    }

    const shadowRoot = svg.getRootNode();
    const self = this;

    // Draw bars for each visible dataset
    visibleDatasets.forEach((ds, dsIdx) => {
      if (!ds.data || ds.data.length === 0) return;

      const originalIdx = allDatasets.indexOf(ds);
      const color  = ds.color || this.colorAt(originalIdx >= 0 ? originalIdx : dsIdx);
      const dsLabel = ds.label || ('Dataset ' + (dsIdx + 1));

      labels.forEach((lbl, groupIdx) => {
        const v = Number(ds.data[groupIdx]);
        if (isNaN(v)) return;

        const groupY = yScale(groupIdx);
        const barY   = groupY - (visibleDatasets.length / 2) * barH + dsIdx * barH + barH * 0.1;
        const barX   = xScale(0);
        const barW   = xScale(v) - xScale(0);

        const barClass = 'nc-bar nc-bar-h';

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x',      barX);
        rect.setAttribute('y',      barY);
        rect.setAttribute('width',  Math.max(barW, 0));
        rect.setAttribute('height', barH * 0.8);
        rect.setAttribute('fill',   color);
        rect.setAttribute('class',  barClass);
        rect.setAttribute('aria-label', lbl + ': ' + v);
        rect.setAttribute('tabindex', '0');
        rect.setAttribute('role',   'img');

        if (self.options.tooltip) {
          const content = { label: lbl, value: v, dataset: dsLabel };
          _attachTooltipListeners(rect, content, shadowRoot, self);
        }

        svg.appendChild(rect);
      });
    });
  }
}

/* =============================================================================
   Module-private helpers
   ============================================================================= */

/**
 * Attaches tooltip and keyboard event listeners to a bar `<rect>` element.
 *
 * Handles: `mouseover`, `mousemove`, `mouseout`, `touchstart`, `touchend`,
 * `focus`, and `blur` events.
 *
 * @param {SVGRectElement} rect        - The bar element to attach listeners to.
 * @param {{label: string, value: number, dataset: string}} content - Tooltip content.
 * @param {ShadowRoot|Document} shadowRoot - Root node for tooltip lookup.
 * @param {BarChart} chart             - Chart instance (for `drawTooltip` access).
 */
function _attachTooltipListeners(rect, content, shadowRoot, chart) {
  rect.addEventListener('mouseover', function (e) {
    chart.drawTooltip(shadowRoot, e.clientX, e.clientY, content);
  });
  rect.addEventListener('mousemove', function (e) {
    chart.drawTooltip(shadowRoot, e.clientX, e.clientY, content);
  });
  rect.addEventListener('mouseout', function () {
    chart.drawTooltip(shadowRoot, 0, 0, null);
  });
  rect.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    chart.drawTooltip(shadowRoot, t.clientX, t.clientY, content);
  }, { passive: true });
  rect.addEventListener('touchend', function () {
    chart.drawTooltip(shadowRoot, 0, 0, null);
  });
  rect.addEventListener('focus', function () {
    var r = rect.getBoundingClientRect();
    chart.drawTooltip(shadowRoot, r.left + r.width / 2, r.top, content);
  });
  rect.addEventListener('blur', function () {
    chart.drawTooltip(shadowRoot, 0, 0, null);
  });
}

/**
 * Formats a numeric tick value for display on an axis label.
 * Rounds to at most one decimal place; returns integers without a decimal point.
 *
 * @param {number} val
 * @returns {string}
 */
function _formatTickValue(val) {
  var rounded = Math.round(val * 10) / 10;
  return String(rounded);
}

/* ESM export — used by neiki-charts.js when loaded as modules in the browser. */
export { BarChart };
