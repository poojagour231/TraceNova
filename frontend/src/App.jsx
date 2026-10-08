import { useCallback, useEffect, useState } from 'react'
import './App.css'

const navigation = [
  { label: 'Dashboard', icon: '⌂' },
  { label: 'Cases', icon: '◫' },
  { label: 'Evidence', icon: '◈' },
  { label: 'Analysis', icon: '⌁' },
  { label: 'Reports', icon: '▤' },
]

const SELECTED_CASE_STORAGE_KEY = 'tracenova.selectedCaseId'

const createGraphLayout = (graph) => {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph?.edges) ? graph.edges : []
  const width = 900
  const height = Math.max(420, Math.min(760, nodes.length * 18 + 420))
  const positions = new Map()
  const centerX = width / 2
  const centerY = height / 2
  const neighbors = new Map(nodes.map((node) => [String(node.id), new Set()]))

  edges.forEach((edge) => {
    const source = String(edge.source)
    const target = String(edge.target)
    if (!neighbors.has(source)) neighbors.set(source, new Set())
    if (!neighbors.has(target)) neighbors.set(target, new Set())
    neighbors.get(source).add(target)
    neighbors.get(target).add(source)
  })

  const rankedNodes = [...nodes].sort((left, right) => (
    (neighbors.get(String(right.id))?.size || 0) - (neighbors.get(String(left.id))?.size || 0)
  ))
  const depthByNode = new Map()
  const rootId = rankedNodes[0] ? String(rankedNodes[0].id) : null
  if (rootId) {
    const queue = [{ id: rootId, depth: 0 }]
    depthByNode.set(rootId, 0)
    while (queue.length) {
      const current = queue.shift()
      if (current.depth >= 2) continue
      const neighborsForNode = neighbors.get(current.id) || new Set()
      neighborsForNode.forEach((neighbor) => {
        if (!depthByNode.has(neighbor)) {
          depthByNode.set(neighbor, current.depth + 1)
          queue.push({ id: neighbor, depth: current.depth + 1 })
        }
      })
    }
  }
  rankedNodes.forEach((node, index) => {
    const nodeId = String(node.id)
    if (!depthByNode.has(nodeId)) depthByNode.set(nodeId, 3 + index)
  })
  const layers = [...new Set(depthByNode.values())].sort((left, right) => left - right)
    .map((depth) => rankedNodes
      .map((node) => String(node.id))
      .filter((nodeId) => depthByNode.get(nodeId) === depth))

  const layerSpacing = Math.min(220, Math.max(145, height / 3))
  layers.forEach((layer, layerIndex) => {
    const radius = layerIndex === 0 ? 0 : layerSpacing * Math.min(layerIndex, 2)
    layer.forEach((nodeId, index) => {
      const angle = layerIndex === 0
        ? 0
        : (index / Math.max(layer.length, 1)) * Math.PI * 2 - Math.PI / 2
      positions.set(nodeId, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    })
  })

  return { nodes, edges, height, positions }
}

const percentage = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

const displayMetric = (value, fallback = 'Unavailable') => (
  value === null || value === undefined || value === '' ? fallback : formatValue(value)
)

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const getPredictionColumns = (predictions) => {
  const columns = []
  predictions.forEach((prediction) => {
    Object.keys(prediction || {}).forEach((key) => {
      if (!columns.includes(key)) columns.push(key)
    })
  })
  return columns
}

const getAnalysisCase = (cases, caseId) => (
  cases.find((item) => String(item.id) === String(caseId)) || null
)

const formatMatchDetails = (matches) => {
  if (!Array.isArray(matches) || matches.length === 0) return 'No matched attributes'
  return matches
    .map((match) => `${formatValue(match.field)}: ${formatValue(match.value)}`)
    .join(' • ')
}

const formatGraphIdentifier = (node) => {
  if (node?.identifier || node?.label) return formatValue(node.identifier || node.label)
  return node?.id === undefined ? 'Unknown record' : `Record ${node.id}`
}

const formatGraphType = (node) => String(node?.type || 'entity').replace(/_/g, ' ')

const shortenGraphValue = (value) => {
  const text = formatValue(value)
  return text.length > 22 ? `${text.slice(0, 10)}•••${text.slice(-8)}` : text
}

function App() {
  const [entryScreen, setEntryScreen] = useState('landing')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [cases, setCases] = useState([])
  const [casesLoading, setCasesLoading] = useState(false)
  const [casesError, setCasesError] = useState('')
  const [casesLoaded, setCasesLoaded] = useState(false)
  const [caseSearch, setCaseSearch] = useState('')
  const [caseSort, setCaseSort] = useState('newest')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [form, setForm] = useState({
    case_number: '',
    title: '',
    description: '',
  })
  const [selectedCaseId, setSelectedCaseId] = useState(() => {
    try {
      return window.localStorage.getItem(SELECTED_CASE_STORAGE_KEY) || ''
    } catch {
      return ''
    }
  })
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadResult, setUploadResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState(null)
  const [hoveredGraphEdge, setHoveredGraphEdge] = useState(null)
  const [graphSearch, setGraphSearch] = useState('')
  const [graphZoom, setGraphZoom] = useState(1)
  const [reportExportError, setReportExportError] = useState('')
  const [currentDateLabel] = useState(() => (
    new Date().toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  ))

  const handleAuthSubmit = (event) => {
    event.preventDefault()
    if (!authForm.email.trim() || !authForm.password.trim() || (authMode === 'signup' && !authForm.name.trim())) {
      setAuthError('Please complete all required fields.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authForm.email.trim())) {
      setAuthError('Enter a valid work email address.')
      return
    }
    if (authForm.password.length < 8) {
      setAuthError('Password must be at least 8 characters.')
      return
    }
    setAuthError('')
    setIsAuthenticated(true)
  }

  const loadCases = useCallback(async () => {
      setCasesLoading(true)
      setCasesError('')

      try {
       const response = await fetch('https://tracenova.onrender.com/cases/')
        if (!response.ok) {
          throw new Error('Unable to load cases')
        }

        const data = await response.json()
        const nextCases = Array.isArray(data) ? data : []
        setCases(nextCases)
        setSelectedCaseId((currentCaseId) => {
          if (currentCaseId && nextCases.some((item) => String(item.id) === String(currentCaseId))) {
            return currentCaseId
          }
          try {
            const rememberedCaseId = window.localStorage.getItem(SELECTED_CASE_STORAGE_KEY)
            return rememberedCaseId && nextCases.some((item) => String(item.id) === rememberedCaseId)
              ? rememberedCaseId
              : ''
          } catch {
            return ''
          }
        })
        setCasesLoaded(true)
      } catch {
        setCasesError('Unable to load cases. Make sure the backend server is running.')
      } finally {
        setCasesLoading(false)
      }
  }, [])

  useEffect(() => {
    const task = window.setTimeout(() => {
      loadCases()
    }, 0)
    return () => window.clearTimeout(task)
  }, [loadCases])

  useEffect(() => {
    try {
      if (selectedCaseId) {
        window.localStorage.setItem(SELECTED_CASE_STORAGE_KEY, String(selectedCaseId))
      } else {
        window.localStorage.removeItem(SELECTED_CASE_STORAGE_KEY)
      }
    } catch {
      // Ignore storage restrictions without affecting the active backend case.
    }
  }, [selectedCaseId])

  if (!isAuthenticated && entryScreen === 'landing') {
    return (
      <main className="landing-page">
        <header className="landing-nav">
          <div className="auth-brand">
            <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
            <strong>Trace<span>Nova</span></strong>
          </div>
          <nav aria-label="Public navigation">
            <a href="#challenge">The challenge</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#workflow">Workflow</a>
          </nav>
          <button className="landing-login" type="button" onClick={() => setEntryScreen('login')}>Investigator access</button>
        </header>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="eyebrow">Cyber fraud investigation / digital intelligence</p>
            <h1>From fragmented evidence to <span>connected intelligence.</span></h1>
            <p>Correlate digital evidence, uncover hidden relationships, assess fraud risk, and generate investigation-ready intelligence from complex cyber evidence.</p>
            <div className="landing-actions">
              <button className="primary-button" type="button" onClick={() => setEntryScreen('login')}>Enter Investigation Workspace <span>→</span></button>
              <a href="#capabilities" className="landing-secondary">Explore platform <span>↓</span></a>
            </div>
          </div>
          <div className="landing-network" aria-label="Conceptual investigation network">
            <div className="network-orbit orbit-one" /><div className="network-orbit orbit-two" />
            <div className="network-core">TRACENOVA<small>INTELLIGENCE CORE</small></div>
            {['CDR', 'UPI', 'DEVICE', 'IP', 'EMAIL', 'ACCOUNT'].map((label, index) => (
              <span className={`network-node node-${index}`} key={label}>{label}</span>
            ))}
          </div>
        </section>
        <section className="landing-section challenge-section" id="challenge">
          <div><p className="section-kicker">The challenge</p><h2>Investigations rarely begin with one complete picture.</h2></div>
          <p>Cyber fraud investigations often span call detail records, network evidence, transaction artifacts, email, devices, and digital accounts. The difficult work is correlating those fragments and identifying the relationships and risk signals hidden between them.</p>
        </section>
        <section className="landing-section" id="capabilities">
          <p className="section-kicker">Investigation capabilities</p>
          <h2>Evidence becomes useful when it becomes connected.</h2>
          <div className="capability-grid">
            {[
              ['01', 'Evidence ingestion', 'Register and normalize digital artifacts for analysis.'],
              ['02', 'Entity resolution', 'Surface recurring identifiers across evidence sources.'],
              ['03', 'Relationship graph', 'Inspect connected entities and investigation paths.'],
              ['04', 'Risk analysis', 'Separate rule-based signals from model intelligence.'],
              ['05', 'ML fraud risk', 'Evaluate valid CDR records with the existing model.'],
              ['06', 'Investigation reports', 'Turn returned evidence into a defensible case record.'],
            ].map(([number, title, description]) => (
              <article className="capability-item" key={title}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>
            ))}
          </div>
        </section>
        <section className="landing-section transaction-section">
          <div><p className="section-kicker">Financial transaction intelligence</p><h2>Follow the signal across digital artifacts.</h2><p>When transaction evidence is available, TraceNova can place UPI IDs, transaction references, accounts, phone numbers, devices, and IP addresses into the same investigation context without inventing data that is not present.</p></div>
          <div className="transaction-chain">{['UPI ID', 'Transaction', 'Account', 'Phone', 'Device', 'IP address'].map((item, index) => <span key={item}>{item}{index < 5 && <b>↔</b>}</span>)}</div>
        </section>
        <section className="landing-section workflow-section" id="workflow">
          <p className="section-kicker">Investigation workflow</p>
          <h2>A clear path from intake to finding.</h2>
          <div className="workflow-track">{['Evidence', 'Normalization', 'Entity resolution', 'Correlation', 'Risk analysis', 'ML intelligence', 'Finding', 'Report'].map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong></div>)}</div>
        </section>
        <footer className="landing-footer"><strong>Trace<span>Nova</span></strong><small>Cyber Fraud Investigation & Digital Artifact Intelligence Platform</small><button type="button" onClick={() => setEntryScreen('login')}>Investigator access →</button></footer>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-hero">
          <div className="auth-brand">
            <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
            <strong>Trace<span>Nova</span></strong>
          </div>
          <div className="auth-hero-content">
            <p className="eyebrow">Digital evidence intelligence</p>
            <h1>See the signal<br /><span>inside the noise.</span></h1>
            <p>Unify evidence, uncover hidden relationships, and turn complex fraud investigations into confident action.</p>
            <div className="auth-hero-stats">
              <div><strong>01</strong><span>Evidence ingestion</span></div>
              <div><strong>02</strong><span>Risk intelligence</span></div>
              <div><strong>03</strong><span>Investigation reports</span></div>
            </div>
          </div>
          <small className="auth-footer">TRACENOVA / INVESTIGATION OPERATIONS CENTER</small>
        </section>
        <section className="auth-card-wrap">
          <div className="auth-card">
            <button className="back-to-site" type="button" onClick={() => setEntryScreen('landing')}>← Back to TraceNova</button>
            <p className="section-kicker">Secure investigator portal</p>
            <h2>{authMode === 'login' ? 'Sign in to TraceNova' : 'Create your workspace'}</h2>
            <p className="auth-subtitle">{authMode === 'login' ? 'Access the investigation workspace from this browser.' : 'Create a local workspace profile to continue.'}</p>
            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === 'signup' && <label>Full name<input autoComplete="name" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} placeholder="Your name" /></label>}
              <label>Work email<input autoComplete="email" type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="analyst@organization.com" /></label>
              <label>Password<input autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength="8" type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="8+ characters" /></label>
              {authError && <p className="form-error" role="alert">{authError}</p>}
              <button className="primary-button auth-submit" type="submit">{authMode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
            </form>
            <div className="auth-divider"><span>or</span></div>
            <button className="google-auth-button" type="button" onClick={() => setAuthError('Google sign-in is not configured for this deployment.')}>
              <span className="google-mark" aria-hidden="true">G</span> Continue with Google
            </button>
            <p className="auth-provider-note">Google OAuth is ready for provider wiring, but is not enabled.</p>
            <p className="auth-switch">{authMode === 'login' ? 'New to TraceNova?' : 'Already have access?'}<button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError('') }}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p>
            <small className="auth-disclaimer">Local workspace access • Backend authentication is not configured</small>
          </div>
        </section>
      </main>
    )
  }

  const handleNavigation = (label) => {
    setActiveNav(label)
    if ((label === 'Dashboard' || label === 'Cases' || label === 'Evidence' || label === 'Analysis') && !casesLoaded) {
      loadCases()
    }
  }

  const openInvestigation = (caseId) => {
    setSelectedCaseId(String(caseId))
    setUploadError('')
    setAnalysisError('')
    setActiveNav('Evidence')
  }

  const activeCase = getAnalysisCase(cases, selectedCaseId)
  const visibleCases = [...cases]
    .filter((item) => {
      const query = caseSearch.trim().toLowerCase()
      if (!query) return true
      return [item.case_number, item.title, item.id]
        .some((value) => String(value || '').toLowerCase().includes(query))
    })
    .sort((left, right) => {
      if (caseSort === 'oldest') {
        return new Date(left.created_at || 0) - new Date(right.created_at || 0)
      }
      return new Date(right.created_at || 0) - new Date(left.created_at || 0)
    })
  const backendStatus = casesError
    ? 'Backend unavailable'
    : casesLoaded
      ? 'System online'
      : 'Connecting to backend'

  const handleCreateCase = () => {
    setFormError('')
    setSuccessMessage('')
    setShowCreateForm(true)
  }

  const handleStartEvidence = () => {
    if (activeCase) {
      setActiveNav('Evidence')
      return
    }
    handleCreateCase()
  }

  const closeCreateForm = () => {
    if (isCreating) {
      return
    }
    setShowCreateForm(false)
    setFormError('')
  }

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()
    const caseNumber = form.case_number.trim()
    const title = form.title.trim()

    if (!caseNumber || !title) {
      setFormError('Case Number and Title are required.')
      return
    }

    setIsCreating(true)
    setFormError('')
    setSuccessMessage('')

    try {
      const response = await fetch('https://tracenova.onrender.com/cases/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_number: caseNumber,
          title,
          description: form.description.trim() || null,
        }),
      })

      if (!response.ok) {
        let message = 'Unable to create case.'
        try {
          const errorData = await response.json()
          if (errorData.detail) {
            message = typeof errorData.detail === 'string'
              ? errorData.detail
              : 'Unable to create case.'
          }
        } catch {
          // Keep the clear fallback when the backend does not return JSON.
        }
        throw new Error(message)
      }

      const createdCase = await response.json()
      setForm({ case_number: '', title: '', description: '' })
      setShowCreateForm(false)
      setSuccessMessage('Case created successfully.')
      if (createdCase?.case_id) {
        openInvestigation(createdCase.case_id)
      }
      setCasesLoaded(false)
      await loadCases()
    } catch (error) {
      setFormError(
        error.message === 'Unable to create case.'
          ? error.message
          : 'Unable to create case. Make sure the backend server is running.'
      )
    } finally {
      setIsCreating(false)
    }
  }

  const showCases = () => setActiveNav('Cases')

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    setUploadError('')
    setUploadResult(null)
  }

  const handleEvidenceSubmit = async (event) => {
    event.preventDefault()

    if (!selectedCaseId) {
      setUploadError('Select a case before uploading evidence.')
      return
    }

    if (!selectedFile) {
      setUploadError('Select a CSV file before uploading evidence.')
      return
    }

    setIsUploading(true)
    setUploadError('')
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const response = await fetch(
        `https://tracenova.onrender.com/cases/${selectedCaseId}/evidence`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        let message = 'Unable to upload evidence.'
        try {
          const errorData = await response.json()
          if (errorData.detail) {
            message = typeof errorData.detail === 'string'
              ? errorData.detail
              : message
          }
        } catch {
          // Keep the fallback when the backend does not return JSON.
        }
        throw new Error(message)
      }

      const result = await response.json()
      setUploadResult(result)
      setSelectedFile(null)
      event.target.reset()
    } catch (error) {
      setUploadError(
        error.message === 'Unable to upload evidence.'
          ? error.message
          : 'Unable to upload evidence. Make sure the backend server is running.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const getApiErrorMessage = async (response, fallback) => {
    try {
      const errorData = await response.json()
      if (errorData.detail) {
        return typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail)
      }
    } catch {
      // Use the fallback when the backend does not return JSON.
    }
    return fallback
  }

  const handleAnalysisSubmit = async (event) => {
    event.preventDefault()

    if (!selectedCaseId) {
      setAnalysisError('Select a case before running analysis.')
      return
    }

    setIsAnalyzing(true)
    setAnalysisError('')
    setAnalysisResult(null)

    try {
      const response = await fetch(
        `https://tracenova.onrender.com/analysis/case/${selectedCaseId}`,
        { method: 'POST' }
      )

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `Analysis failed with HTTP ${response.status}.`))
      }

      setAnalysisResult(await response.json())
      setSelectedGraphNodeId(null)
      setGraphZoom(1)
      setReportExportError('')
    } catch (error) {
      setAnalysisError(
        error instanceof TypeError
          ? 'Unable to reach the backend. Make sure the backend server is running.'
          : error.message
      )
    } finally {
      setIsAnalyzing(false)
    }

  }

  const exportReport = () => {
    if (!analysisResult) {
      setReportExportError('Analyze a case first.')
      return
    }

    const report = analysisResult.report || {}
    const mlPercent = percentage(analysisResult.fraud_probability)
    const printable = `
      <!doctype html><html><head><title>TraceNova Report - Case ${analysisResult.case_id}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#14213d;padding:42px;line-height:1.5}
        h1{color:#087f8c;margin-bottom:4px}h2{border-bottom:2px solid #d8e8eb;padding-bottom:7px;margin-top:28px}
        .meta{color:#617187;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .metric{border:1px solid #d8e8eb;border-radius:8px;padding:12px}.metric b{display:block;font-size:20px;color:#087f8c}
        .finding{background:#eff8f9;padding:16px;border-left:4px solid #087f8c}
        table{width:100%;border-collapse:collapse;font-size:11px}td,th{border:1px solid #d8e8eb;padding:7px;text-align:left}
        @media print{body{padding:0}.no-print{display:none}}
      </style></head><body>
      <h1>TraceNova Investigation Report</h1><div class="meta">Case ID: ${formatValue(analysisResult.case_id)} • Generated ${new Date().toLocaleString()}</div>
      <h2>Risk overview</h2><div class="grid">
      <div class="metric">Records analyzed<b>${formatValue(analysisResult.records_analyzed)}</b></div>
      <div class="metric">Rule-based risk score<b>${formatValue(analysisResult.risk)}%</b></div>
      <div class="metric">Rule-based level<b>${formatValue(report.investigation_summary?.risk_level)}</b></div>
      <div class="metric">ML fraud probability<b>${mlPercent === null ? 'Unavailable' : `${mlPercent}%`}</b></div>
      <div class="metric">ML risk level<b>${displayMetric(analysisResult.risk_level)}</b></div>
      <div class="metric">CDR records used<b>${formatValue(report.cdr_records_used ?? 0)}</b></div></div>
      <h2>Risk distribution</h2><p>Low: ${formatValue(analysisResult.risk_summary?.low ?? 0)} &nbsp; Medium: ${formatValue(analysisResult.risk_summary?.medium ?? 0)} &nbsp; High: ${formatValue(analysisResult.risk_summary?.high ?? 0)}</p>
      <h2>Investigation summary</h2><div class="finding">${formatValue(report.investigation_summary?.finding)}</div>
      <p>Relationships: ${formatValue(analysisResult.relationships?.length ?? 0)} • Graph nodes: ${formatValue(analysisResult.graph?.nodes?.length ?? 0)} • Graph edges: ${formatValue(analysisResult.graph?.edges?.length ?? 0)}</p>
      </body></html>`
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) {
      setReportExportError('Allow pop-ups to generate the PDF report.')
      return
    }
    reportWindow.document.write(printable)
    reportWindow.document.close()
    reportWindow.focus()
    reportWindow.print()
    setReportExportError('')
  }

  const formatCreatedAt = (createdAt) => {
    if (!createdAt) {
      return '—'
    }

    const date = new Date(createdAt)
    return Number.isNaN(date.getTime()) ? createdAt : date.toLocaleString()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>Trace<span>Nova</span></strong>
            <small>Cyber Fraud Intelligence</small>
          </div>
        </div>
        <nav className="navigation" aria-label="Primary navigation">
          {navigation.map((item) => (
            <button
              className={`nav-item ${activeNav === item.label ? 'active' : ''}`}
              key={item.label}
              onClick={() => {
                if (item.label === 'Home') {
                  setIsAuthenticated(false)
                  setEntryScreen('landing')
                  return
                }
                handleNavigation(item.label)
              }}
              type="button"
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.label === 'Dashboard' && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="header-utility">
          <span className={`backend-badge ${casesError ? 'offline' : ''}`}><span className="status-pulse" /> {backendStatus}</span>
          <button className="signout-button" type="button" onClick={() => { setIsAuthenticated(false); setEntryScreen('landing') }}>Sign out</button>
        </div>
        <div className="sidebar-footer">
          <span className="sidebar-footer-dot" />
          <span>Workspace protected</span>
          <span className="sidebar-footer-code">TN / 01</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">TraceNova <span>•</span> Investigation platform</div>
            <h1>{activeNav}</h1>
            {activeCase && <p className="topbar-case">Active case: {activeCase.case_number || `Case ${activeCase.id}`} — {activeCase.title || 'Untitled case'}</p>}
          </div>
          <div className="topbar-actions">
            <span className="topbar-date">{currentDateLabel}</span>
            <button className="topbar-refresh" type="button" onClick={loadCases} disabled={casesLoading} aria-label="Refresh cases">↻</button>
          </div>
        </header>

        <div className="content">
          <section className="investigation-stepper" aria-label="Investigation workflow">
            {[
              ['01', 'Create case', 'Dashboard'],
              ['02', 'Add evidence', 'Evidence'],
              ['03', 'Run analysis', 'Analysis'],
              ['04', 'Review results', 'Analysis'],
              ['05', 'Generate report', 'Reports'],
            ].map(([number, label, destination], index) => {
              const stepActive = activeNav === destination || (index === 0 && activeNav === 'Cases')
              const stepComplete = index === 0 && selectedCaseId
                ? true
                : index === 1 && uploadResult
                  ? true
                  : index === 2 && analysisResult
                    ? true
                    : index === 3 && analysisResult
                      ? true
                      : false
              return (
                <button
                  className={`workflow-step ${stepActive ? 'active' : ''} ${stepComplete ? 'complete' : ''}`}
                  key={number}
                  type="button"
                  onClick={() => handleNavigation(destination)}
                >
                  <span className="workflow-step-number">{stepComplete ? '✓' : number}</span>
                  <span>{label}</span>
                  {index < 4 && <i aria-hidden="true">→</i>}
                </button>
              )
            })}
          </section>
          {activeNav === 'Cases' ? (
            <section className="cases-view">
              <section className="welcome-row">
                <div>
                  <p className="section-kicker">Case management</p>
                  <h2>Cases</h2>
                  <p className="section-description">
                    Review cases connected to the TraceNova investigation backend.
                  </p>
                </div>
                <button className="primary-button" type="button" onClick={handleCreateCase}>
                  <span>＋</span> Create Case
                </button>
              </section>

              <article className="panel cases-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Live backend data</p>
                    <h3>All Cases</h3>
                  </div>
                  <span className="live-label"><span /> GET /cases/</span>
                </div>
                {!casesLoading && !casesError && cases.length > 0 && (
                  <div className="case-filters">
                    <label className="search-field">
                      <span aria-hidden="true">⌕</span>
                      <input
                        value={caseSearch}
                        onChange={(event) => setCaseSearch(event.target.value)}
                        placeholder="Search case number, title, or ID"
                        aria-label="Search cases"
                      />
                    </label>
                    <select value={caseSort} onChange={(event) => setCaseSort(event.target.value)} aria-label="Sort cases">
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                    <span className="filter-note">Risk filters unlock when risk metadata is returned by the API.</span>
                  </div>
                )}
                {casesLoading && <div className="cases-message">Loading cases...</div>}
                {!casesLoading && casesError && (
                  <div className="cases-message error-message">
                    <strong>Backend unavailable</strong>
                    <span>{casesError}</span>
                    <button className="secondary-button retry-button" type="button" onClick={loadCases}>Retry</button>
                  </div>
                )}
                {!casesLoading && !casesError && cases.length === 0 && (
                  <div className="cases-message empty-state">
                    <strong>No investigations yet</strong>
                    <span>Create a case to begin a real investigation workspace.</span>
                    <button className="primary-button" type="button" onClick={handleCreateCase}>Create New Case</button>
                  </div>
                )}
                {!casesLoading && !casesError && cases.length > 0 && (
                  <div className="case-table-wrap">
                    <table className="case-table cases-table">
                      <thead>
                        <tr>
                          <th>Case Number</th>
                          <th>Title</th>
                          <th>Case ID</th>
                          <th>Created At</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCases.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.case_number || '—'}</strong></td>
                            <td><strong>{item.title || '—'}</strong></td>
                            <td><span className="case-id">{item.id}</span></td>
                            <td className="muted-cell">{formatCreatedAt(item.created_at)}</td>
                            <td>
                              <button
                                className="table-action"
                                type="button"
                                onClick={() => openInvestigation(item.id)}
                              >
                                Open Investigation
                              </button>
                            </td>
                          </tr>
                        ))}
                        {visibleCases.length === 0 && (
                          <tr><td colSpan="5" className="dashboard-empty-row">No cases match this search.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </section>
          ) : activeNav === 'Evidence' ? (
            <section className="evidence-view">
              <section className="welcome-row">
                <div>
                  <p className="section-kicker">Evidence intake</p>
                  <h2>Upload Evidence</h2>
                  <p className="section-description">
                    Attach a CSV artifact to an existing investigation case.
                  </p>
                </div>
              </section>

              <article className="panel upload-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Live backend action</p>
                    <h3>New evidence file</h3>
                  </div>
                  <span className="live-label"><span /> POST /cases/:id/evidence</span>
                </div>
                {casesLoading && <div className="cases-message">Loading cases...</div>}
                {!casesLoading && casesError && (
                  <div className="cases-message error-message">
                    <strong>Backend waking up / unavailable</strong>
                    <span>{casesError}</span>
                    <button className="secondary-button retry-button" type="button" onClick={loadCases}>Retry</button>
                  </div>
                )}
                {!casesLoading && !casesError && cases.length === 0 && (
                  <div className="cases-message empty-state">
                    <strong>No selected investigation</strong>
                    <span>Create or open a case before uploading evidence.</span>
                    <button className="primary-button" type="button" onClick={handleCreateCase}>Create New Case</button>
                  </div>
                )}
                {!casesLoading && !casesError && cases.length > 0 && (
                  <form className="upload-form" onSubmit={handleEvidenceSubmit}>
                    <label>
                      Select case <span>*</span>
                      <select
                        value={selectedCaseId}
                        onChange={(event) => {
                          setSelectedCaseId(event.target.value)
                          setUploadError('')
                          setUploadResult(null)
                        }}
                        disabled={isUploading}
                        required
                      >
                        <option value="">Choose an existing case</option>
                        {cases.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.case_number || `Case ${item.id}`} — {item.title || 'Untitled case'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      CSV evidence file <span>*</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileChange}
                        disabled={isUploading}
                        required
                      />
                      {selectedFile && <small className="selected-file">{selectedFile.name}</small>}
                    </label>
                    {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
                    <div className="upload-actions">
                      <button className="primary-button" type="submit" disabled={isUploading}>
                        {isUploading ? 'Uploading evidence...' : 'Upload Evidence'}
                      </button>
                    </div>
                  </form>
                )}
              </article>

              {uploadResult && (
                <article className="panel upload-result" role="status">
                  <div className="result-heading">
                    <div>
                      <p className="section-kicker">Upload complete</p>
                      <h3>Evidence accepted</h3>
                    </div>
                    <span className="result-check">✓</span>
                  </div>
                  <div className="result-grid">
                    <div><small>Filename</small><strong>{uploadResult.filename}</strong></div>
                    <div><small>Evidence ID</small><strong>{uploadResult.evidence_id}</strong></div>
                    <div><small>Records ingested</small><strong>{uploadResult.records_ingested}</strong></div>
                    <div className="hash-field"><small>SHA-256</small><strong>{uploadResult.sha256}</strong></div>
                  </div>
                </article>
              )}
            </section>
          ) : activeNav === 'Analysis' ? (
            <section className="analysis-view">
              <section className="welcome-row">
                <div>
                  <p className="section-kicker">Investigation analytics</p>
                  <h2>Case Analysis</h2>
                  <p className="section-description">
                Correlate evidence, relationships, graph structure, and model predictions for a selected case.
                  </p>
                </div>
              </section>

              <article className="panel analysis-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Live backend action</p>
                    <h3>Case analysis</h3>
                  </div>
                  <span className="live-label"><span /> POST /analysis/case/:id</span>
                </div>
                {casesLoading && <div className="cases-message">Loading cases...</div>}
                {!casesLoading && casesError && (
                  <div className="cases-message error-message">
                    <strong>Backend waking up / unavailable</strong>
                    <span>{casesError}</span>
                    <button className="secondary-button retry-button" type="button" onClick={loadCases}>Retry</button>
                  </div>
                )}
                {!casesLoading && !casesError && cases.length === 0 && (
                  <div className="cases-message empty-state">
                    <strong>No investigations yet</strong>
                    <span>Create a case before running analysis.</span>
                    <button className="primary-button" type="button" onClick={handleCreateCase}>Create New Case</button>
                  </div>
                )}
                {!casesLoading && !casesError && cases.length > 0 && (
                  <form className="analysis-form" onSubmit={handleAnalysisSubmit}>
                    <label>
                      Select case <span>*</span>
                      <select
                        value={selectedCaseId}
                        onChange={(event) => {
                          setSelectedCaseId(event.target.value)
                          setAnalysisError('')
                          setAnalysisResult(null)
                        }}
                        disabled={isAnalyzing}
                        required
                      >
                        <option value="">Choose an existing case</option>
                        {cases.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.case_number || `Case ${item.id}`} — {item.title || 'Untitled case'}
                          </option>
                        ))}
                      </select>
                    </label>
                    {analysisError && <p className="form-error" role="alert">{analysisError}</p>}
                    <button className="primary-button" type="submit" disabled={isAnalyzing}>
                      {isAnalyzing ? 'Analyzing case...' : 'Analyze Case'}
                    </button>
                  </form>
                )}
              </article>

              {analysisResult && (
                <section className="analysis-results">
                  {(() => {
                    const analysisCase = getAnalysisCase(cases, analysisResult.case_id)
                    const summary = analysisResult.report?.investigation_summary || {}
                    const graphNodes = analysisResult.graph?.nodes || []
                    const graphEdges = analysisResult.graph?.edges || []
                    const evidenceMatchesCase = uploadResult && String(uploadResult.case_id) === String(analysisResult.case_id)
                    return (
                      <>
                  <article className="case-analysis-header panel">
                    <div>
                      <p className="section-kicker">TraceNova / investigation workspace</p>
                      <h3>{analysisCase?.case_number || `Case ${analysisResult.case_id}`}</h3>
                      <p>{analysisCase?.title || 'Case analysis result'}</p>
                    </div>
                    <div className="case-header-meta">
                      <span><small>Case ID</small><strong>{analysisResult.case_id}</strong></span>
                      <span><small>Records analyzed</small><strong>{analysisResult.records_analyzed}</strong></span>
                      <span><small>Analysis status</small><strong className="status-complete">Completed</strong></span>
                    </div>
                  </article>
                  <div className="results-heading">
                    <div>
                      <p className="section-kicker">Live analysis result</p>
                      <h3>Investigation overview</h3>
                    </div>
                    <span className="case-id">CASE ID {analysisResult.case_id}</span>
                  </div>

                  <div className="analysis-result-grid">
                    <article className="panel result-panel">
                      <p className="section-kicker">Overall analysis</p>
                      <h4>Rule-based assessment</h4>
                      <div className="risk-ring rule-ring" style={{ '--risk-value': `${Math.min(100, Number(analysisResult.risk) || 0)}%` }}>
                        <div><strong>{displayMetric(analysisResult.risk, '0')}%</strong><span>rule score</span></div>
                      </div>
                      <div className="metric-list">
                        <div><span>Records analyzed</span><strong>{analysisResult.records_analyzed}</strong></div>
                        <div><span>Risk score</span><strong>{analysisResult.risk}</strong></div>
                        <div><span>Low risk</span><strong>{analysisResult.risk_summary?.low ?? 0}</strong></div>
                        <div><span>Medium risk</span><strong>{analysisResult.risk_summary?.medium ?? 0}</strong></div>
                        <div><span>High risk</span><strong>{analysisResult.risk_summary?.high ?? 0}</strong></div>
                      </div>
                      <p className="result-note">
                        Investigation risk level: {analysisResult.report?.investigation_summary?.risk_level || '—'}
                      </p>
                    </article>

                    <article className="panel result-panel">
                      <p className="section-kicker">ML analysis</p>
                      <h4>Fraud prediction</h4>
                      <div className={`risk-ring ml-ring ${analysisResult.fraud_probability === null ? 'is-unavailable' : ''}`} style={{ '--risk-value': `${percentage(analysisResult.fraud_probability) ?? 0}%` }}>
                        <div><strong>{percentage(analysisResult.fraud_probability) === null ? '—' : `${percentage(analysisResult.fraud_probability)}%`}</strong><span>fraud probability</span></div>
                      </div>
                      <div className="metric-list">
                        <div><span>Fraud probability</span><strong>{percentage(analysisResult.fraud_probability) === null ? 'Unavailable' : `${percentage(analysisResult.fraud_probability)}%`}</strong></div>
                        <div><span>ML risk level</span><strong>{displayMetric(analysisResult.risk_level)}</strong></div>
                        <div><span>CDR records used</span><strong>{analysisResult.report?.cdr_records_used ? analysisResult.report.cdr_records_used : 'Unavailable'}</strong></div>
                        <div><span>ML predictions</span><strong>{analysisResult.ml_predictions?.length ? analysisResult.ml_predictions.length : 'Unavailable'}</strong></div>
                      </div>
                      <p className="result-note">{analysisResult.fraud_probability === null ? 'ML scoring is available only when the case contains valid CDR fields.' : 'ML risk level is separate from the overall investigation risk.'}</p>
                    </article>

                    <article className="panel result-panel">
                      <p className="section-kicker">Relationships</p>
                      <h4>Entity connections</h4>
                      <div className="single-metric">
                        <strong>{analysisResult.relationships?.length ?? 0}</strong>
                        <span>detected relationships</span>
                      </div>
                    </article>

                    <article className="panel result-panel">
                      <p className="section-kicker">Graph</p>
                      <h4>Network structure</h4>
                      <div className="graph-metrics">
                        <div><strong>{analysisResult.graph?.nodes?.length ?? 0}</strong><span>nodes</span></div>
                        <div><strong>{analysisResult.graph?.edges?.length ?? 0}</strong><span>edges</span></div>
                      </div>
                    </article>
                  </div>

                  <article className="panel finding-panel">
                    <div>
                      <p className="section-kicker">Investigation findings</p>
                      <h3>{formatValue(summary.finding, 'No finding returned')}</h3>
                    </div>
                    <div className="finding-stat-grid">
                      <span><small>Investigation risk</small><strong>{formatValue(summary.risk_level)}</strong></span>
                      <span><small>Relationships</small><strong>{formatValue(summary.relationship_count ?? analysisResult.relationships?.length ?? 0)}</strong></span>
                      <span><small>Graph entities</small><strong>{formatValue(summary.graph_node_count ?? graphNodes.length)}</strong></span>
                      <span><small>Graph connections</small><strong>{formatValue(summary.graph_edge_count ?? graphEdges.length)}</strong></span>
                    </div>
                  </article>

                  <div className="analysis-detail-grid">
                    <article className="panel detail-panel">
                      <div className="panel-heading">
                        <div><p className="section-kicker">ML detail</p><h3>Prediction Results</h3></div>
                        <span className="case-id">{analysisResult.ml_predictions?.length ?? 0} rows</span>
                      </div>
                      {!analysisResult.ml_predictions?.length ? (
                        <div className="detail-empty">No ML predictions were returned for this analysis. The selected evidence does not contain valid CDR records for the ML feature schema.</div>
                      ) : (() => {
                        const predictions = analysisResult.ml_predictions
                        const columns = getPredictionColumns(predictions)
                        return (
                          <div className="data-table-wrap">
                            <table className="data-table">
                              <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                              <tbody>{predictions.map((prediction, index) => (
                                <tr key={`${prediction.record_index ?? index}-${index}`}>
                                  {columns.map((column) => <td key={column}>{formatValue(prediction[column])}</td>)}
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        )
                      })()}
                    </article>

                    <article className="panel detail-panel">
                      <div className="panel-heading">
                        <div><p className="section-kicker">Entity resolution</p><h3>Relationships</h3></div>
                        <span className="case-id">{analysisResult.relationships?.length ?? 0} found</span>
                      </div>
                      {!analysisResult.relationships?.length ? (
                        <div className="detail-empty">No linked relationships detected.</div>
                      ) : (
                        <div className="data-table-wrap">
                          <table className="data-table">
                            <thead><tr><th>Source record</th><th>Relationship</th><th>Target record</th><th>Matched attributes</th></tr></thead>
                            <tbody>{analysisResult.relationships.map((relationship, index) => (
                              <tr key={`${relationship.record_1}-${relationship.record_2}-${index}`}>
                                <td>{formatValue(relationship.record_1)}</td>
                                <td><span className="relationship-arrow">linked to</span></td>
                                <td>{formatValue(relationship.record_2)}</td>
                                <td>{formatMatchDetails(relationship.matches)}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      )}
                    </article>
                  </div>

                  <div className="investigation-support-grid">
                    <article className="panel entity-panel">
                      <div className="panel-heading">
                        <div><p className="section-kicker">Graph intelligence</p><h3>Entity Intelligence</h3></div>
                        <span className="case-id">{graphNodes.length} entities</span>
                      </div>
                      {!graphNodes.length ? (
                        <div className="detail-empty">No graph entities were returned.</div>
                      ) : (
                        <div className="entity-list">
                          {graphNodes.slice(0, 40).map((node) => {
                            const connectionCount = graphEdges.filter((edge) => String(edge.source) === String(node.id) || String(edge.target) === String(node.id)).length
                            return (
                              <div className="entity-row" key={String(node.id)}>
                                <span className="entity-symbol">{String(node.type || 'entity').slice(0, 1).toUpperCase()}</span>
                                <div><strong>{formatValue(node.identifier || node.label || node.id)}</strong><small>{formatValue(node.type, 'entity')}</small></div>
                                <span className="entity-connections">{connectionCount} connection{connectionCount === 1 ? '' : 's'}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {graphNodes.length > 40 && <p className="result-note">Showing 40 of {graphNodes.length} returned graph entities.</p>}
                    </article>

                    <article className="panel timeline-panel">
                      <div className="panel-heading">
                        <div><p className="section-kicker">Processing path</p><h3>Investigation Flow</h3></div>
                      </div>
                      <div className="investigation-timeline">
                        {['Evidence', 'Ingestion', 'Entity / relationship analysis', 'Graph construction', 'Rule-based risk', 'Machine learning', 'Investigation finding'].map((stage, index) => (
                          <div className="timeline-step" key={stage}><span>{String(index + 1).padStart(2, '0')}</span><strong>{stage}</strong></div>
                        ))}
                      </div>
                    </article>
                  </div>

                  <article className="panel evidence-context-panel">
                    <div className="panel-heading">
                      <div><p className="section-kicker">Evidence intelligence</p><h3>Evidence context</h3></div>
                      <span className="case-id">{evidenceMatchesCase ? 'Current case' : 'Upload result not attached'}</span>
                    </div>
                    {evidenceMatchesCase ? (
                      <div className="evidence-context-grid">
                        <span><small>Filename</small><strong>{formatValue(uploadResult.filename)}</strong></span>
                        <span><small>Evidence ID</small><strong>{formatValue(uploadResult.evidence_id)}</strong></span>
                        <span><small>File type</small><strong>{formatValue(uploadResult.file_type)}</strong></span>
                        <span><small>Records ingested</small><strong>{formatValue(uploadResult.records_ingested)}</strong></span>
                        <span className="hash-value"><small>SHA-256</small><strong>{formatValue(uploadResult.sha256)}</strong></span>
                      </div>
                    ) : (
                      <p className="detail-empty">Upload the selected case evidence from the Evidence workspace to view its file metadata here.</p>
                    )}
                  </article>

                  <article className="panel summary-panel">
                    <div className="panel-heading">
                      <div><p className="section-kicker">Report summary</p><h3>Investigation Summary</h3></div>
                    </div>
                    <div className="summary-grid">
                      <div><span>Risk level</span><strong>{formatValue(analysisResult.report?.investigation_summary?.risk_level)}</strong></div>
                      <div><span>Relationships</span><strong>{formatValue(analysisResult.report?.investigation_summary?.relationship_count)}</strong></div>
                      <div><span>Graph nodes</span><strong>{formatValue(analysisResult.report?.investigation_summary?.graph_node_count)}</strong></div>
                      <div><span>Graph edges</span><strong>{formatValue(analysisResult.report?.investigation_summary?.graph_edge_count)}</strong></div>
                    </div>
                    <p className="finding-text">{formatValue(analysisResult.report?.investigation_summary?.finding)}</p>
                  </article>

                  <article className="panel investigation-graph">
                    <div className="panel-heading">
                      <div>
                      <p className="section-kicker">Entity relationship analysis</p>
                      <h3>Investigation Network</h3>
                      </div>
                    <div className="graph-toolbar">
                      <span className="live-label"><span /> Actual analysis graph</span>
                      <button type="button" className="graph-control" onClick={() => setGraphZoom((value) => Math.min(1.5, value + 0.1))} aria-label="Zoom in">+</button>
                      <button type="button" className="graph-control" onClick={() => setGraphZoom((value) => Math.max(.7, value - 0.1))} aria-label="Zoom out">−</button>
                      <button type="button" className="graph-control graph-reset" onClick={() => { setGraphZoom(1); setSelectedGraphNodeId(null) }}>Reset</button>
                    </div>
                  </div>
                    {analysisResult.graph?.edges?.length === 0 ? (
                      <div className="graph-empty">No linked entities detected in this analysis.</div>
                    ) : (() => {
                          const graphLayout = createGraphLayout(analysisResult.graph)
                          const connectedToSelected = new Set()
                          if (selectedGraphNodeId) {
                            graphLayout.edges.forEach((edge) => {
                              if (String(edge.source) === selectedGraphNodeId) connectedToSelected.add(String(edge.target))
                              if (String(edge.target) === selectedGraphNodeId) connectedToSelected.add(String(edge.source))
                            })
                          }
                          const nodeTypes = [...new Set(graphLayout.nodes.map((node) => node.type).filter(Boolean))]
                          const selectedNode = graphLayout.nodes.find((node) => String(node.id) === selectedGraphNodeId)
                          const selectedConnections = selectedGraphNodeId
                            ? graphLayout.edges.filter((edge) => String(edge.source) === selectedGraphNodeId || String(edge.target) === selectedGraphNodeId).length
                            : 0
                          const normalizedSearch = graphSearch.trim().toLowerCase()
                          const matchingNodeIds = new Set(graphLayout.nodes
                            .filter((node) => `${formatGraphIdentifier(node)} ${formatGraphType(node)}`.toLowerCase().includes(normalizedSearch))
                            .map((node) => String(node.id)))
                          const selectedEdges = selectedGraphNodeId
                            ? graphLayout.edges.filter((edge) => String(edge.source) === selectedGraphNodeId || String(edge.target) === selectedGraphNodeId)
                            : []
                          return (
                            <>
                        <div className="graph-summary-grid">
                          <span><small>Records</small><strong>{graphLayout.nodes.length}</strong></span>
                          <span><small>Relationships</small><strong>{graphLayout.edges.length}</strong></span>
                          {nodeTypes.map((type) => <span key={`summary-${type}`}><small>{formatGraphType({ type })}</small><strong>{graphLayout.nodes.filter((node) => node.type === type).length}</strong></span>)}
                        </div>
                        <div className="graph-meta-row">
                          <div className="graph-legend">
                            {nodeTypes.map((type) => <span key={type}><i className={`legend-${String(type).toLowerCase()}`} />{formatGraphType({ type })}</span>)}
                          </div>
                          <label className="graph-search">Search returned records<input value={graphSearch} onChange={(event) => setGraphSearch(event.target.value)} placeholder="Record or type" /></label>
                        </div>
                        <div className="graph-canvas" aria-label="Investigation graph">
                          <svg
                            viewBox={`0 0 900 ${graphLayout.height}`}
                            role="img"
                            aria-label={`${graphLayout.nodes.length} nodes and ${graphLayout.edges.length} edges`}
                          >
                            <defs>
                              <marker
                                id="graph-arrow"
                                markerWidth="7"
                                markerHeight="7"
                                refX="6"
                                refY="3.5"
                                orient="auto"
                              >
                                <path d="M0,0 L7,3.5 L0,7 z" />
                              </marker>
                            </defs>
                            <g className="graph-viewport" transform={`translate(${450 - 450 * graphZoom} ${graphLayout.height / 2 - (graphLayout.height / 2) * graphZoom}) scale(${graphZoom})`}>
                            <g className="graph-edges">
                              {graphLayout.edges.map((edge, index) => {
                                const source = graphLayout.positions.get(String(edge.source))
                                const target = graphLayout.positions.get(String(edge.target))
                                if (!source || !target) {
                                  return null
                                }
                                return (
                                  <g
                                    key={`${edge.source}-${edge.target}-${index}`}
                                    className={`graph-edge-group ${hoveredGraphEdge === index ? 'is-hovered' : ''} ${selectedGraphNodeId && String(edge.source) !== selectedGraphNodeId && String(edge.target) !== selectedGraphNodeId ? 'is-dimmed' : ''}`}
                                    onMouseEnter={() => setHoveredGraphEdge(index)}
                                    onMouseLeave={() => setHoveredGraphEdge(null)}
                                    onClick={() => setHoveredGraphEdge(index)}
                                    role="button"
                                    tabIndex="0"
                                    aria-label={`${formatGraphType({ type: edge.entity_type })} relationship, ${formatGraphIdentifier(graphLayout.nodes.find((node) => String(node.id) === String(edge.source)))} to ${formatGraphIdentifier(graphLayout.nodes.find((node) => String(node.id) === String(edge.target)))}`}
                                  >
                                    <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} markerEnd="url(#graph-arrow)" />
                                    <text className="graph-edge-label" x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 6}>{formatGraphType({ type: edge.entity_type })}</text>
                                  </g>
                                )
                              })}
                            </g>
                            <g className="graph-nodes">
                              {graphLayout.nodes.map((node) => {
                                const position = graphLayout.positions.get(String(node.id))
                                const nodeId = String(node.id)
                                const isSelected = nodeId === selectedGraphNodeId
                                const isConnected = connectedToSelected.has(nodeId)
                                return (
                                  <g
                                    className={`graph-node ${isSelected ? 'is-selected' : ''} ${normalizedSearch && !matchingNodeIds.has(nodeId) ? 'is-search-dimmed' : ''} ${selectedGraphNodeId && !isSelected && !isConnected ? 'is-dimmed' : ''}`}
                                    key={nodeId}
                                    transform={`translate(${position.x} ${position.y})`}
                                    onFocus={() => setSelectedGraphNodeId(nodeId)}
                                    onClick={() => setSelectedGraphNodeId((current) => current === nodeId ? null : nodeId)}
                                    tabIndex="0"
                                    role="button"
                                    aria-label={`${node.type || 'entity'} ${node.identifier || node.label || node.id}`}
                                  >
                                    <circle r={isSelected ? 23 : 19} />
                                    <text className="graph-node-type" y="-29">{formatGraphType(node)}</text>
                                    <text className="graph-node-label" y="36">{shortenGraphValue(formatGraphIdentifier(node))}</text>
                                    <title>{`${formatGraphType(node)}: ${formatGraphIdentifier(node)}`}</title>
                                  </g>
                                )
                              })}
                            </g>
                            </g>
                          </svg>
                        </div>
                        {selectedNode && <aside className="graph-entity-panel">
                          <div>
                            <p className="section-kicker">Selected returned entity</p>
                            <h4>{formatGraphIdentifier(selectedNode)}</h4>
                            <span className="entity-type-badge">{formatGraphType(selectedNode)}</span>
                          </div>
                          <div className="graph-entity-facts"><span><small>Relationship count</small><strong>{selectedConnections}</strong></span><span><small>Backend value</small><strong>{formatGraphIdentifier(selectedNode)}</strong></span></div>
                          <div className="graph-related-list">
                            <small>Connected records</small>
                            {!selectedEdges.length ? <span>No relationships returned.</span> : selectedEdges.map((edge, index) => {
                              const relatedId = String(edge.source) === selectedGraphNodeId ? edge.target : edge.source
                              const relatedNode = graphLayout.nodes.find((node) => String(node.id) === String(relatedId))
                              return <span key={`${relatedId}-${index}`}><b>{formatGraphType({ type: edge.entity_type })}</b> · {formatGraphIdentifier(relatedNode)} <em>{shortenGraphValue(edge.value)}</em></span>
                            })}
                          </div>
                        </aside>}
                            </>
                          )
                    })()}
                  </article>
                      </>
                    )
                  })()}
                </section>
              )}
            </section>
          ) : activeNav === 'Reports' ? (
            <section className="reports-view">
              <section className="welcome-row">
                <div>
                  <p className="section-kicker">Investigation record</p>
                  <h2>Reports</h2>
                  <p className="section-description">Review and export the most recent successful case analysis.</p>
                </div>
                <button className="primary-button" type="button" onClick={exportReport} disabled={!analysisResult}>
                  Export Report
                </button>
              </section>
              {reportExportError && <p className="form-error report-export-error" role="alert">{reportExportError}</p>}
              {!analysisResult ? (
                <article className="panel report-empty">No investigation report available. Analyze a case first.</article>
              ) : (
                <article className="panel report-panel">
                  <div className="report-header">
                    <div>
                      <p className="section-kicker">Case {formatValue(analysisResult.case_id)}</p>
                      <h3>Complete Investigation Report</h3>
                    </div>
                    <span className="case-id">LIVE RESULT</span>
                  </div>
                  <div className="report-metrics">
                    <div><small>Records analyzed</small><strong>{formatValue(analysisResult.records_analyzed)}</strong></div>
                    <div><small>Rule-based risk</small><strong>{formatValue(analysisResult.risk)}</strong></div>
                    <div><small>Rule-based level</small><strong>{formatValue(analysisResult.report?.investigation_summary?.risk_level)}</strong></div>
                    <div><small>ML fraud probability</small><strong>{formatValue(analysisResult.fraud_probability)}</strong></div>
                    <div><small>ML risk level</small><strong>{formatValue(analysisResult.risk_level)}</strong></div>
                    <div><small>CDR records used</small><strong>{formatValue(analysisResult.report?.cdr_records_used)}</strong></div>
                    <div><small>ML predictions</small><strong>{analysisResult.ml_predictions?.length ?? 0}</strong></div>
                    <div><small>Relationships</small><strong>{analysisResult.relationships?.length ?? 0}</strong></div>
                    <div><small>Graph nodes</small><strong>{analysisResult.graph?.nodes?.length ?? 0}</strong></div>
                    <div><small>Graph edges</small><strong>{analysisResult.graph?.edges?.length ?? 0}</strong></div>
                  </div>
                  <div className="report-breakdown">
                    <div><span>Low</span><strong>{analysisResult.risk_summary?.low ?? 0}</strong></div>
                    <div><span>Medium</span><strong>{analysisResult.risk_summary?.medium ?? 0}</strong></div>
                    <div><span>High</span><strong>{analysisResult.risk_summary?.high ?? 0}</strong></div>
                  </div>
                  <div className="report-finding">
                    <small>Investigation finding</small>
                    <p>{formatValue(analysisResult.report?.investigation_summary?.finding)}</p>
                  </div>
                </article>
              )}
            </section>
          ) : (
          <>
          <section className="welcome-row">
            <div>
              <p className="section-kicker">Command dashboard</p>
              <h2>Investigation Dashboard</h2>
              <p className="section-description">
                Monitor investigations, evidence and threat analysis from one workspace.
              </p>
            </div>
            <button className="primary-button" type="button" onClick={handleCreateCase}>
              <span>＋</span> Create New Case
            </button>
          </section>
          {activeCase && (
            <section className="continue-banner panel">
              <div>
                <p className="section-kicker">Last selected investigation</p>
                <h3>{activeCase.case_number || `Case ${activeCase.id}`}</h3>
                <p>{activeCase.title || 'Untitled case'} <span>•</span> ID {activeCase.id}</p>
              </div>
              <button className="primary-button" type="button" onClick={() => openInvestigation(activeCase.id)}>
                Continue Last Investigation <span>→</span>
              </button>
            </section>
          )}

          <section className="overview-grid" aria-label="Dashboard overview">
            {[
              { label: 'Total Cases', value: casesLoaded ? cases.length : 'N/A', note: casesLoaded ? 'Live backend cases' : 'Loading cases', tone: 'cyan', icon: '◫', destination: 'Cases' },
              { label: 'Evidence Records', value: uploadResult?.records_ingested ?? 'N/A', note: uploadResult ? 'Latest upload records' : 'Upload evidence to populate', tone: 'violet', icon: '◈', destination: 'Evidence' },
              { label: 'High Risk Cases', value: analysisResult ? (analysisResult.risk_summary?.high ?? 0) : 'N/A', note: analysisResult ? 'High-risk records in latest analysis' : 'Analyze a case to populate', tone: 'orange', icon: '△', destination: 'Analysis' },
              { label: 'Analyses', value: analysisResult ? '1' : '0', note: analysisResult ? 'Latest analysis completed' : 'No analysis in this session', tone: 'green', icon: '⌁', destination: 'Analysis' },
            ].map((card) => (
              <button
                className={`overview-card overview-card-button ${card.tone}`}
                key={card.label}
                type="button"
                onClick={() => handleNavigation(card.destination)}
                aria-label={`Open ${card.destination}`}
              >
                <div className="card-topline">
                  <span className="card-label">{card.label}</span>
                  <span className="card-icon" aria-hidden="true">{card.icon}<span className="card-open-arrow">↗</span></span>
                </div>
                <div className="card-value">{card.value}</div>
                <div className="card-note"><span className="placeholder-dot" />{card.note}</div>
              </button>
            ))}
          </section>

          <section className="workspace-grid">
            <article className="panel recent-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Case activity</p>
                  <h3>Recent Cases</h3>
                </div>
                <button className="text-button" type="button" onClick={showCases}>
                  View All Cases <span>→</span>
                </button>
              </div>
              <div className="case-table-wrap">
                <table className="case-table">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Last updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!casesLoaded && casesLoading && <tr><td colSpan="5" className="dashboard-empty-row">Loading cases...</td></tr>}
                    {!casesLoading && casesError && <tr><td colSpan="5" className="dashboard-empty-row error-message">{casesError} <button className="table-action" type="button" onClick={loadCases}>Retry</button></td></tr>}
                    {!casesLoading && !casesError && cases.length === 0 && <tr><td colSpan="5" className="dashboard-empty-row">No cases found. <button className="table-action" type="button" onClick={handleCreateCase}>Create New Case</button></td></tr>}
                    {!casesLoading && !casesError && cases.slice(0, 5).map((item) => (
                      <tr key={item.id}>
                        <td><span className="case-id">{item.case_number || `CASE-${item.id}`}</span><small>ID {item.id}</small></td>
                        <td><strong>{item.title || '—'}</strong></td>
                        <td><span className="status-badge">{item.status || item.investigation_status || '—'}</span></td>
                        <td>{formatCreatedAt(item.created_at)}</td>
                        <td><button className="table-action" type="button" onClick={() => openInvestigation(item.id)}>Open Investigation</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="empty-data-note">
                <span className="info-icon">i</span>
                Risk and evidence totals are not available from the existing backend API.
              </div>
            </article>

            <article className="panel quick-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Secure workspace</p>
                  <h3>Investigation flow</h3>
                </div>
                <span className="shield-icon">◇</span>
              </div>
              <div className="flow-list">
                <div className="flow-step">
                  <span className="flow-number">01</span>
                  <div><strong>Open a case</strong><small>Organize an investigation workspace</small></div>
                </div>
                <div className="flow-line" />
                <div className="flow-step">
                  <span className="flow-number">02</span>
                  <div><strong>Attach evidence</strong><small>Centralize digital artifacts</small></div>
                </div>
                <div className="flow-line" />
                <div className="flow-step">
                  <span className="flow-number">03</span>
                  <div><strong>Run analysis</strong><small>Correlate risk and relationships</small></div>
                </div>
              </div>
              <button className="primary-button" type="button" onClick={handleStartEvidence}>
                Start Evidence <span>→</span>
              </button>
            </article>
          </section>
          </>
          )}
        </div>

        {successMessage && (
          <div className="demo-notice success-notice" role="status">
            <span>✓</span>
            {successMessage}
          </div>
        )}
      </main>

      {showCreateForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeCreateForm}>
          <section
            className="create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-case-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="section-kicker">New investigation</p>
                <h2 id="create-case-title">Create Case</h2>
              </div>
              <button className="modal-close" type="button" onClick={closeCreateForm} disabled={isCreating} aria-label="Close">
                ×
              </button>
            </div>
            <form className="case-form" onSubmit={handleCreateSubmit}>
              <label>
                Case Number <span>*</span>
                <input
                  name="case_number"
                  value={form.case_number}
                  onChange={handleFormChange}
                  placeholder="e.g. CASE-001"
                  disabled={isCreating}
                  required
                />
              </label>
              <label>
                Title <span>*</span>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Investigation title"
                  disabled={isCreating}
                  required
                />
              </label>
              <label>
                Description <small>Optional</small>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Add context for this investigation"
                  rows="4"
                  disabled={isCreating}
                />
              </label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions">
                <button className="cancel-button" type="button" onClick={closeCreateForm} disabled={isCreating}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating case...' : 'Create Case'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
