/** PostgREST / Supabase default max rows. A query without a range stops here. */
export const SUPABASE_PAGE_SIZE = 1000;

export type PageLoadResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export type PagedResult<T> = {
  data: T[];
  /** Set when a page failed or the safety cap was hit. `data` may be partial. */
  error: string | null;
};

/**
 * Read every row by paging past the API row cap.
 * `loadPage` receives an inclusive `[from, to]` range, matching Supabase `.range`.
 */
export async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageLoadResult<T>>,
  options?: { pageSize?: number; maxRows?: number },
): Promise<PagedResult<T>> {
  const pageSize = options?.pageSize ?? SUPABASE_PAGE_SIZE;
  const maxRows = options?.maxRows ?? 20_000;
  if (pageSize < 1) {
    return { data: [], error: "Invalid page size." };
  }

  const all: T[] = [];
  let from = 0;

  while (all.length < maxRows) {
    const to = from + pageSize - 1;
    let page: PageLoadResult<T>;
    try {
      page = await loadPage(from, to);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Query failed";
      return { data: all, error: message };
    }
    if (page.error) {
      return { data: all, error: page.error.message };
    }
    const rows = page.data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) {
      return { data: all, error: null };
    }
    from += pageSize;
  }

  return {
    data: all,
    error: `Stopped after ${maxRows} rows. Narrow the date range and try again.`,
  };
}

/**
 * PostgREST `or` filter for rows that overlap `[startIso, endIso)`.
 * ISO values are quoted because `:`, `.` and `+` are reserved.
 * A null `ends_at` counts only when the start itself falls inside the window,
 * so an undated-end event from years ago is not treated as still ongoing.
 */
export function overlapOrFilter(startIso: string, endIso: string): string {
  const start = quoteFilterValue(startIso);
  const end = quoteFilterValue(endIso);
  return [
    `and(starts_at.lt.${end},ends_at.gt.${start})`,
    `and(ends_at.is.null,starts_at.gte.${start},starts_at.lt.${end})`,
  ].join(",");
}

function quoteFilterValue(value: string): string {
  return `"${value.replaceAll('"', "")}"`;
}
