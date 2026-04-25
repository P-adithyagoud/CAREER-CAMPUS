from flask import Flask, request, jsonify, render_template
import json
import os
import math
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = Flask(__name__)
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Load data
DATA_PATH = os.path.join(os.path.dirname(__file__), 'static', 'data', 'careers.json')
with open(DATA_PATH, 'r', encoding='utf-8') as f:
    DATA = json.load(f)

CAREERS = DATA['careers']
SKILLS_CATALOG = DATA['skills_catalog']
DECISION_SCENARIOS = DATA['decision_scenarios']

# ─── Scoring Engine ───────────────────────────────────────────────────────────

def normalize(val, min_val=0, max_val=100):
    return max(0, min(100, val))

def compute_skills_match(user_skills, required_skills):
    if not required_skills:
        return 50
    matched = 0
    for rs in required_skills:
        for us in user_skills:
            if rs.lower() in us.lower() or us.lower() in rs.lower():
                matched += 1
                break
    return round((matched / len(required_skills)) * 100)

def compute_interest_alignment(user_interests, career_interests):
    if not career_interests:
        return 50
    user_set = set(i.lower() for i in user_interests)
    career_set = set(i.lower() for i in career_interests)
    intersection = user_set & career_set
    if not career_set:
        return 50
    return round((len(intersection) / len(career_set)) * 100)

def compute_cert_relevance(user_certs, relevant_certs):
    if not relevant_certs or not user_certs:
        return 0
    matched = 0
    for uc in user_certs:
        for rc in relevant_certs:
            if uc.lower() in rc.lower() or rc.lower() in uc.lower():
                matched += 1
                break
    return round((matched / len(relevant_certs)) * 100)

def compute_timeline_feasibility(user_timeline_years, career, experience):
    user_months = user_timeline_years * 12
    needed_months = career['timeline_months'].get(experience, career['timeline_months']['beginner'])
    if user_months >= needed_months:
        return 100
    elif user_months >= needed_months * 0.7:
        return 75
    elif user_months >= needed_months * 0.5:
        return 50
    else:
        return 25

def compute_hiring_probability(fit_score, experience, has_internship, has_certs):
    base = 40 + (fit_score * 0.35)
    exp_bonus = {'beginner': 0, 'intermediate': 8, 'advanced': 15}.get(experience, 0)
    internship_bonus = 18 if has_internship else 0
    cert_bonus = 8 if has_certs else 0
    total = base + exp_bonus + internship_bonus + cert_bonus
    return round(normalize(total))

def score_career(career, profile):
    user_skills = profile.get('skills', [])
    user_interests = profile.get('interests', [])
    user_certs = profile.get('certifications', [])
    experience = profile.get('experience_level', 'beginner')
    timeline = profile.get('timeline_years', 3)
    has_internship = profile.get('has_internship', False)

    # Component scores
    skills_match = compute_skills_match(user_skills, career['required_skills'])
    interest_align = compute_interest_alignment(user_interests, career['interests'])
    cert_rel = compute_cert_relevance(user_certs, career['relevant_certs'])
    timeline_feas = compute_timeline_feasibility(timeline, career, experience)
    market_demand = career['market_demand']
    growth_potential = career['growth_potential']
    learning_ease = 100 - career['learning_difficulty']

    # Brutal Weights (total = 1.0)
    # If skills are missing, they should have a massive impact.
    if experience == 'beginner':
        weights = {
            'skills_match': 0.45,
            'interest_align': 0.15,
            'cert_rel': 0.10,
            'timeline_feas': 0.10,
            'market_demand': 0.10,
            'growth_potential': 0.05,
            'learning_ease': 0.05
        }
    elif experience == 'intermediate':
        weights = {
            'skills_match': 0.50,
            'interest_align': 0.10,
            'cert_rel': 0.15,
            'timeline_feas': 0.10,
            'market_demand': 0.08,
            'growth_potential': 0.05,
            'learning_ease': 0.02
        }
    else:  # advanced
        weights = {
            'skills_match': 0.60,
            'interest_align': 0.08,
            'cert_rel': 0.15,
            'timeline_feas': 0.10,
            'market_demand': 0.05,
            'growth_potential': 0.02,
            'learning_ease': 0.00
        }

    fit_score = (
        skills_match * weights['skills_match'] +
        interest_align * weights['interest_align'] +
        cert_rel * weights['cert_rel'] +
        timeline_feas * weights['timeline_feas'] +
        market_demand * weights['market_demand'] +
        growth_potential * weights['growth_potential'] +
        learning_ease * weights['learning_ease']
    )

    # Brutal Penalty: If you have zero matching skills, your score gets nuked.
    if skills_match < 10:
        fit_score = fit_score * 0.4
    elif skills_match < 30:
        fit_score = fit_score * 0.7

    hiring_prob = compute_hiring_probability(fit_score, experience, has_internship, bool(user_certs))

    # Risk score (lower = safer)
    risk_map = {'Low': 20, 'Medium': 50, 'High': 80}
    risk_score = risk_map.get(career['risk_level'], 50)
    if experience == 'beginner':
        risk_score = min(100, risk_score + 15)

    components = {
        'skills_match': round(skills_match),
        'interest_alignment': round(interest_align),
        'cert_relevance': round(cert_rel),
        'timeline_feasibility': round(timeline_feas),
        'market_demand': round(market_demand),
        'growth_potential': round(growth_potential)
    }

    return {
        'career_id': career['id'],
        'title': career['title'],
        'icon': career['icon'],
        'color': career['color'],
        'description': career['description'],
        'fit_score': round(normalize(fit_score)),
        'hiring_probability': compute_hiring_probability(normalize(fit_score), experience, has_internship, bool(user_certs)),
        'growth_potential': career['growth_potential'],
        'risk_level': career['risk_level'],
        'risk_score': risk_score,
        'market_demand': career['market_demand'],
        'avg_salary_entry': career['avg_salary_entry'],
        'avg_salary_senior': career['avg_salary_senior'],
        'entry_routes': career['entry_routes'],
        'top_companies': career['top_companies'],
        'timeline_months': career['timeline_months'],
        'components': components
    }


def get_ai_insight(career_name, fit_score, profile):
    try:
        skills = ", ".join(profile.get('skills', [])) or "None"
        prompt = f"""
        You are a brutal career coach. Analyze the following:
        Career: {career_name}
        User Fit Score: {fit_score}/100
        User Skills: {skills}
        User Experience: {profile.get('experience_level')}
        
        If the skills are empty or clearly insufficient for the career, be EXTREMELY brutal. 
        Tell them exactly why they are currently failing and what specific, hard-hitting skills they are missing.
        Keep it to 3-4 sentences maximum. Use a professional but harsh 'reality check' tone.
        """
        
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"AI Insight error: {e}")
        return "The AI engine is currently over-simulating. Focus on your skill gap."


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    profile = request.get_json()
    if not profile:
        return jsonify({'error': 'No profile data provided'}), 400

    results = []
    for career in CAREERS:
        scored = score_career(career, profile)
        results.append(scored)

    results.sort(key=lambda x: x['fit_score'], reverse=True)

    # Add rank
    for i, r in enumerate(results):
        r['rank'] = i + 1

    # AI Reality Check for top match
    ai_critique = "No data for critique."
    if results:
        top = results[0]
        ai_critique = get_ai_insight(top['title'], top['fit_score'], profile)

    return jsonify({
        'status': 'success',
        'profile_summary': {
            'name': profile.get('name', 'User'),
            'experience': profile.get('experience_level', 'beginner'),
            'skills_count': len(profile.get('skills', [])),
            'timeline_years': profile.get('timeline_years', 3)
        },
        'results': results,
        'ai_critique': ai_critique
    })


@app.route('/api/decision-impact', methods=['POST'])
def decision_impact():
    data = request.get_json()
    scenario_id = data.get('scenario')
    base_metrics = data.get('base_metrics', {})

    if scenario_id not in DECISION_SCENARIOS:
        return jsonify({'error': 'Unknown scenario'}), 400

    scenario = DECISION_SCENARIOS[scenario_id]
    opt_a = scenario['option_a']
    opt_b = scenario['option_b']

    base_hiring = base_metrics.get('hiring_prob', 65)
    base_salary = base_metrics.get('salary', 75000)
    base_promotion = base_metrics.get('promotion_speed', 50)
    base_growth = base_metrics.get('growth', 70)
    base_risk = base_metrics.get('risk', 40)

    def apply_mod(base, mod, is_risk=False):
        val = base + mod
        return round(normalize(val))

    return jsonify({
        'status': 'success',
        'scenario': {
            'id': scenario_id,
            'title': scenario['title'],
            'option_a': {
                'label': opt_a['label'],
                'hiring_probability': apply_mod(base_hiring, opt_a['hiring_prob_mod']),
                'salary_potential': round(base_salary * (1 + opt_a['salary_mod'] / 100)),
                'promotion_speed': apply_mod(base_promotion, opt_a['promotion_speed_mod']),
                'growth_score': apply_mod(base_growth, opt_a['growth_mod']),
                'risk_score': apply_mod(base_risk, opt_a['risk_mod'])
            },
            'option_b': {
                'label': opt_b['label'],
                'hiring_probability': apply_mod(base_hiring, opt_b['hiring_prob_mod']),
                'salary_potential': round(base_salary * (1 + opt_b['salary_mod'] / 100)),
                'promotion_speed': apply_mod(base_promotion, opt_b['promotion_speed_mod']),
                'growth_score': apply_mod(base_growth, opt_b['growth_mod']),
                'risk_score': apply_mod(base_risk, opt_b['risk_mod'])
            }
        }
    })


@app.route('/api/skills', methods=['GET'])
def get_skills():
    return jsonify(SKILLS_CATALOG)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
