import { useState, useEffect } from 'react'
import './App.css'

const DEFAULT_PROFILE = {
  fullName: 'Kishore Ramu',
  email: 'kishoreramu25@gmail.com',
  phone: '+91 9876543210',
  address: '123 Tech Park, Anna Nagar',
  city: 'Chennai',
  college: 'Anna University',
  degree: 'B.Tech Computer Science',
  company: 'AI Technologies',
  jobTitle: 'Full Stack & AI Engineer',
  experienceYears: '3+',
  skills: 'Python, React, WebMCP, JavaScript, Node.js, AI/ML, FastAPI',
  linkedinUrl: 'https://linkedin.com/in/kishoreramu',
  githubUrl: 'https://github.com/Kishoreramu25',
  portfolioUrl: 'https://kishoreramu.dev',
  gender: 'Male',
  whyHire: 'Passionate software engineer experienced with AI agentic workflows and full-stack development.'
}

export default function App() {
  const [formUrl, setFormUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [notification, setNotification] = useState(null)
  
  // User Profile / DB State
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('webmcp_user_profile')
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE
  })
  
  // Form fields & responses
  const [analyzedFields, setAnalyzedFields] = useState([])
  const [formResponses, setFormResponses] = useState({})
  const [activeTab, setActiveTab] = useState('visual') // 'visual' | 'json'
  const [jsonText, setJsonText] = useState('{}')

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-12345'

  // Fetch saved profile from Backend DB on mount
  useEffect(() => {
    fetch(`${API_URL}/api/profile`, {
      headers: { 'X-API-Key': API_KEY }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.success && data?.data) {
          setProfile(data.data)
          localStorage.setItem('webmcp_user_profile', JSON.stringify(data.data))
        }
      })
      .catch(() => {
        // Fallback to local storage if offline
      })
  }, [])

  const notify = (msg, type = 'info') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 4000)
  }

  // Save profile to backend & localStorage
  const handleSaveProfile = async (updatedProfile) => {
    const dataToSave = updatedProfile || profile
    setProfile(dataToSave)
    localStorage.setItem('webmcp_user_profile', JSON.stringify(dataToSave))
    
    try {
      await fetch(`${API_URL}/api/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(dataToSave)
      })
      notify('✓ Profile saved to database successfully!', 'success')
    } catch {
      notify('✓ Profile saved locally!', 'success')
    }
  }

  // Analyze Form
  const analyzeForm = async () => {
    if (!formUrl) return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    
    try {
      const res = await fetch(`${API_URL}/api/forms/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ formUrl: formUrl.trim() })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to analyze form')

      const fields = data.data?.fields || []
      setAnalyzedFields(fields)
      setResult({ type: 'analysis', data: data.data })
      
      // Auto-match fields immediately using DB Profile
      autoFillFromDB(fields, profile)
      notify(`✓ Analyzed ${fields.length} questions from Google Form!`, 'success')
    } catch (err) {
      setError(err.message)
      notify(err.message, 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  // Smart Auto-Fill from Database Profile
  const autoFillFromDB = async (fieldsToMatch = analyzedFields, currentProfile = profile) => {
    if (!fieldsToMatch || fieldsToMatch.length === 0) {
      notify('Please analyze a form first!', 'warning')
      return
    }

    setLoading(true)
    try {
      // Call backend smart matcher
      const res = await fetch(`${API_URL}/api/forms/autofill-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          fields: fieldsToMatch,
          profile: currentProfile
        })
      })

      const data = await res.json()
      if (res.ok && data?.data) {
        const matches = data.data
        setFormResponses(matches)
        setJsonText(JSON.stringify(matches, null, 2))
        notify(`✨ Auto-filled ${Object.keys(matches).length} fields from your Database Profile!`, 'success')
      } else {
        // Fallback local matching
        localAutoFill(fieldsToMatch, currentProfile)
      }
    } catch {
      localAutoFill(fieldsToMatch, currentProfile)
    } finally {
      setLoading(false)
    }
  }

  const localAutoFill = (fields, p) => {
    const matched = {}
    fields.forEach(f => {
      const lbl = (f.label || '').toLowerCase()
      const opts = f.options || []
      let val = ''
      
      if (lbl.includes('name')) val = p.fullName
      else if (lbl.includes('email') || lbl.includes('mail')) val = p.email
      else if (lbl.includes('phone') || lbl.includes('mobile') || lbl.includes('contact') || lbl.includes('number')) val = p.phone
      else if (lbl.includes('linkedin')) val = p.linkedinUrl
      else if (lbl.includes('github') || lbl.includes('git')) val = p.githubUrl
      else if (lbl.includes('portfolio') || lbl.includes('website') || lbl.includes('link')) val = p.portfolioUrl
      else if (lbl.includes('college') || lbl.includes('university') || lbl.includes('school')) val = p.college
      else if (lbl.includes('degree') || lbl.includes('major') || lbl.includes('branch')) val = p.degree
      else if (lbl.includes('company') || lbl.includes('organization')) val = p.company
      else if (lbl.includes('role') || lbl.includes('job') || lbl.includes('designation')) val = p.jobTitle
      else if (lbl.includes('experience') || lbl.includes('years')) val = p.experienceYears
      else if (lbl.includes('skill') || lbl.includes('tech')) val = p.skills
      else if (lbl.includes('city') || lbl.includes('location')) val = p.city
      else if (lbl.includes('address')) val = p.address
      else if (lbl.includes('gender')) val = p.gender
      else if (lbl.includes('why') || lbl.includes('about') || lbl.includes('cover') || lbl.includes('summary')) val = p.whyHire

      if (opts.length > 0) {
        if (val) {
          const found = opts.find(o => o.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(o.toLowerCase()))
          val = found || opts[0]
        } else {
          val = opts[0]
        }
      }
      matched[f.id] = val || ''
    })
    setFormResponses(matched)
    setJsonText(JSON.stringify(matched, null, 2))
    notify(`✨ Auto-filled ${Object.keys(matched).length} fields from your Profile!`, 'success')
  }

  // Update specific field value
  const handleFieldChange = (fieldId, value) => {
    const updated = { ...formResponses, [fieldId]: value }
    setFormResponses(updated)
    setJsonText(JSON.stringify(updated, null, 2))
  }

  // Sync json text changes
  const handleJsonTextChange = (text) => {
    setJsonText(text)
    try {
      const parsed = JSON.parse(text)
      setFormResponses(parsed)
    } catch {
      // Allow user to continue typing
    }
  }

  // Submit and Fill Form
  const fillForm = async () => {
    if (!formUrl) {
      notify('Please enter a Google Form URL', 'warning')
      return
    }

    setSubmitting(true)
    setError(null)
    
    try {
      let payload = formResponses
      if (activeTab === 'json') {
        payload = JSON.parse(jsonText)
      }

      const res = await fetch(`${API_URL}/api/forms/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          formUrl: formUrl.trim(),
          responses: payload
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fill form')

      setResult({ type: 'fill', data: data })
      notify('🎉 Form filled and strategy generated successfully!', 'success')
    } catch (err) {
      setError(err.message)
      notify(`❌ ${err.message}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container">
      {/* Toast Notification */}
      {notification && (
        <div className={`toast-notification toast-${notification.type}`}>
          {notification.msg}
        </div>
      )}

      {/* Top Navigation / Header */}
      <header className="header">
        <div className="header-top">
          <div className="logo-badge">WebMCP Automation Engine</div>
          <button 
            className="btn-profile-toggle"
            onClick={() => setShowProfileModal(true)}
          >
            👤 <strong>My Data DB Profile</strong>
          </button>
        </div>
        <h1>🤖 Google Form Auto-Filler</h1>
        <p>AI-powered intelligent Google Form automation using WebMCP & Profile Database</p>
      </header>

      {/* Quick Profile Summary Banner */}
      <div className="db-profile-banner">
        <div className="db-profile-info">
          <span className="profile-chip">👤 {profile.fullName || 'No Name'}</span>
          <span className="profile-chip">✉️ {profile.email || 'No Email'}</span>
          <span className="profile-chip">📞 {profile.phone || 'No Phone'}</span>
          <span className="profile-chip">💼 {profile.jobTitle || 'Role'}</span>
        </div>
        <button 
          className="btn-link-edit" 
          onClick={() => setShowProfileModal(true)}
        >
          ✏️ Edit My Data
        </button>
      </div>

      {/* STEP 1: Analyze Form */}
      <div className="card main-card">
        <div className="card-header-flex">
          <h2>1️⃣ Paste Google Form URL</h2>
          <span className="badge-step">Step 1</span>
        </div>
        
        <div className="input-group">
          <input
            type="text"
            placeholder="e.g., https://docs.google.com/forms/d/e/.../viewform or https://forms.gle/..."
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            className="input-field"
          />
          <button 
            onClick={analyzeForm} 
            disabled={analyzing || !formUrl} 
            className="btn btn-primary"
          >
            {analyzing ? (
              <span className="spinner-wrap">⏳ Analyzing Form...</span>
            ) : (
              '🔍 Analyze Form'
            )}
          </button>
        </div>

        {formUrl && (
          <div className="url-preview">
            <small>Target: <code>{formUrl}</code></small>
          </div>
        )}
      </div>

      {/* Form Analysis Result & Field Mapping */}
      {analyzedFields.length > 0 && (
        <div className="card form-fields-card">
          <div className="card-header-flex">
            <div>
              <h2>2️⃣ Auto-Fill Form from Your Data</h2>
              <p className="card-subtitle">
                {result?.data?.title || 'Google Form'} ({analyzedFields.length} questions detected)
              </p>
            </div>
            
            {/* THE REQUESTED PROMINENT BUTTON: Auto-Fill from DB */}
            <button 
              onClick={() => autoFillFromDB(analyzedFields, profile)} 
              disabled={loading}
              className="btn btn-autofill-db"
            >
              ⚡ {loading ? 'Matching...' : 'Auto-Fill from My Data DB'}
            </button>
          </div>

          {/* Tab controls: Interactive Visual vs Raw JSON */}
          <div className="tab-container">
            <button 
              className={`tab-btn ${activeTab === 'visual' ? 'active' : ''}`}
              onClick={() => setActiveTab('visual')}
            >
              📋 Interactive Form Questions ({analyzedFields.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
              onClick={() => setActiveTab('json')}
            >
              {'{ }'} Raw JSON Payload
            </button>
          </div>

          {/* Visual Interactive Fields Editor */}
          {activeTab === 'visual' ? (
            <div className="fields-grid">
              {analyzedFields.map((field, idx) => {
                const val = formResponses[field.id] || ''
                return (
                  <div key={field.id || idx} className="field-card">
                    <div className="field-label-row">
                      <label className="field-label">
                        <span className="field-number">{idx + 1}.</span> {field.label}
                        {field.required && <span className="badge-required">* Required</span>}
                      </label>
                      <span className="field-type-tag">{field.type}</span>
                    </div>

                    {field.type === 'textarea' ? (
                      <textarea
                        value={val}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={`Enter ${field.label}...`}
                        rows="3"
                        className="input-field"
                      />
                    ) : field.type === 'select' || (field.options && field.options.length > 0 && field.type === 'radio') ? (
                      <div className="select-wrapper">
                        <select
                          value={val}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="input-field select-field"
                        >
                          <option value="">-- Select an option --</option>
                          {field.options.map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="checkbox-options-wrap">
                        {field.options && field.options.length > 0 ? (
                          field.options.map((opt, oIdx) => (
                            <label key={oIdx} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={val.includes ? val.includes(opt) : val === opt}
                                onChange={(e) => {
                                  let currentArr = Array.isArray(val) ? [...val] : (val ? [val] : [])
                                  if (e.target.checked) {
                                    if (!currentArr.includes(opt)) currentArr.push(opt)
                                  } else {
                                    currentArr = currentArr.filter(item => item !== opt)
                                  }
                                  handleFieldChange(field.id, currentArr.join(', '))
                                }}
                              />
                              <span>{opt}</span>
                            </label>
                          ))
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder="e.g. Yes / Agreed"
                            className="input-field"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type={field.type === 'email' ? 'email' : 'text'}
                        value={val}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={`Enter ${field.label}...`}
                        className="input-field"
                      />
                    )}

                    <div className="field-entry-id">
                      <small>Field ID: <code>{field.id}</code></small>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="json-editor-wrap">
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonTextChange(e.target.value)}
                className="textarea-json"
                rows="10"
              />
              <small className="json-hint">Edit the JSON object above. It maps field IDs or labels to answers.</small>
            </div>
          )}

          {/* STEP 3: Fill & Submit */}
          <div className="submit-action-box">
            <button 
              onClick={fillForm} 
              disabled={submitting || !formUrl} 
              className="btn btn-success btn-large"
            >
              {submitting ? '⚡ Generating Filling Strategy...' : '🚀 Fill & Submit Google Form'}
            </button>
          </div>
        </div>
      )}

      {/* Submission Results / Audit Log */}
      {result?.type === 'fill' && (
        <div className="card result-success-card">
          <div className="card-header-flex">
            <h3>🎉 Form Submission Strategy Ready!</h3>
            <span className="badge-success">Success</span>
          </div>
          
          <div className="submission-meta">
            <p><strong>Submission ID:</strong> <code>{result.data.submissionId}</code></p>
            <p><strong>Timestamp:</strong> {new Date(result.data.timestamp).toLocaleString()}</p>
          </div>

          <div className="strategy-steps">
            <h4>⚡ Execution Steps:</h4>
            <div className="steps-list">
              {result.data.results?.steps?.map((step, sIdx) => (
                <div key={sIdx} className="step-item">
                  <span className="step-badge">{step.action.toUpperCase()}</span>
                  <span className="step-field">{step.fieldId || 'Submit'}</span>
                  {step.value && <span className="step-value">"{step.value}"</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Card */}
      {error && (
        <div className="card card-error">
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* MODAL: Edit My Data / DB Profile */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👤 My Personal Data Database Profile</h2>
              <button className="btn-close" onClick={() => setShowProfileModal(false)}>✕</button>
            </div>
            
            <p className="modal-subtitle">
              This data is stored in your database to automatically fill all matched fields in any Google Form.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); setShowProfileModal(false); }}>
              <div className="profile-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={profile.fullName || ''}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Kishore Ramu"
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={profile.email || ''}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="input-field"
                    placeholder="e.g. your@email.com"
                  />
                </div>

                <div className="form-group">
                  <label>Phone / Mobile</label>
                  <input
                    type="text"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="input-field"
                    placeholder="e.g. +91 9876543210"
                  />
                </div>

                <div className="form-group">
                  <label>City / Location</label>
                  <input
                    type="text"
                    value={profile.city || ''}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Chennai"
                  />
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    value={profile.address || ''}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="input-field"
                    placeholder="e.g. 123 Tech Park"
                  />
                </div>

                <div className="form-group">
                  <label>College / University</label>
                  <input
                    type="text"
                    value={profile.college || ''}
                    onChange={(e) => setProfile({ ...profile, college: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Anna University"
                  />
                </div>

                <div className="form-group">
                  <label>Degree / Qualification</label>
                  <input
                    type="text"
                    value={profile.degree || ''}
                    onChange={(e) => setProfile({ ...profile, degree: e.target.value })}
                    className="input-field"
                    placeholder="e.g. B.Tech Computer Science"
                  />
                </div>

                <div className="form-group">
                  <label>Current Company / Organization</label>
                  <input
                    type="text"
                    value={profile.company || ''}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    className="input-field"
                    placeholder="e.g. AI Technologies"
                  />
                </div>

                <div className="form-group">
                  <label>Job Title / Role</label>
                  <input
                    type="text"
                    value={profile.jobTitle || ''}
                    onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Full Stack & AI Engineer"
                  />
                </div>

                <div className="form-group">
                  <label>Years of Experience</label>
                  <input
                    type="text"
                    value={profile.experienceYears || ''}
                    onChange={(e) => setProfile({ ...profile, experienceYears: e.target.value })}
                    className="input-field"
                    placeholder="e.g. 3+"
                  />
                </div>

                <div className="form-group">
                  <label>LinkedIn Profile URL</label>
                  <input
                    type="url"
                    value={profile.linkedinUrl || ''}
                    onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })}
                    className="input-field"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>

                <div className="form-group">
                  <label>GitHub Profile URL</label>
                  <input
                    type="url"
                    value={profile.githubUrl || ''}
                    onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })}
                    className="input-field"
                    placeholder="https://github.com/..."
                  />
                </div>

                <div className="form-group">
                  <label>Portfolio / Website</label>
                  <input
                    type="url"
                    value={profile.portfolioUrl || ''}
                    onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                    className="input-field"
                    placeholder="https://yourportfolio.com"
                  />
                </div>

                <div className="form-group">
                  <label>Gender</label>
                  <input
                    type="text"
                    value={profile.gender || ''}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Male / Female"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Skills & Technologies (comma-separated)</label>
                  <input
                    type="text"
                    value={profile.skills || ''}
                    onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
                    className="input-field"
                    placeholder="Python, React, WebMCP, AI, JavaScript"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Summary / Why Hire / About You</label>
                  <textarea
                    value={profile.whyHire || ''}
                    onChange={(e) => setProfile({ ...profile, whyHire: e.target.value })}
                    className="input-field"
                    rows="3"
                    placeholder="Tell about yourself..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowProfileModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  💾 Save Profile to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
