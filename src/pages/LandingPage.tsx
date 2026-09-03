import React from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRight, Mic } from 'lucide-react';
import { UmayraLogo } from '../components/UmayraLogo';
import { LiveMarketsStrip } from '../components/LiveMarketsStrip';

interface LandingPageProps {
  onEnterApp: () => void;
}

/* ─── Static Hero Conversation Demo ─────────────────────────── */
const HERO_DEMO = [
  { role: 'user', text: 'I think BTC will go up in the next two hours.' },
  { role: 'assistant', text: "I found a live BTC Up/Down contract expiring in 1h 53m. Strike is $97,240.00 — currently trading on-chain." },
];

/* ─── Static Conversational Demo ────────────────────────────── */
const CONV_DEMO = [
  { role: 'user', text: 'I want BTC to go up.' },
  { role: 'assistant', text: 'Sure — what timeframe are you thinking? 1 hour, 2 hours, or something else?' },
  { role: 'user', text: 'Two hours.' },
  { role: 'assistant', text: "Found it. A live BTC Event Contract with a 2h window — strike at $97,240.00. Your direction: UP." },
];

/* ─── How It Works steps ─────────────────────────────────────── */
const HOW_STEPS = [
  {
    n: '01',
    title: 'Say what you think.',
    body: 'Type or speak your view. "I think BTC will go up in the next two hours." No forms. No selectors.',
  },
  {
    n: '02',
    title: 'Umayra listens.',
    body: 'A deterministic intent engine parses your asset, direction, and timeframe from natural language.',
  },
  {
    n: '03',
    title: 'Live markets, matched.',
    body: 'Umayra queries live DreamDEX Event Contracts on Somnia and finds the closest matching binary market.',
  },
  {
    n: '04',
    title: 'Review and decide.',
    body: 'Inspect the strike, expiry, and outcomes. Then confirm your position — or refine your view.',
  },
];

/* ─── Why UMAYRA ─────────────────────────────────────────────── */
const WHY_POINTS = [
  {
    title: 'Intent-first, not form-first.',
    body: 'Traditional prediction markets make you search, filter, and select. Umayra inverts this: describe your view and let the interface find the market.',
  },
  {
    title: 'Real on-chain data, always.',
    body: 'Every market shown is verified live against DreamDEX Event Contracts on the Somnia testnet. No simulated prices, no stale data.',
  },
  {
    title: 'Voice-native by design.',
    body: 'Speak your prediction. Umayra transcribes it, parses it, and responds — with text or voice, depending on how you asked.',
  },
  {
    title: 'Conversation, not configuration.',
    body: 'Missing a timeframe? Umayra asks. Unsupported asset? She says so clearly. Multi-turn clarification is the default, not the exception.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  return (
    <div className="landing-page">

      {/* ─── Navigation ─────────────────────────────────────────── */}
      <nav className="umayra-nav" aria-label="Primary navigation">
        <div className="container">
          <a href="#" className="nav-logo" aria-label="UMAYRA home">
            <UmayraLogo variant="full" size={30} />
          </a>

          <ul className="nav-links" role="list">
            <li><a href="#how">How it works</a></li>
            <li><a href="#markets">Markets</a></li>
            <li><a href="#why">Why Umayra</a></li>
          </ul>

          <button
            className="nav-cta"
            onClick={onEnterApp}
            id="nav-enter-app-btn"
            aria-label="Open Umayra conversational interface"
          >
            Launch Umayra
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────── */}
      <section className="hero-section" aria-labelledby="hero-headline">
        <div className="container">
          <div className="hero-grid">

            {/* Left */}
            <div className="hero-left">
              <div className="hero-eyebrow" aria-label="Live on Somnia testnet">
                <span className="hero-eyebrow-dot" aria-hidden="true" />
                Live on Somnia Shannon Testnet
              </div>

              <h1 className="hero-headline" id="hero-headline">
                Your market<br />
                conviction,{' '}
                <em>spoken.</em>
              </h1>

              <p className="hero-subhead">
                Tell Umayra what you think will happen. She finds the live Event Contract
                that matches your view — powered by DreamDEX on Somnia.
              </p>

              <div className="hero-actions">
                <button
                  className="btn-primary"
                  onClick={onEnterApp}
                  id="hero-enter-app-btn"
                  aria-label="Open conversational prediction interface"
                >
                  <Mic size={15} />
                  Launch Umayra
                </button>
                <a href="#how" className="btn-ghost">
                  See how it works
                </a>
              </div>
            </div>

            {/* Right: Hero demo card */}
            <div className="hero-right" aria-label="Example conversation">
              <div className="hero-demo-card">
                <div className="demo-card-topbar">
                  <div className="demo-topbar-title">
                    <UmayraLogo variant="mark" size={18} />
                    Umayra
                  </div>
                  <div className="demo-topbar-live">
                    <span className="demo-live-dot" aria-hidden="true" />
                    LIVE TESTNET
                  </div>
                </div>

                <div className="demo-messages" role="log" aria-label="Example conversation">
                  {HERO_DEMO.map((msg, i) => (
                    <div key={i} className={`demo-msg ${msg.role}`}>
                      <div className="demo-msg-avatar" aria-hidden="true">
                        {msg.role === 'user' ? 'U' : 'A'}
                      </div>
                      <div className="demo-msg-bubble">{msg.text}</div>
                    </div>
                  ))}
                </div>

                {/* Mini Market Card */}
                <div className="demo-market-card" aria-label="Matched BTC market">
                  <div className="demo-market-header">
                    <span className="demo-asset-badge">BTC / USDC</span>
                    <span className="demo-status-badge">
                      <span className="demo-live-dot" aria-hidden="true" />
                      LIVE
                    </span>
                  </div>
                  <div className="demo-market-strike">$97,240.00</div>
                  <div className="demo-market-label">Strike — Will BTC close above this at expiry?</div>
                  <div className="demo-outcomes">
                    <div className="demo-outcome up selected">
                      <ArrowUpRight size={11} aria-hidden="true" />
                      UP (YES)
                    </div>
                    <div className="demo-outcome down">
                      <ArrowDownRight size={11} aria-hidden="true" />
                      DOWN (NO)
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ─── How It Works ─────────────────────────────────────────── */}
      <section className="how-section section" id="how" aria-labelledby="how-title">
        <div className="container">
          <div className="section-label" aria-hidden="true">How it works</div>
          <h2 className="section-title" id="how-title">
            From conviction to contract,<br />in four steps.
          </h2>

          <div className="how-steps" role="list">
            {HOW_STEPS.map(step => (
              <div key={step.n} className="how-step" role="listitem">
                <div className="how-step-number" aria-hidden="true">{step.n}</div>
                <div className="how-step-title">{step.title}</div>
                <div className="how-step-body">{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ─── Conversational Demo ──────────────────────────────────── */}
      <section
        className="conv-demo-section"
        aria-labelledby="conv-demo-title"
      >
        <div className="container">
          <div className="conv-demo-grid">
            <div className="conv-demo-left">
              <div className="section-label" aria-hidden="true">Multi-turn conversation</div>
              <h2 className="section-title" id="conv-demo-title">
                Not sure of your timeframe?
                <br />
                <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Just ask.</em>
              </h2>
              <p className="section-body" style={{ marginTop: '1.25rem' }}>
                If your first message is incomplete, Umayra doesn't fail — she asks a
                clarifying question. The conversation continues until she has what she
                needs to find your market.
              </p>
            </div>

            <div>
              <div className="conv-demo-exchange" aria-label="Multi-turn conversation example">
                <div className="conv-demo-header" aria-hidden="true">Example</div>
                <div className="conv-demo-messages" role="log">
                  {CONV_DEMO.map((msg, i) => (
                    <div key={i} className={`conv-msg ${msg.role}`}>
                      <div className="conv-msg-speaker" aria-hidden="true">
                        {msg.role === 'user' ? 'You' : 'Umayra'}
                      </div>
                      <div className="conv-msg-text">{msg.text}</div>
                    </div>
                  ))}
                </div>

                <div className="conv-market-result" aria-label="Matched market result">
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Match found
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    BTC — $97,240.00 strike
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Up/Down · Expires in ~1h 53m · On-chain: Trading
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ─── Live Markets (real data) ─────────────────────────────── */}
      <LiveMarketsStrip maxItems={6} />

      <div className="divider" />

      {/* ─── Why UMAYRA ───────────────────────────────────────────── */}
      <section className="why-section" id="why" aria-labelledby="why-title">
        <div className="container">
          <div className="why-grid">
            <div>
              <div className="section-label" aria-hidden="true">Why Umayra</div>
              <h2 className="section-title" id="why-title">
                Prediction markets deserve better UX.
              </h2>
              <p className="section-body" style={{ marginTop: '1rem' }}>
                Most prediction platforms are built for traders who already know what they want.
                Umayra is built for people who have a view — and want to express it naturally.
              </p>
            </div>

            <div className="why-points" role="list">
              {WHY_POINTS.map((pt, i) => (
                <div key={i} className="why-point" role="listitem">
                  <div className="why-point-title">{pt.title}</div>
                  <div className="why-point-body">{pt.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ─── Infrastructure ───────────────────────────────────────── */}
      <section className="infra-section" aria-label="Infrastructure attribution">
        <div className="container">
          <div className="infra-inner">
            <span className="infra-label">Powered by</span>
            <span className="infra-badge">DreamDEX Event Contracts</span>
            <span className="infra-badge">Somnia Shannon Testnet · 50312</span>
            <span className="infra-badge">@somnia-chain/markets-sdk v0.28.1</span>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ─── Final CTA ────────────────────────────────────────────── */}
      <section className="cta-section" aria-labelledby="cta-headline">
        <div className="container">
          <h2 className="cta-headline" id="cta-headline">
            Have a prediction?
            <br />
            <em>Talk to Umayra.</em>
          </h2>
          <p className="cta-sub">Type it. Speak it. She'll find the market.</p>
          <button
            className="btn-primary"
            onClick={onEnterApp}
            id="cta-enter-app-btn"
            aria-label="Open Umayra conversational interface"
          >
            Launch Umayra
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="site-footer" aria-label="Site footer">
        <div className="container">
          <span className="site-footer-copy">
            © 2026 UMAYRA · Read-only · No wallet required · Somnia testnet
          </span>
          <div className="site-footer-links">
            <a href="#how">How it works</a>
            <a href="#markets">Markets</a>
            <a href="#why">About</a>
          </div>
        </div>
      </footer>

    </div>
  );
};
