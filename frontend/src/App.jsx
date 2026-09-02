import { useState } from 'react'
import './App.css'

export default function App() {
  const [formUrl, setFormUrl] = useState('')
  const [responses, setResponses] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-12345'

  const analyzeForm = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/forms/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ formUrl })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setResult({ type: 'analysis', data: data.data })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fillForm = async () => {
    setLoading(true)
    setError(null)
    try {
      const parsedResponses = JSON.parse(responses)
      const res = await fetch(`${API_URL}/api/forms/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ formUrl, responses: parsedResponses })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setResult({ type: 'fill', data: data })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🤖 Google Form Auto-Filler</h1>
        <p>AI-powered form automation using WebMCP</p>
      </header>

      <div className="card">
        <h2>Step 1: Analyze Form</h2>
        <input
          type="text"
          placeholder="Paste Google Form URL"
          value={formUrl}
          onChange={(e) => setFormUrl(e.target.value)}
          className="input"
        />
        <button onClick={analyzeForm} disabled={loading || !formUrl} className="btn btn-primary">
          {loading ? 'Analyzing...' : 'Analyze Form'}
        </button>
      </div>

      {result?.type === 'analysis' && (
        <div className="card success">
          <h3>✓ Form Analyzed</h3>
          <pre>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}

      <div className="card">
        <h2>Step 2: Fill Form</h2>
        <textarea
          placeholder="Enter form responses as JSON: {&#10;  &quot;fieldId&quot;: &quot;answer&quot;&#10;}"
          value={responses}
          onChange={(e) => setResponses(e.target.value)}
          className="textarea"
          rows="5"
        />
        <button onClick={fillForm} disabled={loading || !formUrl} className="btn btn-success">
          {loading ? 'Filling...' : 'Fill & Submit'}
        </button>
      </div>

      {result?.type === 'fill' && (
        <div className="card success">
          <h3>✓ Form Filled</h3>
          <p><strong>Submission ID:</strong> {result.data.submissionId}</p>
          <pre>{JSON.stringify(result.data.results, null, 2)}</pre>
        </div>
      )}

      {error && (
        <div className="card error">
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
