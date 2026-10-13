import { createClient } from '@supabase/supabase-js'

// rebuilt once a day so new lawyers and firms appear
export const revalidate = 86400

export default async function sitemap() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string
  )

  const baseUrl = 'https://hammurabi-two.vercel.app'

  const staticPages = [
    { url: baseUrl, lastModified: new Date() },
    { url: baseUrl + '/lawyers', lastModified: new Date() },
    { url: baseUrl + '/community', lastModified: new Date() },
    { url: baseUrl + '/legal-articles', lastModified: new Date() },
    { url: baseUrl + '/signup', lastModified: new Date() },
    { url: baseUrl + '/login', lastModified: new Date() },
  ]

  // the database returns at most 1000 rows per request, so read in pages
  async function allIds(table: string, extra: (q: any) => any) {
    const ids: { id: number }[] = []
    for (let from = 0; from < 50000; from += 1000) {
      const result = await extra(supabase.from(table).select('id').eq('is_approved', true).eq('is_active', true)).order('id').range(from, from + 999)
      const rows = result.data || []
      rows.forEach(function (r: { id: number }) { ids.push(r) })
      if (rows.length < 1000) break
    }
    return ids
  }

  const lawyersData = await allIds('lawyers', function (q) { return q.eq('is_trainee', false) })
  const lawyerPages = lawyersData.map(function (l) {
    return { url: baseUrl + '/lawyers/' + l.id, lastModified: new Date() }
  })

  const firmsData = await allIds('firms', function (q) { return q })
  const firmPages = firmsData.map(function (f) {
    return { url: baseUrl + '/firms/' + f.id, lastModified: new Date() }
  })

  return staticPages.concat(lawyerPages).concat(firmPages)
}