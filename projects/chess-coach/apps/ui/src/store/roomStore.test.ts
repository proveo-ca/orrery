import { beforeEach, describe, expect, it } from "vitest";

import {
  addPlayer,
  canStart,
  claimColor,
  myColor,
  playerByColor,
  players,
  reset,
  setMyPeerId,
  setReady,
  swapColors,
} from "~/store/roomStore";

describe("roomStore seating + start gate", () => {
  beforeEach(() => reset());

  it("claims a free color and clears ready votes", () => {
    addPlayer("a", { name: "A" });
    setReady("a", true);
    claimColor("a", "w");
    expect(playerByColor("w")?.peerId).toBe("a");
    expect(players()[0].ready).toBe(false); // a color change resets ready
  });

  it("refuses to claim an occupied color", () => {
    addPlayer("a", { name: "A" });
    addPlayer("b", { name: "B" });
    claimColor("a", "w");
    claimColor("b", "w"); // taken — no-op
    expect(playerByColor("w")?.peerId).toBe("a");
    expect(players().find((p) => p.peerId === "b")?.color).toBeNull();
  });

  it("swaps the two players' colors and clears ready votes", () => {
    addPlayer("a", { name: "A" });
    addPlayer("b", { name: "B" });
    claimColor("a", "w");
    claimColor("b", "b");
    setReady("a", true);
    setReady("b", true);
    swapColors();
    expect(playerByColor("w")?.peerId).toBe("b");
    expect(playerByColor("b")?.peerId).toBe("a");
    expect(players().every((p) => !p.ready)).toBe(true);
  });

  it("canStart only with two players, distinct colors, both ready", () => {
    addPlayer("a", { name: "A" });
    addPlayer("b", { name: "B" });
    expect(canStart()).toBe(false);
    claimColor("a", "w");
    claimColor("b", "b");
    expect(canStart()).toBe(false); // not ready yet
    setReady("a", true);
    setReady("b", true);
    expect(canStart()).toBe(true);
  });

  it("derives myColor from myPeerId", () => {
    addPlayer("a", { name: "A" });
    claimColor("a", "b");
    setMyPeerId("a");
    expect(myColor()).toBe("b");
  });
});
