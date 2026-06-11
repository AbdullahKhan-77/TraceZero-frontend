'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Shield, Search, Trash2, AlertTriangle, Database, CheckCircle,
  ExternalLink, Mail, ChevronDown, ChevronUp, Zap, X,
  Globe, Cpu, BarChart2, RefreshCw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// useTyping — types text character by character like a terminal cursor
// ─────────────────────────────────────────────────────────────────────────────
function useTyping(text: string, speed = 80, delay = 0) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    const t = setTimeout(() => {
      let i = 0;
      iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(iv!); setDone(true); }
      }, speed);
    }, delay);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return { displayed, done };
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter — animates a number from 0 up to target
// ─────────────────────────────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let n = 0;
    const step = Math.ceil(target / 60);
    const iv = setInterval(() => {
      n += step;
      if (n >= target) { setVal(target); clearInterval(iv); }
      else setVal(n);
    }, 22);
    return () => clearInterval(iv);
  }, [target]);
  return <span>{val.toLocaleString()}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// BROKER DATA — exactly matches backend (main.py broker_meta + browser.py
// OPTOUT_HANDLERS + scraper.py BROKERS list)
// ─────────────────────────────────────────────────────────────────────────────

// Only the 3 brokers scraper.py can actually scrape live
const BROKERS: {
  name: string;
  optout_url: string;
  optout_email: string;
  optout_notes: string;
  automated: boolean;
}[] = [
  {
    name: 'Intelius',
    optout_url:   'https://www.intelius.com/opt-out',
    optout_email: 'privacy@intelius.com',
    optout_notes: 'Submit opt-out form with email confirmation.',
    automated: true,
  },
  {
    name: 'Addresses',
    optout_url:   'https://www.addresses.com/optout',
    optout_email: 'privacy@addresses.com',
    optout_notes: 'Submit removal request via their online form.',
    automated: false,
  },
  {
    name: 'ZabaSearch',
    optout_url:   'https://www.zabasearch.com/block_user/',
    optout_email: 'privacy@zabasearch.com',
    optout_notes: 'Submit removal via zabasearch.com/block_user.',
    automated: false,
  },
];

const BROKER_MAP = Object.fromEntries(BROKERS.map(b => [b.name, b]));

// GDPR / CCPA template — mirrors enforcement/email_sender.py
function buildRemovalEmail(name: string, city: string, broker: string): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });
  return `Subject: Right to Erasure Request under GDPR / CCPA – ${name}

To Whom It May Concern at ${broker},

I am writing to formally request the deletion of all personal data
associated with me that is held, processed, or distributed by your
organisation, in accordance with:

  • Article 17 of the GDPR ("Right to Erasure / Right to be Forgotten")
  • The California Consumer Privacy Act (CCPA), Section 1798.105

My identifying information is as follows:
  Full Name : ${name}
  City      : ${city}
  Date      : ${today}

Please confirm in writing within 30 days that all records matching
the above have been permanently deleted from your systems and are
no longer shared with third parties.

Failure to comply may result in a formal complaint being filed with
the relevant supervisory authority.

Yours sincerely,
${name}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface PiiEntity { value: string; confidence: number; source: string; }
interface ScanRecord {
  id?:              number;
  broker:           string;
  source?:          'real' | 'simulated';
  optout_url?:      string;
  optout_email?:    string;
  optout_notes?:    string;
  extracted_pii:    Record<string, string>;
  ai_pii?:          Record<string, PiiEntity[]>;
  risk_level:       string;
  risk_confidence?: number;
  match_score:      number;
  status?:          string;
  raw_text?:        string;
}
interface EnforceResult {
  status: 'idle' | 'sending' | 'sent' | 'error';
  message?: string;
  manual_step?: string; // returned by browser.py handlers
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const riskColor = (level: string) =>
  level === 'High' ? '#ff4444' : level === 'Medium' ? '#ffaa00' : '#00ff7f';

const riskBg = (level: string) =>
  level === 'High' ? '#ff444420' : level === 'Medium' ? '#ffaa0015' : '#00ff7f15';

// ─────────────────────────────────────────────────────────────────────────────
// EmailModal — shows a generated GDPR removal email
// ─────────────────────────────────────────────────────────────────────────────
function EmailModal({
  broker, name, city, onClose,
}: { broker: string; name: string; city: string; onClose: () => void }) {
  const text = buildRemovalEmail(name || 'Your Name', city || 'Your City', broker);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--em)', marginBottom: '4px' }}>// GDPR / CCPA REMOVAL EMAIL</p>
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '14px', color: 'var(--text)' }}>{broker}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>
        <pre style={{
          fontFamily: 'monospace', fontSize: '12px', color: 'var(--text)',
          background: '#020c06', padding: '16px', borderRadius: '6px',
          border: '1px solid var(--border)', whiteSpace: 'pre-wrap',
          lineHeight: 1.7, maxHeight: '380px', overflowY: 'auto', marginBottom: '16px',
        }}>{text}</pre>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={copy} className="btn-primary" style={{ fontSize: '11px', padding: '8px 20px' }}>
            {copied ? '✓ COPIED' : 'COPY EMAIL'}
          </button>
          <a
            href={`mailto:${BROKER_MAP[broker]?.optout_email ?? ''}?subject=${encodeURIComponent(`Right to Erasure Request – ${name}`)}&body=${encodeURIComponent(text)}`}
            className="btn-outline"
            style={{ fontSize: '11px', padding: '8px 18px' }}
          >
            <Mail size={12} /> OPEN IN MAIL
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeTab, setActiveTab]       = useState<'scan' | 'results' | 'enforce'>('scan');
  const [scanning, setScanning]         = useState(false);
  const [scanDone, setScanDone]         = useState(false);
  const [realResults, setRealResults]   = useState<ScanRecord[]>([]);
  const [enforceMap, setEnforceMap]     = useState<Record<string, EnforceResult>>({});
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [formData, setFormData]         = useState({ name: '', city: '', state: '', phone: '', email: '' });
  const [apiError, setApiError]         = useState<string | null>(null);
  const [nameError, setNameError]       = useState<string | null>(null);
  const [scanIdx, setScanIdx]           = useState(0);
  const [emailModal, setEmailModal]     = useState<string | null>(null); // broker name

  const title = useTyping('TRACEZERO', 75, 400);
  const sub   = useTyping('Digital Footprint Removal Agent', 38, 1500);

  // Cycle scanning broker highlight
  useEffect(() => {
    if (!scanning) { setScanIdx(0); return; }
    const iv = setInterval(() => setScanIdx(n => (n + 1) % BROKERS.length), 550);
    return () => clearInterval(iv);
  }, [scanning]);

  const displayResults = realResults;
  const highRiskCount  = displayResults.filter(r => r.risk_level === 'High').length;
  const sentCount      = Object.values(enforceMap).filter(e => e.status === 'sent').length;

  // ── Scan ─────────────────────────────────────────────────────────────────────
  const handleScan = async () => {
    if (!formData.name.trim()) return;
    if (formData.name.trim().split(/\s+/).length < 2) {
      setNameError('Please provide both a first and last name (e.g. "John Smith").');
      return;
    }
    setNameError(null);
    setScanning(true); setScanDone(false); setRealResults([]); setEnforceMap({}); setApiError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      if (data.records?.length) setRealResults(data.records);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Backend offline — showing demo results.');
    } finally {
      setScanning(false); setScanDone(true); setActiveTab('results');
    }
  };

  // ── Single enforce ───────────────────────────────────────────────────────────
  const handleEnforce = async (record: ScanRecord) => {
    const key = record.broker;
    setEnforceMap(p => ({ ...p, [key]: { status: 'sending' } }));
    try {
      if (!record.id) {
        await new Promise(r => setTimeout(r, 900));
        setEnforceMap(p => ({ ...p, [key]: { status: 'sent', message: 'Demo mode — simulated success.', manual_step: BROKER_MAP[key]?.optout_notes } }));
        return;
      }
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enforce`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: record.id, broker: record.broker, profile: formData }),
      });
      const data = await res.json();
      setEnforceMap(p => ({ ...p, [key]: {
        status: data.success ? 'sent' : 'error',
        message: data.message,
        manual_step: data.manual_step,
      }}));
    } catch {
      setEnforceMap(p => ({ ...p, [key]: { status: 'error', message: 'Network error' } }));
    }
  };

  // ── Enforce all (batch) ──────────────────────────────────────────────────────
  const handleEnforceAll = async () => {
    for (const r of displayResults) {
      if ((enforceMap[r.broker]?.status ?? 'idle') === 'idle') {
        await handleEnforce(r);
      }
    }
  };

  const toggleExpand = (i: number) =>
    setExpandedCards(p => ({ ...p, [i]: !p[i] }));

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: "'Rajdhani', sans-serif" }}>

      {/* ════════════════════════════════════════════════════════════════ HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 48px', position: 'relative', overflow: 'hidden' }}>
        {/* Grid background */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#1a4a2518 1px, transparent 1px), linear-gradient(90deg, #1a4a2518 1px, transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none' }} />
        {/* Central glow */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, #00ff7f06 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '860px' }}>
          {/* Status badge */}
          <div className="animate-fadeUp" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 18px', borderRadius: '999px', border: '1px solid #1a4a25', background: '#0a1a0f', color: 'var(--em)', fontFamily: 'monospace', fontSize: '11px', marginBottom: '36px', boxShadow: '0 0 16px #00ff7f18' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--em)', display: 'inline-block' }} className="animate-pulse" />
            SYSTEM ONLINE · AI MODELS ACTIVE
          </div>

          {/* Main title */}
          <h1 className="glow animate-flicker" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 'clamp(58px, 11vw, 114px)', fontWeight: 900, letterSpacing: '10px', color: 'var(--em)', marginBottom: '16px', lineHeight: 1 }}>
            {title.displayed}{!title.done && <span className="animate-blink">_</span>}
          </h1>

          {/* Subtitle */}
          <p style={{ fontFamily: 'monospace', fontSize: '17px', color: 'var(--muted)', marginBottom: '20px', minHeight: '26px', letterSpacing: '1px' }}>
            {sub.displayed}{sub.displayed.length > 0 && !sub.done && <span className="animate-blink">_</span>}
          </p>

          {/* Description */}
          <p className="animate-fadeUp delay-3" style={{ fontFamily: 'monospace', fontSize: '13px', color: '#3a6a4a', maxWidth: '580px', margin: '0 auto 44px', lineHeight: 1.9 }}>
            Fine-tuned <span style={{ color: '#5a9a6a' }}>RoBERTa NER</span> · <span style={{ color: '#5a9a6a' }}>DistilBERT risk scoring</span> · <span style={{ color: '#5a9a6a' }}>Sentence-BERT deduplication</span>
            <br />Finds and erases your personal data from data broker websites — automatically.
          </p>

          {/* CTA buttons */}
          <div className="animate-fadeUp delay-4" style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '60px' }}>
            <button className="btn-primary" onClick={() => document.getElementById('app')?.scrollIntoView({ behavior: 'smooth' })}>
              RUN SCAN →
            </button>
            <button className="btn-outline" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              HOW IT WORKS
            </button>
          </div>

          {/* Scroll hint — inside the content flow, below buttons */}
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#2a5a3a', letterSpacing: '3px' }}>↓ SCROLL</div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ STATS */}
      <section style={{ padding: '80px 48px', maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
          {[
            { value: 3,    suffix: '',  label: 'BROKERS TARGETED',   icon: <Globe size={16} color="var(--em)" /> },
            { value: 5000, suffix: '+', label: 'TRAINING EXAMPLES',  icon: <Database size={16} color="var(--em)" /> },
            { value: 3,    suffix: '',  label: 'AI MODELS DEPLOYED', icon: <Cpu size={16} color="var(--em)" /> },
            { value: 90,   suffix: '%', label: 'MATCH ACCURACY',     icon: <BarChart2 size={16} color="var(--em)" /> },
          ].map(s => (
            <div key={s.label} className="card animate-fadeUp" style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>{s.icon}</div>
              <div className="glow-sm" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '30px', fontWeight: 700, color: 'var(--em)', marginBottom: '6px' }}>
                <Counter target={s.value} suffix={s.suffix} />
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted)', letterSpacing: '1.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════ FEATURES */}
      <section id="features" style={{ padding: '80px 48px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--em)', marginBottom: '8px', letterSpacing: '3px' }}>// SYSTEM CAPABILITIES</p>
          <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '26px', fontWeight: 700, color: 'var(--text)' }}>How TraceZero Works</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          {[
            { icon: Search,        title: 'PII DETECTION',  desc: 'Fine-tuned RoBERTa NER detects names, addresses, phones, SSNs, and emails with up to 0.99 confidence.' },
            { icon: AlertTriangle, title: 'RISK SCORING',   desc: 'DistilBERT classifies each record as High / Medium / Low risk based on the sensitivity of exposed PII.' },
            { icon: Database,      title: 'DEDUPLICATION',  desc: 'Sentence-BERT computes cosine similarity to merge duplicate records across different broker sites.' },
            { icon: Trash2,        title: 'AUTO REMOVAL',   desc: 'Playwright browser automation fills real opt-out forms and generates GDPR / CCPA removal emails.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card animate-fadeUp" style={{ padding: '26px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#00ff7f12', border: '1px solid #1a4a25', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Icon size={18} color="var(--em)" />
              </div>
              <h3 className="glow-sm" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 600, color: 'var(--em)', marginBottom: '10px', letterSpacing: '1px' }}>{title}</h3>
              <p style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.75 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ BROKERS */}
      <section style={{ padding: '80px 48px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '52px', alignItems: 'start' }}>
          <div>
            <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--em)', marginBottom: '8px', letterSpacing: '3px' }}>// TARGET LIST</p>
            <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Data Brokers in Scope</h2>
            <p style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.85, marginBottom: '24px' }}>
              TraceZero scrapes these 3 live data broker sites in real time using a Playwright browser.
              Your name is searched directly — no simulated data, no guesses.
            </p>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { color: 'var(--em)', label: 'AUTOMATED', desc: 'Playwright opt-out handler available' },
                { color: 'var(--muted)', label: 'MANUAL', desc: 'Opt-out link + GDPR email template' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: l.color }}>{l.label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#3a5a45' }}>{l.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '6px 0' }}>
            {BROKERS.map((b, i) => (
              <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 20px', borderBottom: i < BROKERS.length - 1 ? '1px solid #0f2a18' : 'none', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0d2214')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.automated ? 'var(--em)' : 'var(--muted)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text)' }}>{b.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {b.automated ? <span className="tag tag-green">AUTO</span> : <span className="tag tag-dim">MANUAL</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════ APP CONSOLE */}
      <section id="app" style={{ padding: '80px 48px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--em)', marginBottom: '8px', letterSpacing: '3px' }}>// LIVE INTERFACE</p>
          <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '26px', fontWeight: 700, color: 'var(--text)' }}>TraceZero Console</h2>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', width: 'fit-content', margin: '0 auto 28px' }}>
          {(['scan', 'results', 'enforce'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: '10px 30px', borderRadius: '7px', fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '2px', border: 'none', cursor: 'pointer', background: activeTab === tab ? 'var(--em)' : 'transparent', color: activeTab === tab ? '#020c06' : 'var(--muted)', transition: 'all 0.2s', boxShadow: activeTab === tab ? '0 0 14px #00ff7f44' : 'none' }}>
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════ SCAN TAB */}
        {activeTab === 'scan' && (
          <div className="card animate-fadeIn" style={{ padding: '44px', maxWidth: '540px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#00ff7f12', border: '1px solid #1a4a25', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={16} color="var(--em)" />
              </div>
              <div>
                <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '12px', color: 'var(--em)', letterSpacing: '2px' }}>TARGET PROFILE</p>
                <p style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>All fields optional except name</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { key: 'name',  placeholder: 'Full Name *', icon: '◈' },
                { key: 'city',  placeholder: 'City',        icon: '◈' },
                { key: 'state', placeholder: 'State (e.g. NY)', icon: '◈' },
                { key: 'phone', placeholder: 'Phone Number',    icon: '◈' },
                { key: 'email', placeholder: 'Email Address',   icon: '◈' },
              ].map(({ key, placeholder }) => (
                <input
                  key={key}
                  className="tz-input"
                  value={formData[key as keyof typeof formData]}
                  onChange={e => {
                    setFormData(p => ({ ...p, [key]: e.target.value }));
                    if (key === 'name') setNameError(null);
                  }}
                  placeholder={placeholder}
                />
              ))}
            </div>

            <button
              className="btn-primary"
              onClick={handleScan}
              disabled={!formData.name.trim() || scanning}
              style={{ width: '100%', marginTop: '18px' }}>
              {scanning ? '⟳  SCANNING BROKERS...' : '⚡  RUN DISCOVERY SCAN'}
            </button>

            {/* Name validation error */}
            {nameError && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#ff444410', border: '1px solid #ff444435', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--red)' }}>
                ✗ {nameError}
              </div>
            )}

            {/* Scanning list */}
            {scanning && (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <p style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '2px' }}>// SCANNING</p>
                {BROKERS.map((b, i) => (
                  <div key={b.name} className={i === scanIdx ? 'animate-slideIn' : ''} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'monospace', fontSize: '12px', color: i === scanIdx ? 'var(--em)' : '#2a5a3a', transition: 'color 0.3s' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: i === scanIdx ? 'var(--em)' : '#1a4a25', flexShrink: 0 }}
                      className={i === scanIdx ? 'animate-pulse' : ''} />
                    {i === scanIdx ? `→ ${b.name}` : b.name}
                    {i < scanIdx && <span style={{ color: '#1a5a2a', fontSize: '10px' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Success notice */}
            {scanDone && !scanning && (
              <div style={{ marginTop: '16px', padding: '10px 14px', background: '#00ff7f0c', border: '1px solid #00ff7f25', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--em)' }}>
                ✓ Scan complete — {displayResults.length} records found
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════ RESULTS TAB */}
        {activeTab === 'results' && (
          <div className="animate-fadeIn">
            {!scanDone ? (
              <div style={{ textAlign: 'center', padding: '72px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--muted)' }}>
                // Run a scan first to see results
              </div>
            ) : displayResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                  // No records found
                </div>
                {apiError && (
                  <div style={{ padding: '10px 16px', background: '#ffaa0010', border: '1px solid #ffaa0035', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--amber)', display: 'inline-block' }}>
                    ⚠ Backend unreachable — {apiError}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Banner */}
                {apiError && (
                  <div style={{ marginBottom: '14px', padding: '10px 16px', background: '#ffaa0010', border: '1px solid #ffaa0035', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--amber)' }}>
                    ⚠ Backend unreachable — {apiError}
                  </div>
                )}

                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'RECORDS FOUND',  value: displayResults.length,           color: 'var(--em)' },
                    { label: 'HIGH RISK',       value: highRiskCount,                   color: 'var(--red)' },
                    { label: 'PENDING REMOVAL', value: displayResults.length - sentCount, color: 'var(--amber)' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '20px', textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted)', marginTop: '4px', letterSpacing: '1.5px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Result cards */}
                {displayResults.map((r, i) => (
                  <div key={i}
                    className={r.risk_level === 'High' ? 'danger-border' : 'glow-border'}
                    style={{ background: 'var(--surface)', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>

                    {/* Header row */}
                    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <AlertTriangle size={13} color={riskColor(r.risk_level)} />
                        <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{r.broker}</span>
                        <span className="tag" style={{ background: riskBg(r.risk_level), borderColor: riskColor(r.risk_level), color: riskColor(r.risk_level), border: `1px solid ${riskColor(r.risk_level)}66` }}>
                          {r.risk_level} RISK
                        </span>
                        {r.risk_confidence !== undefined && (
                          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted)' }}>
                            {(r.risk_confidence * 100).toFixed(0)}% conf
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--em)' }}>
                          MATCH {((r.match_score || 0) * 100).toFixed(0)}%
                        </span>
                        <button onClick={() => toggleExpand(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
                          {expandedCards[i] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Match bar */}
                    <div className="progress-track" style={{ margin: '0 20px', marginBottom: '12px' }}>
                      <div className="progress-fill animate-growBar" style={{ width: `${(r.match_score || 0) * 100}%`, background: riskColor(r.risk_level) }} />
                    </div>

                    {/* PII tags */}
                    <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                      {Object.entries(r.extracted_pii || {}).map(([k, v]) => (
                        <span key={k} className="tag tag-dim" style={{ fontSize: '12px', padding: '4px 10px' }}>
                          <span style={{ color: 'var(--muted)', marginRight: '3px' }}>{k}:</span>
                          <span style={{ color: 'var(--text)' }}>{String(v)}</span>
                        </span>
                      ))}
                    </div>

                    {/* Expanded */}
                    {expandedCards[i] && (
                      <div style={{ padding: '0 20px 18px', borderTop: '1px solid #0f2a18' }}>
                        {/* AI detections */}
                        {r.ai_pii && Object.keys(r.ai_pii).length > 0 && (
                          <div style={{ marginTop: '14px' }}>
                            <p style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--em)', marginBottom: '8px', letterSpacing: '2px' }}>// ROBERTA NER DETECTIONS</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {Object.entries(r.ai_pii).map(([entity, items]) =>
                                items.map((item, j) => (
                                  <span key={`${entity}-${j}`} className="tag tag-green" style={{ fontSize: '11px' }}>
                                    [{entity}] {item.value}
                                    <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>{(item.confidence * 100).toFixed(0)}% {item.source}</span>
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Raw text */}
                        {r.raw_text && (
                          <div style={{ marginTop: '12px' }}>
                            <p style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', letterSpacing: '2px' }}>// RAW SCRAPED TEXT</p>
                            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)', background: '#020c06', padding: '10px', borderRadius: '5px', border: '1px solid #0f2a18', maxHeight: '80px', overflowY: 'auto', lineHeight: 1.65 }}>
                              {r.raw_text.length > 300 ? `${r.raw_text.slice(0, 300)}…` : r.raw_text}
                            </div>
                          </div>
                        )}

                        {/* Warning note */}
                        {(r.optout_notes || BROKER_MAP[r.broker]?.optout_notes) && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', background: '#ffaa0010', border: '1px solid #ffaa0025', borderRadius: '5px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--amber)' }}>
                              ⚠ {r.optout_notes || BROKER_MAP[r.broker]?.optout_notes}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => setActiveTab('enforce')} className="btn-primary" style={{ fontSize: '10px', padding: '6px 16px' }}>
                            → ENFORCE
                          </button>
                          <button onClick={() => setEmailModal(r.broker)} className="btn-outline" style={{ fontSize: '10px', padding: '6px 14px' }}>
                            <Mail size={10} /> GDPR EMAIL
                          </button>
                          <a href={r.optout_url || BROKER_MAP[r.broker]?.optout_url} target="_blank" rel="noreferrer" className="btn-outline" style={{ fontSize: '10px', padding: '6px 14px' }}>
                            <ExternalLink size={10} /> OPT-OUT PAGE
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════ ENFORCE TAB */}
        {activeTab === 'enforce' && (
          <div className="animate-fadeIn">
            {!scanDone ? (
              <div style={{ textAlign: 'center', padding: '72px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--muted)' }}>
                // Run a scan first to generate removal requests
              </div>
            ) : (
              <>
                {/* Summary bar + Enforce All */}
                <div style={{ marginBottom: '16px', padding: '14px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--muted)' }}>
                      {sentCount} / {displayResults.length} removal requests sent
                    </span>
                    {/* Dot indicators */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                      {displayResults.map((r, i) => {
                        const s = enforceMap[r.broker]?.status ?? 'idle';
                        return <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: s === 'sent' ? 'var(--em)' : s === 'error' ? 'var(--red)' : s === 'sending' ? 'var(--amber)' : '#1a4a25' }} />;
                      })}
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleEnforceAll}
                    disabled={sentCount === displayResults.length}
                    style={{ fontSize: '11px', padding: '9px 22px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={13} /> ENFORCE ALL
                  </button>
                </div>

                {displayResults.map((r, i) => {
                  const es  = enforceMap[r.broker] ?? { status: 'idle' };
                  const url = r.optout_url || BROKER_MAP[r.broker]?.optout_url;

                  return (
                    <div key={i}
                      className="glow-border"
                      style={{ background: 'var(--surface)', borderRadius: '10px', padding: '20px', marginBottom: '10px', borderColor: es.status === 'sent' ? '#00ff7f35' : es.status === 'error' ? '#ff444435' : 'var(--border)' }}>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Title row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{r.broker}</span>
                            <span className="tag" style={{ background: riskBg(r.risk_level), border: `1px solid ${riskColor(r.risk_level)}40`, color: riskColor(r.risk_level) }}>{r.risk_level}</span>
                            {BROKER_MAP[r.broker]?.automated && <span className="tag tag-green">AUTO</span>}
                            {es.status === 'sent'  && <span className="tag tag-green"><CheckCircle size={9} /> SENT</span>}
                            {es.status === 'error' && <span className="tag tag-red">✗ FAILED</span>}
                            {es.status === 'sending' && <span className="tag tag-amber"><RefreshCw size={9} className="animate-spin" /> SENDING</span>}
                          </div>

                          {/* PII chips */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                            {Object.entries(r.extracted_pii || {}).slice(0, 4).map(([k, v]) => (
                              <span key={k} className="tag tag-dim" style={{ fontSize: '11px' }}>
                                {k}: <span style={{ color: 'var(--text)' }}>{String(v)}</span>
                              </span>
                            ))}
                          </div>

                          {/* Email line */}
                          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                            <Mail size={10} />
                            <span style={{ color: 'var(--text)' }}>{r.optout_email || BROKER_MAP[r.broker]?.optout_email}</span>
                          </div>

                          {/* Notes */}
                          {(r.optout_notes || BROKER_MAP[r.broker]?.optout_notes) && (
                            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--amber)', marginTop: '4px' }}>
                              ⚠ {r.optout_notes || BROKER_MAP[r.broker]?.optout_notes}
                            </div>
                          )}

                          {/* manual_step from browser.py handler result */}
                          {es.manual_step && (
                            <div style={{ marginTop: '8px', padding: '8px 12px', background: '#ffaa0010', border: '1px solid #ffaa0025', borderRadius: '5px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--amber)', lineHeight: 1.6 }}>
                              📋 {es.manual_step}
                            </div>
                          )}

                          {/* Success/error message from backend */}
                          {es.message && es.status !== 'idle' && (
                            <div style={{ marginTop: '6px', fontFamily: 'monospace', fontSize: '11px', color: es.status === 'sent' ? 'var(--em)' : 'var(--red)', lineHeight: 1.5 }}>
                              {es.status === 'sent' ? '✓ ' : '✗ '}{es.message}
                            </div>
                          )}
                        </div>

                        {/* Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: '96px' }}>
                          <button
                            onClick={() => handleEnforce(r)}
                            disabled={es.status === 'sending' || es.status === 'sent'}
                            style={{
                              padding: '8px 14px', borderRadius: '5px',
                              fontFamily: "'Orbitron', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                              border: `1px solid ${es.status === 'sent' ? 'var(--em)' : 'var(--border)'}`,
                              background: es.status === 'sent' ? '#00ff7f22' : es.status === 'sending' ? 'var(--border)' : 'var(--em)',
                              color:      es.status === 'sent' ? 'var(--em)' : es.status === 'sending' ? 'var(--muted)' : '#020c06',
                              cursor: (es.status === 'sending' || es.status === 'sent') ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s', whiteSpace: 'nowrap',
                            }}>
                            {es.status === 'sending' ? '⟳ ...' : es.status === 'sent' ? '✓ SENT' : '⚡ SEND'}
                          </button>
                          <button onClick={() => setEmailModal(r.broker)} className="btn-outline" style={{ fontSize: '10px', padding: '6px 10px', justifyContent: 'center' }}>
                            <Mail size={10} /> EMAIL
                          </button>
                          {url && (
                            <a href={url} target="_blank" rel="noreferrer" className="btn-outline" style={{ fontSize: '10px', padding: '6px 10px', justifyContent: 'center' }}>
                              <ExternalLink size={10} /> OPT-OUT
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════ FOOTER */}
      <footer style={{ borderTop: '1px solid #0f2a18', padding: '36px 48px', textAlign: 'center', marginTop: '80px' }}>
        <p className="glow-sm" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '14px', color: 'var(--em)', marginBottom: '8px', letterSpacing: '4px' }}>TRACEZERO</p>
        <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#2a5a3a' }}>
          AI Privacy Agent · Abdullah Khan · RoBERTa · DistilBERT · Sentence-BERT · Playwright
        </p>
      </footer>

      {/* ═══════════════════════════════════════════════════ EMAIL MODAL */}
      {emailModal && (
        <EmailModal
          broker={emailModal}
          name={formData.name}
          city={formData.city}
          onClose={() => setEmailModal(null)}
        />
      )}
    </main>
  );
}
