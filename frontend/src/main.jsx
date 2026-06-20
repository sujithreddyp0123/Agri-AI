import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Camera, Home, Leaf, Loader2, Save, Sprout, UserRound } from "lucide-react";
import { analyzePhoto, getDistrictWeather, getPaddyMetadata, recommendFertilizer } from "./api";
import "./styles.css";

const defaultContext = {
  crop_type: "paddy",
  variety: "BPT 5204",
  season: "kharif",
  state: "AP",
  crop_age_days: 25,
  land_acres: 1,
  soil_type: "clay",
  water_source: "canal",
  district: "Nellore",
  village: "",
};

const STATE_OPTIONS = [
  { value: "AP", label: "Andhra Pradesh" },
  { value: "TS", label: "Telangana" },
];

const DISTRICTS_BY_STATE = {
  AP: [
    "Nellore",
    "Krishna",
    "Guntur",
    "East Godavari",
    "West Godavari",
    "Srikakulam",
    "Vizianagaram",
    "Visakhapatnam",
    "Prakasam",
    "Kurnool",
    "Kadapa",
    "Anantapur",
    "Chittoor",
  ],
  TS: [
    "Hyderabad",
    "Warangal",
    "Karimnagar",
    "Nizamabad",
    "Khammam",
    "Medak",
    "Sangareddy",
    "Rangareddy",
  ],
};

function App() {
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("agri-ai-profile");
    return saved ? { ...defaultContext, ...JSON.parse(saved) } : { name: "", ...defaultContext };
  });
  const [context, setContext] = useState({ ...defaultContext, ...profile });
  const [diagnosis, setDiagnosis] = useState(null);
  const [fertilizer, setFertilizer] = useState(null);
  const [metadata, setMetadata] = useState({ varieties: [], seasons: [] });
  const [weather, setWeather] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const farmContext = useMemo(
    () => ({
      crop_type: context.crop_type,
      variety: context.variety,
      season: context.season,
      crop_age_days: Number(context.crop_age_days),
      land_acres: Number(context.land_acres),
      soil_type: context.soil_type,
      water_source: context.water_source,
      district: context.district,
    }),
    [context],
  );

  useEffect(() => {
    getPaddyMetadata()
      .then(setMetadata)
      .catch(() => setMetadata({ varieties: [], seasons: [] }));
  }, []);

  useEffect(() => {
    getDistrictWeather(context.district)
      .then(setWeather)
      .catch(() => setWeather(null));
  }, [context.district]);

  function updateContext(key, value) {
    setContext((current) => ({ ...current, [key]: value }));
  }

  function updateProfile(key, value) {
    setProfile((current) => ({ ...current, [key]: value }));
    setContext((current) => ({ ...current, [key]: value }));
  }

  function updateProfileState(value) {
    const nextDistrict = DISTRICTS_BY_STATE[value]?.[0] || "Nellore";
    setProfile((current) => ({ ...current, state: value, district: nextDistrict }));
    setContext((current) => ({ ...current, state: value, district: nextDistrict }));
  }

  function saveProfile() {
    const next = { ...context, ...profile };
    setProfile(next);
    setContext((current) => ({ ...current, ...next }));
    localStorage.setItem("agri-ai-profile", JSON.stringify(next));
    setTab("home");
  }

  async function onPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setDiagnosis(null);
    setError("");
    setLoading("photo");

    try {
      const result = await analyzePhoto(file, farmContext);
      setDiagnosis(result);
    } catch (err) {
      setError("Photo diagnosis failed. Check that FastAPI is running.");
    } finally {
      setLoading("");
    }
  }

  async function getFertilizer() {
    setFertilizer(null);
    setError("");
    setLoading("fertilizer");

    try {
      const result = await recommendFertilizer(farmContext);
      setFertilizer(result);
    } catch (err) {
      setError("Fertilizer recommendation failed. Check that FastAPI is running.");
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><Sprout size={24} /></div>
        <div>
          <h1>Agri AI</h1>
          <p>రైతు మిత్రం</p>
        </div>
      </header>

      {tab === "home" && (
        <section className="screen">
          <div className="field-status">
            <div>
              <p className="eyebrow">Current field</p>
              <h2>{profile.name || "Farmer profile not set"}</h2>
              <span>{profile.village || "Add village"} • {profile.district || context.district} • {profile.state || context.state} • {context.variety} • {context.land_acres} acre</span>
            </div>
            <button className="icon-button" onClick={() => setTab("profile")} aria-label="Edit profile">
              <UserRound size={20} />
            </button>
          </div>
          <WeatherStrip weather={weather} />

          <div className="action-grid">
            <button className="action-tile" onClick={() => setTab("photo")}>
              <Camera size={26} />
              <strong>Photo Diagnosis</strong>
              <span>Leaf, soil, crop issue</span>
            </button>
            <button className="action-tile" onClick={() => setTab("fertilizer")}>
              <Leaf size={26} />
              <strong>Pindi Advice</strong>
              <span>Fertilizer by stage</span>
            </button>
          </div>

          <SeasonCalendar />
        </section>
      )}

      {tab === "photo" && (
        <section className="screen">
          <h2>Photo Diagnosis</h2>
          <FarmContextForm context={context} updateContext={updateContext} metadata={metadata} compact />
          <label className="upload-zone">
            <Camera size={42} />
            <strong>Take or upload crop photo</strong>
            <span>Photo is sent to FastAPI, then AI runs on backend</span>
            <input type="file" accept="image/*" capture="environment" onChange={onPhotoChange} />
          </label>
          {preview && <img className="preview" src={preview} alt="Uploaded crop preview" />}
          {loading === "photo" && <Loading text="Analyzing photo..." />}
          {diagnosis && <DiagnosisResult diagnosis={diagnosis} />}
        </section>
      )}

      {tab === "fertilizer" && (
        <section className="screen">
          <h2>Pindi Advisor</h2>
          <FarmContextForm context={context} updateContext={updateContext} metadata={metadata} />
          <button className="primary-button" onClick={getFertilizer} disabled={loading === "fertilizer"}>
            {loading === "fertilizer" ? <Loader2 className="spin" size={18} /> : <Leaf size={18} />}
            Get Advice
          </button>
          {fertilizer && <FertilizerResult advice={fertilizer} />}
        </section>
      )}

      {tab === "profile" && (
        <section className="screen">
          <h2>Farm Profile</h2>
          <div className="profile-card">
            <label>Farmer Name
              <input value={profile.name || ""} onChange={(e) => updateProfile("name", e.target.value)} placeholder="Enter farmer name" />
            </label>
            <label>State
              <select value={profile.state || context.state || "AP"} onChange={(e) => updateProfileState(e.target.value)}>
                {STATE_OPTIONS.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
              </select>
            </label>
            <label>District
              <select value={profile.district || context.district} onChange={(e) => updateProfile("district", e.target.value)}>
                {(DISTRICTS_BY_STATE[profile.state || context.state || "AP"] || DISTRICTS_BY_STATE.AP).map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </label>
            <label>Village
              <input value={profile.village || ""} onChange={(e) => updateProfile("village", e.target.value)} placeholder="Enter village name" />
            </label>
          </div>
          <FarmContextForm context={context} updateContext={updateContext} metadata={metadata} />
          <button className="primary-button" onClick={saveProfile}><Save size={18} /> Save Profile</button>
        </section>
      )}

      {error && <div className="toast">{error}</div>}

      <nav className="bottom-nav">
        <NavButton active={tab === "home"} onClick={() => setTab("home")} icon={<Home size={20} />} label="Home" />
        <NavButton active={tab === "photo"} onClick={() => setTab("photo")} icon={<Camera size={20} />} label="Photo" />
        <NavButton active={tab === "fertilizer"} onClick={() => setTab("fertilizer")} icon={<Leaf size={20} />} label="Pindi" />
        <NavButton active={tab === "profile"} onClick={() => setTab("profile")} icon={<UserRound size={20} />} label="Profile" />
      </nav>
    </main>
  );
}

function FarmContextForm({ context, updateContext, metadata, compact = false }) {
  const varieties = metadata?.varieties?.length ? metadata.varieties : [{ name: "BPT 5204", display_name: "BPT 5204" }];
  const seasons = metadata?.seasons?.length ? metadata.seasons : [{ id: "kharif", name: "Kharif", months: "Jun-Oct" }];
  return (
    <div className={compact ? "form-grid compact" : "form-grid"}>
      <label>Crop
        <select value={context.crop_type} onChange={(e) => updateContext("crop_type", e.target.value)}>
          <option value="paddy">Paddy / వరి</option>
          <option value="mirchi">Mirchi / మిర్చి</option>
          <option value="cotton">Cotton / పత్తి</option>
          <option value="sugarcane">Sugarcane / చెరకు</option>
          <option value="millet">Millet / చిరుధాన్యాలు</option>
        </select>
      </label>
      <label>Variety
        <select value={context.variety} onChange={(e) => updateContext("variety", e.target.value)}>
          {varieties.map((v) => <option key={v.id || v.name} value={v.name}>{v.display_name}</option>)}
        </select>
      </label>
      <label>Season
        <select value={context.season} onChange={(e) => updateContext("season", e.target.value)}>
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.name} / {s.months}</option>)}
        </select>
      </label>
      <label>Age days<input type="number" value={context.crop_age_days} onChange={(e) => updateContext("crop_age_days", e.target.value)} /></label>
      <label>Acres<input type="number" step="0.1" value={context.land_acres} onChange={(e) => updateContext("land_acres", e.target.value)} /></label>
      <label>Soil
        <select value={context.soil_type} onChange={(e) => updateContext("soil_type", e.target.value)}>
          <option value="clay">Clay / black</option>
          <option value="red">Red soil</option>
          <option value="sandy">Sandy</option>
          <option value="black">Black cotton</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <label>Water
        <select value={context.water_source} onChange={(e) => updateContext("water_source", e.target.value)}>
          <option value="canal">Canal</option>
          <option value="borewell">Borewell</option>
          <option value="rainfed">Rainfed</option>
          <option value="tank">Tank</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
    </div>
  );
}

function WeatherStrip({ weather }) {
  if (!weather) {
    return <section className="weather-strip">Weather loading...</section>;
  }
  return (
    <section className="weather-strip">
      <strong>{weather.district} weather</strong>
      <span>{weather.temperature_c ?? "-"}°C</span>
      <span>{weather.humidity_pct ?? "-"}% humidity</span>
      <span>{Math.round(weather.forecast_rain_3d_mm ?? 0)} mm rain / 3d</span>
    </section>
  );
}

function DiagnosisResult({ diagnosis }) {
  return (
    <article className="result-card">
      <p className="eyebrow">{diagnosis.source} • confidence {Math.round(diagnosis.confidence * 100)}%</p>
      <h3>{diagnosis.disease}</h3>
      <p className="telugu">{diagnosis.disease_telugu}</p>
      <p className="telugu">{diagnosis.description_telugu}</p>
      <ul>{diagnosis.treatment_steps_telugu.map((step) => <li key={step}>{step}</li>)}</ul>
      <strong className="telugu">{diagnosis.fertilizer_note_telugu}</strong>
    </article>
  );
}

function FertilizerResult({ advice }) {
  return (
    <article className="result-card dark">
      <p className="eyebrow">{advice.source}</p>
      <h3>{advice.stage}</h3>
      <p className="telugu">{advice.stage_telugu}</p>
      {advice.fertilizers.map((item) => (
        <div className="fert-row" key={item.name}>
          <div>
            <strong>{item.name}</strong>
            <span>{item.qty_per_acre_kg} kg/acre</span>
          </div>
          <b>{item.total_qty_kg} kg</b>
        </div>
      ))}
      <p className="telugu">{advice.variety_advice_telugu}</p>
      <p className="telugu">{advice.special_advice_telugu}</p>
      <p className="telugu">{advice.weather_advice_telugu}</p>
      <p className="telugu">{advice.next_action_telugu}</p>
      <div className="savings">Estimated saved: ₹{advice.money_saved_inr}</div>
      <small className="telugu">{advice.safety_note_telugu}</small>
    </article>
  );
}

function SeasonCalendar() {
  const stages = [
    ["0-7", "నాటడం", "Basal fertilizer"],
    ["7-21", "మొలక దశ", "Watch early pests"],
    ["21-45", "చిగుళ్ళ దశ", "First urea split"],
    ["45-65", "కంకి దశ", "Urea + potash"],
    ["65-95", "పూత దశ", "Water management"],
    ["95-125", "కోత దశ", "Stop water before harvest"],
  ];

  return (
    <section className="calendar">
      <h2><CalendarDays size={20} /> Season Calendar</h2>
      {stages.map(([day, name, action]) => (
        <div className="stage" key={day}>
          <b>{day}d</b>
          <div><span className="telugu">{name}</span><small>{action}</small></div>
        </div>
      ))}
    </section>
  );
}

function Loading({ text }) {
  return <div className="loading"><Loader2 className="spin" size={18} /> {text}</div>;
}

function NavButton({ active, onClick, icon, label }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}

createRoot(document.getElementById("root")).render(<App />);
