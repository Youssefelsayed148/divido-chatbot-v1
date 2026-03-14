import { useState, useEffect } from "react"
import axios from "axios"

// dev → hits admin API directly | Docker/prod → hits nginx which proxies to admin API
const API = import.meta.env.DEV ? "http://localhost:8001" : "/api"
const INTENTS = [
  "overview", "how_it_works", "getting_started",
  "opportunities", "trust_legal", "support", "fallback"
]

const EMPTY_FORM = {
  title: "", content: "", source_type: "website",
  source_name: "", topic: "", intent_categories: [],
  priority: 2, approved: true
}

// ── Axios helper ──────────────────────────────────────────────────────────────
function api(token) {
  return axios.create({
    baseURL: API,
    headers: { "x-admin-token": token }
  })
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type }) {
  if (!message) return null
  const bg = type === "error" ? "#c0392b" : "#27ae60"
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      background: bg, color: "#fff", padding: "12px 20px",
      borderRadius: 8, fontWeight: 600, zIndex: 9999,
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
    }}>
      {message}
    </div>
  )
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError("")
    try {
      const res = await axios.post(`${API}/admin/login`, { password })
      onLogin(res.data.token)
    } catch {
      setError("Incorrect password. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "#f5f5f5", fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{
        background: "#fff", padding: 40, borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.1)", width: 360
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, background: "#FF6B2B",
            borderRadius: 12, margin: "0 auto 12px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24
          }}>🏠</div>
          <h2 style={{ margin: 0, color: "#1A1A1A" }}>Divido Admin</h2>
          <p style={{ color: "#666", margin: "6px 0 0", fontSize: 14 }}>
            Knowledge Management
          </p>
        </div>

        <input
          type="password"
          placeholder="Enter admin password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={{
            width: "100%", padding: "11px 14px", fontSize: 15,
            border: "1.5px solid #ddd", borderRadius: 8,
            boxSizing: "border-box", marginBottom: 12, outline: "none"
          }}
        />

        {error && (
          <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%", padding: "11px", background: "#FF6B2B",
            color: "#fff", border: "none", borderRadius: 8,
            fontSize: 15, fontWeight: 600, cursor: "pointer"
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  )
}

// ── Knowledge Form (Add / Edit) ───────────────────────────────────────────────
function KnowledgeForm({ token, editItem, onSaved, onCancel }) {
  const [form, setForm]       = useState(editItem || EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")

  function toggleIntent(intent) {
    setForm(f => ({
      ...f,
      intent_categories: f.intent_categories.includes(intent)
        ? f.intent_categories.filter(i => i !== intent)
        : [...f.intent_categories, intent]
    }))
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim() || !form.source_name.trim()) {
      setError("Title, Content, and Source Name are required.")
      return
    }
    setLoading(true)
    setError("")
    try {
      if (editItem) {
        await api(token).put(`/admin/knowledge/${editItem.id}`, form)
      } else {
        await api(token).post("/admin/knowledge", form)
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || "Save failed.")
    } finally {
      setLoading(false)
    }
  }

  const field = (label, key, type = "text", opts = {}) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontWeight: 600, marginBottom: 5, fontSize: 13, color: "#444" }}>
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          rows={opts.rows || 5}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 14,
            border: "1.5px solid #ddd", borderRadius: 8,
            boxSizing: "border-box", resize: "vertical", outline: "none"
          }}
        />
      ) : type === "select" ? (
        <select
          value={form[key]}
          onChange={e => setForm(f => ({
            ...f,
            [key]: opts.isInt ? parseInt(e.target.value) : e.target.value
          }))}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 14,
            border: "1.5px solid #ddd", borderRadius: 8,
            boxSizing: "border-box", outline: "none", background: "#fff"
          }}
        >
          {opts.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 14,
            border: "1.5px solid #ddd", borderRadius: 8,
            boxSizing: "border-box", outline: "none"
          }}
        />
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24, gap: 12 }}>
        <button onClick={onCancel} style={{
          background: "none", border: "1.5px solid #ddd", borderRadius: 8,
          padding: "7px 14px", cursor: "pointer", fontSize: 14, color: "#1A1A1A"
        }}>← Back</button>
        <h2 style={{ margin: 0, color: "#1A1A1A" }}>{editItem ? "Edit Knowledge Item" : "Add Knowledge Item"}</h2>
      </div>

      {field("Title *", "title")}
      {field("Content *", "content", "textarea", { rows: 7 })}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {field("Source Type", "source_type", "select", {
          options: [
            { value: "website", label: "Website Content" },
            { value: "canonical_doc", label: "Official Document" }
          ]
        })}
        {field("Source Name *", "source_name")}
        {field("Topic", "topic")}
        {field("Priority", "priority", "select", {
          isInt: true,
          options: [
            { value: 1, label: "1 — Canonical (Highest)" },
            { value: 2, label: "2 — Website" }
          ]
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 13, color: "#444" }}>
          Intent Categories
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INTENTS.map(intent => (
            <button
              key={intent}
              onClick={() => toggleIntent(intent)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 13,
                cursor: "pointer", fontWeight: 500,
                background: form.intent_categories.includes(intent) ? "#FF6B2B" : "#f0f0f0",
                color: form.intent_categories.includes(intent) ? "#fff" : "#555",
                border: "none"
              }}
            >
              {intent}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ fontWeight: 600, fontSize: 13, color: "#444" }}>Approved</label>
        <div
          onClick={() => setForm(f => ({ ...f, approved: !f.approved }))}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: "pointer",
            background: form.approved ? "#27ae60" : "#ccc",
            position: "relative", transition: "background 0.2s"
          }}
        >
          <div style={{
            width: 18, height: 18, background: "#fff", borderRadius: "50%",
            position: "absolute", top: 3,
            left: form.approved ? 23 : 3,
            transition: "left 0.2s"
          }} />
        </div>
        <span style={{ fontSize: 13, color: "#666" }}>
          {form.approved ? "Active — visible to the bot" : "Inactive — hidden from the bot"}
        </span>
      </div>

      {error && (
        <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          padding: "11px 28px", background: "#FF6B2B", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 15,
          fontWeight: 600, cursor: "pointer"
        }}
      >
        {loading ? "Saving & regenerating embedding..." : (editItem ? "Save Changes" : "Add to Knowledge Base")}
      </button>
    </div>
  )
}

// ── Preview Tool ──────────────────────────────────────────────────────────────
function PreviewTool({ token }) {
  const [question, setQuestion] = useState("")
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")

  async function handlePreview() {
    if (!question.trim()) return
    setLoading(true)
    setResult(null)
    setError("")
    try {
      const res = await api(token).post("/admin/preview", { question })
      setResult(res.data)
    } catch {
      setError("Preview failed. Is the bot backend running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 6, color: "#1A1A1A" }}>Preview Answer</h2>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 14 }}>
        Test how the bot would respond to any question using the current knowledge base.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Type a test question..."
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handlePreview()}
          style={{
            flex: 1, padding: "11px 14px", fontSize: 15,
            border: "1.5px solid #ddd", borderRadius: 8, outline: "none"
          }}
        />
        <button
          onClick={handlePreview}
          disabled={loading}
          style={{
            padding: "11px 22px", background: "#FF6B2B", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 15,
            fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
          }}
        >
          {loading ? "Running..." : "Test →"}
        </button>
      </div>

      {error && <p style={{ color: "#c0392b" }}>{error}</p>}

      {result && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase" }}>
              Detected Intent
            </span>
            <span style={{
              marginLeft: 10, background: "#FF6B2B22", color: "#FF6B2B",
              padding: "3px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600
            }}>
              {result.intent}
            </span>
          </div>

          <div style={{
            background: "#f9f9f9", border: "1.5px solid #eee",
            borderRadius: 10, padding: 20, marginBottom: 16
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", margin: "0 0 10px" }}>
              Bot Answer
            </p>
            <p style={{ margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#1A1A1A" }}>{result.answer}</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", margin: "0 0 10px" }}>
              Sources Used ({result.sources_used.length})
            </p>
            {result.sources_used.map((s, i) => (
              <div key={i} style={{
                background: "#fff", border: "1.5px solid #eee",
                borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 13
              }}>
                <strong style={{ color: "#1A1A1A" }}>{s.title}</strong>
                <span style={{
                  marginLeft: 10, fontSize: 11, color: "#888",
                  background: "#f0f0f0", padding: "2px 8px", borderRadius: 10
                }}>
                  {s.source_type}
                </span>
              </div>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", margin: "0 0 10px" }}>
              Suggested Buttons
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {result.buttons.map((b, i) => (
                <span key={i} style={{
                  background: "#1A1A1A", color: "#fff",
                  padding: "6px 14px", borderRadius: 20, fontSize: 13
                }}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Leads Panel ───────────────────────────────────────────────────────────────
function LeadsPanel({ token }) {
  const [leads, setLeads]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState("")

  async function fetchLeads() {
    setLoading(true)
    try {
      const res = await api(token).get("/admin/leads")
      setLeads(res.data.leads)
    } catch {
      console.error("Failed to load leads")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLeads() }, [])

  async function toggleContacted(id) {
    await api(token).put(`/admin/leads/${id}/contacted`)
    fetchLeads()
  }

  async function deleteLead(id) {
    if (!window.confirm("Delete this lead?")) return
    await api(token).delete(`/admin/leads/${id}`)
    fetchLeads()
  }

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.email.toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || "").includes(search)
  )

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", color: "#1A1A1A" }}>Leads</h2>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            {leads.length} total · {leads.filter(l => !l.contacted).length} uncontacted
          </p>
        </div>
      </div>

      <input
        placeholder="Search by name, email, or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "11px 14px", fontSize: 14,
          border: "1.5px solid #ddd", borderRadius: 8,
          boxSizing: "border-box", marginBottom: 16,
          outline: "none", background: "#fff"
        }}
      />

      {loading ? <p style={{ color: "#888" }}>Loading...</p> : (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "2px solid #eee" }}>
                {["Name", "Email", "Phone", "Message", "Received", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#555" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, i) => (
                <tr key={lead.id} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1A1A1A" }}>{lead.name}</td>
                  <td style={{ padding: "12px 16px", color: "#444" }}>{lead.email}</td>
                  <td style={{ padding: "12px 16px", color: "#666" }}>{lead.phone || "—"}</td>
                  <td style={{ padding: "12px 16px", color: "#666", maxWidth: 180 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                      {lead.context_message || "—"}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#888", fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 10,
                      background: lead.contacted ? "#e8f8f0" : "#fff3e0",
                      color: lead.contacted ? "#27ae60" : "#e67e22",
                      cursor: "pointer"
                    }} onClick={() => toggleContacted(lead.id)}>
                      {lead.contacted ? "✓ Contacted" : "Pending"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={() => deleteLead(lead.id)} style={{
                      padding: "5px 12px", fontSize: 12, border: "1.5px solid #fcc",
                      borderRadius: 6, cursor: "pointer", background: "#fff",
                      color: "#c0392b", fontWeight: 500
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#888" }}>No leads yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Dashboard Panel ───────────────────────────────────────────────────────────
function DashboardPanel({ token, onAddKnowledge }) {
  const [overview,  setOverview]  = useState(null)
  const [intents,   setIntents]   = useState([])
  const [buttons,   setButtons]   = useState([])
  const [daily,     setDaily]     = useState([])
  const [fallbacks, setFallbacks] = useState([])
  const [topics,         setTopics]         = useState([])
  const [knowledgeCount, setKnowledgeCount] = useState({ approved: 0, total: 0 })
  const [loading,        setLoading]        = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [ov, int_, btn, day, fb, top, kc] = await Promise.all([
        api(token).get("/admin/analytics/overview"),
        api(token).get("/admin/analytics/intents"),
        api(token).get("/admin/analytics/buttons"),
        api(token).get("/admin/analytics/daily"),
        api(token).get("/admin/analytics/fallbacks"),
        api(token).get("/admin/analytics/topics"),
        api(token).get("/admin/analytics/knowledge_count"),
      ])
      setOverview(ov.data)
      setIntents(int_.data.intents)
      setButtons(btn.data.buttons)
      setDaily(day.data.daily)
      setFallbacks(fb.data.fallbacks)
      setTopics(top.data.topics)
      setKnowledgeCount(kc.data)
    } catch (e) {
      console.error("Dashboard load failed", e)
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    api(token).get("/admin/analytics/export", { responseType: "blob" }).then(res => {
      const url  = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement("a")
      link.href  = url
      link.setAttribute("download", "conversation_logs.csv")
      document.body.appendChild(link)
      link.click()
      link.remove()
    })
  }

  // ── Sub-components ────────────────────────────────────────────────────────

  function StatCard({ label, value, sub, color = "#1A1A1A", accent = "#FF6B2B" }) {
    return (
      <div style={{
        background: "#fff", borderRadius: 12, padding: "20px 22px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        borderLeft: `4px solid ${accent}`, flex: 1, minWidth: 140
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: "#aaa", marginTop: 5 }}>{sub}</div>}
      </div>
    )
  }

  function HBarChart({ data, valueKey = "count", labelKey, maxLabel = 12, color = "#FF6B2B" }) {
    if (!data || data.length === 0) return <p style={{ color: "#aaa", fontSize: 13 }}>No data yet</p>
    const max = Math.max(...data.map(d => d[valueKey]))
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d, i) => {
          const label = d[labelKey] || "—"
          const pct   = max > 0 ? (d[valueKey] / max) * 100 : 0
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 140, fontSize: 12, color: "#444", fontWeight: 500, flexShrink: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }} title={label}>
                {label.length > maxLabel ? label.slice(0, maxLabel) + "…" : label}
              </div>
              <div style={{ flex: 1, background: "#f0f0f0", borderRadius: 6, height: 22, position: "relative" }}>
                <div style={{
                  width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                  height: "100%", borderRadius: 6, transition: "width 0.5s ease",
                  minWidth: pct > 0 ? 6 : 0
                }} />
              </div>
              <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: "#555", textAlign: "right", flexShrink: 0 }}>
                {d[valueKey]}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function DailyChart({ data }) {
    if (!data || data.length === 0) return <p style={{ color: "#aaa", fontSize: 13 }}>No data in last 14 days</p>
    const maxMsg = Math.max(...data.map(d => d.messages), 1)
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
        {data.map((d, i) => {
          const h   = Math.max((d.messages / maxMsg) * 100, 4)
          const day = d.date.slice(5)
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: "#aaa" }}>{d.messages}</div>
              <div
                title={`${d.date}: ${d.messages} msgs, ${d.sessions} sessions`}
                style={{
                  width: "100%", height: `${h}%`,
                  background: "linear-gradient(180deg, #FF6B2B, #E84E0F)",
                  borderRadius: "4px 4px 0 0", cursor: "default", transition: "opacity 0.2s",
                }}
                onMouseEnter={e => e.target.style.opacity = "0.75"}
                onMouseLeave={e => e.target.style.opacity = "1"}
              />
              <div style={{
                fontSize: 9, color: "#bbb", transform: "rotate(-35deg)",
                transformOrigin: "top right", whiteSpace: "nowrap", marginTop: 2
              }}>{day}</div>
            </div>
          )
        })}
      </div>
    )
  }

  function SectionCard({ title, children, action }) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{title}</h3>
          {action}
        </div>
        {children}
      </div>
    )
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#aaa" }}>
      Loading dashboard…
    </div>
  )

  const fallbackAlert = overview?.fallback_rate >= 20

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: "0 0 3px", color: "#1A1A1A" }}>Dashboard</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#888" }}>Real-time chatbot performance overview</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadAll} style={{
            padding: "8px 16px", background: "#f5f5f5", border: "1.5px solid #ddd",
            borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#1A1A1A"
          }}>↻ Refresh</button>
          <button onClick={handleExport} style={{
            padding: "8px 16px", background: "#1A1A1A", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600
          }}>↓ Export CSV</button>
        </div>
      </div>

      {/* Fallback alert banner */}
      {fallbackAlert && (
        <div style={{
          background: "#fff3cd", border: "1.5px solid #ffc107", borderRadius: 10,
          padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <strong style={{ color: "#856404" }}>High fallback rate — {overview.fallback_rate}%</strong>
            <span style={{ color: "#856404", fontSize: 13, marginLeft: 8 }}>
              Review the unanswered questions below and add them to the knowledge base.
            </span>
          </div>
        </div>
      )}

      {/* Top stat cards */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Total Sessions"  value={overview?.total_sessions ?? 0}  sub="All time unique users" />
        <StatCard label="Total Messages"  value={overview?.total_messages ?? 0}  sub="All time messages sent" accent="#2980b9" />
        <StatCard
          label="Fallback Rate"
          value={`${overview?.fallback_rate ?? 0}%`}
          sub={`${overview?.total_fallbacks ?? 0} unanswered`}
          accent={fallbackAlert ? "#e74c3c" : "#27ae60"}
          color={fallbackAlert ? "#e74c3c" : "#1A1A1A"}
        />
        <StatCard label="Leads Captured" value={overview?.total_leads ?? 0} sub={`${overview?.uncontacted_leads ?? 0} pending contact`} accent="#8e44ad" />
      </div>

      {/* Secondary stat cards */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Today's Sessions" value={overview?.today_sessions ?? 0} sub="Unique users today"  accent="#16a085" />
        <StatCard label="Today's Messages" value={overview?.today_messages ?? 0} sub="Messages sent today" accent="#d35400" />
        <StatCard
          label="Knowledge Items"
          value={knowledgeCount.approved}
          sub={`${knowledgeCount.total} total · ${knowledgeCount.total - knowledgeCount.approved} inactive`}
          accent="#7f8c8d"
        />
        <StatCard label="Languages"        value="EN + AR" sub="Bilingual support active"                 accent="#27ae60" />
      </div>

      {/* 2×2 Charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        <SectionCard title="🎯 Intent Distribution">
          <HBarChart data={intents} labelKey="intent" color="#FF6B2B" />
        </SectionCard>

        <SectionCard title="🖱️ Top Clicked Buttons">
          <HBarChart data={buttons} labelKey="button" maxLabel={18} color="#2980b9" />
        </SectionCard>

        <SectionCard title="📚 Top Retrieved Topics">
          <HBarChart data={topics} labelKey="topic" valueKey="retrieval_count" maxLabel={22} color="#8e44ad" />
        </SectionCard>

        <SectionCard title="📅 Daily Messages — Last 14 Days">
          <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
            {daily.reduce((a, d) => a + d.sessions, 0)} sessions · {daily.reduce((a, d) => a + d.messages, 0)} messages total
          </div>
          <DailyChart data={daily} />
        </SectionCard>

      </div>

      {/* Fallback questions */}
      <SectionCard
        title={`❓ Unanswered Questions (${fallbacks.length})`}
        action={
          <span style={{ fontSize: 12, color: "#888" }}>
            These are knowledge gaps — add them to fix the bot
          </span>
        }
      >
        {fallbacks.length === 0 ? (
          <p style={{ color: "#27ae60", fontSize: 13, margin: 0 }}>✓ No recent fallbacks — the bot is answering everything</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                {["User Question", "Time", "Session", "Action"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#666", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fallbacks.map((fb, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f8f8f8" }}>
                  <td style={{ padding: "10px 12px", color: "#1A1A1A", maxWidth: 340 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fb.message}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#aaa", whiteSpace: "nowrap", fontSize: 12 }}>
                    {new Date(fb.created_at).toLocaleDateString()} {new Date(fb.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#ccc", fontSize: 11 }}>
                    {fb.session_id?.slice(0, 8)}…
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => onAddKnowledge(fb.message)}
                      style={{
                        padding: "4px 12px", fontSize: 11, fontWeight: 600,
                        background: "rgba(255,107,43,0.1)", color: "#FF6B2B",
                        border: "1.5px solid rgba(255,107,43,0.3)", borderRadius: 6, cursor: "pointer"
                      }}
                    >
                      + Add to KB
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

    </div>
  )
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [token,    setToken]    = useState(null)
  const [view,     setView]     = useState("dashboard")
  const [items,    setItems]    = useState([])
  const [editItem, setEditItem] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState("")
  const [toast,    setToast]    = useState({ message: "", type: "success" })
  const [deleteId, setDeleteId] = useState(null)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast({ message: "", type: "success" }), 3000)
  }

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await api(token).get("/admin/knowledge")
      setItems(res.data.items)
    } catch {
      showToast("Failed to load knowledge items", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchItems()
  }, [token])

  async function handleDelete(id) {
    try {
      await api(token).delete(`/admin/knowledge/${id}`)
      showToast("Item deleted successfully")
      setDeleteId(null)
      fetchItems()
    } catch {
      showToast("Delete failed", "error")
    }
  }

  async function handleEditLoad(id) {
    try {
      const res = await api(token).get(`/admin/knowledge/${id}`)
      setEditItem(res.data)
      setView("edit")
    } catch {
      showToast("Failed to load item", "error")
    }
  }

  function handleSaved() {
    showToast(view === "edit" ? "Item updated successfully" : "Item added successfully")
    setView("list")
    setEditItem(null)
    fetchItems()
  }

  const filtered = items.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.topic || "").toLowerCase().includes(search.toLowerCase()) ||
    item.source_type.toLowerCase().includes(search.toLowerCase())
  )

  if (!token) return <LoginScreen onLogin={setToken} />

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "#1A1A1A", color: "#fff",
        padding: "0 32px", display: "flex",
        alignItems: "center", justifyContent: "space-between",
        height: 60
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 20 }}>🏠</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Divido Admin</span>

          <div style={{ display: "flex", gap: 4, marginLeft: 24 }}>
            {[
              { key: "dashboard", label: "📊 Dashboard"    },
              { key: "list",      label: "Knowledge Base"  },
              { key: "preview",   label: "Preview Answer"  },
              { key: "leads",     label: "Leads"           }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setView(tab.key); setEditItem(null) }}
                style={{
                  padding: "6px 16px", borderRadius: 6, border: "none",
                  cursor: "pointer", fontSize: 14, fontWeight: 500,
                  background: view === tab.key ? "#FF6B2B" : "transparent",
                  color: "#fff"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => { api(token).post("/admin/logout"); setToken(null) }}
          style={{
            background: "none", border: "1.5px solid #444",
            color: "#ccc", padding: "6px 14px", borderRadius: 6,
            cursor: "pointer", fontSize: 13
          }}
        >
          Logout
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "32px" }}>

        {/* Dashboard */}
        {view === "dashboard" && (
          <DashboardPanel
            token={token}
            onAddKnowledge={(prefillMessage) => {
              setEditItem({ ...EMPTY_FORM, title: prefillMessage, source_type: "canonical_doc", priority: 1 })
              setView("add")
            }}
          />
        )}

        {/* Knowledge List */}
        {view === "list" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", color: "#1A1A1A" }}>Knowledge Base</h2>
                <p style={{ margin: 0, color: "#666", fontSize: 14 }}>{items.length} items total</p>
              </div>
              <button
                onClick={() => { setEditItem(null); setView("add") }}
                style={{
                  padding: "10px 20px", background: "#FF6B2B", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 14,
                  fontWeight: 600, cursor: "pointer"
                }}
              >
                + Add Item
              </button>
            </div>

            <input
              placeholder="Search by title, topic, or source type..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "11px 14px", fontSize: 14,
                border: "1.5px solid #ddd", borderRadius: 8,
                boxSizing: "border-box", marginBottom: 16, outline: "none",
                background: "#fff"
              }}
            />

            {loading ? (
              <p style={{ color: "#888" }}>Loading...</p>
            ) : (
              <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#fafafa", borderBottom: "2px solid #eee" }}>
                      {["Title", "Source", "Topic", "Priority", "Status", "Actions"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#555" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, i) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 500, maxWidth: 240 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1A1A1A" }}>
                            {item.title}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 10,
                            background: item.source_type === "canonical_doc" ? "#e8f4fd" : "#f0f0f0",
                            color: item.source_type === "canonical_doc" ? "#2980b9" : "#666"
                          }}>
                            {item.source_type === "canonical_doc" ? "Official Doc" : "Website"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#666" }}>{item.topic || "—"}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
                            background: item.priority === 1 ? "#fff3e0" : "#f0f0f0",
                            color: item.priority === 1 ? "#e67e22" : "#888"
                          }}>
                            P{item.priority}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 10,
                            background: item.approved ? "#e8f8f0" : "#fdecea",
                            color: item.approved ? "#27ae60" : "#c0392b"
                          }}>
                            {item.approved ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => handleEditLoad(item.id)}
                              style={{
                                padding: "5px 12px", fontSize: 12, border: "1.5px solid #ddd",
                                borderRadius: 6, cursor: "pointer", background: "#fff", fontWeight: 500, color: "#1A1A1A"
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteId(item.id)}
                              style={{
                                padding: "5px 12px", fontSize: 12, border: "1.5px solid #fcc",
                                borderRadius: 6, cursor: "pointer", background: "#fff",
                                color: "#c0392b", fontWeight: 500
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#888" }}>
                          No items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Add / Edit Form */}
        {(view === "add" || view === "edit") && (
          <KnowledgeForm
            token={token}
            editItem={editItem}
            onSaved={handleSaved}
            onCancel={() => { setView("list"); setEditItem(null) }}
          />
        )}

        {/* Preview Tool */}
        {view === "preview" && <PreviewTool token={token} />}

        {/* Leads */}
        {view === "leads" && <LeadsPanel token={token} />}

      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 32,
            width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }}>
            <h3 style={{ margin: "0 0 10px", color: "#1A1A1A" }}>Delete this item?</h3>
            <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
              This will permanently remove it from the knowledge base and the bot will stop using it immediately.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleDelete(deleteId)}
                style={{
                  flex: 1, padding: "10px", background: "#c0392b",
                  color: "#fff", border: "none", borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: "pointer"
                }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1, padding: "10px", background: "#f0f0f0",
                  border: "none", borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#1A1A1A"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} />
    </div>
  )
}