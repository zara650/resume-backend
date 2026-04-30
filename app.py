from flask import Flask, request, jsonify
from flask_cors import CORS
from PyPDF2 import PdfReader
import re

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# 📄 PDF TEXT EXTRACT  (unchanged)
# ─────────────────────────────────────────────
def extract_text_from_pdf(file):
    text = ""
    reader = PdfReader(file)
    for page in reader.pages:
        text += page.extract_text() or ""
    return text

# ─────────────────────────────────────────────
# 🔤 SECTION DETECTION  (NEW)
# ─────────────────────────────────────────────
def detect_sections(text):
    t = text.lower()
    return {
        "summary":        bool(re.search(r'\b(summary|objective|profile|about me)\b', t)),
        "experience":     bool(re.search(r'\b(experience|work history|employment|internship)\b', t)),
        "education":      bool(re.search(r'\b(education|degree|university|college|school)\b', t)),
        "skills":         bool(re.search(r'\b(skills|technologies|competencies|tools)\b', t)),
        "projects":       bool(re.search(r'\b(project|portfolio|built|developed|created)\b', t)),
        "certifications": bool(re.search(r'\b(certification|certified|license|credential)\b', t)),
        "achievements":   bool(re.search(r'\b(award|achievement|honor|recognition|winner)\b', t)),
    }

# ─────────────────────────────────────────────
# 📊 ATS SCORE ENGINE  (NEW - replaces the old frontend hack)
# ─────────────────────────────────────────────
def compute_ats_score(text, skills, sections):
    score = 0
    breakdown = {}

    # Contact info  (max 15)
    c = 0
    if re.search(r'[\w.+-]+@[\w-]+\.[a-z]{2,}', text): c += 5
    if re.search(r'(\+?\d[\d\s\-().]{7,})', text):      c += 5
    if re.search(r'linkedin\.com', text, re.I):           c += 3
    if re.search(r'github\.com',   text, re.I):           c += 2
    score += c
    breakdown["Contact Info"] = {"score": c, "max": 15}

    # Key sections  (max 20)
    s = sum([5 if sections.get("experience") else 0,
             5 if sections.get("education")  else 0,
             5 if sections.get("skills")     else 0,
             3 if sections.get("summary")    else 0,
             2 if sections.get("projects")   else 0])
    score += s
    breakdown["Sections"] = {"score": s, "max": 20}

    # Skills  (max 20)
    sk = min(20, len(skills) * 4)
    score += sk
    breakdown["Skills"] = {"score": sk, "max": 20}

    # Word count  (max 10)
    wc_val = len(text.split())
    wl = 10 if 300 <= wc_val <= 900 else (7 if 150 <= wc_val < 300 else 3)
    score += wl
    breakdown["Length"] = {"score": wl, "max": 10}

    # Power verbs  (max 15)
    power_verbs = ["achieved","built","created","delivered","designed","developed",
                   "engineered","implemented","improved","increased","launched","led",
                   "managed","optimized","reduced","spearheaded","transformed","generated"]
    vb = min(15, sum(2 for v in power_verbs if v in text.lower()))
    score += vb
    breakdown["Action Verbs"] = {"score": vb, "max": 15}

    # Quantified results  (max 10)
    hits = len(re.findall(r'\b\d+\s*(%|percent|users|customers|projects|team|faster|improvement|million|k\b)', text, re.I))
    qt = min(10, hits * 3)
    score += qt
    breakdown["Quantified Results"] = {"score": qt, "max": 10}

    # Formatting cleanliness  (max 10)
    fmt = 10
    if re.search(r'[^\x00-\x7F]', text): fmt = max(0, fmt - 3)
    if re.search(r'[|]{2,}',       text): fmt = max(0, fmt - 3)
    score += fmt
    breakdown["Formatting"] = {"score": fmt, "max": 10}

    return min(100, score), breakdown

# ─────────────────────────────────────────────
# 🎯 JOB ROLE MATCHING  (NEW)
# ─────────────────────────────────────────────
ROLE_PROFILES = {
    "software engineer":   {"required": ["python","javascript","git","sql","rest api","problem solving"],
                            "preferred": ["docker","aws","react","ci/cd","typescript","node"]},
    "data scientist":      {"required": ["python","sql","machine learning","pandas","numpy","statistics"],
                            "preferred": ["tensorflow","pytorch","spark","r","aws","visualization"]},
    "frontend developer":  {"required": ["html","css","javascript","react","git","responsive"],
                            "preferred": ["typescript","next","tailwind","webpack","figma","vue"]},
    "backend developer":   {"required": ["python","sql","rest api","git","linux","database"],
                            "preferred": ["docker","postgresql","redis","aws","django","node"]},
    "devops engineer":     {"required": ["docker","kubernetes","linux","ci/cd","aws","git"],
                            "preferred": ["terraform","ansible","jenkins","python","bash","monitoring"]},
    "ml engineer":         {"required": ["python","machine learning","tensorflow","pytorch","git","sql"],
                            "preferred": ["mlops","aws","docker","spark","fastapi","cuda"]},
    "full stack developer":{"required": ["javascript","python","react","sql","git","html"],
                            "preferred": ["node","docker","aws","typescript","mongodb","rest api"]},
}

def compute_job_match(text, role):
    t = text.lower()
    role_lower = role.lower().strip()

    # Find closest matching profile
    best_role, best_score = "software engineer", 0
    for profile_name in ROLE_PROFILES:
        overlap = sum(1 for w in profile_name.split() if w in role_lower)
        if overlap > best_score:
            best_score = overlap
            best_role = profile_name

    p = ROLE_PROFILES[best_role]
    req_found  = [s for s in p["required"]  if s in t]
    pref_found = [s for s in p["preferred"] if s in t]

    pct = int(
        (len(req_found)  / max(1, len(p["required"]))  * 65) +
        (len(pref_found) / max(1, len(p["preferred"])) * 35)
    )

    return {
        "match_percent":     min(100, pct),
        "role_matched":      best_role.title(),
        "matched_skills":    req_found + pref_found,
        "missing_required":  [s for s in p["required"]  if s not in t],
        "missing_preferred": [s for s in p["preferred"] if s not in t][:4],
    }

# ─────────────────────────────────────────────
# 🔑 KEYWORD GAP ANALYSIS  (NEW)
# ─────────────────────────────────────────────
POWER_VERBS = ["achieved","built","created","delivered","designed","developed","engineered",
               "implemented","improved","increased","launched","led","managed","optimized",
               "reduced","spearheaded","transformed","generated","automated","deployed"]

WEAK_PHRASES = ["responsible for","helped with","worked on","assisted in",
                "was involved in","participated in","tried to","did some"]

def keyword_gap(text, job_match_data, skills):
    t = text.lower()
    missing   = (job_match_data.get("missing_required", []) +
                 job_match_data.get("missing_preferred", []))
    weak      = [p for p in WEAK_PHRASES  if p in t]
    power     = [v for v in POWER_VERBS   if v in t]
    words     = len(text.split())
    return {
        "missing_keywords":  missing[:8],
        "weak_phrases":      weak,
        "power_verbs_used":  power,
        "verb_density":      round(len(power) / max(1, words / 100), 2),
    }

# ─────────────────────────────────────────────
# 💪 STRENGTH BREAKDOWN  (NEW)
# ─────────────────────────────────────────────
def strength_breakdown(text, skills, sections, ats_score):
    words       = len(text.split())
    power_count = sum(1 for v in POWER_VERBS if v in text.lower())
    quant_count = len(re.findall(
        r'\b\d+\s*(%|percent|users|projects|faster|improvement|million|k\b)', text, re.I))
    return {
        "Content Quality": min(100, power_count * 8 + quant_count * 10),
        "Skills Coverage": min(100, len(skills) * 12),
        "Structure":       min(100, sum(15 for s in ["experience","education","skills","projects","summary"]
                                         if sections.get(s))),
        "ATS Readiness":   ats_score,
        "Completeness":    min(100, int(words / 600 * 100)),
    }

# ─────────────────────────────────────────────
# 🤖 AI REWRITE  (enhanced — same function signature)
# ─────────────────────────────────────────────
def rewrite_resume(text):
    lines = text.split("\n")
    improved = []

    REPLACEMENTS = {
        "responsible for": "spearheaded",
        "helped with":     "collaborated to deliver",
        "worked on":       "engineered",
        "assisted in":     "contributed to",
        "did some":        "executed",
        "tried to":        "successfully",
        "was involved in": "drove",
    }

    ENHANCEMENTS = {
        "developed": " — delivering scalable, production-ready solutions",
        "built":     " — adopted by multiple users with optimized performance",
        "improved":  " — resulting in measurable, quantifiable impact",
        "designed":  " — following industry best practices and modern standards",
        "created":   " — increasing efficiency and reducing manual effort",
        "managed":   " — coordinating cross-functional teams and timelines",
        "deployed":  " — ensuring 99.9% uptime with automated CI/CD pipelines",
        "automated": " — saving significant manual effort and reducing errors by ~40%",
    }

    for line in lines:
        stripped = line.strip()
        if not stripped:
            improved.append("")
            continue

        # Swap weak phrases
        lower = stripped.lower()
        for weak, strong in REPLACEMENTS.items():
            if weak in lower:
                stripped = re.sub(re.escape(weak), strong, stripped, flags=re.IGNORECASE)

        # Add impact suffixes
        for keyword, suffix in ENHANCEMENTS.items():
            if keyword in stripped.lower() and suffix.lower() not in stripped.lower():
                stripped = stripped.rstrip(".") + suffix
                break

        improved.append(stripped)

    return "\n".join(improved)

# ─────────────────────────────────────────────
# 🚀 MAIN API  (same route, extended response)
# ─────────────────────────────────────────────
@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        resume_text = ""

        # FILE  (unchanged)
        if "file" in request.files and request.files["file"].filename != "":
            file = request.files["file"]
            if file.filename.endswith(".pdf"):
                resume_text = extract_text_from_pdf(file)
            else:
                resume_text = file.read().decode("utf-8")

        # TEXT  (unchanged)
        elif "resume" in request.form:
            resume_text = request.form["resume"]

        if not resume_text or len(resume_text.strip()) < 30:
            return jsonify({"error": "Resume is too short or could not be read. Please upload a valid resume."})

        text = resume_text.lower()

        # ── SKILLS  (expanded from your 6 to 30+) ──────────────────────
        skill_db = {
            "python":          ["python"],
            "java":            ["java"],
            "javascript":      ["javascript", "js"],
            "typescript":      ["typescript", "ts"],
            "react":           ["react"],
            "node":            ["node.js", "node js", "nodejs"],
            "sql":             ["sql"],
            "machine learning":["machine learning", "ml"],
            "docker":          ["docker"],
            "aws":             ["aws", "amazon web services"],
            "git":             ["git"],
            "rest api":        ["rest api", "restful"],
            "html":            ["html"],
            "css":             ["css"],
            "mongodb":         ["mongodb"],
            "postgresql":      ["postgresql", "postgres"],
            "kubernetes":      ["kubernetes", "k8s"],
            "tensorflow":      ["tensorflow"],
            "pytorch":         ["pytorch"],
            "django":          ["django"],
            "flask":           ["flask"],
            "c++":             ["c++"],
            "go":              ["golang", " go "],
            "figma":           ["figma"],
            "linux":           ["linux"],
            "next.js":         ["next.js", "nextjs"],
            "tailwind":        ["tailwind"],
            "redis":           ["redis"],
            "graphql":         ["graphql"],
            "spark":           ["apache spark", "pyspark"],
        }

        skills = []
        for skill, variants in skill_db.items():
            if any(v in text for v in variants):
                skills.append(skill)

        # ── YOUR ORIGINAL CHECKS  (unchanged) ──────────────────────────
        has_project  = "project"    in text
        has_exp      = "experience" in text
        numbers      = re.findall(r"\d+", resume_text)
        has_metrics  = len(numbers) > 0
        action_words = ["developed", "built", "created"]
        has_action   = any(w in text for w in action_words)
        word_count   = len(resume_text.split())

        # ── YOUR ORIGINAL SCORE  (unchanged) ───────────────────────────
        score = 0
        score += len(skills) * 10
        if has_project:  score += 20
        if has_exp:      score += 20
        if has_metrics:  score += 20
        if has_action:   score += 15
        if word_count > 80: score += 15
        score = min(score, 100)

        # ── YOUR ORIGINAL ANALYSIS  (unchanged) ────────────────────────
        analysis = [
            "Projects section present"   if has_project else "No projects found",
            "Experience present"         if has_exp     else "No experience mentioned",
            "Uses measurable results"    if has_metrics else "Lacks measurable impact",
            "Strong action verbs used"   if has_action  else "Weak action verbs",
            "Good length"                if word_count > 80 else "Resume too short",
        ]

        # ── YOUR ORIGINAL SUGGESTIONS  (unchanged) ─────────────────────
        suggestions = []
        if not has_project:  suggestions.append("Add strong projects")
        if not has_exp:      suggestions.append("Add internship/experience")
        if not has_metrics:  suggestions.append("Add numbers (30%, 500 users)")
        if word_count < 80:  suggestions.append("Increase content")

        # ── YOUR ORIGINAL AI MESSAGE  (unchanged) ──────────────────────
        if score < 40:   ai = "Weak resume. Needs major improvement."
        elif score < 70: ai = "Good base but needs better impact."
        else:            ai = "Strong resume with minor improvements needed."

        # ── NEW COMPUTATIONS ────────────────────────────────────────────
        job_role_input = request.form.get("job_role", "Software Engineer").strip()
        sections       = detect_sections(resume_text)
        ats_score, ats_breakdown   = compute_ats_score(resume_text, skills, sections)
        job_match_data = compute_job_match(resume_text, job_role_input)
        gap_data       = keyword_gap(resume_text, job_match_data, skills)
        str_breakdown  = strength_breakdown(resume_text, skills, sections, ats_score)

        # ── ENHANCED AI REWRITE  (same key name: improved_resume) ──────
        improved_resume = rewrite_resume(resume_text)

        # ── RETURN  (all your original keys preserved) ──────────────────
        return jsonify({
            # ✅ YOUR ORIGINAL KEYS — untouched
            "score":          score,
            "skills":         skills,
            "message":        "Good resume" if score > 60 else "Needs improvement",
            "suggestions":    suggestions,
            "ai_suggestion":  ai,
            "analysis":       analysis,
            "improved_resume": improved_resume,

            # 🆕 NEW KEYS — added on top
            "sections":           sections,
            "ats_score":          ats_score,
            "ats_breakdown":      ats_breakdown,
            "job_role_matched":   job_match_data["role_matched"],
            "job_match":          job_match_data,
            "keyword_gap":        gap_data,
            "strength_breakdown": str_breakdown,
            "word_count":         word_count,
        })

    except Exception as e:
        return jsonify({"error": str(e)})


if __name__ == "__main__":
    app.run(debug=True)