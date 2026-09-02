-- WebMCP Form Auto-Filler Schema

CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    college TEXT,
    degree TEXT,
    company TEXT,
    job_title TEXT,
    experience_years TEXT,
    skills TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    portfolio_url TEXT,
    custom_data TEXT, -- JSON blob for flexible custom fields
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
    submission_id TEXT PRIMARY KEY,
    form_url TEXT NOT NULL,
    response_count INTEGER NOT NULL,
    payload TEXT,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
