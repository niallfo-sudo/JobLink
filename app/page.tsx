"use client";

import { FormEvent, useMemo, useState } from "react";

type View = "discover" | "request" | "matches" | "tracking" | "contractor";
type ProTab = "overview" | "opportunities" | "jobs" | "inbox" | "business";

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

const opportunities = [
  { id: "JD-2194", service: "Drywall", title: "Repair water-damaged basement ceiling", distance: "6.2 km", budget: "$1,800–$2,400", timing: "This week", match: 98, posted: "4 min ago", details: "Approx. 180 sq. ft. Remove damaged board, inspect insulation, replace, tape, mud and sand. Photos attached." },
  { id: "JD-2191", service: "Painting", title: "Paint main floor and stairwell", distance: "9.8 km", budget: "$3,000–$4,500", timing: "Within 2 weeks", match: 94, posted: "18 min ago", details: "Living room, dining room, hallway and open stairwell. Walls only; customer will select colours." },
  { id: "JD-2187", service: "Drywall", title: "Board and finish new garage", distance: "14.1 km", budget: "$4,500–$6,000", timing: "Flexible", match: 91, posted: "36 min ago", details: "Two-car detached garage, walls and ceiling. Insulation complete. Fire-rated board required on shared wall." },
];

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
  const [proTab, setProTab] = useState<ProTab>("overview");
  const [quoteJob, setQuoteJob] = useState<(typeof opportunities)[number] | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("2280");
  const [quoteSent, setQuoteSent] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [sentMessages, setSentMessages] = useState<string[]>([]);

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
      <header className={`site-header ${view === "contractor" ? "pro-header" : ""}`}>
        <button className="brand" onClick={() => go("discover")} aria-label="JobDrop home">
          <span className="brand-mark"><i /></span>
          <span>JobDrop</span>
        </button>
        {view === "contractor" ? (
          <nav aria-label="Contractor navigation">
            <button className={proTab === "overview" ? "active" : ""} onClick={() => setProTab("overview")}>Overview</button>
            <button className={proTab === "opportunities" ? "active" : ""} onClick={() => setProTab("opportunities")}>Opportunities</button>
            <button className={proTab === "jobs" ? "active" : ""} onClick={() => setProTab("jobs")}>Jobs</button>
            <button className={proTab === "inbox" ? "active" : ""} onClick={() => setProTab("inbox")}>Inbox</button>
            <button className={proTab === "business" ? "active" : ""} onClick={() => setProTab("business")}>Business</button>
          </nav>
        ) : (
          <nav aria-label="Main navigation">
            <button className={view === "discover" ? "active" : ""} onClick={() => go("discover")}>Find a pro</button>
            <button className={view === "matches" ? "active" : ""} onClick={() => go("matches")}>My request</button>
            <button className={view === "tracking" ? "active" : ""} onClick={() => go("tracking")}>Track job</button>
          </nav>
        )}
        <div className="header-actions">
          <button className="text-button" onClick={() => go(view === "contractor" ? "discover" : "contractor")}>{view === "contractor" ? "Homeowner view" : "For contractors"}</button>
          <button className="avatar-button" aria-label="Open profile">{view === "contractor" ? "NB" : "NL"}</button>
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

      {view === "contractor" && (
        <section className="pro-shell">
          <div className="pro-banner">
            <div className="pro-company"><span>NB</span><div><b>North & Beam Drywall</b><small>Verified business · Hamilton, ON</small></div></div>
            <div className="pro-availability"><span><i /></span><div><b>Accepting new work</b><small>Visible to matched customers</small></div></div>
          </div>

          {proTab === "overview" && (
            <div className="pro-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Wednesday, July 22</p><h1>Good morning, Alex.</h1><p>Three strong opportunities arrived near Hamilton this morning.</p></div><button className="primary-action" onClick={() => setProTab("opportunities")}>View opportunities →</button></div>
              <div className="pro-metrics">
                <article><span>Open opportunities</span><b>8</b><small><i className="up">↑ 3</i> since yesterday</small></article>
                <article><span>Quotes awaiting reply</span><b>4</b><small>$9,840 potential value</small></article>
                <article><span>Booked this month</span><b>$18,420</b><small><i className="up">↑ 12%</i> from June</small></article>
                <article><span>Trust score</span><b>96</b><small>Top 4% in Hamilton</small></article>
              </div>
              <div className="pro-overview-grid">
                <div className="pro-panel">
                  <div className="pro-panel-head"><div><p className="aside-label">Recommended work</p><h2>Best opportunities for you</h2></div><button onClick={() => setProTab("opportunities")}>View all 8</button></div>
                  {opportunities.slice(0, 2).map((job) => (
                    <article className="opportunity-row" key={job.id}>
                      <div className="match-ring"><b>{job.match}</b><small>match</small></div>
                      <div className="opportunity-copy"><span>{job.service} · {job.distance}</span><h3>{job.title}</h3><p>{job.budget} · {job.timing}</p></div>
                      <div className="opportunity-action"><small>{job.posted}</small><button onClick={() => setQuoteJob(job)}>Quote job →</button></div>
                    </article>
                  ))}
                </div>
                <aside className="trust-panel">
                  <div className="trust-panel-top"><div><p className="aside-label">Your reputation</p><h2>96<small>/100</small></h2></div><span>Excellent</span></div>
                  <div className="score-bar"><i /></div>
                  <dl><div><dt>Response speed</dt><dd>8 min</dd></div><div><dt>On-time arrival</dt><dd>98%</dd></div><div><dt>Completion rate</dt><dd>100%</dd></div><div><dt>Repeat customers</dt><dd>31%</dd></div></dl>
                  <button onClick={() => setProTab("business")}>Improve your profile →</button>
                </aside>
              </div>
              <div className="pro-panel pipeline-panel">
                <div className="pro-panel-head"><div><p className="aside-label">This week</p><h2>Job pipeline</h2></div><button onClick={() => setProTab("jobs")}>Manage jobs</button></div>
                <div className="pipeline-grid">
                  <article><span className="pipeline-day">Wed 22</span><div><small>8:30 AM</small><b>Basement drywall repair</b><p>West Hamilton · $2,280</p></div><em className="status-live">In progress</em></article>
                  <article><span className="pipeline-day">Thu 23</span><div><small>9:00 AM</small><b>Kitchen ceiling patch</b><p>Dundas · $860</p></div><em>Confirmed</em></article>
                  <article><span className="pipeline-day">Fri 24</span><div><small>7:30 AM</small><b>Garage boarding</b><p>Ancaster · $4,640</p></div><em>Confirmed</em></article>
                </div>
              </div>
            </div>
          )}

          {proTab === "opportunities" && (
            <div className="pro-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Matched for North & Beam</p><h1>New opportunities.</h1><p>Only jobs that fit your services, territory, availability and work history.</p></div><div className="opportunity-count"><b>8</b><span>available now</span></div></div>
              <div className="filter-bar"><button className="selected">Best match</button><button>Nearest</button><button>Newest</button><span /><label>Within <select defaultValue="30"><option>15</option><option>30</option><option>50</option></select> km</label></div>
              <div className="opportunity-layout">
                <div className="opportunity-list">
                  {opportunities.map((job, index) => (
                    <article className="opportunity-card" key={job.id}>
                      <div className="opportunity-card-head"><div><span className="service-pill">{job.service}</span><span className="fresh-pill">{job.posted}</span></div><div className="match-number"><b>{job.match}%</b><small>match</small></div></div>
                      <h2>{job.title}</h2>
                      <p>{job.details}</p>
                      <div className="job-facts"><span><small>Distance</small><b>{job.distance}</b></span><span><small>Customer budget</small><b>{job.budget}</b></span><span><small>Timeline</small><b>{job.timing}</b></span></div>
                      <div className="job-fit"><span>Why it fits</span><p>{index === 0 ? "42 similar jobs · Schedule open · 6 km away" : index === 1 ? "Painting verified · Strong price history · Repeat area" : "Commercial board experience · Flexible schedule"}</p></div>
                      <div className="opportunity-card-actions"><button className="secondary-action">Not interested</button><button className="primary-action" onClick={() => setQuoteJob(job)}>{quoteSent === job.id ? "Quote sent ✓" : "Build a quote →"}</button></div>
                    </article>
                  ))}
                </div>
                <aside className="match-explainer"><span>✦</span><p className="aside-label">Smart matching</p><h3>Quality over quantity.</h3><p>You only see work where you’re likely to win and deliver an excellent result. Customers see no more than five pros.</p><dl><div><dt>Average drive</dt><dd>9.4 km</dd></div><div><dt>Your win rate</dt><dd>38%</dd></div><div><dt>Typical response</dt><dd>8 min</dd></div></dl></aside>
              </div>
            </div>
          )}

          {proTab === "jobs" && (
            <div className="pro-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Operations</p><h1>Jobs and schedule.</h1><p>Everything booked, underway and waiting for payment.</p></div><button className="primary-action">+ Add off-platform job</button></div>
              <div className="job-tabs"><button className="selected">Active <span>3</span></button><button>Upcoming <span>4</span></button><button>Completed</button><button>Quotes <span>4</span></button></div>
              <div className="jobs-board">
                <article className="active-job-feature">
                  <div className="active-job-top"><span className="status-live">In progress</span><small>JD-2048</small></div><h2>Basement drywall repair</h2><p>Niall L. · West Hamilton</p>
                  <div className="progress-line"><i /></div><div className="progress-labels"><span>Started 8:31 AM</span><b>45% complete</b><span>Est. finish 4:30 PM</span></div>
                  <div className="crew-line"><div><span>AJ</span><span>JR</span><p><b>Alex & Jordan</b><small>Crew on site</small></p></div><div><b>$2,280</b><small>Protected payment</small></div></div>
                  <div className="active-job-actions"><button>Message customer</button><button>Update progress</button><button className="primary-action">Create change order</button></div>
                </article>
                <div className="upcoming-stack">
                  <p className="aside-label">Next up</p>
                  <article><span className="calendar-tile"><b>23</b>JUL</span><div><small>Tomorrow · 9:00 AM</small><h3>Kitchen ceiling patch</h3><p>Dundas · Melissa R.</p></div><b>$860</b></article>
                  <article><span className="calendar-tile"><b>24</b>JUL</span><div><small>Friday · 7:30 AM</small><h3>Board and finish garage</h3><p>Ancaster · Steve K.</p></div><b>$4,640</b></article>
                  <article><span className="calendar-tile"><b>27</b>JUL</span><div><small>Monday · 8:00 AM</small><h3>Living room skim coat</h3><p>Hamilton · Priya S.</p></div><b>$1,420</b></article>
                </div>
              </div>
              <div className="pro-panel payment-panel"><div><p className="aside-label">Ready for payout</p><h2>$6,740</h2><span>2 completed jobs · Arrives Friday</span></div><button>View payments →</button></div>
            </div>
          )}

          {proTab === "inbox" && (
            <div className="pro-page inbox-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Messages</p><h1>Customer conversations.</h1></div></div>
              <div className="inbox-layout">
                <aside className="conversation-list">
                  <label><span>⌕</span><input placeholder="Search messages" /></label>
                  <button className="selected"><span className="person-avatar orange">NL</span><div><b>Niall L.</b><p>Great, see you shortly.</p><small>Basement drywall · Today</small></div><em>2m</em></button>
                  <button><span className="person-avatar green">MR</span><div><b>Melissa R.</b><p>I’ve added two more photos.</p><small>Ceiling patch · Tomorrow</small></div><em>1h</em></button>
                  <button><span className="person-avatar blue">SK</span><div><b>Steve K.</b><p>Friday at 7:30 works.</p><small>Garage · Friday</small></div><em>4h</em></button>
                </aside>
                <div className="chat-panel">
                  <div className="chat-head"><div><span className="person-avatar orange">NL</span><div><b>Niall L.</b><small>Basement drywall repair · JD-2048</small></div></div><button>Job details</button></div>
                  <div className="chat-body">
                    <div className="day-divider"><span>Today</span></div>
                    <div className="message customer"><p>Hi Alex, is everything still on schedule for this morning?</p><small>7:51 AM</small></div>
                    <div className="message pro"><p>Good morning! Yes—we’ve picked up the materials and are about 20 minutes away.</p><small>7:54 AM · Read</small></div>
                    <div className="system-message">Crew location shared with customer</div>
                    <div className="message customer"><p>Great, see you shortly.</p><small>8:03 AM</small></div>
                    {sentMessages.map((message, index) => <div className="message pro" key={`${message}-${index}`}><p>{message}</p><small>Just now · Sent</small></div>)}
                  </div>
                  <form className="message-composer" onSubmit={(event) => { event.preventDefault(); if (chatMessage.trim()) { setSentMessages([...sentMessages, chatMessage.trim()]); setChatMessage(""); } }}><button type="button">+</button><input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Write a message…" /><button type="submit">Send →</button></form>
                </div>
              </div>
            </div>
          )}

          {proTab === "business" && (
            <div className="pro-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Business settings</p><h1>Grow on your terms.</h1><p>Simple monthly plans. No lead fees and no charge for services you’re verified to perform.</p></div><span className="founding-badge">Founding contractor pricing</span></div>
              <div className="business-grid">
                <aside className="business-profile">
                  <div className="business-logo">NB</div><h2>North & Beam Drywall</h2><p>Hamilton, Ontario · 25 km service area</p><span className="verified-line">✓ Identity, insurance and licence verified</span>
                  <dl><div><dt>Services</dt><dd>Drywall, Painting</dd></div><div><dt>Team</dt><dd>4 members</dd></div><div><dt>Profile</dt><dd>92% complete</dd></div></dl><button>Edit business profile →</button>
                </aside>
                <div className="plans-area">
                  <div className="plans-heading"><div><p className="aside-label">Current plan</p><h2>Growth</h2></div><b>$129<small>/month</small></b></div>
                  <div className="plan-grid">
                    <article><span>Starter</span><h3>$49<small>/mo</small></h3><p>For an independent pro building a local reputation.</p><ul><li>1 user and crew</li><li>25 km territory</li><li>Unlimited verified services</li><li>Quotes and invoicing</li></ul><button>Switch plan</button></article>
                    <article className="current-plan"><span>Growth · Current</span><h3>$129<small>/mo</small></h3><p>For a growing team that wants more work and automation.</p><ul><li>Up to 5 team members</li><li>50 km territory</li><li>Scheduling and dispatch</li><li>Performance insights</li></ul><button>Current plan ✓</button></article>
                    <article><span>Pro</span><h3>$299<small>/mo</small></h3><p>For multi-crew businesses managing several territories.</p><ul><li>Unlimited team members</li><li>Multiple territories</li><li>Advanced operations</li><li>Priority support</li></ul><button>Upgrade to Pro</button></article>
                  </div>
                  <div className="fee-note"><span>◎</span><div><b>You keep 100% of your quoted labour price.</b><p>When customers pay through JobDrop, they cover a separate booking and protection fee. We never charge you per lead.</p></div></div>
                </div>
              </div>
            </div>
          )}

          {quoteJob && (
            <div className="quote-overlay" role="dialog" aria-modal="true" aria-labelledby="quote-title">
              <button className="overlay-close" onClick={() => setQuoteJob(null)} aria-label="Close quote builder">×</button>
              <div className="quote-drawer">
                <p className="step-kicker">AI-assisted quote · {quoteJob.id}</p><h2 id="quote-title">Send a confident quote.</h2><p className="quote-job-title">{quoteJob.title}</p>
                <div className="quote-scope"><span>✦</span><div><b>Scope checked</b><p>{quoteJob.details}</p></div></div>
                <label className="field-label" htmlFor="quote-price">Your estimated price</label><div className="price-input"><span>$</span><input id="quote-price" value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} inputMode="decimal" /><em>CAD</em></div>
                <div className="quote-breakdown"><div><span>Labour</span><b>$1,420</b></div><div><span>Materials</span><b>$640</b></div><div><span>Protection & cleanup</span><b>$220</b></div><div className="total"><span>Estimated total</span><b>${Number(quoteAmount || 0).toLocaleString()}</b></div></div>
                <label className="field-label" htmlFor="quote-note">Message to customer</label><textarea id="quote-note" defaultValue="Hi! We’ve completed many similar repairs nearby. This estimate includes materials, site protection, three finish coats, sanding and cleanup." rows={4} />
                <label className="field-label" htmlFor="quote-date">Earliest start</label><select id="quote-date" defaultValue="Tomorrow, 8:00 AM"><option>Tomorrow, 8:00 AM</option><option>Thursday, 9:00 AM</option><option>Friday, 7:30 AM</option></select>
                <div className="quote-protection"><span>✓</span><p>Customer contact details remain private until they accept your quote.</p></div>
                <button className="send-quote" onClick={() => { setQuoteSent(quoteJob.id); setQuoteJob(null); }}>Send ${Number(quoteAmount || 0).toLocaleString()} quote →</button>
              </div>
            </div>
          )}
        </section>
      )}

      <footer>
        <div className="brand footer-brand"><span className="brand-mark"><i /></span><span>JobDrop</span></div>
        <p>Local work, matched better.</p>
        <div><button onClick={() => go("discover")}>How it works</button><button>Trust & safety</button><button onClick={() => go("contractor")}>For contractors</button><button>Help</button></div>
        <span>© 2026 JobDrop · Hamilton, Ontario</span>
      </footer>
    </main>
  );
}
