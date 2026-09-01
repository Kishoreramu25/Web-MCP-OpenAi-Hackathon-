# Google Form Auto-Filler - WebMCP Challenge

## Problem
Users waste time manually filling repetitive Google Forms (surveys, registrations, applications, feedback forms). Each form requires clicking, typing, and navigating through multiple fields—a tedious, error-prone process.

## Solution
An AI-powered agent that uses **WebMCP** to automatically read Google Form questions, intelligently fill answers, and submit forms in a single click.

## How It Works
1. **User inputs** form URL and desired responses
2. **Agent reads** form structure via WebMCP tools
3. **Agent fills** fields automatically (text, dropdowns, checkboxes, etc.)
4. **Agent submits** the form
5. **Results tracked** in database for auditing

## WebMCP Leverage
Uses WebMCP tools to:
- Access and parse Google Forms
- Fill form inputs dynamically
- Submit forms programmatically
- Track submission history

Instead of manual clicking through 6+ screens, agent completes entire form in one turn.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + WebMCP SDK
- **Database**: SQLite (schema in `/db`)
- **AI**: Claude API + WebMCP integration

## Features
✅ Auto-detect form fields (text, select, checkbox, radio)
✅ Intelligent answer matching
✅ Batch form filling
✅ Submission history tracking
✅ Error handling & retry logic
✅ Demo video showing agent in action

## Project Impact
- **Real problem**: Save hours on repetitive form submissions
- **Real audience**: Students, professionals, HR teams, researchers
- **Real solution**: Working agent that handles actual Google Forms

## Getting Started

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database
```bash
cd db
sqlite3 forms.db < schema.sql
```

## Demo
Watch agent auto-fill a 10-field form in <60 seconds.

## Team
Built for WebMCP Challenge (Sept 3, 2026 deadline)

## License
MIT
