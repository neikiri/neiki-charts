/**
 * Neiki's Charts — PieChart renderer
 * neiki-charts 1.0.0 | MIT
 *
 * Renders pie and donut charts using SVG arc <path> segments.
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
   PieChart
   ============================================================================= */

/**
 * Renders a pie (or donut) chart into an SVG element.
 *
 * Each slice is a `<path>` element drawn with SVG arc commands, centred in the
 * SVG viewport. When `options.innerRadius > 0` the outer radius is reduced by
 * that amount to produce a donut hole.
 *
 * Inherits from `NChart` — prototype chain is wired in `neiki-charts.js`
 * after `NChart` is declared.
 *
 * @extends NChart
 */
class PieChart {
  /**
   * @param {object}  options                      - Merged chart options from `NChartElement`.
   * @param {number}  [options.innerRadius=0]       - Inner radius for donut mode (0 = solid pie).
   * @param {boolean} [options.tooltip=false]       - Enable hover / touch tooltips.
   * @param {boolean} [options.animated=false]      - Add animation CSS class to slice elements.
   * @param {string[]} [options.colors=[]]          - Custom color palette.
   */
  constructor(options) {
    this.options = options || {};
  }

  /**
   * Entry point — renders the full pie/donut chart into `svg`.
   *
   * @param {SVGSVGElement} svg  - Target SVG element (inside Shadow DOM).
   * @param {number}        w   - Available width in pixels.
   * @param {number}        h   - Available height in pixels.
   * @param {{ labels: string[], datasets: Array<{label: string, data: number[], color?: string, _hidden: boolean}> }} data
   */
  render(svg, w, h, data) {
    const labels   = data.labels   || [];
    const datasets = data.datasets || [];

    // Pie/donut uses only the first visible dataset (multi-series pies are
    // uncommon and would require concentric rings — out of scope here).
    const ds = datasets.find((d) => !d._hidden);
    if (!ds || !ds.data || ds.data.length === 0) return;

    // ------------------------------------------------------------------
    // 6.2  Geometry — centre and radii
    // ------------------------------------------------------------------
    const cx = w / 2;
    const cy = h / 2;

    // Leave a small margin so labels / hover outlines are not clipped.
    const margin     = 8;
    const outerRadius = Math.max(1, Math.min(cx, cy) - margin);

    // ------------------------------------------------------------------
    // 6.3  Donut mode — subtract innerRadius from outer radius
    // ------------------------------------------------------------------
    const innerRadius = Math.max(0, Number(this.options.innerRadius) || 0);
    // Clamp inner radius so it never meets or exceeds the outer radius.
    const hole = Math.min(innerRadius, outerRadius - 4);

    const shadowRoot = svg.getRootNode();
    const self = this;

    // ------------------------------------------------------------------
    // Compute slice angles from data values
    // ------------------------------------------------------------------
    const values = ds.data.map((v) => Math.max(0, Number(v) || 0));
    const total  = values.reduce((s, v) => s + v, 0);

    if (total <= 0) return; // nothing to draw

    // Start at top (-90°) so the first slice begins at 12 o'clock.
    let startAngle = -Math.PI / 2;

    values.forEach((value, i) => {
      if (value === 0) return;

      const sliceAngle = (value / total) * 2 * Math.PI;
      const endAngle   = startAngle + sliceAngle;

      const lbl   = labels[i] !== undefined ? String(labels[i]) : String(i + 1);
      const color = self.colorAt(i);

      // ------------------------------------------------------------------
      // 6.2  Compute arc <path> segment
      // ------------------------------------------------------------------
      const pathD = _describeSlice(cx, cy, outerRadius, hole, startAngle, endAngle);

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d',    pathD);
      path.setAttribute('fill', color);

      // ------------------------------------------------------------------
      // 6.4  ARIA label and animation class
      // ------------------------------------------------------------------
      const pct = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '';
      path.setAttribute('aria-label', lbl + ': ' + value + ' (' + pct + ')');
      path.setAttribute('tabindex', '0');
      path.setAttribute('role',   'img');

      let sliceClass = 'nc-pie-slice';
      if (self.options.animated) sliceClass += ' nc-pie-slice--animated';
      path.setAttribute('class', sliceClass);

      // ------------------------------------------------------------------
      // 6.4  Tooltip listeners (hover, touch, keyboard focus)
      // ------------------------------------------------------------------
      if (self.options.tooltip) {
        const content = { label: lbl, value: value + ' (' + pct + ')', dataset: ds.label || '' };
        _attachTooltipListeners(path, content, shadowRoot, self);
      }

      svg.appendChild(path);

      startAngle = endAngle;
    });
  }
}

/* =============================================================================
   Module-private helpers
   ============================================================================= */

/**
 * Builds the SVG `d` attribute string for a single pie/donut slice.
 *
 * For a solid pie (`innerR === 0`) the path is:
 *   M cx,cy  L outerStart  A outerRadius … outerEnd  Z
 *
 * For a donut (`innerR > 0`) the path is a closed annular sector:
 *   M outerStart  A outerRadius … outerEnd
 *   L innerEnd    A innerRadius … (reversed) innerStart  Z
 *
 * @param {number} cx          - Centre x coordinate.
 * @param {number} cy          - Centre y coordinate.
 * @param {number} outerR      - Outer radius.
 * @param {number} innerR      - Inner (hole) radius; 0 for a solid pie.
 * @param {number} startAngle  - Slice start angle in radians.
 * @param {number} endAngle    - Slice end angle in radians.
 * @returns {string} SVG path `d` attribute value.
 */
function _describeSlice(cx, cy, outerR, innerR, startAngle, endAngle) {
  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);

  // SVG large-arc-flag: 1 if the arc spans more than 180°.
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  if (innerR <= 0) {
    // Solid pie slice: move to centre, line to arc start, arc to arc end, close.
    return [
      'M', cx, cy,
      'L', x1, y1,
      'A', outerR, outerR, 0, largeArc, 1, x2, y2,
      'Z'
    ].join(' ');
  }

  // Donut slice: outer arc + inner arc (reversed) + close.
  const ix1 = cx + innerR * Math.cos(endAngle);
  const iy1 = cy + innerR * Math.sin(endAngle);
  const ix2 = cx + innerR * Math.cos(startAngle);
  const iy2 = cy + innerR * Math.sin(startAngle);

  return [
    'M', x1, y1,
    'A', outerR, outerR, 0, largeArc, 1, x2, y2,  // outer arc clockwise
    'L', ix1, iy1,
    'A', innerR, innerR, 0, largeArc, 0, ix2, iy2, // inner arc counter-clockwise
    'Z'
  ].join(' ');
}

/**
 * Attaches tooltip and keyboard event listeners to a slice `<path>` element.
 *
 * Handles: `mouseover`, `mousemove`, `mouseout`, `touchstart`, `touchend`,
 * `focus`, and `blur` events.
 *
 * @param {SVGPathElement} path        - The slice element to attach listeners to.
 * @param {{label: string, value: string, dataset: string}} content - Tooltip content.
 * @param {ShadowRoot|Document} shadowRoot - Root node for tooltip lookup.
 * @param {PieChart} chart             - Chart instance (for `drawTooltip` access).
 */
function _attachTooltipListeners(path, content, shadowRoot, chart) {
  path.addEventListener('mouseover', function (e) {
    chart.drawTooltip(shadowRoot, e.clientX, e.clientY, content);
  });
  path.addEventListener('mousemove', function (e) {
    chart.drawTooltip(shadowRoot, e.clientX, e.clientY, content);
  });
  path.addEventListener('mouseout', function () {
    chart.drawTooltip(shadowRoot, 0, 0, null);
  });
  path.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    chart.drawTooltip(shadowRoot, t.clientX, t.clientY, content);
  }, { passive: true });
  path.addEventListener('touchend', function () {
    chart.drawTooltip(shadowRoot, 0, 0, null);
  });
  path.addEventListener('focus', function () {
    var r = path.getBoundingClientRect();
    chart.drawTooltip(shadowRoot, r.left + r.width / 2, r.top + r.height / 2, content);
  });
  path.addEventListener('blur', function () {
    chart.drawTooltip(shadowRoot, 0, 0, null);
  });
}

/* ESM export — used by neiki-charts.js when loaded as modules in the browser. */
export { PieChart };
