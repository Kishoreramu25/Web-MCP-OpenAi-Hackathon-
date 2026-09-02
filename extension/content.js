// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showAnalysis') {
    showOverlay('Analysis', request.data);
  } else if (request.action === 'showSuccess') {
    showOverlay('Success', request.data);
  }
});

function showOverlay(title, data) {
  // Remove existing overlay
  const existing = document.getElementById('autoFillOverlay');
  if (existing) existing.remove();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'autoFillOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 30px;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  `;

  modal.innerHTML = `
    <h2 style="color: #667eea; margin-bottom: 15px;">${title}</h2>
    <pre style="background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem;">${JSON.stringify(data, null, 2)}</pre>
    <button onclick="document.getElementById('autoFillOverlay').remove()" style="
      width: 100%;
      padding: 12px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 15px;
    ">Close</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
