import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Login from './pages/Login'
import Callback from './pages/Callback'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import ListeningClock from './pages/Personal/ListeningClock'
import MoodRadar from './pages/Personal/MoodRadar'
import GenreEvolution from './pages/Personal/GenreEvolution'
import DiscoveryRatio from './pages/Personal/DiscoveryRatio'
import Personas from './pages/Personal/Personas'
import TopTracks from './pages/Personal/TopTracks'
import DecadeBreakdown from './pages/Personal/DecadeBreakdown'
import BpmEvolution from './pages/Personal/BpmEvolution'
import ListeningHistory from './pages/Personal/ListeningHistory'
import GlobalMoodMeter from './pages/Global/MoodMeter'
import ArtistVelocity from './pages/Global/ArtistVelocity'
import ShelfLife from './pages/Global/ShelfLife'
import MainstreamScore from './pages/Comparison/MainstreamScore'
import TasteTwin from './pages/Comparison/TasteTwin'
import MoodDelta from './pages/Comparison/MoodDelta'
import Receipt from './pages/Engagement/Receipt'
import Compatibility from './pages/Engagement/Compatibility'

function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.accessToken)
  return token ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index                         element={<Dashboard />} />
          <Route path="listening-clock"        element={<ListeningClock />} />
          <Route path="mood-radar"             element={<MoodRadar />} />
          <Route path="genre-evolution"        element={<GenreEvolution />} />
          <Route path="discovery"              element={<DiscoveryRatio />} />
          <Route path="persona"                element={<Personas />} />
          <Route path="top-tracks"             element={<TopTracks />} />
          <Route path="decade"                 element={<DecadeBreakdown />} />
          <Route path="bpm"                    element={<BpmEvolution />} />
          <Route path="history"                element={<ListeningHistory />} />
          <Route path="global-mood"            element={<GlobalMoodMeter />} />
          <Route path="artist-velocity"        element={<ArtistVelocity />} />
          <Route path="shelf-life"             element={<ShelfLife />} />
          <Route path="mainstream"             element={<MainstreamScore />} />
          <Route path="taste-twin"             element={<TasteTwin />} />
          <Route path="mood-delta"             element={<MoodDelta />} />
          <Route path="receipt"                element={<Receipt />} />
          <Route path="compatibility"          element={<Compatibility />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}