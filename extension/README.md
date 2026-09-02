# Google Form Auto-Filler - Browser Extension

**Chrome/Edge extension for AI-powered Google Form automation**

## Features

✨ **Local Memory Storage**
- Save name, email, phone locally
- Autofill remembered info

🤖 **AI Auto-Fill**
- Analyze form fields
- Fill general questions with Gemini AI
- Submit with one click

🔌 **WebMCP Integration**
- Connects to your backend API
- Secure API key authentication

## Installation

### Dev Mode (Chrome/Edge)

1. Open `chrome://extensions`
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select this `extension/` folder
5. Done!

### Usage

1. Save your personal info (name, email, phone)
2. Set API URL & Key (if using custom backend)
3. Open any Google Form
4. Click extension icon in toolbar
5. Click "Analyze" to preview form
6. Click "Auto-Fill" to fill & submit

## File Structure

```
extension/
├── manifest.json      # Extension config
├── popup.html         # UI popup
├── popup.js           # Popup logic
├── content.js         # Page injection
├── background.js      # Service worker
└── README.md          # This file
```

## Configuration

**Default API:**
- URL: `http://localhost:3000`
- Key: `dev-key-12345`

Change in popup settings if using custom backend.

## Privacy

- ✅ All data stored locally in browser
- ✅ No tracking or analytics
- ✅ No data sent to servers except form responses
- ✅ Open source - audit the code

## Support

Issues? Email: ramkisho28@gmail.com
