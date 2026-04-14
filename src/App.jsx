import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import AIStatusBar from './components/AIStatusBar'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Meetings from './pages/Meetings'
import MeetingDetail from './pages/MeetingDetail'
import Outreach from './pages/Outreach'
import CampaignDetail from './pages/CampaignDetail'
import Webhooks from './pages/Webhooks'
import WebhookDetail from './pages/WebhookDetail'
import Skills from './pages/Skills'
import Memory from './pages/Memory'
import AILog from './pages/AILog'
import Integrations from './pages/Integrations'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6 grid-bg">
      <div className="flex flex-col min-h-[calc(100vh-48px)] rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0A0A0F]">
        <AIStatusBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-10 py-8">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/meetings" element={<Meetings />} />
                <Route path="/meetings/:id" element={<MeetingDetail />} />
                <Route path="/outreach" element={<Outreach />} />
              <Route path="/outreach/campaign/:id" element={<CampaignDetail />} />
                <Route path="/webhooks" element={<Webhooks />} />
                <Route path="/webhooks/:id" element={<WebhookDetail />} />
                <Route path="/skills" element={<Skills />} />
                <Route path="/memory" element={<Memory />} />
                <Route path="/ai-log" element={<AILog />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}
