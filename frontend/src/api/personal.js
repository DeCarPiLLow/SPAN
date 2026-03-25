import api from './axios'

export const syncData          = ()       => api.post('/me/sync')
export const getListeningClock = ()       => api.get('/me/listening-clock')
export const getMoodRadar      = ()       => api.get('/me/mood-radar')
export const getDiscovery      = ()       => api.get('/me/discovery-ratio')
export const getGenreEvolution = (range='daily') => api.get(`/me/genre-evolution?range=${range}`)
export const getPersona        = ()       => api.get('/me/persona')
export const getTopTracks      = (range)  => api.get(`/me/top-tracks?range=${range}`)
export const getTopArtists     = (range)  => api.get(`/me/top-artists?range=${range}`)
export const getBpmEvolution   = ()       => api.get('/me/bpm-evolution')
export const getDecadeBreakdown= ()       => api.get('/me/decade-breakdown')
export const getListeningHistory = (hours)=> api.get(`/me/history?hours=${hours}`)
