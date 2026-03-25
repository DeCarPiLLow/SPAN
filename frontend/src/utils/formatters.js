export function fmtMs(ms) {
  if (!ms) return '0:00'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2,'0')}`
}

export function fmtNum(n) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`
  return String(n)
}

export function fmtPct(v, decimals = 1) {
  return `${(v * 100).toFixed(decimals)}%`
}

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

export function hourLabel(h) {
  if (h === 0)  return '12am'
  if (h < 12)   return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}
