import React, { useState } from "react";
import "./App.css";
import cv from "./cv6.png";
import jsPDF from "jspdf";

function App() {

  const [resume, setResume]     = useState("");
  const [file, setFile]         = useState(null);
  const [result, setResult]     = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading]   = useState(false);

  // 🆕 NEW STATE (added on top of yours)
  const [jobRole, setJobRole]               = useState("Software Engineer");
  const [activeTab, setActiveTab]           = useState("overview");
  const [rewriting, setRewriting]           = useState(false);
  const [aiRewritten, setAiRewritten]       = useState("");
  const [copyDone, setCopyDone]             = useState(false);

  // ─── YOUR ORIGINAL analyzeResume — only FormData line added ───────
  const analyzeResume = async () => {
    try {
      setLoading(true);
      setAiRewritten("");
      setActiveTab("overview");

      let formData = new FormData();

      if (file) {
        formData.append("file", file);
      } else {
        formData.append("resume", resume);
      }

      // 🆕 send job role to backend
      formData.append("job_role", jobRole);

      const response = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        alert("❌ " + data.error);
        setLoading(false);
        return;
      }

      // ✅ YOUR ORIGINAL frontend computed fields — unchanged
      data.level =
        data.score >= 80 ? "🔥 Excellent Resume"
        : data.score >= 60 ? "👍 Good Resume"
        : "⚠️ Needs Improvement";

      // 🆕 ats and job_match now come from backend properly;
      //    fall back to old formula if missing (backward-safe)
      data.ats       = data.ats_score  ?? Math.min(data.score + 10, 100);
      data.job_match_pct = data.job_match?.match_percent ?? Math.min(data.score + (data.skills?.length || 0) * 5, 100);

      setResult(data);

    } catch (error) {
      alert("Backend not running ❌");
    }

    setLoading(false);
  };

  // ─── YOUR ORIGINAL downloadPDF — extended with new fields ─────────
  const downloadPDF = () => {
    const doc = new jsPDF();
    let y = 10;
    const line = (txt, gap = 10) => { doc.text(String(txt), 10, y); y += gap; };

    doc.setFontSize(16);
    line("Resume Analysis Report", 12);
    doc.setFontSize(12);

    line(`Score: ${result.score}/100`);
    line(`ATS Score: ${result.ats}/100`);
    line(`Job Match: ${result.job_match_pct}%  (${result.job_role_matched || ""})`);
    line(`Level: ${result.level}`);
    line(`Skills: ${result.skills?.join(", ")}`);
    line(`Message: ${result.message}`, 12);
    line(`AI Suggestion: ${result.ai_suggestion}`, 14);

    // 🆕 Sections
    if (result.sections) {
      line("Sections Detected:", 8);
      Object.entries(result.sections).forEach(([k, v]) => {
        line(`  ${v ? "✓" : "✗"} ${k}`, 7);
      });
      y += 4;
    }

    // 🆕 Missing keywords
    if (result.keyword_gap?.missing_keywords?.length) {
      line("Missing Keywords:", 8);
      line("  " + result.keyword_gap.missing_keywords.join(", "), 12);
    }

    // Suggestions
    line("Suggestions:", 8);
    (result.suggestions || []).forEach(s => line("  - " + s, 7));
    y += 4;

    // Analysis
    line("Analysis:", 8);
    (result.analysis || []).forEach(a => line("  • " + a, 7));
    y += 6;

    // Improved resume
    doc.setFontSize(11);
    line("AI Improved Resume:", 8);
    const splitText = doc.splitTextToSize(result.improved_resume || "", 185);
    doc.text(splitText, 10, y);

    doc.save("resume-report.pdf");
  };

  // 🆕 Claude AI Rewrite call
  const doAiRewrite = async () => {
    const resumeText = result?.improved_resume || resume;
    if (!resumeText) return;
    setRewriting(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are an elite resume writer. Rewrite this resume for a ${jobRole} role.
RULES:
- Use strong action verbs: achieved, built, delivered, engineered, optimized
- Add quantified results wherever possible (use realistic estimates)
- Write a powerful 2-line professional summary at the top
- Keep all factual info (companies, dates, education) exactly as given
- Remove all weak phrases like 'responsible for', 'helped with'
- Make every bullet concise and impactful
- Output clean plain text only, no markdown

RESUME:
${resumeText.slice(0, 2500)}

Rewrite now:`
          }]
        }),
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("\n") || "";
      setAiRewritten(text);
      setActiveTab("rewriter");
    } catch (e) {
      alert("AI rewrite failed. Check API key.");
    }
    setRewriting(false);
  };

  // 🆕 small helpers
  const barColor = (v) => v >= 70 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#ef4444";

  const Chip = ({ label, color = "#22c55e", bg }) => (
    <span style={{
      background: bg || color + "22",
      color,
      padding: "4px 10px",
      borderRadius: 10,
      fontSize: 12,
      display: "inline-block",
      margin: "3px 3px 3px 0",
      fontWeight: 600,
    }}>{label}</span>
  );

  const MiniBar = ({ value, color }) => (
    <div style={{ background: "#eee", height: 8, borderRadius: 8, margin: "4px 0 10px" }}>
      <div style={{ width: value + "%", height: "100%", background: color || barColor(value), borderRadius: 8, transition: "width 0.8s ease" }} />
    </div>
  );

  const TABS = ["overview", "ats", "job match", "sections", "keywords", "rewriter"];

  return (
    <div className={darkMode ? "dark" : ""}>

      {/* ─── NAVBAR  (your original — untouched) ─────────────────────── */}
      <div className="navbar">
        <h2 className="logo">
          <span className="resume">Resume</span>
          <span className="builder">Builder</span>
          <span className="rocket"> 🚀</span>
        </h2>
        <button className="toggle-btn" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>

      {/* ─── HERO  (your original — untouched) ───────────────────────── */}
      <div className="hero">
        <div>
          <h1>We Analyze your Resume in Seconds!!!</h1>
          <p>AI powered Resume Analyzer for Hackathons</p>
          <button className="main-btn">Get your CV Report</button>
        </div>
        <img src={cv} alt="cv" />
      </div>

      {/* ─── CARD  (your original structure — 1 input added) ─────────── */}
      <div className="card">

        <h3>Upload or Paste Resume 📄</h3>

        <input type="file" onChange={(e) => setFile(e.target.files[0])} />

        <textarea
          placeholder="Paste your resume here..."
          value={resume}
          onChange={(e) => setResume(e.target.value)}
        />

        {/* 🆕 Job role input — sits right after textarea, before button */}
        <input
          type="text"
          placeholder="🎯 Target Job Role (e.g. Data Scientist, Frontend Developer)"
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            marginTop: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
            fontSize: 14,
            background: darkMode ? "#1e293b" : "white",
            color: darkMode ? "white" : "#111",
            boxSizing: "border-box",
          }}
        />

        {/* ── YOUR ORIGINAL button ── */}
        <button className="analyze-btn" onClick={analyzeResume}>
          {loading ? "Analyzing..." : "Analyze 🚀"}
        </button>

        {/* 🆕 AI Rewrite button — appears only after analysis */}
        {result && (
          <button
            className="analyze-btn"
            onClick={doAiRewrite}
            style={{ marginLeft: 10, background: "linear-gradient(135deg,#818cf8,#6366f1)" }}
          >
            {rewriting ? "✨ Rewriting..." : "✨ AI Rewrite"}
          </button>
        )}

        {/* ─── RESULT SECTION ──────────────────────────────────────────── */}
        {result && (
          <div>

            {/* ── YOUR ORIGINAL SCORE BAR — untouched ── */}
            <h3>Score: {result.score}</h3>
            <div className="bar">
              <div style={{ width: result.score + "%" }}></div>
            </div>

            {/* ── YOUR ORIGINAL ATS + JOB MATCH bars — untouched ── */}
            <p><b>ATS Score:</b> {result.ats}%</p>
            <div className="bar">
              <div style={{ width: result.ats + "%", background: "#3b82f6" }}></div>
            </div>

            <p><b>Job Match:</b> {result.job_match_pct}%</p>
            <div className="bar">
              <div style={{ width: result.job_match_pct + "%", background: "#f59e0b" }}></div>
            </div>

            {/* ── YOUR ORIGINAL LEVEL — untouched ── */}
            <p><b>Level:</b> {result.level}</p>

            {/* ── YOUR ORIGINAL SKILLS TAGS — untouched ── */}
            <p><b>Skills:</b></p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {(result.skills || []).map((skill, i) => (
                <span key={i} style={{
                  background: "#22c55e",
                  color: "white",
                  padding: "5px 10px",
                  borderRadius: "10px",
                  fontSize: "12px"
                }}>
                  {skill}
                </span>
              ))}
            </div>

            {/* ── YOUR ORIGINAL MESSAGE + SUGGESTIONS + AI — untouched ── */}
            <p><b>Message:</b> {result.message}</p>
            <p><b>Suggestions:</b> {(result.suggestions || []).join(", ")}</p>
            <p><b>AI:</b> {result.ai_suggestion}</p>

            {/* ── YOUR ORIGINAL ANALYSIS LIST — untouched ── */}
            {result.analysis && (
              <>
                <p><b>Analysis:</b></p>
                <ul>
                  {result.analysis.map((item, i) => {
                    const isBad = item.toLowerCase().includes("no") ||
                                  item.toLowerCase().includes("lack");
                    return (
                      <li key={i} style={{ color: isBad ? "#ef4444" : "#22c55e" }}>
                        {item}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* ── YOUR ORIGINAL IMPROVED RESUME TEXTAREA — untouched ── */}
            <p><b>AI Improved Resume:</b></p>
            <textarea
              value={result.improved_resume}
              readOnly
              style={{ width: "100%", height: "120px", marginTop: "10px", borderRadius: "10px", padding: "10px" }}
            />

            {/* ── YOUR ORIGINAL PDF BUTTON — untouched ── */}
            <button className="analyze-btn" onClick={downloadPDF}>
              Download Report 📄
            </button>

            {/* ════════════════════════════════════════════════════════════
                🆕 NEW ENHANCED PANELS — appear below your existing result
                ════════════════════════════════════════════════════════════ */}

            <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid rgba(0,0,0,0.1)" }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 10, letterSpacing: 1 }}>
              ✨ ENHANCED ANALYSIS
            </p>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: `1px solid ${activeTab === tab ? "#22c55e" : "#ddd"}`,
                    background: activeTab === tab ? "#22c55e" : "transparent",
                    color: activeTab === tab ? "white" : (darkMode ? "white" : "#374151"),
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    fontFamily: "Poppins, sans-serif",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ── Tab: overview ── */}
            {activeTab === "overview" && (
              <div>
                <p style={{ fontWeight: 700, marginBottom: 10 }}>💪 Strength Breakdown</p>
                {Object.entries(result.strength_breakdown || {}).map(([label, value]) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>{label}</span>
                      <b style={{ color: barColor(value) }}>{Math.round(value)}%</b>
                    </div>
                    <MiniBar value={value} />
                  </div>
                ))}

                <p style={{ fontWeight: 700, margin: "16px 0 8px" }}>
                  📝 Word Count: <span style={{ color: result.word_count > 300 ? "#22c55e" : "#f59e0b" }}>
                    {result.word_count} words
                  </span>
                  <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
                    (ideal: 400–700)
                  </span>
                </p>
              </div>
            )}

            {/* ── Tab: ats ── */}
            {activeTab === "ats" && (
              <div>
                <p style={{ fontWeight: 700, marginBottom: 10 }}>
                  🤖 ATS Score Breakdown — <span style={{ color: barColor(result.ats) }}>{result.ats}/100</span>
                </p>
                {Object.entries(result.ats_breakdown || {}).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>{k}</span>
                      <b style={{ color: barColor((v.score / v.max) * 100) }}>{v.score}/{v.max}</b>
                    </div>
                    <MiniBar value={(v.score / v.max) * 100} />
                  </div>
                ))}
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
                  ATS systems scan for keywords, structure, and formatting. Score above 70 is strong.
                </p>
              </div>
            )}

            {/* ── Tab: job match ── */}
            {activeTab === "job match" && (
              <div>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>
                  🎯 Job Match — <span style={{ color: barColor(result.job_match_pct) }}>
                    {result.job_match_pct}%
                  </span>
                </p>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                  Matched role: <b style={{ color: darkMode ? "white" : "#111" }}>{result.job_role_matched}</b>
                </p>

                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>✅ Matched Skills</p>
                <div style={{ marginBottom: 14 }}>
                  {(result.job_match?.matched_skills || []).length === 0
                    ? <span style={{ fontSize: 13, color: "#9ca3af" }}>None detected yet</span>
                    : (result.job_match?.matched_skills || []).map(s => <Chip key={s} label={s} color="#22c55e" />)
                  }
                </div>

                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>❌ Missing Required</p>
                <div style={{ marginBottom: 14 }}>
                  {(result.job_match?.missing_required || []).length === 0
                    ? <span style={{ fontSize: 13, color: "#22c55e" }}>All required skills present 🎉</span>
                    : (result.job_match?.missing_required || []).map(s => <Chip key={s} label={s} color="#ef4444" />)
                  }
                </div>

                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>💡 Preferred (to add)</p>
                <div>
                  {(result.job_match?.missing_preferred || []).map(s => <Chip key={s} label={s} color="#f59e0b" />)}
                </div>
              </div>
            )}

            {/* ── Tab: sections ── */}
            {activeTab === "sections" && (
              <div>
                <p style={{ fontWeight: 700, marginBottom: 12 }}>🧩 Resume Section Detection</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(result.sections || {}).map(([name, found]) => (
                    <div key={name} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${found ? "#22c55e44" : "#ef444444"}`,
                      background: found ? "#22c55e11" : "#ef444411",
                    }}>
                      <span style={{ fontSize: 14 }}>{found ? "✅" : "❌"}</span>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: found ? "#16a34a" : "#dc2626",
                        textTransform: "capitalize",
                      }}>{name}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
                  Tip: Having Summary, Experience, Education, Skills, and Projects = highest ATS compatibility.
                </p>
              </div>
            )}

            {/* ── Tab: keywords ── */}
            {activeTab === "keywords" && (
              <div>
                <p style={{ fontWeight: 700, marginBottom: 10 }}>🔑 Keyword Gap Analysis</p>

                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>🚨 Missing Keywords</p>
                <div style={{ marginBottom: 14 }}>
                  {(result.keyword_gap?.missing_keywords || []).length === 0
                    ? <span style={{ fontSize: 13, color: "#22c55e" }}>Great! No critical keywords missing.</span>
                    : (result.keyword_gap?.missing_keywords || []).map(k => <Chip key={k} label={k} color="#ef4444" />)
                  }
                </div>

                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>⚠️ Weak Phrases Found</p>
                <div style={{ marginBottom: 14 }}>
                  {(result.keyword_gap?.weak_phrases || []).length === 0
                    ? <span style={{ fontSize: 13, color: "#22c55e" }}>No weak phrases — great writing! ✨</span>
                    : (result.keyword_gap?.weak_phrases || []).map(p => <Chip key={p} label={p} color="#f59e0b" />)
                  }
                </div>

                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  💪 Power Verbs Used ({result.keyword_gap?.power_verbs_used?.length || 0})
                </p>
                <div>
                  {(result.keyword_gap?.power_verbs_used || []).map(v => <Chip key={v} label={v} color="#22c55e" />)}
                </div>

                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>
                  Verb density: <b>{result.keyword_gap?.verb_density}</b> power verbs per 100 words
                  {result.keyword_gap?.verb_density >= 2
                    ? " — Excellent! 🔥"
                    : result.keyword_gap?.verb_density >= 1
                    ? " — Good"
                    : " — Add more action verbs"}
                </p>
              </div>
            )}

            {/* ── Tab: rewriter ── */}
            {activeTab === "rewriter" && (
              <div>
                <p style={{ fontWeight: 700, marginBottom: 10 }}>✨ AI Rewritten Resume</p>
                {aiRewritten ? (
                  <>
                    <textarea
                      value={aiRewritten}
                      readOnly
                      style={{
                        width: "100%",
                        height: 220,
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 13,
                        fontFamily: "monospace",
                        lineHeight: 1.7,
                        background: darkMode ? "#0f172a" : "#f8fafc",
                        color: darkMode ? "#e2e8f0" : "#111",
                        border: "1px solid #ddd",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      className="analyze-btn"
                      style={{ marginTop: 10, background: "linear-gradient(135deg,#818cf8,#6366f1)" }}
                      onClick={() => {
                        navigator.clipboard.writeText(aiRewritten);
                        setCopyDone(true);
                        setTimeout(() => setCopyDone(false), 2000);
                      }}
                    >
                      {copyDone ? "✅ Copied!" : "📋 Copy to Clipboard"}
                    </button>
                  </>
                ) : (
                  <div style={{
                    padding: "24px",
                    borderRadius: 10,
                    border: "1px dashed #ddd",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: 14,
                  }}>
                    Click the <b style={{ color: "#818cf8" }}>✨ AI Rewrite</b> button above to generate
                    a professionally rewritten version of your resume.
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ─── FEATURES  (your original — untouched) ───────────────────── */}
      <div className="features">
        <p>⚡ Fast</p>
        <p>🎯 Smart AI</p>
        <p>📊 Score Based</p>
      </div>

      {/* ─── STATS  (your original — untouched) ──────────────────────── */}
      <div className="stats">
        <div><h2>10K+</h2><p>Users</p></div>
        <div><h2>95%</h2><p>Accuracy</p></div>
        <div><h2>2s</h2><p>Speed</p></div>
      </div>

      {/* ─── FOOTER  (your original — untouched) ─────────────────────── */}
      <div className="footer">
        © 2026 ResumeAI 🚀
      </div>

    </div>
  );
}

export default App;