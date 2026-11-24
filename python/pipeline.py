"""LLM helper, ICP generation, discovery pipeline with the receipt gate, enrichment and outreach."""
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


def llm_json(system, prompt, required, mock_fn):
    """Ask an LLM for one JSON object, check the required keys, fall back to mock on any failure.
    Returns (data, mode, error)."""
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
        return data, "live", None
    except Exception as e:  # noqa: BLE001
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


def _search(queries):
    """Tavily web search. Returns (snippets, mode)."""
    if not env("TAVILY_API_KEY"):
        return [], "mock"
    try:
        snippets = []
        for q in queries:
            t0 = time.perf_counter()
            r = _post("https://api.tavily.com/search", {"query": q, "max_results": 6, "search_depth": "basic"},
                      {"Authorization": "Bearer " + env("TAVILY_API_KEY")}, timeout=25)
            for x in r.get("results", []):
                snippets.append({"title": x.get("title", ""), "url": x.get("url", ""), "content": (x.get("content") or "")[:700], "date": x.get("published_date")})
            feed("search", f'Tavily: "{q}" returned {len(r.get("results", []))} results', mode="live", ms=round((time.perf_counter() - t0) * 1000))
        if not snippets:
            raise ValueError("no results")
        return snippets, "live"
    except Exception as e:  # noqa: BLE001
        feed("info", f"Tavily failed ({str(e)[:80]}). Using cached results.", mode="mock")
        return [], "mock"


def _extract(intake, icp, snippets):
    """LLM structured extraction of companies and competitors. Returns (companies, competitors, mode, error, is_demo_data)."""
    if not snippets:
        return mock.mock_companies(), mock.MOCK_COMPETITORS, "mock", None, True
    urls = {s["url"] for s in snippets}
    icp_brief = {"industries": icp["industries"], "companySize": icp["companySize"], "personas": [p["title"] for p in icp["personas"]],
                 "triggers": [t["event"] for t in icp["triggers"]], "negativeSignals": [n["signal"] for n in icp["negativeSignals"]]}
    results = "\n\n".join(f"[{i + 1}] {s['title']}\nURL: {s['url']}\nDate: {s['date'] or 'unknown'}\n{s['content']}" for i, s in enumerate(snippets))
    data, mode, err = llm_json(
        "You extract target accounts from web search results for a B2B sales team. Use only facts in the snippets. Every sourceUrl must be copied exactly from a snippet URL. Never invent a URL, person or signal.",
        f"Seller: {intake['name']}. {intake['product']}\nICP: {json.dumps(icp_brief)}\n\nSearch results:\n{results}\n\n"
        'Return JSON: { "companies": [10 to 15 distinct companies that could buy from the seller, not the seller itself and not news publishers. Each: name, domain, industry, '
        "employees (number, 0 if unknown), description, sourceUrl, sourceTitle, fitConfidence 0 to 1, fitReason, negativeSignalMatched (exact text of an ICP negative signal the company matches, or null), "
        "usesCompetitor (name or null), signals (trigger signals found in snippets: type one of funding|hiring|launch|job_post|news, text, sourceUrl, sourceTitle, date as YYYY-MM-DD or empty), "
        'contact (name and title of a person named in the snippets who fits a persona, or null)], "competitors": [exactly 3 competitors of the seller: name, positioning, pricingTier, '
        "differentiators (3 strings), sourceUrl (a snippet URL, or empty string if none)] }",
        ["companies", "competitors"], lambda: None)
    if mode == "mock" or not data or len(data.get("companies") or []) < 3:
        return mock.mock_companies(), mock.MOCK_COMPETITORS, "mock", err, True
    companies = []
    try:
        for c in data["companies"]:
            contact = c.get("contact")
            companies.append({
                "name": str(c["name"]), "domain": str(c.get("domain") or ""), "industry": str(c.get("industry") or ""), "employees": int(float(c.get("employees") or 0)),
                "description": str(c.get("description") or ""), "sourceTitle": str(c.get("sourceTitle") or ""), "fitConfidence": max(0.0, min(1.0, float(c.get("fitConfidence") or 0))),
                "fitReason": str(c.get("fitReason") or ""), "negativeSignalMatched": c.get("negativeSignalMatched") or None, "usesCompetitor": c.get("usesCompetitor") or None,
                # Drop any citation the model did not copy from a real search result.
                "sourceUrl": c.get("sourceUrl") if c.get("sourceUrl") in urls else "",
                "signals": [{"type": s.get("type") if s.get("type") in RANK else "news", "text": str(s.get("text") or ""), "sourceUrl": s["sourceUrl"],
                             "sourceTitle": str(s.get("sourceTitle") or ""), "date": s.get("date") or time.strftime("%Y-%m-%d")}
                            for s in (c.get("signals") or []) if s.get("sourceUrl") in urls],
                "contact": {"name": contact["name"], "title": contact.get("title") or "", "previousEmployers": []} if contact and contact.get("name") else None,
            })
        return companies, data["competitors"][:3], "live", None, False
    except Exception as e:  # noqa: BLE001
        return mock.mock_companies(), mock.MOCK_COMPETITORS, "mock", str(e)[:200], True


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
    live_search = bool(env("TAVILY_API_KEY"))
    pace = (lambda: None) if live_search else (lambda: time.sleep(0.35))
    with LOCK:
        STATE.update(running="discovery", leads=[], heldBack=[], competitors=[], displacement=[])
        save()
    try:
        # 1. Search
        if live_search:
            ind = [i["name"] for i in icp["industries"][:2]]
            segs = [s["name"] for s in icp["adjacentSegments"] if s["status"] == "accepted"]
            queries = [f"{ind[0]} startups raised funding round", f"{ind[-1]} companies hiring {icp['personas'][0]['title']}",
                       f"{icp['triggers'][0]['event']} {ind[0]}"] + ([f"{segs[0]} company launch OR funding"] if segs else []) + [f"{intake['name']} competitors alternatives pricing"]
        else:
            queries = mock.MOCK_QUERIES
        feed("info", f"Discovery started for {intake['name']}: {len(queries)} searches planned.")
        snippets, search_mode = _search(queries)
        if search_mode == "mock":
            for q in mock.MOCK_QUERIES:
                feed("search", f'Search (cached): "{q}"', mode="mock")
                pace()

        # 2. Extract companies and the competitor map
        companies, competitors, ex_mode, err, demo = _extract(intake, icp, snippets)
        if err:
            feed("info", f"LLM extraction fell back to cached data: {err}", mode="mock")
        feed("llm", f"Extracted {len(companies)} companies and {len(competitors)} competitors with structured output.", mode=ex_mode)
        with LOCK:
            STATE["modes"].update(search="mock" if demo else search_mode, extract=ex_mode)
            STATE["competitors"] = competitors
            STATE["people"] = mock.MOCK_CUSTOMER_PEOPLE if demo else []
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

def _hunter(lead):
    """Hunter email finder. Returns (email, verified, confidence, linkedin, mode)."""
    parts = re.sub(r"[^a-z ]", "", lead["contact"]["name"].lower()).split()
    first, last = (parts[0] if parts else ""), (parts[-1] if len(parts) > 1 else "")
    linkedin = "https://www.linkedin.com/search/results/people/?keywords=" + urllib.parse.quote(f"{lead['contact']['name']} {lead['company']}")
    key = env("HUNTER_API_KEY")
    if key and first and last:
        try:
            url = "https://api.hunter.io/v2/email-finder?" + urllib.parse.urlencode({"domain": lead["domain"], "first_name": first, "last_name": last, "api_key": key})
            d = json.loads(urllib.request.urlopen(url, timeout=12).read()).get("data") or {}
            if d.get("email"):
                return d["email"], (d.get("verification") or {}).get("status") == "valid", (d.get("score") or 0) / 100, d.get("linkedin_url") or linkedin, "live"
        except Exception:
            pass
    return f"{first}.{last or 'team'}@{lead['domain']}", not key, 0.9, linkedin, "mock"


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

    email, verified, conf, linkedin, e_mode = _hunter(lead)
    feed("enrich", f"Hunter: {lead['contact']['name']} at {lead['domain']} -> {email} ({'verified' if verified else 'unverified'})", mode=e_mode)
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
    audit("AI", "Lead enriched", f"{lead['company']}: found {email}, drafted 3 messages for review.", lead["id"])
    return None
