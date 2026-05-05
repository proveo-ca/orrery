export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    // Single-page app: any non-file route falls back to index.html so client
    // routing/state lives in the React tree.
    if (response.status === 404 && !url.pathname.match(/\.\w+$/)) {
      response = await env.ASSETS.fetch(
        new Request(new URL("/nightfall/index.html", url.origin), request),
      );
    }

    return response;
  },
};
