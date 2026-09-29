import { createClient } from '@supabase/supabase-js'

// Checks the login token a page sent with its request to one of the site's
// own API routes (/api/...). Returns the account's id and a database client
// that acts as that account, so the database rules apply to it.
// Returns null when the request has no valid login.
export async function getCaller(request: Request) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )

  const userResult = await supabase.auth.getUser(token)
  if (userResult.error || !userResult.data.user) return null

  return { userId: userResult.data.user.id, supabase: supabase }
}

// Makes text safe to place inside an email's HTML.
export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
