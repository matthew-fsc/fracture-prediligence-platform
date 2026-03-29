import { apiClient } from './apiClient'

const STORAGE_KEY = 'fracture_demo_access_token'

export function getDemoAccessToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setDemoAccessToken(token) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Headers to send when checking or using generic demo access (JWT from verify-access-code). */
export function demoAccessHeaders() {
  const t = getDemoAccessToken()
  return t ? { 'X-Demo-Access-Token': t } : {}
}

export async function fetchDemoAccessStatus() {
  const headers = demoAccessHeaders()
  return apiClient.get('/api/demo/access-status', Object.keys(headers).length ? { headers } : {})
}

export async function verifyDemoAccessCode(code) {
  return apiClient.post('/api/demo/verify-access-code', { code })
}
