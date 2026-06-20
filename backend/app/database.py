import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DB_PATH = Path(__file__).resolve().parents[1] / "agri_ai.db"


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS farmers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL UNIQUE,
                village TEXT NOT NULL,
                mandal TEXT NOT NULL,
                district TEXT NOT NULL DEFAULT 'Nellore',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crop_seasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                farmer_phone TEXT NOT NULL,
                crop_type TEXT NOT NULL,
                variety TEXT NOT NULL,
                sow_date TEXT NOT NULL,
                land_acres REAL NOT NULL,
                soil_type TEXT NOT NULL,
                water_source TEXT NOT NULL,
                district TEXT NOT NULL,
                mandal TEXT,
                current_stage TEXT NOT NULL,
                current_stage_telugu TEXT NOT NULL,
                days_since_sowing INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS diagnosis_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                diagnosis_id TEXT NOT NULL,
                is_correct INTEGER NOT NULL,
                farmer_correction_telugu TEXT,
                farmer_phone TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS diagnoses (
                id TEXT PRIMARY KEY,
                farmer_phone TEXT,
                crop_type TEXT,
                variety TEXT,
                crop_age_days INTEGER,
                disease_detected TEXT,
                disease_telugu TEXT,
                severity TEXT,
                confidence REAL,
                needs_expert_review INTEGER,
                photo_path TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS otp_codes (
                phone TEXT PRIMARY KEY,
                otp TEXT NOT NULL,
                verified INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT NOT NULL
            )
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict:
    return {key: row[key] for key in row.keys()}
