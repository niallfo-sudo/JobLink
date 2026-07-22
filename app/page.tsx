"use client";

import { FormEvent, useMemo, useState } from "react";

type View = "discover" | "request" | "matches" | "tracking";

const categories = [
  ["Drywall", "DW"],
  ["Roofing", "RF"],
  ["Painting", "PT"],
  ["Plumbing", "PL"],
  ["Electrical", "EL"],
  ["Landscaping", "LS"],
  ["Moving", "MV"],
  ["Junk removal", "JR"],
] as const;

const contractors = [
  {
    initials: "NB",
    name: "North & Beam Drywall",
    badge: "Best match",
    score: "96",
    rating: "4.9",
    reviews: "184",
    jobs: "317 jobs",
    arrival: "Tomorrow, 8–10 AM",
    price: "$2,280",
    note: "Materials, protection and cleanup included",
    color: "#df5f38",
  },
  {
    initials: "HP",
    name: "Hamilton Plaster Co.",
    badge: "Fastest",
    score: "92",
    rating: "4.8",
    reviews: "239",
    jobs: "402 jobs",
    arrival: "Tomorrow, 7:30 AM",
    price: "$2,350",
    note: "15-year workmanship warranty",
    color: "#244c40",
  },
  {
    initials: "LV",
    name: "Level Finish Inc.",
    badge: "Great value",
    score: "89",
    rating: "4.9",
    reviews: "96",
    jobs: "188 jobs",
    arrival: "Thursday, 9 AM",
    price: "$2,190",
    note: "Final walkthrough and touch-ups included",
    color: "#335a75",
  },
];

const steps = ["Describe", "Details", "Timing", "Review"];

export default function Home() {
  const [view, setView] = useState<View>("discover");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("Drywall");
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState("Repair damaged drywall in a finished basement");
  const [size, setSize] = useState("Four 4 × 8 sheets");
  const [timeline, setTimeline] = useState("Before Friday");
  const [budget, setBudget] = useState("$2,000–$2,500");
  const [accepted, setAccepted] = useState<string | null>(null);

  const jobBrief = useMemo(
    () =>
      `Looking for an experienced ${category.toLowerCase()} contractor to ${scope.toLowerCase()}. Scope is approximately ${size.toLowerCase()} and includes protection, materials, finishing and cleanup. Customer prefers completion ${timeline.toLowerCase()} with a target budget of ${budget}.`,
    [category, scope, size, timeline, budget],
  );

  function beginRequest(value?: string, picked?: string) {
    if (picked) setCategory(picked);
    if (value?.trim()) {
      setScope(value.trim());
      const lower = value.toLowerCase();
      if (lower.includes("roof")) setCategory("Roofing");
      else if (lower.includes("paint")) setCategory("Painting");
      else if (lower.includes("plumb") || lower.includes("leak")) setCategory("Plumbing");
      else if (lower.includes("electric")) setCategory("Electrical");
    }
    setStep(0);
    setView("request");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitPrompt(event: FormEvent) {
    event.preventDefault();
    beginRequest(prompt || "Repair damaged drywall in a finished basement");
  }

  function go(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main>
      <header className="site-header">
        <button className="brand" onClick={() => go("discover")} aria-label="JobDrop home">
          <span className="brand-mark"><i /></span>
          <span>JobDrop</span>
        </button>
        <nav aria-label="Main navigation">
          <button className={view === "discover" ? "active" : ""} onClick={() => go("discover")}>Find a pro</button>
          <button className={view === "matches" ? "active" : ""} onClick={() => go("matches")}>My request</button>
          <button className={view === "tracking" ? "active" : ""} onClick={() => go("tracking")}>Track job</button>
        </nav>
        <div className="header-actions">
          <button className="text-button">For contractors</button>
          <button className="avatar-button" aria-label="Open profile">NL</button>
        </div>
      </header>

      {view === "discover" && (
        <>
          <section className="hero">
            <div className="eyebrow"><span /> One request. The right pros.</div>
            <div className="hero-grid">
              <div className="hero-copy">
                <h1>Describe the job.<br />We’ll bring the <em>right</em><br />people to you.</h1>
                <p>No searching. No phone tag. Tell us what you need and compare a shortlist of trusted local pros.</p>
              </div>
              <div className="hero-aside" aria-label="Marketplace activity">
                <div className="activity-stack">
                  <div className="mini-card mini-one"><span className="status-dot" /> 3 plumbers available today</div>
                  <div className="mini-card mini-two"><b>4.9</b><span>average pro rating</span></div>
                  <div className="mini-card mini-three"><span>✓</span> Quotes include the full scope</div>
                </div>
              </div>
            </div>

            <form className="prompt-box" onSubmit={submitPrompt}>
              <label htmlFor="job-prompt">What do you need done?</label>
              <div className="prompt-row">
                <span className="prompt-plus">+</span>
                <input
                  id="job-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="e.g. Repair drywall in my basement"
                />
                <button type="submit">Start my request <span>→</span></button>
              </div>
              <div className="prompt-meta"><span>AI-guided · about 60 seconds</span><span>Free to post · no obligation</span></div>
            </form>
          </section>

          <section className="category-section section-wrap">
            <div className="section-heading">
              <p>Popular services</p>
              <h2>What can we help with?</h2>
            </div>
            <div className="category-grid">
              {categories.map(([name, letters]) => (
                <button key={name} className="category-card" onClick={() => beginRequest(undefined, name)}>
                  <span className="category-icon">{letters}</span>
                  <b>{name}</b>
                  <span className="arrow">↗</span>
                </button>
              ))}
            </div>
          </section>

          <section className="how-section section-wrap">
            <div className="how-intro">
              <p className="section-label">How JobDrop works</p>
              <h2>Less chasing.<br /><em>More choosing.</em></h2>
              <p>We turn a few quick answers into a clear request that qualified professionals can price properly.</p>
              <button className="link-button" onClick={() => beginRequest()}>Post a request <span>→</span></button>
            </div>
            <ol className="steps-list">
              <li><span>01</span><div><b>Tell us what’s wrong</b><p>Type it, talk it, or upload photos. Our guided flow asks only what matters.</p></div></li>
              <li><span>02</span><div><b>We sharpen the scope</b><p>AI turns your answers into a detailed brief so every quote compares like-for-like.</p></div></li>
              <li><span>03</span><div><b>Choose from the best</b><p>Compare up to five verified pros by fit, trust score, timing and price.</p></div></li>
            </ol>
          </section>

          <section className="proof-section">
            <div className="proof-copy">
              <p className="section-label light">A better signal than stars</p>
              <h2>Trust you can<br />actually <em>use.</em></h2>
              <p>JobDrop Trust Scores combine verified work history, punctuality, communication, licences, insurance and warranty claims.</p>
            </div>
            <div className="score-card">
              <div className="score-top"><span>JobDrop Trust Score</span><b>96<small>/100</small></b></div>
              <div className="score-bar"><i /></div>
              <div className="score-grid"><span><b>100%</b>Verified identity</span><span><b>98%</b>On-time arrival</span><span><b>4.9</b>Verified rating</span><span><b>0</b>Open claims</span></div>
            </div>
          </section>
        </>
      )}

      {view === "request" && (
        <section className="app-shell request-shell">
          <div className="request-header">
            <button className="back-button" onClick={() => step === 0 ? go("discover") : setStep(step - 1)}>← Back</button>
            <div className="stepper" aria-label={`Step ${step + 1} of 4`}>
              {steps.map((name, index) => <span key={name} className={index <= step ? "done" : ""}><i />{name}</span>)}
            </div>
            <span className="save-state">Saved</span>
          </div>

          <div className="request-layout">
            <div className="form-panel">
              {step === 0 && <>
                <p className="step-kicker">Step 1 of 4</p>
                <h1>What needs to be done?</h1>
                <p className="form-intro">Don’t worry about contractor language. Describe it the way you’d tell a neighbour.</p>
                <label className="field-label" htmlFor="category">Service</label>
                <select id="category" value={category} onChange={e => setCategory(e.target.value)}>
                  {categories.map(([name]) => <option key={name}>{name}</option>)}
                </select>
                <label className="field-label" htmlFor="scope">Describe the job</label>
                <textarea id="scope" value={scope} onChange={e => setScope(e.target.value)} rows={5} />
                <div className="tip-row"><span>✦</span><p><b>Good start.</b> We’ll ask two details next, then write the full brief for you.</p></div>
              </>}
              {step === 1 && <>
                <p className="step-kicker">Step 2 of 4</p>
                <h1>A few useful details.</h1>
                <p className="form-intro">This helps pros price your job accurately before they contact you.</p>
                <label className="field-label" htmlFor="size">How large is the area?</label>
                <input id="size" value={size} onChange={e => setSize(e.target.value)} />
                <label className="field-label">What should the quote include?</label>
                <div className="option-grid">
                  {["Materials", "Site protection", "Cleanup", "Disposal"].map((option) => <label key={option} className="check-option"><input type="checkbox" defaultChecked /><span>✓</span>{option}</label>)}
                </div>
                <button className="upload-box" type="button"><span>+</span><b>Add photos or a video</b><small>Optional, but helps improve quote accuracy</small></button>
              </>}
              {step === 2 && <>
                <p className="step-kicker">Step 3 of 4</p>
                <h1>When and where?</h1>
                <p className="form-intro">Your exact address stays private until you accept a quote.</p>
                <label className="field-label" htmlFor="timeline">Preferred timing</label>
                <select id="timeline" value={timeline} onChange={e => setTimeline(e.target.value)}><option>Before Friday</option><option>Within a week</option><option>Within a month</option><option>I’m flexible</option></select>
                <label className="field-label" htmlFor="budget">Target budget</label>
                <select id="budget" value={budget} onChange={e => setBudget(e.target.value)}><option>$1,000–$2,000</option><option>$2,000–$2,500</option><option>$2,500–$5,000</option><option>Need guidance</option></select>
                <label className="field-label" htmlFor="postal">Postal code</label>
                <input id="postal" defaultValue="L8P 1A1" />
                <label className="emergency-toggle"><input type="checkbox" /><span /><div><b>This is an emergency</b><small>Alert available pros immediately</small></div></label>
              </>}
              {step === 3 && <>
                <p className="step-kicker ai-kicker">✦ AI-polished request</p>
                <h1>Clear scope. Better quotes.</h1>
                <p className="form-intro">Review the brief we’ll send to qualified {category.toLowerCase()} pros near you.</p>
                <div className="brief-card">
                  <div className="brief-head"><span>{category}</span><button type="button" onClick={() => setStep(0)}>Edit</button></div>
                  <h3>{scope}</h3>
                  <p>{jobBrief}</p>
                  <div className="brief-tags"><span>◷ {timeline}</span><span>⌂ Hamilton, ON</span><span>◎ {budget}</span></div>
                </div>
                <div className="privacy-note"><span>✓</span><p><b>Your contact details stay private.</b> Pros can only message through JobDrop until you choose one.</p></div>
              </>}
              <div className="form-footer">
                <span>{step < 3 ? "Usually takes less than a minute" : "Free to post · no obligation"}</span>
                <button onClick={() => step < 3 ? setStep(step + 1) : go("matches")}>{step < 3 ? "Continue" : "Send to matched pros"} <span>→</span></button>
              </div>
            </div>

            <aside className="request-aside">
              <p className="aside-label">Your request</p>
              <div className="aside-service"><span>{category.slice(0, 2).toUpperCase()}</span><div><b>{category}</b><small>Hamilton, Ontario</small></div></div>
              <div className="aside-divider" />
              <p className="aside-label">What happens next</p>
              <ol><li><span>1</span>We verify the request</li><li><span>2</span>Top local pros are matched</li><li><span>3</span>You compare up to 5 quotes</li></ol>
              <div className="aside-proof"><b>✓ No spam, ever</b><p>Only your matched pros can respond.</p></div>
            </aside>
          </div>
        </section>
      )}

      {view === "matches" && (
        <section className="app-shell matches-shell">
          <div className="dashboard-heading">
            <div><p className="step-kicker">Request JD-2048</p><h1>Your best matches.</h1><p>We ranked 12 available pros. Here are the top 3 for your drywall repair.</p></div>
            <div className="matching-status"><span><i /></span><div><b>Quotes are live</b><small>Last updated just now</small></div></div>
          </div>
          <div className="job-summary-strip"><span><b>Drywall repair</b>Finished basement · Hamilton</span><span><b>Target</b>Before Friday</span><span><b>Budget</b>$2,000–$2,500</span><button onClick={() => { setStep(3); go("request"); }}>View request</button></div>
          <div className="match-layout">
            <div className="contractor-list">
              {contractors.map((pro, index) => (
                <article className={`contractor-card ${index === 0 ? "featured" : ""}`} key={pro.name}>
                  <div className="rank">0{index + 1}</div>
                  <div className="pro-logo" style={{ background: pro.color }}>{pro.initials}</div>
                  <div className="pro-main">
                    <div className="pro-title"><div><span className="match-badge">{pro.badge}</span><h2>{pro.name} <small>✓</small></h2></div><div className="trust-score"><b>{pro.score}</b><span>Trust score</span></div></div>
                    <div className="pro-facts"><span><b>★ {pro.rating}</b> ({pro.reviews})</span><span>{pro.jobs}</span><span>Insured</span><span>Background checked</span></div>
                    <div className="quote-row"><div><small>Available</small><b>{pro.arrival}</b></div><div><small>Estimated quote</small><b className="quote-price">{pro.price}</b></div></div>
                    <p className="quote-note">✓ {pro.note}</p>
                    <div className="card-actions"><button className="secondary-action">View profile</button><button className="primary-action" onClick={() => setAccepted(pro.name)}>{accepted === pro.name ? "Quote accepted ✓" : "Choose this pro"}</button></div>
                  </div>
                </article>
              ))}
            </div>
            <aside className="insight-card">
              <span className="insight-icon">✦</span>
              <p className="aside-label">JobDrop insight</p>
              <h3>North & Beam is your strongest fit.</h3>
              <p>They’re 8 km away, have completed 42 similar jobs and respond 37% faster than average.</p>
              <div><span>Job similarity</span><b>98%</b></div><div><span>Schedule fit</span><b>95%</b></div><div><span>Price confidence</span><b>High</b></div>
              <button onClick={() => setAccepted("North & Beam Drywall")}>Choose best match →</button>
            </aside>
          </div>
          {accepted && <div className="accepted-banner"><span>✓</span><div><b>{accepted} has been selected.</b><p>Your booking is ready. Follow the live job timeline from arrival to completion.</p></div><button onClick={() => go("tracking")}>Track this job →</button></div>}
        </section>
      )}

      {view === "tracking" && (
        <section className="app-shell tracking-shell">
          <div className="tracking-top">
            <div><p className="step-kicker">Active job · JD-2048</p><h1>Your job is underway.</h1><p>Drywall repair with North & Beam Drywall</p></div>
            <button className="support-button">Need help?</button>
          </div>
          <div className="tracking-layout">
            <div className="live-card">
              <div className="live-map">
                <div className="road road-one" /><div className="road road-two" /><div className="road road-three" />
                <div className="map-label label-one">Dundurn St.</div><div className="map-label label-two">Main St. W.</div>
                <span className="home-pin">⌂</span><span className="crew-pin">NB</span>
              </div>
              <div className="arrival-panel"><span className="pulse-icon"><i /></span><div><small>Crew is on the way</small><h2>Arriving in 14 minutes</h2><p>Alex and Jordan · white Ford Transit</p></div><button>Message crew</button></div>
            </div>
            <aside className="job-detail-card">
              <p className="aside-label">Today’s progress</p>
              <ol className="timeline">
                <li className="complete"><span>✓</span><div><b>Materials picked up</b><small>7:42 AM</small></div></li>
                <li className="current"><span><i /></span><div><b>Crew is on the way</b><small>8:06 AM</small></div></li>
                <li><span>3</span><div><b>Work started</b><small>Next</small></div></li>
                <li><span>4</span><div><b>Finishing & cleanup</b></div></li>
                <li><span>5</span><div><b>Final walkthrough</b></div></li>
              </ol>
            </aside>
          </div>
          <div className="tracking-bottom">
            <div><p className="aside-label">Project details</p><h3>Basement drywall repair</h3><span>Today · 8:30 AM–4:30 PM</span></div>
            <div><p className="aside-label">Agreed quote</p><h3>$2,280</h3><span>Payment protected by JobDrop</span></div>
            <div><p className="aside-label">Documents</p><button>View contract ↗</button><button>View quote ↗</button></div>
          </div>
        </section>
      )}

      <footer>
        <div className="brand footer-brand"><span className="brand-mark"><i /></span><span>JobDrop</span></div>
        <p>Local work, matched better.</p>
        <div><button>How it works</button><button>Trust & safety</button><button>For contractors</button><button>Help</button></div>
        <span>© 2026 JobDrop · Hamilton, Ontario</span>
      </footer>
    </main>
  );
}
