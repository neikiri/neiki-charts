/**
 * Neiki's Charts — LineChart renderer
 * neiki-charts 1.0.0 | MIT
 *
 * Renders line charts with optional smooth curves, area fill, and circle markers.
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
   LineChart
   ============================================================================= */

/**
 * Renders a line chart into an SVG element.
 *
 * Inherits from `NChart` — prototype chain is wired in `neiki-charts.js`
 * after `NChart` is declared.
 *
 * @extends NChart
 */
class LineChart {
  /**
   * @param {object} options - Merged chart options from `NChartElement`.
   * @param {boolean} [options.smooth=false]   - Use cubic bezier curves instead of straight lines.
   * @param {boolean} [options.area=false]     - Draw a filled area under each line.
   * @param {boolean} [options.grid=false]     - Draw grid lines and axis labels.
   * @param {boolean} [options.tooltip=false]  - Enable hover / touch tooltips.
   * @param {boolean} [options.animated=false] - Add animation CSS class to line elements.
   * @param {string[]} [options.colors=[]]     - Custom color palette.
   */
  constructor(options) {
    this.options = options || {};
  }

  /**
   * Entry point — renders the full line chart into `svg`.
   *
   * @param {SVGSVGElement} svg  - Target SVG element (inside Shadow DOM).
   * @param {number}        w   - Available width in pixels.
   * @param {number}        h   - Available height in pixels.
   * @param {{ labels: string[], datasets: Array<{label: string, data: number[], color?: string, _hidden: boolean}> }} data
   */
  render(svg, w, h, data) {
    const labels   = data.labels   || [];
    const datasets = data.datasets || [];

    const pad = { top: 20, right: 20, bottom: 40, left: 50 };

    // ------------------------------------------------------------------
    // 4.2  Compute y range across all visible datasets
    // ------------------------------------------------------------------
    let minVal = Infinity;
    let maxVal = -Infinity;

    datasets.forEach((ds) => {
      if (ds._hidden) return;
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

    const xCount = labels.length || 1;

    /**
     * Maps a label index to a pixel x-coordinate.
     * @param {number} i
     * @returns {number}
     */
    const xScale = (i) =>
      pad.left + (i / Math.max(xCount - 1, 1)) * (w - pad.left - pad.right);

    /**
     * Maps a data value to a pixel y-coordinate.
     * @param {number} v
     * @returns {number}
     */
    const yScale = (v) =>
      h - pad.bottom - ((v - minVal) / (maxVal - minVal)) * (h - pad.top - pad.bottom);

    // Build tick descriptors for drawGrid
    const xTicks = labels.map((lbl, i) => ({ value: lbl, x: xScale(i) }));

    const Y_TICK_COUNT = 5;
    const yTicks = [];
    for (let t = 0; t <= Y_TICK_COUNT; t++) {
      const val = minVal + (t / Y_TICK_COUNT) * (maxVal - minVal);
      yTicks.push({ value: Math.round(val * 10) / 10, y: yScale(val) });
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
    // 4.4  Area fills — drawn BEFORE lines so lines render on top
    // ------------------------------------------------------------------
    if (this.options.area) {
      datasets.forEach((ds, dsIdx) => {
        if (ds._hidden || !ds.data || ds.data.length === 0) return;

        const color  = ds.color || this.colorAt(dsIdx);
        const points = ds.data.map((v, i) => [xScale(i), yScale(Number(v))]);
        const baseline = yScale(minVal);

        // Build path: line segment + close down to baseline
        let d = 'M ' + points[0][0] + ',' + points[0][1];

        if (this.options.smooth && points.length > 1) {
          d += _cubicBezierSegments(points);
        } else {
          for (let i = 1; i < points.length; i++) {
            d += ' L ' + points[i][0] + ',' + points[i][1];
          }
        }

        // Close the area shape down to the baseline and back
        d += ' L ' + points[points.length - 1][0] + ',' + baseline;
        d += ' L ' + points[0][0] + ',' + baseline + ' Z';

        const area = document.createElementNS(SVG_NS, 'path');
        area.setAttribute('d', d);
        area.setAttribute('fill', _colorWithAlpha(color, 0.2));
        area.setAttribute('stroke', 'none');
        area.setAttribute('class', 'nc-area');
        svg.appendChild(area);
      });
    }

    // ------------------------------------------------------------------
    // 4.3  Line paths / polylines
    // ------------------------------------------------------------------
    datasets.forEach((ds, dsIdx) => {
      if (ds._hidden || !ds.data || ds.data.length === 0) return;

      const color  = ds.color || this.colorAt(dsIdx);
      const points = ds.data.map((v, i) => [xScale(i), yScale(Number(v))]);

      let lineClass = 'nc-line-path';
      if (this.options.animated) lineClass += ' nc-line-path--animated';

      if (this.options.smooth && points.length > 1) {
        // Cubic bezier <path>
        const d = 'M ' + points[0][0] + ',' + points[0][1] +
          _cubicBezierSegments(points);

        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('class', lineClass);
        svg.appendChild(path);
      } else {
        // Straight <polyline>
        const pointsStr = points.map((p) => p[0] + ',' + p[1]).join(' ');

        const polyline = document.createElementNS(SVG_NS, 'polyline');
        polyline.setAttribute('points', pointsStr);
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', color);
        polyline.setAttribute('stroke-width', '2');
        polyline.setAttribute('class', lineClass);
        svg.appendChild(polyline);
      }
    });

    // ------------------------------------------------------------------
    // 4.5  Circle markers with ARIA and tooltip listeners
    // ------------------------------------------------------------------
    datasets.forEach((ds, dsIdx) => {
      if (ds._hidden || !ds.data || ds.data.length === 0) return;

      const color   = ds.color || this.colorAt(dsIdx);
      const dsLabel = ds.label || ('Dataset ' + (dsIdx + 1));
      const self    = this;

      ds.data.forEach((v, i) => {
        const cx  = xScale(i);
        const cy  = yScale(Number(v));
        const lbl = labels[i] !== undefined ? String(labels[i]) : String(i);

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', color);
        circle.setAttribute('class', 'nc-dot');
        circle.setAttribute('aria-label', lbl + ': ' + v);
        circle.setAttribute('tabindex', '0');
        circle.setAttribute('role', 'img');

        if (this.options.tooltip) {
          const content = { label: lbl, value: v, dataset: dsLabel };

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
 * Builds SVG cubic bezier path command segments for a series of points.
 *
 * Uses tension = 1/3: each control point is offset by one-third of the
 * horizontal distance between consecutive points, keeping the curve smooth
 * without overshooting.
 *
 * @param {Array<[number, number]>} pts - Array of [x, y] coordinate pairs.
 * @returns {string} Path commands string (space-prefixed, starts with ` C …`).
 */
function _cubicBezierSegments(pts) {
  var d = '';
  for (var i = 0; i < pts.length - 1; i++) {
    var x0 = pts[i][0],     y0 = pts[i][1];
    var x1 = pts[i + 1][0], y1 = pts[i + 1][1];
    var dx    = (x1 - x0) / 3;
    var cp1x  = x0 + dx;
    var cp2x  = x1 - dx;
    d += ' C ' + cp1x + ',' + y0 + ' ' + cp2x + ',' + y1 + ' ' + x1 + ',' + y1;
  }
  return d;
}

/**
 * Returns a CSS `rgba()` string for the given color at the specified opacity.
 *
 * Parses 6-digit and 3-digit hex colors; falls back to returning the original
 * color string unchanged if the format is not recognised.
 *
 * @param {string} color  - CSS color (preferably `#rrggbb` or `#rgb`).
 * @param {number} alpha  - Opacity, 0–1.
 * @returns {string}
 */
function _colorWithAlpha(color, alpha) {
  // 6-digit hex: #rrggbb
  var m = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (m) {
    var r6 = parseInt(m[1].slice(0, 2), 16);
    var g6 = parseInt(m[1].slice(2, 4), 16);
    var b6 = parseInt(m[1].slice(4, 6), 16);
    return 'rgba(' + r6 + ',' + g6 + ',' + b6 + ',' + alpha + ')';
  }
  // 3-digit hex: #rgb
  m = /^#([0-9a-fA-F]{3})$/.exec(color);
  if (m) {
    var r3 = parseInt(m[1][0] + m[1][0], 16);
    var g3 = parseInt(m[1][1] + m[1][1], 16);
    var b3 = parseInt(m[1][2] + m[1][2], 16);
    return 'rgba(' + r3 + ',' + g3 + ',' + b3 + ',' + alpha + ')';
  }
  // Unknown format — return as-is (no alpha applied)
  return color;
}

/* ESM export — used by neiki-charts.js when loaded as modules in the browser. */
export { LineChart };
