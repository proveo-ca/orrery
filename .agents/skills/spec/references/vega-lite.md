# Vega-Lite conventions (proveo)

Reach for Vega-Lite for **data charts** — bars, lines, areas, heatmaps, distributions, anything
quantitative. For structural/architecture diagrams use PlantUML or Mermaid instead.

## Theme

Vega-Lite has no remote include, so the theme is **vendored** into `_spec/themes/proveo.vega.json`
(light) and `_spec/themes/proveo-dark.vega.json` (dark) — run `scripts/fetch-themes.sh`. Each is a
Vega-Lite **config** object carrying the proveo palette, plus axis / legend / title / mark defaults.

Two ways to apply it:

- **Embed** — pass it as the `config` argument:
  ```js
  import spec from "./chart.vega.json" with { type: "json" };
  import config from "./_spec/themes/proveo.vega.json" with { type: "json" };
  vegaEmbed("#chart", spec, { config });
  ```
- **Inline** — set the spec's `"config"` key to the theme's contents (`{ ...spec, "config": <proveo.vega.json> }`).
  This is the form to use for files rendered by the CLI (`vl2svg`), since the config travels with the spec.

## Color ranges (roles → category order)

The palette is exposed as Vega's scale ranges:

- `category` — `["#005F7F", "#00BAC6", "#CBDB2A", "#00769D", "#818D00", "#585858", "#009532", "#CB2000"]`
  — the brand roles in order (app, host/alt, async, … cloud, success, error). Categorical encodings
  pick these up automatically, so a `service` field colors web→teal, api→cyan, worker→lime, and so on.
- `ordinal` / `ramp` / `heatmap` — light→dark teal ramp `["#E5E4E4", "#00BAC6", "#00769D", "#005F7F", "#003445"]` for sequential/continuous scales.
- `diverging` — `["#6E1100", "#CB2000", "#E5E4E4", "#00769D", "#005F7F"]` (red ↔ teal) for signed data.

Single-series marks (`bar`, `line`, `point`, `area`, …) default to teal `#005F7F`; titles are teal,
axes/labels slate/ink on the `#FAFAFA` canvas.

## Example

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": "Events by service",
  "width": 380,
  "height": 240,
  "data": { "values": [
    { "service": "web", "events": 320 },
    { "service": "api", "events": 280 },
    { "service": "worker", "events": 190 }
  ]},
  "mark": "bar",
  "encoding": {
    "x": { "field": "service", "type": "nominal", "sort": "-y", "axis": { "labelAngle": 0 }, "title": null },
    "y": { "field": "events", "type": "quantitative", "title": "events / min" },
    "color": { "field": "service", "type": "nominal", "legend": null }
  },
  "config": { "...": "contents of _spec/themes/proveo.vega.json" }
}
```

For a dark dashboard, swap the inlined config for `_spec/themes/proveo-dark.vega.json`.

## Rendering

Charts render in the browser via `vega-embed`. For static export use `vl2svg` / `vl2png`; see
`rendering.md` for install and the node-canvas native-library notes (PNG only).
