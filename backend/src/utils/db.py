"""
Database manager using SQLite for persistence
"""

import sqlite3
import json
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'forms.db')

DEFAULT_PROFILE = {
    "fullName": "Kishore Ramu",
    "email": "kishoreramu25@gmail.com",
    "phone": "+91 9876543210",
    "address": "123 Tech Park, Anna Nagar",
    "city": "Chennai",
    "college": "Anna University",
    "degree": "B.Tech Computer Science",
    "company": "AI Technologies",
    "jobTitle": "Full Stack & AI Engineer",
    "experienceYears": "3+",
    "skills": "Python, React, WebMCP, JavaScript, Node.js, AI/ML, Fast APIs",
    "linkedinUrl": "https://linkedin.com/in/kishoreramu",
    "githubUrl": "https://github.com/Kishoreramu25",
    "portfolioUrl": "https://kishoreramu.dev",
    "gender": "Male",
    "whyHire": "Passionate software engineer experienced with AI agentic workflows and full-stack development.",
    "customFields": {}
}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_profile (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS submissions (
                    submission_id TEXT PRIMARY KEY,
                    form_url TEXT NOT NULL,
                    response_count INTEGER NOT NULL,
                    data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Seed default profile if not exists
            cursor.execute("SELECT id FROM user_profile WHERE id = 'default'")
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO user_profile (id, data, updated_at) VALUES ('default', ?, ?)",
                    (json.dumps(DEFAULT_PROFILE), datetime.now().isoformat())
                )
            conn.commit()
            logger.info("✓ SQLite Database initialized at " + DB_PATH)
    except Exception as e:
        logger.error(f"Failed to init DB: {e}")

def get_profile(profile_id='default'):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM user_profile WHERE id = ?", (profile_id,))
            row = cursor.fetchone()
            if row:
                return json.loads(row['data'])
    except Exception as e:
        logger.error(f"Failed to get profile: {e}")
    return DEFAULT_PROFILE

def save_profile(profile_data, profile_id='default'):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_profile (id, data, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
            """, (profile_id, json.dumps(profile_data), datetime.now().isoformat()))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Failed to save profile: {e}")
        return False

def record_submission(submission_id, form_url, response_count, payload_data):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO submissions (submission_id, form_url, response_count, data, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (submission_id, form_url, response_count, json.dumps(payload_data), datetime.now().isoformat()))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Failed to save submission: {e}")
        return False
