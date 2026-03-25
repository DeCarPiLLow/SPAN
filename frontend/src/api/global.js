import api from './axios'

export const seedGlobalData     = ()  => api.post('/global/seed')
export const getMoodMeter       = ()  => api.get('/global/mood-meter')
export const getGenreHeatmap    = ()  => api.get('/global/genre-heatmap')
export const getShelfLife       = ()  => api.get('/global/shelf-life')
export const getArtistVelocity  = ()  => api.get('/global/artist-velocity')
