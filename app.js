const EF = {
  GRID_KG_PER_KWH: 0.5,
  DIESEL_KG_PER_L: 2.68
};
const BENCH_KWH_PER_M2_YR = 120;

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function getInputs() {
  const parse = (id) => {
    const v = document.getElementById(id).value;
    return v === '' || v === null ? null : Number(v);
  };
  return {
    electricityBill: parse('electricityBill') ?? 0,
    tariff: clamp(parse('tariff'), 0.01, 100),
    employees: clamp(parse('employees') ?? 1, 1, 100000),
    acHours: clamp(parse('acHours'), 0, 24),
    dieselLiters: clamp(parse('dieselLiters') ?? 0, 0, 1000000),
    officeSize: clamp(parse('officeSize') ?? 50, 5, 100000)
  };
}

function estimateEmissions(inputs) {
  const kwh = inputs.electricityBill / inputs.tariff;
  const electricityKg = kwh * EF.GRID_KG_PER_KWH;
  const dieselKg = inputs.dieselLiters * EF.DIESEL_KG_PER_L;

  const acSharePct = clamp(0.1 + inputs.acHours * 0.03 + inputs.officeSize / 10000, 0, 0.8);
  const acKg = electricityKg * acSharePct;
  const otherElecKg = electricityKg - acKg;

  const monthlyKg = electricityKg + dieselKg;
  const monthlyT = monthlyKg / 1000;
  const annualT = monthlyT * 12;
  const intensityTPerEmp = inputs.employees > 0 ? (annualT / inputs.employees) : annualT;

  const fossilShare = monthlyKg === 0 ? 0 : (dieselKg / monthlyKg);

  return {
    kwh,
    electricityKg,
    dieselKg,
    monthlyT,
    annualT,
    intensityTPerEmp,
    acKg,
    otherElecKg,
    fossilShare,
    acSharePct
  };
}

function deriveGrowthRate(inputs) {
  let g = 0;
  if (inputs.acHours > 8) g += 0.006;
  if (inputs.dieselLiters > 0) g += 0.005;
  if (inputs.employees > 50) g += 0.004;
  return clamp(g, 0, 0.02);
}

function forecastEmissions(monthlyT, growthRate) {
  const months = 6;
  const series = [];
  for (let i = 0; i < months; i++) {
    const val = monthlyT * Math.pow(1 + growthRate, i);
    series.push(Number(val.toFixed(3)));
  }
  return series;
}

function computeScore(metrics, growthRate) {
  const intensityPenalty =
    metrics.intensityTPerEmp <= 1 ? 5 * metrics.intensityTPerEmp :
    metrics.intensityTPerEmp <= 5 ? 10 + (metrics.intensityTPerEmp - 1) * 7.5 :
    40 + (metrics.intensityTPerEmp - 5) * 4;
  const fossilPenalty = metrics.fossilShare * 25;
  const trendPenalty = (growthRate / 0.02) * 15;
  const acPenalty = metrics.acSharePct * 20;
  const totalPenalty = clamp(intensityPenalty + fossilPenalty + trendPenalty + acPenalty, 0, 95);
  const score = Math.round(clamp(100 - totalPenalty, 0, 100));
  const risk =
    score < 40 ? { label: 'High Risk', cls: 'high' } :
    score < 70 ? { label: 'Moderate Risk', cls: 'moderate' } :
    { label: 'Low Risk', cls: 'low' };
  return { score, risk, components: { intensityPenalty, fossilPenalty, trendPenalty, acPenalty } };
}

function simulateScenario(inputs, base) {
  const acReductionPct = (Number(document.getElementById('acReduction').value) || 0) / 100;
  const effGainPct = (Number(document.getElementById('efficiencyGain').value) || 0) / 100;
  const renewableOffsetPct = (Number(document.getElementById('renewableOffset').value) || 0) / 100;
  const investment = Number(document.getElementById('investment').value || 0);

  const acImpactOnElec = clamp(base.acSharePct * acReductionPct, 0, 0.8);
  const elecReductionFraction = 1 - (1 - effGainPct) * (1 - acImpactOnElec);
  const renewableOffsetFraction = renewableOffsetPct;

  const elecKgSaved = base.electricityKg * elecReductionFraction;
  const renewableKgOffset = (base.electricityKg - elecKgSaved) * renewableOffsetFraction;
  const monthlyKgReduced = elecKgSaved + renewableKgOffset;
  const annualTReduced = (monthlyKgReduced * 12) / 1000;

  const annualCostSaved = inputs.electricityBill * 12 * elecReductionFraction;
  const paybackMonths = investment > 0 && annualCostSaved > 0 ? Math.ceil(investment / (annualCostSaved / 12)) : null;

  return {
    annualTReduced,
    annualCostSaved,
    paybackMonths
  };
}

function formatTons(t) {
  return `${t.toFixed(2)} t`;
}
function formatCurrency(n) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

let charts = { forecast: null, breakdown: null, gauge: null, scenarioCompare: null };
function renderCharts(base, forecast) {
  const ctx1 = document.getElementById('forecastChart').getContext('2d');
  const ctx2 = document.getElementById('breakdownChart').getContext('2d');
  const labels = ['M0','M1','M2','M3','M4','M5'];

  if (charts.forecast) charts.forecast.destroy();
  charts.forecast = new Chart(ctx1, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Projected CO₂e (t)',
        data: forecast,
        fill: false,
        borderColor: '#38bdf8',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      animation: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.15)' } },
        x: { grid: { color: 'rgba(148,163,184,0.08)' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  if (charts.breakdown) charts.breakdown.destroy();
  charts.breakdown = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['Electricity (non-AC)','AC electricity','Diesel'],
      datasets: [{
        data: [base.otherElecKg/1000, base.acKg/1000, base.dieselKg/1000].map(v => Number(v.toFixed(3))),
        backgroundColor: ['#22c55e','#4ade80','#ef4444']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      animation: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderScenarioCompare(beforeAnnualT, afterAnnualT) {
  const el = document.getElementById('scenarioCompareChart');
  if (!el) return;
  const ctx = el.getContext('2d');
  if (charts.scenarioCompare) charts.scenarioCompare.destroy();
  charts.scenarioCompare = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Before','After'],
      datasets: [{
        data: [Number(beforeAnnualT.toFixed(2)), Number(afterAnnualT.toFixed(2))],
        backgroundColor: ['#64748b','#22c55e']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      animation: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function generateRoadmap(base, score, risk) {
  const items = [];
  if (base.fossilShare > 0.15) items.push('Reduce diesel generator reliance; explore backup batteries or maintenance to improve efficiency');
  if (base.acSharePct > 0.4) items.push('Trim AC runtime and setpoints; adopt zonal cooling and auto-shutdown schedules');
  if (score < 70) items.push('Prioritize LED upgrades, smart plugs, and workstation power policies');
  if (score < 50) items.push('Negotiate renewable-backed tariff or purchase RECs to cut grid emissions');
  items.push('Track monthly bills and intensity; set a 12-month reduction target');
  const html = `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul><div><strong>${risk.label}</strong> • Score ${score}</div>`;
  document.getElementById('aiRoadmap').innerHTML = html;
}

async function generateRoadmapViaAPI(base, scoreObj) {
  const payload = {
    region: 'GLOBAL',
    metrics: {
      monthlyT: base.monthlyT,
      annualT: base.annualT,
      intensityTPerEmp: base.intensityTPerEmp,
      fossilShare: base.fossilShare,
      acSharePct: base.acSharePct,
      score: scoreObj.score,
      risk: scoreObj.risk.label
    }
  };
  try {
    const res = await fetch('http://127.0.0.1:8001/api/roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('non-200');
    const data = await res.json();
    const items = data.recommendations || [];
    const html = `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul><div><strong>${scoreObj.risk.label}</strong> • Score ${scoreObj.score}</div>`;
    document.getElementById('aiRoadmap').innerHTML = html;
  } catch (e) {
    generateRoadmap(base, scoreObj.score, scoreObj.risk);
  }
}

function renderGauge(score, riskCls) {
  const el = document.getElementById('scoreGauge');
  if (!el) return;
  const ctx = el.getContext('2d');
  if (charts.gauge) charts.gauge.destroy();
  const color =
    riskCls === 'low' ? '#22c55e' :
    riskCls === 'moderate' ? '#f59e0b' : '#ef4444';
  charts.gauge = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Score','Remainder'],
      datasets: [{
        data: [score, 100 - score],
        backgroundColor: [color, '#1f2937'],
        borderWidth: 0,
        cutout: '75%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function updateScoreExplanation(scoreObj) {
  const c = scoreObj.components;
  const lines = [
    `-${c.fossilPenalty.toFixed(1)} fossil fuel reliance`,
    `-${c.intensityPenalty.toFixed(1)} high emissions per employee`,
    `-${c.trendPenalty.toFixed(1)} rising trend risk`,
    `-${c.acPenalty.toFixed(1)} AC dependency`
  ];
  const el = document.getElementById('scoreExplain');
  if (el) el.innerHTML = `<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
}

function updateBenchmarkMessage(inputs, base) {
  const benchKwh = inputs.officeSize * BENCH_KWH_PER_M2_YR;
  const benchT = (benchKwh * EF.GRID_KG_PER_KWH) / 1000;
  const el = document.getElementById('benchmarkMsg');
  if (!el) return;
  if (benchT > 0) {
    const ratio = base.annualT / benchT;
    const msg =
      ratio >= 1
        ? `Your emissions are ${ratio.toFixed(1)}× higher than a typical office of this size.`
        : `Your emissions are ${(1/ratio).toFixed(1)}× lower than a typical office of this size.`;
    el.textContent = msg;
  } else {
    el.textContent = '';
  }
}

function updateUI(inputs, base, scoreObj, forecast) {
  document.getElementById('monthlyCO2').textContent = formatTons(base.monthlyT);
  document.getElementById('annualCO2').textContent = formatTons(base.annualT);
  document.getElementById('intensity').textContent = `${base.intensityTPerEmp.toFixed(2)} t/emp/yr`;

  const scoreEl = document.getElementById('scoreNumber');
  scoreEl.textContent = scoreObj.score.toString();
  const riskEl = document.getElementById('riskLabel');
  riskEl.textContent = scoreObj.risk.label;
  riskEl.className = `risk ${scoreObj.risk.cls}`;

  renderCharts(base, forecast);
  renderGauge(scoreObj.score, scoreObj.risk.cls);
  updateScoreExplanation(scoreObj);
  updateBenchmarkMessage(inputs, base);
  generateRoadmapViaAPI(base, scoreObj);
}

function onCalculate(e) {
  e.preventDefault();
  const inputs = getInputs();
  const base = estimateEmissions(inputs);
  const g = deriveGrowthRate(inputs);
  const forecast = forecastEmissions(base.monthlyT, g);
  const scoreObj = computeScore(base, g);
  updateUI(inputs, base, scoreObj, forecast);
}

function onSimulate() {
  const inputs = getInputs();
  const base = estimateEmissions(inputs);
  const result = simulateScenario(inputs, base);
  document.getElementById('scenarioCO2Saved').textContent = formatTons(result.annualTReduced);
  document.getElementById('scenarioCostSaved').textContent = formatCurrency(result.annualCostSaved);
  document.getElementById('scenarioPayback').textContent = result.paybackMonths ? `${result.paybackMonths} months` : 'N/A';
  const afterAnnual = Math.max(0, base.annualT - result.annualTReduced);
  renderScenarioCompare(base.annualT, afterAnnual);
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('input-form').addEventListener('submit', onCalculate);
  document.getElementById('simulateBtn').addEventListener('click', onSimulate);
  const demo = document.getElementById('demoBtn');
  if (demo) {
    demo.addEventListener('click', () => {
      document.getElementById('electricityBill').value = 250;
      document.getElementById('tariff').value = 0.12;
      document.getElementById('employees').value = 18;
      document.getElementById('acHours').value = 8;
      document.getElementById('dieselLiters').value = 10;
      document.getElementById('officeSize').value = 120;
      document.getElementById('input-form').requestSubmit();
    });
  }
});
