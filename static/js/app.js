/* ── Career Compass – Frontend Logic ── */

let globalResults = null;
let activeScenario = 'certification_vs_internship';
let topCareerMetrics = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  document.getElementById('profileForm').addEventListener('submit', handleSubmit);
});

// ── Scroll to form ──────────────────────────────────────────────────────────
function scrollToForm() {
  document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' });
}


// ── Form Submit ──────────────────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  const btn = document.getElementById('analyzeBtn');
  btn.querySelector('.btn-text').classList.add('hidden');
  btn.querySelector('.btn-loader').classList.remove('hidden');
  btn.disabled = true;

  const skillsRaw = document.getElementById('skillsInput').value;
  const skills = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const interests = [...document.querySelectorAll('#interestGrid input:checked')].map(i => i.value);
  const certRaw = document.getElementById('certifications').value;
  const certs = certRaw ? certRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const profile = {
    name: document.getElementById('name').value || 'User',
    education: document.getElementById('education').value,
    experience_level: document.querySelector('input[name="experience"]:checked')?.value || 'beginner',
    timeline_years: parseInt(document.querySelector('input[name="timeline"]:checked')?.value || '3'),
    skills,
    interests,
    certifications: certs,
    has_internship: document.querySelector('input[name="internship"]:checked')?.value === 'true',
    target_goal: document.getElementById('targetGoal').value
  };

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    const data = await res.json();
    globalResults = data;
    renderResults(data);

    // Trigger decision engine with top career metrics
    if (data.results && data.results.length > 0) {
      topCareerMetrics = {
        hiring_prob: data.results[0].hiring_probability,
        salary: data.results[0].avg_salary_entry,
        promotion_speed: 50,
        growth: data.results[0].growth_potential,
        risk: data.results[0].risk_score
      };
      await loadDecisionScenario(activeScenario);
      document.getElementById('decision-section').classList.remove('hidden');
    }
  } catch (err) {
    alert('Analysis failed. Please try again.');
    console.error(err);
  } finally {
    btn.querySelector('.btn-text').classList.remove('hidden');
    btn.querySelector('.btn-loader').classList.add('hidden');
    btn.disabled = false;
  }
}

// ── Render Results ────────────────────────────────────────────────────────────
function renderResults(data) {
  const section = document.getElementById('results-section');
  section.classList.remove('hidden');

  // Profile summary
  const summary = document.getElementById('profileSummary');
  const p = data.profile_summary;
  summary.innerHTML = `
    <div class="summary-item"><span class="summary-val">${p.name}</span><span class="summary-key">Name</span></div>
    <div class="summary-item"><span class="summary-val">${capitalize(p.experience)}</span><span class="summary-key">Level</span></div>
    <div class="summary-item"><span class="summary-val">${p.skills_count}</span><span class="summary-key">Skills</span></div>
    <div class="summary-item"><span class="summary-val">${p.timeline_years}Y</span><span class="summary-key">Timeline</span></div>
    <div class="summary-item"><span class="summary-val">${data.results[0]?.title || 'N/A'}</span><span class="summary-key">Top Match</span></div>
    <div class="summary-item"><span class="summary-val">${data.results[0]?.fit_score || 0}/100</span><span class="summary-key">Best Fit Score</span></div>
  `;

  // AI Critique
  const critiqueContainer = document.getElementById('aiCritiqueContainer');
  const critiqueContent = document.getElementById('aiCritiqueContent');
  if (data.ai_critique) {
    critiqueContent.textContent = data.ai_critique;
    critiqueContainer.classList.remove('hidden');
  } else {
    critiqueContainer.classList.add('hidden');
  }

  // Career cards
  const grid = document.getElementById('resultsGrid');
  grid.innerHTML = '';
  data.results.forEach((career, i) => {
    const card = buildCareerCard(career, i);
    grid.appendChild(card);
    setTimeout(() => card.style.animationDelay = `${i * 0.08}s`, 0);
  });

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildCareerCard(career, index) {
  const card = document.createElement('div');
  card.className = 'career-card glass';
  card.style.setProperty('--card-color', career.color);
  card.style.animationDelay = `${index * 0.08}s`;

  const circumference = 2 * Math.PI * 32;
  const offset = circumference - (career.fit_score / 100) * circumference;

  const riskClass = { 'Low': 'risk-low', 'Medium': 'risk-medium', 'High': 'risk-high' }[career.risk_level] || 'risk-low';
  const isTop = index === 0;

  card.innerHTML = `
    <div class="card-rank ${isTop ? 'top' : ''}">${isTop ? '★ BEST FIT' : `#${index + 1}`}</div>
    <div class="card-icon">${career.icon}</div>
    <div class="card-title">${career.title}</div>
    <div class="card-desc">${career.description}</div>
    <div class="score-section">
      <div class="score-ring">
        <svg viewBox="0 0 72 72" width="72" height="72">
          <circle class="score-ring-bg" cx="36" cy="36" r="32"/>
          <circle class="score-ring-fill" cx="36" cy="36" r="32"
            stroke="${career.color}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"/>
        </svg>
        <div class="score-number" style="color:${career.color}">${career.fit_score}</div>
      </div>
      <div class="score-details">
        <div class="score-label">Career Fit Score</div>
        <div class="score-main" style="color:${career.color}">${career.fit_score}/100</div>
        <span class="risk-badge ${riskClass}">${career.risk_level} Risk</span>
      </div>
    </div>
    <div class="card-metrics">
      <div class="metric">
        <div class="metric-label">Hiring Prob.</div>
        <div class="metric-val text-green">${career.hiring_probability}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Market Demand</div>
        <div class="metric-val" style="color:${career.color}">${career.market_demand}/100</div>
      </div>
      <div class="metric">
        <div class="metric-label">Growth Potential</div>
        <div class="metric-val text-accent">${career.growth_potential}/100</div>
      </div>
      <div class="metric">
        <div class="metric-label">Entry Salary</div>
        <div class="metric-val">$${(career.avg_salary_entry/1000).toFixed(0)}K</div>
      </div>
    </div>
    <div class="card-footer">
      <button class="view-detail-btn" onclick="openModal('${career.career_id}')">View Full Simulation →</button>
    </div>
  `;

  return card;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(careerId) {
  if (!globalResults) return;
  const career = globalResults.results.find(r => r.career_id === careerId);
  if (!career) return;

  const content = document.getElementById('modalContent');
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (career.fit_score / 100) * circumference;

  const components = career.components || {};
  const barsHtml = Object.entries(components).map(([key, val]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const color = val >= 70 ? '#10b981' : val >= 45 ? '#f59e0b' : '#ef4444';
    return `
      <div class="bar-item">
        <span class="bar-label">${label}</span>
        <div class="bar-track"><div class="bar-fill animate-bar" style="width:${val}%;background:${color}"></div></div>
        <span class="bar-value" style="color:${color}">${val}</span>
      </div>`;
  }).join('');

  const routesHtml = career.entry_routes.map(r => `
    <div class="route-item">
      <span class="route-name">${r.route}</span>
      <div class="route-stats">
        <div class="route-stat">
          <div class="route-stat-val text-green">${r.hiring_prob}%</div>
          <div class="route-stat-key">Hire Prob</div>
        </div>
        <div class="route-stat">
          <div class="route-stat-val text-accent">${r.months}mo</div>
          <div class="route-stat-key">Timeline</div>
        </div>
      </div>
    </div>`).join('');

  const companiesHtml = career.top_companies.map(c => `<span class="company-chip">${c}</span>`).join('');

  content.innerHTML = `
    <div class="modal-header">
      <div class="modal-icon">${career.icon}</div>
      <div class="modal-title" style="color:${career.color}">${career.title}</div>
      <p class="modal-desc">${career.description}</p>
    </div>

    <div style="display:flex;align-items:center;gap:20px;padding:20px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.07);margin-bottom:8px">
      <div class="score-ring" style="width:90px;height:90px">
        <svg viewBox="0 0 90 90" width="90" height="90">
          <circle class="score-ring-bg" cx="45" cy="45" r="40"/>
          <circle class="score-ring-fill" cx="45" cy="45" r="40"
            stroke="${career.color}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"/>
        </svg>
        <div class="score-number" style="color:${career.color};font-size:1.3rem">${career.fit_score}</div>
      </div>
      <div>
        <div style="font-size:0.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em">Career Fit Score</div>
        <div style="font-family:var(--font-head);font-size:2rem;font-weight:800;color:${career.color}">${career.fit_score}<span style="font-size:1rem;color:var(--text2)">/100</span></div>
        <div style="color:var(--text2);font-size:0.85rem">Hiring Probability: <span style="color:var(--green);font-weight:700">${career.hiring_probability}%</span></div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">7-Dimension Fit Breakdown</div>
      <div class="score-bars">${barsHtml}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Entry Routes & Hiring Probabilities</div>
      <div class="routes-list">${routesHtml}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Job Market Forecast (Now vs 5 Years)</div>
      <div class="forecast-container">
        <div class="forecast-item">
          <div class="forecast-label">Current Demand</div>
          <div class="forecast-bar-bg"><div class="forecast-bar" style="width:${career.market_demand}%;background:var(--accent)"></div></div>
          <div class="forecast-val">${career.market_demand}/100</div>
        </div>
        <div class="forecast-item">
          <div class="forecast-label">Demand in 5 Years</div>
          <div class="forecast-bar-bg"><div class="forecast-bar" style="width:${Math.min(100, Math.round(career.market_demand * (1 + career.growth_potential / 250)))}%;background:var(--green)"></div></div>
          <div class="forecast-val">${Math.min(100, Math.round(career.market_demand * (1 + career.growth_potential / 250)))}/100</div>
        </div>
        <p class="forecast-insight">Growth driven by a <span style="color:var(--accent)">${career.growth_potential}/100</span> growth potential score.</p>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Salary Progression</div>
      <div class="salary-band">
        <div class="salary-item">
          <div class="salary-amt">$${(career.avg_salary_entry/1000).toFixed(0)}K</div>
          <div class="salary-stage">Entry Level</div>
        </div>
        <div class="salary-item">
          <div class="salary-amt" style="color:#a855f7">$${((career.avg_salary_entry + career.avg_salary_senior)/2/1000).toFixed(0)}K</div>
          <div class="salary-stage">Mid Level</div>
        </div>
        <div class="salary-item">
          <div class="salary-amt" style="color:#f59e0b">$${(career.avg_salary_senior/1000).toFixed(0)}K</div>
          <div class="salary-stage">Senior Level</div>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Top Hiring Companies</div>
      <div class="companies-list">${companiesHtml}</div>
    </div>
  `;

  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.getElementById('modalOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// ── Decision Engine ────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeScenario = btn.dataset.scenario;
      if (topCareerMetrics) loadDecisionScenario(activeScenario);
    });
  });
}

async function loadDecisionScenario(scenarioId) {
  const grid = document.getElementById('decisionGrid');
  grid.innerHTML = `<div class="loading-state" style="grid-column:1/-1"><div class="loader-ring"></div>Running decision simulation...</div>`;

  try {
    const res = await fetch('/api/decision-impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: scenarioId,
        base_metrics: topCareerMetrics
      })
    });
    const data = await res.json();
    renderDecisionGrid(data.scenario);
  } catch (e) {
    grid.innerHTML = `<p style="color:var(--text2);grid-column:1/-1">Failed to load scenario.</p>`;
  }
}

function renderDecisionGrid(scenario) {
  const grid = document.getElementById('decisionGrid');
  grid.innerHTML = '';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'decision-comparison-title';
  titleDiv.textContent = scenario.title;
  grid.appendChild(titleDiv);

  const colors = ['#00d4ff', '#a855f7'];
  ['option_a', 'option_b'].forEach((key, i) => {
    const opt = scenario[key];
    const card = document.createElement('div');
    card.className = 'decision-card glass';
    card.style.setProperty('--card-color', colors[i]);

    const metrics = [
      { label: 'Hiring Probability', val: opt.hiring_probability, unit: '%', color: '#10b981' },
      { label: 'Salary Potential', val: null, formatted: `$${(opt.salary_potential/1000).toFixed(0)}K`, color: '#f59e0b' },
      { label: 'Promotion Speed', val: opt.promotion_speed, unit: '/100', color: colors[i] },
      { label: 'Career Growth', val: opt.growth_score, unit: '/100', color: colors[i] },
      { label: 'Risk Level', val: opt.risk_score, unit: '/100', color: opt.risk_score > 60 ? '#ef4444' : '#10b981', invertBar: true }
    ];

    const metricsHtml = metrics.map(m => {
      const display = m.formatted || `${m.val}${m.unit}`;
      const barVal = m.val ?? 70;
      return `
        <div class="d-metric">
          <div class="d-metric-header">
            <span class="d-metric-label">${m.label}</span>
            <span class="d-metric-val" style="color:${m.color}">${display}</span>
          </div>
          <div class="d-bar-track">
            <div class="d-bar-fill animate-bar" style="width:${barVal}%;background:${m.color}"></div>
          </div>
        </div>`;
    }).join('');

    card.innerHTML = `
      <div class="decision-option-label">${opt.label}</div>
      <div class="decision-metrics">${metricsHtml}</div>
    `;
    grid.appendChild(card);
  });
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
