"""
KaushalSetu — MongoDB Compass Seeder Script (PyMongo)
Creates indexes (including 2dsphere geospatial and unique constraints) across
all 30 collections and seeds 500 skilled workers (Men & Women) across 26+ unrestricted
trade domains, plus demo Employer, Admin, Open Jobs, and Audit Logs.

Usage:
    python backend/scripts/seed_db.py
"""

import math
import os
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient, GEOSPHERE, ASCENDING
from passlib.context import CryptContext

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "kaushalsetu")

ALL_COLLECTIONS = [
    "users",
    "worker_profiles",
    "employer_profiles",
    "skills",
    "worker_skills",
    "skill_assessments",
    "assessment_questions",
    "assessment_results",
    "certificates",
    "jobs",
    "job_applications",
    "hiring_requests",
    "work_projects",
    "project_updates",
    "reviews",
    "reputation_scores",
    "worker_availability",
    "messages",
    "notifications",
    "reports",
    "disputes",
    "work_agreements",
    "learning_resources",
    "ai_recommendations",
    "saved_workers",
    "saved_jobs",
    "fraud_alerts",
    "wage_recommendations",
    "skill_passports",
    "audit_logs",
]

FEMALE_FIRST = [
    "Sunita", "Anjali", "Snehal", "Kavita", "Vandana", "Savita", "Rekha", "Meena", "Pooja", "Swati",
    "Rupali", "Vaishali", "Pallavi", "Archana", "Jyoti", "Shubhangi", "Asha", "Lata", "Manisha", "yogita",
    "Neha", "komal", "Prachi", "Bhagyashree", "Nilima", "Smita", "Ujwala", "Sharda", "Rohini", "Tejaswini",
]

MALE_FIRST = [
    "Sanjay", "Ramesh", "Rajesh", "Ganesh", "Mahesh", "Suresh", "Prakash", "Nitin", "Sachin", "Amol",
    "Santosh", "kiran", "Dattatray", "Somnath", "Vikas", "Rohan", "Tushar", "pravin", "Deepak", "swapnil",
    "Mangesh", "Nilesh", "Yogesh", "balaji", "Akshay", "Sagar", "Omkar", "avinash", "Shrikant", "Vinod",
]

LAST_NAMES = [
    "Kulkarni", "Shinde", "Pawar", "Jadhav", "Gaikwad", "Deshmukh", "Chavan", "More", "Kadam", "Bhosale",
    "Mane", "Sawant", "Patil", "Salunkhe", "Lokhande", "Kamble", "Shaikh", "Ansari", "Gायकवाड", "Sutar",
    "kumbhar", "joshi", "Deshpande", "Ingle", "wagh", "Kale", "Munde", "Thorat", "Ghorpade", "Nikam",
]

CITIES = [
    ("Latur", 76.5604, 18.4088),
    ("Pune", 73.8567, 18.5204),
    ("Mumbai", 72.8777, 19.0760),
    ("Solapur", 75.9064, 17.6599),
    ("Nanded", 77.3210, 19.1383),
    ("Chhatrapati Sambhajinagar", 75.3433, 19.8762),
    ("Nashik", 73.7898, 19.9975),
    ("Nagpur", 79.0882, 21.1458),
    ("Kolhapur", 74.2433, 16.7050),
    ("Satara", 74.0183, 17.6805),
    ("Sangli", 74.5815, 16.8524),
    ("Dharashiv", 76.0400, 18.1818),
    ("Beed", 75.7600, 18.9891),
    ("Parbhani", 76.7748, 19.2608),
    ("Thane", 72.9781, 19.2183),
    ("Navi Mumbai", 73.0297, 19.0330),
    ("Jalgaon", 75.5626, 21.0077),
    ("Akola", 77.0082, 20.7002),
]

TRADES = [
    ("Tailoring, Boutique & Garment Craft", 720, ["Bridal Blouse Cutting", "Pico-Fall & Interlock", "Boutique Pattern Drafting", "Aari & Zardozi Work"]),
    ("Home Healthcare, Nursing & Elder Care", 880, ["Vital Signs & BP Monitoring", "Post-Surgery Patient Care", "Elder Mobility Support", "Diabetic Insulin Assistance"]),
    ("Beauty, Salon & Bridal Styling", 850, ["HD Bridal Makeup", "Mehendi Artistry", "Hair Keratin & Styling", "Organic Facial Care"]),
    ("Culinary, Catering & Bakery", 780, ["Bulk Maharashtrian Catering", "Artisan Cake & Bakery", "Tiffin Service Hygiene", "Tandoor & Banquet Prep"]),
    ("Childcare & Domestic Management", 650, ["Infant & Toddler Safety", "Nutritious Meal Prep", "Early Learning Play", "Household Hygiene"]),
    ("Computer, Networking & CCTV Tech", 920, ["IP PoE CCTV Setup", "CAT6 LAN Termination", "Laptop OS & SSD Upgrade", "Wi-Fi Mesh Configuration"]),
    ("Appliance & Mobile Electronics Repair", 860, ["Smartphone PCB Soldering", "Washing Machine Drum Repair", "RO Purifier Servicing", "LED TV Backlight Repair"]),
    ("Automotive & EV Mechanics", 920, ["EV Battery BMS Diagnostics", "Two-Wheeler Fuel Injection", "OBD2 Car Scanning", "Brake & Clutch Overhaul"]),
    ("Handloom, Embroidery & Artisan Craft", 760, ["Paithani Handloom Weaving", "Solapuri Jacquard Weaving", "Mirror & Folk Embroidery", "Natural Dyeing"]),
    ("Agriculture, Drip Irrigation & Nursery", 680, ["Drip Irrigation Layout", "Polyhouse Crop Care", "Fruit Tree Grafting", "Vermicompost Production"]),
    ("CNC, Lathe & Industrial Machining", 1020, ["CNC Turning G-Code", "Precision Vernier & Micrometer", "Lathe Thread Cutting", "Milling Fixture Setup"]),
    ("Retail Billing, Data Entry & Inventory", 700, ["Tally Prime GST Billing", "Barcode POS Inventory", "Marathi/English Typing", "Stock Reconciliation"]),
    ("Commercial Driving, Delivery & Logistics", 820, ["Light Commercial Vehicle", "Cold-Chain Route Delivery", "Defensive Highway Driving", "Digital POD Dispatch"]),
    ("Housekeeping & Facility Sanitization", 600, ["Hospital-Grade Sanitization", "Floor Scrubber Machine", "Deep Sofa Shampooing", "Eco Waste Segregation"]),
    ("Photography, Videography & Event Rigging", 1100, ["Candid Event Photography", "4K Gimbal Videography", "LED Stage Truss Rigging", "Live Audio Mixing"]),
    ("Security, Fire Safety & Facility Guard", 720, ["Fire Extinguisher Drill", "Visitor Access Control", "CCTV Control Room", "Emergency Evacuation"]),
    ("Pottery, Ceramic & Eco-Sculpture Craft", 740, ["Terracotta Wheel Throwing", "Eco Shadu Clay Idol Craft", "Ceramic Glaze Firing", "Architectural Terracotta"]),
    ("Fitness, Yoga & Physiotherapy Wellness", 950, ["Therapeutic Yoga", "Post-Injury Rehab Exercise", "Prenatal Mobility Coaching", "Senior Balance Training"]),
    ("Electrical", 900, ["Concealed Conduit Wiring", "Three-Phase Wiring", "MCB Distribution Panel", "Earth Pit & ELCB Testing"]),
    ("Solar & Inverter", 920, ["Solar Rooftop PV Mounting", "Hybrid Inverter Setup", "DC String Crimping", "Net-Metering Commissioning"]),
    ("Plumbing", 820, ["CPVC & UPVC Piping", "Concealed Diverter Fitting", "Pressure Pump Setup", "Solar Water Heater Piping"]),
    ("Carpentry", 900, ["Modular Kitchen Assembly", "Marine Plywood Wardrobe", "Soft-Close Hettich Hardware", "Flush Door Framing"]),
    ("Welding & Fabrication", 920, ["TIG & MIG Welding", "MS Gate & Truss Fabrication", "SS304 Balcony Railing", "Rolling Shutter Repair"]),
    ("Masonry & Tiling", 840, ["Large-Format Vitrified Tiling", "Epoxy Tile Grouting", "Granite Platform Cutting", "Laser Level Plastering"]),
    ("HVAC & Refrigeration", 950, ["Split Inverter AC Servicing", "R32 Vacuum & Gas Charging", "Cold-Room Compressor Care", "Ductable AC Maintenance"]),
    ("Painting & Waterproofing", 760, ["Elastomeric Terrace Waterproofing", "Acrylic Putty & Texture", "PU Wood Polish", "Damp-Proof Injection"]),
]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def ensure_collections_and_indexes(db):
    existing = set(db.list_collection_names())
    for col in ALL_COLLECTIONS:
        if col not in existing:
            db.create_collection(col)

    db.users.create_index([("email", ASCENDING)], unique=True)
    db.worker_profiles.create_index([("userId", ASCENDING)], unique=True)
    db.worker_profiles.create_index([("location.coordinates", GEOSPHERE)])
    db.jobs.create_index([("location.coordinates", GEOSPHERE)])
    db.jobs.create_index([("category", ASCENDING), ("status", ASCENDING)])
    db.job_applications.create_index([("jobId", ASCENDING), ("workerId", ASCENDING)], unique=True)
    db.reviews.create_index([("projectId", ASCENDING), ("reviewerId", ASCENDING)], unique=True)
    db.skill_passports.create_index([("passportCode", ASCENDING)], unique=True)
    print(f"[KaushalSetu] Initialized {len(ALL_COLLECTIONS)} collections and indexes in '{DB_NAME}'.")


def seed_500_workforce(db, target_workers=500):
    existing_workers = db.users.count_documents({"role": "worker"})
    if existing_workers >= target_workers:
        print(f"[KaushalSetu] {existing_workers} workers already present — skipping duplicate seed.")
        return

    now = datetime.now(timezone.utc).isoformat()
    demo_hash = pwd_context.hash("Demo@123")
    admin_hash = pwd_context.hash("Admin@123")

    if db.users.count_documents({"role": "admin"}) == 0:
        db.users.insert_one({
            "name": "Aarti Kulkarni (Platform Governance)",
            "email": "admin@kaushalsetu.in",
            "phone": "+91 98220 11001",
            "passwordHash": admin_hash,
            "role": "admin",
            "city": "Pune",
            "status": "active",
            "preferredLanguage": "en",
            "isDemo": True,
            "createdAt": now,
        })

    employer_doc = db.users.find_one({"role": "employer"})
    if not employer_doc:
        emp_res = db.users.insert_one({
            "name": "Vikram Deshmukh",
            "email": "vikram.deshmukh@demo.kaushalsetu.in",
            "phone": "+91 98230 77812",
            "passwordHash": demo_hash,
            "role": "employer",
            "city": "Latur",
            "status": "active",
            "preferredLanguage": "en",
            "isDemo": True,
            "createdAt": now,
        })
        employer_id = str(emp_res.inserted_id)
        db.employer_profiles.insert_one({
            "userId": employer_id,
            "organizationName": "Deshmukh Infra & Multi-Service Works",
            "employerType": "Contractor & Enterprise Hirer",
            "city": "Latur",
            "verificationStatus": "admin_verified",
            "isDemo": True,
            "createdAt": now,
        })
    else:
        employer_id = str(employer_doc["_id"])

    # Ensure skills catalog
    skill_id_map = {}
    for category, _, skill_names in TRADES:
        for s_name in skill_names:
            existing_sk = db.skills.find_one({"name": s_name})
            if existing_sk:
                skill_id_map[s_name] = str(existing_sk["_id"])
            else:
                ins = db.skills.insert_one({"name": s_name, "category": category, "demandScore": 85})
                skill_id_map[s_name] = str(ins.inserted_id)

    needed = target_workers - existing_workers
    users_batch = []
    profiles_batch = []
    wskills_batch = []
    rep_batch = []
    passports_batch = []
    avail_batch = []

    for idx in range(needed):
        seq = existing_workers + idx + 1
        is_female = (seq % 2 == 0)
        gender = "Female" if is_female else "Male"
        f_list = FEMALE_FIRST if is_female else MALE_FIRST
        first = f_list[(seq * 7) % len(f_list)].capitalize()
        last = LAST_NAMES[(seq * 11) % len(LAST_NAMES)].replace("Gायकवाड", "Gaikwad").capitalize()
        full_name = f"{first} {last}"

        city_name, base_lng, base_lat = CITIES[seq % len(CITIES)]
        angle = (seq * 137.5) * (math.pi / 180.0)
        radius = 0.008 + ((seq % 9) * 0.004)
        lng = round(base_lng + math.cos(angle) * radius, 5)
        lat = round(base_lat + math.sin(angle) * radius, 5)

        category, base_wage, skill_pool = TRADES[seq % len(TRADES)]
        is_newcomer = (seq % 5 == 0)
        exp_years = (seq % 2) if is_newcomer else 2 + (seq % 13)
        completed_jobs = (seq % 3) if is_newcomer else 4 + (seq % 38)
        daily_wage = int(round((base_wage + exp_years * 32) / 10.0) * 10)
        passport_code = f"KS-MH-2026-{2000 + seq:04d}"

        uid = ObjectId()
        uid_str = str(uid)
        email = (
            "sunita.shinde@demo.kaushalsetu.in"
            if seq == 1 and db.users.count_documents({"email": "sunita.shinde@demo.kaushalsetu.in"}) == 0
            else f"{first.lower()}.{last.lower()}.{seq}@demo.kaushalsetu.in"
        )

        users_batch.append({
            "_id": uid,
            "name": full_name,
            "gender": gender,
            "email": email,
            "phone": f"+91 94{200 + (seq % 700):03d} {10000 + seq:05d}",
            "passwordHash": demo_hash,
            "role": "worker",
            "city": city_name,
            "preferredLanguage": "mr" if seq % 3 == 0 else ("hi" if seq % 3 == 1 else "en"),
            "status": "active",
            "isDemo": True,
            "createdAt": now,
        })

        profiles_batch.append({
            "userId": uid_str,
            "gender": gender,
            "headline": f"{'Emerging' if is_newcomer else 'Experienced'} {category} Specialist ({skill_pool[0]})",
            "bio": f"Practical {category.lower()} professional in {city_name} skilled in {', '.join(skill_pool[:3])}.",
            "category": category,
            "experienceYears": exp_years,
            "expectedDailyWage": daily_wage,
            "city": city_name,
            "maxTravelKm": 15 + (seq % 25),
            "availabilityStatus": "busy" if seq % 9 == 0 else "available",
            "location": {"type": "Point", "coordinates": [lng, lat]},
            "completedJobsCount": completed_jobs,
            "verificationTier": "assessed" if seq % 3 != 0 else "self_declared",
            "passportCode": passport_code,
            "createdAt": now,
        })

        for s_idx, s_name in enumerate(skill_pool[:3]):
            assessed = (s_idx == 0 and seq % 3 != 0)
            wskills_batch.append({
                "workerId": uid_str,
                "skillId": skill_id_map[s_name],
                "name": s_name,
                "category": category,
                "proficiency": "Expert" if exp_years >= 7 else ("Intermediate" if exp_years >= 3 else "Beginner"),
                "verificationType": "assessed" if assessed else "self_declared",
                "assessmentScore": 76 + (seq % 20) if assessed else None,
                "yearsPractice": max(1, exp_years),
            })

        overall = round(73.5 + (seq % 5) * 1.1 if is_newcomer else min(96.8, 79.0 + (seq % 17) * 0.95), 1)
        rep_batch.append({
            "workerId": uid_str,
            "overallScore": overall,
            "qualityScore": round(min(98.0, overall + 1.2), 1),
            "reliabilityScore": round(min(98.0, overall + 0.6), 1),
            "punctualityScore": round(min(98.0, overall - 0.8), 1),
            "satisfactionScore": round(min(98.0, overall + 1.0), 1),
            "skillProficiencyScore": round(min(97.0, overall + 0.5), 1),
            "completionRatio": 100,
            "fairStartApplied": is_newcomer,
            "reviewCount": 0 if is_newcomer else max(2, completed_jobs // 3),
            "explanation": (
                "Fair-Start Bayesian Reputation baseline applied for assessed newcomer."
                if is_newcomer
                else f"Computed across verified {category} projects and skill assessments."
            ),
            "updatedAt": now,
        })

        passports_batch.append({
            "workerId": uid_str,
            "passportCode": passport_code,
            "issuedAt": now,
            "lastSyncedAt": now,
        })

        avail_batch.append({
            "workerId": uid_str,
            "status": "busy" if seq % 9 == 0 else "available",
            "weeklySchedule": {"mon": True, "tue": True, "wed": True, "thu": True, "fri": True, "sat": True, "sun": seq % 4 == 0},
            "preferredShift": "Full Day (9 AM - 6 PM)",
            "emergencyReady": seq % 2 == 0,
            "updatedAt": now,
        })

    if users_batch:
        db.users.insert_many(users_batch)
        db.worker_profiles.insert_many(profiles_batch)
        db.worker_skills.insert_many(wskills_batch)
        db.reputation_scores.insert_many(rep_batch)
        db.skill_passports.insert_many(passports_batch)
        db.worker_availability.insert_many(avail_batch)

    if db.jobs.count_documents({}) < 10:
        sample_jobs = []
        for j_idx, (cat, wage, sk_list) in enumerate(TRADES[:14]):
            c_name, c_lng, c_lat = CITIES[j_idx % len(CITIES)]
            sample_jobs.append({
                "employerId": employer_id,
                "employerName": "Deshmukh Infra & Multi-Service Works",
                "title": f"{cat} Specialist Needed — {sk_list[0]}",
                "category": cat,
                "description": f"Verified requirement in {c_name} for {sk_list[0]} and {sk_list[1]}. Transparent daily payout.",
                "requiredSkills": sk_list[:3],
                "minExperienceYears": 1 if j_idx % 2 == 0 else 2,
                "dailyWageBudget": wage + 120,
                "durationDays": 5 + (j_idx % 10),
                "city": c_name,
                "location": {"type": "Point", "coordinates": [c_lng, c_lat]},
                "isEmergency": j_idx % 4 == 0,
                "status": "open",
                "isDemo": True,
                "createdAt": now,
            })
        db.jobs.insert_many(sample_jobs)

    total_w = db.users.count_documents({"role": "worker"})
    female_w = db.users.count_documents({"role": "worker", "gender": "Female"})
    male_w = db.users.count_documents({"role": "worker", "gender": "Male"})
    print(f"[KaushalSetu] Workforce ready: {total_w} workers ({female_w} Women, {male_w} Men) across {len(TRADES)} trade domains.")


if __name__ == "__main__":
    client = MongoClient(MONGODB_URI)
    database = client[DB_NAME]
    ensure_collections_and_indexes(database)
    seed_500_workforce(database, 500)
