import { createClient } from './supabase'

type SupabaseClient = ReturnType<typeof createClient>

// Headers for calls from a page to the site's own API routes (/api/...),
// carrying the login so the route knows who is asking.
export async function authHeaders(supabase: SupabaseClient): Promise<Record<string, string>> {
  const sessionResult = await supabase.auth.getSession()
  const token = sessionResult.data.session ? sessionResult.data.session.access_token : ''
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
}

// A storage name with no personal details in it; the real file name is
// kept separately where the page shows it.
function storageFileName(originalName: string) {
  const dot = originalName.lastIndexOf('.')
  const ext = dot > -1 ? originalName.slice(dot + 1).replace(/[^A-Za-z0-9]/g, '').slice(0, 10) : ''
  const random = Math.random().toString(36).slice(2, 10)
  return Date.now() + '-' + random + (ext ? '.' + ext : '')
}

// Uploads a file into the logged-in account's own folder.
// Returns the stored path, or null if the upload failed.
export async function uploadOwnFile(supabase: SupabaseClient, bucket: string, file: File) {
  const userResult = await supabase.auth.getUser()
  if (!userResult.data.user) return null

  const path = userResult.data.user.id + '/' + storageFileName(file.name)
  const uploadResult = await supabase.storage.from(bucket).upload(path, file)
  if (uploadResult.error) return null
  return path
}

// New private files are saved as a path; files uploaded before the change
// were saved as a full public link. Both are turned back into a path.
function toStoragePath(bucket: string, stored: string) {
  const marker = '/' + bucket + '/'
  if (stored.startsWith('http')) {
    const index = stored.indexOf(marker)
    if (index === -1) return ''
    try {
      return decodeURIComponent(stored.slice(index + marker.length).split('?')[0])
    } catch (e) {
      return stored.slice(index + marker.length).split('?')[0]
    }
  }
  return stored
}

// Opens a private file in a new tab through a link that works for 5 minutes.
// Only the account that uploaded the file can get such a link.
export async function openPrivateFile(supabase: SupabaseClient, bucket: string, stored: string) {
  const newTab = window.open('', '_blank')
  if (newTab) newTab.opener = null

  const path = toStoragePath(bucket, stored)
  const signedResult = path ? await supabase.storage.from(bucket).createSignedUrl(path, 300) : null

  if (signedResult && signedResult.data && signedResult.data.signedUrl) {
    if (newTab) {
      newTab.location.href = signedResult.data.signedUrl
    } else {
      window.location.href = signedResult.data.signedUrl
    }
    return
  }

  if (newTab) newTab.close()
  alert('تعذر فتح الملف. الملفات المرفوعة قبل تحديث الحماية لم تعد متاحة، يرجى رفعها من جديد.')
}
