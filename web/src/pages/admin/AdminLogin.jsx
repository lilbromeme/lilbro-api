import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient.ts'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <p className="mono text-[11px] tracking-[0.25em] text-white/40 text-center">DRACO OS // ADMIN</p>
        <input
          type="email"
          required
          placeholder="admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-white/[0.03] px-4 py-3 text-sm outline-none focus:border-white/40"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-[#f5f3ee] text-[#08090a] py-3 text-sm font-medium tracking-wide"
        >
          Send magic link
        </button>
        {sent && <p className="text-center text-sm text-white/60">Check your email for a sign-in link.</p>}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </form>
    </div>
  )
}
