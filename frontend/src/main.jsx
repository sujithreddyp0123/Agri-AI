import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, Camera, Check, ClipboardList, Home, Leaf, Loader2, Save, Sprout, UserRound, X } from "lucide-react";
import {
  analyzePhoto,
  createCropSeason,
  getDistrictWeather,
  getFarmerHistory,
  getPaddyMetadata,
  recommendFertilizer,
  registerFarmer,
  requestOtp,
  saveDiagnosisFeedback,
  verifyOtp,
} from "./api";
import "./styles.css";

const OTHER_OPTION = "Other / Not listed";
const todayISO = () => new Date().toISOString().slice(0, 10);

const defaultContext = {
  crop_type: "paddy",
  variety: "BPT 5204",
  season: "kharif",
  state: "AP",
  crop_age_days: 25,
  sow_date: todayISO(),
  land_acres: 1,
  soil_type: "clay",
  water_source: "canal",
  district: "Nellore",
  mandal: "Kavali",
  village: "",
  mandal_other: "",
  village_other: "",
  phone: "",
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

const MANDALS_BY_DISTRICT = {
  Nellore: [
    "Allur",
    "Ananthasagaram",
    "Atmakur",
    "Bogole",
    "Buchireddypalem",
    "Chejerla",
    "Dagadarthi",
    "Duttalur",
    "Indukurpet",
    "Jaladanki",
    "Kaligiri",
    "Kavali",
    "Kodavalur",
    "Kondapuram",
    "Kovur",
    "Marripadu",
    "Nellore Rural",
    "Nellore Urban",
    "Podalakur",
    "Sangam",
    "Seetharamapuram",
    "Thotapalligudur",
    "Udayagiri",
    "Muthukur",
    "Vidavalur",
    "Vinjamur",
  ],
  Krishna: ["Vijayawada Rural", "Gudivada", "Pedana", "Machilipatnam", "Avanigadda", "Penamaluru"],
  Guntur: ["Tenali", "Repalle", "Mangalagiri", "Tadikonda", "Prathipadu", "Ponnur"],
  "East Godavari": ["Rajahmundry Rural", "Kakinada Rural", "Amalapuram", "Ramachandrapuram", "Peddapuram"],
  "West Godavari": ["Eluru", "Bhimavaram", "Tadepalligudem", "Tanuku", "Palakollu"],
  Srikakulam: ["Srikakulam", "Amadalavalasa", "Tekkali", "Palasa", "Narasannapeta"],
  Vizianagaram: ["Vizianagaram", "Bobbili", "Parvathipuram", "Cheepurupalli", "Gajapathinagaram"],
  Visakhapatnam: ["Visakhapatnam Rural", "Anakapalle", "Bheemunipatnam", "Pendurthi", "Narsipatnam"],
  Prakasam: ["Ongole", "Kandukur", "Markapur", "Chirala", "Addanki"],
  Kurnool: ["Kurnool", "Nandyal", "Adoni", "Yemmiganur", "Dhone"],
  Kadapa: ["Kadapa", "Proddatur", "Pulivendula", "Rajampet", "Jammalamadugu"],
  Anantapur: ["Anantapur", "Hindupur", "Tadipatri", "Dharmavaram", "Guntakal"],
  Chittoor: ["Chittoor", "Tirupati Rural", "Madanapalle", "Punganur", "Palamaner"],
  Hyderabad: ["Charminar", "Secunderabad", "Amberpet", "Khairatabad", "Nampally"],
  Warangal: ["Warangal", "Hanamkonda", "Narsampet", "Parkal", "Wardhannapet"],
  Karimnagar: ["Karimnagar", "Huzurabad", "Jammikunta", "Manakondur", "Choppadandi"],
  Nizamabad: ["Nizamabad", "Bodhan", "Armoor", "Balkonda", "Dichpally"],
  Khammam: ["Khammam Rural", "Khammam Urban", "Madhira", "Sathupalli", "Wyra"],
  Medak: ["Medak", "Narsapur", "Toopran", "Ramayampet", "Papannapet"],
  Sangareddy: ["Sangareddy", "Zaheerabad", "Narayankhed", "Patancheru", "Andole"],
  Rangareddy: ["Shamshabad", "Chevella", "Ibrahimpatnam", "Rajendranagar", "Shankarpally"],
};

const VILLAGES_BY_MANDAL = {
  Kavali: ["Kavali", "Maddurupadu", "Rudrakota", "Chennayapalem", "Thummalapenta", "Musunuru"],
  "Nellore Rural": ["Kakupalli", "Ambapuram", "Devarapalem", "Kothur", "South Mopur"],
  "Nellore Urban": ["Nellore", "Balaji Nagar", "Stonehouse Pet", "Santhapeta"],
  Kovur: ["Kovur", "Padugupadu", "Inamadugu", "Leguntapadu", "Pothireddypalem"],
  Gudur: ["Gudur", "Chennuru", "Vendodu", "Nellatur", "Kandali"],
  Atmakur: ["Atmakur", "Anumasamudrampeta", "Chejerla", "Marripadu"],
  Naidupeta: ["Naidupeta", "Menakur", "Pudur", "Thummuru"],
  Sullurpeta: ["Sullurpeta", "Mannemutheri", "Mangalampadu", "Damaraya"],
  Udayagiri: ["Udayagiri", "Appasamudram", "Krishnampalli", "Gandipalem"],
  Venkatagiri: ["Venkatagiri", "Althurupadu", "Bangarupeta", "Kalikiri"],
  Buchireddypalem: ["Buchireddypalem", "Jonnawada", "Rebala", "Damaramadugu"],
  Dagadarthi: ["Dagadarthi", "Damavaram", "Velupodu", "Manubolu"],
  Muthukur: ["Muthukur", "Krishnapatnam", "Pynapuram", "Musunuru"],
  Tada: ["Tada", "Sricity", "Konduru", "Ramapuram"],
  Rapur: ["Rapur", "Penubarthi", "Tegacherla", "Gonupalli"],
  "Vijayawada Rural": ["Nidamanuru", "Ramavarappadu", "Prasadampadu", "Gannavaram"],
  Gudivada: ["Gudivada", "Bethavolu", "Seridintakurru", "Chowtapalli"],
  Tenali: ["Tenali", "Angalakuduru", "Burripalem", "Kolakaluru"],
  Repalle: ["Repalle", "Penuganchiprolu", "Gangadipalem", "Morusumilli"],
  "Khammam Rural": ["Edulapuram", "Mallemadugu", "Gollagudem", "Polepalli"],
  "Khammam Urban": ["Khammam", "Burhanpuram", "Rotary Nagar", "Raparthi Nagar"],
  Sangareddy: ["Sangareddy", "Kandi", "Fasalwadi", "Ismailkhanpet"],
  Warangal: ["Warangal", "Enumamula", "Mamnoor", "Kashibugga"],
};

function getDistrictOptions(state) {
  return DISTRICTS_BY_STATE[state] || DISTRICTS_BY_STATE.AP;
}

function getMandalOptions(district) {
  return [...(MANDALS_BY_DISTRICT[district] || []), OTHER_OPTION];
}

function getVillageOptions(mandal) {
  if (!mandal) return [];
  if (mandal === OTHER_OPTION) return [OTHER_OPTION];
  return [...(VILLAGES_BY_MANDAL[mandal] || [mandal]), OTHER_OPTION];
}

function resolvedProfileValue(profile, key) {
  if (key === "mandal" && profile.mandal === OTHER_OPTION) return profile.mandal_other || "";
  if (key === "village" && profile.village === OTHER_OPTION) return profile.village_other || "";
  return profile[key] || "";
}

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
  const [cropSeason, setCropSeason] = useState(() => {
    const saved = localStorage.getItem("agri-ai-crop-season");
    return saved ? JSON.parse(saved) : null;
  });
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(() => localStorage.getItem("agri-ai-otp-verified") === "true");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

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
      mandal: context.mandal,
      farmer_phone: profile.phone,
    }),
    [context, profile.phone],
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
    if (key === "phone" && value !== profile.phone) {
      setOtp("");
      setDevOtp("");
      setOtpVerified(false);
      localStorage.removeItem("agri-ai-otp-verified");
    }
    setProfile((current) => ({ ...current, [key]: value }));
    setContext((current) => ({ ...current, [key]: value }));
  }

  function updateProfileState(value) {
    const nextDistrict = getDistrictOptions(value)[0] || "Nellore";
    const nextMandal = getMandalOptions(nextDistrict)[0] || "";
    const nextVillage = getVillageOptions(nextMandal)[0] || "";
    setProfile((current) => ({
      ...current,
      state: value,
      district: nextDistrict,
      mandal: nextMandal,
      village: nextVillage,
    }));
    setContext((current) => ({
      ...current,
      state: value,
      district: nextDistrict,
      mandal: nextMandal,
      village: nextVillage,
    }));
  }

  function updateProfileDistrict(value) {
    const nextMandal = getMandalOptions(value)[0] || "";
    const nextVillage = getVillageOptions(nextMandal)[0] || "";
    setProfile((current) => ({ ...current, district: value, mandal: nextMandal, village: nextVillage }));
    setContext((current) => ({ ...current, district: value, mandal: nextMandal, village: nextVillage }));
  }

  function updateProfileMandal(value) {
    const nextVillage = getVillageOptions(value)[0] || "";
    setProfile((current) => ({ ...current, mandal: value, village: nextVillage }));
    setContext((current) => ({ ...current, mandal: value, village: nextVillage }));
  }

  async function saveProfile() {
    const next = {
      ...context,
      ...profile,
      mandal: resolvedProfileValue(profile, "mandal") || profile.mandal || context.mandal,
      village: resolvedProfileValue(profile, "village") || profile.village || context.village,
    };

    if (!next.name || !next.phone || !next.village || !next.mandal) {
      setError("Please enter farmer name, phone, mandal, and village.");
      return;
    }

    if (!otpVerified) {
      setError("Please verify phone OTP before saving profile.");
      return;
    }

    setError("");
    setLoading("profile");

    try {
      await registerFarmer({
        name: next.name,
        phone: next.phone,
        village: next.village,
        mandal: next.mandal,
        district: next.district,
      });

      const savedSeason = await createCropSeason({
        farmer_phone: next.phone,
        crop_type: next.crop_type,
        variety: next.variety,
        sow_date: next.sow_date,
        land_acres: Number(next.land_acres),
        soil_type: next.soil_type,
        water_source: next.water_source,
        district: next.district,
        mandal: next.mandal,
      });

      const nextWithStage = {
        ...next,
        crop_age_days: savedSeason.days_since_sowing,
      };

      setProfile(nextWithStage);
      setContext((current) => ({ ...current, ...nextWithStage }));
      setCropSeason(savedSeason);
      localStorage.setItem("agri-ai-profile", JSON.stringify(nextWithStage));
      localStorage.setItem("agri-ai-crop-season", JSON.stringify(savedSeason));
      setTab("home");
    } catch (err) {
      setError("Profile save failed. Check that FastAPI is running.");
    } finally {
      setLoading("");
    }
  }

  async function sendOtp() {
    if (!profile.phone) {
      setError("Enter phone number first.");
      return;
    }

    setError("");
    setLoading("otp");

    try {
      const result = await requestOtp(profile.phone);
      setDevOtp(result.dev_otp || "");
      setError("OTP sent. Use the Dev OTP shown below for local testing.");
    } catch (err) {
      setError("OTP send failed. Check that FastAPI is running.");
    } finally {
      setLoading("");
    }
  }

  async function checkOtp() {
    if (!profile.phone || !otp) {
      setError("Enter phone number and OTP.");
      return;
    }

    setError("");
    setLoading("otp-verify");

    try {
      await verifyOtp(profile.phone, otp);
      setOtpVerified(true);
      setDevOtp("");
      localStorage.setItem("agri-ai-otp-verified", "true");
      setError("Phone verified. You can save the profile now.");
    } catch (err) {
      setError("OTP verification failed. Check the code and try again.");
    } finally {
      setLoading("");
    }
  }

  async function loadHistory() {
    if (!profile.phone) {
      setHistory([]);
      return;
    }

    setError("");
    setLoading("history");

    try {
      const result = await getFarmerHistory(profile.phone);
      setHistory(result);
    } catch (err) {
      setError("History failed to load. Check that FastAPI is running.");
    } finally {
      setLoading("");
    }
  }

  async function submitFeedback(isCorrect) {
    if (!diagnosis?.diagnosis_id) {
      setError("No saved diagnosis id found for feedback.");
      return;
    }

    if (!isCorrect && !feedbackText.trim()) {
      setError("Please type the correct diagnosis or note before marking wrong.");
      return;
    }

    setError("");
    setLoading("feedback");

    try {
      await saveDiagnosisFeedback({
        diagnosis_id: diagnosis.diagnosis_id,
        is_correct: isCorrect,
        farmer_correction_telugu: isCorrect ? null : feedbackText.trim(),
        farmer_phone: profile.phone || null,
      });
      setFeedbackStatus(isCorrect ? "Marked correct" : "Correction saved");
      setDiagnosis((current) => current ? {
        ...current,
        feedback_is_correct: isCorrect ? 1 : 0,
        feedback_correction_telugu: isCorrect ? null : feedbackText.trim(),
      } : current);
      setFeedbackText("");
      if (profile.phone) {
        getFarmerHistory(profile.phone).then(setHistory).catch(() => {});
      }
      setError("Feedback saved. This helps improve Agri AI.");
    } catch (err) {
      setError("Feedback save failed. Check that FastAPI is running.");
    } finally {
      setLoading("");
    }
  }

  async function onPhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setDiagnosis(null);
    setFeedbackStatus("");
    setFeedbackText("");
    setError("");
    setLoading("photo");

    try {
      const result = await analyzePhoto(file, farmContext);
      setDiagnosis(result);
      if (profile.phone) {
        getFarmerHistory(profile.phone).then(setHistory).catch(() => {});
      }
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
              <span>{resolvedProfileValue(profile, "village") || "Add village"} • {resolvedProfileValue(profile, "mandal") || profile.mandal || context.mandal} • {profile.district || context.district} • {profile.state || context.state} • {context.variety} • {context.land_acres} acre</span>
            </div>
            <button className="icon-button" onClick={() => setTab("profile")} aria-label="Edit profile">
              <UserRound size={20} />
            </button>
          </div>
          <WeatherStrip weather={weather} />
          {cropSeason && (
            <section className="stage-summary">
              <p className="eyebrow">Current crop season</p>
              <strong>{cropSeason.current_stage}</strong>
              <span className="telugu">{cropSeason.current_stage_telugu}</span>
              <small>{cropSeason.days_since_sowing} days since sowing • {cropSeason.variety} • {cropSeason.land_acres} acre</small>
            </section>
          )}

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
          <div className="photo-context">
            <span>{context.variety}</span>
            <span>{context.crop_age_days} days</span>
            <span>{context.soil_type} soil</span>
            <span>{context.district}</span>
          </div>
          <div className="photo-tips">
            <strong>Good photo gives better advice</strong>
            <span>Use daylight, focus on one damaged leaf, and avoid blurry long-distance crop photos.</span>
          </div>
          <label className="upload-zone">
            <Camera size={42} />
            <strong>Take or upload crop photo</strong>
            <span>Photo is sent to FastAPI, then AI runs on backend</span>
            <input type="file" accept="image/*" capture="environment" onChange={onPhotoChange} />
          </label>
          {preview && <img className="preview" src={preview} alt="Uploaded crop preview" />}
          {loading === "photo" && <Loading text="Analyzing photo..." />}
          {diagnosis && (
            <DiagnosisResult
              diagnosis={diagnosis}
              feedbackText={feedbackText}
              setFeedbackText={setFeedbackText}
              submitFeedback={submitFeedback}
              loading={loading}
              feedbackStatus={feedbackStatus}
              onViewHistory={() => { setTab("history"); loadHistory(); }}
            />
          )}
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
            <label>Phone
              <input value={profile.phone || ""} onChange={(e) => updateProfile("phone", e.target.value)} inputMode="tel" placeholder="Farmer mobile number" />
            </label>
            <div className="otp-row">
              <button className="secondary-button" onClick={sendOtp} disabled={loading === "otp"}>
                {loading === "otp" ? "Sending..." : "Send OTP"}
              </button>
              <span className={otpVerified ? "status-ok" : "status-muted"}>
                {otpVerified ? "Phone verified" : "Not verified"}
              </span>
            </div>
            {devOtp && <div className="dev-otp">Dev OTP: <strong>{devOtp}</strong></div>}
            {!otpVerified && devOtp && (
              <div className="otp-row">
                <label>Enter OTP
                  <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder="6 digit OTP" />
                </label>
                <button className="secondary-button" onClick={checkOtp} disabled={loading === "otp-verify"}>
                  {loading === "otp-verify" ? "Checking..." : "Verify"}
                </button>
              </div>
            )}
            <label>State
              <select value={profile.state || context.state || "AP"} onChange={(e) => updateProfileState(e.target.value)}>
                {STATE_OPTIONS.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
              </select>
            </label>
            <label>District
              <select value={profile.district || context.district} onChange={(e) => updateProfileDistrict(e.target.value)}>
                {getDistrictOptions(profile.state || context.state || "AP").map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </label>
            <label>Mandal
              <select value={profile.mandal || context.mandal || ""} onChange={(e) => updateProfileMandal(e.target.value)}>
                {getMandalOptions(profile.district || context.district).map((mandal) => (
                  <option key={mandal} value={mandal}>{mandal}</option>
                ))}
              </select>
            </label>
            {(profile.mandal || context.mandal) === OTHER_OPTION && (
              <label>Mandal Name
                <input
                  value={profile.mandal_other || ""}
                  onChange={(e) => updateProfile("mandal_other", e.target.value)}
                  placeholder="Type mandal name"
                />
              </label>
            )}
            <label>Village
              <select value={profile.village || context.village || ""} onChange={(e) => updateProfile("village", e.target.value)}>
                {getVillageOptions(profile.mandal || context.mandal).map((village) => (
                  <option key={village} value={village}>{village}</option>
                ))}
              </select>
            </label>
            {(profile.village || context.village) === OTHER_OPTION && (
              <label>Village Name
                <input
                  value={profile.village_other || ""}
                  onChange={(e) => updateProfile("village_other", e.target.value)}
                  placeholder="Type village name"
                />
              </label>
            )}
          </div>
          <FarmContextForm context={context} updateContext={updateContext} metadata={metadata} />
          <label>Sowing Date
            <input type="date" value={context.sow_date || todayISO()} onChange={(e) => updateProfile("sow_date", e.target.value)} />
          </label>
          <button className="primary-button" onClick={saveProfile} disabled={loading === "profile"}>
            {loading === "profile" ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            Save Profile
          </button>
        </section>
      )}

      {tab === "history" && (
        <section className="screen">
          <div className="screen-title-row">
            <h2>Diagnosis History</h2>
            <button className="secondary-button" onClick={loadHistory} disabled={loading === "history"}>
              {loading === "history" ? "Loading..." : "Refresh"}
            </button>
          </div>
          {!profile.phone && <p className="empty-state">Save profile with phone number first.</p>}
          {profile.phone && history.length === 0 && <p className="empty-state">No saved diagnoses yet.</p>}
          {history.map((item) => <HistoryItem key={item.id} item={item} />)}
        </section>
      )}

      {error && <div className="toast">{error}</div>}

      <nav className="bottom-nav">
        <NavButton active={tab === "home"} onClick={() => setTab("home")} icon={<Home size={20} />} label="Home" />
        <NavButton active={tab === "photo"} onClick={() => setTab("photo")} icon={<Camera size={20} />} label="Photo" />
        <NavButton active={tab === "fertilizer"} onClick={() => setTab("fertilizer")} icon={<Leaf size={20} />} label="Pindi" />
        <NavButton active={tab === "profile"} onClick={() => setTab("profile")} icon={<UserRound size={20} />} label="Profile" />
        <NavButton active={tab === "history"} onClick={() => { setTab("history"); loadHistory(); }} icon={<ClipboardList size={20} />} label="History" />
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

function DiagnosisResult({ diagnosis, feedbackText, setFeedbackText, submitFeedback, loading, feedbackStatus, onViewHistory }) {
  const confidencePct = Math.round((diagnosis.confidence || 0) * 100);
  const severity = diagnosis.severity || "unknown";
  const hasFeedback = feedbackStatus || diagnosis.feedback_is_correct !== undefined;

  return (
    <article className="result-card">
      <p className="eyebrow">{diagnosis.source} • confidence {Math.round(diagnosis.confidence * 100)}%</p>
      <div className="result-heading">
        <h3>{diagnosis.disease}</h3>
        <span className={`severity ${severity}`}>{severity}</span>
      </div>
      <div className="confidence-meter" aria-label={`Confidence ${confidencePct}%`}>
        <span style={{ width: `${confidencePct}%` }} />
      </div>
      <p className="telugu">{diagnosis.disease_telugu}</p>
      <p className="telugu">{diagnosis.description_telugu}</p>
      {diagnosis.needs_expert_review && (
        <div className="review-alert">Expert review needed before acting on this advice.</div>
      )}
      {!diagnosis.needs_expert_review && (
        <div className="review-ok">AI is reasonably confident. Still confirm with local expert for pesticide decisions.</div>
      )}
      <ul>{diagnosis.treatment_steps_telugu.map((step) => <li key={step}>{step}</li>)}</ul>
      <strong className="telugu">{diagnosis.fertilizer_note_telugu}</strong>
      {diagnosis.diagnosis_id && <small className="diagnosis-id">ID: {diagnosis.diagnosis_id}</small>}
      <div className="feedback-box">
        <div className="feedback-heading">
          <strong>Was this diagnosis correct?</strong>
          {hasFeedback && <span className="feedback-saved">{feedbackStatus || "Feedback saved"}</span>}
        </div>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="If wrong, type the correction here. Example: This is zinc deficiency, not blast."
        />
        <div className="feedback-actions">
          <button className="secondary-button success" onClick={() => submitFeedback(true)} disabled={loading === "feedback"}>
            <Check size={16} /> Correct
          </button>
          <button className="secondary-button danger" onClick={() => submitFeedback(false)} disabled={loading === "feedback"}>
            <X size={16} /> Wrong
          </button>
        </div>
        <button className="history-link-button" onClick={onViewHistory}>View saved diagnosis history</button>
      </div>
    </article>
  );
}

function HistoryItem({ item }) {
  const confidencePct = Math.round((item.confidence || 0) * 100);
  const created = item.created_at ? new Date(item.created_at).toLocaleString() : "";
  const feedbackLabel = item.feedback_is_correct === null || item.feedback_is_correct === undefined
    ? "Not reviewed"
    : item.feedback_is_correct
      ? "Correct"
      : "Wrong";

  return (
    <article className="history-item">
      <div>
        <strong>{item.disease_detected || "Unknown diagnosis"}</strong>
        <p className="telugu">{item.disease_telugu || "తెలియదు"}</p>
        <small>{item.variety} - {item.crop_age_days} days - {confidencePct}% confidence</small>
      </div>
      <span className={`severity ${item.severity || "unknown"}`}>{item.severity || "unknown"}</span>
      <span className={`feedback-pill ${item.feedback_is_correct === 0 ? "wrong" : item.feedback_is_correct === 1 ? "correct" : ""}`}>
        {feedbackLabel}
      </span>
      {item.feedback_correction_telugu && <p className="correction-note">{item.feedback_correction_telugu}</p>}
      {item.needs_expert_review ? <em>Needs expert review</em> : <em>AI confident</em>}
      <small>{created}</small>
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
