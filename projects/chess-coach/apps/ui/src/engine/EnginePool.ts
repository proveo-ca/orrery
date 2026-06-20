// SPEC: _spec/chess-coach/ui/components.puml
import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine";
import { parseStockfishMessage } from "~/utils/stockfishParser";
import type { EvalResult, PositionEval } from "~/types/analysis";

/**
 * Central Stockfish scheduler.
 *
 * Every resource-intensive Stockfish search in the app (hint, hover-blunder
 * eval, the continuous best-move-arrow analysis, batch game review, and the
 * live pre-analysis) funnels through this single pool instead of each
 * consumer spawning its own Worker. That buys three things the old
 * scattered model could not:
 *
 *  1. Task identity — each search owns its Worker exclusively until its
 *     `bestmove` arrives, and a stopped search's drained `bestmove` is
 *     discarded by the slot, not mis-attributed to the next request. This
 *     kills the stale-`a2a3/a7a6`-bestmove class of races that used to make
 *     the best-move arrow flicker/vanish.
 *  2. A bounded warm pool — a fixed handful of reused workers rather than an
 *     unbounded spray of cold-compiled WASM heaps competing for the
 *     per-origin memory budget.
 *  3. Priorities + preemption — an `interactive` search (hint/hover) jumps a
 *     `background` one (review/pre-analysis), preempting a running low-prio
 *     job and re-queuing it so the live game never waits on bulk work.
 */

export type Priority = "interactive" | "normal" | "background";
export type EvalInfo = { depth?: number; score?: PositionEval; pv?: string[] };

export interface EvalRequest {
  fen: string;
  depth: number;
  /** Restrict the search to these UCI moves (Stockfish `searchmoves`). */
  searchMoves?: string[];
  /** Default "normal". `interactive` preempts running lower-priority jobs. */
  priority?: Priority;
  /** Abort the search; the returned promise rejects with an AbortError. */
  signal?: AbortSignal;
  /** Streamed on every `info` line carrying a score (depth-by-depth). */
  onInfo?: (info: EvalInfo) => void;
}

const PRIORITY_RANK: Record<Priority, number> = {
  interactive: 2,
  normal: 1,
  background: 0,
};

/** Minimal Worker surface so tests can inject a deterministic fake. */
export interface EngineWorkerLike {
  post(command: string): void;
  onLine(cb: (line: string) => void): void;
  terminate(): void;
}

export type EngineWorkerFactory = () => EngineWorkerLike;

const defaultFactory: EngineWorkerFactory = () => {
  const worker = new Worker(DEFAULT_STOCKFISH_WORKER_URL);
  return {
    post: (cmd) => worker.postMessage(cmd),
    onLine: (cb) => {
      worker.onmessage = (e: MessageEvent) => {
        if (typeof e.data === "string") cb(e.data);
      };
    },
    terminate: () => worker.terminate(),
  };
};

class AbortError extends Error {
  constructor() {
    super("Engine search aborted");
    this.name = "AbortError";
  }
}

type Job = {
  req: EvalRequest;
  priority: Priority;
  resolve: (r: EvalResult) => void;
  reject: (e: Error) => void;
  settled: boolean;
  // Latest streamed state, surfaced in the final EvalResult.
  score: PositionEval | null;
  depth: number;
  detachAbort?: () => void;
};

type Slot = {
  worker: EngineWorkerLike;
  job: Job | null;
  /** True between a `stop` and the single drained `bestmove` it produces. */
  freeing: boolean;
  /** Job to start once the current `freeing` drain completes (preemption). */
  next: Job | null;
  watchdog: ReturnType<typeof setTimeout> | null;
};

const WATCHDOG_MS = 30_000;
const RESTART_WINDOW_MS = 10_000;
const MAX_RESTARTS_PER_WINDOW = 4;

export class EnginePool {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private readonly maxWorkers: number;
  private readonly factory: EngineWorkerFactory;
  private readonly now: () => number;

  private restartCount = 0;
  private restartWindowStart = 0;
  private givenUp = false;

  constructor(
    opts: {
      maxWorkers?: number;
      factory?: EngineWorkerFactory;
      now?: () => number;
    } = {},
  ) {
    this.factory = opts.factory ?? defaultFactory;
    this.now = opts.now ?? (() => Date.now());
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 4;
    // Reuse a small warm pool. Capped low so several single-threaded WASM
    // heaps don't blow the per-origin memory budget on web targets.
    this.maxWorkers = opts.maxWorkers ?? Math.max(2, Math.min(3, (cores || 4) - 2));
  }

  evaluate(req: EvalRequest): Promise<EvalResult> {
    if (this.givenUp) {
      return Promise.reject(new Error("Engine pool disabled after repeated worker failures"));
    }
    if (req.signal?.aborted) return Promise.reject(new AbortError());

    return new Promise<EvalResult>((resolve, reject) => {
      const job: Job = {
        req,
        priority: req.priority ?? "normal",
        resolve,
        reject,
        settled: false,
        score: null,
        depth: 0,
      };

      if (req.signal) {
        const onAbort = () => this.cancel(job, new AbortError());
        req.signal.addEventListener("abort", onAbort, { once: true });
        job.detachAbort = () => req.signal?.removeEventListener("abort", onAbort);
      }

      this.enqueue(job);
      this.schedule();
    });
  }

  /** Tear everything down (test cleanup / hard reset). */
  dispose(): void {
    for (const job of this.queue) this.settle(job, null, new AbortError());
    this.queue = [];
    for (const slot of this.slots) {
      if (slot.watchdog) clearTimeout(slot.watchdog);
      if (slot.job) this.settle(slot.job, null, new AbortError());
      slot.worker.terminate();
    }
    this.slots = [];
  }

  // ── queue helpers ──────────────────────────────────────────────────────

  private enqueue(job: Job): void {
    // Insert keeping the queue sorted high→low priority, FIFO within a tier.
    const rank = PRIORITY_RANK[job.priority];
    let i = this.queue.length;
    while (i > 0 && PRIORITY_RANK[this.queue[i - 1].priority] < rank) i--;
    this.queue.splice(i, 0, job);
  }

  private removeFromQueue(job: Job): boolean {
    const idx = this.queue.indexOf(job);
    if (idx === -1) return false;
    this.queue.splice(idx, 1);
    return true;
  }

  private settle(job: Job, result: EvalResult | null, error: Error | null): void {
    if (job.settled) return;
    job.settled = true;
    job.detachAbort?.();
    if (error) job.reject(error);
    else job.resolve(result ?? { bestMove: null, score: null, depth: 0 });
  }

  // ── scheduling ─────────────────────────────────────────────────────────

  private idleSlot(): Slot | undefined {
    return this.slots.find((s) => !s.job && !s.freeing && !s.next);
  }

  private lowestRunningSlotBelow(rank: number): Slot | undefined {
    let best: Slot | undefined;
    for (const s of this.slots) {
      if (!s.job || s.freeing || s.next) continue;
      if (PRIORITY_RANK[s.job.priority] >= rank) continue;
      if (!best || PRIORITY_RANK[s.job.priority] < PRIORITY_RANK[best.job!.priority]) best = s;
    }
    return best;
  }

  private schedule(): void {
    while (this.queue.length > 0) {
      const job = this.queue[0];
      if (job.settled) {
        this.queue.shift();
        continue;
      }

      const idle = this.idleSlot();
      if (idle) {
        this.queue.shift();
        this.assign(idle, job);
        continue;
      }

      if (this.slots.length < this.maxWorkers) {
        const slot = this.spawnSlot();
        this.queue.shift();
        this.assign(slot, job);
        continue;
      }

      // Saturated: only an interactive job may preempt a lower-priority run.
      if (job.priority === "interactive") {
        const victim = this.lowestRunningSlotBelow(PRIORITY_RANK.interactive);
        if (victim) {
          this.queue.shift();
          this.preempt(victim, job);
          continue;
        }
      }
      break; // highest queued job can't be placed → nothing below it can either
    }
  }

  private assign(slot: Slot, job: Job): void {
    slot.job = job;
    job.score = null;
    job.depth = 0;
    slot.worker.post("ucinewgame");
    slot.worker.post(`position fen ${job.req.fen}`);
    const sm = job.req.searchMoves?.length ? ` searchmoves ${job.req.searchMoves.join(" ")}` : "";
    slot.worker.post(`go depth ${job.req.depth}${sm}`);
    this.armWatchdog(slot);
  }

  /** Stop a running job and re-queue it so a higher-priority job can run now. */
  private preempt(victim: Slot, incoming: Job): void {
    const running = victim.job!;
    victim.job = null;
    this.enqueue(running); // resumes from scratch once capacity frees up
    victim.next = incoming;
    victim.freeing = true;
    // Keep the watchdog armed across the drain: if the stopped search's
    // `bestmove` never arrives (dead worker), the slot would otherwise stay
    // `freeing` forever and silently shrink the pool.
    this.armWatchdog(victim);
    victim.worker.post("stop");
  }

  // ── worker lifecycle ─────────────────────────────────────────────────────

  private spawnSlot(): Slot {
    const slot: Slot = {
      worker: this.factory(),
      job: null,
      freeing: false,
      next: null,
      watchdog: null,
    };
    slot.worker.onLine((line) => this.onLine(slot, line));
    slot.worker.post("uci");
    slot.worker.post("isready");
    this.slots.push(slot);
    return slot;
  }

  private onLine(slot: Slot, raw: string): void {
    const msg = parseStockfishMessage(raw);

    if (msg.type === "info") {
      if (slot.freeing || !slot.job) return; // stale info from a stopped search
      this.armWatchdog(slot);
      if (msg.score) {
        slot.job.score = msg.score;
        if (typeof msg.depth === "number") slot.job.depth = msg.depth;
        slot.job.req.onInfo?.({ depth: msg.depth, score: msg.score, pv: msg.pv });
      }
      return;
    }

    if (msg.type !== "bestmove") return;

    this.clearWatchdog(slot);

    if (slot.freeing) {
      // The single drained `bestmove` from a `stop`. Discard, then resume.
      slot.freeing = false;
      const next = slot.next;
      slot.next = null;
      if (next && !next.settled) this.assign(slot, next);
      else this.schedule();
      return;
    }

    const job = slot.job;
    slot.job = null;
    if (job) {
      const move = msg.move && msg.move !== "(none)" ? msg.move : null;
      this.settle(job, { bestMove: move, score: job.score, depth: job.depth }, null);
    }
    this.schedule();
  }

  /** Abort a job wherever it is: queued, running, or staged as a slot.next. */
  private cancel(job: Job, error: Error): void {
    if (job.settled) return;

    if (this.removeFromQueue(job)) {
      this.settle(job, null, error);
      return;
    }

    for (const slot of this.slots) {
      if (slot.next === job) {
        slot.next = null;
        this.settle(job, null, error);
        return;
      }
      if (slot.job === job) {
        slot.job = null;
        slot.freeing = true;
        // Keep the watchdog armed across the drain (see preempt): a dead worker
        // mid-cancel must not strand the slot in `freeing` forever.
        this.armWatchdog(slot);
        slot.worker.post("stop");
        this.settle(job, null, error);
        return;
      }
    }

    // Not found anywhere (already drained) — settle defensively.
    this.settle(job, null, error);
  }

  // ── watchdog + circuit breaker ───────────────────────────────────────────

  private armWatchdog(slot: Slot): void {
    this.clearWatchdog(slot);
    slot.watchdog = setTimeout(() => this.restartSlot(slot), WATCHDOG_MS);
  }

  private clearWatchdog(slot: Slot): void {
    if (slot.watchdog) {
      clearTimeout(slot.watchdog);
      slot.watchdog = null;
    }
  }

  private restartSlot(slot: Slot): void {
    this.clearWatchdog(slot);
    const job = slot.job ?? slot.next;
    slot.job = null;
    slot.next = null;
    slot.freeing = false;

    try {
      slot.worker.terminate();
    } catch {}
    this.slots = this.slots.filter((s) => s !== slot);

    if (job) this.settle(job, null, new Error("Engine worker timed out"));

    const t = this.now();
    if (t - this.restartWindowStart > RESTART_WINDOW_MS) {
      this.restartCount = 0;
      this.restartWindowStart = t;
    }
    this.restartCount += 1;
    if (this.restartCount > MAX_RESTARTS_PER_WINDOW) {
      this.givenUp = true;
      for (const q of this.queue) this.settle(q, null, new Error("Engine pool disabled"));
      this.queue = [];
      return;
    }
    this.schedule();
  }
}

export const enginePool = new EnginePool();
