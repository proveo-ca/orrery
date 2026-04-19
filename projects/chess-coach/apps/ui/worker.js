export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    const isGzAsset = url.pathname.match(/\/web-engine\/.*\.gz$/);
    console.log(
      `[Worker] ${url.pathname} → asset status=${response.status}, isGzAsset=${!!isGzAsset}, content-type=${response.headers.get("content-type")}, content-encoding=${response.headers.get("content-encoding")}`,
    );

    // SPA fallback: serve index.html for any non-asset route so
    // SolidJS router handles client-side navigation.
    if (response.status === 404) {
      console.log(
        `[Worker] 404 for ${url.pathname}, extension match: ${!!url.pathname.match(/\.\w+$/)}`,
      );
      if (!url.pathname.match(/\.\w+$/)) {
        response = await env.ASSETS.fetch(
          new Request(new URL("/chess/index.html", url.origin), request),
        );
        console.log(`[Worker] SPA fallback → status=${response.status}`);
      }
    }

    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    newResponse.headers.set("Cross-Origin-Embedder-Policy", "require-corp");

    // Force revalidation for the SW bootstrap files so new deploys propagate.
    // Hashed assets (worker-*.js, wasm, models) keep Cloudflare's default long cache.
    const isSwBootstrap =
      url.pathname.endsWith("/sw.js") ||
      url.pathname.endsWith("/registerSW.js") ||
      url.pathname.endsWith("/manifest.webmanifest") ||
      url.pathname.endsWith("/index.html") ||
      url.pathname === "/chess" ||
      url.pathname === "/chess/";
    if (isSwBootstrap) {
      newResponse.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    }

    // Prevent Cloudflare from treating .gz weight files as pre-compressed content
    if (isGzAsset) {
      console.log(`[Worker] Overriding headers for .gz asset: ${url.pathname}`);
      newResponse.headers.set("Content-Type", "application/octet-stream");
      newResponse.headers.delete("Content-Encoding");
    }

    return newResponse;
  },
};
