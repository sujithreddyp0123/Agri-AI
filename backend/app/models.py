from typing import Literal

from pydantic import BaseModel, Field


CropType = Literal["paddy", "mirchi", "cotton", "sugarcane", "millet", "groundnut", "maize", "turmeric"]
SoilType = Literal["clay", "red", "sandy", "black", "unknown"]
WaterSource = Literal["canal", "borewell", "rainfed", "tank", "unknown"]


class FarmContext(BaseModel):
    crop_type: CropType = "paddy"
    variety: str = Field(default="BPT 5204", min_length=1)
    season: str = "kharif"
    crop_age_days: int = Field(default=25, ge=0, le=220)
    land_acres: float = Field(default=1, gt=0, le=1000)
    soil_type: SoilType = "unknown"
    water_source: WaterSource = "unknown"
    district: str = "Nellore"
    mandal: str | None = None


class FertilizerRequest(FarmContext):
    pass


class FarmerCreate(BaseModel):
    name: str
    phone: str
    village: str
    mandal: str
    district: str = "Nellore"


class FarmerResponse(BaseModel):
    id: int
    name: str
    phone: str
    village: str
    mandal: str
    district: str


class CropSeasonCreate(BaseModel):
    farmer_phone: str
    crop_type: CropType
    variety: str
    sow_date: str
    land_acres: float
    soil_type: SoilType
    water_source: WaterSource
    district: str
    mandal: str | None = None


class CropSeasonResponse(CropSeasonCreate):
    id: int
    current_stage: str
    current_stage_telugu: str
    days_since_sowing: int


class DiagnosisFeedback(BaseModel):
    diagnosis_id: str
    is_correct: bool
    farmer_correction_telugu: str | None = None
    farmer_phone: str | None = None


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str


class OTPResponse(BaseModel):
    sent: bool
    phone: str
    dev_otp: str | None = None


class FertilizerItem(BaseModel):
    name: str
    qty_per_acre_kg: float
    total_qty_kg: float
    timing_telugu: str
    method_telugu: str


class FertilizerResponse(BaseModel):
    stage: str
    stage_telugu: str
    fertilizers: list[FertilizerItem]
    special_advice_telugu: str
    variety_advice_telugu: str
    weather_advice_telugu: str
    weather: dict | None = None
    next_action_telugu: str
    money_saved_inr: int
    source: Literal["rules-engine", "ai-assisted"]
    safety_note_telugu: str


class DiagnosisResponse(BaseModel):
    diagnosis_id: str | None = None
    disease: str
    disease_telugu: str
    severity: Literal["low", "medium", "high", "unknown"]
    confidence: float = Field(ge=0, le=1)
    description_telugu: str
    treatment_steps_telugu: list[str]
    fertilizer_note_telugu: str
    source: Literal["anthropic-vision", "fallback"]
    needs_expert_review: bool = True
