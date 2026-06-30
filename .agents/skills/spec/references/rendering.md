# Rendering & validating proveo diagrams

Install the renderer, apply the theme (hybrid: PlantUML remote, Mermaid/Vega vendored), then
validate and render. Commands are macOS-first (Homebrew) with Linux notes.

## PlantUML (`.puml`)

PlantUML has **no native renderer anywhere** (GitHub/IDEs won't draw it), so it must be rendered
explicitly — this is the format the toolchain exists for.

Install:

```bash
brew install plantuml                 # macOS (pulls graphviz + a JRE)
# Debian/Ubuntu: apt install plantuml graphviz default-jre
# or: download the jar and alias plantuml='java -jar /path/to/plantuml.jar'
```

Theme — remote include (auto-tracks the upstream palette; no local file):

```puml
!include https://raw.githubusercontent.com/proveo-ca/identity/main/proveo.puml
' dark canvas:
!include https://raw.githubusercontent.com/proveo-ca/identity/main/proveo-dark.puml
```

Validate (do this before committing any new/edited `.puml`):

```bash
plantuml -checkonly path/to/file.puml      # empty stdout + exit 0 = clean
```

Sweep a tree:

```bash
for f in _spec/**/*.puml; do
  out=$(plantuml -checkonly "$f" 2>&1)
  [ -n "$out" ] && echo "FAIL: $f"$'\n'"$out" || echo "ok:   $f"
done
```

Render:

```bash
plantuml -tsvg path/to/file.puml           # SVG next to the source (preferred, version-controlled)
plantuml -tpng -Sdpi=160 path/to/file.puml # crisp PNG for docs
```

Remote includes require network access at render time — the first render fetches `proveo.puml`.

## Mermaid (`.mmd`)

Mermaid renders **inline** in GitHub, most IDEs, and Markdown previewers, so you often don't need a
CLI at all. Install the CLI only when you need static SVG/PNG export (docs, CI artifacts).

Install:

```bash
npm i -g @mermaid-js/mermaid-cli         # provides `mmdc`
```

`mmdc` drives headless Chromium via Puppeteer. On a normal desktop the first run just works (Puppeteer
fetches a Chromium). In CI / as root / in containers, point it at a system Chromium and disable the
sandbox:

```bash
# puppeteer.json
{ "args": ["--no-sandbox", "--disable-setuid-sandbox"] }
```
```bash
mmdc -p puppeteer.json -i f.mmd -o f.svg
# in a container, also: export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

Theme — Mermaid has no remote include. Prepend the `%%{init}%%` block from
`_spec/themes/proveo.mermaid` (vendored via `scripts/fetch-themes.sh`) to the top of each `.mmd`, then
tag nodes with the role classes (`:::app`, `:::async`, `:::host`, `:::cloud`, `:::db`, `:::error`).
See `mermaid.md`.

Render:

```bash
mmdc -i path/to/file.mmd -o path/to/file.svg
mmdc -i path/to/file.mmd -o path/to/file.png -s 2   # 2x scale PNG
```

## Vega-Lite (`.vega.json`)

Vega-Lite renders in the browser via `vega-embed`. Use the CLI for static export.

Install:

```bash
npm i -g vega-cli vega-lite              # provides `vl2svg`, `vl2png`, `vl2pdf`
```

`vega-cli` depends on **node-canvas**. SVG output (`vl2svg`) is the light path. PNG/PDF output needs
canvas's native libs:

```bash
# macOS:        brew install pkg-config cairo pango libpng jpeg giflib librsvg
# Debian/Ubuntu: apt install libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

Theme — Vega-Lite has no remote include. Set the spec's `"config"` to the contents of
`_spec/themes/proveo.vega.json` (light) or `proveo-dark.vega.json` (dark) — vendored via
`scripts/fetch-themes.sh`. See `vega-lite.md`.

Render:

```bash
vl2svg path/to/chart.vega.json path/to/chart.svg
vl2png path/to/chart.vega.json path/to/chart.png    # needs node-canvas native libs
```

## Summary

| Format | Install | Validate | Render | Theme delivery |
| --- | --- | --- | --- | --- |
| PlantUML | `brew install plantuml` | `plantuml -checkonly f.puml` | `plantuml -tsvg f.puml` | remote `!include` |
| Mermaid | `npm i -g @mermaid-js/mermaid-cli` | (renders inline; no checker) | `mmdc -i f.mmd -o f.svg` | vendored `%%{init}%%` |
| Vega-Lite | `npm i -g vega-cli vega-lite` | (JSON schema) | `vl2svg f.vega.json f.svg` | vendored `config` |
