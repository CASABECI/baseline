import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

type Offering = {
  id: string
  name: string
  description: string
  price_cents: number
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:8000'

const fallbackOfferings: Offering[] = [
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

const philosophy = [
  {
    title: 'Divine Alignment',
    body: 'Align your actions with what is true, intentional, and life-giving rather than reactive pressure.',
  },
  {
    title: 'Sovereignty',
    body: 'Reclaim personal agency so your decisions come from discernment, not noise.',
  },
  {
    title: 'Equilibrium',
    body: 'Build sustainable inner and outer balance that supports service, impact, and peace.',
  },
]

function App() {
  const [offerings, setOfferings] = useState<Offering[]>(fallbackOfferings)
  const [isAudioOn, setIsAudioOn] = useState(false)
  const [status, setStatus] = useState('')
  const [isPaying, setIsPaying] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [contactStatus, setContactStatus] = useState('')
  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  useEffect(() => {
    const fadeElements = document.querySelectorAll<HTMLElement>('[data-fade]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.2 },
    )

    fadeElements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/config/offers`)
      .then(async (response) => {
        if (!response.ok) {
          return
        }
        const payload = (await response.json()) as { offerings?: Offering[] }
        if (payload.offerings?.length) {
          setOfferings(payload.offerings)
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    return () => {
      oscillatorRef.current?.stop()
      audioCtxRef.current?.close().catch(() => undefined)
    }
  }, [])

  const toggleAudio = () => {
    if (isAudioOn) {
      oscillatorRef.current?.stop()
      oscillatorRef.current = null
      setIsAudioOn(false)
      return
    }

    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) {
      setStatus('Audio is not supported in this browser.')
      return
    }

    const context = audioCtxRef.current ?? new AudioCtx()
    audioCtxRef.current = context
    const oscillator = context.createOscillator()
    const gainNode = gainRef.current ?? context.createGain()
    gainRef.current = gainNode

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(528, context.currentTime)
    gainNode.gain.setValueAtTime(0.03, context.currentTime)
    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.start()
    oscillatorRef.current = oscillator
    setIsAudioOn(true)
  }

  const startCheckout = async (
    endpoint: '/api/payments/donate' | '/api/payments/checkout',
    payload: Record<string, unknown>,
  ) => {
    setIsPaying(true)
    setStatus('')
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as { url?: string; detail?: string }
      if (!response.ok || !data.url) {
        throw new Error(data.detail ?? 'Unable to create checkout session.')
      }
      window.location.href = data.url
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to connect to checkout.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleMailingList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEmailStatus('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/mail/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = (await response.json()) as { message?: string; detail?: string }
      if (!response.ok) {
        throw new Error(data.detail ?? 'Subscription failed.')
      }
      setEmail('')
      setEmailStatus(data.message ?? 'Subscribed.')
    } catch (error) {
      setEmailStatus(error instanceof Error ? error.message : 'Subscription failed.')
    }
  }

  const handleEnterpriseContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const payload = Object.fromEntries(formData.entries())
    setContactStatus('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/enterprise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as { message?: string; detail?: string }
      if (!response.ok) {
        throw new Error(data.detail ?? 'Unable to submit inquiry.')
      }
      event.currentTarget.reset()
      setContactStatus(data.message ?? 'Inquiry submitted.')
    } catch (error) {
      setContactStatus(error instanceof Error ? error.message : 'Unable to submit inquiry.')
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-10 md:px-10 md:py-16">
      <section
        className="rounded-3xl border border-gold-300/30 bg-indigo-900/70 p-8 shadow-aura backdrop-blur md:p-12"
        data-fade
      >
        <p className="font-heading text-xl text-gold-200">Divine Sovereignty</p>
        <h1 className="mt-3 font-heading text-4xl leading-tight text-amber-50 md:text-6xl">
          Live in alignment. Lead with sovereignty. Return to equilibrium.
        </h1>
        <p className="mt-5 max-w-3xl text-base text-amber-100/90 md:text-lg">
          A calm space for spiritual and practical transformation through clear philosophy,
          intentional offerings, and aligned support.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => startCheckout('/api/payments/donate', { amount_cents: 2500 })}
            disabled={isPaying}
            className="rounded-full bg-gold-300 px-6 py-3 font-semibold text-indigo-950 transition hover:bg-gold-200 disabled:opacity-70"
          >
            {isPaying ? 'Preparing...' : 'Donate'}
          </button>
          <a
            href="#offerings"
            className="rounded-full border border-gold-300 px-6 py-3 font-semibold text-gold-200 transition hover:bg-gold-300/10"
          >
            Explore Offerings
          </a>
          <button
            type="button"
            onClick={toggleAudio}
            className="rounded-full border border-amber-100/40 px-6 py-3 text-amber-100 transition hover:bg-white/10"
          >
            {isAudioOn ? 'Pause 528Hz Ambient Audio' : 'Play 528Hz Ambient Audio'}
          </button>
        </div>
        {status && <p className="mt-4 text-sm text-gold-200">{status}</p>}
      </section>

      <section className="grid gap-6 md:grid-cols-3" data-fade>
        {philosophy.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-amber-200/20 bg-indigo-900/50 p-6"
          >
            <h2 className="font-heading text-3xl text-gold-200">{item.title}</h2>
            <p className="mt-3 text-amber-100/90">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 rounded-3xl border border-gold-300/20 p-8 md:grid-cols-2" data-fade>
        <div>
          <h2 className="font-heading text-4xl text-gold-200">Who this is for</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-amber-100/90">
            <li>First-time seekers exploring your teaching.</li>
            <li>Existing supporters ready to contribute or purchase.</li>
            <li>Enterprise and investment partners seeking strategic alignment.</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-indigo-800/60 p-6">
          <h3 className="font-heading text-3xl text-gold-200">Day-one path</h3>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-amber-100/90">
            <li>Absorb the message and philosophy.</li>
            <li>Choose your next step: donate, buy, or subscribe.</li>
            <li>Connect directly for deeper enterprise conversations.</li>
          </ol>
        </div>
      </section>

      <section id="offerings" data-fade>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-heading text-4xl text-gold-200">One-time offerings</h2>
          <p className="text-sm text-amber-100/80">Secure one-time checkout via Stripe</p>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {offerings.map((offering) => (
            <article
              key={offering.id}
              className="flex h-full flex-col rounded-2xl border border-gold-300/20 bg-indigo-900/50 p-6"
            >
              <h3 className="font-heading text-3xl text-amber-50">{offering.name}</h3>
              <p className="mt-3 grow text-amber-100/90">{offering.description}</p>
              <p className="mt-6 text-2xl font-semibold text-gold-200">
                ${(offering.price_cents / 100).toFixed(2)}
              </p>
              <button
                type="button"
                onClick={() =>
                  startCheckout('/api/payments/checkout', { offering_id: offering.id })
                }
                disabled={isPaying}
                className="mt-4 rounded-full bg-gold-400 px-5 py-2.5 font-semibold text-indigo-950 transition hover:bg-gold-300 disabled:opacity-70"
              >
                Buy now
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-gold-300/20 p-8 md:grid-cols-2" data-fade>
        <article className="rounded-2xl bg-indigo-900/60 p-6">
          <h2 className="font-heading text-4xl text-gold-200">Support through donation</h2>
          <p className="mt-3 text-amber-100/90">
            Choose a one-tap amount or enter your own value and support this mission directly.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {[500, 2500, 10000].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => startCheckout('/api/payments/donate', { amount_cents: amount })}
                disabled={isPaying}
                className="rounded-full border border-gold-300/60 px-4 py-2 text-sm text-gold-200 transition hover:bg-gold-300/10 disabled:opacity-70"
              >
                Donate ${(amount / 100).toFixed(0)}
              </button>
            ))}
          </div>
          <form
            className="mt-5 flex flex-wrap items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const amount = Number(
                new FormData(event.currentTarget).get('amount_cents')?.toString(),
              )
              if (!Number.isFinite(amount) || amount < 100) {
                setStatus('Enter at least 100 cents ($1).')
                return
              }
              void startCheckout('/api/payments/donate', { amount_cents: amount })
            }}
          >
            <input
              type="number"
              name="amount_cents"
              min={100}
              step={100}
              placeholder="Custom cents (e.g. 2500)"
              className="w-full rounded-full border border-amber-100/30 bg-indigo-950 px-4 py-2 text-amber-50 md:w-auto"
              required
            />
            <button
              type="submit"
              className="rounded-full bg-gold-300 px-5 py-2 font-semibold text-indigo-950"
            >
              Donate custom amount
            </button>
          </form>
        </article>

        <article className="rounded-2xl bg-indigo-900/60 p-6">
          <h2 className="font-heading text-4xl text-gold-200">Join the mailing list</h2>
          <p className="mt-3 text-amber-100/90">
            Receive updates, teachings, and release announcements.
          </p>
          <form onSubmit={handleMailingList} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full border border-amber-100/30 bg-indigo-950 px-4 py-2 text-amber-50"
              required
            />
            <button
              type="submit"
              className="rounded-full bg-gold-300 px-5 py-2 font-semibold text-indigo-950"
            >
              Subscribe
            </button>
          </form>
          {emailStatus && <p className="mt-3 text-sm text-gold-200">{emailStatus}</p>}
        </article>
      </section>

      <section className="rounded-3xl border border-gold-300/20 p-8" data-fade>
        <h2 className="font-heading text-4xl text-gold-200">Founder and vision</h2>
        <p className="mt-4 max-w-4xl text-amber-100/90">
          Divine Sovereignty exists to help people and organizations make high-integrity decisions
          at the intersection of spirit, leadership, and impact. The vision is a world where
          clarity, compassion, and sovereignty inform every action.
        </p>
      </section>

      <section id="enterprise" className="rounded-3xl border border-gold-300/20 p-8" data-fade>
        <h2 className="font-heading text-4xl text-gold-200">Enterprise & investment inquiries</h2>
        <p className="mt-3 text-amber-100/90">
          For strategic partnerships, enterprise advisory, and aligned investment conversations.
        </p>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleEnterpriseContact}>
          <input
            type="text"
            name="name"
            placeholder="Full name"
            className="rounded-xl border border-amber-100/30 bg-indigo-950 px-4 py-2 text-amber-50"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Work email"
            className="rounded-xl border border-amber-100/30 bg-indigo-950 px-4 py-2 text-amber-50"
            required
          />
          <input
            type="text"
            name="organization"
            placeholder="Organization"
            className="rounded-xl border border-amber-100/30 bg-indigo-950 px-4 py-2 text-amber-50 md:col-span-2"
          />
          <textarea
            name="message"
            placeholder="Tell us about your inquiry"
            className="min-h-36 rounded-xl border border-amber-100/30 bg-indigo-950 px-4 py-3 text-amber-50 md:col-span-2"
            required
          />
          <button
            type="submit"
            className="rounded-full bg-gold-300 px-5 py-2 font-semibold text-indigo-950 md:col-span-2 md:justify-self-start"
          >
            Submit inquiry
          </button>
        </form>
        {contactStatus && <p className="mt-3 text-sm text-gold-200">{contactStatus}</p>}
      </section>

      <footer className="border-t border-gold-300/20 py-8 text-sm text-amber-100/80" data-fade>
        This content is spiritual and educational in nature and does not constitute financial,
        medical, or legal advice.
      </footer>
    </main>
  )
}

export default App
