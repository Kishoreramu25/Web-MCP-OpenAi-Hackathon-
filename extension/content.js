/**
 * Google Form Auto-Filler & Quiz Solver Content Script
 * Directly inspects Google Form DOM, extracts questions & options,
 * and injects matched / AI-solved values into DOM.
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'inspectDOM') {
      const fields = inspectFormDOM();
      sendResponse({ success: true, fields: fields });
      return false;
    }
    
    if (request.action === 'injectAndFill') {
      const result = injectValuesIntoDOM(request.data, request.autoSubmit);
      sendResponse(result || { success: true });
      return false;
    }
    
    if (request.action === 'submitForm') {
      const result = triggerFormSubmit();
      sendResponse(result || { success: true });
      return false;
    }

    if (request.action === 'clearForm') {
      const result = clearGoogleFormDOM();
      sendResponse(result || { success: true });
      return false;
    }
  } catch (err) {
    console.error('Content script error:', err);
    sendResponse({ success: false, error: err?.message || 'Error executing action' });
    return false;
  }
  return false;
});

/**
 * Scrapes Google Forms FB_PUBLIC_LOAD_DATA_ from script tags
 */
function extractFBDataFromDOM() {
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const s of scripts) {
    const text = s.textContent || '';
    if (text.includes('FB_PUBLIC_LOAD_DATA_')) {
      const match = text.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]+?\]);\s*(?:var\s|<\/script>|$)/);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1]);
        } catch (e) {
          try {
            return (new Function(`return ${match[1]}`))();
          } catch (e2) {}
        }
      }
    }
  }
  return null;
}

/**
 * Deep search for correct quiz answers inside Google Form question data structures
 */
function findAnswerInGoogleFormData(entryMeta, options) {
  if (!entryMeta) return null;

  try {
    // Check 1: Option-level correct flags (e.g. opt[4] === 1 or opt[2] === 1)
    const optList = entryMeta[1];
    if (Array.isArray(optList)) {
      for (const opt of optList) {
        if (Array.isArray(opt)) {
          const optText = opt[0];
          // Check if flagged as correct
          if (opt[4] === 1 || opt[4] === true || opt[2] === 1 || opt[3] === 1) {
            if (optText) return optText;
          }
        }
      }
    }

    // Check 2: Key array in entryMeta[4] or entryMeta[8] or entryMeta[5]
    for (const keyIdx of [8, 4, 2, 5, 6, 7]) {
      const val = entryMeta[keyIdx];
      if (typeof val === 'string' && val.trim() && options.some(o => o.toLowerCase() === val.toLowerCase().trim())) {
        return val.trim();
      }
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string' && options.some(o => o.toLowerCase() === item.toLowerCase().trim())) {
            return item.trim();
          }
          if (Array.isArray(item)) {
            for (const sub of item) {
              if (typeof sub === 'string' && options.some(o => o.toLowerCase() === sub.toLowerCase().trim())) {
                return sub.trim();
              }
              if (Array.isArray(sub) && typeof sub[0] === 'string' && options.some(o => o.toLowerCase() === sub[0].toLowerCase().trim())) {
                return sub[0].trim();
              }
            }
          }
        }
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Inspect Google Form DOM elements & Scrape Script Data
 */
function inspectFormDOM() {
  const detected = [];
  const fbData = extractFBDataFromDOM();
  const fbQuestions = (fbData && fbData[1] && Array.isArray(fbData[1][1])) ? fbData[1][1] : [];

  const questionBlocks = document.querySelectorAll('div[role="listitem"], .geS5n, .Qr7Oae, .freebirdFormviewerViewNumberedItemContainer');

  questionBlocks.forEach((block, index) => {
    // 1. Question Title / Heading
    const titleEl = block.querySelector('div[role="heading"], .M7eMe, .freebirdFormviewerComponentsQuestionBaseTitle, span.HoLwm');
    if (!titleEl) return;

    const label = titleEl.innerText.replace(/\s*\*$/, '').trim();
    const isRequired = !!block.querySelector('.v3Yvs, [aria-label*="Required" i], .freebirdFormviewerComponentsQuestionBaseRequiredAsterisk') || titleEl.innerText.includes('*');

    // 2. Identify Question Type and Extract Choices
    let type = 'text';
    const options = [];
    let scrapedAnswer = null;

    const textInput = block.querySelector('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"], input[type="date"], input.whsOnd');
    const textarea = block.querySelector('textarea, .KHxj8b');
    const radios = block.querySelectorAll('div[role="radio"]');
    const checkboxes = block.querySelectorAll('div[role="checkbox"]');
    const listbox = block.querySelector('div[role="listbox"]');

    if (textarea) {
      type = 'textarea';
    } else if (radios && radios.length > 0) {
      type = 'radio';
      radios.forEach(r => {
        const container = r.closest('.docssharedWizToggleLabeledContainer, .oy7zP, div[role="presentation"]') || r.parentElement;
        const textEl = container?.querySelector('.aDTYNe, .docssharedWizToggleLabeledPrimaryText, span.M7eMe, label');
        const optText = (textEl?.innerText || r.getAttribute('data-value') || container?.innerText || r.innerText || '').trim();
        if (optText && !options.includes(optText)) {
          options.push(optText);
        }
      });
    } else if (checkboxes && checkboxes.length > 0) {
      type = 'checkbox';
      checkboxes.forEach(c => {
        const container = c.closest('.docssharedWizToggleLabeledContainer, .oy7zP, div[role="presentation"]') || c.parentElement;
        const textEl = container?.querySelector('.aDTYNe, .docssharedWizToggleLabeledPrimaryText, span.M7eMe, label');
        const optText = (textEl?.innerText || c.getAttribute('data-value') || container?.innerText || c.innerText || '').trim();
        if (optText && !options.includes(optText)) {
          options.push(optText);
        }
      });
    } else if (listbox) {
      type = 'select';
      const optElements = listbox.querySelectorAll('div[role="option"]');
      optElements.forEach(o => {
        const optText = (o.getAttribute('data-value') || o.innerText || '').trim();
        if (optText && !options.includes(optText)) {
          options.push(optText);
        }
      });
    } else if (textInput) {
      if (textInput.type === 'email' || label.toLowerCase().includes('email')) {
        type = 'email';
      } else {
        type = 'text';
      }
    }

    // 3. Scrape Answer from block's data-params HTML attribute
    const dataParams = block.getAttribute('data-params') || block.querySelector('[data-params]')?.getAttribute('data-params');
    if (dataParams && dataParams.startsWith('%.@.')) {
      try {
        const parsed = JSON.parse(dataParams.substring(4));
        if (parsed && parsed[4] && parsed[4][0]) {
          scrapedAnswer = findAnswerInGoogleFormData(parsed[4][0], options);
        }
      } catch (e) {}
    }

    // 4. Scrape Answer from FB_PUBLIC_LOAD_DATA_ script tag
    if (!scrapedAnswer && fbQuestions && fbQuestions[index]) {
      const qMeta = fbQuestions[index];
      if (qMeta && qMeta[4] && qMeta[4][0]) {
        scrapedAnswer = findAnswerInGoogleFormData(qMeta[4][0], options);
      }
    }

    detected.push({
      index: index,
      label: label,
      type: type,
      required: isRequired,
      options: options,
      scrapedAnswer: scrapedAnswer,
      id: `field_${index + 1}`
    });
  });

  return detected;
}

/**
 * Directly inject values into Google Form DOM
 */
function injectValuesIntoDOM(matches, autoSubmit = false) {
  injectGoogleFormFixStyles();
  let filledCount = 0;
  const questionBlocks = document.querySelectorAll('div[role="listitem"], .geS5n, .Qr7Oae, .freebirdFormviewerViewNumberedItemContainer');

  questionBlocks.forEach((block, index) => {
    const titleEl = block.querySelector('div[role="heading"], .M7eMe, .freebirdFormviewerComponentsQuestionBaseTitle, span.HoLwm');
    if (!titleEl) return;

    const rawLabel = titleEl.innerText.trim();
    const cleanLabel = rawLabel.replace(/\s*\*$/, '').trim().toLowerCase();
    const fieldId = `field_${index + 1}`;
    
    // Priority 1: Exact Field ID (field_1, field_2, etc.)
    let valueToInject = matches[fieldId];

    // Priority 2: Full question text match
    if (valueToInject === undefined || valueToInject === null) {
      valueToInject = matches[rawLabel] || matches[cleanLabel];
    }

    // Priority 3: Fuzzy key match
    if (valueToInject === undefined || valueToInject === null) {
      for (const [key, val] of Object.entries(matches)) {
        const k = key.toLowerCase().trim();
        if (k === cleanLabel) {
          valueToInject = val;
          break;
        }
      }
    }

    if (valueToInject === undefined || valueToInject === null || valueToInject === '') {
      return;
    }

    let fieldFilled = false;

    // 1. Text Inputs & Textareas
    const textInput = block.querySelector('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"], input[type="date"], input.whsOnd');
    const textarea = block.querySelector('textarea, .KHxj8b');
    const targetInput = textInput || textarea;

    if (targetInput) {
      setGoogleFormInput(targetInput, String(valueToInject), block);
      fieldFilled = true;
    }

    // 2. Radio Buttons (Multiple Choice / Quiz)
    const radios = block.querySelectorAll('div[role="radio"]');
    if (radios.length > 0) {
      const targetStr = String(valueToInject).toLowerCase().trim();
      let matchedRadio = null;

      // Pass 1: Exact option text match
      for (const radio of radios) {
        const container = radio.closest('.docssharedWizToggleLabeledContainer, .oy7zP, div[role="presentation"]') || radio.parentElement;
        const textEl = container?.querySelector('.aDTYNe, .docssharedWizToggleLabeledPrimaryText, span.M7eMe, label');
        const optText = (textEl?.innerText || radio.getAttribute('data-value') || container?.innerText || radio.innerText || '').toLowerCase().trim();
        
        if (optText === targetStr) {
          matchedRadio = radio;
          break;
        }
      }

      // Pass 2: Substring option match
      if (!matchedRadio) {
        for (const radio of radios) {
          const container = radio.closest('.docssharedWizToggleLabeledContainer, .oy7zP, div[role="presentation"]') || radio.parentElement;
          const textEl = container?.querySelector('.aDTYNe, .docssharedWizToggleLabeledPrimaryText, span.M7eMe, label');
          const optText = (textEl?.innerText || radio.getAttribute('data-value') || container?.innerText || radio.innerText || '').toLowerCase().trim();
          
          if (optText && targetStr && (optText.includes(targetStr) || targetStr.includes(optText))) {
            matchedRadio = radio;
            break;
          }
        }
      }

      // Pass 3: Option Letter match (e.g. "A", "B", "C", "D")
      if (!matchedRadio) {
        const letterMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, '1': 0, '2': 1, '3': 2, '4': 3 };
        const cleanLetter = targetStr.replace(/[^a-d1-4]/g, '');
        if (cleanLetter && letterMap[cleanLetter] !== undefined && radios[letterMap[cleanLetter]]) {
          matchedRadio = radios[letterMap[cleanLetter]];
        }
      }

      if (matchedRadio) {
        matchedRadio.focus();
        matchedRadio.click();
        const container = matchedRadio.closest('.docssharedWizToggleLabeledContainer, .oy7zP, div[role="presentation"]') || matchedRadio.parentElement;
        if (container && container !== matchedRadio) {
          container.click();
        }
        matchedRadio.setAttribute('aria-checked', 'true');
        fieldFilled = true;
      }
    }

    // 3. Checkboxes
    const checkboxes = block.querySelectorAll('div[role="checkbox"]');
    if (checkboxes.length > 0) {
      const targetVal = String(valueToInject).toLowerCase().trim();
      checkboxes.forEach(cb => {
        const container = cb.closest('.docssharedWizToggleLabeledContainer, .oy7zP, div[role="presentation"]') || cb.parentElement;
        const textEl = container?.querySelector('.aDTYNe, .docssharedWizToggleLabeledPrimaryText, span.M7eMe, label');
        const cVal = (textEl?.innerText || cb.getAttribute('data-value') || container?.innerText || cb.innerText || '').toLowerCase().trim();
        
        if (cVal === targetVal || (cVal && targetVal && (targetVal.includes(cVal) || cVal.includes(targetVal)))) {
          cb.focus();
          cb.click();
          if (container && container !== cb) {
            container.click();
          }
          cb.setAttribute('aria-checked', 'true');
          fieldFilled = true;
        }
      });
    }

    // 4. Dropdowns (Listbox)
    const listbox = block.querySelector('div[role="listbox"]');
    if (listbox) {
      listbox.click();
      setTimeout(() => {
        const options = document.querySelectorAll('div[role="option"]');
        options.forEach(opt => {
          const optText = (opt.getAttribute('data-value') || opt.innerText || '').toLowerCase().trim();
          const targetStr = String(valueToInject).toLowerCase().trim();
          if (optText === targetStr || optText.includes(targetStr) || targetStr.includes(optText)) {
            opt.click();
            fieldFilled = true;
          }
        });
      }, 150);
    }

    if (fieldFilled) {
      filledCount++;
    }
  });

  // Display in-page banner
  showToastBanner(`✨ Auto-filled ${filledCount} fields in Google Form!`);

  // Handle auto-submission
  if (autoSubmit) {
    showToastBanner(`🚀 Submitting Google Form automatically in 1 second...`);
    setTimeout(() => {
      triggerFormSubmit();
    }, 1000);
  }

  return { success: true, filledCount: filledCount, autoSubmitted: autoSubmit };
}

/**
 * Injects persistent CSS to completely eliminate Google Form ghost placeholders and errors
 */
function injectGoogleFormFixStyles() {
  if (document.getElementById('webmcp-clean-styles')) return;
  const style = document.createElement('style');
  style.id = 'webmcp-clean-styles';
  style.textContent = `
    /* 1. Completely hide ghost placeholder label "Your answer" when input has content */
    .rFrNMe.CDELXb .nd90Mw,
    .rFrNMe.has-value .nd90Mw,
    .rFrNMe.is-focused .nd90Mw,
    .CDELXb .Ax4du,
    .has-value .Ax4du,
    .CDELXb .snByac,
    .has-value .snByac,
    .webmcp-hidden-placeholder {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      height: 0 !important;
      font-size: 0 !important;
      line-height: 0 !important;
      pointer-events: none !important;
    }
    /* 2. Crisp, solid input text rendering */
    input.whsOnd, textarea.KHxj8b {
      color: #1f2937 !important;
      font-weight: 500 !important;
      opacity: 1 !important;
      z-index: 5 !important;
      position: relative !important;
    }
    /* 3. Hide red required error banner when filled */
    .has-value ~ .RHiOh,
    .CDELXb ~ .RHiOh,
    .webmcp-error-cleared {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Safe and crisp Google Form input setter:
 * Sets input value, dispatches input events, transitions Google Form container to active state,
 * and hides only the leaf placeholder element (.nd90Mw) so text is clean and never destroyed.
 */
function setGoogleFormInput(input, value, block) {
  if (!input || value === undefined || value === null) return;
  
  let strVal = '';
  if (typeof value === 'string') {
    strVal = value;
  } else if (typeof value === 'object') {
    strVal = value.value || value.answer || value.text || '';
  } else {
    try {
      strVal = String(value || '');
    } catch (e) {
      strVal = '';
    }
  }

  strVal = strVal.trim();
  if (!strVal || strVal === 'undefined' || strVal === 'null') return;

  try {
    // 1. Focus input
    input.focus();
    input.click();

    // 2. Set value using native prototype descriptor setter
    const isTextarea = input.tagName.toLowerCase() === 'textarea';
    const prototype = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(input, strVal);
    } else {
      input.value = strVal;
    }

    input.value = strVal;
    input.setAttribute('data-initial-value', strVal);
    input.setAttribute('badinput', 'false');

    // 3. Dispatch native input and change events
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: strVal }));
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    // 4. Update Google Form paper input container classes (lifts floating label)
    const paperContainer = input.closest('.rFrNMe, .quantumWizTextinputPaperinputEl, .quantumWizTextinputPapertextareaEl');
    if (paperContainer) {
      paperContainer.classList.add('CDELXb', 'has-value', 'is-focused');
      paperContainer.classList.remove('is-empty', 'k3Du5c', 'N9Q2ih');

      // Hide ONLY the specific leaf placeholder element (.nd90Mw)
      const leafPlaceholder = paperContainer.querySelector('.nd90Mw');
      if (leafPlaceholder) {
        leafPlaceholder.style.setProperty('display', 'none', 'important');
        leafPlaceholder.style.setProperty('opacity', '0', 'important');
      }
    }

    // 5. Hide red error message if present
    if (block) {
      const errorEl = block.querySelector('.RHiOh, div[jsname="RHiOh"], div[role="alert"]');
      if (errorEl) {
        errorEl.style.display = 'none';
      }
      block.querySelectorAll('.k3Du5c, .N9Q2ih').forEach(el => el.classList.remove('k3Du5c', 'N9Q2ih'));
    }
  } catch (err) {
    console.warn('Safe input injection error:', err);
  }
}

/**
 * Click Submit Button in Google Form
 */
function triggerFormSubmit() {
  const submitBtn = document.querySelector(
    'div[role="button"][jsname="M2Action"], ' +
    'div[role="button"][aria-label*="Submit" i], ' +
    'div[role="button"][aria-label*="Send" i], ' +
    'span.NPEfkd:has-text("Submit"), ' +
    'div.uArJ5e.UQuaGc.Y5A0ae.xv32gd'
  ) || Array.from(document.querySelectorAll('div[role="button"]')).find(b => {
    const text = b.innerText.toLowerCase().trim();
    return text === 'submit' || text === 'send' || text === 'next';
  });

  if (submitBtn) {
    submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    submitBtn.click();
    showToastBanner('🎉 Google Form Submitted Successfully!');
    return { success: true, submitted: true };
  } else {
    const form = document.querySelector('form');
    if (form) {
      form.submit();
      showToastBanner('🎉 Form Submitted!');
      return { success: true, submitted: true };
    }
    showToastBanner('⚠️ Submit button not found on this page');
    return { success: false, error: 'Submit button not found' };
  }
}

/**
 * In-page Floating Toast Banner
 */
function showToastBanner(message) {
  let toast = document.getElementById('webmcp-floating-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'webmcp-floating-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
      color: #ffffff;
      padding: 14px 22px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.2);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: toastSlideIn 0.3s ease;
      backdrop-filter: blur(8px);
    `;
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.display = 'block';

  setTimeout(() => {
    if (toast) toast.style.display = 'none';
  }, 4000);
}

/**
 * Completely resets and clears all inputs in Google Form DOM
 */
function clearGoogleFormDOM() {
  let clearedCount = 0;

  // 1. Clear text inputs & textareas
  const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"], input[type="date"], input.whsOnd, textarea, .KHxj8b');
  textInputs.forEach(input => {
    try {
      const isTextarea = input.tagName.toLowerCase() === 'textarea';
      const prototype = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(input, '');
      } else {
        input.value = '';
      }
      input.value = '';
      input.removeAttribute('data-initial-value');
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      // Reset paper container
      const paperContainer = input.closest('.rFrNMe, .quantumWizTextinputPaperinputEl, .quantumWizTextinputPapertextareaEl');
      if (paperContainer) {
        paperContainer.classList.remove('CDELXb', 'has-value', 'is-focused');
        paperContainer.classList.add('is-empty');
        const leaf = paperContainer.querySelector('.nd90Mw');
        if (leaf) {
          leaf.style.removeProperty('display');
          leaf.style.removeProperty('opacity');
        }
      }
      clearedCount++;
    } catch (e) {}
  });

  // 2. Uncheck checkboxes
  const checkedBoxes = document.querySelectorAll('div[role="checkbox"][aria-checked="true"]');
  checkedBoxes.forEach(cb => {
    try {
      cb.click();
      clearedCount++;
    } catch (e) {}
  });

  // 3. Clear radio button selections
  const clearSelectionBtns = document.querySelectorAll('div[role="button"][aria-label*="Clear selection" i], span[aria-label*="Clear selection" i], .Y3E5bd, .uArJ5e.UQuaGc.kCyAyd');
  if (clearSelectionBtns.length > 0) {
    clearSelectionBtns.forEach(btn => {
      try {
        btn.click();
      } catch (e) {}
    });
  } else {
    const radios = document.querySelectorAll('div[role="radio"][aria-checked="true"]');
    radios.forEach(r => {
      try {
        r.setAttribute('aria-checked', 'false');
        r.classList.remove('N2RpBe');
        clearedCount++;
      } catch (e) {}
    });
  }

  showToastBanner(`🧹 Cleared form fields!`);
  return { success: true, clearedCount };
}
