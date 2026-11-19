import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchAllPages, overlapOrFilter, SUPABASE_PAGE_SIZE } from "@/lib/data/paged-query";
import {
  rangeCovers,
  resolveRequestedRange,
  visibleCalendarSpan,
} from "@/lib/calendar-range";

describe("fetchAllPages", () => {
  it("reads past the 1000-row cap", async () => {
    const total = 1001;
    const calls: Array<[number, number]> = [];
    const result = await fetchAllPages<number>(
      async (from, to) => {
        calls.push([from, to]);
        const rows = [];
        for (let i = from; i <= to && i < total; i++) rows.push(i);
        return { data: rows, error: null };
      },
      { pageSize: SUPABASE_PAGE_SIZE },
    );
    assert.equal(result.error, null);
    assert.equal(result.data.length, 1001);
    assert.deepEqual(calls, [
      [0, 999],
      [1000, 1999],
    ]);
    assert.equal(result.data[0], 0);
    assert.equal(result.data[1000], 1000);
  });

  it("pages a 2500-row set in three requests and stops on a short page", async () => {
    const total = 2500;
    let calls = 0;
    const result = await fetchAllPages<number>(async (from, to) => {
      calls += 1;
      const rows = [];
      for (let i = from; i <= to && i < total; i++) rows.push(i);
      return { data: rows, error: null };
    });
    assert.equal(calls, 3);
    assert.equal(result.data.length, 2500);
    assert.equal(result.error, null);
  });

  it("returns a useful error instead of an empty list when a page fails", async () => {
    const result = await fetchAllPages<number>(async (from) => {
      if (from === 0) return { data: [1, 2], error: null };
      return { data: null, error: { message: "permission denied for table events" } };
    }, { pageSize: 2 });
    assert.deepEqual(result.data, [1, 2]);
    assert.match(result.error ?? "", /permission denied/);
  });

  it("does not report success when the safety cap is hit", async () => {
    const result = await fetchAllPages<number>(async () => ({ data: [1, 2], error: null }), {
      pageSize: 2,
      maxRows: 4,
    });
    assert.equal(result.data.length, 4);
    assert.match(result.error ?? "", /Stopped after 4 rows/);
  });
});

describe("calendar ranges", () => {
  it("quotes overlap filters so ISO timestamps stay one value", () => {
    const filter = overlapOrFilter(
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    );
    assert.match(filter, /starts_at\.lt\."2026-02-01T00:00:00\.000Z"/);
    assert.match(filter, /ends_at\.gt\."2026-01-01T00:00:00\.000Z"/);
    assert.match(filter, /ends_at\.is\.null/);
  });

  it("uses a bounded default window and covers only what was loaded", () => {
    const range = resolveRequestedRange(null, null, new Date("2026-11-19T12:00:00.000Z"), "Europe/Madrid");
    assert.equal(range.from < "2026-11-19", true);
    assert.equal(range.to > "2026-11-19", true);
    const visible = visibleCalendarSpan([new Date("2026-11-19T12:00:00")]);
    assert.equal(rangeCovers(range, visible), true);
    assert.equal(
      rangeCovers(range, { from: "2020-01-01", to: "2020-01-31" }),
      false,
    );
  });

  it("rejects an inverted or oversized requested window", () => {
    const swapped = resolveRequestedRange("2026-05-10", "2026-05-01", new Date(), "UTC");
    assert.equal(swapped.from, "2026-05-01");
    assert.equal(swapped.to, "2026-05-10");
    const huge = resolveRequestedRange("2020-01-01", "2035-01-01", new Date(), "UTC");
    assert.equal(huge.from, "2020-01-01");
    assert.equal(huge.to < "2035-01-01", true);
  });
});
