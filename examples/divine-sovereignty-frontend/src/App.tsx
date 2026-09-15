import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

type Offering = {
  id: string
  name: string
  description: string
  price_cents: number
}

type OffersResponse = {
  currency: string
  offers: Offering[]
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

const FALLBACK_OFFERS: Offering[] = [
  {
    id: 'alignment-ebook',
    name: 'Divine Alignment eBook',
    description: 'A practical guide to living in alignment with spiritual sovereignty.',
    price_cents: 2900,
  },
  {
    id: 'sovereignty-session',
    name: 'Sovereignty Session',
    description: 'A one-time 60-minute private strategy and integration session.',
    price_cents: 12500,
  },
  {
    id: 'equilibrium-audio-pack',
    name: 'Equilibrium Audio Pack',
    description: 'Guided contemplative tracks tuned for restorative focus.',
    price_cents: 4900,
  },
]

const PHILOSOPHY = [
  {
    title: 'Divine Alignment',
    body: 'Live from inner coherence. Align thought, word, and action with the values that make you trustworthy to yourself.',
  },
  {
    title: 'Sovereignty',
    body: 'Own your attention, choices, and boundaries. Sovereignty is calm responsibility — not isolation or dominance.',
  },
  {
    title: 'Equilibrium',
    body: 'Hold intensity without collapse. Equilibrium is the practice of returning to center when life pulls you off course.',
  },
]

const AUDIENCE = [
  'Seekers who want spiritual depth without performance or hype',
  'Builders and leaders who need grounded clarity under pressure',
  'Supporters ready to invest in one-time offerings or give freely',
]

function formatMoney(cents: number, currency = 'usd') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function useFadeIn() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.fade-in'))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Request failed'
    throw new Error(detail)
  }
  return data as T
}

export default function App() {
  useFadeIn()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioOn, setAudioOn] = useState(false)
  const [offers, setOffers] = useState<Offering[]>(FALLBACK_OFFERS)
  const [currency, setCurrency] = useState('usd')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [donateAmount, setDonateAmount] = useState('25')
  const [donateEmail, setDonateEmail] = useState('')
  const [mailEmail, setMailEmail] = useState('')
  const [mailName, setMailName] = useState('')
  const [enterprise, setEnterprise] = useState({
    name: '',
    email: '',
    organization: '',
    budget_range: '',
    message: '',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/config/offers`)
        if (!response.ok) return
        const data = (await response.json()) as OffersResponse
        if (!cancelled && data.offers?.length) {
          setOffers(data.offers)
          setCurrency(data.currency || 'usd')
        }
      } catch {
        // Keep fallback offerings when API is offline.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (checkout === 'success') setStatus('Payment received. Thank you for supporting the work.')
    if (checkout === 'cancel') setStatus('Checkout canceled. No charge was made.')
  }, [])

  const quickDonate = useMemo(() => [11, 28, 54, 108], [])

  async function toggleAudio() {
    const audio = audioRef.current
    if (!audio) return
    try {
      if (audioOn) {
        audio.pause()
        setAudioOn(false)
      } else {
        audio.loop = true
        audio.volume = 0.25
        await audio.play()
        setAudioOn(true)
      }
    } catch {
      setStatus('Audio playback was blocked by the browser. Try again after interacting with the page.')
    }
  }

  async function startCheckout(offeringId: string) {
    setBusy(`checkout-${offeringId}`)
    setStatus(null)
    try {
      const result = await postJson<{ checkout_url: string }>('/api/payments/checkout', {
        offering_id: offeringId,
      })
      window.location.href = result.checkout_url
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start checkout.')
    } finally {
      setBusy(null)
    }
  }

  async function startDonation(event: FormEvent) {
    event.preventDefault()
    const dollars = Number(donateAmount)
    if (!Number.isFinite(dollars) || dollars < 1) {
      setStatus('Enter a donation of at least $1.')
      return
    }
    setBusy('donate')
    setStatus(null)
    try {
      const result = await postJson<{ checkout_url: string }>('/api/payments/donate', {
        amount_cents: Math.round(dollars * 100),
        email: donateEmail || undefined,
      })
      window.location.href = result.checkout_url
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start donation.')
    } finally {
      setBusy(null)
    }
  }

  async function subscribe(event: FormEvent) {
    event.preventDefault()
    setBusy('subscribe')
    setStatus(null)
    try {
      const result = await postJson<{ message: string }>('/api/mail/subscribe', {
        email: mailEmail,
        name: mailName || undefined,
      })
      setStatus(result.message)
      setMailEmail('')
      setMailName('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to subscribe.')
    } finally {
      setBusy(null)
    }
  }

  async function submitEnterprise(event: FormEvent) {
    event.preventDefault()
    setBusy('enterprise')
    setStatus(null)
    try {
      const result = await postJson<{ message: string }>('/api/contact/enterprise', enterprise)
      setStatus(result.message)
      setEnterprise({ name: '', email: '', organization: '', budget_range: '', message: '' })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to send inquiry.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen">
      <audio ref={audioRef} src="/ambient-528hz.wav" preload="none" />

      <header className="sticky top-0 z-20 border-b border-gold-soft/10 bg-indigo-deep/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <a href="#top" className="font-serif text-xl text-gold-bright md:text-2xl">
            Divine Sovereignty
          </a>
          <nav className="hidden items-center gap-6 text-sm text-cream/80 md:flex">
            <a href="#philosophy" className="hover:text-gold-soft">
              Philosophy
            </a>
            <a href="#offerings" className="hover:text-gold-soft">
              Offerings
            </a>
            <a href="#donate" className="hover:text-gold-soft">
              Donate
            </a>
            <a href="#enterprise" className="hover:text-gold-soft">
              Enterprise
            </a>
          </nav>
          <button type="button" className="btn-secondary px-4 py-2 text-xs" onClick={toggleAudio}>
            {audioOn ? 'Pause 528Hz' : 'Play 528Hz'}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="section-pad relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(240,215,140,0.12),transparent_35%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="fade-in">
              <p className="mb-4 text-sm uppercase tracking-[0.25em] text-gold-soft">Personal brand landing</p>
              <h1 className="max-w-3xl text-4xl leading-tight text-cream md:text-6xl">
                Align with truth. Own your path. Return to equilibrium.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cream/75">
                Divine Sovereignty is a calm invitation into spiritual clarity — for people who want depth without noise,
                and action without force.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a className="btn-primary" href="#offerings">
                  Explore offerings
                </a>
                <a className="btn-secondary" href="#donate">
                  Support the work
                </a>
              </div>
            </div>
            <div className="fade-in card">
              <h2 className="text-2xl text-gold-bright">Day-one journey</h2>
              <ol className="mt-4 space-y-3 text-cream/80">
                <li>1. Arrive and absorb the core message</li>
                <li>2. Optionally enable gentle 528Hz ambient sound</li>
                <li>3. Choose: donate, purchase, or join the list</li>
              </ol>
            </div>
          </div>
        </section>

        {status ? (
          <div className="mx-auto max-w-6xl px-6">
            <div className="rounded-xl border border-gold-soft/30 bg-indigo-mist/40 px-4 py-3 text-sm text-gold-bright" role="status">
              {status}
            </div>
          </div>
        ) : null}

        <section id="philosophy" className="section-pad">
          <div className="mx-auto max-w-6xl">
            <div className="fade-in mb-10 max-w-2xl">
              <h2 className="text-3xl text-gold-bright md:text-4xl">Philosophy</h2>
              <p className="mt-3 text-cream/70">
                Three simple pillars — plain language, no jargon theater.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {PHILOSOPHY.map((item) => (
                <article key={item.title} className="fade-in card">
                  <h3 className="text-2xl text-gold-soft">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-cream/75">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="audience" className="section-pad pt-0">
          <div className="fade-in mx-auto max-w-6xl card">
            <h2 className="text-3xl text-gold-bright">Who this is for</h2>
            <ul className="mt-5 grid gap-3 md:grid-cols-3">
              {AUDIENCE.map((item) => (
                <li key={item} className="rounded-xl border border-gold-soft/15 bg-indigo-deep/40 p-4 text-cream/80">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="offerings" className="section-pad">
          <div className="mx-auto max-w-6xl">
            <div className="fade-in mb-10">
              <h2 className="text-3xl text-gold-bright md:text-4xl">One-time offerings</h2>
              <p className="mt-3 max-w-2xl text-cream/70">
                Simple purchases. No subscriptions in v1 — just clear value when you are ready.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {offers.map((offer) => (
                <article key={offer.id} className="fade-in card flex flex-col">
                  <h3 className="text-2xl text-cream">{offer.name}</h3>
                  <p className="mt-3 flex-1 text-cream/70">{offer.description}</p>
                  <p className="mt-5 text-xl text-gold-bright">{formatMoney(offer.price_cents, currency)}</p>
                  <button
                    type="button"
                    className="btn-primary mt-5 w-full"
                    disabled={busy === `checkout-${offer.id}`}
                    onClick={() => startCheckout(offer.id)}
                  >
                    {busy === `checkout-${offer.id}` ? 'Redirecting…' : 'Buy now'}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="donate" className="section-pad pt-0">
          <div className="fade-in mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            <form className="card" onSubmit={startDonation}>
              <h2 className="text-3xl text-gold-bright">Donate</h2>
              <p className="mt-2 text-cream/70">Flexible amount with one-tap options. Powered by Stripe.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {quickDonate.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="btn-secondary px-4 py-2 text-xs"
                    onClick={() => setDonateAmount(String(amount))}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <label className="label mt-5" htmlFor="donate-amount">
                Amount (USD)
              </label>
              <input
                id="donate-amount"
                className="input"
                type="number"
                min="1"
                step="1"
                value={donateAmount}
                onChange={(event) => setDonateAmount(event.target.value)}
                required
              />
              <label className="label mt-4" htmlFor="donate-email">
                Email (optional)
              </label>
              <input
                id="donate-email"
                className="input"
                type="email"
                value={donateEmail}
                onChange={(event) => setDonateEmail(event.target.value)}
                placeholder="you@example.com"
              />
              <button type="submit" className="btn-primary mt-6 w-full" disabled={busy === 'donate'}>
                {busy === 'donate' ? 'Redirecting…' : 'Donate once'}
              </button>
            </form>

            <form className="card" onSubmit={subscribe}>
              <h2 className="text-3xl text-gold-bright">Mailing list</h2>
              <p className="mt-2 text-cream/70">Occasional notes. No spam. Unsubscribe anytime.</p>
              <label className="label mt-5" htmlFor="mail-name">
                Name (optional)
              </label>
              <input
                id="mail-name"
                className="input"
                value={mailName}
                onChange={(event) => setMailName(event.target.value)}
              />
              <label className="label mt-4" htmlFor="mail-email">
                Email
              </label>
              <input
                id="mail-email"
                className="input"
                type="email"
                required
                value={mailEmail}
                onChange={(event) => setMailEmail(event.target.value)}
              />
              <button type="submit" className="btn-primary mt-6 w-full" disabled={busy === 'subscribe'}>
                {busy === 'subscribe' ? 'Saving…' : 'Join the list'}
              </button>
            </form>
          </div>
        </section>

        <section id="vision" className="section-pad">
          <div className="fade-in mx-auto max-w-6xl card">
            <h2 className="text-3xl text-gold-bright md:text-4xl">Founder vision</h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-cream/75">
              This page is intentionally lean: a clear message, a few honest offerings, and room for real conversation.
              Community platforms and course systems can come later. Day one is presence, support, and relationship.
            </p>
          </div>
        </section>

        <section id="enterprise" className="section-pad pt-0">
          <form className="fade-in mx-auto max-w-6xl card" onSubmit={submitEnterprise}>
            <h2 className="text-3xl text-gold-bright">Enterprise & investment</h2>
            <p className="mt-2 max-w-2xl text-cream/70">
              For organizations and partners exploring serious collaboration. Submissions are stored and emailed to the
              steward contact.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="ent-name">
                  Name
                </label>
                <input
                  id="ent-name"
                  className="input"
                  required
                  value={enterprise.name}
                  onChange={(event) => setEnterprise((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="ent-email">
                  Email
                </label>
                <input
                  id="ent-email"
                  className="input"
                  type="email"
                  required
                  value={enterprise.email}
                  onChange={(event) => setEnterprise((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="ent-org">
                  Organization
                </label>
                <input
                  id="ent-org"
                  className="input"
                  value={enterprise.organization}
                  onChange={(event) => setEnterprise((prev) => ({ ...prev, organization: event.target.value }))}
                />
              </div>
              <div>
                <label className="label" htmlFor="ent-budget">
                  Budget range
                </label>
                <input
                  id="ent-budget"
                  className="input"
                  placeholder="e.g. exploring / under 10k / 10k+"
                  value={enterprise.budget_range}
                  onChange={(event) => setEnterprise((prev) => ({ ...prev, budget_range: event.target.value }))}
                />
              </div>
            </div>
            <label className="label mt-4" htmlFor="ent-message">
              Message
            </label>
            <textarea
              id="ent-message"
              className="input min-h-32"
              required
              minLength={10}
              value={enterprise.message}
              onChange={(event) => setEnterprise((prev) => ({ ...prev, message: event.target.value }))}
            />
            <button type="submit" className="btn-primary mt-6" disabled={busy === 'enterprise'}>
              {busy === 'enterprise' ? 'Sending…' : 'Send inquiry'}
            </button>
          </form>
        </section>
      </main>

      <footer className="border-t border-gold-soft/10 px-6 py-10">
        <div className="mx-auto max-w-6xl text-sm leading-relaxed text-cream/60">
          <p className="font-serif text-lg text-gold-soft">Divine Sovereignty</p>
          <p className="mt-3 max-w-3xl">
            Content on this site is spiritual and educational. It is not financial, legal, medical, or investment advice.
            You are responsible for your own decisions and well-being.
          </p>
          <p className="mt-4">© {new Date().getFullYear()} Divine Sovereignty. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
