"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "discover" | "request" | "matches" | "tracking" | "contractor" | "account" | "trust" | "help" | "onboarding" | "silent" | "emergency" | "admin";
type ProTab = "overview" | "opportunities" | "jobs" | "inbox" | "business";
type AccountTab = "jobs" | "payments" | "documents" | "saved";
type AdminTab = "overview" | "verification" | "fraud" | "disputes";
type PersistedJob = { id: number; externalId: string; category: string; title: string; status: string; budget: string; createdAt: string | number };
type PersistedQuote = { id: number; contractorName: string; amountCents: number; message: string; availableAt: string; status: string };
type Opportunity = { numericId?: number; id: string; service: string; title: string; distance: string; budget: string; timing: string; match: number; posted: string; details: string };
type RoomMessage = { id: number; body: string; mine: boolean; createdAt: string | number };
type RoomEvent = { id: number; label: string; eventType: string; createdAt: string | number };
type ContractorProfile = { businessName: string; legalName: string; phone: string; about: string; primaryService: string; services: string[]; homeBase: string; serviceRadiusKm: number; teamSize: number; emergencyAvailable: boolean; acceptingWork: boolean; plan: "starter" | "growth" | "pro"; verificationStatus: string };

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

const opportunities: Opportunity[] = [
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
  const [quoteJob, setQuoteJob] = useState<Opportunity | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("2280");
  const [quoteSent, setQuoteSent] = useState<string | null>(null);
  const [quoteNote, setQuoteNote] = useState("Hi! We’ve completed many similar repairs nearby. This estimate includes materials, site protection, three finish coats, sanding and cleanup.");
  const [quoteAvailability, setQuoteAvailability] = useState("Tomorrow, 8:00 AM");
  const [quoteSubmitStatus, setQuoteSubmitStatus] = useState<"idle" | "saving" | "error">("idle");
  const [chatMessage, setChatMessage] = useState("");
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [accountTab, setAccountTab] = useState<AccountTab>("jobs");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [supportSent, setSupportSent] = useState(false);
  const [negotiating, setNegotiating] = useState(false);
  const [negotiated, setNegotiated] = useState(false);
  const [changeOrderOpen, setChangeOrderOpen] = useState(false);
  const [changeOrderSent, setChangeOrderSent] = useState(false);
  const [emergencyStage, setEmergencyStage] = useState(0);
  const [silentStage, setSilentStage] = useState(0);
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedRequestId, setSavedRequestId] = useState<string | null>(null);
  const [persistedJobs, setPersistedJobs] = useState<PersistedJob[]>([]);
  const [liveOpportunities, setLiveOpportunities] = useState<Opportunity[]>([]);
  const [selectedSavedJob, setSelectedSavedJob] = useState<PersistedJob | null>(null);
  const [savedQuotes, setSavedQuotes] = useState<PersistedQuote[]>([]);
  const [savedQuotesStatus, setSavedQuotesStatus] = useState<"idle" | "loading" | "error">("idle");
  const [acceptedQuoteId, setAcceptedQuoteId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<PersistedJob[]>([]);
  const [roomJob, setRoomJob] = useState<PersistedJob | null>(null);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [roomEvents, setRoomEvents] = useState<RoomEvent[]>([]);
  const [roomText, setRoomText] = useState("");
  const [roomStatus, setRoomStatus] = useState<"idle" | "loading" | "sending" | "error">("idle");
  const [contractorProfile, setContractorProfile] = useState<ContractorProfile | null>(null);
  const [businessName, setBusinessName] = useState("North & Beam Drywall");
  const [legalName, setLegalName] = useState("North & Beam Drywall Inc.");
  const [businessPhone, setBusinessPhone] = useState("(905) 555-0148");
  const [businessAbout, setBusinessAbout] = useState("Residential and light-commercial drywall installation, repair and finishing across Hamilton and surrounding communities.");
  const [primaryService, setPrimaryService] = useState("Drywall");
  const [selectedServices, setSelectedServices] = useState(["Drywall repair", "Drywall installation", "Taping & finishing", "Plaster repair"]);
  const [homeBase, setHomeBase] = useState("Hamilton, Ontario");
  const [serviceRadius, setServiceRadius] = useState(30);
  const [emergencyAvailable, setEmergencyAvailable] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "growth" | "pro">("growth");
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const jobBrief = useMemo(
    () =>
      `Looking for an experienced ${category.toLowerCase()} contractor to ${scope.toLowerCase()}. Scope is approximately ${size.toLowerCase()} and includes protection, materials, finishing and cleanup. Customer prefers completion ${timeline.toLowerCase()} with a target budget of ${budget}.`,
    [category, scope, size, timeline, budget],
  );

  useEffect(() => {
    if (view !== "account") return;
    fetch("/api/jobs")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { jobs?: PersistedJob[] }) => setPersistedJobs(data.jobs ?? []))
      .catch(() => undefined);
  }, [view]);

  useEffect(() => {
    if (view !== "contractor") return;
    fetch("/api/opportunities")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { jobs?: Array<{ id: number; externalId: string; category: string; title: string; description: string; budget: string; timeline: string; emergency: boolean }> }) => {
        setLiveOpportunities((data.jobs ?? []).map((job, index) => ({
          numericId: job.id,
          id: job.externalId,
          service: job.category,
          title: job.title,
          distance: "Within service area",
          budget: job.budget,
          timing: job.timeline,
          match: Math.max(88, 99 - index * 2),
          posted: job.emergency ? "Emergency" : "New request",
          details: job.description,
        })));
      })
      .catch(() => undefined);
  }, [view]);

  useEffect(() => {
    if (view !== "contractor") return;
    fetch("/api/conversations")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { conversations?: PersistedJob[] }) => setConversations(data.conversations ?? []))
      .catch(() => undefined);
  }, [view, quoteSent]);

  useEffect(() => {
    if (view !== "contractor" && view !== "onboarding") return;
    fetch("/api/contractor-profile")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { profile?: ContractorProfile | null }) => {
        if (!data.profile) return;
        const profile = data.profile;
        setContractorProfile(profile);
        setBusinessName(profile.businessName);
        setLegalName(profile.legalName);
        setBusinessPhone(profile.phone);
        setBusinessAbout(profile.about);
        setPrimaryService(profile.primaryService);
        setSelectedServices(profile.services);
        setHomeBase(profile.homeBase);
        setServiceRadius(profile.serviceRadiusKm);
        setEmergencyAvailable(profile.emergencyAvailable);
        setSelectedPlan(profile.plan);
      })
      .catch(() => undefined);
  }, [view]);

  const availableOpportunities = useMemo(() => {
    const liveIds = new Set(liveOpportunities.map((job) => job.id));
    return [...liveOpportunities, ...opportunities.filter((job) => !liveIds.has(job.id))];
  }, [liveOpportunities]);

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

  async function saveJobRequest() {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: scope, description: jobBrief, size, timeline, budget, postalCode: "L8P 1A1", emergency: false }),
      });
      if (!response.ok) throw new Error("Unable to save request");
      const data = (await response.json()) as { job: { externalId: string } };
      setSavedRequestId(data.job.externalId);
      setSaveStatus("saved");
      go("matches");
    } catch {
      setSaveStatus("error");
    }
  }

  async function submitQuote() {
    if (!quoteJob) return;
    if (!quoteJob.numericId) {
      setQuoteSent(quoteJob.id);
      setQuoteJob(null);
      return;
    }
    setQuoteSubmitStatus("saving");
    try {
      const response = await fetch(`/api/jobs/${quoteJob.numericId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(quoteAmount), message: quoteNote, availableAt: quoteAvailability, contractorName: contractorProfile?.businessName || businessName }),
      });
      if (!response.ok) throw new Error("Unable to submit quote");
      setQuoteSent(quoteJob.id);
      setQuoteSubmitStatus("idle");
      setQuoteJob(null);
    } catch {
      setQuoteSubmitStatus("error");
    }
  }

  function openQuote(job: Opportunity) {
    setQuoteSubmitStatus("idle");
    setQuoteJob(job);
  }

  async function loadSavedQuotes(job: PersistedJob) {
    setSelectedSavedJob(job);
    setSavedQuotesStatus("loading");
    setAcceptedQuoteId(null);
    try {
      const response = await fetch(`/api/jobs/${job.id}/quotes`);
      if (!response.ok) throw new Error("Unable to load quotes");
      const data = (await response.json()) as { quotes?: PersistedQuote[] };
      setSavedQuotes(data.quotes ?? []);
      setAcceptedQuoteId(data.quotes?.find((quote) => quote.status === "accepted")?.id ?? null);
      setSavedQuotesStatus("idle");
    } catch {
      setSavedQuotesStatus("error");
    }
  }

  async function acceptSavedQuote(quote: PersistedQuote) {
    if (!selectedSavedJob) return;
    setSavedQuotesStatus("loading");
    try {
      const response = await fetch(`/api/jobs/${selectedSavedJob.id}/quotes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id }),
      });
      if (!response.ok) throw new Error("Unable to accept quote");
      setAcceptedQuoteId(quote.id);
      setSavedQuotes((current) => current.map((item) => ({ ...item, status: item.id === quote.id ? "accepted" : "declined" })));
      setPersistedJobs((current) => current.map((job) => job.id === selectedSavedJob.id ? { ...job, status: "booked" } : job));
      setSavedQuotesStatus("idle");
    } catch {
      setSavedQuotesStatus("error");
    }
  }

  async function openJobRoom(job: PersistedJob) {
    setRoomJob(job);
    setRoomStatus("loading");
    try {
      const response = await fetch(`/api/jobs/${job.id}`);
      if (!response.ok) throw new Error("Unable to load job room");
      const data = (await response.json()) as { messages?: RoomMessage[]; events?: RoomEvent[] };
      setRoomMessages(data.messages ?? []);
      setRoomEvents(data.events ?? []);
      setRoomStatus("idle");
    } catch {
      setRoomStatus("error");
    }
  }

  async function sendRoomMessage(event: FormEvent) {
    event.preventDefault();
    if (!roomJob || !roomText.trim()) return;
    setRoomStatus("sending");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: roomJob.id, body: roomText.trim() }),
      });
      if (!response.ok) throw new Error("Unable to send message");
      const data = (await response.json()) as { message: RoomMessage };
      setRoomMessages((current) => [...current, data.message]);
      setRoomText("");
      setRoomStatus("idle");
    } catch {
      setRoomStatus("error");
    }
  }

  async function saveContractorProfile() {
    setProfileStatus("saving");
    try {
      const response = await fetch("/api/contractor-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, legalName, phone: businessPhone, about: businessAbout, primaryService, services: selectedServices, homeBase, serviceRadiusKm: serviceRadius, teamSize: 4, emergencyAvailable, acceptingWork: true, plan: selectedPlan }),
      });
      if (!response.ok) throw new Error("Unable to save profile");
      const data = (await response.json()) as { profile: ContractorProfile };
      setContractorProfile(data.profile);
      setProfileStatus("saved");
      setOnboardingStep(4);
    } catch {
      setProfileStatus("error");
    }
  }

  async function updateContractorProfile(updates: Partial<Pick<ContractorProfile, "plan" | "acceptingWork" | "emergencyAvailable" | "serviceRadiusKm">>) {
    setProfileStatus("saving");
    try {
      const response = await fetch("/api/contractor-profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      if (!response.ok) throw new Error("Unable to update profile");
      const data = (await response.json()) as { profile: ContractorProfile };
      setContractorProfile(data.profile);
      setSelectedPlan(data.profile.plan);
      setProfileStatus("saved");
    } catch {
      setProfileStatus("error");
    }
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
          <button className="avatar-button" aria-label="Open profile" onClick={() => view === "contractor" ? setProTab("business") : go("account")}>{view === "contractor" ? "NB" : "NL"}</button>
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
            <div className="hero-quick-actions"><button onClick={() => go("emergency")}><span>!</span><div><b>Emergency help</b><small>Alert qualified pros nearby</small></div><em>→</em></button><button onClick={() => go("silent")}><span>◉</span><div><b>Try Silent Mode</b><small>Book a service by voice</small></div><em>→</em></button></div>
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
                <button disabled={saveStatus === "saving"} onClick={() => step < 3 ? setStep(step + 1) : saveJobRequest()}>{step < 3 ? "Continue" : saveStatus === "saving" ? "Saving request…" : saveStatus === "error" ? "Try saving again" : "Send to matched pros"} <span>→</span></button>
              </div>
              {saveStatus === "error" && <p className="save-error">We couldn’t save this request yet. Your answers are still here—please try again.</p>}
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
            <div><p className="step-kicker">Request {savedRequestId ?? "JD-2048"}</p><h1>Your best matches.</h1><p>We ranked 12 available pros. Here are the top 3 for your drywall repair.</p>{savedRequestId && <span className="persisted-note">✓ Saved to your JobDrop account</span>}</div>
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
              <button className="negotiate-button" onClick={() => { setNegotiating(true); setNegotiated(false); }}>Ask AI to negotiate</button>
            </aside>
          </div>
          {negotiating && <div className="negotiation-panel"><div className="negotiation-head"><span>✦</span><div><p className="aside-label">AI negotiation</p><h3>{negotiated ? "A better option is ready." : "What would make this quote work?"}</h3></div><button onClick={() => setNegotiating(false)}>×</button></div>{negotiated ? <div className="negotiation-result"><div><span>Original quote</span><s>$2,280</s></div><div><span>Updated quote</span><b>$2,150</b></div><p>North & Beam can reduce the price by $130 if the work starts tomorrow and you provide clear access to the basement before 8:00 AM.</p><button onClick={() => { setAccepted("North & Beam Drywall"); setNegotiating(false); }}>Accept $2,150 quote →</button></div> : <><div className="negotiation-options"><button onClick={() => setNegotiated(true)}>My budget is $2,150</button><button onClick={() => setNegotiated(true)}>Can the scope be adjusted?</button><button onClick={() => setNegotiated(true)}>I can be flexible on timing</button></div><label>Add a note<input placeholder="e.g. I can clear the room before arrival" /></label></>}</div>}
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

      {view === "silent" && (
        <section className="silent-page">
          <div className="silent-intro"><p className="section-label light">JobDrop Silent Mode</p><h1>Say the problem.<br /><em>Everything else happens.</em></h1><p>JobDrop can create the request, gather qualified quotes and bring back one simple decision—without searching, calling or opening an app.</p><button onClick={() => setSilentStage(1)}>Start voice demo →</button></div>
          <div className="voice-demo">
            <div className={`voice-orb stage-${silentStage}`}><i /><span>{silentStage === 0 ? "◉" : silentStage === 1 ? "≈" : silentStage === 2 ? "✦" : "✓"}</span></div>
            <div className="voice-copy">
              {silentStage === 0 && <><small>Ready when you are</small><h2>“Find someone to fix my furnace tomorrow.”</h2><p>Tap Start voice demo to see JobDrop handle the request.</p></>}
              {silentStage === 1 && <><small>Listening and understanding</small><h2>Furnace repair · Tomorrow</h2><p>“Is the furnace completely off, and do you smell gas?”</p><div className="voice-answer"><button onClick={() => setSilentStage(2)}>It’s off. No gas smell.</button></div></>}
              {silentStage === 2 && <><small>Matching verified HVAC professionals</small><h2>Checking 14 nearby companies…</h2><div className="silent-progress"><i /></div><p>Availability · licences · insurance · price history · response speed</p><button onClick={() => setSilentStage(3)}>Show result</button></>}
              {silentStage === 3 && <><small>Best result found</small><h2>Three highly rated HVAC companies are available.</h2><div className="voice-result"><div><span>Best rated</span><b>Maple Air & Heat</b><small>4.9 ★ · 7.2 km · Tomorrow 9–11 AM</small></div><strong>$285</strong></div><p>“Would you like me to book Maple Air & Heat for $285?”</p><div className="voice-answer"><button onClick={() => setSilentStage(0)}>Yes, book it</button><button onClick={() => setSilentStage(2)}>Compare all three</button></div></>}
            </div>
            <ol>{["Ask", "Clarify", "Match", "Book"].map((label,index)=><li key={label} className={index <= silentStage ? "active" : ""}><span>{index+1}</span>{label}</li>)}</ol>
          </div>
          <div className="silent-capabilities"><article><span>01</span><h3>Voice assistants</h3><p>Start from Siri, Google Assistant, Alexa or the JobDrop phone line.</p></article><article><span>02</span><h3>Property monitoring</h3><p>Connected devices can report a leak, outage or maintenance alert.</p></article><article><span>03</span><h3>Automatic maintenance</h3><p>Repeat services can be scheduled, quoted and approved within set limits.</p></article></div>
        </section>
      )}

      {view === "emergency" && (
        <section className="emergency-page">
          {emergencyStage === 0 ? <div className="emergency-intake"><div className="emergency-copy"><span className="emergency-mark">!</span><p className="section-label">Priority dispatch</p><h1>Get the right help,<br /><em>right now.</em></h1><p>For urgent home-service problems—not police, fire or medical emergencies. JobDrop alerts verified available professionals nearby.</p><div className="emergency-warning"><b>Immediate danger?</b><p>Call 911 or your local emergency service first.</p></div></div><div className="emergency-form"><p className="step-kicker">Emergency request</p><h2>What’s happening?</h2><div className="emergency-types"><button className="selected"><span>PL</span>Active water leak</button><button><span>HV</span>No heat / HVAC</button><button><span>EL</span>Electrical issue</button><button><span>LK</span>Locked out</button></div><label>Describe the situation<textarea rows={3} defaultValue="Water is leaking from a pipe under the kitchen sink. Main shutoff is accessible." /></label><label>Service address<input defaultValue="225 King Street W, Hamilton, ON" /></label><label className="emergency-consent"><input type="checkbox" defaultChecked /><span>✓</span>I agree to share my approximate location with matched emergency professionals.</label><button onClick={() => setEmergencyStage(1)}>Alert emergency plumbers →</button></div></div> : <div className="dispatch-live"><div className="dispatch-header"><span className="pulse-emergency"><i /></span><div><small>Priority dispatch active · ER-8421</small><h1>Help is responding.</h1><p>We alerted 6 verified emergency plumbers within 12 km.</p></div><button onClick={() => setEmergencyStage(0)}>Cancel request</button></div><div className="dispatch-grid"><div className="dispatch-map"><div className="road road-one"/><div className="road road-two"/><div className="road road-three"/><span className="dispatch-home">⌂</span><span className="dispatch-pro pro-a">HP</span><span className="dispatch-pro pro-b">JP</span><span className="dispatch-pro pro-c">CF</span><div className="dispatch-radius"/></div><aside><p className="aside-label">Best responder</p><div className="responder-head"><span>HP</span><div><h2>Harbour Plumbing</h2><p>4.9 ★ · 97 Trust Score</p></div></div><div className="arrival-time"><small>Estimated arrival</small><b>18 min</b></div><dl><div><dt>Emergency callout</dt><dd>$185</dd></div><div><dt>Hourly rate after arrival</dt><dd>$145</dd></div><div><dt>Identity & insurance</dt><dd>Verified ✓</dd></div></dl><button onClick={() => setEmergencyStage(2)}>Confirm Harbour Plumbing →</button></aside></div>{emergencyStage === 2 && <div className="dispatch-confirmed"><span>✓</span><div><b>Harbour Plumbing is on the way.</b><p>Track arrival and message the plumber from this screen.</p></div><button onClick={() => go("tracking")}>Open live tracking →</button></div>}</div>}
        </section>
      )}

      {view === "admin" && (
        <section className="admin-shell">
          <header className="admin-head"><div><span className="admin-logo">JD</span><div><b>JobDrop Operations</b><small>Hamilton marketplace · Live</small></div></div><button onClick={() => go("discover")}>Exit operations</button></header>
          <div className="admin-layout"><aside className="admin-nav"><p>Workspace</p><button className={adminTab === "overview" ? "selected" : ""} onClick={() => setAdminTab("overview")}><span>OV</span>Overview</button><button className={adminTab === "verification" ? "selected" : ""} onClick={() => setAdminTab("verification")}><span>VR</span>Verification <b>12</b></button><button className={adminTab === "fraud" ? "selected" : ""} onClick={() => setAdminTab("fraud")}><span>FR</span>Fraud review <b>4</b></button><button className={adminTab === "disputes" ? "selected" : ""} onClick={() => setAdminTab("disputes")}><span>DS</span>Disputes <b>3</b></button><div className="admin-system"><span><i /></span><div><b>All systems normal</b><small>Last checked just now</small></div></div></aside><div className="admin-content">
            {adminTab === "overview" && <><div className="admin-title"><div><p className="step-kicker">Wednesday, July 22</p><h1>Marketplace health.</h1></div><div><span><i /></span>Live monitoring</div></div><div className="admin-kpis"><article><span>Jobs posted today</span><b>184</b><small>↑ 14% vs. last Wednesday</small></article><article><span>Match success</span><b>92.4%</b><small>Target: above 90%</small></article><article><span>Active job value</span><b>$428K</b><small>Across 237 jobs</small></article><article><span>Median first quote</span><b>11 min</b><small>↓ 3 min this month</small></article></div><div className="admin-overview-grid"><div className="admin-panel"><div className="admin-panel-title"><h2>Live marketplace</h2><span>Last 60 minutes</span></div><div className="market-bars">{[["Drywall",72],["Plumbing",91],["Painting",60],["Electrical",48],["HVAC",82],["Moving",36]].map(([name,value])=><div key={name}><span>{name}</span><i><b style={{width:`${value}%`}}/></i><strong>{value}</strong></div>)}</div></div><div className="admin-panel alert-panel"><div className="admin-panel-title"><h2>Needs attention</h2><span>19 items</span></div><article><span className="risk red">High</span><div><b>Possible duplicate contractor</b><p>2 businesses · matching bank account</p></div><button onClick={() => setAdminTab("fraud")}>Review</button></article><article><span className="risk amber">Due</span><div><b>Insurance expires tomorrow</b><p>Northcrest Electric · 3 open jobs</p></div><button onClick={() => setAdminTab("verification")}>Review</button></article><article><span className="risk blue">New</span><div><b>Change-order dispute</b><p>JD-2164 · $1,280 contested</p></div><button onClick={() => setAdminTab("disputes")}>Review</button></article></div></div><div className="admin-panel emergency-monitor"><div className="admin-panel-title"><h2>Emergency dispatch</h2><span>3 active</span></div><div><article><span className="pulse-emergency"><i /></span><div><b>Active water leak</b><p>West Hamilton · ER-8421</p></div><strong>Responder arriving in 18 min</strong></article><article><span className="pulse-emergency amber"><i /></span><div><b>No heat · senior resident</b><p>Stoney Creek · ER-8419</p></div><strong>Matching 4 HVAC pros</strong></article></div></div></>}
            {adminTab === "verification" && <><div className="admin-title"><div><p className="step-kicker">Trust operations</p><h1>Verification queue.</h1></div><button>Filter queue</button></div><div className="review-table"><div className="review-head"><span>Business</span><span>Check</span><span>Risk</span><span>Submitted</span><span>Action</span></div>{[["Lakeshore Electric","Master electrician licence","Low","8 min ago"],["Peakline Roofing","Liability insurance","Medium","24 min ago"],["Bluebird Plumbing","Business identity","Low","41 min ago"],["Citywide Renovations","Ownership and banking","High","1h ago"]].map((row,index)=><div key={row[0]}><span><b>{row[0]}</b><small>Hamilton, ON · New applicant</small></span><span>{row[1]}</span><em className={`risk ${index===3?"red":index===1?"amber":"blue"}`}>{row[2]}</em><span>{row[3]}</span><button>Open review →</button></div>)}</div></>}
            {adminTab === "fraud" && <><div className="admin-title"><div><p className="step-kicker">Risk operations</p><h1>Fraud review.</h1></div><span className="fraud-score">4 open alerts</span></div><div className="case-grid"><article className="case-card high"><div><span>High risk · FR-1098</span><small>Detected 6 min ago</small></div><h2>Possible duplicate contractor network</h2><p>Two contractor accounts share a payout account, device fingerprint and six portfolio photos.</p><dl><div><dt>Accounts</dt><dd>Premier Reno / GTA Project Co.</dd></div><div><dt>Shared signals</dt><dd>8 of 10</dd></div><div><dt>Jobs at risk</dt><dd>3 · $18,420</dd></div></dl><button>Freeze payouts and investigate →</button></article><article className="case-card"><div><span>Medium risk · FR-1095</span><small>Detected 38 min ago</small></div><h2>Stolen project photos suspected</h2><p>Reverse-image matching found portfolio images on an unrelated US contractor website.</p><dl><div><dt>Account</dt><dd>Ontario Elite Exteriors</dd></div><div><dt>Matched photos</dt><dd>11 of 18</dd></div><div><dt>Current status</dt><dd>Matching paused</dd></div></dl><button>Open evidence →</button></article></div></>}
            {adminTab === "disputes" && <><div className="admin-title"><div><p className="step-kicker">Resolution centre</p><h1>Open disputes.</h1></div><button>View policy guide</button></div><div className="dispute-list"><article><div className="dispute-id"><span>DS-304</span><em>Response due in 2h</em></div><div><h2>Unapproved electrical change order</h2><p>Customer says the $1,280 addition was discussed but never approved in the app.</p><span>JD-2164 · East Hamilton · $8,920 contract</span></div><div className="evidence-count"><b>14</b><small>evidence items</small></div><button>Review case →</button></article><article><div className="dispute-id"><span>DS-301</span><em className="normal">Response due tomorrow</em></div><div><h2>Workmanship warranty claim</h2><p>Ceiling seam became visible six weeks after project completion.</p><span>JD-1988 · Dundas · $3,400 contract</span></div><div className="evidence-count"><b>9</b><small>evidence items</small></div><button>Review case →</button></article></div></>}
          </div></div>
        </section>
      )}

      {view === "account" && (
        <section className="account-shell">
          <div className="account-heading"><div><p className="step-kicker">Homeowner account</p><h1>Your home, handled.</h1><p>Jobs, payments and paperwork in one place.</p></div><button className="primary-action" onClick={() => beginRequest()}>+ Post another job</button></div>
          <div className="account-layout">
            <aside className="account-sidebar">
              <div className="account-person"><span>NL</span><div><b>Niall L.</b><small>Hamilton, Ontario</small></div></div>
              <nav aria-label="Account sections">
                <button className={accountTab === "jobs" ? "selected" : ""} onClick={() => setAccountTab("jobs")}><span>01</span>My jobs <b>3</b></button>
                <button className={accountTab === "payments" ? "selected" : ""} onClick={() => setAccountTab("payments")}><span>02</span>Payments</button>
                <button className={accountTab === "documents" ? "selected" : ""} onClick={() => setAccountTab("documents")}><span>03</span>Documents <b>6</b></button>
                <button className={accountTab === "saved" ? "selected" : ""} onClick={() => setAccountTab("saved")}><span>04</span>Saved pros</button>
              </nav>
              <div className="account-safety"><span>✓</span><div><b>JobDrop protected</b><p>Your active job and payment are covered.</p></div></div>
            </aside>
            <div className="account-content">
              {accountTab === "jobs" && <>
                {persistedJobs.length > 0 && <div className="saved-request-list"><div className="account-section-head"><div><p className="aside-label">Saved to JobDrop</p><h2>Your submitted requests</h2></div><span>{persistedJobs.length} stored</span></div>{persistedJobs.map((job) => <article key={job.id} className={selectedSavedJob?.id === job.id ? "selected-request" : ""}><span>{job.category.slice(0,2).toUpperCase()}</span><div><small>{job.externalId} · {job.status}</small><h3>{job.title}</h3><p>{job.budget}</p></div><button onClick={() => loadSavedQuotes(job)}>Compare quotes →</button></article>)}{selectedSavedJob && <div className="saved-quote-panel"><div className="saved-quote-heading"><div><p className="aside-label">Live quote comparison</p><h3>{selectedSavedJob.externalId}</h3></div><div className="saved-quote-heading-actions"><button onClick={() => openJobRoom(selectedSavedJob)}>Open Job Room</button><button aria-label="Close quote comparison" onClick={() => setSelectedSavedJob(null)}>×</button></div></div>{savedQuotesStatus === "loading" && !savedQuotes.length ? <p className="quote-panel-state">Loading quotes…</p> : savedQuotesStatus === "error" ? <p className="quote-panel-state error">Quotes could not be loaded. Please try again.</p> : <div className="saved-quote-grid">{savedQuotes.map((quote, index) => <article key={quote.id} className={quote.status === "accepted" ? "accepted" : ""}><div><span>{index === 0 ? "Best value" : "Verified pro"}</span><b>{quote.contractorName}</b></div><strong>${(quote.amountCents / 100).toLocaleString()}</strong><p>{quote.message}</p><small>Available {quote.availableAt}</small><button disabled={savedQuotesStatus === "loading" || (acceptedQuoteId !== null && acceptedQuoteId !== quote.id)} onClick={() => acceptSavedQuote(quote)}>{quote.status === "accepted" ? "Selected ✓" : quote.status === "declined" ? "Another pro selected" : "Choose this pro →"}</button></article>)}</div>}</div>}</div>}
                <div className="account-section-head"><div><p className="aside-label">Current</p><h2>Active job</h2></div><button onClick={() => go("tracking")}>Open live tracking →</button></div>
                <article className="account-active-job"><div className="account-job-status"><span><i /></span><div><small>In progress · Arriving in 14 min</small><h3>Basement drywall repair</h3><p>North & Beam Drywall · JD-2048</p></div><b>$2,280</b></div><div className="account-progress"><i /></div><div className="account-job-actions"><span>Started today at 8:31 AM</span><button onClick={() => go("tracking")}>Track job</button><button>Message pro</button></div></article>
                <div className="account-section-head history-head"><div><p className="aside-label">History</p><h2>Past requests</h2></div></div>
                <div className="job-history-list">
                  <article><span className="history-icon">PT</span><div><small>Completed · June 18</small><h3>Main-floor painting</h3><p>Brightline Painting · 5.0 ★</p></div><b>$3,460</b><button>View details →</button></article>
                  <article><span className="history-icon green">PL</span><div><small>Completed · April 3</small><h3>Kitchen faucet replacement</h3><p>Harbour Plumbing · 4.9 ★</p></div><b>$385</b><button>View details →</button></article>
                </div>
              </>}
              {accountTab === "payments" && <>
                <div className="account-section-head"><div><p className="aside-label">Money</p><h2>Payments</h2></div><span className="protected-badge">Protected by JobDrop</span></div>
                <div className="payment-summary"><article><span>Held for active job</span><b>$2,280</b><small>Released after your approval</small></article><article><span>Paid this year</span><b>$3,845</b><small>Across 2 completed jobs</small></article><article><span>Payment method</span><b className="card-ending">•••• 4242</b><small>Visa · Expires 08/29</small></article></div>
                <div className="transaction-table"><div className="transaction-head"><span>Date</span><span>Description</span><span>Status</span><span>Amount</span></div><div><span>Jul 22</span><span><b>North & Beam Drywall</b>Job deposit · JD-2048</span><em>Protected</em><strong>$2,280</strong></div><div><span>Jun 18</span><span><b>Brightline Painting</b>Final payment · JD-1932</span><em className="paid">Paid</em><strong>$3,460</strong></div><div><span>Apr 3</span><span><b>Harbour Plumbing</b>Final payment · JD-1718</span><em className="paid">Paid</em><strong>$385</strong></div></div>
                <div className="payment-explainer"><span>◎</span><div><b>You stay in control of every payment.</b><p>Funds are only released when milestones are approved. Changes require a signed change order before any extra charge.</p></div></div>
              </>}
              {accountTab === "documents" && <>
                <div className="account-section-head"><div><p className="aside-label">Paperwork</p><h2>Documents</h2></div><span>6 files</span></div>
                <div className="document-group"><h3>Basement drywall repair <small>JD-2048</small></h3><article><span className="doc-icon">PDF</span><div><b>Signed service contract</b><small>Signed July 21 · 184 KB</small></div><button>Download ↓</button></article><article><span className="doc-icon">PDF</span><div><b>Accepted quote</b><small>Issued July 21 · 96 KB</small></div><button>Download ↓</button></article><article><span className="doc-icon muted">IMG</span><div><b>Before-work photos</b><small>8 photos · 14.2 MB</small></div><button>View ↗</button></article></div>
                <div className="document-group"><h3>Past jobs</h3><article><span className="doc-icon">PDF</span><div><b>Painting warranty certificate</b><small>Valid until June 2031</small></div><button>Download ↓</button></article><article><span className="doc-icon">PDF</span><div><b>2026 home-services receipts</b><small>2 receipts · Tax-ready bundle</small></div><button>Download ↓</button></article></div>
              </>}
              {accountTab === "saved" && <>
                <div className="account-section-head"><div><p className="aside-label">Your network</p><h2>Saved professionals</h2></div></div>
                <div className="saved-pro-grid"><article><span className="saved-logo orange">BP</span><h3>Brightline Painting</h3><p>Painting · 4.9 ★ · 312 jobs</p><div><span>Last hired June 2026</span><b>98 Trust Score</b></div><button onClick={() => beginRequest(undefined, "Painting")}>Request another quote →</button></article><article><span className="saved-logo green">HP</span><h3>Harbour Plumbing</h3><p>Plumbing · 4.9 ★ · 481 jobs</p><div><span>Last hired April 2026</span><b>97 Trust Score</b></div><button onClick={() => beginRequest(undefined, "Plumbing")}>Request another quote →</button></article><article className="saved-empty"><span>+</span><h3>Build your trusted team</h3><p>Save a professional after comparing quotes or completing a job.</p></article></div>
              </>}
            </div>
          </div>
        </section>
      )}

      {view === "trust" && (
        <section className="trust-page">
          <div className="trust-hero"><div><p className="section-label light">Trust & safety</p><h1>Confidence is<br />built into <em>every job.</em></h1><p>Identity checks, verified credentials, protected payments and real performance history—working before, during and after the job.</p></div><div className="trust-seal"><span>✓</span><b>JobDrop<br />Protected</b><small>Every booked job</small></div></div>
          <div className="trust-process"><div className="trust-process-intro"><p className="section-label">Before anyone can quote</p><h2>We verify the business,<br />not just the profile.</h2><p>Every professional goes through layered checks. Regulated trades require valid credentials before matching is enabled.</p></div><div className="verification-list"><article><span>01</span><div><h3>Identity and business</h3><p>Government ID, business registration, address and banking ownership.</p></div><b>Verified</b></article><article><span>02</span><div><h3>Insurance and licences</h3><p>Coverage dates and trade credentials monitored for expiration.</p></div><b>Monitored</b></article><article><span>03</span><div><h3>Work history</h3><p>Completed jobs, cancellations, disputes and warranties—not anonymous reviews.</p></div><b>Ongoing</b></article><article><span>04</span><div><h3>Fraud screening</h3><p>Duplicate accounts, stolen photos, payment risk and suspicious activity.</p></div><b>Always on</b></article></div></div>
          <div className="protection-grid"><article className="protection-main"><p className="section-label light">During the job</p><h2>Your money moves<br />when the work does.</h2><p>Payments are tied to accepted quotes and signed changes. Contractors never receive your card details, and extra work cannot become an unexpected charge.</p><div className="protection-flow"><span><b>1</b>Approve quote</span><i>→</i><span><b>2</b>Funds protected</span><i>→</i><span><b>3</b>Release by milestone</span></div></article><aside><p className="aside-label">Protection includes</p><ul><li><span>✓</span>Secure in-app payments</li><li><span>✓</span>Signed change orders</li><li><span>✓</span>Dispute documentation</li><li><span>✓</span>Warranty record storage</li><li><span>✓</span>Fraud and chargeback screening</li></ul></aside></div>
          <div className="trust-score-explain"><div><p className="section-label">The JobDrop Trust Score</p><h2>Reviews are one signal.<br />Performance is the full picture.</h2></div><div className="signal-grid"><article><b>25%</b><span>Verified job outcomes</span></article><article><b>20%</b><span>On-time arrival</span></article><article><b>20%</b><span>Communication</span></article><article><b>15%</b><span>Repeat customers</span></article><article><b>10%</b><span>Warranty history</span></article><article><b>10%</b><span>Credential status</span></article></div></div>
          <div className="trust-cta"><h2>Post with confidence.</h2><p>Your contact details stay private until you choose a professional.</p><button onClick={() => beginRequest()}>Start a protected request →</button></div>
        </section>
      )}

      {view === "help" && (
        <section className="help-page">
          <div className="help-hero"><p className="step-kicker">JobDrop support</p><h1>How can we help?</h1><label><span>⌕</span><input placeholder="Search jobs, payments, contractors…" /></label><p>Popular: changing a quote · contractor verification · payment protection</p></div>
          <div className="help-body">
            <div className="help-categories"><button><span>HM</span><b>For homeowners</b><small>Requests, quotes and hiring</small></button><button><span>PR</span><b>For professionals</b><small>Matching, quotes and plans</small></button><button><span>PY</span><b>Payments</b><small>Deposits, payouts and refunds</small></button><button><span>TS</span><b>Trust & safety</b><small>Verification and protection</small></button></div>
            <div className="help-layout"><div className="faq-list"><p className="section-label">Frequently asked</p><h2>Quick answers.</h2><details open><summary>Does posting a job cost anything?<span>+</span></summary><p>No. Homeowners can post requests and compare matched quotes for free. A booking and protection fee only applies when a job is paid through JobDrop.</p></details><details><summary>How many contractors see my request?<span>+</span></summary><p>Only qualified professionals matching the service, location, availability and trust requirements are notified. Customers see no more than five top matches.</p></details><details><summary>When does the contractor get paid?<span>+</span></summary><p>Funds are released according to the milestones accepted in the contract. Changes require approval before they can affect the total.</p></details><details><summary>What happens if something goes wrong?<span>+</span></summary><p>Keep communication and payments inside JobDrop. Our support team can review the quote, contract, messages, progress updates and payment record.</p></details><details><summary>Do contractors pay for leads?<span>+</span></summary><p>No. Contractors subscribe to the business platform. JobDrop does not sell individual customer contact details or charge per lead.</p></details></div>
              <aside className="contact-card"><p className="aside-label">Still need help?</p><h3>Talk to a real person.</h3><p>Send a message with your job number. A support specialist will reply in the app.</p>{supportSent ? <div className="support-success"><span>✓</span><b>Message received</b><small>We’ll reply within 2 business hours.</small></div> : <form onSubmit={(event) => { event.preventDefault(); setSupportSent(true); }}><label>Your email<input type="email" defaultValue="niall@example.com" required /></label><label>Job number<input defaultValue="JD-2048" /></label><label>How can we help?<textarea rows={4} required placeholder="Tell us what happened…" /></label><button type="submit">Send to support →</button></form>}<div className="emergency-help"><b>Immediate safety issue?</b><p>Call emergency services first. Then contact JobDrop safety at 1-800-JOBDROP.</p></div></aside></div>
          </div>
        </section>
      )}

      {view === "onboarding" && (
        <section className="onboarding-shell">
          <div className="onboarding-progress"><button onClick={() => onboardingStep === 0 ? go("discover") : setOnboardingStep(onboardingStep - 1)}>← {onboardingStep === 0 ? "Exit" : "Back"}</button><div>{["Business", "Services", "Verification", "Plan"].map((label, index) => <span key={label} className={index <= onboardingStep ? "done" : ""}><i />{label}</span>)}</div><small>{onboardingStep < 4 ? `${Math.round(((onboardingStep + 1) / 4) * 100)}% complete` : "Complete"}</small></div>
          {onboardingStep < 4 ? <div className="onboarding-layout"><div className="onboarding-form">
            {onboardingStep === 0 && <><p className="step-kicker">Step 1 of 4</p><h1>Tell us about your business.</h1><p>Start with the details customers will see. You can update these anytime.</p><div className="two-fields"><label>Legal business name<input value={legalName} onChange={(event) => setLegalName(event.target.value)} /></label><label>Public business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></label></div><label>Business address<input defaultValue="225 King Street W, Hamilton, ON" /></label><div className="two-fields"><label>Business phone<input value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} /></label><label>Years in business<select defaultValue="8"><option>0–2</option><option>3–5</option><option value="8">6–10</option><option>10+</option></select></label></div><label>About your company<textarea rows={4} value={businessAbout} onChange={(event) => setBusinessAbout(event.target.value)} /></label></>}
            {onboardingStep === 1 && <><p className="step-kicker">Step 2 of 4</p><h1>Choose your work and territory.</h1><p>There is no extra charge for verified services. Matching only uses work you select.</p><label>Primary service<select value={primaryService} onChange={(event) => setPrimaryService(event.target.value)}><option>Drywall</option><option>Painting</option><option>Roofing</option><option>Plumbing</option></select></label><p className="field-label">Additional services</p><div className="onboarding-options">{["Drywall repair", "Drywall installation", "Taping & finishing", "Plaster repair", "Interior painting", "Insulation"].map((item) => <label key={item}><input type="checkbox" checked={selectedServices.includes(item)} onChange={() => setSelectedServices((current) => current.includes(item) ? current.filter((service) => service !== item) : [...current, item])} /><span>✓</span>{item}</label>)}</div><div className="two-fields"><label>Home base<input value={homeBase} onChange={(event) => setHomeBase(event.target.value)} /></label><label>Service radius<select value={serviceRadius} onChange={(event) => setServiceRadius(Number(event.target.value))}><option value="15">15 km</option><option value="30">30 km</option><option value="50">50 km</option></select></label></div><label className="availability-check"><input type="checkbox" checked={emergencyAvailable} onChange={(event) => setEmergencyAvailable(event.target.checked)} /><span />Available for emergency requests</label></>}
            {onboardingStep === 2 && <><p className="step-kicker">Step 3 of 4</p><h1>Build a verified profile.</h1><p>Documents stay private. Customers only see the verified status and expiry monitoring.</p><div className="verification-uploads"><button><span>✓</span><div><b>Government ID</b><small>Alex Morgan · Verified</small></div><em>Complete</em></button><button><span>✓</span><div><b>Business registration</b><small>Ontario Corporation · Verified</small></div><em>Complete</em></button><button><span>+</span><div><b>Liability insurance</b><small>Upload certificate · PDF or photo</small></div><em>Required</em></button><button><span>+</span><div><b>Trade licence</b><small>Only required for regulated services</small></div><em>Optional</em></button></div><div className="verification-note"><span>▣</span><div><b>Your information is encrypted.</b><p>JobDrop uses verification data only for trust, fraud prevention and payment compliance.</p></div></div></>}
            {onboardingStep === 3 && <><p className="step-kicker">Step 4 of 4</p><h1>Choose how you grow.</h1><p>No lead fees. No charge for each service. Cancel or change plans anytime.</p><div className="onboarding-plans"><label><input type="radio" name="plan" checked={selectedPlan === "starter"} onChange={() => setSelectedPlan("starter")} /><div><span>Starter</span><b>$49<small>/month</small></b><p>1 user · 25 km territory · Quoting and invoicing</p></div></label><label className="recommended"><input type="radio" name="plan" checked={selectedPlan === "growth"} onChange={() => setSelectedPlan("growth")} /><div><span>Growth · Recommended</span><b>$129<small>/month</small></b><p>5 users · 50 km territory · Scheduling and insights</p></div></label><label><input type="radio" name="plan" checked={selectedPlan === "pro"} onChange={() => setSelectedPlan("pro")} /><div><span>Pro</span><b>$299<small>/month</small></b><p>Unlimited team · Multiple territories · Advanced operations</p></div></label></div><div className="trial-note"><span>30</span><div><b>Your first month is free.</b><p>You won’t be charged until August 22. Cancel before then and pay nothing.</p></div></div></>}
            {profileStatus === "error" && <p className="profile-save-error">Your business profile could not be saved. Please try again.</p>}<div className="onboarding-footer"><span>{profileStatus === "saving" ? "Saving securely…" : profileStatus === "saved" ? "Profile saved ✓" : "Your progress is ready"}</span><button disabled={profileStatus === "saving"} onClick={() => onboardingStep === 3 ? saveContractorProfile() : setOnboardingStep(onboardingStep + 1)}>{onboardingStep === 3 ? "Submit application" : "Continue"} →</button></div>
          </div><aside className="onboarding-aside"><div className="onboarding-quote"><span>“</span><p>JobDrop gives us fewer opportunities than lead sites—but they’re the right jobs. We spend time quoting work we can actually win.</p><div><b>Marcus T.</b><small>General contractor · Hamilton</small></div></div><div className="onboarding-promise"><p className="aside-label">The JobDrop promise</p><ul><li>✓ Never pay per lead</li><li>✓ Keep your quoted labour price</li><li>✓ Control services and territory</li><li>✓ Pause matching anytime</li></ul></div></aside></div> : <div className="onboarding-complete"><span>✓</span><p className="step-kicker">Application submitted</p><h1>Welcome to JobDrop.</h1><p>Your identity and business are approved. Insurance review normally takes one business day; the contractor workspace is ready to explore now.</p><div><span><b>3</b> matching jobs ready</span><span><b>30</b> days free</span><span><b>0</b> lead fees</span></div><button onClick={() => { setProTab("overview"); go("contractor"); }}>Open contractor workspace →</button></div>}
        </section>
      )}

      {view === "contractor" && (
        <section className="pro-shell">
          <div className="pro-banner">
            <div className="pro-company"><span>{(contractorProfile?.businessName || businessName).split(" ").slice(0,2).map((word) => word[0]).join("")}</span><div><b>{contractorProfile?.businessName || businessName}</b><small>{contractorProfile?.verificationStatus === "verified" ? "Verified business" : "Business profile"} · {contractorProfile?.homeBase || homeBase}</small></div></div>
            <div className="pro-banner-actions"><button className="pro-availability" onClick={() => contractorProfile && updateContractorProfile({ acceptingWork: !contractorProfile.acceptingWork })}><span className={contractorProfile?.acceptingWork === false ? "paused" : ""}><i /></span><div><b>{contractorProfile?.acceptingWork === false ? "Matching paused" : "Accepting new work"}</b><small>Click to change availability</small></div></button><button onClick={() => { setOnboardingStep(0); go("onboarding"); }}>{contractorProfile ? "Edit profile" : "Complete onboarding"}</button></div>
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
                  {availableOpportunities.slice(0, 2).map((job) => (
                    <article className="opportunity-row" key={job.id}>
                      <div className="match-ring"><b>{job.match}</b><small>match</small></div>
                      <div className="opportunity-copy"><span>{job.service} · {job.distance}</span><h3>{job.title}</h3><p>{job.budget} · {job.timing}</p></div>
                      <div className="opportunity-action"><small>{job.posted}</small><button onClick={() => openQuote(job)}>Quote job →</button></div>
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
              <div className="pro-page-heading"><div><p className="step-kicker">Matched for North & Beam</p><h1>New opportunities.</h1><p>Only jobs that fit your services, territory, availability and work history.</p></div><div className="opportunity-count"><b>{availableOpportunities.length}</b><span>available now</span></div></div>
              <div className="filter-bar"><button className="selected">Best match</button><button>Nearest</button><button>Newest</button><span /><label>Within <select defaultValue="30"><option>15</option><option>30</option><option>50</option></select> km</label></div>
              <div className="opportunity-layout">
                <div className="opportunity-list">
                  {availableOpportunities.map((job, index) => (
                    <article className="opportunity-card" key={job.id}>
                      <div className="opportunity-card-head"><div><span className="service-pill">{job.service}</span><span className="fresh-pill">{job.posted}</span></div><div className="match-number"><b>{job.match}%</b><small>match</small></div></div>
                      <h2>{job.title}</h2>
                      <p>{job.details}</p>
                      <div className="job-facts"><span><small>Distance</small><b>{job.distance}</b></span><span><small>Customer budget</small><b>{job.budget}</b></span><span><small>Timeline</small><b>{job.timing}</b></span></div>
                      <div className="job-fit"><span>Why it fits</span><p>{index === 0 ? "42 similar jobs · Schedule open · 6 km away" : index === 1 ? "Painting verified · Strong price history · Repeat area" : "Commercial board experience · Flexible schedule"}</p></div>
                      <div className="opportunity-card-actions"><button className="secondary-action">Not interested</button><button className="primary-action" onClick={() => openQuote(job)}>{quoteSent === job.id ? "Quote sent ✓" : "Build a quote →"}</button></div>
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
                  <div className="active-job-actions"><button>Message customer</button><button>Update progress</button><button className="primary-action" onClick={() => setChangeOrderOpen(true)}>{changeOrderSent ? "Change order sent ✓" : "Create change order"}</button></div>
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
                  {conversations.map((job) => <button key={job.id} className="live-conversation" onClick={() => openJobRoom(job)}><span className="person-avatar orange">{job.category.slice(0,2).toUpperCase()}</span><div><b>{job.title}</b><p>Open the live Job Room</p><small>{job.externalId} · {job.status}</small></div><em>Live</em></button>)}
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
                  <div className="business-logo">{(contractorProfile?.businessName || businessName).split(" ").slice(0,2).map((word) => word[0]).join("")}</div><h2>{contractorProfile?.businessName || businessName}</h2><p>{contractorProfile?.homeBase || homeBase} · {contractorProfile?.serviceRadiusKm || serviceRadius} km service area</p><span className="verified-line">✓ {contractorProfile?.verificationStatus === "verified" ? "Identity, insurance and licence verified" : "Complete onboarding to activate matching"}</span>
                  <dl><div><dt>Services</dt><dd>{(contractorProfile?.services || selectedServices).slice(0,2).join(", ")}</dd></div><div><dt>Team</dt><dd>{contractorProfile?.teamSize || 4} members</dd></div><div><dt>Emergency work</dt><dd>{contractorProfile?.emergencyAvailable ? "Enabled" : "Off"}</dd></div></dl><button onClick={() => { setOnboardingStep(0); go("onboarding"); }}>Edit business profile →</button>
                </aside>
                <div className="plans-area">
                  <div className="plans-heading"><div><p className="aside-label">Current plan</p><h2>{(contractorProfile?.plan || selectedPlan).replace(/^./, (letter) => letter.toUpperCase())}</h2></div><b>${({ starter: 49, growth: 129, pro: 299 }[contractorProfile?.plan || selectedPlan])}<small>/month</small></b></div>
                  <div className="plan-grid">
                    <article className={(contractorProfile?.plan || selectedPlan) === "starter" ? "current-plan" : ""}><span>Starter{(contractorProfile?.plan || selectedPlan) === "starter" ? " · Current" : ""}</span><h3>$49<small>/mo</small></h3><p>For an independent pro building a local reputation.</p><ul><li>1 user and crew</li><li>25 km territory</li><li>Unlimited verified services</li><li>Quotes and invoicing</li></ul><button disabled={profileStatus === "saving"} onClick={() => updateContractorProfile({ plan: "starter" })}>{(contractorProfile?.plan || selectedPlan) === "starter" ? "Current plan ✓" : "Switch plan"}</button></article>
                    <article className={(contractorProfile?.plan || selectedPlan) === "growth" ? "current-plan" : ""}><span>Growth{(contractorProfile?.plan || selectedPlan) === "growth" ? " · Current" : ""}</span><h3>$129<small>/mo</small></h3><p>For a growing team that wants more work and automation.</p><ul><li>Up to 5 team members</li><li>50 km territory</li><li>Scheduling and dispatch</li><li>Performance insights</li></ul><button disabled={profileStatus === "saving"} onClick={() => updateContractorProfile({ plan: "growth" })}>{(contractorProfile?.plan || selectedPlan) === "growth" ? "Current plan ✓" : "Switch plan"}</button></article>
                    <article className={(contractorProfile?.plan || selectedPlan) === "pro" ? "current-plan" : ""}><span>Pro{(contractorProfile?.plan || selectedPlan) === "pro" ? " · Current" : ""}</span><h3>$299<small>/mo</small></h3><p>For multi-crew businesses managing several territories.</p><ul><li>Unlimited team members</li><li>Multiple territories</li><li>Advanced operations</li><li>Priority support</li></ul><button disabled={profileStatus === "saving"} onClick={() => updateContractorProfile({ plan: "pro" })}>{(contractorProfile?.plan || selectedPlan) === "pro" ? "Current plan ✓" : "Upgrade to Pro"}</button></article>
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
                <label className="field-label" htmlFor="quote-note">Message to customer</label><textarea id="quote-note" value={quoteNote} onChange={(event) => setQuoteNote(event.target.value)} rows={4} />
                <label className="field-label" htmlFor="quote-date">Earliest start</label><select id="quote-date" value={quoteAvailability} onChange={(event) => setQuoteAvailability(event.target.value)}><option>Tomorrow, 8:00 AM</option><option>Thursday, 9:00 AM</option><option>Friday, 7:30 AM</option></select>
                <div className="quote-protection"><span>✓</span><p>Customer contact details remain private until they accept your quote.</p></div>
                {quoteSubmitStatus === "error" && <p className="quote-submit-error">This quote could not be sent. Check the amount and try again.</p>}
                <button className="send-quote" disabled={quoteSubmitStatus === "saving"} onClick={submitQuote}>{quoteSubmitStatus === "saving" ? "Sending quote…" : `Send $${Number(quoteAmount || 0).toLocaleString()} quote →`}</button>
              </div>
            </div>
          )}
          {changeOrderOpen && <div className="quote-overlay" role="dialog" aria-modal="true" aria-labelledby="change-title"><button className="overlay-close" onClick={() => setChangeOrderOpen(false)} aria-label="Close change order">×</button><div className="quote-drawer change-drawer"><p className="step-kicker">Job JD-2048 · Change order</p><h2 id="change-title">Document extra work.</h2><p className="quote-job-title">Basement drywall repair · Niall L.</p><div className="change-alert"><span>!</span><p>The customer must approve this change before additional work begins.</p></div><label className="field-label">Reason for change<select defaultValue="Hidden damage discovered"><option>Hidden damage discovered</option><option>Customer requested upgrade</option><option>Scope clarification</option></select></label><label className="field-label">Describe the additional work<textarea rows={4} defaultValue="Replace water-damaged insulation behind the four affected drywall sheets before installing new board." /></label><div className="two-fields"><label className="field-label">Additional labour<input defaultValue="$240" /></label><label className="field-label">Additional materials<input defaultValue="$185" /></label></div><div className="change-total"><span>Original contract</span><b>$2,280</b><span>Change order</span><b>+$425</b><strong>New total</strong><strong>$2,705</strong></div><label className="field-label">Schedule impact<select><option>Adds approximately 2 hours</option><option>No schedule impact</option><option>Adds 1 business day</option></select></label><button className="send-quote" onClick={() => { setChangeOrderSent(true); setChangeOrderOpen(false); }}>Send change order for approval →</button></div></div>}
        </section>
      )}

      {roomJob && <div className="job-room-overlay" role="dialog" aria-modal="true" aria-labelledby="job-room-title"><button className="job-room-close" aria-label="Close Job Room" onClick={() => setRoomJob(null)}>×</button><div className="job-room"><header><div><p className="step-kicker">Shared Job Room · {roomJob.externalId}</p><h2 id="job-room-title">{roomJob.title}</h2><p>{roomJob.category} · {roomJob.status}</p></div><span><i /> Private to this job</span></header>{roomStatus === "loading" ? <div className="job-room-loading">Opening your Job Room…</div> : roomStatus === "error" && !roomMessages.length ? <div className="job-room-loading error">The Job Room could not be loaded. Please close it and try again.</div> : <div className="job-room-grid"><aside><p className="aside-label">Job activity</p><div className="room-timeline">{roomEvents.map((event, index) => <article key={event.id}><span>{index + 1}</span><div><b>{event.label}</b><small>{new Date(event.createdAt).toLocaleString()}</small></div></article>)}</div></aside><section><div className="room-chat-head"><div><span>JD</span><div><b>Job conversation</b><small>Keep details and decisions documented here</small></div></div></div><div className="room-chat-body">{roomMessages.length === 0 && <div className="room-empty"><span>✦</span><b>Start the conversation</b><p>Messages stay attached to this job for both sides.</p></div>}{roomMessages.map((message) => <div className={`room-message ${message.mine ? "mine" : "theirs"}`} key={message.id}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div>)}</div><form className="room-composer" onSubmit={sendRoomMessage}><input value={roomText} onChange={(event) => setRoomText(event.target.value)} placeholder="Write a message about this job…" aria-label="Job message" /><button disabled={roomStatus === "sending" || !roomText.trim()}>{roomStatus === "sending" ? "Sending…" : "Send →"}</button></form></section></div>}</div></div>}

      <footer>
        <div className="brand footer-brand"><span className="brand-mark"><i /></span><span>JobDrop</span></div>
        <p>Local work, matched better.</p>
        <div><button onClick={() => go("discover")}>How it works</button><button onClick={() => go("trust")}>Trust & safety</button><button onClick={() => go("onboarding")}>Join as a contractor</button><button onClick={() => go("help")}>Help</button><button onClick={() => go("admin")}>Operations</button></div>
        <span>© 2026 JobDrop · Hamilton, Ontario</span>
      </footer>
    </main>
  );
}
