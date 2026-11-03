# KaushalSetu — AI-Powered Skilled Worker Hiring & Reputation Intelligence System

KaushalSetu is a digital employment, skill verification, and transparent reputation ecosystem built for skilled and semi-skilled professionals—both women and men—across India. Rather than operating as a conventional resume job board, KaushalSetu enables workers in **any technical, artisan, healthcare, culinary, digital, agricultural, wellness, or construction domain** to prove practical competency, carry a QR-verifiable Digital Skill Passport, receive explainable job matches, and negotiate fair regional wages.

### Workforce & Open-Skill Highlights
- **500 Active Skilled Workers (Balanced Women & Men)**: Pre-populated across **18 Maharashtra cities** with spread-out geospatial coordinates, unique contact records, QR-verifiable Digital Skill Passports, and Fair-Opportunity newcomers alongside experienced master specialists.
- **Unrestricted Skills & Trade Domains ("Not Limited")**: Ships with **26+ built-in trade domains** (Tailoring & Boutique Craft, Home Healthcare & Nursing, Beauty & Bridal Styling, Culinary & Bakery, Childcare, Computer/Networking & CCTV, Electronics Repair, Automotive & EV Mechanics, Handloom & Artisan Craft, Agriculture & Drip Irrigation, CNC Machining, Retail GST Billing, Commercial Driving, Housekeeping, Photography & Event Rigging, Pottery, Fitness & Yoga, Electrical, Solar, Plumbing, Carpentry, Welding, Masonry, HVAC, Waterproofing) **plus open combobox inputs** allowing Workers and Employers to enter **any custom trade category, custom skill, custom city, or custom target career role** with dynamic AI indexing and matching.

---

## Core Capabilities

### 4 Role-Based Portals
1. **Skilled Worker Portal**: Multilingual onboarding (`English`, `मराठी`, `हिन्दी`), AI Profile Builder (voice/text), Technical Scenario Skill Assessments, Skill Gap Analyzer, Career Growth Ladder, Fair Wage Estimator, Availability Calendar, Project Milestone Tracker, Reputation Breakdown, and downloadable **Digital Skill Passport** + **Work Completion Certificates** + **Bilateral Work Agreements** (PDF).
2. **Employer / Contractor Portal**: 1-Sentence AI Job Description Generator, Smart Shortlisting & Side-by-Side Candidate Comparison Matrix across 500+ workers, **Fair Opportunity Mode** (surfaces assessed newcomers with zero prior reviews), Emergency Hiring Broadcast (WebSockets), Repeat Hiring, Milestone Verification, and Verified Review Submission.
3. **Governance Admin Console**: Searchable & paginated 500+ User Directory, Certificate & Skill Verification Queue, Z-Score & Rule-Based Fraud Investigation Queue (never auto-bans accounts without human review), Impartial Dispute Resolution (never penalizes workers for unverified allegations), Live Supply-vs-Demand Recharts Telemetry, and Immutable Audit Logs.
4. **Contextual AI Platform Assistant**: Multilingual guidance drawer tailored to the active user's role, skills, reputation sub-scores, or hiring needs.

### 10 Working AI & ML Engines (`/backend/ai_engine.py`)
1. **TF-IDF + Weighted Multi-Criteria Job Matching (0–100%)** with 5-dimension compatibility breakdown and natural-language explainability across arbitrary custom skills.
2. **Bayesian Fair-Start Dynamic Reputation System** (~72/100 baseline for assessed newcomers so zero-review workers are not buried at 0.0★).
3. **Three-Tier Skill Verification Engine** (`self_declared` → `assessed` → `admin_verified`).
4. **Target-Role Skill Gap Graph Analyzer** with dynamic roadmap synthesis for custom target roles.
5. **Voice/Text AI Professional Profile & Resume Structurer**.
6. **AI Structured Job Description & Safety Checklist Generator**.
7. **Multivariate Regional Fair Wage Estimator** (calibrated across 26+ domains, custom skill fallbacks, and 20+ urban/semi-urban tiers with non-guaranteed market guidance disclaimer).
8. **Statistical Z-Score & Graph Cluster Anomaly / Fraud Detector**.
9. **Dynamic 4-Stage Career Progression & Wage Uplift Engine**.
10. **Smart Candidate Shortlisting & Multi-Candidate Comparison Matrix**.

---

## MongoDB 30-Collection Architecture

KaushalSetu implements all **30 collections** (`users`, `worker_profiles`, `employer_profiles`, `skills`, `worker_skills`, `skill_assessments`, `assessment_questions`, `assessment_results`, `certificates`, `jobs`, `job_applications`, `hiring_requests`, `work_projects`, `project_updates`, `reviews`, `reputation_scores`, `worker_availability`, `messages`, `notifications`, `reports`, `disputes`, `work_agreements`, `learning_resources`, `ai_recommendations`, `saved_workers`, `saved_jobs`, `fraud_alerts`, `wage_recommendations`, `skill_passports`, `audit_logs`) with 24-hex MongoDB `ObjectId` keys, `2dsphere` geospatial coordinates (fuzzed by ~700–850m on public maps for residential privacy), and unique compound constraints.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the complete system architecture diagram and collection schema specifications.

---

## Demo Accounts (Clearly Labeled `DEMO` in UI)

| Role | Account Name | Email | Password | Highlights |
| :--- | :--- | :--- | :--- | :--- |
| **Worker (Woman Artisan)** | Sunita Shinde | `sunita.shinde@demo.kaushalsetu.in` | `Demo@123` | Master Boutique Tailor & Embroidery · Pune · 93.2 Trust · Assessed Specialist |
| **Worker (Experienced)** | Sanjay Kulkarni | `sanjay.kulkarni@demo.kaushalsetu.in` | `Demo@123` | PWD Certified Electrician · Latur · 91.4 Trust · QR Skill Passport `KS-MH-2026-1041` |
| **Worker (Woman Newcomer)** | Priya Jadhav | `priya.jadhav@demo.kaushalsetu.in` | `Demo@123` | Solar Technician · 0 Reviews · 74.8 Bayesian Fair-Start Score |
| **Employer / Contractor** | Vikram Deshmukh | `vikram.deshmukh@demo.kaushalsetu.in` | `Demo@123` | Deshmukh Infra & Electrical Works · Active Jobs, Projects & Candidate Matrix |
| **Platform Admin** | Aarti Kulkarni | `admin@kaushalsetu.in` | `Admin@123` | 500+ User Governance, Fraud Queue, Dispute Resolution & Demand Analytics |

---

## Terminal Commands to Run Locally

### Mode A: Unified Full-Stack Application (Frontend + REST API + WebSockets + Python AI Engine)

```bash
# 1. Install Node.js dependencies
npm install

# 2. Configure environment variables (optional: set MONGODB_URI for local MongoDB Compass / Atlas)
cp .env.example .env

# 3. Verify Python 3 AI Engine
python3 --version

# 4. Start full-stack server on http://localhost:3000
npm run dev
```

To build and run in production mode:
```bash
npm run build
NODE_ENV=production npm start
```

### Mode B: Inspecting with MongoDB Community Server & MongoDB Compass + FastAPI Reference Backend

```bash
# 1. Start local MongoDB Community Server (default port 27017)
mongod --dbpath ~/data/db

# 2. Connect MongoDB Compass to:
#    mongodb://localhost:27017/kaushalsetu

# 3. (Optional) Create Python virtual environment and install FastAPI + ML stack
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 4. Seed MongoDB collections & indexes directly via PyMongo
python scripts/seed_db.py

# 5. Launch standalone FastAPI OpenAPI server on http://localhost:8000/docs
uvicorn app.main:app --reload --port 8000
```
