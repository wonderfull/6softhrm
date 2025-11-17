// API Configuration
// In production, VITE_API_URL should be set to your Railway backend URL
// Example: https://your-app.up.railway.app/api
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

type ReqInit = RequestInit & { query?: Record<string, any> }

function buildQuery(q?: Record<string, any>) {
  if (!q) return ''
  const params = new URLSearchParams()
  Object.entries(q).forEach(([k, v]) => params.set(k, String(v)))
  return `?${params.toString()}`
}

export async function api(path: string, init?: ReqInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = `${API_BASE_URL}${path}${buildQuery(init?.query)}`
  const res = await fetch(url, { ...(init || {}), headers })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `API error ${res.status}`)
  }
  return res.json()
}

export const apiGet = (p: string, q?: Record<string, any>) => api(p, { method: 'GET', query: q })
export const apiPost = (p: string, body?: any) => api(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json' } })
export const apiPut = (p: string, body?: any) => api(p, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json' } })
export const apiDelete = (p: string) => api(p, { method: 'DELETE' })

export function getCurrentUser() {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const json = JSON.parse(decodeURIComponent(atob(payload.replace(/-/g, '+').replace(/_/g, '/')).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join('')))
    return json
  } catch (e) {
    return null
  }
}
