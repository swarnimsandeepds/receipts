// All seeded fallback data. Every company, person and article in this file is
// fictional demo data. Source links point at /mock-source/<id>, a local page that
// renders the seeded snippet, so citations stay clickable with zero API keys.
import type { Competitor, Icp, Intake, Lead, Message, RawCompany, SignalType } from "./types";

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export const DEMO_INTAKE: Intake = {
  name: "Moss",
  product:
    "Moss (moss.dev): real time semantic search for voice agents and copilots. Retrieval runs next to the agent so it can ground every turn in fresh context without adding latency to the conversation.",
  customers: "Parley Voice, Hearth AI, Cobalt Assist",
  pricing: "Usage based. Free developer tier, then pay per query, with enterprise plans for dedicated support and SLAs.",
};

export const MOCK_CUSTOMER_PEOPLE = [
  { name: "Marco Bellini", title: "CTO", company: "Parley Voice", previousEmployers: ["Tidewater Speech"] },
  { name: "Dana Okafor", title: "VP Engineering", company: "Hearth AI", previousEmployers: ["Kestrel Labs"] },
  { name: "Lena Fischer", title: "Head of Product", company: "Cobalt Assist", previousEmployers: ["Brightline Health"] },
];

export function mockIcp(intake: Intake): Icp {
  const voice = /voice|agent|copilot|search|retriev|moss/i.test(intake.product + intake.name);
  if (!voice) {
    return {
      industries: [
        { name: "B2B SaaS", naics: "513210", confidence: 0.78 },
        { name: "IT services and custom software", naics: "541511", confidence: 0.64 },
        { name: "Data processing and hosting", naics: "518210", confidence: 0.55 },
      ],
      companySize: { min: 30, max: 600, confidence: 0.7 },
      personas: [
        { title: "VP Engineering", why: "Owns build versus buy decisions for the platform", tone: "technical, concise", confidence: 0.8 },
        { title: "Head of Product", why: "Feels the roadmap cost of building in house", tone: "outcome led", confidence: 0.68 },
      ],
      triggers: [
        { event: "Raised a funding round in the last 90 days", confidence: 0.8 },
        { event: "Hiring for roles your product replaces or accelerates", confidence: 0.72 },
        { event: "Announced a new product line", confidence: 0.6 },
      ],
      negativeSignals: [
        { signal: "Builds the capability in house as a core product", confidence: 0.85 },
        { signal: "Enterprise above 5,000 employees with long procurement", confidence: 0.7 },
        { signal: "Agency or consultancy with no product of its own", confidence: 0.66 },
      ],
      adjacentSegments: [
        { id: "seg1", name: "Vertical SaaS for healthcare", rationale: "Similar buyer, higher compliance needs", confidence: 0.58, status: "proposed" },
        { id: "seg2", name: "Developer tools startups", rationale: "Technical buyers who adopt bottoms up", confidence: 0.52, status: "proposed" },
      ],
    };
  }
  return {
    industries: [
      { name: "Voice AI and conversational platforms", naics: "541511", confidence: 0.93 },
      { name: "Customer support and contact center software", naics: "513210", confidence: 0.86 },
      { name: "Sales and meeting copilots", naics: "513210", confidence: 0.78 },
      { name: "Healthcare patient engagement tech", naics: "518210", confidence: 0.66 },
    ],
    companySize: { min: 20, max: 500, confidence: 0.82 },
    personas: [
      { title: "Head of AI / ML Engineering", why: "Owns retrieval quality and latency budgets for the agent", tone: "technical, direct, benchmark driven", confidence: 0.92 },
      { title: "CTO or VP Engineering", why: "Decides build versus buy for agent infrastructure", tone: "concise, architecture level", confidence: 0.84 },
      { title: "Head of Product, Conversational AI", why: "Accountable for answer accuracy and time to first word", tone: "outcome led, customer experience focused", confidence: 0.7 },
    ],
    triggers: [
      { event: "Raised Seed to Series B in the last 90 days", confidence: 0.88 },
      { event: "Hiring retrieval, search or voice infrastructure engineers", confidence: 0.85 },
      { event: "Launched or announced a real time voice agent or copilot", confidence: 0.83 },
      { event: "Public job post mentioning RAG latency or vector search", confidence: 0.74 },
    ],
    negativeSignals: [
      { signal: "Sells its own vector database or retrieval engine", confidence: 0.9 },
      { signal: "Enterprise above 5,000 employees with an in-house search team", confidence: 0.8 },
      { signal: "Agency or consultancy with no production agent of its own", confidence: 0.72 },
    ],
    adjacentSegments: [
      { id: "seg1", name: "In-car and embedded voice assistants", rationale: "Hard latency ceilings and on-device constraints make fast local retrieval a must", confidence: 0.64, status: "proposed" },
      { id: "seg2", name: "Legal and compliance copilots", rationale: "Copilots that must cite fresh documents mid conversation share the same retrieval bottleneck", confidence: 0.57, status: "proposed" },
    ],
  };
}

export const MOCK_QUERIES = [
  "voice AI agent startups funding round 2026",
  "hiring retrieval engineer voice agent real time RAG",
  "launch real time agent assist copilot contact center",
  "job post vector search latency voice assistant",
  "semantic search for voice agents competitors pricing",
];

type S = [SignalType, string, string, number]; // type, text, source title, days ago
function co(
  slug: string, name: string, industry: string, employees: number, description: string,
  fitConfidence: number, fitReason: string, sigs: S[],
  contact: RawCompany["contact"], extra: Partial<RawCompany> = {},
): RawCompany {
  return {
    name, domain: `${slug}.example`, industry, employees, description, fitConfidence, fitReason,
    sourceUrl: `/mock-source/${slug}-profile`, sourceTitle: `${name} company profile`,
    signals: sigs.map(([type, text, sourceTitle, d], i) => ({ type, text, sourceTitle, sourceUrl: `/mock-source/${slug}-s${i + 1}`, date: daysAgo(d) })),
    contact, ...extra,
  };
}

const V = "Voice AI and conversational platforms";
const C = "Customer support and contact center software";
const SC = "Sales and meeting copilots";
const H = "Healthcare patient engagement tech";

export const MOCK_COMPANIES: RawCompany[] = [
  co("larkspurvoice", "Larkspur Voice", V, 85, "Voice agents that handle scheduling and intake calls for outpatient clinics.", 0.93,
    "Production voice agent, 85 employees, retrieval sits on the critical path of every call turn.",
    [["funding", "Larkspur Voice raised an $18M Series A to expand its clinic voice agent to 400 new sites.", "Larkspur Voice closes $18M Series A", 9],
     ["job_post", "Job post: Senior Retrieval Engineer to cut knowledge lookup latency below 50 ms per turn.", "Careers: Senior Retrieval Engineer", 5]],
    { name: "Priya Raman", title: "Head of AI", previousEmployers: ["Parley Voice"] }),
  co("tandemdesk", "Tandem Desk", C, 140, "Real time copilot that suggests answers to support agents during live calls and chats.", 0.9,
    "Agent assist copilot in the core ICP industry, mid market size, answers depend on live knowledge retrieval.",
    [["launch", "Tandem Desk launched Live Assist, a copilot that surfaces answers while the customer is still talking.", "Tandem Desk launches Live Assist", 12],
     ["hiring", "Hiring 6 engineers across search relevance and speech infrastructure this quarter.", "Tandem Desk engineering hiring plan", 20]],
    { name: "Jonas Weber", title: "VP Engineering", previousEmployers: ["Kestrel Labs"] }),
  co("quillon", "Quillon AI", SC, 60, "Sales call copilot that prompts reps with objection handling and product facts in real time.", 0.86,
    "Sales copilot with a real time loop, 60 employees, small platform team likely to buy rather than build.",
    [["funding", "Quillon AI announced a $7M seed extension led by existing investors to scale its live coaching product.", "Quillon AI extends seed by $7M", 15],
     ["job_post", "Job post: Staff Engineer, Realtime Knowledge. Mentions RAG latency as the top product complaint.", "Careers: Staff Engineer, Realtime Knowledge", 7]],
    { name: "Aisha Bello", title: "CTO", previousEmployers: ["Tidewater Speech"] }),
  co("northfold", "Northfold", V, 310, "Voice bots for consumer lending servicing and collections.", 0.84,
    "Regulated voice agent at scale, inside size range, currently on a general purpose vector database.",
    [["launch", "Northfold rolled out a multilingual servicing agent to three regional lenders.", "Northfold expands multilingual voice agent", 18],
     ["news", "Engineering blog: p95 retrieval latency is our biggest contributor to awkward call pauses.", "Northfold engineering blog: chasing the pause", 26]],
    { name: "Rafael Souza", title: "Director of ML Engineering", previousEmployers: [] }, { usesCompetitor: "Pinecone" }),
  co("halcyoncx", "Halcyon CX", C, 480, "Cloud contact center platform adding native AI agents.", 0.8,
    "Contact center platform at the top of the size range, launching AI agents this year.",
    [["launch", "Halcyon CX announced Halcyon Agents, voice AI built into its contact center suite, in general availability.", "Halcyon CX ships Halcyon Agents", 6]],
    { name: "Mei Tanaka", title: "Head of Product, Conversational AI", previousEmployers: [] }),
  co("corvidlabs", "Corvid Labs", V, 45, "Drive-through and phone ordering voice agents for restaurant chains.", 0.82,
    "Voice agent startup, menu and promo knowledge changes daily so fresh retrieval matters.",
    [["funding", "Corvid Labs raised a $5.5M seed round to bring voice ordering to 1,200 restaurant locations.", "Corvid Labs raises $5.5M seed", 30],
     ["hiring", "Hiring a founding search engineer to own menu retrieval.", "Corvid Labs: founding search engineer", 11]],
    { name: "Tomasz Nowak", title: "Co-founder and CTO", previousEmployers: [] }),
  co("brightlinehealth", "Brightline Health", H, 220, "Patient engagement platform with a voice agent for refills and appointment reminders.", 0.74,
    "Healthcare engagement vendor with a live voice agent, matches a secondary ICP industry.",
    [["hiring", "Brightline Health is hiring an ML Engineer, Conversational Search for its voice team.", "Careers: ML Engineer, Conversational Search", 14]],
    { name: "Grace Lindqvist", title: "VP Engineering", previousEmployers: [] }),
  co("sablewood", "Sablewood", V, 260, "Claims intake voice agent for property and casualty insurers.", 0.77,
    "Insurance voice agent in size range, policy lookups run through a competitor today.",
    [["news", "Sablewood named its claims voice agent the top priority for 2027 in a customer webinar.", "Sablewood 2027 roadmap webinar recap", 33],
     ["job_post", "Job post: Platform Engineer to migrate retrieval off the current vector store.", "Careers: Platform Engineer, Retrieval", 10]],
    { name: "Owen Gallagher", title: "Head of AI Platform", previousEmployers: [] }, { usesCompetitor: "Weaviate" }),
  co("pellucid", "Pellucid", SC, 35, "Meeting copilot that answers questions from company docs during calls.", 0.71,
    "Small meeting copilot team, good technical fit but early in revenue.",
    [["launch", "Pellucid launched in-call answers that pull from connected wikis in under a second.", "Pellucid launches in-call answers", 40]],
    { name: "Nadia Haddad", title: "Co-founder and CEO", previousEmployers: [] }),
  co("ostrava", "Ostrava Systems", "In-car and embedded voice assistants", 150, "In-car voice assistant software for commercial fleets.", 0.63,
    "Adjacent segment: embedded voice with strict latency limits, outside the core industries.",
    [["news", "Ostrava Systems signed a pilot with a regional trucking fleet for its voice assistant.", "Ostrava Systems signs fleet pilot", 52]],
    { name: "Viktor Hruby", title: "Director of Engineering", previousEmployers: [] }),
  co("junipervale", "Juniper and Vale", "Legal and compliance copilots", 70, "Copilot for in-house legal teams that cites clauses during negotiations.", 0.58,
    "Adjacent segment: document copilot, less real time pressure than voice.",
    [["hiring", "Juniper and Vale is hiring one backend engineer with search experience.", "Careers: Backend Engineer", 60]],
    { name: "Clara Whitfield", title: "Head of Engineering", previousEmployers: [] }),
  co("fennec", "Fennec Robotics", "Warehouse automation", 120, "Voice picking assistant for warehouse staff.", 0.52,
    "Voice interface but mostly fixed commands, limited open retrieval need.",
    [["news", "Fennec Robotics mentioned exploring natural language queries in a trade interview.", "Interview: Fennec Robotics on voice picking", 75]],
    { name: "Samir Qureshi", title: "VP Product", previousEmployers: [] }),
  // Held back examples
  co("granitetelecom", "Granite Telecom Group", C, 12000, "National telecom carrier with an internal conversational AI division.", 0.61,
    "Runs voice agents at scale but far above the size range.",
    [["hiring", "Granite Telecom Group is hiring for its 40 person internal search platform team.", "Careers: Search Platform, Granite Telecom", 8]],
    { name: "Helen Marsh", title: "SVP Technology", previousEmployers: [] },
    { negativeSignalMatched: "Enterprise above 5,000 employees with an in-house search team" }),
  co("vectorhaus", "Vectorhaus", "Developer infrastructure", 90, "Open source vector database company with a managed cloud.", 0.4,
    "Sells retrieval infrastructure itself.",
    [["funding", "Vectorhaus raised a $22M Series A for its managed vector database.", "Vectorhaus raises $22M Series A", 21]],
    { name: "Ines Moreau", title: "CEO", previousEmployers: [] },
    { negativeSignalMatched: "Sells its own vector database or retrieval engine" }),
  co("mellowstudio", "Mellow Studio", V, 40, "Product studio that prototypes voice experiences for consumer brands.", 0.67,
    "Builds voice prototypes for clients, some production work.", [],
    { name: "Arjun Mehta", title: "Technical Director", previousEmployers: [] }),
  co("opaline", "Opaline", C, 180, "Help desk software adding an AI answer bot.", 0.72,
    "Support software in the core ICP with a new AI answer bot.",
    [["launch", "Opaline announced a beta of its AI answer bot for chat.", "Opaline AI answer bot beta", 16]],
    null),
  co("driftwoodanalytics", "Driftwood Analytics", "Business intelligence", 75, "Dashboards for retail finance teams.", 0.31,
    "No agent or copilot product found, weak match to every ICP industry.",
    [["funding", "Driftwood Analytics raised a $4M seed round.", "Driftwood Analytics raises $4M", 19]],
    { name: "Peter Aldous", title: "CTO", previousEmployers: [] }),
];

export const MOCK_COMPETITORS: Competitor[] = [
  { name: "Pinecone", positioning: "Managed vector database for general purpose AI retrieval at large scale.", pricingTier: "Usage based, free starter then paid plans",
    differentiators: ["Broad ecosystem and integrations", "Serverless scaling for very large indexes", "Network hop on every query, not tuned for per-turn voice latency"], sourceUrl: "/mock-source/competitor-pinecone" },
  { name: "Weaviate", positioning: "Open source vector database with hybrid search, self hosted or cloud.", pricingTier: "Open source, plus managed cloud tiers",
    differentiators: ["Self hosting and schema flexibility", "Hybrid keyword plus vector search", "Requires cluster operations and tuning by the customer"], sourceUrl: "/mock-source/competitor-weaviate" },
  { name: "Algolia", positioning: "Hosted search API built for site and app search, extending into AI search.", pricingTier: "Tiered by search requests, enterprise contracts",
    differentiators: ["Mature keyword relevance tooling", "Strong e-commerce footprint", "Designed for search boxes rather than agent loops"], sourceUrl: "/mock-source/competitor-algolia" },
];

/** Lookup for the local /mock-source/[id] page. */
export function mockSource(id: string): { title: string; text: string; company: string; date?: string } | null {
  for (const c of MOCK_COMPANIES) {
    if (c.sourceUrl.endsWith("/" + id)) return { title: c.sourceTitle, text: `${c.description} About ${c.employees} employees. Industry: ${c.industry}.`, company: c.name };
    for (const s of c.signals) if (s.sourceUrl.endsWith("/" + id)) return { title: s.sourceTitle, text: s.text, company: c.name, date: s.date };
  }
  for (const c of MOCK_COMPETITORS) if (c.sourceUrl.endsWith("/" + id)) return { title: `${c.name} positioning notes`, text: `${c.positioning} Pricing: ${c.pricingTier}. ${c.differentiators.join(". ")}.`, company: c.name };
  return null;
}

const first = (n: string) => n.split(" ")[0];

/** Template A leads with the trigger signal. Template B leads with the pain. */
export function mockSequence(lead: Lead, intake: Intake | null, tone: string): Omit<Message, "id" | "status" | "edited">[] {
  const product = intake?.name || "our product";
  const desc = (intake?.product || "").replace(/^[^:]{0,40}:\s*/, "").split(/\.\s/)[0].replace(/\.$/, "").trim();
  const pitch = desc ? desc[0].toLowerCase() + desc.slice(1) : "a faster way to get this done";
  const t = lead.receipts.timing.summary.replace(/\.$/, "");
  const c = lead.contact;
  const warm = lead.warmPath ? `\n\nSmall world: ${lead.warmPath.split(" (customer)")[0]} is one of our customers, and I think you know people on that team.` : "";
  const technical = /technical|direct|architecture|concise/i.test(tone);
  const openA = `Hi ${first(c.name)},\n\nI saw this and wanted to reach out today: "${t}."`;
  const openB = `Hi ${first(c.name)},\n\nMost teams building what ${lead.company} builds tell us the same thing: the model is fast enough, the knowledge lookup is what makes the experience feel slow.`;
  const why = technical
    ? `${product} is ${pitch}. Teams use it to keep lookup inside the turn budget without running their own retrieval cluster.`
    : `${product} is ${pitch}. The result for your customers is answers that are current and arrive without the awkward pause.`;
  const email1 = lead.template === "A"
    ? `${openA}\n\nThat usually means retrieval is about to carry a lot more load. ${why}${warm}\n\nWorth 20 minutes next week to compare notes on your setup?\n\nBest,\nYour name`
    : `${openB}\n\nIt stood out because of this: "${t}."\n\n${why}${warm}\n\nOpen to a short call next week?\n\nBest,\nYour name`;
  return [
    { step: 1, channel: "email", label: "Email", subject: lead.template === "A" ? `${lead.company}: ${lead.signals[0]?.type === "funding" ? "congrats on the round" : "saw the news"}, a thought on retrieval` : `The pause before ${lead.company}'s agent answers`, body: email1 },
    { step: 2, channel: "linkedin", label: "LinkedIn note", body: `Hi ${first(c.name)}, I sent a note about "${t.slice(0, 110)}${t.length > 110 ? "..." : ""}". ${product} helps teams like ${lead.company} keep retrieval fast inside the agent loop. Happy to share what we see across similar teams.` },
    { step: 3, channel: "email", label: "Follow up email", subject: `Re: ${lead.company} and retrieval`, body: `Hi ${first(c.name)},\n\nFollowing up on my note about "${t}."\n\nIf it helps, I can send a two page teardown of how a team in ${lead.industry.toLowerCase()} set up ${product}, including the latency numbers before and after. No call needed.\n\nShould I send it over?\n\nBest,\nYour name` },
  ];
}

/** Seeded historical outcomes so charts are meaningful on a fresh run. Labeled as seeded in the UI. */
export const MOCK_HISTORY = {
  byIndustry: [
    { name: "Voice AI", contacted: 42, replied: 11, meetings: 5 },
    { name: "Support software", contacted: 38, replied: 8, meetings: 3 },
    { name: "Sales copilots", contacted: 24, replied: 4, meetings: 2 },
    { name: "Healthcare tech", contacted: 18, replied: 2, meetings: 1 },
  ],
  byTier: [
    { name: "A", contacted: 40, replied: 13, meetings: 7 },
    { name: "B", contacted: 52, replied: 9, meetings: 3 },
    { name: "C", contacted: 30, replied: 3, meetings: 1 },
  ],
  ab: [
    { name: "A: signal led", sent: 64, replied: 15, meetings: 7 },
    { name: "B: pain led", sent: 58, replied: 9, meetings: 3 },
  ],
};
