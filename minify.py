import requests
import subprocess
import os
import re

# =========================
# CONFIG
# =========================
SRC_DIR    = "src"
OUTPUT_DIR = "dist"

CSS_INPUT = os.path.join(SRC_DIR, "neiki-charts.css")

# JS files concatenated in the required order
JS_FILES = [
    os.path.join(SRC_DIR, "charts", "line.js"),
    os.path.join(SRC_DIR, "charts", "bar.js"),
    os.path.join(SRC_DIR, "charts", "pie.js"),
    os.path.join(SRC_DIR, "charts", "scatter.js"),
    os.path.join(SRC_DIR, "neiki-charts.js"),
]

CSS_OUTPUT = os.path.join(OUTPUT_DIR, "neiki-charts.min.css")
JS_OUTPUT  = os.path.join(OUTPUT_DIR, "neiki-charts.min.js")
JS_TEMP    = os.path.join(OUTPUT_DIR, "neiki-charts.temp.js")

BANNER = "/* neiki-charts 1.0.0 | MIT */\n"

# =========================
# TEMPLATE FOR INJECT
# =========================
# Replaces the CSS-INJECT marker block (including the `let _NCSS = ''` line and
# the dev-mode fetch block) with a direct assignment of the minified CSS string.
INJECT_TEMPLATE = "let _NCSS = `{css}`;"

# =========================
# 1️⃣ OUTPUT FOLDER
# =========================
os.makedirs(OUTPUT_DIR, exist_ok=True)

# =========================
# 2️⃣ LOAD CSS
# =========================
with open(CSS_INPUT, "r", encoding="utf-8") as f:
    css_content = f.read()

print("Minifying CSS...")

response = requests.post(
    "https://www.toptal.com/developers/cssminifier/api/raw",
    data={"input": css_content}
)

minified_css = response.text.strip()

# save minified CSS
with open(CSS_OUTPUT, "w", encoding="utf-8") as f:
    f.write(minified_css)

# escape for JS template string backticks and backslashes
minified_css_escaped = minified_css.replace("\\", "\\\\").replace("`", "\\`")

# =========================
# 3️⃣ LOAD AND CONCATENATE JS
# =========================
print("Concatenating JS files...")

js_parts = []
for js_file in JS_FILES:
    with open(js_file, "r", encoding="utf-8") as f:
        js_parts.append(f.read())

js_content = "\n".join(js_parts)

print("Looking for marker in JS...")

# =========================
# 4️⃣ FIND MARKER (NEIKI-CHARTS / CSS-INJECT)
# =========================
# Matches the full block between the two marker comments:
#   // ====================================
#   // NEIKI-CHARTS / CSS-INJECT
#   // ====================================
#   let _NCSS = '';
#   // ====================================
#   // END CSS-INJECT
#   // ====================================
pattern = r"([ \t]*//[ \t]*=+[ \t]*\r?\n[ \t]*//[ \t]*NEIKI-CHARTS[ \t]*/[ \t]*CSS-INJECT[ \t]*\r?\n[ \t]*//[ \t]*=+[ \t]*\r?\n.*?[ \t]*//[ \t]*=+[ \t]*\r?\n[ \t]*//[ \t]*END CSS-INJECT[ \t]*\r?\n[ \t]*//[ \t]*=+[ \t]*)"

match = re.search(pattern, js_content, flags=re.DOTALL)

if not match:
    raise Exception("❌ Marker NEIKI-CHARTS / CSS-INJECT not found!")

print("✔ Marker found, injecting CSS...")

# Replace the entire marker block with the CSS const assignment
injected_code = "\n" + INJECT_TEMPLATE.format(css=minified_css_escaped) + "\n"

js_modified = (
    js_content[:match.start()] +
    injected_code +
    js_content[match.end():]
)

# =========================
# 3.5️⃣ STRIP DUPLICATE SVG_NS CONST
# =========================
# The chart files declare `var SVG_NS` as a guard for bundle use.
# neiki-charts.js declares `const SVG_NS` at module level, which would
# cause a redeclaration error when concatenated. Replace it with a comment.
js_modified = re.sub(
    r'^\s*/\*\*\s*SVG namespace constant\s*\*/\s*\nconst SVG_NS\s*=\s*[\'"]http://www\.w3\.org/2000/svg[\'"];',
    '// SVG_NS already declared by chart file guards above',
    js_modified,
    flags=re.MULTILINE
)

# =========================
# 3.6️⃣ STRIP ESM IMPORT STATEMENTS
# =========================
# neiki-charts.js contains ESM imports for browser dev/demo use.
# In the bundle the chart files are already concatenated above, so
# these import lines must be removed to keep the output valid non-module JS.
js_modified = re.sub(
    r"^\s*import\s+\{[^}]+\}\s+from\s+'[^']+'\s*;\s*\n?",
    '',
    js_modified,
    flags=re.MULTILINE
)

# Strip ESM export statements from chart files and the main file.
# `export { LineChart };` and `export default NChartElement;` are dev-only.
js_modified = re.sub(
    r"^\s*export\s+\{[^}]+\}\s*;\s*\n?",
    '',
    js_modified,
    flags=re.MULTILINE
)
js_modified = re.sub(
    r"^\s*export\s+default\s+\w+\s*;\s*\n?",
    '',
    js_modified,
    flags=re.MULTILINE
)

# Strip the dev-mode CSS fetch block (uses import.meta.url + top-level await
# which are ESM-only and invalid in a concatenated non-module bundle).
# The block is: if (!_NCSS) { try { ... } catch (_e) { } }
js_modified = re.sub(
    r"// Dev-mode:.*?catch\s*\(_e\)\s*\{[^}]*\}\s*\}",
    '',
    js_modified,
    flags=re.DOTALL
)

# =========================
# 5️⃣ SAVE TEMP JS
# =========================
with open(JS_TEMP, "w", encoding="utf-8") as f:
    f.write(js_modified)

# =========================
# 6️⃣ MINIFY JS (TERSER)
# =========================
print("Minifying JS via terser...")

import shutil, sys

# Resolve npx: prefer the Windows absolute path when running locally on Windows,
# fall back to whatever npx is on PATH (Linux CI, macOS).
_npx = r"C:\Program Files\nodejs\npx.cmd" if sys.platform == "win32" else shutil.which("npx") or "npx"

subprocess.run([
    _npx,
    "terser",
    JS_TEMP,
    "-o", JS_OUTPUT,
    "--compress",
    "--mangle"
], check=True)

# =========================
# 7️⃣ CLEANUP TEMP
# =========================
os.remove(JS_TEMP)

# =========================
# 8️⃣ PREPEND VERSION BANNER
# =========================
print("Adding version banner...")

with open(JS_OUTPUT, "r", encoding="utf-8") as f:
    minified_js = f.read()

with open(JS_OUTPUT, "w", encoding="utf-8") as f:
    f.write(BANNER + minified_js)

print("\n✅ DONE")
print(f"📦 CSS: {CSS_OUTPUT}")
print(f"📦 JS:  {JS_OUTPUT}")
