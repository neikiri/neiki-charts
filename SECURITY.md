# Security Policy

## 🛡️ Supported Versions

The following versions of Neiki's Charts are currently supported with security updates:

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅ Yes     |

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public issue**.

Instead, report it responsibly:

* 🔒 Open a **[private GitHub Security Advisory](https://github.com/neikiri/neiki-charts/security/advisories/new)** in the `neikiri/neiki-charts` repository
* 📧 Email: **[neikiri@neikiri.dev](mailto:neikiri@neikiri.dev)** (if GitHub advisories are not suitable)

---

## 📋 What to include

Please provide as much detail as possible:

* Description of the vulnerability
* Steps to reproduce
* Browser and version used
* Potential impact

---

## ⏱️ Response Time

* Initial acknowledgement: **within 48 hours**
* Triage: **within 7 days**
* Fix target: **within 90 days** (may vary by severity)

---

## ⚠️ Scope

Neiki's Charts is a **client-side Web Component** (`neiki-chart`) delivered as a single script. It runs entirely in the browser with no backend.

**In-scope** files and topics:

* **`dist/neiki-charts.min.js`** and **`dist/neiki-charts.min.css`** — the CDN-ready bundle
* **`neiki-chart` Web Component** — any vulnerability in the element itself
* **XSS via chart data** — malicious strings passed through `labels`, `dataset.label`, or `colors` that result in script execution
* **Shadow DOM bypass** — techniques that break style encapsulation or allow untrusted content to escape the shadow root in an unintended way
* **CDN supply-chain tampering** — serving a malicious bundle from the CDN endpoint
* **Build pipeline (`minify.py`)** — issues that could cause the build to silently embed malicious code in the output bundle

**Out of scope:**

* Issues in browsers themselves or the Web Components standard
* Self-hosted deployment configuration (web server, HTTPS, CSP headers — these are the caller's responsibility)

---

## 🔐 CDN Integrity (Subresource Integrity)

When loading Neiki's Charts from a CDN, we recommend using [Subresource Integrity (SRI)](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) to verify the file has not been tampered with. Official releases publish SHA-384 hashes in the release notes.

```html
<script src="https://cdn.jsdelivr.net/gh/neikiri/neiki-charts/dist/neiki-charts.min.js"
        integrity="sha384-<hash>"
        crossorigin="anonymous"></script>
```

Replace `<hash>` with the SHA-384 value published for the specific release. Using SRI prevents execution of a compromised or substituted file.

---

## 🖊️ XSS Notes

The `neiki-chart` component inserts SVG elements whose text content derives from `labels` and `dataset.label` strings. These values are set as SVG **`aria-label` attribute text** — not via `innerHTML` — so they are HTML-attribute-safe and do not allow direct HTML injection.

However:

* **Callers should sanitize untrusted input** before passing it to `setData()`. The component does not perform sanitization on behalf of the caller.
* The `colors` attribute and the `color` field on datasets accept CSS color strings. Malformed or unrecognised values are **silently ignored**; they do not cause errors or produce output.

---

## 🧱 Shadow DOM Boundary

Styles are encapsulated inside a Shadow DOM, which prevents external CSS from leaking in. However, Shadow DOM is **not a JavaScript security boundary**: any JS code running in the same page context can access the shadow root via `element.shadowRoot`. This is intentional — the component uses **open shadow mode** by design.

If you need to restrict access to the component's internals, apply a strong Content Security Policy at the page level.

---

## 🙏 Responsible Disclosure

We appreciate responsible disclosure and will credit reporters in the release notes where appropriate.
