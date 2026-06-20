/**
 * Local oxlint plugin enforcing the chess-coach UI component architecture.
 * Wired into oxlint.config.ts via `jsPlugins`. Rules:
 *
 *   proveo-ui/pure-primitive          — components under primitives/ must be
 *                                        presentational (no side effects).
 *   proveo-ui/route-target-in-screens — <Route component={X}> targets in
 *                                        src/index.tsx must live in screens/.
 *   proveo-ui/own-css-module          — a component may only import its own
 *                                        same-named *.module.css (covers the
 *                                        "no foreign CSS" + "name must match"
 *                                        rules). Global *.css are exempt.
 *
 * NOTE: oxlint JS plugins are alpha. AST is ESTree-compatible.
 */

// A "side effect" = reaching into app state / IO, or a Solid lifecycle effect.
const SIDE_EFFECT_IMPORT_PREFIXES = ["~/store", "~/services", "~/hooks"];
const SIDE_EFFECT_CALLS = new Set([
  "createEffect",
  "createRenderEffect",
  "onMount",
  "onCleanup",
]);

const baseName = (filename: string): string =>
  (filename.split(/[\\/]/).pop() ?? "").replace(/\.(tsx|ts|jsx|js)$/, "");

const importedFrom = (src: string, prefixes: string[]): boolean =>
  prefixes.some((p) => src === p || src.startsWith(`${p}/`));

const norm = (filename: string): string => String(filename).replace(/\\/g, "/");
const isTestFile = (filename: string): boolean => /\.test\.[jt]sx?$/.test(filename);

/** Rules 1 + 2 — primitives must be pure; advise atoms/ or features/. */
const purePrimitive = {
  meta: {
    type: "problem",
    docs: { description: "Primitive components must be presentational (no side effects)." },
  },
  create(context: any) {
    if (!context.filename.includes("/components/primitives/")) return {};

    let offending: any = null;
    let kind = "";
    let importsAtom = false;
    const note = (node: any, k: string) => {
      if (!offending) {
        offending = node;
        kind = k;
      }
    };

    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string") return;
        // Type-only imports are erased at runtime — not a side effect.
        const specs = node.specifiers ?? [];
        const typeOnly =
          node.importKind === "type" ||
          (specs.length > 0 && specs.every((s: any) => s.importKind === "type"));
        if (typeOnly) return;
        if (importedFrom(src, SIDE_EFFECT_IMPORT_PREFIXES)) {
          note(node, `imports app state/IO from "${src}"`);
        }
        if (src.includes("/components/atoms/")) importsAtom = true;
      },
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type === "Identifier" && SIDE_EFFECT_CALLS.has(callee.name)) {
          note(node, `calls ${callee.name}()`);
        }
      },
      "Program:exit"() {
        if (!offending) return;
        const dest = importsAtom
          ? "features/ (it composes an atom)"
          : "atoms/ (it owns a single stateful responsibility)";
        context.report({
          node: offending,
          message: `Primitive components must be presentational and free of side effects, but this one ${kind}. Move it to ${dest}.`,
        });
      },
    };
  },
};

/** Rule 3 — router <Route> targets must live in screens/. */
const routeTargetInScreens = {
  meta: {
    type: "problem",
    docs: { description: "Components used as <Route> targets must live in src/screens/." },
  },
  create(context: any) {
    const importSource = new Map<string, string>();
    const targets: Array<{ name: string; node: any }> = [];

    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string") return;
        for (const spec of node.specifiers ?? []) {
          if (spec.local?.name) importSource.set(spec.local.name, src);
        }
      },
      JSXOpeningElement(node: any) {
        if (node.name?.type !== "JSXIdentifier" || node.name.name !== "Route") return;
        for (const attr of node.attributes ?? []) {
          if (attr.type !== "JSXAttribute" || attr.name?.name !== "component") continue;
          const val = attr.value;
          if (
            val?.type === "JSXExpressionContainer" &&
            val.expression?.type === "Identifier"
          ) {
            targets.push({ name: val.expression.name, node: attr });
          }
        }
      },
      "Program:exit"() {
        for (const t of targets) {
          const src = importSource.get(t.name);
          if (src && !src.includes("/screens/")) {
            context.report({
              node: t.node,
              message: `Route target <${t.name}> is imported from "${src}", but route components must live in src/screens/. Relocate ${t.name} into screens/.`,
            });
          }
        }
      },
    };
  },
};

/** Rules 4 + 5 — only import your own same-named CSS module; globals exempt. */
const ownCssModule = {
  meta: {
    type: "problem",
    docs: { description: "A component may only import its own same-named CSS module." },
  },
  create(context: any) {
    const fileBase = baseName(context.filename);
    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string") return;
        const match = src.match(/([^/\\]+)\.module\.css$/);
        if (!match) return; // global *.css (theme.css, index.css) is exempt
        const moduleBase = match[1];
        if (moduleBase !== fileBase) {
          context.report({
            node,
            message: `"${moduleBase}.module.css" is not this component's stylesheet (expected "${fileBase}.module.css"). A component may only import its own CSS module — move shared styles to a global stylesheet (theme.css) or split the component.`,
          });
        }
      },
    };
  },
};

/**
 * Types shared across folders must live in ~/types/. Errors on a TYPE import
 * from another top-level folder (cross-folder), or from ANY component module.
 * Same-folder, non-component type imports (e.g. an engine type used only within
 * engine/) are allowed — those are layer-internal contracts.
 */
const noCrossModuleTypes = {
  meta: {
    type: "problem",
    docs: { description: "Types shared across folders must live in ~/types/, not be imported across modules." },
  },
  create(context: any) {
    // Tests mirror the src layout (tests/hooks/… ≡ hooks), so resolve both.
    const fm = String(context.filename).match(/\/(?:src|tests)\/([^/]+)\//);
    const importerFolder = fm ? fm[1] : "";
    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string" || !src.startsWith("~/") || src.startsWith("~/types/")) return;
        const srcFolder = src.split("/")[1];
        const isComponents = srcFolder === "components";
        const crossFolder = srcFolder !== importerFolder;
        if (!isComponents && !crossFolder) return; // same-folder, non-component → allowed
        const wholeIsType = node.importKind === "type";
        for (const spec of node.specifiers ?? []) {
          if (!wholeIsType && spec.importKind !== "type") continue;
          const name = spec.imported?.name ?? spec.local?.name ?? "type";
          context.report({
            node: spec,
            message: `Type "${name}" is imported across modules from "${src}". A type shared across folders (or any type from a component) must live in ~/types/ — move it there and import it from ~/types/.`,
          });
        }
      },
    };
  },
};

/**
 * All main-thread Stockfish work must route through the EnginePool singleton
 * (`enginePool.evaluate()`), never a directly-spawned Stockfish worker. Engines
 * are owned by EngineBridge; the pool is a singleton. Enforced by allowlist:
 *   - import of DEFAULT_STOCKFISH_WORKER_URL → only EnginePool.ts
 *   - new StockfishEngine / new MaiaEngine   → only EngineBridge.ts
 *   - new EnginePool                          → only EnginePool.ts (+ tests)
 */
const enginePoolOnly = {
  meta: {
    type: "problem",
    docs: { description: "Stockfish work must go through enginePool.evaluate(); don't spawn engines/workers directly." },
  },
  create(context: any) {
    const file = norm(context.filename);
    return {
      ImportDeclaration(node: any) {
        const src = node.source?.value;
        if (typeof src !== "string") return;
        const importsWorkerUrl = (node.specifiers ?? []).some(
          (s: any) => (s.imported?.name ?? s.local?.name) === "DEFAULT_STOCKFISH_WORKER_URL",
        );
        if (importsWorkerUrl && !file.endsWith("engine/EnginePool.ts")) {
          context.report({
            node,
            message:
              "Only EnginePool may import DEFAULT_STOCKFISH_WORKER_URL. Route Stockfish work through enginePool.evaluate() instead of spawning a Stockfish worker.",
          });
        }
      },
      NewExpression(node: any) {
        if (node.callee?.type !== "Identifier") return;
        const name = node.callee.name;
        if ((name === "StockfishEngine" || name === "MaiaEngine") && !file.endsWith("engine/EngineBridge.ts")) {
          context.report({
            node,
            message: `Instantiate ${name} only in EngineBridge. Consumers must use enginePool.evaluate() (Stockfish) or the EngineBridge facade.`,
          });
        }
        if (name === "EnginePool" && !file.endsWith("engine/EnginePool.ts") && !isTestFile(file)) {
          context.report({
            node,
            message: "Don't construct EnginePool; import and use the shared `enginePool` singleton.",
          });
        }
      },
    };
  },
};

/**
 * The capabilities Policy Object may only be mutated by screens (the
 * orchestration layer). Features, atoms, primitives and hooks must READ
 * `capabilities()` flags, never call `setCapabilities()`.
 */
const capabilitiesSetInScreensOnly = {
  meta: {
    type: "problem",
    docs: { description: "setCapabilities() may only be called from a screen; everything else reads capabilities() flags." },
  },
  create(context: any) {
    const file = norm(context.filename);
    const allowed = file.includes("/screens/") || isTestFile(file);
    return {
      CallExpression(node: any) {
        if (allowed) return;
        if (node.callee?.type === "Identifier" && node.callee.name === "setCapabilities") {
          context.report({
            node,
            message:
              "setCapabilities() may only be called from a screen (src/screens/). Components and hooks should read capabilities() flags, not mutate the policy.",
          });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "proveo-ui" },
  rules: {
    "pure-primitive": purePrimitive,
    "route-target-in-screens": routeTargetInScreens,
    "own-css-module": ownCssModule,
    "no-cross-module-types": noCrossModuleTypes,
    "engine-pool-only": enginePoolOnly,
    "capabilities-set-in-screens-only": capabilitiesSetInScreensOnly,
  },
};

export default plugin;
