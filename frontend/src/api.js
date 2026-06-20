const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function recommendFertilizer(payload) {
  const response = await fetch(`${API_BASE}/api/fertilizer/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Fertilizer API failed");
  }

  return response.json();
}

export async function registerFarmer(payload) {
  const response = await fetch(`${API_BASE}/api/farmer/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Farmer registration failed");
  }

  return response.json();
}

export async function createCropSeason(payload) {
  const response = await fetch(`${API_BASE}/api/farmer/crop-season`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Crop season save failed");
  }

  return response.json();
}

export async function requestOtp(phone) {
  const response = await fetch(`${API_BASE}/api/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  if (!response.ok) {
    throw new Error("OTP request failed");
  }

  return response.json();
}

export async function verifyOtp(phone, otp) {
  const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp }),
  });

  if (!response.ok) {
    throw new Error("OTP verification failed");
  }

  return response.json();
}

export async function getFarmerHistory(phone) {
  const response = await fetch(`${API_BASE}/api/farmer/${encodeURIComponent(phone)}/history`);

  if (!response.ok) {
    throw new Error("Farmer history failed");
  }

  return response.json();
}

export async function saveDiagnosisFeedback(payload) {
  const response = await fetch(`${API_BASE}/api/diagnosis/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Diagnosis feedback failed");
  }

  return response.json();
}

export async function getPaddyMetadata() {
  const response = await fetch(`${API_BASE}/api/paddy/metadata`);
  if (!response.ok) {
    throw new Error("Paddy metadata API failed");
  }
  return response.json();
}

export async function getDistrictWeather(district) {
  const response = await fetch(`${API_BASE}/api/weather/${encodeURIComponent(district || "Nellore")}`);
  if (!response.ok) {
    throw new Error("Weather API failed");
  }
  return response.json();
}

export async function analyzePhoto(file, context) {
  const form = new FormData();
  form.append("photo", file);
  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      form.append(key, String(value));
    }
  });

  const response = await fetch(`${API_BASE}/api/diagnosis/analyze-photo`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error("Photo diagnosis API failed");
  }

  return response.json();
}
