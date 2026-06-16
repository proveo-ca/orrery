import { afterEach, describe, expect, it } from "vitest";

import { EnginePool, type EngineWorkerLike } from "~/engine/EnginePool";

class FakeWorker implements EngineWorkerLike {
  posted: string[] = [];
  terminated = false;
  private cb: ((line: string) => void) | null = null;

  post(command: string) {
    this.posted.push(command);
  }
  onLine(cb: (line: string) => void) {
    this.cb = cb;
  }
  terminate() {
    this.terminated = true;
  }
  emit(line: string) {
    this.cb?.(line);
  }
  /** Last `go` command's position, for asserting what the slot is searching. */
  positions() {
    return this.posted.filter((c) => c.startsWith("position fen ")).map((c) => c.slice(13));
  }
}

let created: FakeWorker[] = [];
let pool: EnginePool;

const makePool = (maxWorkers: number) => {
  created = [];
  pool = new EnginePool({
    maxWorkers,
    now: () => 0,
    factory: () => {
      const w = new FakeWorker();
      created.push(w);
      return w;
    },
  });
  return pool;
};

afterEach(() => {
  // Clears watchdog timers and settles any dangling jobs.
  pool?.dispose();
});

describe("EnginePool", () => {
  it("runs a job and resolves with the final move + score + depth", async () => {
    makePool(1);
    const p = pool.evaluate({ fen: "FEN_A", depth: 10 });

    expect(created.length).toBe(1);
    const w = created[0];
    expect(w.posted).toContain("position fen FEN_A");
    expect(w.posted.some((c) => c.startsWith("go depth 10"))).toBe(true);

    w.emit("info depth 10 score cp 35 pv e2e4 e7e5");
    w.emit("bestmove e2e4");

    await expect(p).resolves.toEqual({
      bestMove: "e2e4",
      score: { kind: "cp", value: 35 },
      depth: 10,
    });
  });

  it("passes searchmoves through", () => {
    makePool(1);
    pool.evaluate({ fen: "FEN_A", depth: 20, searchMoves: ["e2e4"] }).catch(() => {});
    expect(created[0].posted).toContain("go depth 20 searchmoves e2e4");
  });

  it("normalizes a (none) bestmove to null", async () => {
    makePool(1);
    const p = pool.evaluate({ fen: "FEN_A", depth: 5 });
    created[0].emit("bestmove (none)");
    await expect(p).resolves.toMatchObject({ bestMove: null });
  });

  it("streams onInfo for each scored info line", async () => {
    makePool(1);
    const infos: unknown[] = [];
    const p = pool.evaluate({ fen: "A", depth: 12, onInfo: (i) => infos.push(i) });
    created[0].emit("info depth 5 score cp 10 pv e2e4");
    created[0].emit("info depth 12 score cp 20 pv d2d4");
    created[0].emit("bestmove d2d4");
    await p;
    expect(infos).toEqual([
      { depth: 5, score: { kind: "cp", value: 10 }, pv: ["e2e4"] },
      { depth: 12, score: { kind: "cp", value: 20 }, pv: ["d2d4"] },
    ]);
  });

  it("spawns up to maxWorkers concurrently, queues the rest", async () => {
    makePool(2);
    const a = pool.evaluate({ fen: "A", depth: 10 });
    const b = pool.evaluate({ fen: "B", depth: 10 });
    const c = pool.evaluate({ fen: "C", depth: 10 });

    expect(created.length).toBe(2); // C is queued, no third worker

    created[0].emit("bestmove amove");
    await a;
    // freed worker picks up the queued C
    expect(created[0].positions()).toEqual(["A", "C"]);

    created[1].emit("bestmove bmove");
    created[0].emit("bestmove cmove");
    await Promise.all([b, c]);
  });

  it("interactive preempts a running background job, then the background resumes", async () => {
    makePool(1);
    const bg = pool.evaluate({ fen: "BG", depth: 20, priority: "background" });
    const w = created[0];
    expect(w.positions()).toEqual(["BG"]);

    const inter = pool.evaluate({ fen: "INT", depth: 12, priority: "interactive" });
    // Preemption stops the running search and stages the interactive one.
    expect(w.posted).toContain("stop");

    // The drained stop-response bestmove must NOT resolve anything; it just
    // frees the slot so the interactive job can start.
    w.emit("bestmove bg_drained");
    expect(w.positions()).toEqual(["BG", "INT"]);

    w.emit("bestmove int_done");
    await expect(inter).resolves.toMatchObject({ bestMove: "int_done" });

    // Background resumes from scratch on the freed worker.
    expect(w.positions()).toEqual(["BG", "INT", "BG"]);
    w.emit("bestmove bg_done");
    await expect(bg).resolves.toMatchObject({ bestMove: "bg_done" });
  });

  it("does not preempt for a non-interactive job", () => {
    makePool(1);
    pool.evaluate({ fen: "BG", depth: 20, priority: "background" }).catch(() => {});
    pool.evaluate({ fen: "N", depth: 12, priority: "normal" }).catch(() => {});
    // Normal does not preempt; the running background keeps the only worker.
    expect(created[0].posted).not.toContain("stop");
  });

  it("runs higher-priority queued jobs first when a worker frees up", async () => {
    makePool(1);
    // Running job is interactive so it completes naturally (not preempted),
    // letting us observe pure queue ordering between the two waiters.
    const running = pool.evaluate({ fen: "R", depth: 10, priority: "interactive" });
    pool.evaluate({ fen: "LOW", depth: 10, priority: "background" }).catch(() => {});
    pool.evaluate({ fen: "NORM", depth: 10, priority: "normal" }).catch(() => {});

    const w = created[0];
    w.emit("bestmove rmove"); // R completes; pool picks the next queued job
    await running;
    // NORM (normal) jumps ahead of the earlier-queued LOW (background).
    expect(w.positions()).toEqual(["R", "NORM"]);
  });

  it("aborts a queued job without disturbing the running one", async () => {
    makePool(1);
    const a = pool.evaluate({ fen: "A", depth: 10 });
    const ctrl = new AbortController();
    const b = pool.evaluate({ fen: "B", depth: 10, signal: ctrl.signal });

    ctrl.abort();
    await expect(b).rejects.toMatchObject({ name: "AbortError" });

    created[0].emit("bestmove amove");
    await expect(a).resolves.toMatchObject({ bestMove: "amove" });
  });

  it("aborts a running job: stops the worker, rejects, and frees the slot", async () => {
    makePool(1);
    const ctrl = new AbortController();
    const a = pool.evaluate({ fen: "A", depth: 10, signal: ctrl.signal });
    const w = created[0];

    ctrl.abort();
    expect(w.posted).toContain("stop");
    await expect(a).rejects.toMatchObject({ name: "AbortError" });

    // Next job waits for the drained bestmove, then runs on the same worker.
    const b = pool.evaluate({ fen: "B", depth: 10 });
    expect(w.positions()).toEqual(["A"]); // B not started yet — slot still draining
    w.emit("bestmove a_drained");
    expect(w.positions()).toEqual(["A", "B"]);
    w.emit("bestmove bmove");
    await expect(b).resolves.toMatchObject({ bestMove: "bmove" });
  });

  it("rejects immediately if the signal is already aborted", async () => {
    makePool(1);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(pool.evaluate({ fen: "A", depth: 10, signal: ctrl.signal })).rejects.toMatchObject(
      { name: "AbortError" },
    );
    expect(created.length).toBe(0);
  });
});
