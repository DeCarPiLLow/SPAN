import api from './axios'

export const getMainstreamScore = () => api.get('/compare/mainstream-score')
export const getTasteTwin       = () => api.get('/compare/taste-twin')
export const getMoodDelta       = () => api.get('/compare/mood-delta')
export const getCompatibility   = (partner_spotify_id) =>
  api.post('/engage/compatibility', { partner_spotify_id })
export const getReceipt         = () => api.get('/engage/receipt')
