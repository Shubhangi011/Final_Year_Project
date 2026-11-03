#!/usr/bin/env python3
"""
KaushalSetu Local AI/ML & Reputation Intelligence Engine (Python 3.10+)
Implements genuine TF-IDF + Cosine Similarity matching, Haversine geospatial scoring,
Bayesian-smoothed Dynamic Reputation calculation, Skill Gap Graph analysis,
Multivariate Fair Wage Estimation, Career Path Progression, and Z-Score Fraud Anomaly Detection.
Works 100% locally without requiring a paid external API key.
"""

import json
import math
import re
import sys
from collections import Counter

if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Multilingual & domain synonym normalization for Indian skilled trades
SYNONYM_MAP = {
    "विजेचे": "electrical",
    "इलेक्ट्रिशियन": "electrician",
    "इलेक्ट्रिशियनची": "electrician",
    "वायरिंग": "wiring",
    "इलेक्ट्रीशियन": "electrician",
    "बिजली": "electrical",
    "प्लंबर": "plumber",
    "नळ": "plumbing",
    "पाइप": "pipe fitting",
    "सुतार": "carpenter",
    "फर्निचर": "furniture",
    "बढ़ई": "carpenter",
    "वेल्डर": "welder",
    "वेल्डिंग": "welding",
    "सोलर": "solar",
    "सौर": "solar",
    "गवंडी": "mason",
    "मिस्त्री": "mason",
    "पेंटर": "painter",
    "रंगकाम": "painting",
    "शिंपी": "tailor stitching",
    "शिलाई": "tailor stitching",
    "सिलाई": "tailor stitching",
    "दर्जी": "tailor stitching",
    "नर्स": "nursing healthcare",
    "रुग्णसेवा": "nursing patient care",
    "केअरटेकर": "caregiver elder care",
    "ब्युटी": "beauty salon makeup",
    "मेहंदी": "mehendi bridal",
    "स्वयंपाक": "cooking catering chef",
    "रसोई": "cooking catering",
    "संगणक": "computer hardware",
    "सीसीटीव्ही": "cctv camera network",
    "मेकॅनिक": "automotive mechanic ev",
    "गाडी": "automotive vehicle",
    "ड्रायव्हर": "commercial driver delivery",
    "चालक": "commercial driver",
    "शेती": "agriculture drip irrigation",
    "ठिबक": "drip irrigation",
    "कुंभार": "pottery ceramic clay",
    "हातमाग": "handloom weaving embroidery",
    "योगा": "yoga wellness fitness",
}

STOP_WORDS = {
    "the", "and", "for", "with", "in", "at", "to", "of", "a", "an", "is", "are",
    "need", "looking", "experienced", "work", "job", "near", "me", "माझ्या", "जवळ",
    "शोधा", "नोकरी", "मुझे", "चाहिए", "काम", "पास",
}

CITY_TIER_MULTIPLIER = {
    "mumbai": 1.35,
    "navi mumbai": 1.30,
    "thane": 1.28,
    "bengaluru": 1.32,
    "delhi": 1.30,
    "hyderabad": 1.25,
    "pune": 1.25,
    "pimpri": 1.22,
    "nagpur": 1.10,
    "nashik": 1.10,
    "aurangabad": 1.08,
    "chhatrapati sambhajinagar": 1.08,
    "kolhapur": 1.05,
    "satara": 1.03,
    "sangli": 1.02,
    "solapur": 1.02,
    "ahmednagar": 1.02,
    "amravati": 1.01,
    "jalgaon": 1.01,
    "akola": 1.00,
    "ratnagiri": 1.03,
    "latur": 1.00,
    "nanded": 0.98,
}

BASE_DAILY_WAGE_BY_CATEGORY = {
    "Electrical": 780,
    "Solar & Inverter": 860,
    "Plumbing": 740,
    "Carpentry": 820,
    "Welding & Fabrication": 840,
    "Masonry & Tiling": 760,
    "HVAC & Refrigeration": 890,
    "Painting & Waterproofing": 690,
    "Tailoring, Boutique & Garment Craft": 720,
    "Home Healthcare, Nursing & Elder Care": 850,
    "Beauty, Salon & Bridal Styling": 820,
    "Culinary, Catering & Bakery": 780,
    "Childcare & Domestic Management": 700,
    "Computer, Networking & CCTV Tech": 900,
    "Appliance & Mobile Electronics Repair": 830,
    "Automotive & EV Mechanics": 860,
    "Handloom, Embroidery & Artisan Craft": 740,
    "Agriculture, Drip Irrigation & Nursery": 690,
    "CNC, Lathe & Industrial Machining": 940,
    "Retail Billing, Data Entry & Inventory": 730,
    "Commercial Driving, Delivery & Logistics": 800,
    "Housekeeping & Facility Sanitization": 650,
    "Photography, Videography & Event Rigging": 960,
    "Security, Fire Safety & Facility Guard": 720,
    "Pottery, Ceramic & Eco-Sculpture Craft": 760,
    "Fitness, Yoga & Physiotherapy Wellness": 920,
}

TARGET_ROLE_COMPETENCIES = {
    "Industrial Electrician": {
        "category": "Electrical",
        "required_skills": [
            "Three-Phase Wiring",
            "Motor Control & Starters",
            "MCCB & Distribution Panels",
            "Industrial Earthing & Safety",
            "PLC & Relay Basics",
            "Blueprint Reading",
        ],
        "certifications": [
            "Wireman License (PWD Maharashtra)",
            "NSDC Industrial Electrician Level 4",
        ],
        "wage_uplift_pct": 42,
    },
    "Solar PV Lead Technician": {
        "category": "Solar & Inverter",
        "required_skills": [
            "Rooftop Solar Array Mounting",
            "DC/AC Hybrid Inverter Wiring",
            "Net Metering & Surge Protection",
            "Battery Bank Commissioning",
            "Multimeter & Clamp Testing",
            "Working at Heights Safety",
        ],
        "certifications": [
            "Suryamitra Skill Council Certificate",
            "PM Surya Ghar Vendor Technician ID",
        ],
        "wage_uplift_pct": 48,
    },
    "Master Modular Carpenter": {
        "category": "Carpentry",
        "required_skills": [
            "Modular Kitchen Installation",
            "Laminate & Veneer Pressing",
            "Soft-Close Hardware Fitting",
            "Precision Measurement & 2D Layout",
            "Power Router & Edge Banding",
            "Moisture & Termite Treatment",
        ],
        "certifications": [
            "FFSC Modular Furniture Craftsman Level 4",
            "ITI Carpentry Trade Certificate",
        ],
        "wage_uplift_pct": 38,
    },
    "Commercial Plumbing Supervisor": {
        "category": "Plumbing",
        "required_skills": [
            "CPVC & UPVC Pressure Piping",
            "Concealed Diverter & Sanitaryware",
            "Hydro-Testing & Leak Diagnostics",
            "Solar Water Heater Integration",
            "Submersible Pump & Booster Setup",
            "Drainage Gradient Reading",
        ],
        "certifications": [
            "Indian Plumbing Skills Council (IPSC) Level 4",
            "Municipal Licensed Plumber Permit",
        ],
        "wage_uplift_pct": 35,
    },
    "Structural TIG/MIG Welder": {
        "category": "Welding & Fabrication",
        "required_skills": [
            "MIG & TIG Precision Welding",
            "Structural MS Gate & Truss Fabrication",
            "Stainless Steel Railing Finishing",
            "Oxy-Acetylene Cutting",
            "Weld Joint Inspection",
            "PPE & Arc Flash Safety",
        ],
        "certifications": [
            "AWS / NSDC Structural Welder Level 4",
            "Industrial Hot-Work Safety Pass",
        ],
        "wage_uplift_pct": 45,
    },
    "Master Boutique Designer & Tailor": {
        "category": "Tailoring, Boutique & Garment Craft",
        "required_skills": [
            "Blouse & Kurta Pattern Cutting",
            "Bridal Lehenga & Gown Alteration",
            "Industrial Overlock & Pico Stitching",
            "Aari & Surface Embroidery Finishing",
            "Client Measurement & Trial Fitting",
            "Boutique Order Costing",
        ],
        "certifications": [
            "AMHSSC Self-Employed Tailor Level 4",
            "Boutique Pattern Drafting Certificate",
        ],
        "wage_uplift_pct": 44,
    },
    "Senior Home Healthcare & Nursing Lead": {
        "category": "Home Healthcare, Nursing & Elder Care",
        "required_skills": [
            "Post-Operative Patient Care",
            "Vital Signs & Glucometer Monitoring",
            "Geriatric Mobility & Physiotherapy Aid",
            "Medication Schedule Management",
            "Bedside Hygiene & Wound Dressing",
            "Emergency First-Aid & CPR",
        ],
        "certifications": [
            "HSSC General Duty Assistant (GDA) Certificate",
            "Red Cross Basic Life Support & First Aid",
        ],
        "wage_uplift_pct": 40,
    },
    "IT Networking & IP Surveillance Lead": {
        "category": "Computer, Networking & CCTV Tech",
        "required_skills": [
            "IP CCTV & NVR Installation",
            "LAN Structured Cabling & Router Config",
            "Fiber Optic Splicing",
            "Biometric Attendance Setup",
            "Laptop & Desktop Chip-Level Repair",
            "Cyber-Safe NVR Remote Setup",
        ],
        "certifications": [
            "ESSCI CCTV Installation Technician Level 4",
            "Structured Cabling & Networking Credential",
        ],
        "wage_uplift_pct": 46,
    },
    "EV & Multi-Brand Master Diagnostic Tech": {
        "category": "Automotive & EV Mechanics",
        "required_skills": [
            "EV Two-Wheeler Controller & BMS Check",
            "OBD-II Engine Diagnostics",
            "Auto Electrical & Alternator Repair",
            "Four-Wheeler Brake & Suspension Overhaul",
            "High-Voltage Insulation Safety",
            "Lithium Pack Cell Balancing",
        ],
        "certifications": [
            "ASDC Electric Vehicle Service Technician Level 4",
            "High-Voltage Automotive Safety Pass",
        ],
        "wage_uplift_pct": 47,
    },
}

CAREER_LADDERS = {
    "Electrical": [
        {"stage": "Electrical Helper", "min_exp": 0, "avg_daily_wage": 500, "milestone": "Learn basic conduit layout, wire color codes, and tester safety"},
        {"stage": "Assistant Wireman", "min_exp": 1, "avg_daily_wage": 700, "milestone": "Complete residential switchboard wiring & pass Beginner Skill Assessment"},
        {"stage": "Licensed Residential Electrician", "min_exp": 3, "avg_daily_wage": 950, "milestone": "Master MCB distribution boards, inverter setup & earn Advanced badge"},
        {"stage": "Senior Industrial & Solar Supervisor", "min_exp": 6, "avg_daily_wage": 1400, "milestone": "Three-phase motor panels, solar net-metering & team supervision"},
    ],
    "Plumbing": [
        {"stage": "Plumbing Helper", "min_exp": 0, "avg_daily_wage": 480, "milestone": "Pipe threading, sealant application, and basic fixture removal"},
        {"stage": "Pipe & Sanitary Fitter", "min_exp": 1, "avg_daily_wage": 680, "milestone": "CPVC/UPVC jointing, bathroom tapware, and tank connections"},
        {"stage": "Senior Concealed Plumbing Specialist", "min_exp": 3, "avg_daily_wage": 920, "milestone": "Concealed wall mixers, pressure pumps, and hydro-leak detection"},
        {"stage": "MEP Plumbing Contractor", "min_exp": 6, "avg_daily_wage": 1350, "milestone": "Multi-storey drainage lines, blueprint estimation & crew management"},
    ],
    "Carpentry": [
        {"stage": "Woodwork Apprentice", "min_exp": 0, "avg_daily_wage": 500, "milestone": "Board cutting, sanding, plywood grading, and hand-tool accuracy"},
        {"stage": "Furniture & Door Carpenter", "min_exp": 2, "avg_daily_wage": 750, "milestone": "Door frames, locks, wardrobes, and clean laminate finishing"},
        {"stage": "Modular Interior Specialist", "min_exp": 4, "avg_daily_wage": 1050, "milestone": "Modular kitchens, telescopic channels, and laser measurements"},
        {"stage": "Turnkey Interior Foreman", "min_exp": 7, "avg_daily_wage": 1500, "milestone": "Full apartment fit-outs, client BOQ costing, and quality sign-off"},
    ],
    "Solar & Inverter": [
        {"stage": "Solar Mounting Helper", "min_exp": 0, "avg_daily_wage": 550, "milestone": "Structure anchoring, panel handling, and rooftop harness safety"},
        {"stage": "Solar DC/AC Wireman", "min_exp": 1, "avg_daily_wage": 800, "milestone": "MC4 crimping, DCDB/ACDB connections, and earthing pits"},
        {"stage": "Certified Solar PV Technician", "min_exp": 3, "avg_daily_wage": 1100, "milestone": "Hybrid inverter commissioning, string testing & fault diagnostics"},
        {"stage": "Solar EPC Site Lead", "min_exp": 5, "avg_daily_wage": 1550, "milestone": "10kW–100kW commercial arrays, DISCOM net-meter inspection"},
    ],
    "Welding & Fabrication": [
        {"stage": "Fabrication Helper", "min_exp": 0, "avg_daily_wage": 500, "milestone": "Grinding, metal cutting, rust priming, and workshop safety"},
        {"stage": "Arc Welder", "min_exp": 2, "avg_daily_wage": 780, "milestone": "MS gates, grills, roofing sheds, and clean fillet welds"},
        {"stage": "MIG / TIG Precision Welder", "min_exp": 4, "avg_daily_wage": 1100, "milestone": "SS railings, pressure joints, distortion-free sheet welding"},
        {"stage": "Fabrication Workshop Supervisor", "min_exp": 7, "avg_daily_wage": 1500, "milestone": "Structural trusses, CAD drawing fabrication & weld QA"},
    ],
}


def tokenize(text: str) -> list:
    if not text:
        return []
    cleaned = text.lower()
    for k, v in SYNONYM_MAP.items():
        cleaned = cleaned.replace(k, f" {v} ")
    tokens = re.findall(r"[a-z0-9]+", cleaned)
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 1]


def tfidf_cosine_similarity(doc_a: str, doc_b: str, corpus_docs: list = None) -> float:
    tokens_a = tokenize(doc_a)
    tokens_b = tokenize(doc_b)
    if not tokens_a or not tokens_b:
        return 0.0
    all_docs = [tokens_a, tokens_b] + ([tokenize(d) for d in corpus_docs] if corpus_docs else [])
    n_docs = len(all_docs)
    vocab = set(tokens_a) | set(tokens_b)
    idf = {}
    for term in vocab:
        df = sum(1 for d in all_docs if term in d)
        idf[term] = math.log((1 + n_docs) / (1 + df)) + 1.0

    tf_a = Counter(tokens_a)
    tf_b = Counter(tokens_b)
    vec_a = {t: (tf_a[t] / len(tokens_a)) * idf[t] for t in vocab}
    vec_b = {t: (tf_b[t] / len(tokens_b)) * idf[t] for t in vocab}

    dot = sum(vec_a[t] * vec_b[t] for t in vocab)
    norm_a = math.sqrt(sum(v * v for v in vec_a.values()))
    norm_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return round(min(1.0, dot / (norm_a * norm_b)), 4)


def haversine_km(coords1: list, coords2: list) -> float:
    """Calculates 2dsphere distance between [lng1, lat1] and [lng2, lat2] in km."""
    if not coords1 or not coords2 or len(coords1) < 2 or len(coords2) < 2:
        return 25.0
    lon1, lat1 = math.radians(float(coords1[0])), math.radians(float(coords1[1]))
    lon2, lat2 = math.radians(float(coords2[0])), math.radians(float(coords2[1]))
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(6371.0 * 2 * math.asin(math.sqrt(a)), 2)


def compute_match(worker: dict, job: dict, fair_opportunity: bool = False) -> dict:
    req_skills = [s.lower().strip() for s in job.get("requiredSkills", [])]
    worker_skills = worker.get("skills", [])
    worker_skill_names = [s.get("name", "").lower().strip() for s in worker_skills]

    # 1. Exact + token + TF-IDF skill compatibility (0-100)
    direct_hits = 0.0
    verified_bonus = 0.0
    prof_weights = {"Beginner": 0.65, "Intermediate": 0.82, "Advanced": 0.94, "Expert": 1.0}

    for req in req_skills:
        best_for_req = 0.0
        for ws in worker_skills:
            wname = ws.get("name", "").lower()
            if req == wname or req in wname or wname in req:
                prof = prof_weights.get(ws.get("proficiency", "Intermediate"), 0.8)
                ver_mult = 1.08 if ws.get("verificationType") in ("assessed", "admin_verified") else 0.92
                best_for_req = max(best_for_req, min(1.0, prof * ver_mult))
                if ws.get("verificationType") in ("assessed", "admin_verified"):
                    verified_bonus += 3.0
        if best_for_req == 0.0:
            # Check token overlap
            sim = tfidf_cosine_similarity(req, " ".join(worker_skill_names))
            best_for_req = sim * 0.85
        direct_hits += best_for_req

    base_skill_ratio = (direct_hits / len(req_skills)) if req_skills else 0.75
    text_doc_worker = f"{worker.get('category', '')} {' '.join(worker_skill_names)} {worker.get('bio', '')}"
    text_doc_job = f"{job.get('category', '')} {' '.join(req_skills)} {job.get('title', '')} {job.get('description', '')}"
    semantic_sim = tfidf_cosine_similarity(text_doc_worker, text_doc_job)
    category_bonus = 0.15 if worker.get("category") == job.get("category") else 0.0
    skill_score = min(100.0, round((base_skill_ratio * 0.72 + semantic_sim * 0.28 + category_bonus) * 100 + min(verified_bonus, 8.0), 1))

    # 2. Experience compatibility (0-100)
    req_exp = max(0, float(job.get("minExperienceYears", 1)))
    w_exp = max(0, float(worker.get("experienceYears", 0)))
    if req_exp == 0:
        exp_score = 100.0
    elif w_exp >= req_exp:
        exp_score = min(100.0, 90.0 + min(10.0, (w_exp - req_exp) * 2.5))
    else:
        exp_score = max(35.0, round((w_exp / req_exp) * 88.0, 1))

    # 3. Geospatial location compatibility (0-100)
    w_coords = worker.get("location", {}).get("coordinates", [76.5604, 18.4088])
    j_coords = job.get("location", {}).get("coordinates", [76.5604, 18.4088])
    dist_km = haversine_km(w_coords, j_coords)
    max_travel = max(5.0, float(worker.get("maxTravelKm", 25)))
    if dist_km <= 3.0:
        loc_score = 98.0
    elif dist_km <= max_travel:
        loc_score = round(max(65.0, 98.0 - (dist_km / max_travel) * 28.0), 1)
    else:
        loc_score = round(max(20.0, 65.0 - (dist_km - max_travel) * 1.2), 1)

    # 4. Availability compatibility (0-100)
    avail_status = worker.get("availabilityStatus", "available")
    avail_score = 100.0 if avail_status == "available" else (65.0 if avail_status == "part_time" else 25.0)

    # 5. Wage / Budget compatibility (0-100)
    expected_wage = float(worker.get("expectedDailyWage", 750))
    job_budget = float(job.get("dailyWageBudget", 800))
    if expected_wage <= job_budget:
        diff_ratio = (job_budget - expected_wage) / max(job_budget, 1)
        budget_score = round(min(100.0, 92.0 + (1.0 - min(diff_ratio, 0.4)) * 8.0), 1)
    else:
        over_pct = (expected_wage - job_budget) / max(job_budget, 1)
        budget_score = round(max(30.0, 92.0 - over_pct * 130.0), 1)

    overall = (
        skill_score * 0.36
        + exp_score * 0.16
        + loc_score * 0.20
        + avail_score * 0.14
        + budget_score * 0.14
    )

    # Fair Opportunity Mode: Boost assessed/verified newcomers (< 3 completed jobs) on suitable roles
    fair_boost = 0.0
    completed_jobs = int(worker.get("completedJobsCount", 0))
    assessed_count = sum(1 for s in worker_skills if s.get("verificationType") in ("assessed", "admin_verified"))
    if fair_opportunity and completed_jobs <= 2 and assessed_count >= 1 and skill_score >= 60:
        fair_boost = 9.5
        overall = min(99.0, overall + fair_boost)

    overall = round(overall, 1)

    reasons = []
    if skill_score >= 80:
        reasons.append(f"Strong skill alignment ({int(skill_score)}%) with {assessed_count} verified/assessed trade skills")
    elif skill_score >= 60:
        reasons.append(f"Relevant {worker.get('category', 'trade')} skill overlap ({int(skill_score)}%)")
    if dist_km <= 15:
        reasons.append(f"Located {dist_km} km from work site (within {int(max_travel)} km travel range)")
    else:
        reasons.append(f"Distance is {dist_km} km from site")
    if budget_score >= 85:
        reasons.append(f"Expected daily wage (₹{int(expected_wage)}) fits job budget (₹{int(job_budget)}/day)")
    if fair_boost > 0:
        reasons.append("Fair Opportunity Boost (+9.5%) applied: skill-assessed newcomer ready for early career milestone")

    return {
        "overallScore": overall,
        "distanceKm": dist_km,
        "fairOpportunityBoost": fair_boost,
        "breakdown": {
            "skillCompatibility": round(skill_score, 1),
            "experienceCompatibility": round(exp_score, 1),
            "locationCompatibility": round(loc_score, 1),
            "availabilityCompatibility": round(avail_score, 1),
            "budgetCompatibility": round(budget_score, 1),
        },
        "explanation": " · ".join(reasons),
    }


def compute_reputation(payload: dict) -> dict:
    """
    Transparent Bayesian-smoothed reputation calculator.
    New workers begin with a fair baseline (72.0/100) rather than 0, preventing cold-start exclusion.
    Unverified complaints are strictly excluded; only established dispute findings impact reliability.
    """
    reviews = payload.get("reviews", [])
    skills = payload.get("skills", [])
    completed_jobs = int(payload.get("completedJobsCount", 0))
    repeat_hires = int(payload.get("repeatHiresCount", 0))
    established_disputes = int(payload.get("establishedDisputesCount", 0))

    # Bayesian prior: m = 2 virtual reviews at 3.75 / 5.0 (75%) so new workers start fairly around 72-76
    prior_m = 2.0
    prior_rating = 3.75

    def bayesian_dim(key: str) -> float:
        vals = [float(r.get(key, 4.0)) for r in reviews if r.get(key) is not None]
        n = len(vals)
        smoothed = (prior_m * prior_rating + sum(vals)) / (prior_m + n)
        return round(min(100.0, (smoothed / 5.0) * 100.0), 1)

    quality_score = bayesian_dim("quality")
    punctuality_score = bayesian_dim("punctuality")
    reliability_raw = bayesian_dim("reliability")
    satisfaction_score = bayesian_dim("satisfaction")

    # Verified skill proficiency score
    prof_map = {"Beginner": 65.0, "Intermediate": 78.0, "Advanced": 90.0, "Expert": 98.0}
    if skills:
        s_vals = []
        for s in skills:
            base = prof_map.get(s.get("proficiency", "Intermediate"), 75.0)
            if s.get("verificationType") == "admin_verified":
                base = min(100.0, base + 5.0)
            elif s.get("verificationType") == "assessed":
                base = min(100.0, base + 3.0)
            else:
                base = base * 0.88
            s_vals.append(base)
        skill_prof_score = round(sum(s_vals) / len(s_vals), 1)
    else:
        skill_prof_score = 68.0

    # Repeat hire & completion bonus, minus ONLY established dispute findings
    completion_bonus = min(6.0, completed_jobs * 0.45)
    repeat_bonus = min(5.0, repeat_hires * 1.25)
    dispute_penalty = established_disputes * 6.5

    reliability_score = round(max(30.0, min(100.0, reliability_raw + repeat_bonus * 0.6 - dispute_penalty)), 1)

    overall = (
        quality_score * 0.26
        + reliability_score * 0.24
        + punctuality_score * 0.18
        + satisfaction_score * 0.16
        + skill_prof_score * 0.16
        + completion_bonus * 0.5
        + repeat_bonus * 0.5
        - dispute_penalty * 0.5
    )
    overall = round(max(40.0, min(99.5, overall)), 1)

    is_new_worker = len(reviews) == 0
    explanation = (
        "Fair-Start Baseline active: New worker initialized with Bayesian neutral prior (no penalty for zero reviews) plus verified skill weight."
        if is_new_worker
        else f"Calculated across {len(reviews)} verified project review(s), {completed_jobs} completed job(s), {repeat_hires} repeat hire(s), and {len(skills)} recorded skill(s). Unverified complaints are excluded."
    )

    return {
        "overallScore": overall,
        "qualityScore": quality_score,
        "reliabilityScore": reliability_score,
        "punctualityScore": punctuality_score,
        "satisfactionScore": satisfaction_score,
        "skillProficiencyScore": skill_prof_score,
        "isFairStartBaseline": is_new_worker,
        "explanation": explanation,
    }


def analyze_skill_gap(payload: dict) -> dict:
    worker_skills = payload.get("workerSkills", [])
    target_role = (payload.get("targetRole") or "Industrial Electrician").strip()
    spec = TARGET_ROLE_COMPETENCIES.get(target_role)
    if not spec:
        # Support ANY unrestricted / custom target role dynamically!
        spec = {
            "category": target_role,
            "required_skills": [
                f"{target_role} Core Execution",
                f"{target_role} Precision Tools & Measurement",
                f"{target_role} Quality & Safety Compliance",
                "Client Requirement & Cost Estimation",
                "Advanced Troubleshooting & Finishing",
                "Team Coordination & Site Hygiene",
            ],
            "certifications": [
                f"NSDC / Skill India {target_role} Competency Level 4",
                "Verified Workplace Safety & Quality Credential",
            ],
            "wage_uplift_pct": 38,
        }

    existing = []
    weak = []
    missing = []

    for req in spec["required_skills"]:
        req_low = req.lower()
        matched_ws = None
        for ws in worker_skills:
            wname = ws.get("name", "").lower()
            if req_low in wname or wname in req_low or tfidf_cosine_similarity(req_low, wname) >= 0.45:
                matched_ws = ws
                break
        if matched_ws:
            if matched_ws.get("proficiency") == "Beginner" or matched_ws.get("verificationType") == "self_declared":
                weak.append({
                    "skill": req,
                    "currentLevel": matched_ws.get("proficiency", "Beginner"),
                    "verificationType": matched_ws.get("verificationType", "self_declared"),
                    "action": "Take KaushalSetu Skill Assessment or complete practical module to verify proficiency",
                })
            else:
                existing.append({
                    "skill": req,
                    "proficiency": matched_ws.get("proficiency", "Intermediate"),
                    "verificationType": matched_ws.get("verificationType", "assessed"),
                })
        else:
            missing.append(req)

    readiness_pct = round(((len(existing) + 0.5 * len(weak)) / max(1, len(spec["required_skills"]))) * 100, 1)

    roadmap = []
    step_num = 1
    for w in weak:
        roadmap.append({
            "step": step_num,
            "title": f"Upgrade & Verify: {w['skill']}",
            "duration": "1–2 Weeks",
            "type": "Assessment & Practice",
            "detail": w["action"],
        })
        step_num += 1
    for m in missing:
        roadmap.append({
            "step": step_num,
            "title": f"Learn Core Competency: {m}",
            "duration": "2–3 Weeks",
            "type": "Hands-on Module",
            "detail": f"Complete practical safety & field exercises in {m} via Community Learning Center.",
        })
        step_num += 1
    for cert in spec["certifications"]:
        roadmap.append({
            "step": step_num,
            "title": f"Credential Milestone: {cert}",
            "duration": "4 Weeks",
            "type": "Certification",
            "detail": "Upload certificate to Digital Skill Passport for Admin verification.",
        })
        step_num += 1

    return {
        "targetRole": target_role,
        "category": spec["category"],
        "readinessPercentage": readiness_pct,
        "estimatedWageUpliftPct": spec["wage_uplift_pct"],
        "existingSkills": existing,
        "weakSkills": weak,
        "missingSkills": missing,
        "requiredCertifications": spec["certifications"],
        "learningRoadmap": roadmap,
    }


def recommend_wage(payload: dict) -> dict:
    category = payload.get("category", "Electrical")
    city = (payload.get("city") or "Latur").strip().lower()
    exp_years = float(payload.get("experienceYears", 2))
    skill_level = payload.get("skillLevel", "Intermediate")
    complexity = payload.get("complexity", "Standard")
    duration_days = max(1, int(payload.get("durationDays", 1)))

    base = BASE_DAILY_WAGE_BY_CATEGORY.get(category, 750)
    city_mult = 1.0
    for c_name, mult in CITY_TIER_MULTIPLIER.items():
        if c_name in city:
            city_mult = mult
            break

    level_mult = {"Beginner": 0.82, "Intermediate": 1.0, "Advanced": 1.22, "Expert": 1.42}.get(skill_level, 1.0)
    comp_mult = {"Simple": 0.9, "Standard": 1.0, "Complex": 1.20, "Industrial / Hazardous": 1.35}.get(complexity, 1.0)
    exp_mult = min(1.30, 1.0 + exp_years * 0.035)

    mid_daily = base * city_mult * level_mult * comp_mult * exp_mult
    min_daily = int(round((mid_daily * 0.90) / 10.0) * 10)
    max_daily = int(round((mid_daily * 1.14) / 10.0) * 10)

    return {
        "category": category,
        "city": payload.get("city", "Latur"),
        "skillLevel": skill_level,
        "complexity": complexity,
        "durationDays": duration_days,
        "recommendedDailyMin": min_daily,
        "recommendedDailyMax": max_daily,
        "estimatedTotalMin": min_daily * duration_days,
        "estimatedTotalMax": max_daily * duration_days,
        "factorsApplied": {
            "baseCategoryRate": base,
            "locationIndex": round(city_mult, 2),
            "proficiencyMultiplier": round(level_mult, 2),
            "complexityMultiplier": round(comp_mult, 2),
        },
        "disclaimer": "Estimated fair wage range based on regional trade benchmarks, skill level, and complexity. Not a guaranteed or fixed statutory price.",
    }


def recommend_career(payload: dict) -> dict:
    category = (payload.get("category") or "Electrical").strip()
    exp_years = float(payload.get("experienceYears", 1))
    completed = int(payload.get("completedJobsCount", 0))
    assessed_skills = int(payload.get("assessedSkillsCount", 0))

    base_wage = BASE_DAILY_WAGE_BY_CATEGORY.get(category, 760)
    ladder = CAREER_LADDERS.get(category) or [
        {"stage": f"{category} Trainee / Assistant", "min_exp": 0, "avg_daily_wage": int(round(base_wage * 0.68 / 10) * 10), "milestone": f"Master foundational {category.lower()} tools, hygiene, and safety standards"},
        {"stage": f"Skilled {category} Practitioner", "min_exp": 1, "avg_daily_wage": base_wage, "milestone": f"Deliver independent {category.lower()} assignments and pass Skill Assessment"},
        {"stage": f"Senior {category} Specialist", "min_exp": 3, "avg_daily_wage": int(round(base_wage * 1.32 / 10) * 10), "milestone": f"Handle complex custom orders, precision diagnostics, and earn verified reviews"},
        {"stage": f"Master {category} Lead / Entrepreneur", "min_exp": 6, "avg_daily_wage": int(round(base_wage * 1.78 / 10) * 10), "milestone": f"Manage multi-client contracts, mentor trainees, and lead turnkey {category.lower()} projects"},
    ]

    current_idx = 0
    if exp_years >= 6 and assessed_skills >= 2:
        current_idx = 3
    elif exp_years >= 3 or (exp_years >= 2 and assessed_skills >= 2):
        current_idx = 2
    elif exp_years >= 1 or completed >= 2 or assessed_skills >= 1:
        current_idx = 1

    next_idx = min(len(ladder) - 1, current_idx + 1)
    return {
        "category": category,
        "currentStageIndex": current_idx,
        "currentStage": ladder[current_idx]["stage"],
        "nextStage": ladder[next_idx]["stage"],
        "projectedDailyWageGain": max(0, ladder[next_idx]["avg_daily_wage"] - ladder[current_idx]["avg_daily_wage"]),
        "pathway": ladder,
    }


def detect_fraud(payload: dict) -> list:
    jobs = payload.get("jobs", [])
    reviews = payload.get("reviews", [])
    users = payload.get("users", [])
    alerts = []

    # 1. Statistical Z-score & threshold check on job daily wages
    wages = [float(j.get("dailyWageBudget", 0)) for j in jobs if j.get("dailyWageBudget")]
    mean_w = sum(wages) / len(wages) if wages else 800.0
    variance = sum((w - mean_w) ** 2 for w in wages) / len(wages) if len(wages) > 1 else 40000.0
    std_w = max(100.0, math.sqrt(variance))

    for j in jobs:
        w = float(j.get("dailyWageBudget", 0))
        z = abs(w - mean_w) / std_w
        if w < 250 or w > 4500 or z > 2.6:
            alerts.append({
                "targetType": "job",
                "targetId": j.get("_id"),
                "severity": "high" if (w < 200 or w > 5000) else "medium",
                "anomalyScore": round(min(99.0, 55.0 + z * 12.0), 1),
                "reason": f"Abnormal daily wage budget (₹{int(w)}/day, Z-score {round(z, 2)}) deviates sharply from trade norm (₹{int(mean_w)}/day). Flagged for manual admin review.",
            })

    # 2. Repeated reviewer-worker pair pattern
    pair_counts = Counter((r.get("reviewerId"), r.get("workerId")) for r in reviews)
    for (rev_id, wrk_id), count in pair_counts.items():
        if count >= 3:
            alerts.append({
                "targetType": "review_pattern",
                "targetId": wrk_id,
                "severity": "medium",
                "anomalyScore": round(min(95.0, 60.0 + count * 8.0), 1),
                "reason": f"Repeated rating cluster: {count} reviews from the same employer account. Queued for admin verification (no automatic penalty applied).",
            })

    # 3. Duplicate phone fingerprint across accounts
    phone_map = {}
    for u in users:
        ph = (u.get("phone") or "").strip()
        if ph:
            phone_map.setdefault(ph, []).append(u.get("_id"))
    for ph, uids in phone_map.items():
        if len(uids) > 1:
            alerts.append({
                "targetType": "user",
                "targetId": uids[-1],
                "severity": "high",
                "anomalyScore": 88.5,
                "reason": f"Duplicate contact phone number shared across {len(uids)} accounts. Requires admin identity check.",
            })

    return alerts


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"error": "Empty payload"}))
        return
    req = json.loads(raw)
    action = req.get("action")
    data = req.get("data", {})

    if action == "match_single":
        res = compute_match(data["worker"], data["job"], bool(data.get("fairOpportunity", False)))
    elif action == "match_batch_workers":
        job = data["job"]
        fair = bool(data.get("fairOpportunity", False))
        results = []
        for w in data.get("workers", []):
            m = compute_match(w, job, fair)
            results.append({"workerId": w.get("_id"), **m})
        results.sort(key=lambda x: x["overallScore"], reverse=True)
        res = {"matches": results}
    elif action == "match_batch_jobs":
        worker = data["worker"]
        fair = bool(data.get("fairOpportunity", False))
        results = []
        for j in data.get("jobs", []):
            m = compute_match(worker, j, fair)
            results.append({"jobId": j.get("_id"), **m})
        results.sort(key=lambda x: x["overallScore"], reverse=True)
        res = {"matches": results}
    elif action == "reputation":
        res = compute_reputation(data)
    elif action == "skill_gap":
        res = analyze_skill_gap(data)
    elif action == "wage":
        res = recommend_wage(data)
    elif action == "career":
        res = recommend_career(data)
    elif action == "fraud":
        res = {"alerts": detect_fraud(data)}
    else:
        res = {"error": f"Unknown action: {action}"}

    print(json.dumps(res))


if __name__ == "__main__":
    main()
