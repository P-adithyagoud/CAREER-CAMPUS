# ◈ Career Compass – AI Career Decision Engine

> Test your future before living it. A precision career simulation platform for students and young professionals.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the App

```bash
python app.py
```

### 3. Open in Browser

```
http://localhost:5000
```

---

## 🗂️ Project Structure

```
career-compass/
├── app.py                    # Flask backend + scoring engine
├── requirements.txt
├── templates/
│   └── index.html            # Main UI (Glassmorphism)
├── static/
│   ├── css/
│   │   └── style.css         # Premium dark theme
│   ├── js/
│   │   └── app.js            # Frontend logic
│   └── data/
│       └── careers.json      # Career data + scoring rules
└── README.md
```

---

## ⚙️ Core Modules

### 1. Career Digital Twin
Captures user profile: education, skills, interests, certifications, experience level, and timeline.

### 2. Career Fit Scoring Engine
7-dimension weighted rule-based engine:
- Skills Match
- Interest Alignment
- Certification Relevance
- Timeline Feasibility
- Market Demand
- Growth Potential
- Learning Difficulty

Weights shift dynamically by experience level (Beginner / Intermediate / Advanced).

### 3. Future Path Simulation
Scores 6 career paths and ranks them. Each card shows:
- Career Fit Score (0–100)
- Hiring Probability
- Market Demand
- Growth Potential
- Risk Level
- Entry Routes with hiring probabilities

### 4. Decision Impact Engine
Compares 3 high-stakes scenarios:
- Certification Only vs Internship + Certification
- Direct Job vs Higher Studies
- Startup vs Corporate

Shows measurable delta in hiring probability, salary, promotion speed, growth, and risk.

---

## 🎨 Design

- Dark glassmorphism UI
- Syne + DM Sans typography
- Animated SVG score rings
- Micro-animations throughout
- Fully responsive

---

## 🔌 Extending with AI (Optional)

To add Groq AI commentary, add to `app.py`:

```python
import requests

def get_ai_insight(career_name, fit_score, profile):
    # Call Groq API here with career data
    # Return a short 2-3 sentence insight
    pass
```

Add your `GROQ_API_KEY` to a `.env` file and load with `python-dotenv`.

---

## 📊 Data Layer

All career data is in `static/data/careers.json`:
- Career definitions
- Scoring weights
- Entry routes with hiring probabilities
- Decision scenario modifiers

No database required. Pure JSON → Flask → rule engine.

---

Built for hackathons. Designed like a funded startup.
