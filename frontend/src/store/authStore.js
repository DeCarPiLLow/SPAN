import { create } from 'zustand'

const useAuthStore = create((set, get) => ({
  user:          null,
  accessToken:   localStorage.getItem('access_token') || null,
  refreshToken:  localStorage.getItem('refresh_token') || null,
  isLoading:     false,

  setTokens: (access, refresh) => {
    localStorage.setItem('access_token', access)
    if (refresh) localStorage.setItem('refresh_token', refresh)
    set({ accessToken: access, refreshToken: refresh || get().refreshToken })
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, accessToken: null, refreshToken: null })
  },

  setLoading: (v) => set({ isLoading: v }),
}))

export default useAuthStore
