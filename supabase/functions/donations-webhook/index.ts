// DRACO OS — donations-webhook
//
// Receives server-to-server webhooks from the donation provider (crypto
// payment processor, card processor, etc.) — NEVER accepts a donation
// amount reported directly by the browser. The frontend only ever
// initiates a checkout session; the provider's signed webhook is the only
// source of truth for "a donation actually happened and for how much".
//
// Flow: receive -> verify signature -> validate payload -> dedupe by
// provider payment id -> insert donation -> update treasury -> check
// milestones -> notify.

import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { checkMilestones } from '../_shared/milestones.ts'
import { notifyAll } from '../_shared/notify.ts'
import { handleOptions, corsHeaders } from '../_shared/cors.ts'

interface DonationWebhookPayload {
  provider_payment_id: string
  asset: string
  network: string
  amount: number
  usd_value?: number
  tx_hash?: string
  wallet_address?: string
  source: 'crypto' | 'draco_token' | 'card' | 'other'
  anonymous?: boolean
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('DONATION_PROVIDER_WEBHOOK_SECRET')
  if (!secret) {
    console.warn('[donations-webhook] DONATION_PROVIDER_WEBHOOK_SECRET not set — rejecting all webhooks.')
    return false
  }

  const signatureHeader = req.headers.get('x-donation-signature')
  if (!signatureHeader) return false

  // HMAC-SHA256 over the raw body, hex-encoded — adjust to match whichever
  // provider is chosen; this is the common baseline pattern (Stripe,
  // Coinbase Commerce, etc. all use some HMAC-over-raw-body variant).
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const computedHex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return timingSafeEqual(computedHex, signatureHeader)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

function isValidPayload(body: unknown): body is DonationWebhookPayload {
  if (!body || typeof body !== 'object') return false
  const p = body as Record<string, unknown>
  return (
    typeof p.provider_payment_id === 'string' &&
    typeof p.asset === 'string' &&
    typeof p.network === 'string' &&
    typeof p.amount === 'number' &&
    p.amount > 0 &&
    typeof p.source === 'string' &&
    ['crypto', 'draco_token', 'card', 'other'].includes(p.source as string)
  )
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const rawBody = await req.text()

  const signatureValid = await verifySignature(req, rawBody)
  if (!signatureValid) {
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  if (!isValidPayload(body)) {
    return new Response(JSON.stringify({ error: 'invalid payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const supabase = getSupabaseAdmin()

  // Dedupe on the provider's own payment id (stored in tx_hash for crypto
  // rails, or as a synthetic key for card rails) — this is what prevents
  // a retried webhook delivery from being counted twice.
  const dedupeKey = body.tx_hash ?? body.provider_payment_id
  const { data: existing } = await supabase
    .from('donations')
    .select('id')
    .eq('tx_hash', dedupeKey)
    .maybeSingle()

  if (existing) {
    return new Response(JSON.stringify({ status: 'duplicate', donation_id: existing.id }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const { data: donation, error: insertError } = await supabase
    .from('donations')
    .insert({
      anonymous: body.anonymous ?? true,
      asset: body.asset,
      network: body.network,
      amount: body.amount,
      usd_value: body.usd_value ?? null,
      tx_hash: dedupeKey,
      wallet_address: body.wallet_address ?? null,
      status: 'confirmed',
      source: body.source,
      confirmed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError) {
    console.error('[donations-webhook] insert failed', insertError)
    return new Response(JSON.stringify({ error: 'insert failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  await supabase.from('treasury_transactions').insert({
    tx_hash: body.tx_hash ?? null,
    network: body.network,
    direction: 'IN',
    wallet: 'PLACEHOLDER',
    asset: body.asset,
    amount: body.amount,
    usd_value: body.usd_value ?? null,
    category: 'DIRECT_DONATION',
    description: `Donation via ${body.source}`,
    status: 'confirmed',
  })

  await checkMilestones(supabase, 'DONATIONS')
  await checkMilestones(supabase, 'FUND')

  await notifyAll({
    kind: 'fund_update',
    amountUsd: body.usd_value ?? body.amount,
    source: `Direct donation (${body.source})`,
    totalFundUsd: 0,
  })

  return new Response(JSON.stringify({ status: 'ok', donation_id: donation.id }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
})
