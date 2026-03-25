import api from './axios'

export const getNowPlaying = ()             => api.get('/player/now-playing')
export const getQueue      = ()             => api.get('/player/queue')
export const pause         = ()             => api.post('/player/pause')
export const play          = (body = {})    => api.post('/player/play', body)
export const next          = ()             => api.post('/player/next')
export const prev          = ()             => api.post('/player/prev')
export const seek          = (position_ms)  => api.post('/player/seek', { position_ms })
export const setVolume     = (vol)          => api.post('/player/volume', { volume_percent: vol })
export const setShuffle    = (state)        => api.post('/player/shuffle', { state })
export const setRepeat     = (state)        => api.post('/player/repeat', { state })
