package thinserver

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

// webroot holds the built `web-full` UI (apps/ui `dist/chess`), synced here at
// build time by the Gradle `syncWeb` task. A placeholder index.html keeps
// `go build` working before the first sync.
//
//go:embed webroot
var webFS embed.FS

// coopCoep applies cross-origin isolation (required for SharedArrayBuffer /
// threaded WASM) + correct content types, replicating the vite plugin / _headers
// rules: never gzip-encode `.pb.gz` weights; correct `application/wasm` MIME.
func coopCoep(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		h.Set("Cross-Origin-Embedder-Policy", "require-corp")
		h.Set("Cross-Origin-Resource-Policy", "same-origin")
		switch {
		case strings.HasSuffix(r.URL.Path, ".wasm"):
			h.Set("Content-Type", "application/wasm")
		case strings.HasSuffix(r.URL.Path, ".js"):
			h.Set("Content-Type", "text/javascript; charset=utf-8")
		case strings.HasSuffix(r.URL.Path, ".gz"):
			// lc0 .pb.gz weights are gzip DATA, served verbatim (no Content-Encoding).
			h.Set("Content-Type", "application/octet-stream")
		}
		next.ServeHTTP(w, r)
	})
}

// staticHandler serves the embedded UI under /chess/ with SPA fallback, and
// redirects / → /chess/.
func staticHandler() http.Handler {
	sub, err := fs.Sub(webFS, "webroot")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/chess/", http.StatusFound)
			return
		}
		http.NotFound(w, r)
	})
	mux.Handle("/chess/", http.StripPrefix("/chess/", coopCoep(spaFallback(sub, fileServer))))
	return mux
}

// spaFallback serves index.html for any /chess/* path that isn't a real file.
func spaFallback(sub fs.FS, fileServer http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "index.html"
		}
		if _, err := fs.Stat(sub, p); err != nil {
			// Not a real asset → SPA route: rewrite to index.html.
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/index.html"
			fileServer.ServeHTTP(w, r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
