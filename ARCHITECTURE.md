# KaushalSetu — System Architecture, MongoDB 30-Collection Schema & Execution Guide

## 1. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     REACT + VITE + TAILWIND FRONTEND                         │
│  • Role Dashboards (Worker, Employer, Admin) + Multilingual UI (EN/MR/HI)    │
│  • Voice Search (Web Speech API mr-IN/hi-IN/en-IN) + Leaflet OSM Geo-Map     │
│  • Recharts Live Aggregations + jsPDF Skill Passport / Agreement / Certs     │
└───────────────────────────────┬──────────────────────┬───────────────────────┘
                                │ REST (/api/*) + JWT  │ WebSockets (/ws)
                                ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 UNIFIED API GATEWAY & REAL-TIME WS SERVER                    │
│  • JWT Auth + bcrypt Password Hashing + Role-Based Access Control (RBAC)     │
│  • Rate Limiting, Input Validation, Audit Logging & Privacy Geo-Fuzzing      │
│  • Optional Gemini Service Layer (gemini-3.8-flash) with Local Fallback      │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │ stdin/stdout IPC                     │ Official Driver
                    ▼                                      ▼
┌────────────────────────────────────────┐  ┌──────────────────────────────────┐
│   PYTHON 3.10 AI / ML ENGINE           │  │   MONGODB PERSISTENCE LAYER      │
│   (/backend/ai_engine.py & FastAPI)    │  │   • 30 Structured Collections    │
│  • TF-IDF + Cosine Skill-Job Matching  │  │   • MongoDB 24-hex ObjectIds     │
│  • Haversine 2dsphere Geo Scoring      │  │   • 2dsphere Geospatial Indexes  │
│  • Bayesian Fair-Start Reputation      │  │   • Unique Compound Constraints  │
│  • Skill Gap Graph & Career Pathways   │  │   • Connects to MONGODB_URI or   │
│  • Multivariate Fair Wage Estimator    │  │     Persistent Disk BSON Store   │
│  • Z-Score & Rule Fraud Detection      │  └──────────────────────────────────┘
└────────────────────────────────────────┘
```

## 2. MongoDB 30-Collection Database Design

All 30 collections use MongoDB `ObjectId` (`_id`), UTC ISO timestamps, strict validation, and compound/geospatial indexes:

1. **`users`** — `{ _id, name, email (unique), passwordHash, phone, role ('worker'|'employer'|'admin'), preferredLanguage, status, isDemo, createdAt }`
2. **`worker_profiles`** — `{ _id, userId (ref), category, headline, bio, experienceYears, expectedDailyWage, maxTravelKm, city, exactAddress (private), location (GeoJSON Point, 2dsphere), publicLocation (fuzzed ~800m), availabilityStatus, emergencyContact, portfolioItems[], isDemo }`
3. **`employer_profiles`** — `{ _id, userId (ref), organizationName, employerType ('Individual'|'Contractor'|'Company'), city, gstNumber, verifiedBusiness, location, isDemo }`
4. **`skills`** — `{ _id, name (unique), category, translations: { mr, hi } }`
5. **`worker_skills`** — `{ _id, workerId (ref), name, category, proficiency ('Beginner'|'Intermediate'|'Advanced'|'Expert'), verificationType ('self_declared'|'assessed'|'admin_verified'), assessmentScore, updatedAt }`
6. **`skill_assessments`** — `{ _id, category, title, skillName, durationMinutes, passingScore }`
7. **`assessment_questions`** — `{ _id, assessmentId (ref), questionText, scenarioContext, options[], correctIndex, difficultyWeight, explanation }`
8. **`assessment_results`** — `{ _id, workerId (ref), assessmentId (ref), score, proficiencyAwarded, answers[], completedAt }`
9. **`certificates`** — `{ _id, workerId (ref), title, issuingAuthority, issueYear, fileDataUrl, status ('pending'|'approved'|'rejected'), adminNotes, reviewedBy, createdAt }`
10. **`jobs`** — `{ _id, employerId (ref), title, category, description, requiredSkills[], minExperienceYears, dailyWageBudget, durationDays, city, location (GeoJSON Point, 2dsphere), isEmergency, status ('open'|'in_progress'|'completed'|'closed'), responsibilities[], deadline, createdAt }`
11. **`job_applications`** — `{ _id, jobId (ref), workerId (ref), coverNote, proposedDailyWage, status ('applied'|'shortlisted'|'accepted'|'rejected'), aiMatchScore, aiBreakdown, createdAt }` *(Unique compound index: `jobId + workerId`)*
12. **`hiring_requests`** — `{ _id, employerId (ref), workerId (ref), jobId (optional ref), projectTitle, offeredDailyWage, durationDays, isRepeatHire, meetingScheduledAt, status ('pending'|'accepted'|'declined'), message, createdAt }`
13. **`work_projects`** — `{ _id, jobId, employerId, workerId, title, category, agreedDailyWage, durationDays, stage ('Requested'|'Accepted'|'In Progress'|'Submitted for Review'|'Completed'), city, completionConfirmedAt, completionCertificateCode, createdAt }`
14. **`project_updates`** — `{ _id, projectId (ref), actorId (ref), stage, note, createdAt }`
15. **`reviews`** — `{ _id, projectId (ref), workerId (ref), reviewerId (ref), quality, punctuality, reliability, satisfaction, wouldRehire, comment, createdAt }` *(Unique compound index: `projectId + reviewerId`)*
16. **`reputation_scores`** — `{ _id, workerId (unique ref), overallScore, qualityScore, reliabilityScore, punctualityScore, satisfactionScore, skillProficiencyScore, isFairStartBaseline, explanation, history: [{ date, score, event }], updatedAt }`
17. **`worker_availability`** — `{ _id, workerId (ref), availableDates[], unavailableDates[], workingHours: { start, end }, updatedAt }`
18. **`messages`** — `{ _id, senderId (ref), receiverId (ref), projectId, content, read, createdAt }`
19. **`notifications`** — `{ _id, userId (ref), type, title, body, link, read, createdAt }`
20. **`reports`** — `{ _id, reporterId (ref), targetType, targetId, category, description, status ('pending'|'reviewed'|'dismissed'), createdAt }`
21. **`disputes`** — `{ _id, projectId (ref), raisedById (ref), againstId (ref), reason, evidenceNotes, status ('open'|'investigating'|'resolved_no_fault'|'established_finding'), resolutionSummary, createdAt }`
22. **`work_agreements`** — `{ _id, projectId (ref), employerId, workerId, workDescription, dailyWage, durationDays, responsibilities[], terms[], employerAccepted, workerAccepted, agreementCode, createdAt }`
23. **`learning_resources`** — `{ _id, title, category, targetSkill, language ('English'|'Marathi'|'Hindi'), provider, durationHours, format, summary, url }`
24. **`ai_recommendations`** — `{ _id, userId, recommendationType, inputSummary, outputSummary, score, createdAt }`
25. **`saved_workers`** — `{ _id, employerId (ref), workerId (ref), notes, createdAt }`
26. **`saved_jobs`** — `{ _id, workerId (ref), jobId (ref), createdAt }`
27. **`fraud_alerts`** — `{ _id, targetType, targetId, severity, anomalyScore, reason, status ('open'|'investigating'|'dismissed'|'actioned'), adminNotes, createdAt }`
28. **`wage_recommendations`** — `{ _id, category, city, skillLevel, recommendedDailyMin, recommendedDailyMax, createdAt }`
29. **`skill_passports`** — `{ _id, workerId (unique ref), passportCode (unique), qrVerificationUrl, issuedAt, lastSyncedAt }`
30. **`audit_logs`** — `{ _id, actorId, actorRole, action, targetCollection, targetId, justification, createdAt }`

## 3. Running Locally & In Cloud Preview

### Option A: Unified Full-Stack Runtime (Port 3000 + Python 3.10 AI Engine + MongoDB)
```bash
npm install
cp .env.example .env   # Optionally add MONGODB_URI=mongodb://localhost:27017
npm run dev            # Starts Express + WebSocket + Python AI Engine + Vite on http://localhost:3000
```

### Option B: Standalone Python FastAPI Backend + MongoDB Community Server
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
