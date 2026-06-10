/**
 * Neiki's Charts — Core & Web Component
 * neiki-charts 1.0.0 | MIT
 *
 * NChart base class + NChartElement Web Component.
 * Chart renderers (LineChart, BarChart, PieChart, ScatterChart) are defined in
 * their own files and concatenated BEFORE this file by minify.py.
 */

/* =============================================================================
   ESM imports — resolved by the browser when loaded directly (dev / demo).
   When bundled by minify.py the chart files are concatenated before this file,
   so these imports become harmless no-ops inside the bundle.
   ============================================================================= */

import { LineChart }    from './charts/line.js';
import { BarChart }     from './charts/bar.js';
import { PieChart }     from './charts/pie.js';
import { ScatterChart } from './charts/scatter.js';

/* =============================================================================
   CSS Injection — replaced by minify.py with the actual minified CSS string.
   In dev/ESM mode the marker block is not replaced, so _NCSS stays empty and
   we fetch the CSS file at runtime using import.meta.url.
   ============================================================================= */

// ====================================
// NEIKI-CHARTS / CSS-INJECT
// ====================================
let _NCSS = '';
// ====================================
// END CSS-INJECT
// ====================================

// Dev-mode: fetch CSS relative to this module so shadow DOMs get their styles.
// In the bundle minify.py replaces the marker block with a non-empty CSS string
// so _NCSS is always truthy there and this if-block is eliminated by terser.
if (!_NCSS) {
  try {
    const _cssUrl = new URL('./neiki-charts.css', import.meta.url).href;
    const _resp = await fetch(_cssUrl);
    if (_resp.ok) _NCSS = await _resp.text();
  } catch (_e) { /* ignore */ }
}

/* =============================================================================
   Default color palette (10 accessible colors)
   ============================================================================= */

const DEFAULT_PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
];

/** SVG namespace constant */
const SVG_NS = 'http://www.w3.org/2000/svg';

/* =============================================================================
   NChart — base class
   ============================================================================= */

/**
 * Base class for all Neiki's Charts renderers.
 * Subclasses must override `render(svg, width, height, data)`.
 */
class NChart {
  /**
   * @param {object} options - Chart options merged from defaults + user config.
   */
  constructor(options) {
    this.options = options || {};
  }

  /**
   * Abstract render method — override in subclasses.
   * @param {SVGSVGElement} svg - The SVG element to draw into.
   * @param {number} width - Available width in pixels.
   * @param {number} height - Available height in pixels.
   * @param {object} data - Chart data `{ labels, datasets }`.
   */
  render(svg, width, height, data) { // eslint-disable-line no-unused-vars
    // Abstract — implemented by subclasses
  }

  /**
   * Draws a grid (dashed lines + axis labels) into an SVG element.
   *
   * @param {SVGSVGElement} svg       - Target SVG element.
   * @param {Array<{value: *, x: number}>} xTicks - X-axis tick descriptors.
   * @param {Array<{value: *, y: number}>} yTicks - Y-axis tick descriptors.
   * @param {number} w               - SVG width.
   * @param {number} h               - SVG height.
   * @param {{top: number, right: number, bottom: number, left: number}} padding
   */
  drawGrid(svg, xTicks, yTicks, w, h, padding) {
    if (!this.options.grid) return;

    const pad = padding || { top: 20, right: 20, bottom: 40, left: 50 };

    // Horizontal lines for each y-tick
    if (yTicks && yTicks.length) {
      yTicks.forEach((tick) => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', 'nc-grid-line');
        line.setAttribute('x1', pad.left);
        line.setAttribute('y1', tick.y);
        line.setAttribute('x2', w - pad.right);
        line.setAttribute('y2', tick.y);
        svg.appendChild(line);

        // Y-axis label
        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('class', 'nc-axis-label');
        label.setAttribute('x', pad.left - 6);
        label.setAttribute('y', tick.y);
        label.setAttribute('text-anchor', 'end');
        label.textContent = tick.value;
        svg.appendChild(label);
      });
    }

    // Vertical lines for each x-tick
    if (xTicks && xTicks.length) {
      xTicks.forEach((tick) => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', 'nc-grid-line');
        line.setAttribute('x1', tick.x);
        line.setAttribute('y1', pad.top);
        line.setAttribute('x2', tick.x);
        line.setAttribute('y2', h - pad.bottom);
        svg.appendChild(line);

        // X-axis label
        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('class', 'nc-axis-label');
        label.setAttribute('x', tick.x);
        label.setAttribute('y', h - pad.bottom + 16);
        label.setAttribute('text-anchor', 'middle');
        label.textContent = tick.value;
        svg.appendChild(label);
      });
    }
  }

  /**
   * Creates or updates a floating tooltip positioned near `(x, y)`.
   * The tooltip is clamped to the viewport so it never overflows.
   *
   * @param {HTMLElement|ShadowRoot} container - Shadow root container to attach the tooltip to.
   * @param {number} x       - Client X coordinate.
   * @param {number} y       - Client Y coordinate.
   * @param {{label: string, value: string|number, dataset?: string}|null} content
   *   Pass `null` to hide the tooltip.
   */
  drawTooltip(container, x, y, content) {
    // Resolve the real DOM node (ShadowRoot has no querySelector on older paths)
    let host = container;
    if (!host) return;

    // Find or create the tooltip element
    let tip = (host.querySelector ? host.querySelector('.nc-tooltip') : null);
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'nc-tooltip';
      // Append into the shadow root (or fallback container)
      if (typeof host.appendChild === 'function') {
        host.appendChild(tip);
      }
    }

    if (!content) {
      tip.classList.remove('nc-tooltip--visible');
      return;
    }

    // Build inner HTML
    let html = '';
    if (content.dataset) {
      html += `<div class="nc-tooltip__label">${_escapeHtml(content.dataset)}</div>`;
    }
    if (content.label !== undefined) {
      html += `<div class="nc-tooltip__label">${_escapeHtml(String(content.label))}</div>`;
    }
    if (content.value !== undefined) {
      html += `<div class="nc-tooltip__value">${_escapeHtml(String(content.value))}</div>`;
    }
    tip.innerHTML = html;

    // Position: initial offset, then clamp to viewport
    const vw = window.innerWidth || document.documentElement.clientWidth || 800;
    const vh = window.innerHeight || document.documentElement.clientHeight || 600;

    // Temporarily show off-screen to measure
    tip.style.left = '-9999px';
    tip.style.top = '-9999px';
    tip.classList.add('nc-tooltip--visible');

    const tw = tip.offsetWidth || 120;
    const th = tip.offsetHeight || 40;

    let left = x + 12;
    let top  = y - 28;

    // Clamp horizontally
    if (left + tw > vw) left = vw - tw - 4;
    if (left < 0) left = 4;

    // Clamp vertically
    if (top + th > vh) top = vh - th - 4;
    if (top < 0) top = 4;

    tip.style.left = left + 'px';
    tip.style.top  = top + 'px';
  }

  /**
   * Renders a legend `<ul>` with toggle buttons for each dataset.
   * Each button has `role="checkbox"`, `aria-checked`, a color swatch,
   * and keyboard support (Enter/Space toggles).
   *
   * @param {HTMLElement|ShadowRoot} container  - Where to append the legend element.
   * @param {Array<{label: string, color?: string}>} datasets - Dataset descriptors.
   * @param {function(index: number, visible: boolean): void} onToggle
   *   Called when a dataset's visibility is toggled.
   * @returns {HTMLUListElement} The created legend element.
   */
  drawLegend(container, datasets, onToggle) {
    // Remove any existing legend
    if (container.querySelector) {
      const old = container.querySelector('.nc-legend');
      if (old) old.remove();
    }

    const ul = document.createElement('ul');
    ul.className = 'nc-legend';
    ul.setAttribute('role', 'list');

    datasets.forEach((ds, i) => {
      const li = document.createElement('li');
      const color = ds.color || this.colorAt(i);

      const btn = document.createElement('button');
      btn.className = 'nc-legend__item';
      btn.setAttribute('role', 'checkbox');
      // Reflect the dataset's actual visibility. The legend is rebuilt on every
      // re-render, so hardcoding "true" here would desync the button state from
      // the chart: a hidden series would show as checked, and clicking it again
      // would re-hide it — making the series impossible to bring back.
      btn.setAttribute('aria-checked', ds._hidden ? 'false' : 'true');
      btn.setAttribute('type', 'button');

      const swatch = document.createElement('span');
      swatch.className = 'nc-legend__swatch';
      swatch.style.backgroundColor = color;
      swatch.setAttribute('aria-hidden', 'true');

      const labelSpan = document.createElement('span');
      labelSpan.textContent = ds.label || `Dataset ${i + 1}`;

      btn.appendChild(swatch);
      btn.appendChild(labelSpan);

      // Toggle handler
      const toggle = () => {
        const checked = btn.getAttribute('aria-checked') === 'true';
        const next = !checked;
        btn.setAttribute('aria-checked', String(next));
        if (typeof onToggle === 'function') onToggle(i, next);
      };

      btn.addEventListener('click', toggle);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });

      li.appendChild(btn);
      ul.appendChild(li);
    });

    if (typeof container.appendChild === 'function') {
      container.appendChild(ul);
    }

    return ul;
  }

  /**
   * Returns a CSS color string for a given dataset index.
   * Cycles through the 10-color built-in palette, or uses `options.colors[index]`
   * if provided and valid. Invalid entries fall back to the palette.
   *
   * @param {number} index - Zero-based dataset index.
   * @returns {string} A valid CSS color string.
   */
  colorAt(index) {
    const custom = this.options.colors;
    if (Array.isArray(custom) && custom.length > 0) {
      const entry = custom[index % custom.length];
      if (entry && _isValidColor(entry)) return entry;
    }
    return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
  }
}

/* =============================================================================
   Utility helpers (module-private)
   ============================================================================= */

/**
 * Escapes HTML special characters for safe innerHTML insertion.
 * @param {string} str
 * @returns {string}
 */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Crude but fast CSS color validity check.
 * Tries to set a color on a temporary element and read it back.
 * @param {string} color
 * @returns {boolean}
 */
function _isValidColor(color) {
  if (typeof color !== 'string' || !color.trim()) return false;
  try {
    const tmp = document.createElement('div');
    tmp.style.color = color;
    return tmp.style.color !== '';
  } catch (_) {
    return false;
  }
}

/* =============================================================================
   NChartElement — Web Component
   ============================================================================= */

/**
 * `<neiki-chart>` — native Web Component wrapping all chart renderers.
 *
 * @element neiki-chart
 * @attr {string} type       - Chart type: `line` | `bar` | `pie` | `scatter`. Default `line`.
 * @attr {string} theme      - Color theme: `light` | `dark` | `auto`. Default `auto`.
 * @attr {boolean} legend    - Show legend. Default `true`.
 * @attr {boolean} tooltip   - Enable tooltips. Default `true`.
 * @attr {boolean} animated  - Enable entrance animations. Default `true`.
 * @attr {boolean} grid      - Show grid lines. Default `true`.
 * @attr {string}  colors    - JSON array of custom color strings.
 * @attr {number}  width     - Explicit width in px (overrides container width).
 * @attr {number}  height    - Explicit height in px (overrides container height).
 */
class NChartElement extends HTMLElement {
  // ------------------------------------------------------------------
  // Observed attributes
  // ------------------------------------------------------------------

  /** @returns {string[]} */
  static get observedAttributes() {
    return ['type', 'theme', 'legend', 'tooltip', 'animated', 'grid', 'colors', 'width', 'height'];
  }

  // ------------------------------------------------------------------
  // Constructor
  // ------------------------------------------------------------------

  constructor() {
    super();

    /** @type {ShadowRoot} */
    this._shadow = this.attachShadow({ mode: 'open' });

    /** @type {HTMLStyleElement} */
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = _NCSS;
    this._shadow.appendChild(this._styleEl);

    /** @type {HTMLDivElement} Outer container (flex column) */
    this._container = document.createElement('div');
    this._container.className = 'nc-container';
    this._shadow.appendChild(this._container);

    /** @type {HTMLDivElement} Inner area that holds only the SVG — measured for dimensions */
    this._svgWrap = document.createElement('div');
    this._svgWrap.className = 'nc-svg-wrap';
    this._container.appendChild(this._svgWrap);

    /** @type {HTMLDivElement} Area below the SVG that holds the legend */
    this._legendWrap = document.createElement('div');
    this._legendWrap.className = 'nc-legend-wrap';
    this._container.appendChild(this._legendWrap);

    /** @type {object} Internal options with defaults */
    this._options = {
      type:         'line',
      width:        null,
      height:       null,
      theme:        'auto',
      legend:       true,
      tooltip:      true,
      animated:     true,
      grid:         true,
      colors:       [],
      smooth:       false,
      area:         false,
      orientation:  'vertical',
      innerRadius:  0
    };

    /** @type {object|null} Chart data `{ labels, datasets }` */
    this._data = null;

    /** @type {ResizeObserver|null} */
    this._resizeObserver = null;

    /** @type {number|null} Debounce timer ID */
    this._resizeTimer = null;

    /** @type {MediaQueryList|null} */
    this._darkMQ = null;

    /** @type {Function|null} Bound dark-mode change listener */
    this._darkListener = null;

    /** @type {boolean} Whether hidden datasets are tracked */
    this._hiddenSets = new Set();

    /**
     * @type {boolean}
     * Whether the next render should play entrance animations. Only the initial
     * render and data changes (`setData`) set this to `true`. Re-renders caused by
     * attribute/option toggles, legend clicks, or resizes leave it `false`, so
     * clicking through buttons never restarts (and thus blanks) the chart while an
     * entrance animation is mid-flight.
     */
    this._animateNext = true;

    /** @type {number} Last rendered width (px) — used to skip redundant resize renders. */
    this._lastRenderW = -1;

    /** @type {number} Last rendered height (px) — used to skip redundant resize renders. */
    this._lastRenderH = -1;
  }

  // ------------------------------------------------------------------
  // Lifecycle — connectedCallback
  // ------------------------------------------------------------------

  connectedCallback() {
    // --- Theme auto-detection (3.5) ---
    this._setupTheme();

    // --- Attach ResizeObserver — watch only the SVG area, not the full element ---
    // Observing `this` would create a resize loop because appending the legend
    // increases the element height, which triggers another render, ad infinitum.
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => {
          // Skip renders when the measured size hasn't actually changed. This
          // avoids needless redraws (and avoids cutting the initial entrance
          // animation short when the observer fires right after the first render).
          const rect = this._svgWrap.getBoundingClientRect();
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          if (w === this._lastRenderW && h === this._lastRenderH) return;
          this._render();
        }, 100);
      });
      this._resizeObserver.observe(this._svgWrap);
    } else {
      // Fallback: single render
      this._render();
    }
  }

  // ------------------------------------------------------------------
  // Lifecycle — disconnectedCallback
  // ------------------------------------------------------------------

  disconnectedCallback() {
    // Disconnect ResizeObserver
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    clearTimeout(this._resizeTimer);

    // Remove dark-mode listener
    if (this._darkMQ && this._darkListener) {
      this._darkMQ.removeEventListener('change', this._darkListener);
      this._darkListener = null;
    }
  }

  // ------------------------------------------------------------------
  // Lifecycle — attributeChangedCallback
  // ------------------------------------------------------------------

  /**
   * Maps observed attribute changes to internal `_options` and triggers re-render.
   *
   * @param {string} name    - Attribute name.
   * @param {string} oldVal  - Previous value.
   * @param {string} newVal  - New value.
   */
  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;

    switch (name) {
      case 'type':
        this._options.type = newVal || 'line';
        break;

      case 'theme':
        this._options.theme = newVal || 'auto';
        if (newVal !== 'auto') {
          // Tear down auto listener when theme is set explicitly
          if (this._darkMQ && this._darkListener) {
            this._darkMQ.removeEventListener('change', this._darkListener);
            this._darkListener = null;
          }
        }
        break;

      case 'legend':
        this._options.legend = newVal !== 'false' && newVal !== null;
        break;

      case 'tooltip':
        this._options.tooltip = newVal !== 'false' && newVal !== null;
        break;

      case 'animated':
        this._options.animated = newVal !== 'false' && newVal !== null;
        break;

      case 'grid':
        this._options.grid = newVal !== 'false' && newVal !== null;
        break;

      case 'colors':
        try {
          this._options.colors = newVal ? JSON.parse(newVal) : [];
        } catch (_) {
          this._options.colors = [];
        }
        break;

      case 'width':
        this._options.width = newVal ? Number(newVal) : null;
        break;

      case 'height':
        this._options.height = newVal ? Number(newVal) : null;
        break;

      default:
        break;
    }

    this._render();
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Sets the chart data and triggers a re-render.
   * If `data` has no datasets or empty datasets, renders an empty state.
   *
   * @param {{ labels: string[], datasets: Array<{label: string, data: Array, color?: string}> }} data
   */
  setData(data) {
    this._data = data || null;
    this._hiddenSets.clear();
    // A data change is a fresh start — let the entrance animation play.
    this._animateNext = true;
    this._render();
  }

  /**
   * Merges `opts` into internal options and triggers a re-render.
   *
   * @param {object} opts - Partial options object.
   */
  setOptions(opts) {
    if (!opts || typeof opts !== 'object') return;
    Object.assign(this._options, opts);
    this._render();
  }

  // ------------------------------------------------------------------
  // Private — theme setup
  // ------------------------------------------------------------------

  /**
   * Sets up automatic dark/light theme detection via `prefers-color-scheme`.
   * Called from `connectedCallback`.
   * @private
   */
  _setupTheme() {
    const theme = this.getAttribute('theme') || this._options.theme;
    if (theme !== 'auto') return;

    if (!window.matchMedia) return;

    this._darkMQ = window.matchMedia('(prefers-color-scheme: dark)');

    // Apply immediately
    this._applyAutoTheme(this._darkMQ.matches);

    // Listen for changes
    this._darkListener = (e) => {
      this._applyAutoTheme(e.matches);
    };
    this._darkMQ.addEventListener('change', this._darkListener);
  }

  /**
   * Applies `theme="dark"` or `theme="light"` attribute based on OS preference.
   * @param {boolean} isDark
   * @private
   */
  _applyAutoTheme(isDark) {
    // Set the attribute so `:host([theme="dark"])` CSS works
    this.setAttribute('theme', isDark ? 'dark' : 'light');
    // Keep internal option in sync but remember user set it to 'auto'
    this._options.theme = isDark ? 'dark' : 'light';
  }

  // ------------------------------------------------------------------
  // Private — render dispatcher
  // ------------------------------------------------------------------

  /**
   * Resolves dimensions, picks the appropriate renderer, creates the SVG,
   * calls `renderer.render()`, and optionally appends a legend.
   * @private
   */
  _render() {
    // --- Determine effective width / height from the SVG wrapper only ---
    // We measure _svgWrap (not `this`) to avoid a resize-observer feedback loop
    // that would occur if the legend enlarged the element on every render.
    let w = this._options.width;
    let h = this._options.height;

    if (!w || !h) {
      const rect = this._svgWrap.getBoundingClientRect();
      w = w || (rect.width  > 0 ? rect.width  : 300);
      h = h || (rect.height > 0 ? rect.height : 200);
    }

    w = Math.max(w, 1);
    h = Math.max(h, 1);

    // Remember the size we render at so the ResizeObserver can skip no-op redraws.
    this._lastRenderW = Math.round(w);
    this._lastRenderH = Math.round(h);

    // --- Clear SVG area ---
    while (this._svgWrap.firstChild) {
      this._svgWrap.removeChild(this._svgWrap.firstChild);
    }

    // --- Clear legend area ---
    while (this._legendWrap.firstChild) {
      this._legendWrap.removeChild(this._legendWrap.firstChild);
    }

    // --- No-data state ---
    const hasData = this._data &&
      Array.isArray(this._data.datasets) &&
      this._data.datasets.length > 0;

    if (!hasData) {
      const svg = this._makeSvg(w, h);
      svg.setAttribute('aria-label', 'No data');
      const txt = document.createElementNS(SVG_NS, 'text');
      txt.setAttribute('x', w / 2);
      txt.setAttribute('y', h / 2);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'middle');
      txt.setAttribute('class', 'nc-axis-label');
      txt.textContent = 'No data';
      svg.appendChild(txt);
      this._svgWrap.appendChild(svg);
      return;
    }

    // --- Pick renderer ---
    const rendererMap = {
      line:    LineChart,
      bar:     BarChart,
      pie:     PieChart,
      scatter: ScatterChart
    };

    const type = this._options.type || 'line';
    const RendererClass = rendererMap[type];

    if (!RendererClass) {
      console.warn('neiki-charts: unknown type:', type);
      return;
    }

    const renderer = new RendererClass(this._options);

    // --- Build visible datasets (apply hidden-set filter) ---
    const visibleData = {
      labels: this._data.labels || [],
      datasets: this._data.datasets.map((ds, i) => {
        return Object.assign({}, ds, { _hidden: this._hiddenSets.has(i) });
      })
    };

    // --- Create and populate the SVG ---
    const svg = this._makeSvg(w, h);

    // ARIA on root SVG
    const datasetLabels = visibleData.datasets.map((d) => d.label || '').filter(Boolean);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label',
      `${type} chart${datasetLabels.length ? ': ' + datasetLabels.join(', ') : ''}`
    );

    // Animated wrapper class — only on the initial render and on data changes.
    // Re-renders from attribute/option toggles, legend clicks, or resizes keep
    // the chart fully drawn instead of restarting the entrance animation, which
    // would otherwise blank the chart out while buttons are being clicked.
    if (this._options.animated && this._animateNext) {
      svg.classList.add('nc-animated');
    }
    // Entrance animation has now been applied (or skipped) for this draw; any
    // subsequent re-render must not replay it unless new data arrives.
    this._animateNext = false;

    // Call the renderer
    renderer.render(svg, w, h, visibleData);

    // Append SVG into the dedicated SVG wrapper
    this._svgWrap.appendChild(svg);

    // --- Legend — goes into the separate legend wrapper, never into svgWrap ---
    if (this._options.legend && visibleData.datasets.length > 0) {
      const self = this;
      renderer.drawLegend(this._legendWrap, visibleData.datasets, (index, visible) => {
        if (visible) {
          self._hiddenSets.delete(index);
        } else {
          self._hiddenSets.add(index);
        }
        self._render();
      });
    }

    // --- Tooltip container (ensure it exists in shadow root) ---
    if (this._options.tooltip) {
      if (!this._shadow.querySelector('.nc-tooltip')) {
        const tip = document.createElement('div');
        tip.className = 'nc-tooltip';
        this._shadow.appendChild(tip);
      }
    }
  }

  /**
   * Creates a blank SVG element with correct namespace and dimensions.
   * @param {number} w
   * @param {number} h
   * @returns {SVGSVGElement}
   * @private
   */
  _makeSvg(w, h) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('width',   w);
    svg.setAttribute('height',  h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    return svg;
  }
}

/* =============================================================================
   Prototype wiring
   Wire chart renderers (defined in earlier concatenated files) to NChart
   after NChart is declared, so they properly inherit base-class methods.
   ============================================================================= */

[
  LineChart,
  BarChart,
  PieChart,
  ScatterChart
].forEach(function (C) {
  if (C) Object.setPrototypeOf(C.prototype, NChart.prototype);
});

/* =============================================================================
   Registration & Export
   ============================================================================= */

customElements.define('neiki-chart', NChartElement);

export default NChartElement;
