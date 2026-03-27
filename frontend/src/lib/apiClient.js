const ADMIN_KEY_STORAGE = 'admin_demo_key'

export function getStoredAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE) || ''
}

export function setStoredAdminKey(key) {
  if (!key) return
  localStorage.setItem(ADMIN_KEY_STORAGE, key)
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(path, options)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }
  const ct = response.headers.get('content-type') || ''
  return ct.includes('application/json') ? response.json() : response.text()
}

export const apiClient = {
  get: (path, options = {}) => apiRequest(path, options),
  post: (path, body, headers = {}) =>
    apiRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  del: (path, headers = {}) =>
    apiRequest(path, {
      method: 'DELETE',
      headers,
    }),
}

export function withAdminHeader(headers = {}) {
  const key = getStoredAdminKey()
  return key ? { ...headers, 'X-Admin-Key': key } : headers
}
