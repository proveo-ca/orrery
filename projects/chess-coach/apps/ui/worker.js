export default {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request);

    // SPA fallback: serve index.html for any non-asset route so
    // SolidJS router handles client-side navigation.
    if (response.status === 404) {
      const url = new URL(request.url);
      if (!url.pathname.match(/\.\w+$/)) {
        response = await env.ASSETS.fetch(new Request(new URL("/chess/index.html", url.origin), request));
      }
    }

    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    newResponse.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    return newResponse;
  },
};
