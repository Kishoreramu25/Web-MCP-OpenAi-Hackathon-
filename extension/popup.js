/**
 * Google Form Auto-Filler Extension Popup Logic
 * Inspects Google Form DOM in active tab, matches fields, injects values, and triggers submission.
 */

const DEFAULT_PROFILE = {
  fullName: 'Kishore Ramu',
  email: 'kishoreramu25@gmail.com',
  phone: '+91 9876543210',
  city: 'Chennai',
  address: '123 Tech Park, Anna Nagar',
  college: 'Anna University',
  degree: 'B.Tech Computer Science',
  company: 'AI Technologies',
  jobTitle: 'Full Stack & AI Engineer',
  experienceYears: '3+',
  linkedinUrl: 'https://linkedin.com/in/kishoreramu',
  githubUrl: 'https://github.com/Kishoreramu25',
  portfolioUrl: 'https://kishoreramu.dev',
  skills: 'Python, React, WebMCP, AI, JavaScript, FastAPI',
  whyHire: 'Passionate software engineer experienced with AI agentic workflows and full-stack development.',
  customFields: [
    { key: 'Expected CTC', value: '12 LPA' },
    { key: 'Notice Period', value: 'Immediate' },
    { key: 'Date of Birth', value: '25/08/2000' }
  ]
};

let activeTabInfo = null;
let currentProfile = { ...DEFAULT_PROFILE };
let detectedFields = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupEventListeners();
  await loadSavedData();
  await checkActiveTab();
});

// Setup Tab Navigation
function setupNavigation() {
  const tabs = [
    { nav: 'tabNavFill', content: 'tabContentFill' },
    { nav: 'tabNavProfile', content: 'tabContentProfile' },
    { nav: 'tabNavConfig', content: 'tabContentConfig' }
  ];

  tabs.forEach(t => {
    const btn = document.getElementById(t.nav);
    if (!btn) return;
    btn.addEventListener('click', () => {
      tabs.forEach(other => {
        document.getElementById(other.nav)?.classList.remove('active');
        document.getElementById(other.content)?.classList.add('hidden');
      });
      btn.classList.add('active');
      document.getElementById(t.content)?.classList.remove('hidden');
    });
  });
}

// Setup Button Listeners
function setupEventListeners() {
  document.getElementById('btnAutoFillAndSubmit')?.addEventListener('click', () => {
    executeAutoFill(true);
  });

  document.getElementById('btnInspectAndFillOnly')?.addEventListener('click', () => {
    const autoSubmit = document.getElementById('chkAutoSubmit')?.checked || false;
    executeAutoFill(autoSubmit);
  });

  document.getElementById('btnClearForm')?.addEventListener('click', async () => {
    if (!activeTabInfo?.id) {
      showStatus('No active Google Form tab found', 'error');
      return;
    }
    showStatus('⏳ Clearing Google Form fields...', 'info');
    try {
      const res = await new Promise((resolve) => {
        chrome.tabs.sendMessage(activeTabInfo.id, { action: 'clearForm' }, (resp) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(resp);
        });
      });
      if (res?.success) {
        showStatus(`✓ Cleared ${res.clearedCount || 0} form fields!`, 'success');
      } else {
        showStatus('✓ Form cleared!', 'success');
      }
    } catch (err) {
      showStatus('Failed to clear form', 'error');
    }
  });

  document.getElementById('btnInspectFields')?.addEventListener('click', () => {
    inspectActiveForm();
  });

  document.getElementById('btnSaveProfile')?.addEventListener('click', () => {
    saveProfileData();
  });

  document.getElementById('btnAddCustomField')?.addEventListener('click', () => {
    addCustomFieldRow('', '');
  });

  document.getElementById('btnSyncBackendProfile')?.addEventListener('click', () => {
    syncWithBackendDB();
  });

  document.getElementById('btnSaveConfig')?.addEventListener('click', () => {
    saveConfigData();
  });

  // Developer External Links Navigation
  const openExternalLink = (url) => {
    try {
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  ['linkDevLinkedin', 'linkDevLinkedinCard'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      openExternalLink('https://www.linkedin.com/in/kishore-ramu/');
    });
  });

  ['linkDevEmail', 'linkDevEmailCard'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      openExternalLink('mailto:ramkisho28@gmail.com');
    });
  });
}

// Show status message banner
function showStatus(msg, type = 'info') {
  const banner = document.getElementById('statusBanner');
  if (!banner) return;
  banner.className = `status-banner ${type}`;
  banner.textContent = msg;
  banner.style.display = 'block';
  setTimeout(() => {
    banner.style.display = 'none';
  }, 4000);
}

// Load saved profile & config from storage
async function loadSavedData() {
  chrome.storage.local.get(['profile', 'apiUrl', 'apiKey'], (result) => {
    if (result.profile) {
      currentProfile = { ...DEFAULT_PROFILE, ...result.profile };
      if (result.profile.customFields) {
        currentProfile.customFields = result.profile.customFields;
      }
    }
    populateProfileForm(currentProfile);

    if (result.apiUrl) {
      document.getElementById('cfgApiUrl').value = result.apiUrl;
    }
    if (result.apiKey) {
      document.getElementById('cfgApiKey').value = result.apiKey;
    }
  });
}

// Add a dynamic custom field row to the UI
function addCustomFieldRow(key = '', value = '') {
  const container = document.getElementById('customFieldsContainer');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'custom-field-row';
  row.innerHTML = `
    <input type="text" class="custom-key" placeholder="Field name / Keyword (e.g. Expected CTC, DOB)" value="${escapeHtml(key)}">
    <input type="text" class="custom-val" placeholder="Value (e.g. 12 LPA, 25/08/2000)" value="${escapeHtml(value)}">
    <button type="button" class="btn-remove-field" title="Remove Field">✕</button>
  `;

  row.querySelector('.btn-remove-field').addEventListener('click', () => {
    row.remove();
  });

  container.appendChild(row);
}

// Populate input fields in Profile tab
function populateProfileForm(p) {
  document.getElementById('profFullName').value = p.fullName || '';
  document.getElementById('profEmail').value = p.email || '';
  document.getElementById('profPhone').value = p.phone || '';
  document.getElementById('profCity').value = p.city || '';
  if (document.getElementById('profAddress')) document.getElementById('profAddress').value = p.address || '';
  document.getElementById('profCollege').value = p.college || '';
  document.getElementById('profDegree').value = p.degree || '';
  document.getElementById('profCompany').value = p.company || '';
  document.getElementById('profJobTitle').value = p.jobTitle || '';
  document.getElementById('profExperience').value = p.experienceYears || '';
  document.getElementById('profLinkedin').value = p.linkedinUrl || '';
  document.getElementById('profGithub').value = p.githubUrl || '';
  document.getElementById('profPortfolio').value = p.portfolioUrl || '';
  document.getElementById('profSkills').value = p.skills || '';
  document.getElementById('profWhyHire').value = p.whyHire || '';

  // Populate dynamic custom fields
  const container = document.getElementById('customFieldsContainer');
  if (container) {
    container.innerHTML = '';
    const customList = p.customFields || DEFAULT_PROFILE.customFields || [];
    customList.forEach(cf => {
      addCustomFieldRow(cf.key, cf.value);
    });
  }

  updateMemoryBadge(p);
}

// Update Local DB Memory Badge counter
function updateMemoryBadge(p) {
  const badge = document.getElementById('dbMemoryCountBadge');
  const timeEl = document.getElementById('dbLastSavedTime');
  if (!badge) return;

  let count = 0;
  const standardKeys = ['fullName', 'email', 'phone', 'city', 'address', 'college', 'degree', 'company', 'jobTitle', 'experienceYears', 'linkedinUrl', 'githubUrl', 'portfolioUrl', 'skills', 'whyHire'];
  standardKeys.forEach(k => {
    if (p[k]) count++;
  });
  if (p.customFields && Array.isArray(p.customFields)) {
    count += p.customFields.length;
  }

  badge.textContent = `💾 ${count} Fields in Local DB`;
}

// Read profile form inputs
function getProfileFromForm() {
  const customFields = [];
  const rows = document.querySelectorAll('.custom-field-row');
  rows.forEach(r => {
    const k = r.querySelector('.custom-key')?.value.trim() || '';
    const v = r.querySelector('.custom-val')?.value.trim() || '';
    if (k && v) {
      customFields.push({ key: k, value: v });
    }
  });

  return {
    fullName: document.getElementById('profFullName').value.trim(),
    email: document.getElementById('profEmail').value.trim(),
    phone: document.getElementById('profPhone').value.trim(),
    city: document.getElementById('profCity').value.trim(),
    address: document.getElementById('profAddress')?.value.trim() || '',
    college: document.getElementById('profCollege').value.trim(),
    degree: document.getElementById('profDegree').value.trim(),
    company: document.getElementById('profCompany').value.trim(),
    jobTitle: document.getElementById('profJobTitle').value.trim(),
    experienceYears: document.getElementById('profExperience').value.trim(),
    linkedinUrl: document.getElementById('profLinkedin').value.trim(),
    githubUrl: document.getElementById('profGithub').value.trim(),
    portfolioUrl: document.getElementById('profPortfolio').value.trim(),
    skills: document.getElementById('profSkills').value.trim(),
    whyHire: document.getElementById('profWhyHire').value.trim(),
    customFields: customFields
  };
}

// Save Profile
function saveProfileData() {
  const saveBtn = document.getElementById('btnSaveProfile');
  const originalText = saveBtn ? saveBtn.innerHTML : '💾 Save Profile';

  const p = getProfileFromForm();
  currentProfile = p;
  
  chrome.storage.local.set({ profile: p }, () => {
    showStatus('✓ Profile and Custom Fields saved successfully in Local DB!', 'success');
    updateMemoryBadge(p);
    const timeEl = document.getElementById('dbLastSavedTime');
    if (timeEl) {
      timeEl.textContent = `✓ Stored in Local DB at ${new Date().toLocaleTimeString()}`;
    }
    if (saveBtn) {
      saveBtn.innerHTML = '✓ Saved in Local DB!';
      saveBtn.style.background = '#10b981';
      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.style.background = '';
      }, 2000);
    }
  });

  // Also sync to local backend if running
  const apiUrl = document.getElementById('cfgApiUrl')?.value || 'http://localhost:3000';
  const apiKey = document.getElementById('cfgApiKey')?.value || 'dev-key-12345';
  fetch(`${apiUrl}/api/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(p)
  }).catch(() => {});
}

// Sync with Backend SQLite DB
async function syncWithBackendDB() {
  const syncBtn = document.getElementById('btnSyncBackendProfile');
  const originalText = syncBtn ? syncBtn.innerHTML : '🔄 Sync with Server DB';

  const apiUrl = document.getElementById('cfgApiUrl')?.value || 'http://localhost:3000';
  const apiKey = document.getElementById('cfgApiKey')?.value || 'dev-key-12345';

  if (syncBtn) syncBtn.innerHTML = '⏳ Syncing...';

  try {
    const res = await fetch(`${apiUrl}/api/profile`, {
      headers: { 'X-API-Key': apiKey }
    });
    const data = await res.json();
    if (data?.data) {
      currentProfile = { ...DEFAULT_PROFILE, ...data.data };
      populateProfileForm(currentProfile);
      chrome.storage.local.set({ profile: currentProfile });
      showStatus('✓ Synchronized profile from Server SQLite DB!', 'success');
      if (syncBtn) {
        syncBtn.innerHTML = '✓ Synced with Server!';
        syncBtn.style.background = '#10b981';
        syncBtn.style.color = 'white';
        setTimeout(() => {
          syncBtn.innerHTML = originalText;
          syncBtn.style.background = '';
          syncBtn.style.color = '';
        }, 2000);
      }
    } else {
      showStatus('✓ Connected, but profile is default', 'info');
      if (syncBtn) syncBtn.innerHTML = originalText;
    }
  } catch (err) {
    showStatus('⚠️ Backend server offline, saved in Chrome DB memory', 'info');
    if (syncBtn) {
      syncBtn.innerHTML = '⚠️ Offline Mode';
      setTimeout(() => { syncBtn.innerHTML = originalText; }, 2000);
    }
  }
}

// Save Config
function saveConfigData() {
  const cfgBtn = document.getElementById('btnSaveConfig');
  const originalText = cfgBtn ? cfgBtn.innerHTML : '💾 Save Config';

  const apiUrl = document.getElementById('cfgApiUrl').value.trim();
  const apiKey = document.getElementById('cfgApiKey').value.trim();
  chrome.storage.local.set({ apiUrl, apiKey }, () => {
    showStatus('✓ Configuration saved!', 'success');
    if (cfgBtn) {
      cfgBtn.innerHTML = '✓ Config Saved!';
      cfgBtn.style.background = '#10b981';
      setTimeout(() => {
        cfgBtn.innerHTML = originalText;
        cfgBtn.style.background = '';
      }, 2000);
    }
  });
}

// Check active browser tab
async function checkActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabInfo = tab;
    const url = tab?.url || '';
    
    const urlDisplay = document.getElementById('activeTabUrl');
    const pill = document.getElementById('tabStatusPill');

    if (urlDisplay) urlDisplay.textContent = url || 'No active tab';

    if (url.includes('docs.google.com/forms') || url.includes('forms.google.com') || url.includes('forms.gle')) {
      if (pill) {
        pill.className = 'status-pill online';
        pill.textContent = '🟢 Google Form Connected';
      }
      inspectActiveForm();
    } else {
      if (pill) {
        pill.className = 'status-pill offline';
        pill.textContent = '⚠️ Not a Google Form';
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Inspect active form elements
async function inspectActiveForm() {
  if (!activeTabInfo?.id) return;
  const url = activeTabInfo.url || '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }
  if (!url.includes('docs.google.com/forms') && !url.includes('forms.google.com') && !url.includes('forms.gle')) {
    return;
  }

  try {
    chrome.tabs.sendMessage(activeTabInfo.id, { action: 'inspectDOM' }, async (response) => {
      if (chrome.runtime.lastError || !response) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTabInfo.id },
            files: ['content.js']
          });
          chrome.tabs.sendMessage(activeTabInfo.id, { action: 'inspectDOM' }, (res2) => {
            if (!chrome.runtime.lastError && res2?.success && res2?.fields) {
              detectedFields = res2.fields;
              renderQuestionsPreview(detectedFields);
              showStatus(`✓ Detected ${detectedFields.length} form questions in DOM!`, 'info');
            }
          });
        } catch (e) {
          // Ignore permission errors on non-supported pages
        }
        return;
      }

      if (response?.success && response?.fields) {
        detectedFields = response.fields;
        renderQuestionsPreview(detectedFields);
        showStatus(`✓ Detected ${detectedFields.length} form questions in DOM!`, 'info');
      }
    });
  } catch (err) {
    // Gracefully handled
  }
}

// Render detected questions in preview list
async function renderQuestionsPreview(fields) {
  const countEl = document.getElementById('detectedCount');
  const listEl = document.getElementById('fieldsPreviewList');
  if (countEl) countEl.textContent = fields.length;
  if (!listEl) return;

  if (fields.length === 0) {
    listEl.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 12px; font-size: 0.78rem;">No form questions detected on this page.</div>';
    return;
  }

  const matches = generateMatches(fields, currentProfile);

  listEl.innerHTML = fields.map((f, idx) => {
    const matchedVal = matches[f.label] || matches[f.id] || (f.options?.length ? '🤖 AI Solving Quiz...' : '(No match in DB)');
    return `
      <div class="field-item">
        <div class="field-item-top">
          <span>${idx + 1}. ${escapeHtml(f.label)} ${f.required ? '<span style="color:#ef4444">*</span>' : ''}</span>
          <span class="field-type-pill">${escapeHtml(f.type || 'text')}</span>
        </div>
        <div class="field-matched-val" id="preview_match_${idx}">↳ Match: "${escapeHtml(String(matchedVal))}"</div>
      </div>
    `;
  }).join('');

  // Asynchronously resolve quiz & unmatched questions via Gemini AI
  const unmatched = fields.filter(f => !matches[f.label] && !matches[f.id]);
  if (unmatched.length > 0) {
    const apiUrl = document.getElementById('cfgApiUrl')?.value || 'http://localhost:3000';
    const apiKey = document.getElementById('cfgApiKey')?.value || 'dev-key-12345';
    try {
      const res = await fetch(`${apiUrl}/api/forms/autofill-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ fields: unmatched, profile: currentProfile })
      });
      const data = await res.json();
      if (data?.data) {
        fields.forEach((f, idx) => {
          const aiVal = data.data[f.id] || data.data[f.label];
          if (aiVal) {
            const el = document.getElementById(`preview_match_${idx}`);
            if (el) el.innerHTML = `↳ AI Answer: "<span style="color:#059669; font-weight:700;">${escapeHtml(String(aiVal))}</span>"`;
          }
        });
      }
    } catch (e) {}
  }
}

// Generate smart match dictionary between questions and profile
function generateMatches(fields, p) {
  const matches = {};

  fields.forEach(f => {
    const lbl = (f.label || '').toLowerCase();
    const opts = f.options || [];
    let val = '';

    // 0. Check for Scraped Answer from DOM Source (FB_PUBLIC_LOAD_DATA_)
    if (f.scrapedAnswer) {
      val = f.scrapedAnswer;
    }

    // Standard profile matchers
    if (!val && (lbl.includes('full name') || lbl.includes('your name') || lbl.includes('candidate name') || lbl.includes('first name') || lbl.includes('name'))) {
      val = p.fullName;
    } else if (!val && (lbl.includes('email') || lbl.includes('e-mail') || lbl.includes('mail'))) {
      val = p.email;
    } else if (lbl.includes('phone') || lbl.includes('mobile') || lbl.includes('contact') || lbl.includes('whatsapp') || lbl.includes('number')) {
      val = p.phone;
    } else if (lbl.includes('linkedin')) {
      val = p.linkedinUrl;
    } else if (lbl.includes('github') || lbl.includes('git')) {
      val = p.githubUrl;
    } else if (lbl.includes('portfolio') || lbl.includes('website') || lbl.includes('link')) {
      val = p.portfolioUrl;
    } else if (lbl.includes('college') || lbl.includes('university') || lbl.includes('institute') || lbl.includes('school')) {
      val = p.college;
    } else if (lbl.includes('degree') || lbl.includes('qualification') || lbl.includes('major') || lbl.includes('course') || lbl.includes('branch')) {
      val = p.degree;
    } else if (lbl.includes('company') || lbl.includes('organization') || lbl.includes('employer') || lbl.includes('work')) {
      val = p.company;
    } else if (lbl.includes('role') || lbl.includes('job title') || lbl.includes('designation') || lbl.includes('position')) {
      val = p.jobTitle;
    } else if (lbl.includes('experience') || lbl.includes('years')) {
      val = p.experienceYears;
    } else if (lbl.includes('skill') || lbl.includes('technologies') || lbl.includes('tech stack')) {
      val = p.skills;
    } else if (lbl.includes('city') || lbl.includes('location')) {
      val = p.city;
    } else if (lbl.includes('address') || lbl.includes('street') || lbl.includes('residence') || lbl.includes('house')) {
      val = p.address || p.city;
    } else if (lbl.includes('comment') || lbl.includes('feedback') || lbl.includes('suggestion') || lbl.includes('remark')) {
      val = 'Looking forward to hearing from you.';
    } else if (lbl.includes('why') || lbl.includes('about') || lbl.includes('cover letter') || lbl.includes('summary')) {
      val = p.whyHire;
    }

    // Dynamic Custom Fields Matcher
    if (!val && p.customFields && Array.isArray(p.customFields)) {
      for (const cf of p.customFields) {
        const customKey = (cf.key || '').toLowerCase().trim();
        if (customKey && (lbl.includes(customKey) || customKey.includes(lbl))) {
          val = cf.value;
          break;
        }
      }
    }

    // Option matching for known profile values
    if (opts.length > 0 && val) {
      const found = opts.find(o => o.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(o.toLowerCase()));
      val = found || '';
    }

    if (val) {
      matches[f.label] = val;
      matches[f.id] = val;
    }
  });

  return matches;
}

// Execute Auto-Fill and Injection directly in DOM
async function executeAutoFill(autoSubmit = false) {
  if (!activeTabInfo?.id) {
    showStatus('No active Google Form tab found', 'error');
    return;
  }

  showStatus('⏳ Analyzing quiz questions and solving with AI...', 'info');

  try {
    // 1. Inspect DOM if not already inspected
    let fields = detectedFields;
    if (!fields || fields.length === 0) {
      const inspectRes = await new Promise((resolve) => {
        chrome.tabs.sendMessage(activeTabInfo.id, { action: 'inspectDOM' }, (res) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res);
        });
      });
      if (inspectRes?.fields) {
        fields = inspectRes.fields;
        detectedFields = fields;
        renderQuestionsPreview(fields);
      }
    }

    // 2. Generate matches from DB Profile
    const matches = generateMatches(fields, currentProfile);

    // 3. For any quiz / unmatched questions, solve with Gemini 2.5 Flash AI
    const unmatchedFields = fields.filter(f => !matches[f.label] && !matches[f.id]);
    if (unmatchedFields.length > 0) {
      const apiUrl = document.getElementById('cfgApiUrl')?.value || 'http://localhost:3000';
      const apiKey = document.getElementById('cfgApiKey')?.value || 'dev-key-12345';
      try {
        const aiRes = await fetch(`${apiUrl}/api/forms/autofill-match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
          body: JSON.stringify({ fields: unmatchedFields, profile: currentProfile })
        });
        const aiData = await aiRes.json();
        if (aiData?.data) {
          unmatchedFields.forEach(f => {
            const aiVal = aiData.data[f.id] || aiData.data[f.label];
            if (aiVal) {
              matches[f.label] = aiVal;
              matches[f.id] = aiVal;
            }
          });
        }
      } catch (err) {
        console.warn('AI Quiz Solver fallback:', err);
      }
    }

    // 4. Inject directly into DOM
    const fillRes = await chrome.tabs.sendMessage(activeTabInfo.id, {
      action: 'injectAndFill',
      data: matches,
      autoSubmit: autoSubmit
    });

    if (fillRes?.success) {
      if (autoSubmit) {
        showStatus(`🎉 Auto-filled ${fillRes.filledCount} fields and submitted Google Form!`, 'success');
      } else {
        showStatus(`✨ Auto-filled ${fillRes.filledCount} fields in Google Form!`, 'success');
      }
    } else {
      showStatus('⚠️ Form filled. Check the active tab!', 'info');
    }
  } catch (err) {
    console.error(err);
    showStatus('❌ Error injecting into DOM. Refresh the Google Form tab and try again.', 'error');
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
