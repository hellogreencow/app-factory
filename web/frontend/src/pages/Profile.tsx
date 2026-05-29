import { useState } from 'react'
import { User, LogOut, Shield, Zap, Crown, Loader2 } from 'lucide-react'
import { useAppStore } from '@/hooks/useAppStore'
import { api } from '@/lib/api'

const tierConfig = {
  free: { icon: User, color: 'text-text-secondary', label: 'Free', limit: '3 builds/month' },
  premium: { icon: Zap, color: 'text-accent', label: 'Premium', limit: '20 builds/month' },
  genius: { icon: Crown, color: 'text-warning', label: 'Genius', limit: 'Unlimited' },
}

export function Profile() {
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)

  if (!user) return <AuthForm />

  const tier = tierConfig[user.tier] || tierConfig.free
  const TierIcon = tier.icon

  const handleLogout = async () => {
    await api.auth.logout()
    setUser(null)
  }

  return (
    <div className="overflow-y-auto p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center">
          <User size={20} className="text-text-secondary" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-white">{user.name || user.email}</h2>
          <p className="text-xs text-text-tertiary">{user.email}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <div className="flex items-center gap-2 mb-3">
            <TierIcon size={16} className={tier.color} />
            <span className="text-sm font-medium text-white">{tier.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-tertiary">Credits remaining</span>
            <span className="text-sm font-mono text-white">{user.credits}</span>
          </div>
          <p className="text-[10px] text-text-tertiary mt-1">{tier.limit}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-text-tertiary" />
            <span className="text-xs font-medium text-text-secondary">Security</span>
          </div>
          <p className="text-[10px] text-text-tertiary">
            Sessions are encrypted. API keys stored server-side only.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:text-error hover:border-error/30 transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  )
}

function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useAppStore((s) => s.setUser)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = mode === 'login'
        ? await api.auth.login(email, password)
        : await api.auth.signup(email, password, name || undefined)
      setUser(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h2 className="text-lg font-medium text-white text-center">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h2>

        {mode === 'signup' && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-text-tertiary outline-none focus:border-text-tertiary transition-colors"
          />
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-text-tertiary outline-none focus:border-text-tertiary transition-colors"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full bg-surface-raised border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-text-tertiary outline-none focus:border-text-tertiary transition-colors"
        />

        {error && <p className="text-xs text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : mode === 'login' ? 'Sign in' : 'Sign up'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          className="w-full text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
