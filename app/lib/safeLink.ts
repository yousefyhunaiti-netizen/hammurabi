// Links typed in by users (websites, map links, library links) are only
// shown if they are normal web addresses. Anything else, such as a
// "javascript:" link that could run code in a visitor's browser, is dropped.
// Addresses typed without http, like "www.example.com", get https:// added.
export function safeLink(url: string | null | undefined) {
  const value = (url || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return ''
  return 'https://' + value.replace(/^\/+/, '')
}
