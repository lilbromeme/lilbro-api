// Notification fan-out — Telegram + Discord.
//
// RULE: this module is called ONLY after a database write has already
// confirmed the underlying event (a confirmed donation, a confirmed fee
// event, an achieved milestone, a published impact report). It never
// speculates or sends "pending" updates.

interface FundUpdateEvent {
  kind: 'fund_update'
  amountUsd: number
  source: string
  totalFundUsd: number
}

interface ImpactEvent {
  kind: 'impact'
  caseNumber: string
  purpose: string
  amountUsd: number
  proofUrl: string | null
}

interface MilestoneEvent {
  kind: 'milestone'
  pawNumber: string
  thresholdUsd: number
  type: string
}

export type NotifyEvent = FundUpdateEvent | ImpactEvent | MilestoneEvent

function formatUsd(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function formatMessage(event: NotifyEvent): string {
  switch (event.kind) {
    case 'fund_update':
      return [
        '🐾 DRACO FUND',
        `+${formatUsd(event.amountUsd)} received`,
        'Source:',
        event.source,
        'Total Fund:',
        formatUsd(event.totalFundUsd),
        '',
        'For Draco. For Every Dog.',
      ].join('\n')

    case 'impact':
      return [
        `🐾 DRACO IMPACT #${event.caseNumber}`,
        'A verified case has been funded.',
        'Purpose:',
        event.purpose,
        'Amount:',
        formatUsd(event.amountUsd),
        'Proof:',
        event.proofUrl ?? 'PLACEHOLDER',
      ].join('\n')

    case 'milestone':
      return [
        `🐾 PAW #${event.pawNumber}`,
        `The DRACO community has now generated ${formatUsd(event.thresholdUsd)} for the Fund.`,
        'One dog started this.',
        'The Pack keeps going.',
        'For Draco. ❤️',
      ].join('\n')
  }
}

export async function sendTelegram(event: NotifyEvent) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  if (!token || !chatId) {
    console.warn('[notify] Telegram not configured — skipping send.', event.kind)
    return { skipped: true }
  }

  const text = formatMessage(event)
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })

  if (!res.ok) {
    console.error('[notify] Telegram send failed', res.status, await res.text())
  }
  return { skipped: false, ok: res.ok }
}

export async function sendDiscord(event: NotifyEvent) {
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')
  if (!webhookUrl) {
    console.warn('[notify] Discord not configured — skipping send.', event.kind)
    return { skipped: true }
  }

  const content = formatMessage(event)
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
  })

  if (!res.ok) {
    console.error('[notify] Discord send failed', res.status, await res.text())
  }
  return { skipped: false, ok: res.ok }
}

export async function notifyAll(event: NotifyEvent) {
  const [telegram, discord] = await Promise.all([sendTelegram(event), sendDiscord(event)])
  return { telegram, discord }
}
