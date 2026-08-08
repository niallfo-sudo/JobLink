"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "discover" | "request" | "matches" | "tracking" | "contractor" | "account" | "trust" | "help" | "onboarding" | "silent" | "emergency" | "admin";
type ProTab = "overview" | "opportunities" | "jobs" | "inbox" | "business";
type AccountTab = "jobs" | "payments" | "documents" | "saved";
type AdminTab = "overview" | "verification" | "contractors" | "fraud" | "disputes" | "team";
type PersistedJob = { id: number; externalId: string; category: string; title: string; description?: string; size?: string; timeline?: string; postalCode?: string; emergency?: boolean; status: string; budget: string; scheduledStartAt?: string | number | null; createdAt: string | number };
type PersistedQuote = { id: number; contractorName: string; amountCents: number; message: string; availableAt: string; status: string };
type Opportunity = { numericId?: number; id: string; service: string; title: string; distance: string; budget: string; timing: string; match: number; posted: string; details: string };
type RoomMessage = { id: number; body: string; mine: boolean; createdAt: string | number };
type RoomEvent = { id: number; label: string; eventType: string; createdAt: string | number };
type ContractorProfile = { businessName: string; legalName: string; phone: string; businessAddress: string; yearsInBusiness: number; about: string; primaryService: string; services: string[]; homeBase: string; serviceRadiusKm: number; teamSize: number; emergencyAvailable: boolean; acceptingWork: boolean; plan: "starter" | "growth" | "pro"; subscriptionStatus: string; payoutsEnabled: boolean; verificationStatus: string };
type PaymentRecord = { id: number; externalId: string; title: string; contractorName: string; subtotalCents: number; customerFeeCents: number; totalCents: number; contractorPayoutCents: number; status: string; processor: string; viewerRole: "homeowner" | "contractor"; createdAt: string | number };
type GeneratedDocument = { id: number; externalId: string; jobTitle: string; jobNumber: string; documentType: string; title: string; status: string; createdAt: string | number };
type ChangeOrderRecord = { id: number; externalId: string; reason: string; description: string; amountCents: number; scheduleImpact: string; status: string; contractorName: string; decisionName?: string | null };
type VerifiedReview = { id: number; workmanship: number; communication: number; punctuality: number; cleanliness: number; averageScore: number; comment: string };
type AppNotification = { id: number; jobId: number | null; notificationType: string; title: string; body: string; readAt: string | number | null; createdAt: string | number };
type JobAttachment = { id: number; filename: string; contentType: string; sizeBytes: number; kind: "image" | "video"; url: string; createdAt: string | number };
type OperationsNote = { id: number; authorEmail: string; body: string; createdAt: string | number };
type OperationsCase = { id: number; externalId: string; caseType: "verification" | "fraud" | "dispute"; title: string; subject: string; summary: string; risk: "low" | "medium" | "high" | "critical"; priority: string; status: "open" | "in_review" | "waiting" | "resolved" | "dismissed"; assignee: string; evidenceCount: number; dueLabel: string; details: { signals?: string[]; ownerEmail?: string; primaryService?: string; documents?: { id: number; documentType: string; filename: string; reviewStatus: string }[]; [key: string]: unknown }; resolution: string; notes: OperationsNote[]; updatedAt: string | number };
type AccountIdentity = { email: string; displayName: string; role: "homeowner" | "contractor" | "employee" | "admin" | null; operationsRole?: "employee" | "admin" | null };
type StaffMember = { id: number; email: string; displayName: string; role: "employee" | "admin"; createdAt: string | number };
type VerificationDocument = { id: number; documentType: string; filename: string; reviewStatus: string; uploadedAt: string | number };
type ContractorQuote = { id: number; jobId: number; externalId: string; title: string; category: string; amountCents: number; availableAt: string; status: string; createdAt: string | number };
type VerifiedContractor = { id: number; ownerEmail: string; businessName: string; primaryService: string; services: string[]; homeBase: string; serviceRadiusKm: number; teamSize: number; emergencyAvailable: boolean; acceptingWork: boolean; plan: string; subscriptionStatus: string; payoutsEnabled: boolean; updatedAt: string | number };

const categories = [
  ["Drywall", "DW"],
  ["Roofing", "RF"],
  ["Painting", "PT"],
  ["Plumbing", "PL"],
  ["Electrical", "EL"],
  ["HVAC", "HV"],
  ["Landscaping", "LS"],
  ["Moving", "MV"],
  ["Junk removal", "JR"],
  ["Carpentry", "CP"],
  ["Flooring", "FL"],
  ["General contracting", "GC"],
] as const;

type ServiceIntake = {
  intro: string;
  prompt: string;
  sizeQuestion: string;
  sizePlaceholder: string;
  defaultScope: string;
  defaultSize: string;
  jobTypes: string[];
  details: string[];
};

const serviceIntakeCatalog: Record<string, ServiceIntake> = {
  Drywall: { intro: "Repairs, new board, ceilings, taping and finishing.", prompt: "Example: Repair four water-damaged sheets in my finished basement.", sizeQuestion: "How much wall or ceiling is affected?", sizePlaceholder: "Example: Four 4 x 8 sheets or about 130 sq. ft.", defaultScope: "Repair damaged drywall in a finished basement", defaultSize: "Four 4 x 8 sheets", jobTypes: ["Repair damage", "Install new drywall", "Tape and finish", "Ceiling work"], details: ["Water source is fixed", "Insulation may need replacing", "Texture or finish must match", "Furniture needs protection"] },
  Roofing: { intro: "Leak repairs, shingles, flat roofs and full replacements.", prompt: "Example: Diagnose an active leak above the upstairs bedroom.", sizeQuestion: "What size and type of roof is involved?", sizePlaceholder: "Example: Two-storey detached home, about 1,600 sq. ft.", defaultScope: "Inspect and repair a roof leak", defaultSize: "Two-storey detached home", jobTypes: ["Repair a leak", "Replace the roof", "Replace shingles", "Eavestrough work"], details: ["Leak is currently active", "Roof is steep or difficult to access", "Old material needs disposal", "Attic inspection is required"] },
  Painting: { intro: "Interior, exterior, cabinets, trim and commercial painting.", prompt: "Example: Paint the main-floor walls, trim and stairwell.", sizeQuestion: "Which rooms or surfaces need painting?", sizePlaceholder: "Example: Living room, hallway and stairwell; about 900 sq. ft.", defaultScope: "Paint the main floor walls and trim", defaultSize: "Living room, hallway and stairwell", jobTypes: ["Interior painting", "Exterior painting", "Cabinet refinishing", "Staining or specialty finish"], details: ["Walls need patching", "Trim or ceilings are included", "Colour consultation is needed", "Furniture needs moving"] },
  Plumbing: { intro: "Leaks, drains, fixtures, water heaters and new plumbing.", prompt: "Example: Replace a leaking kitchen faucet and inspect the shutoffs.", sizeQuestion: "How many fixtures or areas are affected?", sizePlaceholder: "Example: One kitchen sink and two shutoff valves.", defaultScope: "Repair a leaking kitchen fixture", defaultSize: "One fixture and nearby shutoff valves", jobTypes: ["Repair a leak", "Install a fixture", "Clear a drain", "Water heater or sump pump"], details: ["Water is currently shut off", "Leak is causing active damage", "New fixture is already purchased", "Access may require opening a wall"] },
  Electrical: { intro: "Repairs, lighting, panels, EV chargers and rewiring.", prompt: "Example: Install six pot lights and add a dimmer in the living room.", sizeQuestion: "How many devices, rooms or circuits are involved?", sizePlaceholder: "Example: Six lights in one room on an existing panel.", defaultScope: "Install new lighting and update the controls", defaultSize: "One room with six light fixtures", jobTypes: ["Electrical repair", "Lighting installation", "Panel or service upgrade", "EV charger installation"], details: ["Power is currently off", "Panel brand and capacity are known", "Permit may be required", "Drywall access is available"] },
  HVAC: { intro: "Furnaces, air conditioning, heat pumps and ductwork.", prompt: "Example: Diagnose a furnace that runs but does not produce heat.", sizeQuestion: "What equipment and home size are involved?", sizePlaceholder: "Example: Gas furnace in a 1,800 sq. ft. detached home.", defaultScope: "Diagnose and repair a furnace that is not heating", defaultSize: "One furnace serving a 1,800 sq. ft. home", jobTypes: ["Heating repair", "Air-conditioning repair", "Replace equipment", "Maintenance or ductwork"], details: ["System is completely off", "Unusual noise or smell", "Thermostat is responding", "Equipment model is available"] },
  "Junk removal": { intro: "Household junk, renovation debris, appliances and cleanouts.", prompt: "Example: Remove renovation debris and an old sofa from the basement.", sizeQuestion: "How much material needs to be removed?", sizePlaceholder: "Example: Half a truckload, including one sofa and drywall debris.", defaultScope: "Remove household junk and renovation debris", defaultSize: "About half a truckload", jobTypes: ["Household junk", "Construction debris", "Appliance removal", "Estate or property cleanout"], details: ["Heavy items are included", "Stairs are required", "Items can be donated", "Same-day pickup preferred"] },
  Landscaping: { intro: "Lawn care, gardens, interlock, fences and seasonal work.", prompt: "Example: Regrade and sod the back yard after drainage work.", sizeQuestion: "What is the approximate outdoor area?", sizePlaceholder: "Example: Back yard about 35 x 60 ft.", defaultScope: "Restore and improve the back yard", defaultSize: "Back yard about 35 x 60 ft.", jobTypes: ["Lawn and garden care", "Sod or grading", "Interlock or hardscape", "Fence or outdoor structure"], details: ["Materials need to be supplied", "Site has gate access", "Old material needs removal", "Design advice is needed"] },
  Moving: { intro: "Local moves, packing, furniture delivery and heavy items.", prompt: "Example: Move a two-bedroom apartment within Hamilton.", sizeQuestion: "How large is the move?", sizePlaceholder: "Example: Two-bedroom apartment, about 45 boxes plus furniture.", defaultScope: "Move a two-bedroom home within Hamilton", defaultSize: "Two bedrooms, about 45 boxes plus furniture", jobTypes: ["Full home move", "Apartment move", "Furniture delivery", "Packing help"], details: ["Stairs or elevator are involved", "Packing supplies are needed", "Heavy or fragile items included", "Storage stop is required"] },
  Carpentry: { intro: "Framing, decks, cabinetry, doors, trim and custom woodwork.", prompt: "Example: Build a pressure-treated rear deck with stairs and railing.", sizeQuestion: "What are the approximate dimensions?", sizePlaceholder: "Example: Deck is 12 x 16 ft. and about 3 ft. above grade.", defaultScope: "Build a new exterior deck with stairs and railing", defaultSize: "Approximately 12 x 16 ft.", jobTypes: ["Finish carpentry", "Framing", "Deck or fence", "Cabinetry or custom work"], details: ["Drawings are available", "Materials need to be supplied", "Demolition is required", "Permit may be required"] },
  Flooring: { intro: "Hardwood, laminate, vinyl, tile, carpet and repairs.", prompt: "Example: Replace main-floor carpet with luxury vinyl plank.", sizeQuestion: "How much floor area is involved?", sizePlaceholder: "Example: About 850 sq. ft. across four rooms.", defaultScope: "Replace existing flooring with new vinyl plank", defaultSize: "About 850 sq. ft. across four rooms", jobTypes: ["Install new flooring", "Replace existing flooring", "Repair damaged flooring", "Refinish hardwood"], details: ["Old flooring needs removal", "Subfloor may need repair", "Materials are already purchased", "Baseboards are included"] },
  "General contracting": { intro: "Renovations, basements, kitchens, bathrooms and additions.", prompt: "Example: Renovate a basement into a family room and bathroom.", sizeQuestion: "What rooms and approximate area are involved?", sizePlaceholder: "Example: 900 sq. ft. basement with one new bathroom.", defaultScope: "Renovate a basement into finished living space", defaultSize: "About 900 sq. ft. with one bathroom", jobTypes: ["Basement renovation", "Kitchen renovation", "Bathroom renovation", "Addition or multi-room project"], details: ["Plans or drawings are available", "Permit is required", "Demolition is included", "Customer will remain in the home"] },
};

const contractorServiceCatalog: Record<string, string[]> = {
  Drywall: ["Drywall repair", "Drywall installation", "Taping & finishing", "Plaster repair", "Texture matching", "Insulation"],
  Roofing: ["Roof repair", "Roof replacement", "Leak diagnosis", "Shingle installation", "Flat roofing", "Eavestroughs"],
  Painting: ["Interior painting", "Exterior painting", "Cabinet refinishing", "Deck staining", "Commercial painting", "Wallpaper removal"],
  Plumbing: ["Leak repair", "Fixture installation", "Drain cleaning", "Water heaters", "Sump pumps", "Emergency plumbing"],
  Electrical: ["Electrical repair", "Lighting installation", "Panel upgrades", "EV chargers", "Home rewiring", "Emergency electrical"],
  HVAC: ["Furnace repair", "Air conditioning", "Heat pumps", "Ductwork", "Maintenance", "Emergency HVAC"],
  "Junk removal": ["Household junk", "Construction debris", "Appliance removal", "Estate cleanout", "Yard waste", "Commercial cleanup"],
  Landscaping: ["Lawn care", "Garden maintenance", "Interlock", "Fencing", "Tree and shrub care", "Seasonal cleanup"],
  Moving: ["Local moving", "Long-distance moving", "Packing", "Furniture delivery", "Office moving", "Heavy-item moving"],
  Carpentry: ["Finish carpentry", "Framing", "Decks", "Cabinetry", "Doors and trim", "Custom woodwork"],
  Flooring: ["Hardwood", "Laminate", "Vinyl plank", "Tile", "Carpet", "Floor repair"],
  "General contracting": ["Renovations", "Basements", "Kitchens", "Bathrooms", "Additions", "Project management"],
};

const helpFaqsRaw = [
  { topic: "homeowners", question: "Does posting a job cost anything?", answer: "No. Homeowners can post requests and compare submitted quotes for free. Payments are currently a clearly labelled demo and do not charge a card." },
  { topic: "homeowners", question: "How many contractors see my request?", answer: "Only qualified professionals matching the service, location, availability and trust requirements are notified. Customers see no more than five top matches." },
  { topic: "professionals", question: "Do contractors pay for leads?", answer: "No. Contractors subscribe to the business platform. JobLink does not sell individual customer contact details or charge per lead." },
  { topic: "professionals", question: "How do I pause new matching?", answer: "Open the contractor workspace and use the Accepting new work control. Existing jobs and conversations remain available while matching is paused." },
  { topic: "payments", question: "When does the contractor get paid?", answer: "Payments and payouts are currently simulated for product testing. No card or bank account is charged, and no funds move through JobLink yet." },
  { topic: "payments", question: "How are change orders charged?", answer: "A contractor submits the reason, added scope, amount and schedule impact. The customer must approve and sign before the contract total changes." },
  { topic: "trust", question: "What happens if something goes wrong?", answer: "Keep communication and payments inside JobLink. Support can review the quote, contract, messages, progress updates and payment record." },
  { topic: "trust", question: "How are professionals verified?", answer: "Contractors upload private identity, business, insurance and applicable trade-licence evidence. Authorized Operations staff review the evidence before matching can be enabled." },
];

const helpFaqs = helpFaqsRaw.map((item) => item.question === "Does posting a job cost anything?"
  ? { ...item, answer: "No. Homeowners can post requests and compare submitted quotes for free. Payments are currently a clearly labelled demo and do not charge a card." }
  : item.question === "When does the contractor get paid?"
    ? { ...item, answer: "Payments and payouts are currently simulated for product testing. No card or bank account is charged, and no funds move through JobLink yet." }
    : item);

const steps = ["Describe", "Details", "Timing", "Review"];

export default function Home() {
  const [view, setView] = useState<View>("discover");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("Drywall");
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState("");
  const [size, setSize] = useState("");
  const [selectedJobType, setSelectedJobType] = useState("Repair damage");
  const [selectedJobDetails, setSelectedJobDetails] = useState<string[]>([]);
  const [quoteIncludes, setQuoteIncludes] = useState<string[]>(["Materials", "Site protection", "Cleanup", "Disposal"]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [timeline, setTimeline] = useState("I’m flexible");
  const [budget, setBudget] = useState("Need guidance");
  const [customTimeline, setCustomTimeline] = useState("");
  const [customBudget, setCustomBudget] = useState("");
  const [proTab, setProTab] = useState<ProTab>("overview");
  const [quoteJob, setQuoteJob] = useState<Opportunity | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteSent, setQuoteSent] = useState<string | null>(null);
  const [contractorQuotes, setContractorQuotes] = useState<ContractorQuote[]>([]);
  const [quoteNote, setQuoteNote] = useState("");
  const [quoteAvailability, setQuoteAvailability] = useState("");
  const [quoteSubmitStatus, setQuoteSubmitStatus] = useState<"idle" | "saving" | "error">("idle");
  const [quoteSubmitError, setQuoteSubmitError] = useState("");
  const [accountTab, setAccountTab] = useState<AccountTab>("jobs");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [supportStatus, setSupportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [supportReference, setSupportReference] = useState("");
  const [emergencyStage, setEmergencyStage] = useState(0);
  const [emergencyDescription, setEmergencyDescription] = useState("");
  const [emergencyAddress, setEmergencyAddress] = useState("");
  const [emergencyConsent, setEmergencyConsent] = useState(false);
  const [emergencyJob, setEmergencyJob] = useState<{ id: number; externalId: string } | null>(null);
  const [emergencyStatus, setEmergencyStatus] = useState<"idle" | "saving" | "error">("idle");
  const [silentTranscript, setSilentTranscript] = useState("");
  const [silentStatus, setSilentStatus] = useState<"idle" | "listening" | "ready" | "unsupported" | "error">("idle");
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [aiBrief, setAiBrief] = useState<{ title: string; description: string } | null>(null);
  const [aiBriefStatus, setAiBriefStatus] = useState<"idle" | "saving" | "error">("idle");
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
  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState(0);
  const [businessAbout, setBusinessAbout] = useState("");
  const [primaryService, setPrimaryService] = useState("Drywall");
  const [selectedServices, setSelectedServices] = useState(["Drywall repair", "Drywall installation", "Taping & finishing", "Plaster repair"]);
  const [homeBase, setHomeBase] = useState("Hamilton, Ontario");
  const [serviceRadius, setServiceRadius] = useState(30);
  const [teamSize, setTeamSize] = useState(1);
  const [emergencyAvailable, setEmergencyAvailable] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "growth" | "pro">("growth");
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocument[]>([]);
  const [verificationUploadType, setVerificationUploadType] = useState("");
  const [verificationUploadStatus, setVerificationUploadStatus] = useState<"idle" | "saving" | "error">("idle");
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [paymentCheckoutId, setPaymentCheckoutId] = useState<number | null>(null);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);
  const [progressUpdatingId, setProgressUpdatingId] = useState<number | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [scheduledStartValues, setScheduledStartValues] = useState<Record<number, string>>({});
  const [roomChangeOrders, setRoomChangeOrders] = useState<ChangeOrderRecord[]>([]);
  const [liveChangeOrderJob, setLiveChangeOrderJob] = useState<PersistedJob | null>(null);
  const [changeReason, setChangeReason] = useState("Hidden damage discovered");
  const [changeDescription, setChangeDescription] = useState("Replace damaged material discovered after work began.");
  const [changeAmount, setChangeAmount] = useState("425");
  const [changeSchedule, setChangeSchedule] = useState("Adds approximately 2 hours");
  const [changeStatus, setChangeStatus] = useState<"idle" | "saving" | "error">("idle");
  const [roomReview, setRoomReview] = useState<VerifiedReview | null>(null);
  const [reviewScores, setReviewScores] = useState({ workmanship: 5, communication: 5, punctuality: 5, cleanliness: 5 });
  const [reviewComment, setReviewComment] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"idle" | "saving" | "error">("idle");
  const [reputation, setReputation] = useState<{ verifiedReviewCount: number; averageStars: number | null; verifiedReviewScore: number | null }>({ verifiedReviewCount: 0, averageStars: null, verifiedReviewScore: null });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [requestFiles, setRequestFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [roomAttachments, setRoomAttachments] = useState<JobAttachment[]>([]);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const [emergencyType, setEmergencyType] = useState("Active water leak");
  const [opportunitySort, setOpportunitySort] = useState<"match" | "nearest" | "newest">("match");
  const [opportunityRadius, setOpportunityRadius] = useState(30);
  const [dismissedOpportunities, setDismissedOpportunities] = useState<string[]>([]);
  const [jobView, setJobView] = useState<"active" | "upcoming" | "completed" | "quotes">("active");
  const [helpTopic, setHelpTopic] = useState("homeowners");
  const [helpSearch, setHelpSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [operationsCases, setOperationsCases] = useState<OperationsCase[]>([]);
  const [operationsStats, setOperationsStats] = useState({ jobs: 0, activeJobs: 0, paymentVolumeCents: 0, openCases: 0 });
  const [operationsViewer, setOperationsViewer] = useState<{ email?: string; displayName: string; role: string } | null>(null);
  const [operationsStaff, setOperationsStaff] = useState<StaffMember[]>([]);
  const [verifiedContractors, setVerifiedContractors] = useState<VerifiedContractor[]>([]);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<"employee" | "admin">("employee");
  const [staffStatus, setStaffStatus] = useState<"idle" | "saving" | "error">("idle");
  const [staffError, setStaffError] = useState("");
  const [caseCreateOpen, setCaseCreateOpen] = useState(false);
  const [caseCreateStatus, setCaseCreateStatus] = useState<"idle" | "saving" | "error">("idle");
  const [caseCreateError, setCaseCreateError] = useState("");
  const [newOperationsCase, setNewOperationsCase] = useState({ caseType: "dispute" as "verification" | "fraud" | "dispute", title: "", subject: "", summary: "", risk: "medium", priority: "normal", dueLabel: "" });
  const [operationsStatus, setOperationsStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [operationSearch, setOperationSearch] = useState("");
  const [operationStatusFilter, setOperationStatusFilter] = useState("active");
  const [selectedOperationCase, setSelectedOperationCase] = useState<OperationsCase | null>(null);
  const [operationNote, setOperationNote] = useState("");
  const [accountIdentity, setAccountIdentity] = useState<AccountIdentity | null>(null);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [accountGatewayOpen, setAccountGatewayOpen] = useState(false);
  const [accountActionStatus, setAccountActionStatus] = useState<"idle" | "saving" | "error">("idle");
  const [accountActionError, setAccountActionError] = useState("");

  const serviceIntake = serviceIntakeCatalog[category] ?? serviceIntakeCatalog.Drywall;
  const requestTimeline = timeline === "Custom" ? customTimeline.trim() || "Custom timing to be confirmed" : timeline;
  const requestBudget = budget === "Custom" ? customBudget.trim() || "Custom budget to be confirmed" : budget;
  const accountInitials = (accountIdentity?.displayName || "Guest").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "GU";
  const contractorVerificationCopy = contractorProfile?.verificationStatus === "verified" ? { title: "Business verified", body: contractorProfile.subscriptionStatus === "demo_active" ? "Your profile and demo subscription are active. You can enable matching when ready." : "Your business is approved. Activate a demo subscription to receive and quote matched work.", tone: "verified" } : contractorProfile?.verificationStatus === "rejected" ? { title: "Verification not approved", body: "Review the decision and update your business information before contacting JobLink support.", tone: "rejected" } : { title: "Verification in review", body: "Operations is reviewing your identity, insurance and business information. You can edit your profile while you wait.", tone: "pending" };
  const hasActiveSubscription = Boolean(contractorProfile && ["active", "trialing", "demo_active"].includes(contractorProfile.subscriptionStatus));
  const requestStepValid = step === 0 ? scope.trim().length >= 5 : step === 1 ? size.trim().length >= 2 : step === 2 ? postalCode.trim().length >= 3 && (timeline !== "Custom" || customTimeline.trim().length >= 3) && (budget !== "Custom" || customBudget.trim().length >= 1) : true;

  function signInFor(portal: "homeowner" | "contractor" | "admin") {
    window.location.assign(`/signin-with-chatgpt?return_to=${encodeURIComponent(`/?portal=${portal}`)}`);
  }

  function openContractorArea() {
    if (view === "contractor") { go("discover"); return; }
    if (!accountIdentity || accountIdentity.role !== "contractor") {
      setAccountActionError("");
      setAccountGatewayOpen(true);
      return;
    }
    go(contractorProfile ? "contractor" : "onboarding");
  }

  async function selectAccountRole(role: "homeowner" | "contractor") {
    if (!accountIdentity) {
      signInFor(role);
      return;
    }
    setAccountActionStatus("saving");
    setAccountActionError("");
    try {
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const data = (await response.json()) as { user?: AccountIdentity; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || "Account could not be created");
      setAccountIdentity(data.user);
      setAccountGatewayOpen(false);
      setAccountActionStatus("idle");
      if (role === "contractor") { setOnboardingStep(0); go("onboarding"); }
      else go("account");
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : "Account could not be created");
      setAccountActionStatus("error");
    }
  }

  async function openOperationsLogin(alreadyAuthenticated = false) {
    if (!accountIdentity && !alreadyAuthenticated) {
      signInFor("admin");
      return;
    }
    setAccountActionStatus("saving");
    setAccountActionError("");
    try {
      const response = await fetch("/api/operations");
      const data = (await response.json()) as { viewer?: { displayName: string; role: string }; error?: string };
      if (!response.ok) throw new Error(response.status === 403 ? "This account is not authorized for JobLink Operations." : data.error || "Operations login failed");
      if (data.viewer) setOperationsViewer(data.viewer);
      setAccountGatewayOpen(false);
      setAccountActionStatus("idle");
      go("admin");
    } catch (error) {
      setAccountActionError(error instanceof Error ? error.message : "Operations login failed");
      setAccountActionStatus("error");
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/account")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { user?: AccountIdentity | null }) => {
        if (!active) return;
        const user = data.user ?? null;
        setAccountIdentity(user);
        setAccountLoaded(true);
        const portal = new URLSearchParams(window.location.search).get("portal");
        if (portal && ["homeowner", "contractor", "admin"].includes(portal)) {
          window.history.replaceState({}, "", window.location.pathname);
          if (portal === "admin" && user) window.setTimeout(() => void openOperationsLogin(true), 0);
          else setAccountGatewayOpen(true);
        }
      })
      .catch(() => active && setAccountLoaded(true));
    return () => { active = false; };
  }, []);

  const jobBrief = useMemo(
    () => {
      const detailText = selectedJobDetails.length ? ` Important details: ${selectedJobDetails.join(", ").toLowerCase()}.` : "";
      const includeText = quoteIncludes.length ? ` Quote should include ${quoteIncludes.join(", ").toLowerCase()}.` : "";
      const notesText = additionalDetails.trim() ? ` Additional notes: ${additionalDetails.trim()}` : "";
      return `Looking for an experienced ${category.toLowerCase()} professional for ${selectedJobType.toLowerCase()}: ${scope.trim()}. The job covers ${size.trim()}.${detailText}${includeText} Preferred timing is ${requestTimeline.toLowerCase()}, with a target budget of ${requestBudget}.${notesText}`;
    },
    [category, selectedJobType, scope, size, selectedJobDetails, quoteIncludes, requestTimeline, requestBudget, additionalDetails],
  );
  const effectiveBrief = aiBrief?.description || jobBrief;

  useEffect(() => { setAiBrief(null); setAiBriefStatus("idle"); }, [category, selectedJobType, scope, size, selectedJobDetails, quoteIncludes, requestTimeline, requestBudget, additionalDetails]);

  function changeRequestCategory(nextCategory: string, keepDescription = false) {
    const next = serviceIntakeCatalog[nextCategory] ?? serviceIntakeCatalog.Drywall;
    setCategory(nextCategory);
    setSelectedJobType(next.jobTypes[0]);
    setSelectedJobDetails([]);
    if (!keepDescription) setScope(next.defaultScope);
    setSize(next.defaultSize);
    setAdditionalDetails("");
    setAiBrief(null);
  }

  async function generateAiBrief() {
    setAiBriefStatus("saving");
    try {
      const response = await fetch("/api/ai/request-brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, jobType: selectedJobType, scope, size, details: selectedJobDetails, includes: quoteIncludes, timeline: requestTimeline, budget: requestBudget, notes: additionalDetails }) });
      const data = (await response.json()) as { brief?: { title: string; description: string }; error?: string };
      if (!response.ok || !data.brief) throw new Error(data.error || "AI drafting failed");
      setAiBrief(data.brief);
      setAiBriefStatus("idle");
    } catch (error) {
      setAiBriefStatus("error");
      showNotice(error instanceof Error ? error.message : "AI drafting is unavailable");
    }
  }

  function toggleJobDetail(value: string) {
    setSelectedJobDetails((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function toggleQuoteInclude(value: string) {
    setQuoteIncludes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function showNotice(message: string) {
    setUiNotice(message);
    window.setTimeout(() => setUiNotice((current) => current === message ? null : current), 3200);
  }

  function openActiveJobRoom() {
    const job = conversations.find((item) => ["booked", "in_progress"].includes(item.status)) ?? persistedJobs.find((item) => ["booked", "in_progress"].includes(item.status));
    if (job) void openJobRoom(job);
    else showNotice("Your active Job Room will appear here once a live booking is available.");
  }

  function openDocument(documentType: string) {
    const document = generatedDocuments.find((item) => item.documentType === documentType);
    if (document) window.open(`/api/documents/${document.id}`, "_blank", "noopener,noreferrer");
    else showNotice("This document will be generated when a live quote is accepted.");
  }

  useEffect(() => {
    if (view !== "account") return;
    fetch("/api/jobs")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { jobs?: PersistedJob[] }) => {
        const jobs = data.jobs ?? [];
        setPersistedJobs(jobs);
        const currentJob = jobs.find((job) => ["booked", "in_progress"].includes(job.status));
        if (currentJob) void loadSavedQuotes(currentJob);
      })
      .catch(() => undefined);
  }, [view]);

  useEffect(() => {
    fetch("/api/notifications").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { notifications?: AppNotification[] }) => setNotifications(data.notifications ?? [])).catch(() => undefined);
  }, [view, quoteSent, acceptedQuoteId, roomMessages.length, roomEvents.length]);

  useEffect(() => {
    if (view !== "account" && view !== "contractor") return;
    fetch("/api/payments")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { payments?: PaymentRecord[] }) => setPaymentRecords(data.payments ?? []))
      .catch(() => undefined);
  }, [view, accountTab, proTab, acceptedQuoteId]);

  useEffect(() => {
    if (view !== "account" && view !== "contractor") return;
    fetch("/api/documents")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { documents?: GeneratedDocument[] }) => setGeneratedDocuments(data.documents ?? []))
      .catch(() => undefined);
  }, [view, accountTab, acceptedQuoteId]);

  useEffect(() => {
    if (view !== "contractor") return;
    fetch("/api/reputation").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { reputation?: typeof reputation }) => data.reputation && setReputation(data.reputation)).catch(() => undefined);
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
    fetch("/api/contractor-quotes")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { quotes?: ContractorQuote[] }) => setContractorQuotes(data.quotes ?? []))
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
        setBusinessAddress(profile.businessAddress);
        setYearsInBusiness(profile.yearsInBusiness);
        setBusinessAbout(profile.about);
        setPrimaryService(profile.primaryService);
        setSelectedServices(profile.services);
        setHomeBase(profile.homeBase);
        setServiceRadius(profile.serviceRadiusKm);
        setTeamSize(profile.teamSize);
        setEmergencyAvailable(profile.emergencyAvailable);
        setSelectedPlan(profile.plan);
      })
      .catch(() => undefined);
    fetch("/api/contractor-verification")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { documents?: VerificationDocument[] }) => setVerificationDocuments(data.documents ?? []))
      .catch(() => undefined);
  }, [view]);

  async function loadOperations() {
    setOperationsStatus("loading");
    try {
      const response = await fetch("/api/operations");
      if (!response.ok) throw new Error("Operations workspace unavailable");
      const data = (await response.json()) as { cases?: OperationsCase[]; stats?: typeof operationsStats; viewer?: { email?: string; displayName: string; role: string }; staff?: StaffMember[]; verifiedContractors?: VerifiedContractor[] };
      setOperationsCases(data.cases ?? []);
      setOperationsStaff(data.staff ?? []);
      setVerifiedContractors(data.verifiedContractors ?? []);
      if (data.stats) setOperationsStats(data.stats);
      setOperationsViewer(data.viewer ?? null);
      setOperationsStatus("idle");
    } catch {
      setOperationsStatus("error");
    }
  }

  useEffect(() => {
    if (view === "admin") void loadOperations();
  }, [view]);

  useEffect(() => {
    if (view === "admin" && adminTab === "verification") void loadOperations();
  }, [view, adminTab]);

  async function addOperationsStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStaffStatus("saving");
    setStaffError("");
    try {
      const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: staffEmail, displayName: staffName, role: staffRole }) });
      const data = (await response.json()) as { staffMember?: StaffMember; error?: string };
      if (!response.ok || !data.staffMember) throw new Error(data.error || "Access could not be saved");
      setOperationsStaff((current) => [...current.filter((item) => item.email !== data.staffMember!.email), data.staffMember!]);
      setStaffName("");
      setStaffEmail("");
      setStaffRole("employee");
      setStaffStatus("idle");
      showNotice(`${data.staffMember.displayName} can now access Operations.`);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Access could not be saved");
      setStaffStatus("error");
    }
  }

  async function removeOperationsStaff(member: StaffMember) {
    if (!window.confirm(`Remove Operations access for ${member.displayName}?`)) return;
    setStaffStatus("saving");
    setStaffError("");
    try {
      const response = await fetch("/api/operations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: member.email }) });
      const data = (await response.json()) as { removed?: boolean; error?: string };
      if (!response.ok || !data.removed) throw new Error(data.error || "Access could not be removed");
      setOperationsStaff((current) => current.filter((item) => item.email !== member.email));
      setStaffStatus("idle");
      showNotice(`${member.displayName}'s Operations access was removed.`);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Access could not be removed");
      setStaffStatus("error");
    }
  }

  function openCaseCreator() {
    const caseType = adminTab === "verification" ? "verification" : adminTab === "fraud" ? "fraud" : "dispute";
    setNewOperationsCase({ caseType, title: "", subject: "", summary: "", risk: "medium", priority: "normal", dueLabel: "" });
    setCaseCreateError("");
    setCaseCreateStatus("idle");
    setCaseCreateOpen(true);
  }

  async function createOperationsCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCaseCreateStatus("saving");
    setCaseCreateError("");
    try {
      const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "case", ...newOperationsCase }) });
      const data = (await response.json()) as { case?: OperationsCase; error?: string };
      if (!response.ok || !data.case) throw new Error(data.error || "Case could not be created");
      setOperationsCases((current) => [data.case!, ...current]);
      setOperationsStats((current) => ({ ...current, openCases: current.openCases + 1 }));
      setCaseCreateOpen(false);
      setCaseCreateStatus("idle");
      setAdminTab(data.case.caseType === "dispute" ? "disputes" : data.case.caseType);
      setSelectedOperationCase(data.case);
      showNotice(`${data.case.externalId} created.`);
    } catch (error) {
      setCaseCreateError(error instanceof Error ? error.message : "Case could not be created");
      setCaseCreateStatus("error");
    }
  }

  const filteredOperationsCases = useMemo(() => operationsCases.filter((item) => {
    const selectedCaseType = adminTab === "disputes" ? "dispute" : adminTab;
    if (adminTab !== "overview" && item.caseType !== selectedCaseType) return false;
    if (operationStatusFilter === "active" && ["resolved", "dismissed"].includes(item.status)) return false;
    if (operationStatusFilter !== "active" && operationStatusFilter !== "all" && item.status !== operationStatusFilter) return false;
    const query = operationSearch.trim().toLowerCase();
    return !query || [item.externalId, item.title, item.subject, item.summary, item.assignee].some((value) => value.toLowerCase().includes(query));
  }), [operationsCases, adminTab, operationStatusFilter, operationSearch]);

  const filteredVerifiedContractors = useMemo(() => {
    const query = operationSearch.trim().toLowerCase();
    return verifiedContractors.filter((profile) => !query || [profile.businessName, profile.ownerEmail, profile.primaryService, profile.homeBase, ...profile.services].some((value) => value.toLowerCase().includes(query)));
  }, [verifiedContractors, operationSearch]);

  const filteredHelpFaqs = useMemo(() => helpFaqs.filter((item) => {
    const matchesTopic = item.topic === helpTopic;
    const query = helpSearch.trim().toLowerCase();
    return matchesTopic && (!query || `${item.question} ${item.answer}`.toLowerCase().includes(query));
  }), [helpTopic, helpSearch]);

  const filteredConversations = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    return conversations.filter((job) => !query || `${job.externalId} ${job.category} ${job.title} ${job.status}`.toLowerCase().includes(query));
  }, [conversations, messageSearch]);

  const visibleContractorJobs = useMemo(() => conversations.filter((job) => jobView === "active" ? job.status === "in_progress" : jobView === "upcoming" ? job.status === "booked" : jobView === "completed" ? job.status === "completed" : false), [conversations, jobView]);
  const trackingJob = roomJob ?? selectedSavedJob ?? persistedJobs.find((job) => ["booked", "in_progress"].includes(job.status)) ?? null;
  const acceptedSavedQuote = savedQuotes.find((quote) => quote.status === "accepted") ?? null;

  async function updateOperationsCase(updates: Partial<Pick<OperationsCase, "status" | "risk" | "assignee" | "resolution">>, includeNote = false, decision?: "approved" | "changes_requested" | "rejected") {
    if (!selectedOperationCase) return;
    setOperationsStatus("saving");
    try {
      const response = await fetch("/api/operations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedOperationCase.id, ...updates, note: includeNote ? operationNote : undefined, decision }) });
      if (!response.ok) throw new Error("Case update failed");
      const data = (await response.json()) as { case: OperationsCase };
      const wasOpen = !["resolved", "dismissed"].includes(selectedOperationCase.status);
      const isOpen = !["resolved", "dismissed"].includes(data.case.status);
      setOperationsCases((current) => current.map((item) => item.id === data.case.id ? data.case : item));
      if (wasOpen !== isOpen) setOperationsStats((current) => ({ ...current, openCases: Math.max(0, current.openCases + (isOpen ? 1 : -1)) }));
      setSelectedOperationCase(data.case);
      setOperationNote("");
      setOperationsStatus("idle");
      showNotice(decision === "approved" ? `${data.case.subject} is now verified.` : decision === "rejected" ? `${data.case.subject} was not approved.` : decision === "changes_requested" ? `More information was requested from ${data.case.subject}.` : `${data.case.externalId} saved.`);
    } catch {
      setOperationsStatus("error");
    }
  }

  const availableOpportunities = useMemo(() => {
    const enabledServices = [primaryService, ...selectedServices].map((service) => service.toLowerCase());
    const matchesService = (job: Opportunity) => enabledServices.some((service) => service.includes(job.service.toLowerCase()) || job.service.toLowerCase().includes(service));
    const filtered = liveOpportunities
      .filter((job) => !dismissedOpportunities.includes(job.id) && matchesService(job))
      .filter((job) => job.distance === "Within service area" || Number.parseFloat(job.distance) <= opportunityRadius);
    return [...filtered].sort((a, b) => opportunitySort === "nearest" ? Number.parseFloat(a.distance) - Number.parseFloat(b.distance) : opportunitySort === "newest" ? filtered.indexOf(a) - filtered.indexOf(b) : b.match - a.match);
  }, [liveOpportunities, primaryService, selectedServices, dismissedOpportunities, opportunityRadius, opportunitySort]);

  function changePrimaryService(service: string) {
    setPrimaryService(service);
    setSelectedServices([service]);
  }

  function beginRequest(value?: string, picked?: string) {
    let detectedCategory = picked;
    if (value?.trim()) {
      setScope(value.trim());
      const lower = value.toLowerCase();
      if (lower.includes("roof") || lower.includes("shingle")) detectedCategory = "Roofing";
      else if (lower.includes("paint")) detectedCategory = "Painting";
      else if (lower.includes("plumb") || lower.includes("pipe") || lower.includes("drain") || lower.includes("leak")) detectedCategory = "Plumbing";
      else if (lower.includes("electric") || lower.includes("light") || lower.includes("panel")) detectedCategory = "Electrical";
      else if (lower.includes("furnace") || lower.includes("air condition") || lower.includes("hvac") || lower.includes("heat pump")) detectedCategory = "HVAC";
      else if (lower.includes("move") || lower.includes("packing")) detectedCategory = "Moving";
      else if (lower.includes("junk") || lower.includes("debris") || lower.includes("cleanout")) detectedCategory = "Junk removal";
      else if (lower.includes("landscap") || lower.includes("lawn") || lower.includes("sod") || lower.includes("garden")) detectedCategory = "Landscaping";
      else if (lower.includes("floor") || lower.includes("carpet") || lower.includes("hardwood")) detectedCategory = "Flooring";
      else if (lower.includes("deck") || lower.includes("carpentry") || lower.includes("cabinet")) detectedCategory = "Carpentry";
      else if (lower.includes("renovat") || lower.includes("basement") || lower.includes("kitchen") || lower.includes("bathroom")) detectedCategory = "General contracting";
    }
    if (detectedCategory) changeRequestCategory(detectedCategory, Boolean(value?.trim()));
    setStep(0);
    setView("request");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitPrompt(event: FormEvent) {
    event.preventDefault();
    if (prompt.trim()) beginRequest(prompt.trim());
  }

  function go(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startVoiceCapture() {
    type RecognitionResultEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
    type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; onresult: ((event: RecognitionResultEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
    const browserWindow = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const RecognitionConstructor = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!RecognitionConstructor) { setSilentStatus("unsupported"); return; }
    const recognition = new RecognitionConstructor();
    recognition.lang = "en-CA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setSilentStatus("listening");
    recognition.onresult = (event) => { setSilentTranscript(event.results[0][0].transcript.trim()); setSilentStatus("ready"); };
    recognition.onerror = () => setSilentStatus("error");
    recognition.onend = () => setSilentStatus((current) => current === "listening" ? "idle" : current);
    recognition.start();
  }

  async function openLatestRequest(target: "matches" | "tracking" = "matches") {
    try {
      const response = await fetch("/api/jobs");
      if (!response.ok) throw new Error("Unable to load jobs");
      const data = (await response.json()) as { jobs?: PersistedJob[] };
      const jobs = data.jobs ?? [];
      setPersistedJobs(jobs);
      const job = target === "tracking" ? jobs.find((item) => ["booked", "in_progress"].includes(item.status)) : jobs[0];
      if (!job) { go(target === "tracking" ? "account" : "request"); return; }
      setSavedRequestId(job.externalId);
      setCategory(job.category);
      setScope(job.title);
      if (job.size) setSize(job.size);
      if (job.timeline) { if (["Before Friday", "Within a week", "Within a month", "I’m flexible"].includes(job.timeline)) setTimeline(job.timeline); else { setTimeline("Custom"); setCustomTimeline(job.timeline); } }
      if (job.budget) { if (["$1,000–$2,000", "$2,000–$2,500", "$2,500–$5,000", "Need guidance"].includes(job.budget)) setBudget(job.budget); else { setBudget("Custom"); setCustomBudget(job.budget); } }
      setSelectedSavedJob(job);
      await loadSavedQuotes(job);
      if (target === "tracking") await openJobRoom(job);
      go(target);
    } catch {
      showNotice("Your saved jobs could not be loaded. Please try again.");
    }
  }

  function chooseRequestFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime", "video/webm"]);
    if (selected.length > 5) return setUploadError("Choose up to 5 photos or videos.");
    if (selected.some((file) => !allowed.has(file.type))) return setUploadError("Use JPG, PNG, WebP, HEIC, MP4, MOV or WebM files.");
    if (selected.some((file) => file.size > 25 * 1024 * 1024) || selected.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) return setUploadError("Files are limited to 25 MB each and 50 MB total.");
    setRequestFiles(selected);
    setUploadError(null);
  }

  async function saveJobRequest() {
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: aiBrief?.title || scope, description: effectiveBrief, size, timeline: requestTimeline, budget: requestBudget, postalCode, emergency: isEmergency }),
      });
      if (!response.ok) throw new Error("Unable to save request");
      const data = (await response.json()) as { job: PersistedJob };
      const createdJob = data.job;
      setSavedRequestId(createdJob.externalId);
      setPersistedJobs((current) => [createdJob, ...current.filter((job) => job.id !== createdJob.id)]);
      if (requestFiles.length) {
        const form = new FormData();
        requestFiles.forEach((file) => form.append("files", file));
        const uploadResponse = await fetch(`/api/jobs/${createdJob.id}/attachments`, { method: "POST", body: form });
        if (!uploadResponse.ok) setUploadError("Your request was posted, but the files did not finish uploading.");
        else { setRequestFiles([]); setUploadError(null); }
      }
      await loadSavedQuotes(createdJob);
      setSaveStatus("saved");
      go("matches");
    } catch {
      setSaveStatus("error");
    }
  }

  async function submitEmergencyRequest() {
    if (!emergencyConsent || emergencyDescription.trim().length < 10 || emergencyAddress.trim().length < 5) {
      setEmergencyStatus("error");
      return;
    }
    const emergencyCategory = emergencyType === "Active water leak" ? "Plumbing" : emergencyType === "No heat / HVAC" ? "HVAC" : emergencyType === "Electrical issue" ? "Electrical" : "Roofing";
    setEmergencyStatus("saving");
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: emergencyCategory, title: emergencyType, description: `${emergencyDescription.trim()} Service address: ${emergencyAddress.trim()}`, size: "Emergency assessment required", timeline: "Immediate priority dispatch", budget: "Emergency rates accepted; confirm before extra work", postalCode: emergencyAddress.trim(), emergency: true }) });
      if (!response.ok) throw new Error("Emergency request failed");
      const data = (await response.json()) as { job: { id: number; externalId: string } };
      setEmergencyJob(data.job);
      setSavedRequestId(data.job.externalId);
      setEmergencyStatus("idle");
      setEmergencyStage(1);
    } catch {
      setEmergencyStatus("error");
    }
  }

  async function updateEmergencyRequestStatus(status: "cancelled") {
    if (!emergencyJob) return;
    setEmergencyStatus("saving");
    try {
      const response = await fetch(`/api/jobs/${emergencyJob.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error("Emergency update failed");
      setEmergencyStatus("idle");
      setEmergencyStage(0);
      setEmergencyJob(null);
    } catch {
      setEmergencyStatus("error");
    }
  }

  function dateTimeInputValue(value?: string | number | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  function scheduledStartLabel(value?: string | number | null) {
    if (!value) return "Not scheduled yet";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not scheduled yet" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  async function deleteSavedRequest(job: PersistedJob) {
    if (!window.confirm(`Delete ${job.externalId}? This permanently removes the request and any unaccepted quotes.`)) return;
    try {
      const response = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to delete this request");
      setPersistedJobs((current) => current.filter((item) => item.id !== job.id));
      if (selectedSavedJob?.id === job.id) {
        setSelectedSavedJob(null);
        setSavedQuotes([]);
        setSavedRequestId("");
      }
      showNotice(`${job.externalId} was deleted.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to delete this request");
    }
  }

  async function submitQuote() {
    if (!quoteJob) return;
    if (!quoteJob.numericId) { setQuoteSubmitError("This opportunity is missing its job reference. Refresh Opportunities and try again."); setQuoteSubmitStatus("error"); return; }
    setQuoteSubmitStatus("saving");
    setQuoteSubmitError("");
    try {
      const response = await fetch(`/api/jobs/${quoteJob.numericId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(quoteAmount), message: quoteNote, availableAt: quoteAvailability, contractorName: contractorProfile?.businessName || businessName }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to submit quote");
      setQuoteSent(quoteJob.id);
      setQuoteSubmitStatus("idle");
      setQuoteJob(null);
    } catch (error) {
      setQuoteSubmitError(error instanceof Error ? error.message : "Unable to submit quote");
      setQuoteSubmitStatus("error");
    }
  }

  function openQuote(job: Opportunity) {
    setQuoteSubmitStatus("idle");
    setQuoteSubmitError("");
    setQuoteAmount("");
    setQuoteNote("Quote includes labour, materials and cleanup. Final scope will be confirmed with the homeowner before work begins.");
    setQuoteAvailability("Schedule to be confirmed with the homeowner");
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
      const bookedJob = { ...selectedSavedJob, status: "booked" };
      setAcceptedQuoteId(quote.id);
      setSavedQuotes((current) => current.map((item) => ({ ...item, status: item.id === quote.id ? "accepted" : "declined" })));
      setSelectedSavedJob(bookedJob);
      setPersistedJobs((current) => current.map((job) => job.id === selectedSavedJob.id ? bookedJob : job));
      await openJobRoom(bookedJob);
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
      const data = (await response.json()) as { messages?: RoomMessage[]; events?: RoomEvent[]; changeOrders?: ChangeOrderRecord[]; review?: VerifiedReview | null; attachments?: JobAttachment[] };
      setRoomMessages(data.messages ?? []);
      setRoomEvents(data.events ?? []);
      setRoomChangeOrders(data.changeOrders ?? []);
      setRoomReview(data.review ?? null);
      setRoomAttachments(data.attachments ?? []);
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

  async function saveContractorProfile(complete = true) {
    setProfileStatus("saving");
    try {
      const response = await fetch("/api/contractor-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, legalName, phone: businessPhone, businessAddress, yearsInBusiness, about: businessAbout, primaryService, services: Array.from(new Set([primaryService, ...selectedServices])), homeBase, serviceRadiusKm: serviceRadius, teamSize, emergencyAvailable, acceptingWork: false, plan: selectedPlan }),
      });
      if (!response.ok) throw new Error("Unable to save profile");
      const data = (await response.json()) as { profile: ContractorProfile };
      setContractorProfile(data.profile);
      setProfileStatus("saved");
      setOnboardingStep(complete ? 4 : 2);
    } catch {
      setProfileStatus("error");
    }
  }

  async function uploadVerificationDocument(file: File) {
    if (!verificationUploadType) return;
    setVerificationUploadStatus("saving");
    const form = new FormData();
    form.append("documentType", verificationUploadType);
    form.append("file", file);
    try {
      const response = await fetch("/api/contractor-verification", { method: "POST", body: form });
      const data = (await response.json()) as { document?: VerificationDocument; error?: string };
      if (!response.ok || !data.document) throw new Error(data.error || "Upload failed");
      setVerificationDocuments((current) => [...current.filter((item) => item.documentType !== data.document!.documentType), data.document!]);
      setVerificationUploadStatus("idle");
      showNotice(`${data.document.filename} uploaded for Operations review.`);
    } catch (error) {
      setVerificationUploadStatus("error");
      showNotice(error instanceof Error ? error.message : "Verification upload failed");
    }
  }

  async function updateContractorProfile(updates: Partial<Pick<ContractorProfile, "acceptingWork" | "emergencyAvailable" | "serviceRadiusKm">>) {
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

  async function startPaymentCheckout(payment: PaymentRecord) {
    setPaymentCheckoutId(payment.id);
    try {
      const response = await fetch("/api/payments/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: payment.id }) });
      const data = (await response.json()) as { payment?: PaymentRecord; message?: string; error?: string };
      if (!response.ok || !data.payment) throw new Error(data.error || "Payment simulation is unavailable");
      setPaymentRecords((current) => current.map((item) => item.id === payment.id ? { ...item, ...data.payment, viewerRole: item.viewerRole } : item));
      setPaymentCheckoutId(null);
      showNotice(data.message || "Payment simulated. No funds moved.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Payment simulation is unavailable");
      setPaymentCheckoutId(null);
    }
  }

  async function startSubscriptionCheckout(plan: "starter" | "growth" | "pro") {
    setProfileStatus("saving");
    try {
      const response = await fetch("/api/contractor-subscription/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = (await response.json()) as { profile?: ContractorProfile; message?: string; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Demo plan could not be activated");
      setContractorProfile(data.profile);
      setSelectedPlan(data.profile.plan);
      setProfileStatus("saved");
      showNotice(data.message || "Demo plan activated.");
    } catch (error) {
      setProfileStatus("error");
      showNotice(error instanceof Error ? error.message : "Demo plan could not be activated");
    }
  }

  async function openSubscriptionPortal() {
    setProfileStatus("saving");
    try {
      const response = await fetch("/api/contractor-subscription/portal", { method: "POST" });
      const data = (await response.json()) as { profile?: ContractorProfile; message?: string; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Demo billing settings are unavailable");
      setProfileStatus("saved");
      showNotice(data.message || "Choose a plan to simulate a change.");
    } catch (error) {
      setProfileStatus("error");
      showNotice(error instanceof Error ? error.message : "Billing management is unavailable");
    }
  }

  async function openPayoutSetup() {
    setProfileStatus("saving");
    try {
      const response = await fetch("/api/contractor-payments/connect", { method: "POST" });
      const data = (await response.json()) as { profile?: ContractorProfile; message?: string; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Demo payout setup is unavailable");
      setContractorProfile(data.profile);
      setProfileStatus("saved");
      showNotice(data.message || "Demo payout destination enabled.");
    } catch (error) {
      setProfileStatus("error");
      showNotice(error instanceof Error ? error.message : "Payout setup is unavailable");
    }
  }

  async function refreshPayoutStatus() {
    try {
      const response = await fetch("/api/contractor-payments/connect");
      const data = (await response.json()) as { payoutsEnabled?: boolean };
      if (response.ok) setContractorProfile((current) => current ? { ...current, payoutsEnabled: Boolean(data.payoutsEnabled) } : current);
    } catch { /* Status remains unchanged until the next refresh. */ }
  }

  async function updateJobProgress(job: PersistedJob, stage: "materials_collected" | "work_started" | "halfway" | "cleaning" | "finished") {
    setProgressUpdatingId(job.id);
    setProgressError(null);
    try {
      const response = await fetch(`/api/jobs/${job.id}/progress`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Unable to update progress");
      }
      const data = (await response.json()) as { job: { status: string } };
      setConversations((current) => current.map((item) => item.id === job.id ? { ...item, status: data.job.status } : item));
      if (roomJob?.id === job.id) await openJobRoom({ ...job, status: data.job.status });
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Unable to update progress");
    } finally {
      setProgressUpdatingId(null);
    }
  }

  async function scheduleJobStart(job: PersistedJob) {
    const value = scheduledStartValues[job.id] ?? dateTimeInputValue(job.scheduledStartAt);
    if (!value) { setProgressError("Choose a start date and time first."); return; }
    setProgressUpdatingId(job.id);
    setProgressError(null);
    try {
      const response = await fetch(`/api/jobs/${job.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledStartAt: new Date(value).toISOString() }) });
      const data = (await response.json().catch(() => ({}))) as { job?: PersistedJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || "Unable to schedule the job");
      setConversations((current) => current.map((item) => item.id === job.id ? { ...item, ...data.job } : item));
      if (roomJob?.id === job.id) await openJobRoom({ ...roomJob, ...data.job });
      showNotice(`Start scheduled for ${scheduledStartLabel(data.job.scheduledStartAt)}.`);
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Unable to schedule the job");
    } finally {
      setProgressUpdatingId(null);
    }
  }

  async function submitLiveChangeOrder() {
    if (!liveChangeOrderJob) return;
    setChangeStatus("saving");
    try {
      const response = await fetch(`/api/jobs/${liveChangeOrderJob.id}/change-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: changeReason, description: changeDescription, amount: Number(changeAmount), scheduleImpact: changeSchedule }) });
      if (!response.ok) throw new Error("Unable to create change order");
      setChangeStatus("idle"); setLiveChangeOrderJob(null);
    } catch { setChangeStatus("error"); }
  }

  async function decideChangeOrder(order: ChangeOrderRecord, decision: "approved" | "declined") {
    if (!roomJob) return;
    setRoomStatus("sending");
    try {
      const decisionName = accountIdentity?.displayName || "Homeowner";
      const response = await fetch(`/api/jobs/${roomJob.id}/change-orders`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changeOrderId: order.id, decision, decisionName }) });
      if (!response.ok) throw new Error("Unable to record decision");
      setRoomChangeOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: decision, decisionName } : item));
      setRoomStatus("idle");
    } catch { setRoomStatus("error"); }
  }

  async function submitVerifiedReview() {
    if (!roomJob) return;
    setReviewStatus("saving");
    try {
      const response = await fetch(`/api/jobs/${roomJob.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...reviewScores, comment: reviewComment }) });
      if (!response.ok) throw new Error("Unable to submit review");
      const data = (await response.json()) as { review: VerifiedReview };
      setRoomReview(data.review); setReviewStatus("idle");
    } catch { setReviewStatus("error"); }
  }

  async function openNotification(notification: AppNotification) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notification.id }) }).catch(() => undefined);
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: Date.now() } : item));
    setNotificationsOpen(false);
    if (notification.jobId) {
      try {
        const response = await fetch(`/api/jobs/${notification.jobId}`);
        if (response.ok) {
          const data = (await response.json()) as { job: PersistedJob };
          await openJobRoom(data.job);
          return;
        }
      } catch { /* fall through to workspace */ }
    }
    if (view === "contractor") setProTab("inbox"); else { setAccountTab("jobs"); go("account"); }
  }

  async function markAllNotificationsRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => undefined);
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || Date.now() })));
  }

  async function submitSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupportStatus("sending");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: form.get("topic"),
          jobExternalId: form.get("jobExternalId"),
          message: form.get("message"),
        }),
      });
      if (!response.ok) throw new Error("Unable to send support request");
      const data = (await response.json()) as { request: { externalId: string } };
      setSupportReference(data.request.externalId);
      setSupportStatus("sent");
    } catch {
      setSupportStatus("error");
    }
  }

  return (
    <main>
      <header className={`site-header ${view === "contractor" ? "pro-header" : ""}`}>
        <button className="brand" onClick={() => go("discover")} aria-label="JobLink home">
          <span className="brand-mark"><i /></span>
          <span>JobLink</span>
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
            <button className={view === "matches" ? "active" : ""} onClick={() => void openLatestRequest("matches")}>My request</button>
            <button className={view === "tracking" ? "active" : ""} onClick={() => void openLatestRequest("tracking")}>Track job</button>
          </nav>
        )}
        <div className="header-actions">
          <button className="text-button" onClick={openContractorArea}>{view === "contractor" ? "Homeowner view" : "For contractors"}</button>
          {accountLoaded && !accountIdentity && <button className="account-entry-button" onClick={() => setAccountGatewayOpen(true)}>Sign up / Log in</button>}
          {accountIdentity && <button className="notification-button" aria-label="Open notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}>{accountInitials}{notifications.filter((item) => !item.readAt).length > 0 && <b>{notifications.filter((item) => !item.readAt).length}</b>}</button>}
          {accountIdentity && <button className="avatar-button" aria-label="Open account menu" onClick={() => setAccountGatewayOpen(true)}>{accountInitials}</button>}
        </div>
      </header>

      {accountGatewayOpen && <div className="account-gateway-overlay" role="dialog" aria-modal="true" aria-labelledby="account-gateway-title">
        <section className="account-gateway">
          <button className="account-gateway-close" onClick={() => setAccountGatewayOpen(false)} aria-label="Close account options">×</button>
          <header>
            <span className="brand-mark"><i /></span>
            <div><p className="step-kicker">JobLink demo accounts</p><h2 id="account-gateway-title">Choose your workspace.</h2><p>{accountIdentity ? `Signed in as ${accountIdentity.displayName}` : "Sign in securely, then create a homeowner or contractor demo account."}</p></div>
          </header>
          <div className="account-choice-grid">
            <article>
              <span>HM</span><p className="aside-label">Homeowner demo account</p><h3>Post and manage jobs</h3><p>Create requests, compare real submitted quotes, track work and simulate payments.</p>
              <ul><li>Free to post</li><li>Shortlisted local pros</li><li>Job tracking and documents</li></ul>
              <button disabled={accountActionStatus === "saving"} onClick={() => void selectAccountRole("homeowner")}>{accountIdentity?.role === "homeowner" ? "Open homeowner account →" : accountIdentity ? "Continue as homeowner →" : "Sign up as a homeowner →"}</button>
            </article>
            <article className="contractor-account-choice">
              <span>PRO</span><p className="aside-label">Contractor demo account</p><h3>Build your business profile</h3><p>Select services and territory, submit verification, receive matched opportunities and quote jobs.</p>
              <ul><li>No pay-per-lead fees</li><li>Service-based matching</li><li>Quotes, jobs and payments</li></ul>
              <button disabled={accountActionStatus === "saving"} onClick={() => void selectAccountRole("contractor")}>{accountIdentity?.role === "contractor" ? "Open contractor workspace →" : accountIdentity ? "Continue as contractor →" : "Sign up as a contractor →"}</button>
            </article>
            <article className="admin-account-choice">
              <span>OPS</span><p className="aside-label">JobLink employees</p><h3>Operations login</h3><p>Protected access for authorized administrators and employees handling verification, fraud and disputes.</p>
              <ul><li>Role-protected access</li><li>Audited case notes</li><li>Live marketplace operations</li></ul>
              <button disabled={accountActionStatus === "saving"} onClick={() => void openOperationsLogin()}>{accountActionStatus === "saving" ? "Checking access…" : "Log in to Operations →"}</button>
            </article>
          </div>
          {accountActionError && <p className="account-gateway-error">{accountActionError}</p>}
          <footer>{accountIdentity ? <><span>{accountIdentity.email} · {accountIdentity.role ? accountIdentity.role.replace("employee", "operations employee") : "choose an account type"}{accountIdentity.operationsRole ? ` · Operations ${accountIdentity.operationsRole} access retained` : ""}</span><a href="/signout-with-chatgpt?return_to=%2F">Sign out</a></> : <span>Secure authentication is handled by ChatGPT. JobLink does not store a password.</span>}</footer>
        </section>
      </div>}

      {notificationsOpen && <aside className="notification-centre"><div className="notification-centre-head"><div><p className="aside-label">JobLink alerts</p><h2>Notifications</h2></div><button onClick={markAllNotificationsRead}>Mark all read</button></div>{notifications.length === 0 ? <div className="notification-empty">You’re all caught up.</div> : <div className="notification-list">{notifications.map((notification) => <button key={notification.id} className={!notification.readAt ? "unread" : ""} onClick={() => openNotification(notification)}><span>{notification.notificationType.slice(0,2).toUpperCase()}</span><div><b>{notification.title}</b><p>{notification.body}</p><small>{new Date(notification.createdAt).toLocaleString()}</small></div></button>)}</div>}</aside>}

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
            <div className="hero-quick-actions"><button onClick={() => go("emergency")}><span>!</span><div><b>Emergency help</b><small>Post a priority request</small></div><em>→</em></button><button onClick={() => go("silent")}><span>◉</span><div><b>Use Silent Mode</b><small>Start a request by voice</small></div><em>→</em></button><button onClick={() => accountIdentity ? go("account") : setAccountGatewayOpen(true)}><span>JL</span><div><b>Manage requests</b><small>Open saved jobs and quotes</small></div><em>→</em></button></div>
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
              <p className="section-label">How JobLink works</p>
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
              <p>JobLink reputation uses reviews tied to completed jobs, while Operations separately records verification evidence, disputes and resolutions.</p>
            </div>
            <div className="score-card">
              <div className="score-top"><span>What JobLink verifies</span><b>REAL<small>DATA</small></b></div>
              <div className="score-bar"><i /></div>
              <div className="score-grid"><span><b>ID</b>Business identity</span><span><b>LIC</b>Required licences</span><span><b>JOB</b>Completed work</span><span><b>REV</b>Verified reviews</span></div>
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
                <select id="category" value={category} onChange={e => changeRequestCategory(e.target.value)}>
                  {categories.map(([name]) => <option key={name}>{name}</option>)}
                </select>
                <div className="service-intake-summary"><span>{category.slice(0, 2).toUpperCase()}</span><div><b>{category}</b><p>{serviceIntake.intro}</p></div></div>
                <label className="field-label">What kind of {category.toLowerCase()} job is this?</label>
                <div className="job-type-grid">
                  {serviceIntake.jobTypes.map((jobType) => <button type="button" key={jobType} className={selectedJobType === jobType ? "selected" : ""} onClick={() => setSelectedJobType(jobType)}>{jobType}<span>{selectedJobType === jobType ? "✓" : "+"}</span></button>)}
                </div>
                <label className="field-label" htmlFor="scope">Describe the job</label>
                <textarea id="scope" value={scope} onChange={e => setScope(e.target.value)} rows={5} placeholder={serviceIntake.prompt} />
                <div className="tip-row"><span>✦</span><p><b>Good start.</b> We’ll ask two details next, then write the full brief for you.</p></div>
              </>}
              {step === 1 && <>
                <p className="step-kicker">Step 2 of 4</p>
                <h1>A few useful details.</h1>
                <p className="form-intro">This helps pros price your job accurately before they contact you.</p>
                <label className="field-label" htmlFor="size">{serviceIntake.sizeQuestion}</label>
                <input id="size" value={size} onChange={e => setSize(e.target.value)} placeholder={serviceIntake.sizePlaceholder} />
                <label className="field-label">Select everything a professional should know</label>
                <div className="option-grid service-detail-options">
                  {serviceIntake.details.map((option) => <label key={option} className={`check-option ${selectedJobDetails.includes(option) ? "selected" : ""}`}><input type="checkbox" checked={selectedJobDetails.includes(option)} onChange={() => toggleJobDetail(option)} /><span>✓</span>{option}</label>)}
                </div>
                <label className="field-label">What should the quote include?</label>
                <div className="option-grid">
                  {["Materials", "Site protection", "Cleanup", "Disposal"].map((option) => <label key={option} className={`check-option ${quoteIncludes.includes(option) ? "selected" : ""}`}><input type="checkbox" checked={quoteIncludes.includes(option)} onChange={() => toggleQuoteInclude(option)} /><span>✓</span>{option}</label>)}
                </div>
                <label className="field-label" htmlFor="additional-details">Anything else that could affect the work?</label>
                <textarea id="additional-details" rows={3} value={additionalDetails} onChange={(event) => setAdditionalDetails(event.target.value)} placeholder="Access restrictions, parking, pets, material preferences or anything else the pro should know." />
                <label className="upload-box"><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm" onChange={(event) => chooseRequestFiles(event.target.files)} /><span>+</span><b>{requestFiles.length ? `${requestFiles.length} file${requestFiles.length === 1 ? "" : "s"} ready` : "Add photos or a video"}</b><small>Up to 5 files · 25 MB each · 50 MB total</small></label>
                {requestFiles.length > 0 && <div className="selected-upload-list">{requestFiles.map((file, index) => <div key={`${file.name}-${file.size}`}><span>{file.type.startsWith("video/") ? "VID" : "IMG"}</span><p><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></p><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setRequestFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>}
                {uploadError && <p className="upload-error">{uploadError}</p>}
              </>}
              {step === 2 && <>
                <p className="step-kicker">Step 3 of 4</p>
                <h1>When and where?</h1>
                <p className="form-intro">Your exact address stays private until you accept a quote.</p>
                <label className="field-label" htmlFor="timeline">Preferred timing</label>
                <select id="timeline" value={timeline} onChange={e => setTimeline(e.target.value)}><option>Before Friday</option><option>Within a week</option><option>Within a month</option><option>I’m flexible</option><option>Custom</option></select>
                {timeline === "Custom" && <label className="custom-request-field" htmlFor="custom-timeline">Describe your preferred timing<input id="custom-timeline" value={customTimeline} onChange={(event) => setCustomTimeline(event.target.value)} placeholder="Example: Any weekday after 4 PM, before August 15" autoFocus /></label>}
                <label className="field-label" htmlFor="budget">Target budget</label>
                <select id="budget" value={budget} onChange={e => setBudget(e.target.value)}><option>$1,000–$2,000</option><option>$2,000–$2,500</option><option>$2,500–$5,000</option><option>Need guidance</option><option>Custom</option></select>
                {budget === "Custom" && <label className="custom-request-field" htmlFor="custom-budget">Enter an amount or range<input id="custom-budget" value={customBudget} onChange={(event) => setCustomBudget(event.target.value)} placeholder="Example: $750 maximum or $3,000–$4,500" /></label>}
                <label className="field-label" htmlFor="postal">Postal code</label>
                <input id="postal" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
                <label className="emergency-toggle"><input type="checkbox" checked={isEmergency} onChange={(event) => setIsEmergency(event.target.checked)} /><span /><div><b>This is an emergency</b><small>Alert available pros immediately</small></div></label>
              </>}
              {step === 3 && <>
                <p className="step-kicker ai-kicker">✦ {aiBrief ? "AI-polished request" : "Guided request draft"}</p>
                <h1>Clear scope. Better quotes.</h1>
                <p className="form-intro">Review the brief we’ll send to qualified {category.toLowerCase()} pros near you.</p>
                <div className="brief-card">
                  <div className="brief-head"><span>{category}</span><button type="button" onClick={() => setStep(0)}>Edit</button></div>
                  <h3>{aiBrief?.title || scope}</h3>
                  <p>{effectiveBrief}</p>
                  <div className="brief-tags"><span>{selectedJobType}</span><span>◷ {requestTimeline}</span><span>⌂ {postalCode}</span><span>◎ {requestBudget}</span>{isEmergency && <span>! Emergency</span>}{requestFiles.length > 0 && <span>▣ {requestFiles.length} visual{requestFiles.length === 1 ? "" : "s"}</span>}</div>
                </div>
                <button type="button" className="secondary-action" disabled={aiBriefStatus === "saving" || !scope.trim()} onClick={() => void generateAiBrief()}>{aiBriefStatus === "saving" ? "Improving with AI…" : aiBrief ? "Regenerate AI brief" : "Improve this brief with AI"}</button>{aiBriefStatus === "error" && <p className="save-error">AI drafting is unavailable. The guided brief above remains ready to post.</p>}
                <div className="privacy-note"><span>✓</span><p><b>Your contact details stay private.</b> Pros can only message through JobLink until you choose one.</p></div>
              </>}
              <div className="form-footer">
                <span>{step < 3 ? "Usually takes less than a minute" : "Free to post · no obligation"}</span>
                <button disabled={saveStatus === "saving" || !requestStepValid} onClick={() => step < 3 ? setStep(step + 1) : saveJobRequest()}>{step < 3 ? "Continue" : saveStatus === "saving" ? "Saving request…" : saveStatus === "error" ? "Try saving again" : "Send to matched pros"} <span>→</span></button>
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
            <div><p className="step-kicker">{savedRequestId ? `Request ${savedRequestId}` : "Quote comparison"}</p><h1>Your submitted quotes.</h1><p>Only real quotes from verified {category.toLowerCase()} contractors appear here.</p>{savedRequestId && <span className="persisted-note">✓ Saved to your JobLink account</span>}{uploadError && <span className="persisted-note upload-warning">! {uploadError}</span>}</div>
            <div className="matching-status"><span><i /></span><div><b>{savedQuotes.length} quote{savedQuotes.length === 1 ? "" : "s"}</b><small>Loaded from your request</small></div></div>
          </div>
          <div className="job-summary-strip"><span><b>{category} · {selectedJobType}</b>{size} · {postalCode}</span><span><b>Target</b>{requestTimeline}</span><span><b>Budget</b>{requestBudget}</span><button onClick={() => { setStep(3); go("request"); }}>View request</button></div>
          <div className="match-layout">
            <div className="contractor-list">
              {savedRequestId && savedQuotesStatus === "loading" && <div className="matches-loading"><span>JL</span><h3>Loading verified quotes…</h3><p>Your saved request is ready. We’re retrieving its current quote status.</p></div>}
              {savedRequestId && savedQuotes.length > 0 && savedQuotes.map((quote, index) => (
                <article className={`contractor-card ${index === 0 ? "featured" : ""}`} key={quote.id}>
                  <div className="rank">0{index + 1}</div><div className="pro-logo">{quote.contractorName.split(" ").slice(0,2).map((word) => word[0]).join("")}</div><div className="pro-main"><div className="pro-title"><div><span className="match-badge">{index === 0 ? "Lowest submitted price" : "Verified contractor"}</span><h2>{quote.contractorName} <small>✓</small></h2></div></div><div className="pro-facts"><span>Profile approved by Operations</span><span>Quote stored with this job</span></div><div className="quote-row"><div><small>Available</small><b>{quote.availableAt}</b></div><div><small>Submitted quote</small><b className="quote-price">${(quote.amountCents / 100).toLocaleString()}</b></div></div><p className="quote-note">✓ {quote.message}</p><div className="card-actions"><button className="secondary-action" onClick={() => { setStep(3); go("request"); }}>Review scope</button><button className="primary-action" disabled={savedQuotesStatus === "loading" || (acceptedQuoteId !== null && acceptedQuoteId !== quote.id)} onClick={() => void acceptSavedQuote(quote)}>{quote.status === "accepted" ? "Selected ✓" : quote.status === "declined" ? "Another pro selected" : "Choose this pro"}</button></div></div>
                </article>
              ))}
              {!savedRequestId && <div className="matches-loading"><span>JL</span><h3>No request selected</h3><p>Post a request or open one from your account to compare its quotes.</p><button onClick={() => beginRequest()}>Post a request →</button></div>}
              {savedRequestId && savedQuotesStatus !== "loading" && savedQuotes.length === 0 && <div className="matches-loading"><span>JL</span><h3>Waiting for verified contractors</h3><p>Your request is live. JobLink will notify you when a qualified contractor submits a real quote.</p><button onClick={() => go("account")}>Open my requests →</button></div>}
            </div>
            {savedQuotes.length > 0 && <aside className="insight-card">
              <span className="insight-icon">✦</span>
              <p className="aside-label">JobLink insight</p>
              <h3>{savedQuotes[0].contractorName} submitted the lowest current price.</h3>
              <p>Compare the written scope and availability before choosing. JobLink does not invent rankings or prices.</p>
              <div><span>Submitted price</span><b>${(savedQuotes[0].amountCents / 100).toLocaleString()}</b></div><div><span>Availability</span><b>{savedQuotes[0].availableAt}</b></div>
              <button disabled={savedQuotesStatus === "loading" || Boolean(acceptedQuoteId)} onClick={() => void acceptSavedQuote(savedQuotes[0])}>{acceptedQuoteId ? "Contractor selected ✓" : "Choose lowest quote →"}</button>
            </aside>}
          </div>
          {acceptedSavedQuote && <div className="accepted-banner"><span>✓</span><div><b>{acceptedSavedQuote.contractorName} has been selected.</b><p>Your booking record and Job Room are ready.</p></div><button onClick={() => go("tracking")}>Open job progress →</button></div>}
        </section>
      )}

      {view === "tracking" && (
        <section className="app-shell tracking-shell">
          {!trackingJob ? <div className="operations-empty"><span>JL</span><h2>No booked job to track</h2><p>Live progress appears after you select a submitted contractor quote.</p><button onClick={() => void openLatestRequest("matches")}>View my latest request</button></div> : <>
            <div className="tracking-top"><div><p className="step-kicker">{trackingJob.status === "booked" ? "Booked job" : "Active job"} · {trackingJob.externalId}</p><h1>{trackingJob.status === "booked" ? "Your professional is confirmed." : "Job progress."}</h1><p>{trackingJob.category} · {trackingJob.title}{acceptedSavedQuote ? ` with ${acceptedSavedQuote.contractorName}` : ""}</p></div><button className="support-button" onClick={() => go("help")}>Need help?</button></div>
            <div className="tracking-layout"><div className="live-card"><div className="arrival-panel"><span className="pulse-icon"><i /></span><div><small>{trackingJob.status.replaceAll("_", " ")}</small><h2>{acceptedSavedQuote?.availableAt || trackingJob.timeline || "Schedule pending"}</h2><p>Contractor updates are timestamped in the Job Room.</p></div><button onClick={() => void openJobRoom(trackingJob)}>Open Job Room</button></div></div><aside className="job-detail-card"><p className="aside-label">Recorded progress</p>{roomEvents.length ? <ol className="timeline">{roomEvents.map((event, index) => <li key={event.id} className={index < roomEvents.length - 1 ? "complete" : "current"}><span>{index < roomEvents.length - 1 ? "✓" : <i />}</span><div><b>{event.label}</b><small>{new Date(event.createdAt).toLocaleString()}</small></div></li>)}</ol> : <div className="operations-no-results"><b>No progress updates yet.</b><p>Your contractor can add milestones from the Job Room.</p></div>}</aside></div>
            <div className="tracking-bottom"><div><p className="aside-label">Project details</p><h3>{trackingJob.title}</h3><span>{trackingJob.timeline || "Timeline not specified"}</span></div><div><p className="aside-label">Agreed quote</p><h3>{acceptedSavedQuote ? `$${(acceptedSavedQuote.amountCents / 100).toLocaleString()}` : trackingJob.budget}</h3><span>{acceptedSavedQuote ? "Accepted quote on record" : "No accepted quote loaded"}</span></div><div><p className="aside-label">Documents</p><button onClick={() => openDocument("service_agreement")}>View contract ↗</button><button onClick={() => openDocument("accepted_quote")}>View quote ↗</button></div></div>
          </>}
        </section>
      )}

      {view === "silent" && (
        <section className="silent-page">
          <div className="silent-intro"><p className="section-label light">JobLink Silent Mode</p><h1>Say what you need.<br /><em>Start a real request.</em></h1><p>Your browser converts your voice to text. You review the exact wording before JobLink opens the guided request—nothing is booked or priced without real submissions.</p><button disabled={silentStatus === "listening"} onClick={startVoiceCapture}>{silentStatus === "listening" ? "Listening…" : "Start voice request →"}</button></div>
          <div className="voice-demo"><div className={`voice-orb ${silentStatus === "listening" ? "stage-1" : silentTranscript ? "stage-3" : "stage-0"}`}><i /><span>{silentStatus === "listening" ? "≈" : silentTranscript ? "✓" : "◉"}</span></div><div className="voice-copy"><small>{silentStatus === "listening" ? "Listening" : silentTranscript ? "Review your request" : "Ready when you are"}</small><h2>{silentTranscript || "Describe the local service you need."}</h2><textarea rows={4} value={silentTranscript} onChange={(event) => { setSilentTranscript(event.target.value); setSilentStatus(event.target.value.trim() ? "ready" : "idle"); }} placeholder="You can also type your request here." />{silentStatus === "unsupported" && <p>Voice recognition is unavailable in this browser. Type the request above to continue.</p>}{silentStatus === "error" && <p>Voice recognition could not start. Check microphone permission or type the request.</p>}<button disabled={silentTranscript.trim().length < 5} onClick={() => beginRequest(silentTranscript.trim())}>Review details and post →</button></div><ol><li className={silentTranscript ? "active" : ""}><span>1</span>Capture</li><li><span>2</span>Clarify</li><li><span>3</span>Post</li><li><span>4</span>Compare</li></ol></div>
        </section>
      )}

      {view === "emergency" && (
        <section className="emergency-page" aria-label={`${emergencyType} emergency request`}>
          {emergencyStage === 0 ? <div className="emergency-intake"><div className="emergency-copy"><span className="emergency-mark">!</span><p className="section-label">Priority request</p><h1>Get urgent work<br /><em>in front of local pros.</em></h1><p>For urgent home-service problems—not police, fire or medical emergencies. JobLink immediately posts your request to eligible contractors who accept emergency work.</p><div className="emergency-warning"><b>Immediate danger?</b><p>Call 911 or your local emergency service first.</p></div></div><div className="emergency-form"><p className="step-kicker">Emergency request</p><h2>What’s happening?</h2><div className="emergency-types">{[["PL","Active water leak"],["HV","No heat / HVAC"],["EL","Electrical issue"],["RF","Emergency roof damage"]].map(([code,label]) => <button type="button" key={label} className={emergencyType === label ? "selected" : ""} onClick={() => setEmergencyType(label)}><span>{code}</span>{label}</button>)}</div><label>Describe the situation<textarea rows={3} value={emergencyDescription} onChange={(event) => setEmergencyDescription(event.target.value)} /></label><label>Service address<input value={emergencyAddress} onChange={(event) => setEmergencyAddress(event.target.value)} /></label><label className="emergency-consent"><input type="checkbox" checked={emergencyConsent} onChange={(event) => setEmergencyConsent(event.target.checked)} /><span>✓</span>I agree to share this location with contractors matched to this request.</label>{emergencyStatus === "error" && <p className="emergency-form-error">Enter the situation and address, then confirm location sharing.</p>}<button disabled={emergencyStatus === "saving"} onClick={() => void submitEmergencyRequest()}>{emergencyStatus === "saving" ? "Creating priority request…" : "Post priority request →"}</button></div></div> : <div className="dispatch-live"><div className="dispatch-header"><span className="pulse-emergency"><i /></span><div><small>Priority request posted · {emergencyJob?.externalId}</small><h1>Your request is live.</h1><p>Eligible emergency contractors can now review the real scope and submit a quote. JobLink will notify you when a response arrives.</p></div><button disabled={emergencyStatus === "saving"} onClick={() => void updateEmergencyRequestStatus("cancelled")}>Cancel request</button></div><div className="operations-empty"><span>JL</span><h2>Waiting for a verified contractor</h2><p>No responder, price, or arrival time is shown until a contractor actually submits it.</p><button onClick={() => go("account")}>Open saved request</button></div></div>}
        </section>
      )}

      {view === "admin" && (
        <section className="admin-shell">
          <header className="admin-head"><div><span className="admin-logo">JL</span><div><b>JobLink Operations</b><small>{operationsViewer ? `${operationsViewer.displayName} · ${operationsViewer.role}` : "Authenticated employee workspace"}</small></div></div><div className="admin-head-actions"><button onClick={openCaseCreator}>+ New case</button><button onClick={() => void loadOperations()}>Refresh data</button><button onClick={() => go("discover")}>Exit operations</button></div></header>
          <div className="admin-layout"><aside className="admin-nav"><p>Workspace</p><button className={adminTab === "overview" ? "selected" : ""} onClick={() => setAdminTab("overview")}><span>OV</span>Overview <b>{operationsStats.openCases}</b></button><button className={adminTab === "verification" ? "selected" : ""} onClick={() => setAdminTab("verification")}><span>VR</span>Verification <b>{operationsCases.filter((item) => item.caseType === "verification" && !["resolved","dismissed"].includes(item.status)).length}</b></button><button className={adminTab === "contractors" ? "selected" : ""} onClick={() => setAdminTab("contractors")}><span>CT</span>Verified contractors <b>{verifiedContractors.length}</b></button><button className={adminTab === "fraud" ? "selected" : ""} onClick={() => setAdminTab("fraud")}><span>FR</span>Fraud review <b>{operationsCases.filter((item) => item.caseType === "fraud" && !["resolved","dismissed"].includes(item.status)).length}</b></button><button className={adminTab === "disputes" ? "selected" : ""} onClick={() => setAdminTab("disputes")}><span>DS</span>Disputes <b>{operationsCases.filter((item) => item.caseType === "dispute" && !["resolved","dismissed"].includes(item.status)).length}</b></button>{operationsViewer?.role === "admin" && <button className={adminTab === "team" ? "selected" : ""} onClick={() => setAdminTab("team")}><span>TM</span>Team <b>{operationsStaff.length}</b></button>}<div className="admin-system"><span><i /></span><div><b>Protected employee access</b><small>Changes are saved and attributed</small></div></div></aside><div className="admin-content">
            {operationsStatus === "loading" && !operationsCases.length && <div className="operations-empty"><span>JL</span><h2>Loading employee workspace…</h2><p>Retrieving current verification, fraud and dispute queues.</p></div>}
            {operationsStatus === "error" && !operationsCases.length && <div className="operations-empty error"><span>!</span><h2>Operations could not be loaded.</h2><p>Confirm you are signed in with an employee or administrator account.</p><button onClick={() => void loadOperations()}>Try again</button></div>}
            {operationsStatus !== "loading" && operationsStatus !== "error" && <>
              <div className="admin-title"><div><p className="step-kicker">Employee operations · {new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</p><h1>{adminTab === "overview" ? "Marketplace operations." : adminTab === "verification" ? "Verification queue." : adminTab === "contractors" ? "Verified contractors." : adminTab === "fraud" ? "Fraud review." : adminTab === "team" ? "Operations team." : "Dispute resolution."}</h1><p>{adminTab === "overview" ? "Live workload, marketplace records and cases needing action." : adminTab === "contractors" ? "Approved businesses, verified services, territory, availability and demo account status." : adminTab === "team" ? "Grant or remove protected Operations access for JobLink employees." : `Review, document and resolve every ${adminTab === "disputes" ? "dispute" : adminTab} case.`}</p></div><span className="operations-live"><i /> Database live</span></div>
              {adminTab === "overview" && <div className="admin-kpis"><article><span>Total job requests</span><b>{operationsStats.jobs}</b><small>{operationsStats.activeJobs} currently active</small></article><article><span>Open employee cases</span><b>{operationsStats.openCases}</b><small>{operationsCases.filter((item) => item.priority === "urgent" && !["resolved","dismissed"].includes(item.status)).length} urgent</small></article><article><span>Simulated payment volume</span><b>${(operationsStats.paymentVolumeCents / 100).toLocaleString()}</b><small>Demo records · no funds moved</small></article><article><span>Verified contractors</span><b>{verifiedContractors.length}</b><small>Approved by Operations</small></article></div>}
              {adminTab === "contractors" && <section className="verified-contractor-directory"><div className="operations-toolbar"><label><span>Search verified contractors</span><input value={operationSearch} onChange={(event) => setOperationSearch(event.target.value)} placeholder="Business, email, service or city" /></label><button onClick={() => setOperationSearch("")}>Clear search</button></div><div className="verified-contractor-head"><span>Business</span><span>Services</span><span>Territory</span><span>Availability</span><span>Demo plan</span></div>{filteredVerifiedContractors.length === 0 ? <div className="operations-no-results"><b>No verified contractors match this search.</b><p>Contractors appear here after an Operations approval is saved.</p><button onClick={() => void loadOperations()}>Refresh directory</button></div> : filteredVerifiedContractors.map((profile) => <article key={profile.id}><div><span className="verified-contractor-avatar">{profile.businessName.split(/\s+/).slice(0,2).map((part) => part[0]).join("").toUpperCase()}</span><p><b>{profile.businessName}</b><small>{profile.ownerEmail}</small></p></div><p><b>{profile.primaryService}</b><small>{profile.services.slice(0,3).join(" · ") || "Primary service only"}</small></p><p><b>{profile.homeBase}</b><small>{profile.serviceRadiusKm} km · {profile.teamSize} team member{profile.teamSize === 1 ? "" : "s"}</small></p><p><b>{profile.acceptingWork ? "Accepting work" : "Matching paused"}</b><small>{profile.emergencyAvailable ? "Emergency work enabled" : "Standard requests only"}</small></p><p><b>{profile.plan}</b><small>{profile.subscriptionStatus.replaceAll("_", " ")} · payouts {profile.payoutsEnabled ? "demo ready" : "not set"}</small></p></article>)}</section>}
              {adminTab !== "team" && adminTab !== "contractors" && <><div className="operations-toolbar"><label><span>Search cases</span><input value={operationSearch} onChange={(event) => setOperationSearch(event.target.value)} placeholder="Case ID, business, job or assignee" /></label><label><span>Status</span><select value={operationStatusFilter} onChange={(event) => setOperationStatusFilter(event.target.value)}><option value="active">Active cases</option><option value="all">All cases</option><option value="open">Open</option><option value="in_review">In review</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label><button onClick={() => { setOperationSearch(""); setOperationStatusFilter("active"); }}>Clear filters</button></div>
              <div className="operations-queue"><div className="operations-queue-head"><span>Case</span><span>Subject</span><span>Risk</span><span>Status</span><span>Owner</span><span>Due</span></div>{filteredOperationsCases.length === 0 ? <div className="operations-no-results"><b>{adminTab === "verification" ? "No contractor applications are waiting for verification." : adminTab === "fraud" ? "No fraud cases need review." : adminTab === "disputes" ? "No disputes need review." : "No cases match these filters."}</b><p>{operationSearch || operationStatusFilter !== "active" ? "Try a different search or status." : "New cases will appear here automatically when they are submitted."}</p><button onClick={() => void loadOperations()}>Refresh queue</button></div> : filteredOperationsCases.map((item) => <button key={item.id} className={`operations-row risk-${item.risk}`} onClick={() => { setSelectedOperationCase(item); setOperationNote(""); }}><span><b>{item.externalId}</b><small>{item.caseType}</small></span><span><b>{item.title}</b><small>{item.subject}</small></span><em>{item.risk}</em><span className={`case-status status-${item.status}`}>{item.status.replaceAll("_", " ")}</span><span>{item.assignee}</span><span>{item.dueLabel}<small>{item.evidenceCount} evidence items</small></span></button>)}</div></>}
            </>}
            {adminTab === "team" && operationsViewer?.role === "admin" && <div className="operations-team-grid"><form className="staff-access-form" onSubmit={addOperationsStaff}><p className="aside-label">Grant access</p><h2>Add an Operations user</h2><p>The employee signs in with this exact ChatGPT account email. No password is created or stored by JobLink.</p><label>Employee name<input required value={staffName} onChange={(event) => setStaffName(event.target.value)} placeholder="Full name" /></label><label>ChatGPT account email<input required type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} placeholder="name@company.com" /></label><label>Access level<select value={staffRole} onChange={(event) => setStaffRole(event.target.value as "employee" | "admin")}><option value="employee">Employee · cases and reviews</option><option value="admin">Administrator · includes team access</option></select></label>{staffError && <p className="staff-form-error">{staffError}</p>}<button disabled={staffStatus === "saving"}>{staffStatus === "saving" ? "Saving access…" : "Grant Operations access →"}</button></form><section className="staff-directory"><div><p className="aside-label">Authorized accounts</p><h2>{operationsStaff.length} Operations users</h2></div>{operationsStaff.map((member) => <article key={member.email}><span>{member.displayName.split(/\s+/).slice(0,2).map((part) => part[0]).join("").toUpperCase()}</span><div><b>{member.displayName}</b><small>{member.email}</small></div><em>{member.role}</em><button disabled={staffStatus === "saving" || member.email === operationsViewer.email} onClick={() => void removeOperationsStaff(member)}>{member.email === operationsViewer.email ? "Current user" : "Remove access"}</button></article>)}</section></div>}
          </div></div>
        </section>
      )}

      {view === "account" && (
        <section className="account-shell">
          <div className="account-heading"><div><p className="step-kicker">Homeowner account</p><h1>Your home, handled.</h1><p>Jobs, payments and paperwork in one place.</p></div><button className="primary-action" onClick={() => beginRequest()}>+ Post another job</button></div>
          <div className="account-layout">
            <aside className="account-sidebar">
              <div className="account-person"><span>{accountInitials}</span><div><b>{accountIdentity?.displayName || "Homeowner"}</b><small>Hamilton, Ontario</small></div></div>
              <nav aria-label="Account sections">
                <button className={accountTab === "jobs" ? "selected" : ""} onClick={() => setAccountTab("jobs")}><span>01</span>My jobs <b>{persistedJobs.length}</b></button>
                <button className={accountTab === "payments" ? "selected" : ""} onClick={() => setAccountTab("payments")}><span>02</span>Payments</button>
                <button className={accountTab === "documents" ? "selected" : ""} onClick={() => setAccountTab("documents")}><span>03</span>Documents <b>{generatedDocuments.length}</b></button>
                <button className={accountTab === "saved" ? "selected" : ""} onClick={() => setAccountTab("saved")}><span>04</span>Saved pros</button>
              </nav>
              <div className="account-safety"><span>✓</span><div><b>JobLink recorded</b><p>Quotes, messages, documents and demo payment status stay with the job.</p></div></div>
            </aside>
            <div className="account-content">
              {accountTab === "jobs" && <>
                {persistedJobs.length > 0 && <div className="saved-request-list"><div className="account-section-head"><div><p className="aside-label">Saved to JobLink</p><h2>Your submitted requests</h2></div><span>{persistedJobs.length} stored</span></div>{persistedJobs.map((job) => <article key={job.id} className={selectedSavedJob?.id === job.id ? "selected-request" : ""}><span>{job.category.slice(0,2).toUpperCase()}</span><div><small>{job.externalId} · {job.status.replaceAll("_", " ")}</small><h3>{job.title}</h3><p>{job.budget}</p>{job.status !== "matching" && <small className="scheduled-start">Start: {scheduledStartLabel(job.scheduledStartAt)}</small>}</div><div className="saved-request-actions">{job.status === "matching" ? <><button onClick={() => void loadSavedQuotes(job)}>Compare quotes →</button><button className="delete-request" onClick={() => void deleteSavedRequest(job)}>Delete request</button></> : <button onClick={() => void openJobRoom(job)}>Open Job Room →</button>}</div></article>)}{selectedSavedJob && <div className="saved-quote-panel"><div className="saved-quote-heading"><div><p className="aside-label">Live quote comparison</p><h3>{selectedSavedJob.externalId}</h3></div><div className="saved-quote-heading-actions"><button onClick={() => openJobRoom(selectedSavedJob)}>Open Job Room</button><button aria-label="Close quote comparison" onClick={() => setSelectedSavedJob(null)}>×</button></div></div>{savedQuotesStatus === "loading" && !savedQuotes.length ? <p className="quote-panel-state">Loading quotes…</p> : savedQuotesStatus === "error" ? <p className="quote-panel-state error">Quotes could not be loaded. Please try again.</p> : <div className="saved-quote-grid">{savedQuotes.map((quote, index) => <article key={quote.id} className={quote.status === "accepted" ? "accepted" : ""}><div><span>{index === 0 ? "Best value" : "Verified pro"}</span><b>{quote.contractorName}</b></div><strong>${(quote.amountCents / 100).toLocaleString()}</strong><p>{quote.message}</p><small>Available {quote.availableAt}</small><button disabled={savedQuotesStatus === "loading" || (acceptedQuoteId !== null && acceptedQuoteId !== quote.id)} onClick={() => acceptSavedQuote(quote)}>{quote.status === "accepted" ? "Selected ✓" : quote.status === "declined" ? "Another pro selected" : "Choose this pro →"}</button></article>)}</div>}</div>}</div>}
                {trackingJob && <><div className="account-section-head"><div><p className="aside-label">Current</p><h2>{trackingJob.status === "booked" ? "Confirmed booking" : "Active job"}</h2></div><button onClick={() => go("tracking")}>Open live tracking →</button></div><article className="account-active-job"><div className="account-job-status"><span><i /></span><div><small>{trackingJob.status.replaceAll("_", " ")} · {acceptedSavedQuote?.availableAt || "Schedule in Job Room"}</small><h3>{trackingJob.title}</h3><p>{acceptedSavedQuote?.contractorName ?? "Matched professional"} · {trackingJob.externalId}</p></div><b>{acceptedSavedQuote ? `$${(acceptedSavedQuote.amountCents / 100).toLocaleString()}` : trackingJob.budget}</b></div><div className="account-progress"><i /></div><div className="account-job-actions"><span>All updates are stored with this job</span><button onClick={() => go("tracking")}>Track job</button><button onClick={() => void openJobRoom(trackingJob)}>Message pro</button></div></article></>}
                <div className="account-section-head history-head"><div><p className="aside-label">History</p><h2>Past requests</h2></div></div>
                <div className="job-history-list">{persistedJobs.filter((job) => job.status === "completed").length ? persistedJobs.filter((job) => job.status === "completed").map((job) => <article key={job.id}><span className="history-icon">{job.category.slice(0,2).toUpperCase()}</span><div><small>Completed · {new Date(job.createdAt).toLocaleDateString()}</small><h3>{job.title}</h3><p>{job.externalId} · Verified JobLink record</p></div><b>{job.budget}</b><button onClick={() => void openJobRoom(job)}>View details →</button></article>) : <div className="account-history-empty"><b>No completed jobs yet.</b><p>Finished jobs will appear here with their documents, review and warranty history.</p></div>}</div>
              </>}
              {accountTab === "payments" && <>
                <div className="account-section-head"><div><p className="aside-label">Money</p><h2>Payments</h2></div><span className="protected-badge">Secure checkout</span></div>
                <div className="payment-readiness"><span>◎</span><div><b>Payment demo for accepted quotes.</b><p>Simulate the complete payment record and fee breakdown without charging a card or moving money.</p></div><em>Demo only</em></div>
                {paymentRecords.length > 0 && <div className="live-payment-list"><div className="transaction-head"><span>Job</span><span>Professional</span><span>Status</span><span>Total</span></div>{paymentRecords.map((payment) => <div key={payment.id}><span>{payment.externalId}</span><span><b>{payment.contractorName}</b>{payment.title}</span><em>{payment.status.replaceAll("_", " ")}</em><strong>${(payment.totalCents / 100).toLocaleString()}</strong><small>Demo: contractor ${(payment.subtotalCents / 100).toLocaleString()} + JobLink fee ${(payment.customerFeeCents / 100).toLocaleString()}</small>{payment.viewerRole === "homeowner" && payment.status !== "demo_paid" && <button disabled={paymentCheckoutId === payment.id} onClick={() => void startPaymentCheckout(payment)}>{paymentCheckoutId === payment.id ? "Simulating…" : "Simulate payment →"}</button>}</div>)}</div>}
                <div className="payment-summary"><article><span>Accepted job value</span><b>${(paymentRecords.reduce((total, payment) => total + payment.subtotalCents, 0) / 100).toLocaleString()}</b><small>Contractor prices recorded</small></article><article><span>Demo JobLink fees</span><b>${(paymentRecords.reduce((total, payment) => total + payment.customerFeeCents, 0) / 100).toLocaleString()}</b><small>Simulated 3% customer fee</small></article><article><span>Simulated payments</span><b className="card-ending">{paymentRecords.filter((payment) => payment.status === "demo_paid").length}</b><small>No card charged · no funds moved</small></article></div>
                <div className="payment-explainer"><span>◎</span><div><b>You stay in control of every payment.</b><p>Funds are only released when milestones are approved. Changes require a signed change order before any extra charge.</p></div></div>
              </>}
              {accountTab === "documents" && <>
                <div className="account-section-head"><div><p className="aside-label">Paperwork</p><h2>Documents</h2></div><span>{generatedDocuments.length} generated</span></div>
                <div className="document-readiness"><span>✦</span><div><b>Paperwork is generated from accepted quotes.</b><p>Each secure document captures the job scope, selected professional, accepted amount and current payment status.</p></div></div>
                {generatedDocuments.length === 0 ? <div className="documents-empty"><span>DOC</span><h3>No generated paperwork yet</h3><p>Accept a quote to create the service agreement, accepted quote and invoice.</p></div> : <div className="document-group"><h3>JobLink documents</h3>{generatedDocuments.map((document) => <article key={document.id}><span className="doc-icon">{document.documentType === "invoice" ? "INV" : document.documentType === "accepted_quote" ? "QTE" : "AGR"}</span><div><b>{document.title}</b><small>{document.jobNumber} · {document.jobTitle} · {document.status.replaceAll("_", " ")}</small></div><button onClick={() => window.open(`/api/documents/${document.id}`, "_blank", "noopener,noreferrer")}>Open printable ↗</button></article>)}</div>}
              </>}
              {accountTab === "saved" && <>
                <div className="account-section-head"><div><p className="aside-label">Your network</p><h2>Saved professionals</h2></div></div>
                <div className="saved-pro-grid">{acceptedSavedQuote && selectedSavedJob ? <article><span className="saved-logo orange">{acceptedSavedQuote.contractorName.split(" ").slice(0,2).map((word) => word[0]).join("")}</span><h3>{acceptedSavedQuote.contractorName}</h3><p>{selectedSavedJob.category} · Verified JobLink professional</p><div><span>Selected for {selectedSavedJob.externalId}</span><b>Protected booking</b></div><button onClick={() => beginRequest(undefined, selectedSavedJob.category)}>Request another quote →</button></article> : <article className="saved-empty"><span>+</span><h3>Build your trusted team</h3><p>Your selected professionals appear here after you accept a verified quote.</p></article>}</div>
              </>}
            </div>
          </div>
        </section>
      )}

      {view === "trust" && (
        <section className="trust-page">
          <div className="trust-hero"><div><p className="section-label light">Trust & safety</p><h1>Confidence is<br />built into <em>every job.</em></h1><p>Private verification evidence, approved contractor profiles, demo payment records and completed-job reviews stay attached to real accounts and jobs.</p></div><div className="trust-seal"><span>✓</span><b>JobLink<br />Recorded</b><small>Every booked job</small></div></div>
          <div className="trust-process"><div className="trust-process-intro"><p className="section-label">Before anyone can quote</p><h2>We verify the business,<br />not just the profile.</h2><p>Every professional goes through layered checks. Regulated trades require valid credentials before matching is enabled.</p></div><div className="verification-list"><article><span>01</span><div><h3>Identity and business</h3><p>Government ID, business registration, address and banking ownership.</p></div><b>Verified</b></article><article><span>02</span><div><h3>Insurance and licences</h3><p>Coverage dates and trade credentials monitored for expiration.</p></div><b>Monitored</b></article><article><span>03</span><div><h3>Work history</h3><p>Completed jobs, cancellations, disputes and warranties—not anonymous reviews.</p></div><b>Ongoing</b></article><article><span>04</span><div><h3>Fraud screening</h3><p>Duplicate accounts, stolen photos, payment risk and suspicious activity.</p></div><b>Always on</b></article></div></div>
          <div className="protection-grid"><article className="protection-main"><p className="section-label light">During the job</p><h2>Every decision<br />stays with the job.</h2><p>Accepted quotes, homeowner-approved changes, messages, progress updates and clearly labelled demo payments remain linked to the JobLink record.</p><div className="protection-flow"><span><b>1</b>Approve quote</span><i>→</i><span><b>2</b>Simulate payment</span><i>→</i><span><b>3</b>Store the record</span></div></article><aside><p className="aside-label">Workflow includes</p><ul><li><span>✓</span>No-money payment simulation</li><li><span>✓</span>Recorded change-order decisions</li><li><span>✓</span>Dispute case notes</li><li><span>✓</span>Warranty record storage</li><li><span>✓</span>Verified completed-job reviews</li></ul></aside></div>
          <div className="trust-score-explain"><div><p className="section-label">Verified reputation</p><h2>Reviews come from<br />completed JobLink work.</h2></div><div className="signal-grid"><article><b>ID</b><span>Operations-approved profile</span></article><article><b>JOB</b><span>Completed job record</span></article><article><b>REV</b><span>Four-dimension review</span></article><article><b>DOC</b><span>Credentials and evidence</span></article><article><b>CASE</b><span>Disputes and resolutions</span></article><article><b>PAY</b><span>Webhook-confirmed payments</span></article></div></div>
          <div className="trust-cta"><h2>Post with confidence.</h2><p>Your contact details stay private until you choose a professional.</p><button onClick={() => beginRequest()}>Start a request →</button></div>
        </section>
      )}

      {view === "help" && (
        <section className="help-page">
          <div className="help-hero"><p className="step-kicker">JobLink support</p><h1>How can we help?</h1><label><span>⌕</span><input value={helpSearch} onChange={(event) => setHelpSearch(event.target.value)} placeholder="Search jobs, payments, contractors…" /></label><p>Popular: changing a quote · contractor verification · payment protection</p></div>
          <div className="help-body">
            <div className="help-categories"><button className={helpTopic === "homeowners" ? "selected" : ""} onClick={() => setHelpTopic("homeowners")}><span>HM</span><b>For homeowners</b><small>Requests, quotes and hiring</small></button><button className={helpTopic === "professionals" ? "selected" : ""} onClick={() => setHelpTopic("professionals")}><span>PR</span><b>For professionals</b><small>Matching, quotes and plans</small></button><button className={helpTopic === "payments" ? "selected" : ""} onClick={() => setHelpTopic("payments")}><span>PY</span><b>Payments</b><small>Deposits, payouts and refunds</small></button><button className={helpTopic === "trust" ? "selected" : ""} onClick={() => setHelpTopic("trust")}><span>TS</span><b>Trust & safety</b><small>Verification and protection</small></button></div>
            <div className="help-layout"><div className="faq-list"><p className="section-label">Frequently asked</p><h2>Quick answers.</h2>{filteredHelpFaqs.length ? filteredHelpFaqs.map((item, index) => <details key={item.question} open={index === 0}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>) : <div className="help-no-results"><b>No help articles found.</b><p>Try different words or send a message to support.</p><button onClick={() => setHelpSearch("")}>Clear search</button></div>}</div>
              <aside className="contact-card"><p className="aside-label">Still need help?</p><h3>Open an Operations case.</h3><p>Send a message with your job number. The request is stored in the employee queue with an auditable case reference.</p>{supportStatus === "sent" ? <div className="support-success"><span>✓</span><b>Request {supportReference} received</b><small>Track future updates using this reference.</small></div> : <form onSubmit={submitSupportRequest}><label>Topic<select name="topic" defaultValue="job"><option value="job">A job or contractor</option><option value="payment">Payment or invoice</option><option value="account">Account or verification</option><option value="safety">Trust and safety</option><option value="general">Something else</option></select></label><label>Job number (optional)<input name="jobExternalId" placeholder="Your JL job number" /></label><label>How can we help?<textarea name="message" rows={4} minLength={10} required placeholder="Tell us what happened…" /></label>{supportStatus === "error" && <p className="support-error">We couldn’t save your request. Please try again.</p>}<button type="submit" disabled={supportStatus === "sending"}>{supportStatus === "sending" ? "Sending…" : "Send to Operations →"}</button></form>}<div className="emergency-help"><b>Immediate safety issue?</b><p>Call 911 or your local emergency service first, then submit a JobLink safety case with the relevant job number.</p></div></aside></div>
          </div>
        </section>
      )}

      {view === "onboarding" && (
        <section className="onboarding-shell">
          <div className="onboarding-progress"><button onClick={() => onboardingStep === 0 ? go("discover") : setOnboardingStep(onboardingStep - 1)}>← {onboardingStep === 0 ? "Exit" : "Back"}</button><div>{["Business", "Services", "Verification", "Plan"].map((label, index) => <span key={label} className={index <= onboardingStep ? "done" : ""}><i />{label}</span>)}</div><small>{onboardingStep < 4 ? `${Math.round(((onboardingStep + 1) / 4) * 100)}% complete` : "Complete"}</small></div>
          {onboardingStep < 4 ? <div className="onboarding-layout"><div className="onboarding-form">
            {onboardingStep === 0 && <><p className="step-kicker">Step 1 of 4</p><h1>Tell us about your business.</h1><p>Start with the details customers will see. You can update these anytime.</p><div className="two-fields"><label>Legal business name<input required value={legalName} onChange={(event) => setLegalName(event.target.value)} /></label><label>Public business name<input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></label></div><label>Business address<input required value={businessAddress} onChange={(event) => setBusinessAddress(event.target.value)} /></label><div className="two-fields"><label>Business phone<input required value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} /></label><label>Years in business<input type="number" min="0" max="200" value={yearsInBusiness} onChange={(event) => setYearsInBusiness(Number(event.target.value))} /></label></div><label>Team size<input type="number" min="1" max="500" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} /></label><label>About your company<textarea rows={4} value={businessAbout} onChange={(event) => setBusinessAbout(event.target.value)} /></label></>}
            {onboardingStep === 1 && <><p className="step-kicker">Step 2 of 4</p><h1>Choose your work and territory.</h1><p>There is no extra charge for verified services. Matching only uses work you select.</p><label>Primary service<select value={primaryService} onChange={(event) => changePrimaryService(event.target.value)}>{Object.keys(contractorServiceCatalog).map((service) => <option key={service}>{service}</option>)}</select></label><div className="contractor-service-summary"><b>{primaryService}</b><p>{(serviceIntakeCatalog[primaryService] ?? serviceIntakeCatalog.Drywall).intro}</p><small>Select every type of work your business is qualified and insured to complete.</small></div><div className="service-selection-heading"><p className="field-label">Services offered</p><span>{selectedServices.length} selected</span></div><div className="onboarding-options">{contractorServiceCatalog[primaryService].map((item) => <label key={item}><input type="checkbox" checked={selectedServices.includes(item)} onChange={() => setSelectedServices((current) => current.includes(item) ? current.filter((service) => service !== item) : [...current, item])} /><span>✓</span>{item}</label>)}</div><div className="two-fields"><label>Home base<input value={homeBase} onChange={(event) => setHomeBase(event.target.value)} /></label><label>Service radius<select value={serviceRadius} onChange={(event) => setServiceRadius(Number(event.target.value))}><option value="15">15 km</option><option value="30">30 km</option><option value="50">50 km</option><option value="75">75 km</option><option value="100">100 km</option></select></label></div><label className="availability-check"><input type="checkbox" checked={emergencyAvailable} onChange={(event) => setEmergencyAvailable(event.target.checked)} /><span />Available for emergency requests</label></>}
            {onboardingStep === 2 && <><p className="step-kicker">Step 3 of 4</p><h1>Upload verification evidence.</h1><p>Documents are stored privately and can only be opened by your account and authorized Operations staff.</p><div className="verification-uploads">{[["government_id","Government ID","Required"],["business_registration","Business registration","Required"],["liability_insurance","Liability insurance","Required"],["trade_licence","Trade licence","If regulated"]].map(([type,label,requirement]) => { const record = verificationDocuments.find((item) => item.documentType === type); return <button type="button" key={type} disabled={verificationUploadStatus === "saving"} onClick={() => { setVerificationUploadType(type); window.setTimeout(() => window.document.getElementById("verification-file-input")?.click(), 0); }}><span>{record ? "✓" : "+"}</span><div><b>{label}</b><small>{record ? `${record.filename} · ${record.reviewStatus}` : "PDF or image · up to 10 MB"}</small></div><em>{record ? "Uploaded" : requirement}</em></button>; })}</div>{verificationUploadStatus === "error" && <p className="profile-save-error">The document could not be uploaded. Please try again.</p>}<div className="verification-note"><span>▣</span><div><b>Private evidence storage.</b><p>Operations reviews each file before approving matching. Replacing a file sends it back to pending review.</p></div></div></>}
            {onboardingStep === 3 && <><p className="step-kicker">Step 4 of 4</p><h1>Choose how you grow.</h1><p>No lead fees. No charge for each service. Plans are simulated during the JobLink demo.</p><div className="onboarding-plans"><label><input type="radio" name="plan" checked={selectedPlan === "starter"} onChange={() => setSelectedPlan("starter")} /><div><span>Starter</span><b>$49<small>/month</small></b><p>1 user · 25 km territory · Quoting and invoicing</p></div></label><label className="recommended"><input type="radio" name="plan" checked={selectedPlan === "growth"} onChange={() => setSelectedPlan("growth")} /><div><span>Growth · Recommended</span><b>$129<small>/month</small></b><p>5 users · 50 km territory · Scheduling and insights</p></div></label><label><input type="radio" name="plan" checked={selectedPlan === "pro"} onChange={() => setSelectedPlan("pro")} /><div><span>Pro</span><b>$299<small>/month</small></b><p>Unlimited team · Multiple territories · Advanced operations</p></div></label></div><div className="trial-note"><span>DM</span><div><b>Demo plan · no charge.</b><p>Select a plan to test matching and contractor workflows. No payment method is collected.</p></div></div></>}
            {profileStatus === "error" && <p className="profile-save-error">Your business profile could not be saved. Please try again.</p>}<div className="onboarding-footer"><span>{profileStatus === "saving" ? "Saving securely…" : profileStatus === "saved" ? "Profile saved ✓" : "Your progress is ready"}</span><button disabled={profileStatus === "saving" || verificationUploadStatus === "saving" || (onboardingStep === 0 && (!businessName.trim() || !legalName.trim() || !businessPhone.trim() || !businessAddress.trim())) || (onboardingStep === 2 && !verificationDocuments.some((item) => item.documentType === "government_id"))} onClick={() => onboardingStep === 3 ? void saveContractorProfile() : onboardingStep === 1 && !contractorProfile ? void saveContractorProfile(false) : setOnboardingStep(onboardingStep + 1)}>{onboardingStep === 3 ? "Submit application" : onboardingStep === 2 && !verificationDocuments.some((item) => item.documentType === "government_id") ? "Upload ID to continue" : "Continue"} →</button></div>
          </div><aside className="onboarding-aside"><div className="onboarding-promise"><p className="aside-label">The JobLink promise</p><ul><li>✓ Never pay per lead</li><li>✓ Keep your quoted labour price</li><li>✓ Control services and territory</li><li>✓ Pause matching anytime</li></ul></div></aside></div> : <div className="onboarding-complete"><span>✓</span><p className="step-kicker">Application submitted</p><h1>Your profile is in review.</h1><p>Operations will review the saved business details. Matching and quoting remain disabled until approval and subscription activation are complete.</p><div><span><b>{selectedServices.length}</b> services submitted</span><span><b>{serviceRadius}</b> km territory</span><span><b>0</b> lead fees</span></div><button onClick={() => { setProTab("business"); go("contractor"); }}>Continue to subscription →</button></div>}
        </section>
      )}

      {view === "contractor" && (
        <section className="pro-shell">
          <div className="pro-banner">
            <div className="pro-company"><span>{(contractorProfile?.businessName || businessName).split(" ").slice(0,2).map((word) => word[0]).join("")}</span><div><b>{contractorProfile?.businessName || businessName}</b><small>{contractorProfile?.verificationStatus === "verified" ? "Verified business" : "Business profile"} · {contractorProfile?.homeBase || homeBase}</small></div></div>
            <div className="pro-banner-actions"><button className="pro-availability" disabled={contractorProfile?.verificationStatus !== "verified" || !hasActiveSubscription} onClick={() => contractorProfile && updateContractorProfile({ acceptingWork: !contractorProfile.acceptingWork })}><span className={contractorProfile?.acceptingWork === false ? "paused" : ""}><i /></span><div><b>{contractorProfile?.verificationStatus !== "verified" ? "Matching awaiting verification" : !hasActiveSubscription ? "Subscription required" : contractorProfile?.acceptingWork === false ? "Matching paused" : "Accepting new work"}</b><small>{contractorProfile?.verificationStatus !== "verified" ? "Operations approval required" : !hasActiveSubscription ? "Choose a paid plan in Business" : "Click to change availability"}</small></div></button><button onClick={() => { setOnboardingStep(0); go("onboarding"); }}>{contractorProfile ? "Edit profile" : "Complete onboarding"}</button></div>
          </div>
          {contractorProfile && <div className={`contractor-verification-status ${contractorVerificationCopy.tone}`}><span>{contractorVerificationCopy.tone === "verified" ? "✓" : contractorVerificationCopy.tone === "rejected" ? "!" : "…"}</span><div><b>{contractorVerificationCopy.title}</b><p>{contractorVerificationCopy.body}</p></div><button onClick={() => setProTab("business")}>View business profile →</button></div>}

          {proTab === "overview" && (
            <div className="pro-page">
              <div className="pro-page-heading"><div><p className="step-kicker">{new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</p><h1>{accountIdentity?.displayName ? `Welcome, ${accountIdentity.displayName.split(" ")[0]}.` : "Contractor workspace."}</h1><p>{availableOpportunities.length ? `${availableOpportunities.length} verified opportunity${availableOpportunities.length === 1 ? " is" : "ies are"} available.` : "No matching opportunities are available right now."}</p></div><button className="primary-action" onClick={() => setProTab("opportunities")}>View opportunities →</button></div>
              <div className="pro-metrics">
                <article><span>Open opportunities</span><b>{availableOpportunities.length}</b><small>Matched to your services and radius</small></article>
                <article><span>Quotes awaiting reply</span><b>{contractorQuotes.filter((quote) => quote.status === "submitted").length}</b><small>Submitted through JobLink</small></article>
                <article><span>Recorded payouts</span><b>${(paymentRecords.reduce((total, payment) => total + payment.contractorPayoutCents, 0) / 100).toLocaleString()}</b><small>{paymentRecords.length} accepted {paymentRecords.length === 1 ? "job" : "jobs"}</small></article>
                <article><span>Verified review score</span><b>{reputation.verifiedReviewScore ?? "New"}</b><small>{reputation.verifiedReviewCount} completed-job {reputation.verifiedReviewCount === 1 ? "review" : "reviews"}</small></article>
              </div>
              <div className="pro-overview-grid">
                <div className="pro-panel">
                  <div className="pro-panel-head"><div><p className="aside-label">Recommended work</p><h2>Best opportunities for you</h2></div><button onClick={() => setProTab("opportunities")}>View all {availableOpportunities.length}</button></div>
                  {availableOpportunities.slice(0, 2).map((job) => (
                    <article className="opportunity-row" key={job.id}>
                      <div className="match-ring"><b>{job.match}</b><small>match</small></div>
                      <div className="opportunity-copy"><span>{job.service} · {job.distance}</span><h3>{job.title}</h3><p>{job.budget} · {job.timing}</p></div>
                      <div className="opportunity-action"><small>{job.posted}</small><button onClick={() => openQuote(job)}>Quote job →</button></div>
                    </article>
                  ))}
                </div>
                <aside className="trust-panel">
                  <div className="trust-panel-top"><div><p className="aside-label">Verified reputation</p><h2>{reputation.verifiedReviewScore ?? "—"}<small>/100</small></h2></div><span>{reputation.verifiedReviewCount ? `${reputation.averageStars?.toFixed(1)} ★` : "Building"}</span></div>
                  <div className="score-bar"><i /></div>
                  <dl><div><dt>Verified reviews</dt><dd>{reputation.verifiedReviewCount}</dd></div><div><dt>Average rating</dt><dd>{reputation.averageStars?.toFixed(1) ?? "—"}</dd></div><div><dt>Profile status</dt><dd>{contractorProfile?.verificationStatus ?? "pending"}</dd></div><div><dt>Matching</dt><dd>{contractorProfile?.acceptingWork ? "On" : "Paused"}</dd></div></dl>
                  <button onClick={() => setProTab("business")}>Improve your profile →</button>
                </aside>
              </div>
              <div className="pro-panel pipeline-panel">
                <div className="pro-panel-head"><div><p className="aside-label">This week</p><h2>Job pipeline</h2></div><button onClick={() => setProTab("jobs")}>Manage jobs</button></div>
                <div className="pipeline-grid">{conversations.length ? conversations.slice(0, 4).map((job) => <article key={job.id}><span className="pipeline-day">{job.category.slice(0,2).toUpperCase()}</span><div><small>{job.externalId}</small><b>{job.title}</b><p>{job.category} · {job.budget}</p></div><em className={job.status === "in_progress" ? "status-live" : ""}>{job.status.replaceAll("_", " ")}</em></article>) : <div className="pipeline-empty"><b>No booked jobs yet.</b><p>Accepted quotes will build your weekly pipeline automatically.</p></div>}</div>
              </div>
            </div>
          )}

          {proTab === "opportunities" && (
            <div className="pro-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Matched for {contractorProfile?.businessName || businessName || "your business"}</p><h1>New opportunities.</h1><p>Only live jobs that fit your verified services and availability appear here.</p></div><div className="opportunity-count"><b>{availableOpportunities.length}</b><span>available now</span></div></div>
              <div className="filter-bar"><button className={opportunitySort === "match" ? "selected" : ""} onClick={() => setOpportunitySort("match")}>Best match</button><button className={opportunitySort === "nearest" ? "selected" : ""} onClick={() => setOpportunitySort("nearest")}>Nearest</button><button className={opportunitySort === "newest" ? "selected" : ""} onClick={() => setOpportunitySort("newest")}>Newest</button><span /><label>Within <select value={opportunityRadius} onChange={(event) => setOpportunityRadius(Number(event.target.value))}><option>15</option><option>30</option><option>50</option><option>75</option><option>100</option></select> km</label></div>
              <div className="opportunity-layout">
                <div className="opportunity-list">
                  {availableOpportunities.length === 0 && <div className="contractor-jobs-empty"><b>No live opportunities match your profile.</b><p>Check that your profile is verified, accepting work is on, and your services and territory are current.</p><button onClick={() => setProTab("business")}>Review business profile</button></div>}
                  {availableOpportunities.map((job, index) => (
                    <article className="opportunity-card" key={job.id}>
                      <div className="opportunity-card-head"><div><span className="service-pill">{job.service}</span><span className="fresh-pill">{job.posted}</span></div><div className="match-number"><b>{job.match}%</b><small>match</small></div></div>
                      <h2>{job.title}</h2>
                      <p>{job.details}</p>
                      <div className="job-facts"><span><small>Distance</small><b>{job.distance}</b></span><span><small>Customer budget</small><b>{job.budget}</b></span><span><small>Timeline</small><b>{job.timing}</b></span></div>
                      <div className="job-fit"><span>Why it appears</span><p>{job.service} is enabled on your profile and the request is inside your selected service area.</p></div>
                      <div className="opportunity-card-actions"><button className="secondary-action" onClick={() => { setDismissedOpportunities((current) => [...current, job.id]); showNotice(`${job.id} removed from your opportunities.`); }}>Not interested</button><button className="primary-action" onClick={() => openQuote(job)}>{quoteSent === job.id ? "Quote sent ✓" : "Build a quote →"}</button></div>
                    </article>
                  ))}
                </div>
                <aside className="match-explainer"><span>✦</span><p className="aside-label">Matching rules</p><h3>Relevant work only.</h3><p>Opportunities come from real homeowner requests and are filtered by verified services, territory, availability, and request status.</p><dl><div><dt>Service radius</dt><dd>{contractorProfile?.serviceRadiusKm ?? serviceRadius} km</dd></div><div><dt>Services enabled</dt><dd>{(contractorProfile?.services ?? selectedServices).length}</dd></div><div><dt>Profile</dt><dd>{contractorProfile?.verificationStatus ?? "pending"}</dd></div></dl></aside>
              </div>
            </div>
          )}

          {proTab === "jobs" && (
            <div className="pro-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Operations</p><h1>Jobs and schedule.</h1><p>Every JobLink booking, progress update, quote and completed record in one place.</p></div></div>
              <div className="job-tabs"><button className={jobView === "active" ? "selected" : ""} onClick={() => setJobView("active")}>Active <span>{conversations.filter((job) => job.status === "in_progress").length}</span></button><button className={jobView === "upcoming" ? "selected" : ""} onClick={() => setJobView("upcoming")}>Upcoming <span>{conversations.filter((job) => job.status === "booked").length}</span></button><button className={jobView === "completed" ? "selected" : ""} onClick={() => setJobView("completed")}>Completed <span>{conversations.filter((job) => job.status === "completed").length}</span></button><button className={jobView === "quotes" ? "selected" : ""} onClick={() => setJobView("quotes")}>Quotes <span>{contractorQuotes.length}</span></button></div>
              <div className="job-view-summary"><b>{jobView === "active" ? "Active work" : jobView === "upcoming" ? "Upcoming schedule" : jobView === "completed" ? "Completed jobs" : "Submitted quotes"}</b><span>{jobView === "active" ? "Live milestones and customer communication" : jobView === "upcoming" ? "Confirmed bookings" : jobView === "completed" ? "Completed work and warranty records" : `${contractorQuotes.filter((quote) => quote.status === "submitted").length} awaiting a homeowner decision`}</span></div>
              {jobView !== "quotes" && visibleContractorJobs.length > 0 && <div className="live-operations"><div className="pro-panel-head"><div><p className="aside-label">Live JobLink jobs</p><h2>{jobView === "completed" ? "Completed job records" : "Update customer progress"}</h2></div><span>Every update is timestamped</span></div>{progressError && <p className="progress-error">{progressError}</p>}{visibleContractorJobs.map((job) => <article key={job.id}><div className="live-job-heading"><span>{job.category.slice(0,2).toUpperCase()}</span><div><small>{job.externalId} · {job.status.replaceAll("_", " ")}</small><h3>{job.title}</h3></div><div className="live-job-actions"><button disabled={job.status === "completed"} onClick={() => setLiveChangeOrderJob(job)}>+ Change order</button><button onClick={() => openJobRoom(job)}>Job Room ↗</button></div></div>{job.status === "booked" && <div className="schedule-start-control"><label htmlFor={`scheduled-start-${job.id}`}>Scheduled start date and time</label><div><input id={`scheduled-start-${job.id}`} type="datetime-local" value={scheduledStartValues[job.id] ?? dateTimeInputValue(job.scheduledStartAt)} onChange={(event) => setScheduledStartValues((current) => ({ ...current, [job.id]: event.target.value }))} /><button disabled={progressUpdatingId === job.id} onClick={() => void scheduleJobStart(job)}>{job.scheduledStartAt ? "Update start time" : "Schedule start"}</button></div>{job.scheduledStartAt && <small>Currently scheduled: {scheduledStartLabel(job.scheduledStartAt)}</small>}</div>}{job.status !== "completed" && <div className="milestone-actions">{([['materials_collected','Materials picked up'],['work_started','Started'],['halfway','50% complete'],['cleaning','Cleaning'],['finished','Finished']] as const).map(([stage,label]) => <button key={stage} disabled={progressUpdatingId === job.id} onClick={() => updateJobProgress(job, stage)}>{progressUpdatingId === job.id ? "Updating…" : label}</button>)}</div>}</article>)}</div>}
              <div className="contractor-job-records">{jobView === "quotes" ? contractorQuotes.length ? contractorQuotes.map((quote) => <article key={quote.id}><span>QT</span><div><small>{quote.externalId} · {quote.status}</small><h3>{quote.title}</h3><p>${(quote.amountCents / 100).toLocaleString()} · {quote.availableAt}</p></div><em>{quote.status === "submitted" ? "Awaiting decision" : quote.status.replaceAll("_", " ")}</em></article>) : <div className="contractor-jobs-empty"><b>No submitted quotes.</b><p>Build a quote from an available opportunity.</p><button onClick={() => setProTab("opportunities")}>Find opportunities</button></div> : visibleContractorJobs.length ? visibleContractorJobs.map((job) => <article key={job.id}><span>{job.category.slice(0,2).toUpperCase()}</span><div><small>{job.externalId} · {job.status.replaceAll("_", " ")}</small><h3>{job.title}</h3><p>{job.category} · {job.budget}</p></div><button onClick={() => openJobRoom(job)}>Open Job Room →</button></article>) : <div className="contractor-jobs-empty"><b>No {jobView} jobs.</b><p>Jobs move here automatically as customers accept quotes and work progresses.</p></div>}</div>
              <div className="pro-panel payment-panel"><div><p className="aside-label">Demo payment ledger</p><h2>${(paymentRecords.filter((payment) => payment.status === "demo_paid").reduce((total, payment) => total + payment.contractorPayoutCents, 0) / 100).toLocaleString()}</h2><span>{paymentRecords.filter((payment) => payment.status === "demo_paid").length} simulated {paymentRecords.filter((payment) => payment.status === "demo_paid").length === 1 ? "job" : "jobs"} · no funds moved</span></div><button onClick={() => setProTab("business")}>Demo plan settings →</button></div>
            </div>
          )}

          {proTab === "inbox" && (
            <div className="pro-page inbox-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Messages</p><h1>Customer conversations.</h1></div></div>
              <div className="inbox-layout">
                <aside className="conversation-list">
                  <label><span>⌕</span><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search messages" /></label>
                  {filteredConversations.map((job) => <button key={job.id} className="live-conversation" onClick={() => openJobRoom(job)}><span className="person-avatar orange">{job.category.slice(0,2).toUpperCase()}</span><div><b>{job.title}</b><p>Open the live Job Room</p><small>{job.externalId} · {job.status}</small></div><em>Live</em></button>)}
                  {filteredConversations.length === 0 && <div className="conversation-empty"><b>{messageSearch ? "No conversations match" : "No customer conversations yet"}</b><p>{messageSearch ? "Try another job number or service." : "Accepted jobs will appear here with a private Job Room."}</p>{messageSearch && <button onClick={() => setMessageSearch("")}>Clear search</button>}</div>}
                </aside>
                <div className="chat-panel"><div className="operations-empty"><span>MSG</span><h2>Select a conversation</h2><p>Choose a real booked job to open its private, persisted Job Room and send messages.</p>{filteredConversations[0] && <button onClick={() => void openJobRoom(filteredConversations[0])}>Open latest conversation →</button>}</div></div>
              </div>
            </div>
          )}

          {proTab === "business" && (
            <div className="pro-page">
              <div className="pro-page-heading"><div><p className="step-kicker">Business settings</p><h1>Grow on your terms.</h1><p>Simple monthly plan simulations. No lead fees and no charge for services you’re verified to perform.</p></div><span className="founding-badge">Payments in demo mode</span></div>
              <div className="business-grid">
                <aside className="business-profile">
                  <div className="business-logo">{(contractorProfile?.businessName || businessName).split(" ").slice(0,2).map((word) => word[0]).join("")}</div><h2>{contractorProfile?.businessName || businessName}</h2><p>{contractorProfile?.homeBase || homeBase} · {contractorProfile?.serviceRadiusKm || serviceRadius} km service area</p><span className="verified-line">{contractorProfile?.verificationStatus === "verified" ? "✓ Identity, insurance and licence verified" : contractorProfile?.verificationStatus === "rejected" ? "! Verification was not approved" : "… Verification review in progress"}</span>
                  <dl><div><dt>Services</dt><dd>{(contractorProfile?.services || selectedServices).slice(0,2).join(", ")}</dd></div><div><dt>Team</dt><dd>{contractorProfile?.teamSize || teamSize} members</dd></div><div><dt>Emergency work</dt><dd>{contractorProfile?.emergencyAvailable ? "Enabled" : "Off"}</dd></div></dl><button onClick={() => { setOnboardingStep(0); go("onboarding"); }}>Edit business profile →</button>
                </aside>
                <div className="plans-area">
                  <div className="plans-heading"><div><p className="aside-label">Subscription · {contractorProfile?.subscriptionStatus || "inactive"}</p><h2>{hasActiveSubscription ? (contractorProfile?.plan || selectedPlan).replace(/^./, (letter) => letter.toUpperCase()) : "Choose a plan"}</h2></div>{hasActiveSubscription && <b>${({ starter: 49, growth: 129, pro: 299 }[contractorProfile?.plan || selectedPlan])}<small>/month</small></b>}</div>
                  <div className="plan-grid">
                    <article className={hasActiveSubscription && contractorProfile?.plan === "starter" ? "current-plan" : ""}><span>Starter{hasActiveSubscription && contractorProfile?.plan === "starter" ? " · Current" : ""}</span><h3>$49<small>/mo</small></h3><p>For an independent pro building a local reputation.</p><ul><li>1 user and crew</li><li>25 km territory</li><li>Unlimited verified services</li><li>Quotes and invoicing</li></ul><button disabled={profileStatus === "saving" || (hasActiveSubscription && contractorProfile?.plan === "starter")} onClick={() => void startSubscriptionCheckout("starter")}>{hasActiveSubscription && contractorProfile?.plan === "starter" ? "Current demo plan ✓" : "Activate demo plan"}</button></article>
                    <article className={hasActiveSubscription && contractorProfile?.plan === "growth" ? "current-plan" : ""}><span>Growth{hasActiveSubscription && contractorProfile?.plan === "growth" ? " · Current" : ""}</span><h3>$129<small>/mo</small></h3><p>For a growing team that wants more work and automation.</p><ul><li>Up to 5 team members</li><li>50 km territory</li><li>Scheduling and dispatch</li><li>Performance insights</li></ul><button disabled={profileStatus === "saving" || (hasActiveSubscription && contractorProfile?.plan === "growth")} onClick={() => void startSubscriptionCheckout("growth")}>{hasActiveSubscription && contractorProfile?.plan === "growth" ? "Current demo plan ✓" : "Activate demo plan"}</button></article>
                    <article className={hasActiveSubscription && contractorProfile?.plan === "pro" ? "current-plan" : ""}><span>Pro{hasActiveSubscription && contractorProfile?.plan === "pro" ? " · Current" : ""}</span><h3>$299<small>/mo</small></h3><p>For multi-crew businesses managing several territories.</p><ul><li>Unlimited team members</li><li>Multiple territories</li><li>Advanced operations</li><li>Priority support</li></ul><button disabled={profileStatus === "saving" || (hasActiveSubscription && contractorProfile?.plan === "pro")} onClick={() => void startSubscriptionCheckout("pro")}>{hasActiveSubscription && contractorProfile?.plan === "pro" ? "Current demo plan ✓" : "Activate demo plan"}</button></article>
                  </div>
                  <div className="fee-note"><span>◎</span><div><b>Demo payout destination · {contractorProfile?.payoutsEnabled ? "Ready" : "Not enabled"}</b><p>This saves a simulated payout-ready status for workflow testing. No bank account is connected and no funds can move.</p></div><button disabled={profileStatus === "saving"} onClick={() => void (contractorProfile?.payoutsEnabled ? refreshPayoutStatus() : openPayoutSetup())}>{contractorProfile?.payoutsEnabled ? "Refresh demo status" : "Enable demo payouts →"}</button>{hasActiveSubscription && <button disabled={profileStatus === "saving"} onClick={() => void openSubscriptionPortal()}>Demo billing details →</button>}</div>
                </div>
              </div>
            </div>
          )}

          {quoteJob && (
            <div className="quote-overlay" role="dialog" aria-modal="true" aria-labelledby="quote-title">
              <div className="quote-drawer">
                <button className="overlay-close" onClick={() => setQuoteJob(null)} aria-label="Close quote builder">×</button>
                <p className="step-kicker">Structured quote · {quoteJob.id}</p><h2 id="quote-title">Send a confident quote.</h2><p className="quote-job-title">{quoteJob.title}</p>
                <div className="quote-scope"><span>✦</span><div><b>Scope checked</b><p>{quoteJob.details}</p></div></div>
                <label className="field-label" htmlFor="quote-price">Your estimated price</label><div className="price-input"><span>$</span><input id="quote-price" value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} inputMode="decimal" /><em>CAD</em></div>
                <div className="quote-breakdown"><div className="total"><span>Your submitted total</span><b>${Number(quoteAmount || 0).toLocaleString()}</b></div><p>Describe labour, materials, taxes, cleanup, and exclusions in the message so the homeowner can compare the scope accurately.</p></div>
                <label className="field-label" htmlFor="quote-note">Message to customer</label><textarea id="quote-note" value={quoteNote} onChange={(event) => setQuoteNote(event.target.value)} rows={4} />
                <label className="field-label" htmlFor="quote-date">Earliest start or availability</label><input id="quote-date" value={quoteAvailability} onChange={(event) => setQuoteAvailability(event.target.value)} placeholder="Example: Tuesday after 9 AM or any weekday next week" />
                <div className="quote-protection"><span>✓</span><p>Customer contact details remain private until they accept your quote.</p></div>
                {quoteSubmitStatus === "error" && <p className="quote-submit-error">{quoteSubmitError || "This quote could not be sent. Check the amount and try again."}</p>}
                {Number(quoteAmount || 0) < 10 && <p className="quote-field-hint">Enter an estimated price of at least $10 to send this quote.</p>}
                <button className="send-quote" disabled={quoteSubmitStatus === "saving" || Number(quoteAmount) < 10} onClick={submitQuote}>{quoteSubmitStatus === "saving" ? "Sending quote…" : `Send $${Number(quoteAmount || 0).toLocaleString()} quote →`}</button>
              </div>
            </div>
          )}
        </section>
      )}

      <input id="verification-file-input" className="hidden-file-input" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadVerificationDocument(file); event.target.value = ""; }} />

      {liveChangeOrderJob && <div className="quote-overlay" role="dialog" aria-modal="true" aria-labelledby="live-change-title"><button className="overlay-close" onClick={() => setLiveChangeOrderJob(null)} aria-label="Close change order">×</button><div className="quote-drawer change-drawer"><p className="step-kicker">{liveChangeOrderJob.externalId} · Change order</p><h2 id="live-change-title">Document extra work.</h2><p className="quote-job-title">{liveChangeOrderJob.title}</p><div className="change-alert"><span>!</span><p>The homeowner must approve this change before additional work begins.</p></div><label className="field-label">Reason<input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} /></label><label className="field-label">Additional work<textarea rows={4} value={changeDescription} onChange={(event) => setChangeDescription(event.target.value)} /></label><label className="field-label">Additional amount<div className="price-input"><span>$</span><input value={changeAmount} onChange={(event) => setChangeAmount(event.target.value)} inputMode="decimal" /><em>CAD</em></div></label><label className="field-label">Schedule impact<input value={changeSchedule} onChange={(event) => setChangeSchedule(event.target.value)} placeholder="Example: Adds one business day" /></label>{changeStatus === "error" && <p className="quote-submit-error">The change order could not be sent.</p>}<button className="send-quote" disabled={changeStatus === "saving" || Number(changeAmount) <= 0 || changeReason.trim().length < 3 || changeDescription.trim().length < 10 || changeSchedule.trim().length < 3} onClick={submitLiveChangeOrder}>{changeStatus === "saving" ? "Sending…" : `Send $${Number(changeAmount || 0).toLocaleString()} change order →`}</button></div></div>}

      {roomJob && <div className="job-room-overlay" role="dialog" aria-modal="true" aria-labelledby="job-room-title"><div className="job-room"><button className="job-room-close" aria-label="Close Job Room" onClick={() => setRoomJob(null)}>×</button><header><div><p className="step-kicker">Shared Job Room · {roomJob.externalId}</p><h2 id="job-room-title">{roomJob.title}</h2><p>{roomJob.category} · {roomJob.status.replaceAll("_", " ")}</p>{roomJob.status !== "matching" && <p className="scheduled-room-start">Scheduled start: {scheduledStartLabel(roomJob.scheduledStartAt)}</p>}</div><span><i /> Private to this job</span></header>{roomStatus === "loading" ? <div className="job-room-loading">Opening your Job Room…</div> : roomStatus === "error" && !roomMessages.length ? <div className="job-room-loading error">The Job Room could not be loaded. Please close it and try again.</div> : <div className="job-room-grid"><aside><p className="aside-label">Job activity</p><div className="room-timeline">{roomEvents.map((event, index) => <article key={event.id}><span>{index + 1}</span><div><b>{event.label}</b><small>{new Date(event.createdAt).toLocaleString()}</small></div></article>)}</div>{roomChangeOrders.length > 0 && <div className="room-change-orders"><p className="aside-label">Change orders</p>{roomChangeOrders.map((order) => <article key={order.id}><div><small>{order.externalId} · {order.status}</small><b>{order.reason}</b><p>{order.description}</p><strong>+${(order.amountCents / 100).toLocaleString()}</strong></div>{order.status === "pending" && <div><button onClick={() => decideChangeOrder(order, "declined")}>Decline</button><button onClick={() => decideChangeOrder(order, "approved")}>Approve & sign</button></div>}</article>)}</div>}{roomJob.status === "completed" && <div className="verified-review-box"><p className="aside-label">Verified job review</p>{roomReview ? <div className="review-complete"><b>{(roomReview.averageScore / 100).toFixed(1)} ★</b><span>Verified completed job</span><p>{roomReview.comment || "Review submitted without a written comment."}</p></div> : <><div className="review-dimensions">{(["workmanship","communication","punctuality","cleanliness"] as const).map((dimension) => <div key={dimension}><span>{dimension}</span><select value={reviewScores[dimension]} onChange={(event) => setReviewScores((current) => ({ ...current, [dimension]: Number(event.target.value) }))}><option value="5">5 · Excellent</option><option value="4">4 · Good</option><option value="3">3 · Average</option><option value="2">2 · Poor</option><option value="1">1 · Very poor</option></select></div>)}</div><textarea rows={3} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="What should future customers know?" />{reviewStatus === "error" && <p className="review-error">The review could not be submitted.</p>}<button disabled={reviewStatus === "saving"} onClick={submitVerifiedReview}>{reviewStatus === "saving" ? "Submitting…" : "Submit verified review"}</button></>}</div>}</aside><section><div className="room-chat-head"><div><span>JD</span><div><b>Job conversation</b><small>Keep details and decisions documented here</small></div></div></div><div className="room-chat-body">{roomMessages.length === 0 && <div className="room-empty"><span>✦</span><b>Start the conversation</b><p>Messages stay attached to this job for both sides.</p></div>}{roomMessages.map((message) => <div className={`room-message ${message.mine ? "mine" : "theirs"}`} key={message.id}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div>)}</div><form className="room-composer" onSubmit={sendRoomMessage}><input value={roomText} onChange={(event) => setRoomText(event.target.value)} placeholder="Write a message about this job…" aria-label="Job message" /><button disabled={roomStatus === "sending" || !roomText.trim()}>{roomStatus === "sending" ? "Sending…" : "Send →"}</button></form></section></div>}</div></div>}

      {roomJob && roomAttachments.length > 0 && <aside className="job-media-tray" aria-label="Job photos and videos"><p className="aside-label">Job photos & video</p><div>{roomAttachments.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer"><span>{attachment.kind === "video" ? "VID" : "IMG"}</span><p><b>{attachment.filename}</b><small>{(attachment.sizeBytes / 1024 / 1024).toFixed(1)} MB</small></p><em>↗</em></a>)}</div></aside>}


      {caseCreateOpen && <div className="operations-overlay case-create-overlay" role="dialog" aria-modal="true" aria-labelledby="case-create-title"><button className="operations-overlay-close" onClick={() => setCaseCreateOpen(false)} aria-label="Close case creator">×</button><form className="operations-drawer case-create-drawer" onSubmit={createOperationsCase}><header><div><p className="step-kicker">Operations intake</p><h2 id="case-create-title">Create a new case.</h2><p>Open a persistent verification, fraud or dispute record and assign it for review.</p></div></header><div className="operations-case-fields"><label>Case type<select value={newOperationsCase.caseType} onChange={(event) => setNewOperationsCase((current) => ({ ...current, caseType: event.target.value as "verification" | "fraud" | "dispute" }))}><option value="verification">Verification</option><option value="fraud">Fraud review</option><option value="dispute">Dispute</option></select></label><label>Risk<select value={newOperationsCase.risk} onChange={(event) => setNewOperationsCase((current) => ({ ...current, risk: event.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Priority<select value={newOperationsCase.priority} onChange={(event) => setNewOperationsCase((current) => ({ ...current, priority: event.target.value }))}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Due target<input value={newOperationsCase.dueLabel} onChange={(event) => setNewOperationsCase((current) => ({ ...current, dueLabel: event.target.value }))} placeholder="Example: Due today" /></label><label className="full">Case title<input required value={newOperationsCase.title} onChange={(event) => setNewOperationsCase((current) => ({ ...current, title: event.target.value }))} placeholder="What needs review?" /></label><label className="full">Subject<input required value={newOperationsCase.subject} onChange={(event) => setNewOperationsCase((current) => ({ ...current, subject: event.target.value }))} placeholder="Business, customer or job number" /></label><label className="full">Summary<textarea required minLength={10} rows={5} value={newOperationsCase.summary} onChange={(event) => setNewOperationsCase((current) => ({ ...current, summary: event.target.value }))} placeholder="Record the report, reason for review and immediate concerns." /></label></div>{caseCreateError && <p className="staff-form-error">{caseCreateError}</p>}<div className="operations-drawer-actions"><button type="button" onClick={() => setCaseCreateOpen(false)}>Cancel</button><button className="primary-action" disabled={caseCreateStatus === "saving"}>{caseCreateStatus === "saving" ? "Creating…" : "Create case →"}</button></div></form></div>}

      {selectedOperationCase && <div className="operations-overlay" role="dialog" aria-modal="true" aria-labelledby="operations-case-title"><button className="operations-overlay-close" onClick={() => setSelectedOperationCase(null)} aria-label="Close operations case">×</button><aside className="operations-drawer"><header><div><p className="step-kicker">{selectedOperationCase.externalId} · {selectedOperationCase.caseType}</p><h2 id="operations-case-title">{selectedOperationCase.title}</h2><p>{selectedOperationCase.subject}</p></div><span className={`case-status status-${selectedOperationCase.status}`}>{selectedOperationCase.status.replaceAll("_", " ")}</span></header><div className="operations-case-summary"><b>Case summary</b><p>{selectedOperationCase.summary}</p><div><span>{selectedOperationCase.risk} risk</span><span>{selectedOperationCase.evidenceCount} evidence items</span><span>{selectedOperationCase.dueLabel}</span></div></div>{selectedOperationCase.details.signals && <div className="operations-signals"><p className="aside-label">Evidence signals</p>{selectedOperationCase.details.signals.map((signal) => <div key={signal}><span>✓</span>{signal}</div>)}</div>}{selectedOperationCase.details.documents && selectedOperationCase.details.documents.length > 0 && <div className="operations-signals"><p className="aside-label">Secure documents</p>{selectedOperationCase.details.documents.map((document) => <button key={document.id} onClick={() => window.open(`/api/contractor-verification/${document.id}`, "_blank", "noopener,noreferrer")}><span>DOC</span>{document.documentType.replaceAll("_", " ")} · {document.filename} ↗</button>)}</div>}{selectedOperationCase.caseType === "verification" && selectedOperationCase.details.ownerEmail && <div className="verification-decision-panel"><div><p className="aside-label">Contractor decision</p><b>{selectedOperationCase.details.primaryService || "Service"} application · {selectedOperationCase.details.ownerEmail}</b><p>Approval activates matching. Requesting changes pauses the application. Rejection disables new-work matching.</p></div><div><button disabled={operationsStatus === "saving"} onClick={() => void updateOperationsCase({ resolution: selectedOperationCase.resolution }, Boolean(operationNote.trim()), "changes_requested")}>Request changes</button><button className="reject" disabled={operationsStatus === "saving"} onClick={() => void updateOperationsCase({ resolution: selectedOperationCase.resolution }, Boolean(operationNote.trim()), "rejected")}>Reject</button><button className="approve" disabled={operationsStatus === "saving"} onClick={() => void updateOperationsCase({ resolution: selectedOperationCase.resolution }, Boolean(operationNote.trim()), "approved")}>Approve contractor ✓</button></div></div>}<div className="operations-case-fields"><label>Status<select value={selectedOperationCase.status} onChange={(event) => setSelectedOperationCase({ ...selectedOperationCase, status: event.target.value as OperationsCase["status"] })}><option value="open">Open</option><option value="in_review">In review</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label><label>Risk<select value={selectedOperationCase.risk} onChange={(event) => setSelectedOperationCase({ ...selectedOperationCase, risk: event.target.value as OperationsCase["risk"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="full">Assigned employee<input value={selectedOperationCase.assignee} onChange={(event) => setSelectedOperationCase({ ...selectedOperationCase, assignee: event.target.value })} placeholder="Employee name" /></label><label className="full">Resolution or decision<textarea rows={3} value={selectedOperationCase.resolution} onChange={(event) => setSelectedOperationCase({ ...selectedOperationCase, resolution: event.target.value })} placeholder="Record the reason for the final decision." /></label><label className="full">Add internal note<textarea rows={3} value={operationNote} onChange={(event) => setOperationNote(event.target.value)} placeholder="Document calls, evidence reviewed or next steps." /></label></div>{selectedOperationCase.notes.length > 0 && <div className="operations-notes"><p className="aside-label">Case history</p>{selectedOperationCase.notes.map((note) => <article key={note.id}><b>{note.authorEmail}</b><small>{new Date(note.createdAt).toLocaleString()}</small><p>{note.body}</p></article>)}</div>}<div className="operations-drawer-actions"><button onClick={() => void updateOperationsCase({ status: "waiting" })}>Set waiting</button><button onClick={() => void updateOperationsCase({ status: "in_review" })}>Start review</button><button className="primary-action" disabled={operationsStatus === "saving"} onClick={() => void updateOperationsCase({ status: selectedOperationCase.status, risk: selectedOperationCase.risk, assignee: selectedOperationCase.assignee, resolution: selectedOperationCase.resolution }, Boolean(operationNote.trim()))}>{operationsStatus === "saving" ? "Saving…" : selectedOperationCase.status === "resolved" ? "Save resolution" : "Save case"}</button></div></aside></div>}
      {uiNotice && <div className="ui-notice" role="status"><span>✓</span>{uiNotice}<button onClick={() => setUiNotice(null)} aria-label="Dismiss message">×</button></div>}

      <footer>
        <div className="brand footer-brand"><span className="brand-mark"><i /></span><span>JobLink</span></div>
        <p>Local work, matched better.</p>
        <div><button onClick={() => go("discover")}>How it works</button><button onClick={() => go("trust")}>Trust & safety</button><button onClick={() => setAccountGatewayOpen(true)}>Create an account</button><button onClick={() => go("help")}>Help</button><button onClick={() => { setAccountGatewayOpen(true); setAccountActionError(""); }}>Operations login</button></div>
        <span>© 2026 JobLink · Hamilton, Ontario</span>
      </footer>
    </main>
  );
}
