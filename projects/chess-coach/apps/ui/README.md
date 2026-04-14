## Usage

```bash
npm install
```

## Available Scripts

### Development

```bash
npm run dev:web       # Web mode (in-browser engine, no backend)
npm run dev:desktop   # Desktop mode (expects Kotlin backend on :8080)
```

### Build

```bash
npm run build:web      # Production build for Cloudflare (VITE_TARGET=web)
npm run build:desktop  # Production build for desktop (needs VITE_API_URL)
```

### Preview

```bash
npm run preview        # Vite static preview of last build
npm run preview:cf     # Build + preview with Wrangler (matches CF behavior)
```

### Deploy

```bash
npm run deploy         # Build + deploy to Cloudflare Pages via Wrangler
```

This runs `build:web` then `wrangler deploy`, which pushes the `dist/` folder to Cloudflare using the config in `wrangler.toml`.
