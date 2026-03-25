import { create } from 'zustand'

const useAnalyticsStore = create((set) => ({
  listeningClock:  null,
  moodRadar:       null,
  discoveryRatio:  null,
  genreEvolution:  null,
  persona:         null,
  topTracks:       null,
  topArtists:      null,
  mainstreamScore: null,
  moodDelta:       null,
  decadeBreakdown: null,
  bpmEvolution:    null,

  set: (key, value) => set({ [key]: value }),
  reset: () => set({
    listeningClock: null, moodRadar: null, discoveryRatio: null,
    genreEvolution: null, persona: null, topTracks: null,
    topArtists: null, mainstreamScore: null, moodDelta: null,
    decadeBreakdown: null, bpmEvolution: null,
  }),
}))

export default useAnalyticsStore
