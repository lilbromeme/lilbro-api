import { motion } from 'framer-motion'
import { Bitcoin, Coins, CreditCard } from 'lucide-react'
import { DRACO_CONFIG } from '../config/draco.ts'

const CRYPTO_ASSETS = ['BTC', 'ETH', 'USDC', 'USDT']

export default function DonatePage() {
  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] px-6 py-24">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-semibold">HELP A DOG</h1>
        <p className="mt-4 text-white/60">You don't need to own $DRACO to help.</p>
      </div>

      <div className="max-w-xl mx-auto mt-16 space-y-4">
        <DonateOption
          icon={Bitcoin}
          title="CRYPTO"
          description={CRYPTO_ASSETS.join(' · ')}
          enabled={DRACO_CONFIG.donations.cryptoEnabled}
        />
        <DonateOption
          icon={Coins}
          title="$DRACO"
          description="Donate $DRACO"
          enabled={DRACO_CONFIG.donations.dracoTokenEnabled}
        />
        <DonateOption
          icon={CreditCard}
          title="CARD"
          description="Donate with card"
          enabled={DRACO_CONFIG.donations.cardEnabled}
        />
      </div>

      <p className="max-w-xl mx-auto mt-12 text-center mono text-[10px] tracking-[0.15em] text-white/30">
        DONATION RAILS ARE NOT YET LIVE. THIS PAGE ACTIVATES ONCE A PAYMENT
        PROVIDER AND TREASURY WALLETS ARE CONFIGURED.
      </p>
    </div>
  )
}

function DonateOption({ icon: Icon, title, description, enabled }) {
  return (
    <motion.button
      whileHover={enabled ? { y: -3 } : undefined}
      disabled={!enabled}
      className={`w-full flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left transition ${
        enabled ? 'hover:bg-white/[0.06] cursor-pointer' : 'opacity-40 cursor-not-allowed'
      }`}
    >
      <div className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center shrink-0">
        <Icon size={20} strokeWidth={1.3} />
      </div>
      <div>
        <p className="mono text-[11px] tracking-[0.2em]">{title}</p>
        <p className="text-white/50 text-sm mt-1">{description}</p>
      </div>
      {!enabled && (
        <span className="ml-auto mono text-[9px] tracking-[0.15em] text-white/30">COMING SOON</span>
      )}
    </motion.button>
  )
}
