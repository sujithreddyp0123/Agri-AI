from datetime import date, datetime, timedelta
from pathlib import Path
import random
import uuid

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.ai import analyze_crop_photo
from app.ai import resolve_anthropic_model
from app.config import Settings, get_settings
from app.database import get_connection, init_db, row_to_dict
from app.models import (
    CropSeasonCreate,
    CropSeasonResponse,
    DiagnosisFeedback,
    DiagnosisResponse,
    FarmerCreate,
    FarmerResponse,
    FarmContext,
    FertilizerRequest,
    FertilizerResponse,
    OTPRequest,
    OTPResponse,
    OTPVerify,
)
from app.recommendations import recommend_fertilizer
from app.varieties import PADDY_SEASONS, PADDY_VARIETIES
from app.weather import get_weather_for_district

app = FastAPI(title="Agri AI API", version="0.1.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@app.on_event("startup")
async def startup() -> None:
    init_db()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/ai/status")
async def ai_status(settings: Settings = Depends(get_settings)) -> dict[str, str | bool]:
    return {
        "anthropic_configured": bool(settings.anthropic_api_key),
        "model": resolve_anthropic_model(settings.anthropic_model),
    }


def detect_stage(days_since_sowing: int) -> tuple[str, str]:
    if days_since_sowing <= 15:
        return "Basal", "నాటే దశ"
    if days_since_sowing <= 40:
        return "Tillering", "చిగుళ్ళ దశ"
    if days_since_sowing <= 60:
        return "Panicle", "కంకి దశ"
    if days_since_sowing <= 85:
        return "Heading", "పూత దశ"
    if days_since_sowing <= 110:
        return "Grain filling", "గింజలు నిండే దశ"
    return "Harvest", "కోత దశ"


def generate_otp() -> str:
    return f"{random.randint(100000, 999999)}"


@app.post("/api/auth/request-otp", response_model=OTPResponse)
async def request_otp(request: OTPRequest) -> OTPResponse:
    otp = generate_otp()
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO otp_codes (phone, otp, verified, expires_at)
            VALUES (?, ?, 0, ?)
            ON CONFLICT(phone) DO UPDATE SET
                otp = excluded.otp,
                verified = 0,
                created_at = CURRENT_TIMESTAMP,
                expires_at = excluded.expires_at
            """,
            (request.phone, otp, expires_at),
        )

    return OTPResponse(sent=True, phone=request.phone, dev_otp=otp)


@app.post("/api/auth/verify-otp")
async def verify_otp(request: OTPVerify) -> dict[str, bool]:
    with get_connection() as conn:
        row = conn.execute("SELECT otp, expires_at FROM otp_codes WHERE phone = ?", (request.phone,)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="OTP not requested")

        if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
            raise HTTPException(status_code=400, detail="OTP expired")

        if row["otp"] != request.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")

        conn.execute("UPDATE otp_codes SET verified = 1 WHERE phone = ?", (request.phone,))

    return {"verified": True}


@app.post("/api/farmer/register", response_model=FarmerResponse)
async def register_farmer(request: FarmerCreate) -> FarmerResponse:
    with get_connection() as conn:
        existing = conn.execute("SELECT * FROM farmers WHERE phone = ?", (request.phone,)).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE farmers
                SET name = ?, village = ?, mandal = ?, district = ?
                WHERE phone = ?
                """,
                (request.name, request.village, request.mandal, request.district, request.phone),
            )
            row = conn.execute("SELECT * FROM farmers WHERE phone = ?", (request.phone,)).fetchone()
        else:
            cursor = conn.execute(
                """
                INSERT INTO farmers (name, phone, village, mandal, district)
                VALUES (?, ?, ?, ?, ?)
                """,
                (request.name, request.phone, request.village, request.mandal, request.district),
            )
            row = conn.execute("SELECT * FROM farmers WHERE id = ?", (cursor.lastrowid,)).fetchone()

    if not row:
        raise HTTPException(status_code=500, detail="Could not save farmer")
    return FarmerResponse(**row_to_dict(row))


@app.post("/api/farmer/crop-season", response_model=CropSeasonResponse)
async def create_crop_season(request: CropSeasonCreate) -> CropSeasonResponse:
    try:
        sow_date = date.fromisoformat(request.sow_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="sow_date must be YYYY-MM-DD") from exc

    days_since_sowing = max((date.today() - sow_date).days, 0)
    stage, stage_telugu = detect_stage(days_since_sowing)

    with get_connection() as conn:
        farmer = conn.execute("SELECT id FROM farmers WHERE phone = ?", (request.farmer_phone,)).fetchone()
        if not farmer:
            raise HTTPException(status_code=404, detail="Farmer not found. Register farmer first.")

        cursor = conn.execute(
            """
            INSERT INTO crop_seasons (
                farmer_phone, crop_type, variety, sow_date, land_acres,
                soil_type, water_source, district, mandal,
                current_stage, current_stage_telugu, days_since_sowing
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.farmer_phone,
                request.crop_type,
                request.variety,
                request.sow_date,
                request.land_acres,
                request.soil_type,
                request.water_source,
                request.district,
                request.mandal,
                stage,
                stage_telugu,
                days_since_sowing,
            ),
        )

    return CropSeasonResponse(
        id=int(cursor.lastrowid),
        current_stage=stage,
        current_stage_telugu=stage_telugu,
        days_since_sowing=days_since_sowing,
        **request.model_dump(),
    )


@app.post("/api/diagnosis/feedback")
async def save_diagnosis_feedback(request: DiagnosisFeedback) -> dict[str, bool]:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO diagnosis_feedback (
                diagnosis_id, is_correct, farmer_correction_telugu, farmer_phone
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                request.diagnosis_id,
                1 if request.is_correct else 0,
                request.farmer_correction_telugu,
                request.farmer_phone,
            ),
        )
    return {"saved": True}


@app.get("/api/farmer/{phone}/history")
async def farmer_history(phone: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, farmer_phone, crop_type, variety, crop_age_days,
                   disease_detected, disease_telugu, severity, confidence,
                   needs_expert_review, photo_path, created_at,
                   (
                       SELECT is_correct
                       FROM diagnosis_feedback
                       WHERE diagnosis_feedback.diagnosis_id = diagnoses.id
                       ORDER BY created_at DESC
                       LIMIT 1
                   ) AS feedback_is_correct,
                   (
                       SELECT farmer_correction_telugu
                       FROM diagnosis_feedback
                       WHERE diagnosis_feedback.diagnosis_id = diagnoses.id
                       ORDER BY created_at DESC
                       LIMIT 1
                   ) AS feedback_correction_telugu,
                   (
                       SELECT created_at
                       FROM diagnosis_feedback
                       WHERE diagnosis_feedback.diagnosis_id = diagnoses.id
                       ORDER BY created_at DESC
                       LIMIT 1
                   ) AS feedback_created_at
            FROM diagnoses
            WHERE farmer_phone = ?
            ORDER BY created_at DESC
            LIMIT 10
            """,
            (phone,),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.get("/api/paddy/metadata")
async def paddy_metadata() -> dict[str, list[dict]]:
    return {"varieties": PADDY_VARIETIES, "seasons": PADDY_SEASONS}


@app.get("/api/weather/{district}")
async def district_weather(district: str) -> dict:
    return await get_weather_for_district(district)


@app.post("/api/fertilizer/recommend", response_model=FertilizerResponse)
async def fertilizer_recommendation(request: FertilizerRequest) -> FertilizerResponse:
    try:
        weather = await get_weather_for_district(request.district)
    except Exception:
        weather = None
    return recommend_fertilizer(request, weather)


@app.post("/api/diagnosis/analyze-photo", response_model=DiagnosisResponse)
async def photo_diagnosis(
    photo: UploadFile = File(...),
    crop_type: str = Form("paddy"),
    variety: str = Form("BPT 5204"),
    season: str = Form("kharif"),
    crop_age_days: int = Form(25),
    land_acres: float = Form(1),
    soil_type: str = Form("unknown"),
    water_source: str = Form("unknown"),
    district: str = Form("Nellore"),
    mandal: str | None = Form(None),
    farmer_phone: str | None = Form(None),
    settings: Settings = Depends(get_settings),
) -> DiagnosisResponse:
    image_bytes = await photo.read()
    context = FarmContext(
        crop_type=crop_type,  # type: ignore[arg-type]
        variety=variety,
        season=season,
        crop_age_days=crop_age_days,
        land_acres=land_acres,
        soil_type=soil_type,  # type: ignore[arg-type]
        water_source=water_source,  # type: ignore[arg-type]
        district=district,
        mandal=mandal,
    )
    result = await analyze_crop_photo(
        settings=settings,
        image_bytes=image_bytes,
        media_type=photo.content_type or "image/jpeg",
        context=context,
    )
    diagnosis_id = str(uuid.uuid4())
    result.diagnosis_id = diagnosis_id

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO diagnoses (
                id, farmer_phone, crop_type, variety, crop_age_days,
                disease_detected, disease_telugu, severity, confidence,
                needs_expert_review, photo_path
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                diagnosis_id,
                farmer_phone,
                crop_type,
                variety,
                crop_age_days,
                result.disease,
                result.disease_telugu,
                result.severity,
                result.confidence,
                1 if result.needs_expert_review else 0,
                None,
            ),
        )

    return result


@app.get("/assets/{asset_path:path}")
async def serve_asset(asset_path: str) -> FileResponse:
    assets_dir = FRONTEND_DIST / "assets"
    requested_file = assets_dir / asset_path

    if requested_file.exists() and requested_file.is_file():
        return FileResponse(requested_file)

    extension = Path(asset_path).suffix
    if extension in {".css", ".js"}:
        fallback = next(assets_dir.glob(f"*{extension}"), None) if assets_dir.exists() else None
        if fallback and fallback.is_file():
            return FileResponse(fallback)

    raise HTTPException(status_code=404, detail="Asset not found")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str) -> FileResponse:
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")

    index_file = FRONTEND_DIST / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found")

    requested_file = FRONTEND_DIST / full_path
    if full_path and requested_file.exists() and requested_file.is_file():
        return FileResponse(requested_file)

    return FileResponse(index_file)
