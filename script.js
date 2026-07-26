/* =========================================================
   Mental Health Signal — script.js
   Talks to the FastAPI backend at http://127.0.0.1:2200
   POST /predict — body matches the StudentData pydantic model
   exactly. Response: { predicted_mental_health_score }.
   ========================================================= */

'use strict';

// ---------------------------------------------------------
// Config
// ---------------------------------------------------------
const API_BASE_URL = 'http://127.0.0.1:2200';
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`;

const SCORE_SCALE_MAX = 10;

// ---------------------------------------------------------
// Field definitions (Updated cases to match design exactly)
// ---------------------------------------------------------
const FIELDS = [
  { key: 'age', section: 1, label: 'Age', type: 'number', min: 10, max: 100, step: 1, placeholder: 'e.g. 21', hint: '10–100' },
  { key: 'gender', section: 1, label: 'Gender', type: 'select', options: ['Male', 'Female'] },
  { key: 'country', section: 1, label: 'Country', type: 'text', placeholder: 'e.g. India', list: ['Other', 'India', 'USA', 'Canada', 'Australia', 'UK', 'Germany', 'Mexico', 'Turkey', 'France', 'Spain'], hint: 'Not listed? Type it anyway.' },

  { key: 'academic_level', section: 2, label: 'Academic level', type: 'select', options: ['High School', 'Undergraduate', 'Graduate'] },
  { key: 'most_used_platform', section: 2, label: 'Most-used platform', type: 'select', options: ['Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter', 'YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp', 'WeChat'] },
  { key: 'purpose_of_use', section: 2, label: 'Primary purpose', type: 'select', options: ['Networking', 'Education', 'Entertainment', 'News'] },
  { key: 'avg_daily_usage_hours', section: 2, label: 'Avg. daily screen time', type: 'number', min: 0, max: 24, step: 0.1, placeholder: '0.0', suffix: 'hrs' },
  { key: 'daily_unlocks', section: 2, label: 'Daily phone unlocks', type: 'number', min: 0, step: 1, placeholder: 'e.g. 60' },

  { key: 'study_hours', section: 3, label: 'Study hours / day', type: 'number', min: 0, max: 24, step: 0.1, placeholder: '0.0', suffix: 'hrs' },
  { key: 'physical_activity_hours', section: 3, label: 'Physical activity / day', type: 'number', min: 0, max: 24, step: 0.1, placeholder: '0.0', suffix: 'hrs' },
  { key: 'sleep_hours_per_night', section: 3, label: 'Sleep / night', type: 'number', min: 0, max: 24, step: 0.1, placeholder: '0.0', suffix: 'hrs' },
  { key: 'stress_level', section: 3, label: 'Perceived stress level', type: 'segmented', options: ['Low', 'Medium', 'High', 'Very High'] },
];

const INTEGER_FIELDS = new Set(['age', 'daily_unlocks']);
const segmentedState = {};

// ---------------------------------------------------------
// DOM refs
// ---------------------------------------------------------
const predictForm = document.getElementById('predictForm');
const predictBtn = document.getElementById('predictBtn');
const rerunBtn = document.getElementById('rerunBtn');
const errorBanner = document.getElementById('errorBanner');

const idleState = document.getElementById('idleState');
const loadingState = document.getElementById('loadingState');
const resultState = document.getElementById('resultState');
const resultPanel = document.getElementById('resultPanel');

// ---------------------------------------------------------
// Build the form dynamically
// ---------------------------------------------------------
function buildForm() {
  FIELDS.forEach((field) => {
    const container = document.getElementById(`section-${field.section}`);
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    wrapper.id = `field-${field.key}`;
    if (field.type === 'segmented') wrapper.classList.add('field-segmented');

    const label = document.createElement('label');
    label.className = 'field-label';
    label.setAttribute('for', field.key);
    label.textContent = field.label;
    wrapper.appendChild(label);

    if (field.type === 'segmented') {
      wrapper.appendChild(buildSegmentedControl(field));
    } else if (field.type === 'select') {
      wrapper.appendChild(buildSelect(field));
    } else {
      wrapper.appendChild(buildTextOrNumberInput(field));
    }

    // Appending hint AFTER the input control to match design
    if (field.hint) {
      const hint = document.createElement('span');
      hint.className = 'field-hint';
      hint.textContent = field.hint;
      wrapper.appendChild(hint);
    }

    appendErrorSlot(wrapper);
    container.appendChild(wrapper);
  });
}

function buildSelect(field) {
  const select = document.createElement('select');
  select.id = field.key;
  select.name = field.key;
  select.required = true;

  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = 'Select…';
  placeholderOpt.disabled = true;
  placeholderOpt.selected = true;
  select.appendChild(placeholderOpt);

  field.options.forEach((opt) => {
    const optionEl = document.createElement('option');
    optionEl.value = opt;
    optionEl.textContent = opt;
    select.appendChild(optionEl);
  });

  return select;
}

function buildTextOrNumberInput(field) {
  const inputWrap = document.createElement('div');
  inputWrap.className = 'input-wrap';

  const input = document.createElement('input');
  input.type = field.type;
  input.id = field.key;
  input.name = field.key;
  input.required = true;
  if (field.placeholder) input.placeholder = field.placeholder;
  if (field.min !== undefined) input.min = field.min;
  if (field.max !== undefined) input.max = field.max;
  if (field.step !== undefined) input.step = field.step;
  if (field.suffix) input.setAttribute('data-suffix', 'true');

  inputWrap.appendChild(input);

  if (field.suffix) {
    const suffix = document.createElement('span');
    suffix.className = 'suffix';
    suffix.textContent = field.suffix;
    inputWrap.appendChild(suffix);
  }

  if (field.list) {
    const listId = `${field.key}-list`;
    const datalist = document.createElement('datalist');
    datalist.id = listId;
    field.list.forEach((val) => {
      const opt = document.createElement('option');
      opt.value = val;
      datalist.appendChild(opt);
    });
    input.setAttribute('list', listId);
    inputWrap.appendChild(datalist);
  }

  return inputWrap;
}

function buildSegmentedControl(field) {
  const group = document.createElement('div');
  group.className = 'segmented-group';
  group.setAttribute('role', 'radiogroup');
  group.id = field.key;
  group.setAttribute('aria-label', field.label);

  field.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'segmented-btn';
    btn.textContent = opt;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      segmentedState[field.key] = opt;
      Array.from(group.children).forEach((sib) => sib.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      clearFieldError(field.key);
    });
    group.appendChild(btn);
  });

  return group;
}

function appendErrorSlot(wrapper) {
  const err = document.createElement('span');
  err.className = 'field-error';
  wrapper.appendChild(err);
}

function clearFieldError(key) {
  const wrapper = document.getElementById(`field-${key}`);
  wrapper.classList.remove('invalid');
  wrapper.querySelector('.field-error').textContent = '';
}

// ---------------------------------------------------------
// Validation
// ---------------------------------------------------------
function validateForm() {
  let isValid = true;

  FIELDS.forEach((field) => {
    const wrapper = document.getElementById(`field-${field.key}`);
    const errorEl = wrapper.querySelector('.field-error');
    let message = '';

    if (field.type === 'segmented') {
      if (!segmentedState[field.key]) {
        message = 'Please choose one.';
      }
    } else {
      const input = document.getElementById(field.key);
      const rawValue = input.value.trim();

      if (rawValue === '') {
        message = 'This field is required.';
      } else if (field.type === 'number') {
        const numValue = Number(rawValue);
        if (Number.isNaN(numValue)) {
          message = 'Enter a valid number.';
        } else if (field.min !== undefined && numValue < field.min) {
          message = `Must be at least ${field.min}.`;
        } else if (field.max !== undefined && numValue > field.max) {
          message = `Must be at most ${field.max}.`;
        }
      }
    }

    if (message) {
      wrapper.classList.add('invalid');
      errorEl.textContent = message;
      isValid = false;
    } else {
      wrapper.classList.remove('invalid');
      errorEl.textContent = '';
    }
  });

  return isValid;
}

document.addEventListener('input', (e) => {
  const wrapper = e.target.closest('.field');
  if (wrapper && wrapper.classList.contains('invalid') && !wrapper.classList.contains('field-segmented')) {
    wrapper.classList.remove('invalid');
    wrapper.querySelector('.field-error').textContent = '';
  }
});

// ---------------------------------------------------------
// Collect form data 
// ---------------------------------------------------------
function collectPayload() {
  const payload = {};
  FIELDS.forEach((field) => {
    if (field.type === 'segmented') {
      payload[field.key] = segmentedState[field.key];
      return;
    }
    const input = document.getElementById(field.key);
    const value = input.value.trim();

    if (field.type === 'number') {
      payload[field.key] = INTEGER_FIELDS.has(field.key) ? parseInt(value, 10) : parseFloat(value);
    } else {
      payload[field.key] = value;
    }
  });
  return payload;
}

// ---------------------------------------------------------
// Panel state switching
// ---------------------------------------------------------
function showPanelState(state) {
  idleState.hidden = state !== 'idle';
  loadingState.hidden = state !== 'loading';
  resultState.hidden = state !== 'result';
}

function setFormLoading(isLoading) {
  predictBtn.disabled = isLoading;
  predictBtn.querySelector('.btn-label').textContent = isLoading ? 'Reading…' : 'Read my signal';
  predictBtn.querySelector('.btn-spinner').hidden = !isLoading;
  if (isLoading) {
    errorBanner.hidden = true;
    showPanelState('loading');
  }
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function hideError() {
  errorBanner.hidden = true;
  errorBanner.textContent = '';
}

// ---------------------------------------------------------
// Gauge geometry helpers
// ---------------------------------------------------------
function pointOnGauge(scoreFraction) {
  const theta = 180 - scoreFraction * 180;
  const rad = (theta * Math.PI) / 180;
  return {
    x: 100 + 90 * Math.cos(rad),
    y: 100 - 90 * Math.sin(rad),
  };
}

function renderResult(data) {
  const score = data.predicted_mental_health_score;
  const fraction = Math.max(0, Math.min(1, score / SCORE_SCALE_MAX));

  document.getElementById('scoreValue').textContent = score.toFixed(2);

  const fillPath = document.getElementById('gaugeFill');
  const totalLength = fillPath.getTotalLength();
  fillPath.style.strokeDasharray = `${totalLength}`;
  fillPath.style.strokeDashoffset = `${totalLength}`;
  fillPath.getBoundingClientRect();
  requestAnimationFrame(() => {
    fillPath.style.strokeDashoffset = `${totalLength * (1 - fraction)}`;
  });

  const marker = document.getElementById('gaugeMarker');
  const startPoint = pointOnGauge(0);
  marker.setAttribute('cx', startPoint.x);
  marker.setAttribute('cy', startPoint.y);
  requestAnimationFrame(() => {
    const target = pointOnGauge(fraction);
    marker.setAttribute('cx', target.x);
    marker.setAttribute('cy', target.y);
  });

  const resultTagEl = document.getElementById('resultTag');
  const recommendationEl = document.getElementById('recommendationText');
  resultState.classList.remove('tone-strong', 'tone-mixed', 'tone-weak');

  let tone;
  if (score >= 7) {
    tone = 'strong';
    resultTagEl.textContent = 'Signal: strong';
    recommendationEl.textContent = 'Your habits point to a well-supported, resilient baseline. Keep your sleep, activity, and screen-time rhythm consistent.';
  } else if (score >= 4) {
    tone = 'mixed';
    resultTagEl.textContent = 'Signal: mixed';
    recommendationEl.textContent = 'A few areas are pulling your balance down. Trimming daily screen time and steadying your sleep schedule should help most.';
  } else {
    tone = 'weak';
    resultTagEl.textContent = 'Signal: weak';
    recommendationEl.textContent = 'Your habits suggest real strain right now. Consider talking to a counselor, prioritizing sleep, and setting firmer limits on social media use.';
  }
  resultState.classList.add(`tone-${tone}`);

  showPanelState('result');
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------------------------------------------------------
// Submit handler
// ---------------------------------------------------------
predictForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  if (!validateForm()) {
    return;
  }

  const payload = collectPayload();
  setFormLoading(true);

  try {
    const response = await fetch(PREDICT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = errJson.detail ? JSON.stringify(errJson.detail) : '';
      } catch (_) {}
      throw new Error(`Server responded with ${response.status}. ${detail}`);
    }

    const data = await response.json();
    renderResult(data);
  } catch (err) {
    console.error('Prediction request failed:', err);
    showPanelState('idle');
    if (err instanceof TypeError) {
      showError('Unable to connect to FastAPI server.');
    } else {
      showError(err.message || 'Something went wrong while getting your prediction.');
    }
  } finally {
    setFormLoading(false);
  }
});

function resetFormAndPanel() {
  predictForm.reset();
  Object.keys(segmentedState).forEach((k) => delete segmentedState[k]);
  document.querySelectorAll('.segmented-btn').forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
  FIELDS.forEach((field) => clearFieldError(field.key));
  hideError();
  showPanelState('idle');
}

rerunBtn.addEventListener('click', resetFormAndPanel);

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------
buildForm();
showPanelState('idle');