import test from "node:test";
import assert from "node:assert/strict";
import { intersectBbox, timeWindow, overlaps, mapLimited } from "../../js/map-utils.js";

test("regional intersections exclude disjoint and touching products", () => {
  assert.deepEqual(intersectBbox([0, 0, 10, 10], [5, 4, 20, 8]), [5, 4, 10, 8]);
  assert.equal(intersectBbox([0, 0, 10, 10], [11, 0, 20, 8]), null);
  assert.equal(intersectBbox([0, 0, 10, 10], [10, 0, 20, 8]), null);
});

test("timeline is bounded to the server's preceding 24 hours", () => {
  const state = { start: "2026-10-21T16:00:00Z", end: "2026-10-22T16:00:00Z" };
  const window = timeWindow(state, 86400, 21600);
  assert.equal(new Date(window[0]).toISOString(), "2026-10-22T10:00:00.000Z");
  assert.equal(new Date(window[1]).toISOString(), "2026-10-22T16:00:00.000Z");
  assert.equal(overlaps({ start: state.start, end: "2026-10-22T09:59:59Z" }, window), false);
  assert.equal(overlaps({ start: "2026-10-22T10:00:00Z", end: state.end }, window), true);
});

test("capabilities work is bounded and preserves ordering", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapLimited([1, 2, 3, 4, 5], 2, async (value) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return value * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(result, [2, 4, 6, 8, 10]);
});
