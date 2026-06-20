import httpx

from app.varieties import get_district_coords


async def get_weather_for_district(district: str) -> dict:
    coords = get_district_coords(district)
    params = {
        "latitude": coords["latitude"],
        "longitude": coords["longitude"],
        "current": "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
        "forecast_days": 3,
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
        response.raise_for_status()
        data = response.json()

    current = data.get("current", {})
    daily = data.get("daily", {})
    return {
        "district": coords["label"],
        "latitude": coords["latitude"],
        "longitude": coords["longitude"],
        "temperature_c": current.get("temperature_2m"),
        "humidity_pct": current.get("relative_humidity_2m"),
        "rain_mm_now": current.get("rain"),
        "precipitation_mm_now": current.get("precipitation"),
        "wind_speed_kmh": current.get("wind_speed_10m"),
        "weather_code": current.get("weather_code"),
        "forecast_rain_3d_mm": sum(daily.get("precipitation_sum", []) or []),
        "source": "open-meteo",
    }


def weather_advice_telugu(weather: dict | None) -> str:
    if not weather:
        return "వాతావరణ సమాచారం అందుబాటులో లేదు. ఎరువు వేసే ముందు స్థానిక వర్ష సూచన చూడండి."

    rain_3d = weather.get("forecast_rain_3d_mm") or 0
    humidity = weather.get("humidity_pct") or 0
    temp = weather.get("temperature_c") or 0

    if rain_3d >= 25:
        return "రాబోయే 3 రోజుల్లో వర్షం ఎక్కువగా ఉండే అవకాశం ఉంది. Urea వెంటనే వేయకుండా వర్షం తగ్గిన తర్వాత వేయండి."
    if rain_3d >= 8:
        return "తేలికపాటి వర్షం ఉండొచ్చు. ఎరువు వేయాలంటే పొలంలో నీరు ఎక్కువగా నిల్వ లేకుండా చూసుకోండి."
    if temp >= 36:
        return "ఉష్ణోగ్రత ఎక్కువగా ఉంది. ఎరువులు ఉదయం లేదా సాయంత్రం వేయడం మంచిది."
    if humidity >= 85:
        return "తేమ ఎక్కువగా ఉంది. ఆకు మచ్చలు/బ్లాస్ట్ లక్షణాలు ఉన్నాయా అని ఫోటోతో చెక్ చేయండి."
    return "వాతావరణం సాధారణంగా ఉంది. అయినా ఎరువు వేసే ముందు పొలంలో నీటి నిల్వను పరిశీలించండి."
