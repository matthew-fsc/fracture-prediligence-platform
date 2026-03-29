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

/** POST multipart/form-data (omit Content-Type so the browser sets the boundary). */
export async function apiPostMultipart(path, formData) {
  const headers = await mergeAuthHeaders({})
  delete headers['Content-Type']
  const response = await fetch(apiUrl(path), { method: 'POST', body: formData, headers })
  if (!response.ok) {
    throw await errorFromResponse(response)
  }
  const ct = response.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const text = await response.text()
    if (!text.trim()) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return null
}

/** Authenticated GET returning raw bytes (e.g. logo preview). */
export async function apiGetBlob(path) {
  const headers = await mergeAuthHeaders({})
  const response = await fetch(apiUrl(path), { headers })
  if (!response.ok) {
    throw await errorFromResponse(response)
  }
  return response.blob()
}

/**
 * Typed error from failed API responses. `message` is user-facing (FastAPI `detail` when JSON).
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status HTTP status
   * @param {unknown} [raw] original parsed or text body
   */
  constructor(message, status, raw = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.raw = raw
  }
}

/**
 * @param {unknown} err
 * @returns {err is ApiError}
 */
export function isApiError(err) {
  return err instanceof ApiError
}

/**
 * Parse FastAPI-style JSON error bodies into a single message.
 * @param {string} text response body
 * @param {number} status
 */
export function messageFromErrorBody(text, status) {
  if (!text?.trim()) return `Request failed (${status})`
  try {
    const j = JSON.parse(text)
    if (typeof j.detail === 'string') return j.detail
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((d) => (typeof d === 'string' ? d : d?.msg ?? JSON.stringify(d)))
        .join('; ')
    }
    if (j.message && typeof j.message === 'string') return j.message
  } catch {
    /* not JSON */
  }
  return text.length > 500 ? `${text.slice(0, 500)}—` : text
}

/**
 * @param {Response} response
 * @returns {Promise<ApiError>}
 */
export async function errorFromResponse(response) {
  const text = await response.text()
  const msg = messageFromErrorBody(text, response.status)
  return new ApiError(msg, response.status, text)
}

export async function apiRequest(path, options = {}) {
  const { headers: optHeaders, ...rest } = options
  const headers = await mergeAuthHeaders(optHeaders)
  let response
  try {
    response = await fetch(apiUrl(path), { ...rest, headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    throw new ApiError(msg, 0, e)
  }
  if (!response.ok) {
    throw await errorFromResponse(response)
  }
  const ct = response.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const text = await response.text()
    if (!text.trim()) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return response.text()
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
  postMultipart: (path, formData) => apiPostMultipart(path, formData),
  getBlob: (path) => apiGetBlob(path),
}

export function withAdminHeader(headers = {}) {
  const key = getStoredAdminKey()
  return key ? { ...headers, 'X-Admin-Key': key } : headers
}
