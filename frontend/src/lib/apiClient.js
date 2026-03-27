const ADMIN_KEY_STORAGE = 'admin_demo_key'

/** Base URL for API calls when the SPA is on a different origin (e.g. Vercel + api.example.com). Empty = same-origin relative paths. */
const _rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim()
const API_BASE = _rawBase.replace(/\/$/, '')

/**
 * Prefix a path with VITE_API_BASE_URL when set. Absolute http(s) URLs are returned unchanged.
 * @param {string} path
 */
export function apiUrl(path) {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const p = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${p}` : p
}

export function getStoredAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE) || ''
}

export function setStoredAdminKey(key) {
  if (!key) return
  localStorage.setItem(ADMIN_KEY_STORAGE, key)
}

/** Async () => Clerk session JWT or null — set by ClerkAuthBridge when Clerk is active. */
let authTokenGetter = null

export function setAuthTokenGetter(fn) {
  authTokenGetter = typeof fn === 'function' ? fn : null
}

async function mergeAuthHeaders(headers = {}) {
  const h = { ...headers }
  if (authTokenGetter) {
    try {
      const token = await authTokenGetter()
      if (token) h.Authorization = `Bearer ${token}`
    } catch {
      /* ignore */
    }
  }
  return h
}

export async function apiRequest(path, options = {}) {
  const { headers: optHeaders, ...rest } = options
  const headers = await mergeAuthHeaders(optHeaders)
  const response = await fetch(apiUrl(path), { ...rest, headers })
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
  patch: (path, body, headers = {}) =>
    apiRequest(path, {
      method: 'PATCH',
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
