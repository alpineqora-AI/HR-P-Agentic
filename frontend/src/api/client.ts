import axios from 'axios'

// TA Portal backend. Base URL is overridable via VITE_API_BASE_URL; defaults to
// the local Spring Boot instance (port 8092, all routes under /v1).
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8092/v1',
})

const USER_KEY = 'taportal.userId'

export function getActingUserId(): string | null {
  try {
    // ?as=<userId> sets the acting user (dev convenience), remembered in localStorage.
    const as = new URLSearchParams(window.location.search).get('as')
    if (as) localStorage.setItem(USER_KEY, as)
    return localStorage.getItem(USER_KEY)
  } catch {
    return null
  }
}

export function setActingUserId(id: string) {
  try {
    localStorage.setItem(USER_KEY, id)
  } catch {
    /* ignore */
  }
}

// POC "acting as": tell the backend which user this request is for (real SSO replaces this).
api.interceptors.request.use((config) => {
  const id = getActingUserId()
  if (id) config.headers['X-User-Id'] = id
  return config
})
