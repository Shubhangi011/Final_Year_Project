"""
Pydantic v2 Schemas & MongoDB 30-Collection Document Models for KaushalSetu.
"""

from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class GeoPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: List[float] = Field(..., description="[longitude, latitude] in WGS84")


class UserRegisterSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    phone: str = Field(..., min_length=10, max_length=15)
    role: Literal["worker", "employer"] = "worker"
    city: str = "Latur"
    preferredLanguage: Literal["en", "mr", "hi"] = "en"


class WorkerSkillItem(BaseModel):
    skillId: Optional[str] = None
    name: str
    category: str
    proficiency: Literal["Beginner", "Intermediate", "Advanced", "Expert"] = "Intermediate"
    verificationType: Literal["self_declared", "assessed", "admin_verified"] = "self_declared"
    assessmentScore: Optional[float] = None


class JobCreateSchema(BaseModel):
    title: str = Field(..., min_length=4, max_length=120)
    category: str
    description: str = Field(..., min_length=15)
    requiredSkills: List[str]
    minExperienceYears: float = Field(default=1, ge=0)
    dailyWageBudget: float = Field(..., gt=100)
    durationDays: int = Field(default=3, ge=1)
    city: str
    location: GeoPoint
    isEmergency: bool = False
    deadline: Optional[str] = None
