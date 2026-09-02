// Load saved config
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['name', 'email', 'phone', 'apiUrl', 'apiKey'], (data) => {
    if (data.name) document.getElementById('name').value = data.name;
    if (data.email) document.getElementById('email').value = data.email;
    if (data.phone) document.getElementById('phone').value = data.phone;
    if (data.apiUrl) document.getElementById('apiUrl').value = data.apiUrl;
    if (data.apiKey) document.getElementById('apiKey').value = data.apiKey;
  });
});

function showStatus(msg, type = 'info') {
  const status = document.getElementById('status');
  status.className = `status ${type}`;
  status.textContent = msg;
  setTimeout(() => { status.textContent = ''; }, 3000);
}

function saveMemory() {
  const data = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    apiUrl: document.getElementById('apiUrl').value,
    apiKey: document.getElementById('apiKey').value
  };
  chrome.storage.local.set(data, () => {
    showStatus('✓ Saved to memory', 'success');
  });
}

function clearMemory() {
  if (confirm('Clear all saved data?')) {
    chrome.storage.local.clear(() => {
      document.getElementById('name').value = '';
      document.getElementById('email').value = '';
      document.getElementById('phone').value = '';
      showStatus('✓ Memory cleared', 'success');
    });
  }
}

function viewMemory() {
  chrome.storage.local.get(null, (data) => {
    const entries = Object.entries(data)
      .filter(([k]) => ['name', 'email', 'phone'].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    alert('Saved Info:\n' + (entries || 'Empty'));
  });
}

function loading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

async function analyzeForm() {
  loading(true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const formUrl = tab.url;

    if (!formUrl.includes('forms.google.com') && !formUrl.includes('docs.google.com/forms')) {
      showStatus('❌ Not a Google Form', 'error');
      return;
    }

    const apiUrl = document.getElementById('apiUrl').value || 'http://localhost:3000';
    const apiKey = document.getElementById('apiKey').value || 'dev-key-12345';

    const res = await fetch(`${apiUrl}/api/forms/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ formUrl })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showStatus(`✓ Found ${data.data.fields.length} fields`, 'success');
    
    // Send to content script
    chrome.tabs.sendMessage(tab.id, { action: 'showAnalysis', data: data.data });
  } catch (err) {
    showStatus(`❌ ${err.message}`, 'error');
  } finally {
    loading(false);
  }
}

async function autoFill() {
  loading(true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const formUrl = tab.url;

    if (!formUrl.includes('forms.google.com') && !formUrl.includes('docs.google.com/forms')) {
      showStatus('❌ Not a Google Form', 'error');
      return;
    }

    const apiUrl = document.getElementById('apiUrl').value || 'http://localhost:3000';
    const apiKey = document.getElementById('apiKey').value || 'dev-key-12345';

    // Combine saved memory + prompt for general responses
    const responses = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value
    };

    const res = await fetch(`${apiUrl}/api/forms/fill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ formUrl, responses })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showStatus(`✓ Submission: ${data.submissionId}`, 'success');
    chrome.tabs.sendMessage(tab.id, { action: 'showSuccess', data: data });
  } catch (err) {
    showStatus(`❌ ${err.message}`, 'error');
  } finally {
    loading(false);
  }
}
