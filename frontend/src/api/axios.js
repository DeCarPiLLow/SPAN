import axios from 'axios'

// In local dev: VITE_API_BASE_URL is empty → Vite proxies /api → localhost:5000
// In Docker:    VITE_API_BASE_URL=/api baked at build time
const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const res = await axios.post(`${BASE}/auth/token/refresh`, {}, {
            headers: { Authorization: `Bearer ${refresh}` },
          })
          const newToken = res.data.access_token
          localStorage.setItem('access_token', newToken)
          original.headers.Authorization = `Bearer ${newToken}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
