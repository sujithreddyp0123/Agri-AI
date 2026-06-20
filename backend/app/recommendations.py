from app.models import FertilizerItem, FertilizerRequest, FertilizerResponse
from app.varieties import get_variety
from app.weather import weather_advice_telugu

AVG_PRICE_PER_KG = {
    "Urea": 6.0,
    "DAP": 27.0,
    "MOP / Potash": 34.0,
    "Zinc Sulphate": 70.0,
    "No fertilizer needed": 0.0,
}


def _stage_for_paddy(age: int, duration: int = 125) -> tuple[str, str]:
    progress = age / max(duration, 1)
    if age <= 15 or progress <= 0.12:
        return "Basal establishment", "నాటిన మొదటి దశ"
    if progress <= 0.35:
        return "Tillering", "చిగుళ్ళ దశ"
    if progress <= 0.58:
        return "Panicle initiation", "కంకి వచ్చే దశ"
    if progress <= 0.78:
        return "Heading and flowering", "పూత దశ"
    return "Grain filling to harvest", "గింజ నిండే / కోత దశ"


def _apply_water_adjustments(
    req: FertilizerRequest,
    doses: list[tuple[str, float, str, str]],
) -> list[tuple[str, float, str, str]]:
    adjusted = []
    for name, qty, timing, method in doses:
        next_qty = qty
        next_timing = timing

        if req.water_source == "rainfed" and qty > 0:
            next_qty = round(qty * 0.80, 1)
        if req.water_source == "borewell":
            next_timing = f"{timing}. బోర్ నీరు వాడేవారు pH చెక్ చేయండి"

        adjusted.append((name, next_qty, next_timing, method))
    return adjusted


def _paddy_doses(req: FertilizerRequest, duration: int = 125) -> list[tuple[str, float, str, str]]:
    age = req.crop_age_days
    progress = age / max(duration, 1)
    variety_info = get_variety(req.variety)
    grain_type = (variety_info or {}).get("grain_type", "")
    urea_factor = 1.0

    if grain_type == "fine":
        urea_factor *= 0.95
    elif grain_type == "coarse":
        urea_factor *= 0.9

    if "mtu 1010" in req.variety.lower() or "1010" in req.variety.lower():
        urea_factor *= 1.05

    if req.soil_type == "sandy":
        urea_factor *= 0.9
    elif req.soil_type in {"clay", "black"}:
        urea_factor *= 0.9 if req.soil_type == "black" else 0.95

    if age <= 15 or progress <= 0.12:
        doses = [
            ("DAP", 25, "నాటే ముందు లేదా నాటిన వెంటనే", "మట్టిలో కలపండి"),
            ("MOP / Potash", 15, "నాటే ముందు లేదా నాటిన వెంటనే", "మట్టిలో సమంగా కలపండి"),
            ("Urea", round(20 * urea_factor, 1), "నాటిన 7-10 రోజుల తర్వాత", "నీరు తగ్గించి చల్లండి"),
        ]
        if req.soil_type == "red":
            doses.append(("Zinc Sulphate", 10, "నాటే ముందు", "మట్టిలో సమంగా కలపండి"))
        return _apply_water_adjustments(req, doses)

    if progress <= 0.35:
        return _apply_water_adjustments(
            req,
            [("Urea", round(30 * urea_factor, 1), "ఈ వారంలో", "పొలంలో నీరు తగ్గించిన తర్వాత చల్లండి")],
        )

    if progress <= 0.58:
        return _apply_water_adjustments(
            req,
            [
                ("Urea", round(20 * urea_factor, 1), "కంకి దశ మొదలయ్యే ముందు", "ఉదయం లేదా సాయంత్రం చల్లండి"),
                ("MOP / Potash", 20, "Urea తో పాటు", "పొలంలో సమంగా చల్లండి"),
            ],
        )

    if progress <= 0.78:
        return _apply_water_adjustments(
            req,
            [("Urea", round(8 * urea_factor, 1), "ఆకు పసుపుగా ఉంటే మాత్రమే", "తక్కువ మోతాదులో చల్లండి")],
        )

    return [
        (
            "No fertilizer needed",
            0,
            "కోత దశలో ఎరువు వేయకండి",
            "నీరు కూడా తగ్గించండి — కోతకు 10 రోజుల ముందు పొలం ఆరనివ్వండి",
        )
    ]


def _variety_advice(req: FertilizerRequest) -> tuple[int, str]:
    variety = get_variety(req.variety)
    if not variety:
        return 125, "ఈ రకం మా జాబితాలో లేదు. సాధారణ వరి సూచన ఇస్తున్నాం; స్థానిక నిపుణుడితో ధృవీకరించండి."

    duration = int(variety["duration_days"])
    season_ok = req.season in variety["preferred_seasons"]
    if not season_ok:
        return duration, f"{variety['display_name']} సాధారణంగా {', '.join(variety['preferred_seasons'])} సీజన్లలో సూచించబడింది. మీరు ఎంచుకున్న సీజన్‌ను ఒకసారి చెక్ చేయండి."
    return duration, f"{variety['display_name']} కోసం {duration} రోజుల పంట కాలాన్ని ఆధారంగా తీసుకుని సూచన ఇస్తున్నాం."


def _soil_advice(req: FertilizerRequest) -> str:
    if req.soil_type == "sandy":
        return "ఇసుక మట్టిలో ఎరువు ఒక్కసారిగా ఎక్కువ వేయకండి. విడతలుగా వేస్తే నష్టం తక్కువ."
    if req.soil_type == "clay":
        return "బంక మట్టిలో నీరు నిల్వ ఎక్కువ. Urea వేసే ముందు నీరు తగ్గించడం మంచిది."
    if req.soil_type == "red":
        return "ఎర్ర మట్టిలో Zinc లోపం సాధారణం. Basal దశలో Zinc Sulphate 10kg/acre కలపడం మంచిది."
    if req.soil_type == "black":
        return "నల్ల మట్టిలో నీరు ఎక్కువ నిల్వ ఉంటుంది. Urea వేసే ముందు పొలం నీరు తగ్గించండి. మోతాదు 10% తగ్గించవచ్చు."
    return "మట్టి రకం ఖచ్చితంగా తెలియకపోతే మోతాదును స్థానిక నిపుణుడితో ఒకసారి చెక్ చేయండి."


def _money_saved(req: FertilizerRequest, doses: list[tuple[str, float, str, str]]) -> int:
    total_advised_cost = sum(qty * AVG_PRICE_PER_KG.get(name, 20.0) for name, qty, _, _ in doses)
    return round(total_advised_cost * 0.35 * req.land_acres)


def recommend_fertilizer(req: FertilizerRequest, weather: dict | None = None) -> FertilizerResponse:
    if req.crop_type != "paddy":
        return FertilizerResponse(
            stage="Crop support coming soon",
            stage_telugu="ఈ పంటకు పూర్తి సలహా త్వరలో",
            fertilizers=[],
            special_advice_telugu="ప్రస్తుతం ఖచ్చితమైన మోతాదులు వరి కోసం మాత్రమే సిద్ధంగా ఉన్నాయి.",
            variety_advice_telugu="ఈ పంటకు రకం-ఆధారిత సమాచారం ఇంకా జోడించలేదు.",
            weather_advice_telugu=weather_advice_telugu(weather),
            weather=weather,
            next_action_telugu="మీ పంట ఫోటో మరియు స్థానిక నిపుణుడి సలహాతో ధృవీకరించండి.",
            money_saved_inr=0,
            source="rules-engine",
            safety_note_telugu="ఇది పరీక్ష దశలో ఉన్న సలహా. చివరి నిర్ణయానికి స్థానిక వ్యవసాయ నిపుణుడిని అడగండి.",
        )

    duration, variety_note = _variety_advice(req)
    stage, stage_telugu = _stage_for_paddy(req.crop_age_days, duration)
    doses = _paddy_doses(req, duration)
    items = [
        FertilizerItem(
            name=name,
            qty_per_acre_kg=qty,
            total_qty_kg=round(qty * req.land_acres, 1),
            timing_telugu=timing,
            method_telugu=method,
        )
        for name, qty, timing, method in doses
    ]

    return FertilizerResponse(
        stage=stage,
        stage_telugu=stage_telugu,
        fertilizers=items,
        special_advice_telugu=_soil_advice(req),
        variety_advice_telugu=variety_note,
        weather_advice_telugu=weather_advice_telugu(weather),
        weather=weather,
        next_action_telugu="7-10 రోజుల తర్వాత ఆకుల రంగు, మొక్క పెరుగుదల ఫోటో తీసి మళ్లీ చెక్ చేయండి.",
        money_saved_inr=_money_saved(req, doses),
        source="rules-engine",
        safety_note_telugu="ఇది MVP సలహా మాత్రమే. మీ నాన్న/స్థానిక నిపుణుడి ధృవీకరణ తర్వాతే రైతులకు ఇవ్వాలి.",
    )
