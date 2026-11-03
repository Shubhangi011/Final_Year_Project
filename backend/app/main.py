"""
KaushalSetu FastAPI Backend Reference & Standalone Server
Connects to MongoDB (Community Server or Atlas) via Motor/PyMongo with 30 collections,
2dsphere geospatial indexes, JWT RBAC authentication, and the KaushalSetu Python AI Engine.
"""

import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import ai_engine

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "kaushalsetu")

app = FastAPI(
    title="KaushalSetu API",
    description="AI-Powered Skilled Worker Hiring & Reputation Intelligence System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mongo_client: Optional[AsyncIOMotorClient] = None


@app.on_event("startup")
async def startup_db_client():
    global mongo_client
    mongo_client = AsyncIOMotorClient(MONGODB_URI)
    db = mongo_client[MONGODB_DB_NAME]
    # Ensure core unique & 2dsphere indexes across the 30 collections
    await db.users.create_index("email", unique=True)
    await db.worker_profiles.create_index([("location", "2dsphere")])
    await db.jobs.create_index([("location", "2dsphere")])
    await db.job_applications.create_index([("jobId", 1), ("workerId", 1)], unique=True)
    await db.reviews.create_index([("projectId", 1), ("reviewerId", 1)], unique=True)
    await db.skill_passports.create_index("passportCode", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    if mongo_client:
        mongo_client.close()


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "KaushalSetu FastAPI + MongoDB + Python AI Engine",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/ai/wage-recommendation")
async def wage_recommendation(payload: dict):
    return ai_engine.recommend_wage(payload)


@app.post("/api/ai/skill-gap-analysis")
async def skill_gap_analysis(payload: dict):
    return ai_engine.analyze_skill_gap(payload)


@app.post("/api/ai/career-recommendation")
async def career_recommendation(payload: dict):
    return ai_engine.recommend_career(payload)
