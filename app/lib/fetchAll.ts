// The database returns at most 1000 rows per request. For lists that can
// grow past that (a firm's cases, years of invoices or appointments), these
// helpers keep asking for the next 1000 until everything has arrived.

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>

// build(from, to) must return the query with .range(from, to) and a fixed order.
export async function fetchAll<T = any>(build: (from: number, to: number) => Page<T>, max = 50000) {
  const rows: T[] = []
  for (let from = 0; from < max; from += 1000) {
    const result = await build(from, from + 999)
    if (result.error) return { data: rows.length > 0 ? rows : null, error: result.error }
    const page = result.data || []
    for (let i = 0; i < page.length; i++) rows.push(page[i])
    if (page.length < 1000) break
  }
  return { data: rows, error: null }
}

// For ".in(column, ids)" with many ids: asks in groups of 150 ids, so the
// request address never gets too long, and pages each group.
export async function fetchByIds<T = any>(ids: (number | string)[], build: (chunk: (number | string)[], from: number, to: number) => Page<T>) {
  const rows: T[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    const result = await fetchAll<T>(function (from, to) { return build(chunk, from, to) })
    if (result.error) return { data: rows.length > 0 ? rows : null, error: result.error }
    const page = result.data || []
    for (let j = 0; j < page.length; j++) rows.push(page[j])
  }
  return { data: rows, error: null }
}
