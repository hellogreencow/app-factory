import { useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Studio } from '@/pages/Studio'
import { Apps } from '@/pages/Apps'
import { History } from '@/pages/History'
import { Profile } from '@/pages/Profile'
import { useSocket } from '@/hooks/useSocket'
import { useAppStore } from '@/hooks/useAppStore'
import { api } from '@/lib/api'
import type { ServerEvent } from '@/types/events'

function AppInner() {
  const handleEvent = useAppStore((s) => s.handleEvent)
  const setUser = useAppStore((s) => s.setUser)
  const setConnected = useAppStore((s) => s.setConnected)
  const setPreview = useAppStore((s) => s.setPreview)

  const onEvent = useCallback(
    (event: ServerEvent) => handleEvent(event),
    [handleEvent]
  )

  const { connected } = useSocket(onEvent)

  useEffect(() => {
    setConnected(connected)
  }, [connected, setConnected])

  useEffect(() => {
    api.auth.me().then(({ user }) => {
      if (user) setUser(user)
    }).catch(() => {})

    api.preview.status().then((status) => {
      if (status.active) {
        setPreview({
          active: true,
          slug: status.slug,
          url: status.url,
          webUrl: status.webUrl,
          qrDataUrl: status.qrDataUrl,
        })
      }
    }).catch(() => {})
  }, [setUser, setPreview])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Studio />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
