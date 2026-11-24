"""LLM helper, ICP generation, discovery over the seeded dataset with the receipt gate, enrichment and outreach."""
import json
import re
import time
import urllib.parse
import urllib.request

import core
import mock
import moss_index
from core import LOCK, STATE, audit, env, feed, meter, save, uid


def _post(url, body, headers, timeout=60):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers})
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def llm_configured():
    return bool(env("ANTHROPIC_API_KEY") or env("OPENAI_API_KEY"))


LLM_FAILED = False  # set when the last LLM call errored, so the header badge does not claim "live"


def llm_working():
    return llm_configured() and not LLM_FAILED


def llm_json(system, prompt, required, mock_fn):
    """Ask an LLM for one JSON object, check the required keys, fall back to mock on any failure.
    Returns (data, mode, error)."""
    global LLM_FAILED
    if not llm_configured():
        return mock_fn(), "mock", None
    try:
        system += "\nReturn only one valid JSON object. No prose, no markdown fences."
        if env("ANTHROPIC_API_KEY"):
            r = _post("https://api.anthropic.com/v1/messages",
                      {"model": env("LLM_MODEL") or "claude-sonnet-5-5", "max_tokens": 8000, "system": system, "messages": [{"role": "user", "content": prompt}]},
                      {"x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01"})
            text = "".join(b.get("text", "") for b in r["content"])
        else:
            r = _post("https://api.openai.com/v1/chat/completions",
                      {"model": env("LLM_MODEL") or "gpt-4o-mini", "response_format": {"type": "json_object"},
                       "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]},
                      {"Authorization": "Bearer " + env("OPENAI_API_KEY")})
            text = r["choices"][0]["message"]["content"]
        data = json.loads(text[text.index("{"): text.rindex("}") + 1])
        missing = [k for k in required if k not in data]
        if missing:
            raise ValueError(f"missing keys: {missing}")
        LLM_FAILED = False
        return data, "live", None
    except Exception as e:  # noqa: BLE001
        LLM_FAILED = True
        return mock_fn(), "mock", str(e)[:200]


# ---------- 1. ICP ----------

def generate_icp(intake):
    data, mode, err = llm_json(
        "You are a B2B go-to-market strategist. You define precise ideal customer profiles.",
        f"Product: {intake['name']}\nDescription: {intake['product']}\nExisting customers: {intake['customers']}\nPricing: {intake['pricing']}\n\n"
        "Return JSON with keys: industries (3 to 4 items: name, naics 6 digit code as string, confidence 0 to 1), companySize (min, max employees, confidence), "
        "personas (2 to 3: title, why, tone, confidence), triggers (3 to 4 trigger events that mean buy now: event, confidence), "
        "negativeSignals (2 to 3 disqualifiers: signal, confidence), adjacentSegments (exactly 2 adjacent segments worth testing: name, rationale, confidence).",
        ["industries", "companySize", "personas", "triggers", "negativeSignals", "adjacentSegments"],
        lambda: mock.mock_icp(intake))
    try:
        data["adjacentSegments"] = [{"id": f"seg{i + 1}", "name": s["name"], "rationale": s["rationale"], "confidence": float(s["confidence"]), "status": "proposed"}
                                    for i, s in enumerate(data["adjacentSegments"][:2])]
        for i in data["industries"]:
            i["naics"] = str(i["naics"])
    except Exception as e:  # noqa: BLE001
        data, mode, err = mock.mock_icp(intake), "mock", str(e)[:200]
    return data, mode, err


# ---------- 2. Discovery ----------

RANK = {"funding": 4, "launch": 3, "hiring": 2, "job_post": 2, "news": 1}


def _persona_match(title, icp):
    t = title.lower()
    keys = {"ai", "ml", "cto", "engineering", "product", "founder", "technology", "platform", "data", "ceo", "technical"}
    for p in icp["personas"]:
        keys.update(w for w in re.findall(r"[a-z]+", p["title"].lower()) if len(w) > 1)
    hit = sum(1 for k in keys if re.search(rf"\b{re.escape(k)}\b", t))
    return min(0.95, 0.45 + hit * 0.15)


def run_discovery():
    intake, icp = STATE["intake"], STATE["icp"]
    if not intake or not icp:
        raise ValueError("Generate an ICP first")
    pace = lambda: time.sleep(0.35)  # noqa: E731
    with LOCK:
        STATE.update(running="discovery", leads=[], heldBack=[], competitors=[], displacement=[])
        save()
    try:
        # 1. Scan the seeded account dataset (there is no web search provider)
        feed("info", f"Discovery started for {intake['name']}: scanning the account dataset with {len(mock.MOCK_QUERIES)} queries.")
        for q in mock.MOCK_QUERIES:
            feed("search", f'Dataset query: "{q}"', mode="mock")
            pace()

        # 2. Load companies and the competitor map
        companies, competitors = mock.mock_companies(), mock.MOCK_COMPETITORS
        feed("info", f"Loaded {len(companies)} companies and {len(competitors)} competitors from the seeded dataset.", mode="mock")
        with LOCK:
            STATE["modes"]["search"] = "mock"
            STATE["modes"].pop("extract", None)
            STATE["competitors"] = competitors
            STATE["people"] = mock.MOCK_CUSTOMER_PEOPLE
            save()
        pace()

        # 3. Receipt gate: no receipt, no outreach
        leads, held = [], []
        for i, c in enumerate(companies):
            def hold(missing, reason, c=c):
                held.append({"id": uid("h"), "company": c["name"], "domain": c["domain"], "missing": missing, "reason": reason,
                             "sourceUrl": c["sourceUrl"] or (c["signals"][0]["sourceUrl"] if c["signals"] else ""), "sourceTitle": c["sourceTitle"]})
                feed("held", f"Held back {c['name']}: {reason}")

            signals = [{**s, "id": f"{i}-{j}-{uid('s')}", "company": c["name"]} for j, s in enumerate(c["signals"]) if s["sourceUrl"]]
            signals.sort(key=lambda s: (RANK.get(s["type"], 0), s["date"]), reverse=True)
            contact = c.get("contact")
            if c.get("negativeSignalMatched"):
                hold("NEGATIVE", f"Negative signal: {c['negativeSignalMatched']}")
            elif c["employees"] > icp["companySize"]["max"] * 5:
                hold("NEGATIVE", f"Negative signal: {c['employees']:,} employees, far outside the {icp['companySize']['min']} to {icp['companySize']['max']} range")
            elif not c["sourceUrl"]:
                hold("FIT", "FIT receipt missing: no source found for the company match")
            elif c["fitConfidence"] < 0.5:
                hold("FIT", f"FIT receipt missing: confidence {c['fitConfidence']:.2f} is below the 0.50 bar. {c['fitReason']}")
            elif not signals:
                hold("TIMING", "TIMING receipt missing: no sourced trigger signal, so there is no reason to reach out today")
            elif not contact or not contact.get("name"):
                hold("PERSON", "PERSON receipt missing: no contact matching a buyer persona was found")
            elif _persona_match(contact["title"], icp) < 0.5:
                hold("PERSON", f"PERSON receipt missing: {contact['title']} does not match any buyer persona")
            else:
                top, pm = signals[0], _persona_match(contact["title"], icp)
                leads.append({
                    "id": uid("lead"), "company": c["name"], "domain": c["domain"], "industry": c["industry"], "employees": c["employees"], "description": c["description"],
                    "sourceUrl": c["sourceUrl"], "sourceTitle": c["sourceTitle"], "usesCompetitor": c.get("usesCompetitor"), "signals": signals,
                    "contact": {"name": contact["name"], "title": contact["title"], "previousEmployers": contact.get("previousEmployers") or []},
                    "receipts": {
                        "fit": {"ok": True, "summary": c["fitReason"], "sourceUrl": c["sourceUrl"], "sourceTitle": c["sourceTitle"], "confidence": c["fitConfidence"]},
                        "person": {"ok": True, "summary": f"{contact['name']}, {contact['title']}: role matches a buyer persona", "sourceUrl": c["sourceUrl"], "sourceTitle": c["sourceTitle"], "confidence": pm},
                        "timing": {"ok": True, "summary": top["text"], "sourceUrl": top["sourceUrl"], "sourceTitle": top["sourceTitle"], "confidence": min(0.97, 0.6 + len(signals) * 0.15)},
                    },
                    "fitScore": 0, "intentScore": 0, "score": 0, "tier": "C", "stage": "Matched", "enriched": False, "template": "A" if len(leads) % 2 == 0 else "B",
                    "messages": [], "costCredits": 0, "lastActor": "AI", "lastAction": "Matched to ICP",
                })
        with LOCK:
            STATE["leads"], STATE["heldBack"] = leads, held
            save()
        feed("info", f"Receipt gate: {len(leads)} leads have all three receipts, {len(held)} held back.")
        pace()

        # 4. Moss: index every signal and company snippet
        docs = []
        for i, c in enumerate(companies):
            if c["sourceUrl"]:
                docs.append({"id": f"c{i}", "text": f"{c['name']}: {c['description']}", "metadata": {"company": c["name"], "sourceUrl": c["sourceUrl"], "type": "profile"}})
            docs += [{"id": f"c{i}s{j}", "text": f"{c['name']}: {s['text']}", "metadata": {"company": c["name"], "sourceUrl": s["sourceUrl"], "type": s["type"]}}
                     for j, s in enumerate(c["signals"]) if s["sourceUrl"]]
        mode, ms, merr = moss_index.index_signals(docs)
        with LOCK:
            STATE["modes"]["moss"] = mode
            save()
        feed("moss", f'Moss: indexed {len(docs)} snippets and signals into index "signals"{f" (local fallback: {merr})" if merr else ""}', mode=mode, ms=ms)

        # 5. Graph queries
        graph, customers, warm = core.build_graph(), core.customers_of(), 0
        t0 = time.perf_counter()
        with LOCK:
            for l in STATE["leads"]:
                p = core.warm_intro_path(graph, customers, l["contact"]["name"])
                if p:
                    warm += 1
                    l["warmPath"], l["warmPathIds"] = p["text"], p["ids"]
                    r = l["receipts"]["person"]
                    r["summary"] = f"{l['contact']['name']}, {l['contact']['title']}: role match plus a {p['hops']} hop warm intro path"
                    r["confidence"] = min(0.98, r["confidence"] + 0.12)
            save()
        feed("graph", f"Graph query: warm intro paths from {len(customers)} customers via previously_employed_at. {warm} found.", ms=round((time.perf_counter() - t0) * 1000, 2))
        meter("graph_query", None, "warm intro")
        disp = core.displacement_targets(core.build_graph())
        with LOCK:
            STATE["displacement"] = disp
            save()
        found = (": " + ", ".join(f"{d['company']} uses {d['competitor']}" for d in disp)) if disp else ""
        feed("graph", f"Graph query: displacement targets (companies using a competitor). {len(disp)} found{found}.")
        meter("graph_query", None, "displacement")

        # 6. Retrieve top signals from Moss per lead, then score
        for l in list(STATE["leads"]):
            q = moss_index.query_company(l["company"], "funding hiring launch job post trigger signal", 5)
            intent = core.intent_score(l["signals"])
            fit, score, tier = core.composite(l["receipts"]["fit"]["confidence"], intent, bool(l.get("warmPath")))
            with LOCK:
                l.update(moss=q, intentScore=intent, fitScore=fit, score=score, tier=tier)
                save()
            feed("moss", f"Moss: top {len(q['hits'])} signals for {l['company']}. Score {score}, tier {tier}.", mode=q["mode"], ms=q["ms"])
            audit("AI", "Lead matched", f"{l['company']} matched with 3 receipts. Score {score}, tier {tier}.", l["id"])
        with LOCK:
            STATE["leads"].sort(key=lambda l: -l["score"])
            save()
        for h in held:
            audit("AI", "Lead held back", f"{h['company']}: {h['reason']}")
        feed("info", "Discovery complete.")
    finally:
        with LOCK:
            STATE["running"] = None
            save()


# ---------- 5. Enrichment and outreach ----------

def _contact(lead):
    """No email provider is connected, so the address is a pattern guess and always unverified.
    Returns (email, verified, confidence, linkedin, mode)."""
    parts = re.sub(r"[^a-z ]", "", lead["contact"]["name"].lower()).split()
    first, last = (parts[0] if parts else ""), (parts[-1] if len(parts) > 1 else "team")
    linkedin = "https://www.linkedin.com/search/results/people/?keywords=" + urllib.parse.quote(f"{lead['contact']['name']} {lead['company']}")
    return f"{first}.{last}@{lead['domain']}", False, 0.5, linkedin, "mock"


def enrich_and_draft(lead_id):
    """Returns None on success, or an error code: 'no_credits' or 'not_found'."""
    lead = core.find_lead(lead_id)
    if not lead:
        return "not_found"
    if lead["enriched"]:
        return None
    if not core.can_afford("lead_enriched"):
        feed("credit", f"Enrichment blocked for {lead['company']}: out of credits. Top up to continue.")
        return "no_credits"
    r = lead["receipts"]  # the core rule, enforced again at draft time
    if not (r["fit"]["ok"] and r["person"]["ok"] and r["timing"]["ok"] and r["fit"].get("sourceUrl") and r["timing"].get("sourceUrl")):
        return "not_found"

    email, verified, conf, linkedin, e_mode = _contact(lead)
    feed("enrich", f"Contact: {lead['contact']['name']} at {lead['domain']} -> {email} (pattern guess, unverified)")
    meter("lead_enriched", lead["id"], lead["company"])

    q = moss_index.query_company(lead["company"], f"{r['timing']['summary']} why now", 5)
    feed("moss", f"Moss: retrieved top {len(q['hits'])} signals for {lead['company']} to ground the draft.", mode=q["mode"], ms=q["ms"])

    intake, icp = STATE["intake"] or {}, STATE["icp"] or {"personas": []}
    words = [w for w in re.split(r"\W+", lead["contact"]["title"].lower()) if len(w) > 2]
    persona = next((p for p in icp["personas"] if any(w in p["title"].lower() for w in words)), icp["personas"][0] if icp["personas"] else None)
    tone = persona["tone"] if persona else "concise, professional"
    style = "A, open with the trigger signal" if lead["template"] == "A" else "B, open with the pain, then cite the signal"
    warm_line = f"Warm intro path: {lead['warmPath']}\n" if lead.get("warmPath") else ""
    hits_text = "\n".join("- " + h["text"] for h in q["hits"])
    seq, s_mode, _ = llm_json(
        "You write short, specific B2B outreach. Plain language, no hype, no em dashes. Never invent facts beyond what is provided.",
        f"Seller: {intake.get('name')}. {intake.get('product')}\nPricing: {intake.get('pricing')}\nLead: {lead['contact']['name']}, {lead['contact']['title']} at {lead['company']} ({lead['description']})\n"
        f"Tone for this persona: {tone}\nTemplate style: {style}\nTIMING receipt (must be quoted or closely paraphrased in every message): \"{r['timing']['summary']}\"\n"
        f"FIT receipt: {r['fit']['summary']}\n{warm_line}"
        f"Signals retrieved from Moss:\n{hits_text}\n\n"
        'Return JSON: { "email1": {"subject","body"} (under 120 words), "linkedin": {"body"} (under 300 characters), "email2": {"subject","body"} (follow up, under 80 words) }. Sign emails as "Your name".',
        ["email1", "linkedin", "email2"], lambda: mock.mock_sequence(lead, intake, tone))
    feed("llm", f"Drafted 3 step sequence for {lead['company']} (template {lead['template']}, tone: {tone}).", mode=s_mode)

    def mk(step, channel, label, part):
        m = {"id": uid("m"), "step": step, "channel": channel, "label": label, "body": part["body"], "status": "draft", "edited": False}
        if "subject" in part:
            m["subject"] = part["subject"]
        return m

    with LOCK:
        lead["contact"].update(email=email, emailVerified=verified, emailConfidence=conf, linkedin=linkedin)
        lead.update(enriched=True, enrichMode=e_mode, outreachMode=s_mode, moss=q, lastActor="AI", lastAction="Drafted outreach",
                    messages=[mk(1, "email", "Email", seq["email1"]), mk(2, "linkedin", "LinkedIn note", seq["linkedin"]), mk(3, "email", "Follow up email", seq["email2"])])
        save()
    audit("AI", "Lead enriched", f"{lead['company']}: contact {email} (unverified), drafted 3 messages for review.", lead["id"])
    return None
