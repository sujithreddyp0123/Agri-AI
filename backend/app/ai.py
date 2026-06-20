import base64
import json
import logging
import re

import httpx

from app.config import Settings
from app.models import DiagnosisResponse, FarmContext

logger = logging.getLogger(__name__)


def _fallback_diagnosis() -> DiagnosisResponse:
    return DiagnosisResponse(
        disease="Needs expert review",
        disease_telugu="నిపుణుడి పరిశీలన అవసరం",
        severity="unknown",
        confidence=0.0,
        description_telugu="AI స్పందన అందుబాటులో లేదు. కాబట్టి ఈ ఫోటోకు ఖచ్చితమైన నిర్ధారణ ఇవ్వలేకపోయాం.",
        treatment_steps_telugu=[
            "ఆకు మీద మచ్చలు, పసుపు రంగు, పురుగు గాట్లు స్పష్టంగా కనిపించేలా మరో ఫోటో తీయండి.",
            "పంట వయస్సు, చివరిసారి వేసిన ఎరువు, పొలంలో నీరు నిల్వ ఉందా అనే వివరాలు నమోదు చేయండి.",
            "మీ స్థానిక వ్యవసాయ అధికారిని సంప్రదించండి అవసరమైతే.",
        ],
        fertilizer_note_telugu="ఫోటో ఆధారంగా ఎరువు మోతాదు ఇంకా ఖచ్చితంగా నిర్ణయించలేదు.",
        source="fallback",
        needs_expert_review=True,
    )


def _parse_diagnosis(text: str) -> DiagnosisResponse:
    clean = text.replace("```json", "").replace("```", "").strip()
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        clean = match.group(0)

    parsed = json.loads(clean)
    severity = str(parsed.get("severity", "unknown")).lower()
    if severity not in {"low", "medium", "high", "unknown"}:
        severity = "unknown"

    try:
        confidence = float(parsed.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0
    confidence = max(0, min(confidence, 1))

    steps = parsed.get("treatment_steps_telugu", [])
    if isinstance(steps, str):
        steps = [steps]
    if not isinstance(steps, list):
        steps = []

    return DiagnosisResponse(
        disease=str(parsed.get("disease") or "Needs expert review"),
        disease_telugu=str(parsed.get("disease_telugu") or "నిపుణుడి పరిశీలన అవసరం"),
        severity=severity,  # type: ignore[arg-type]
        confidence=confidence,
        description_telugu=str(parsed.get("description_telugu") or "ఫోటో ఆధారంగా పూర్తి నిర్ధారణ కాలేదు."),
        treatment_steps_telugu=[str(step) for step in steps],
        fertilizer_note_telugu=str(parsed.get("fertilizer_note_telugu") or "ఎరువు సలహాను స్థానిక నిపుణుడితో ధృవీకరించండి."),
        source="anthropic-vision",
        needs_expert_review=bool(parsed.get("needs_expert_review", confidence < 0.6)),
    )


def _extract_string(text: str, key: str, default: str) -> str:
    patterns = [
        rf'"{re.escape(key)}"\s*:\s*"([^"]*)"',
        rf"{re.escape(key)}\s*[:\-]\s*(.+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().strip(",").strip()
    return default


def _extract_confidence(text: str) -> float:
    match = re.search(r'"?confidence"?\s*:\s*([01](?:\.\d+)?)', text, re.IGNORECASE)
    if not match:
        return 0.0
    return max(0.0, min(float(match.group(1)), 1.0))


def _extract_steps(text: str) -> list[str]:
    array_match = re.search(r'"treatment_steps_telugu"\s*:\s*\[(.*?)\]', text, re.DOTALL)
    if array_match:
        return [item.strip() for item in re.findall(r'"([^"]+)"', array_match.group(1))]

    lines = []
    for line in text.splitlines():
        clean = line.strip().strip("-* ")
        if re.match(r"^\d+[\).]\s+", clean):
            lines.append(re.sub(r"^\d+[\).]\s+", "", clean))
    return lines


def _partial_diagnosis_from_text(text: str) -> DiagnosisResponse:
    logger.warning("Claude diagnosis JSON parsing failed. Raw response: %s", text)

    severity = _extract_string(text, "severity", "unknown").lower()
    if severity not in {"low", "medium", "high", "unknown"}:
        severity = "unknown"

    confidence = _extract_confidence(text)
    steps = _extract_steps(text)
    if not steps:
        steps = ["మీ స్థానిక వ్యవసాయ అధికారిని సంప్రదించండి అవసరమైతే."]

    return DiagnosisResponse(
        disease=_extract_string(text, "disease", "Needs expert review"),
        disease_telugu=_extract_string(text, "disease_telugu", "నిపుణుడి పరిశీలన అవసరం"),
        severity=severity,  # type: ignore[arg-type]
        confidence=confidence,
        description_telugu=_extract_string(text, "description_telugu", text[:700]),
        treatment_steps_telugu=steps,
        fertilizer_note_telugu=_extract_string(
            text,
            "fertilizer_note_telugu",
            "ఎరువు సలహాను స్థానిక నిపుణుడితో ధృవీకరించండి.",
        ),
        source="anthropic-vision",
        needs_expert_review=confidence < 0.6,
    )


async def analyze_crop_photo(
    *,
    settings: Settings,
    image_bytes: bytes,
    media_type: str,
    context: FarmContext,
) -> DiagnosisResponse:
    if not settings.anthropic_api_key:
        return _fallback_diagnosis()

    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    system = """
You are an expert crop diagnosis assistant for paddy farmers in Andhra Pradesh, India -- specifically Nellore, Krishna and Godavari districts.

RESPONSE FORMAT:
Return JSON only. No text outside JSON. Keys:
- disease: English name
- disease_telugu: Telugu name
- severity: low / medium / high / unknown
- confidence: 0.0 to 1.0
- description_telugu: 2 sentences max, simple language
- treatment_steps_telugu: array of 3-5 steps, each with exact quantities per acre
- fertilizer_note_telugu: specific fertilizer advice based on crop stage
- needs_expert_review: true if confidence < 0.6

DIAGNOSIS RULES:
- If photo is blurry or unclear: set confidence 0.1, needs_expert_review true
- If no disease visible: say so honestly
- Never guess when uncertain
- Always give exact quantities -- never say "కొంచెం" (some) or "కొద్దిగా" (little)
- Quantities always in kg per acre

COMMON AP PADDY DISEASES TO LOOK FOR:
- Blast: grey diamond shaped lesions on leaves
- Brown Spot: oval brown spots with yellow halo
- Sheath Blight: water soaked lesions at waterline
- Bacterial Leaf Blight: yellow water soaked margins
- False Smut: olive green spore balls on grains
- Neck Blast: rotting at panicle neck
- BPH Hopper Burn: yellowing from base upward

NUTRIENT DEFICIENCIES TO IDENTIFY:
- Nitrogen: uniform yellowing older leaves first
- Phosphorus: purple/reddish tint on leaves
- Potassium: brown scorching on leaf tips/margins
- Zinc: brown rusty spots, stunted growth
- Iron: yellowing of new leaves, green veins remain
- Sulphur: yellowing of new leaves uniformly

TREATMENT QUANTITIES PER ACRE:
Nitrogen deficiency -> Urea 20-25 kg
Phosphorus deficiency -> DAP 15 kg
Potassium deficiency -> MOP 15 kg
Zinc deficiency -> Zinc Sulphate 5 kg
Blast -> Tricyclazole 75WP 6g per 15L water
Brown Spot -> Mancozeb 75WP 30g per 15L
BPH -> Imidacloprid 17.8SL 3ml per 15L

LANGUAGE RULES:
- Telugu must be simple village-level language
- Avoid technical jargon farmers won't understand
- If farmer needs to act urgently say: "వెంటనే చర్య తీసుకోండి"
- Always end treatment steps with: "మీ స్థానిక వ్యవసాయ అధికారిని సంప్రదించండి అవసరమైతే"
"""
    user_text = f"""
Crop: {context.crop_type}
Variety: {context.variety}
Season: {context.season}
Crop age days: {context.crop_age_days}
Land acres: {context.land_acres}
Soil type: {context.soil_type}
Water source: {context.water_source}
District: {context.district}

Identify disease, pest damage, or nutrient deficiency if visible.
"""

    payload = {
        "model": settings.anthropic_model,
        "max_tokens": 1200,
        "system": system,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {"type": "text", "text": user_text},
                ],
            }
        ],
    }

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        return _fallback_diagnosis()

    data = response.json()
    text = data["content"][0]["text"]

    try:
        return _parse_diagnosis(text)
    except (json.JSONDecodeError, TypeError, KeyError, ValueError):
        return _partial_diagnosis_from_text(text)
