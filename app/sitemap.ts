import { createClient } from '@supabase/supabase-js'

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
    { url: baseUrl + '/success-stories', lastModified: new Date() },
    { url: baseUrl + '/signup', lastModified: new Date() },
    { url: baseUrl + '/login', lastModified: new Date() },
  ]

  const lawyersResult = await supabase.from('lawyers').select('id').eq('is_approved', true).eq('is_active', true)
  const lawyerPages = (lawyersResult.data || []).map(function (l) {
    return { url: baseUrl + '/lawyers/' + l.id, lastModified: new Date() }
  })

  const firmsResult = await supabase.from('firms').select('id').eq('is_approved', true).eq('is_active', true)
  const firmPages = (firmsResult.data || []).map(function (f) {
    return { url: baseUrl + '/firms/' + f.id, lastModified: new Date() }
  })

  return staticPages.concat(lawyerPages).concat(firmPages)
}