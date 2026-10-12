/*
 * Question planner and source-grounded AI prompt builder.
 * The module makes no network requests. Saved work stays in this browser profile.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.FieldSignalsModules = root.FieldSignalsModules || {};
    root.FieldSignalsModules.questionResearch = {
      title: 'Question tools',
      render: api.render,
      attach: api.attach,
    };
    root.FieldSignalsQuestionResearchLogic = api.logic;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  const PLAN_KEY = 'field-signals-qr-plans-v1';
  const PROMPT_KEY = 'field-signals-qr-prompt-v1';
  const fields = [
    ['question', 'Research question', 'What specific operating question are you trying to answer?', 'text'],
    ['company', 'Company or value chain', 'Company, peer group, or value chain', 'text'],
    ['metric', 'Metric', 'What observable would answer the question?', 'text'],
    ['unit', 'Unit', 'For example: units, dollars, visits, MW, or %', 'text'],
    ['geography', 'Geography', 'Where is the signal measured?', 'text'],
    ['window', 'Time window', 'For example: weekly over the last 12 months', 'text'],
    ['direction', 'Expected direction', 'What change would support the hypothesis?', 'text'],
    ['falsifier', 'Falsifier', 'What result would weaken or contradict it?', 'text'],
  ];

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function normalizePlan(input) {
    const out = {};
    for (const [key] of fields) out[key] = clean(input && input[key]);
    return out;
  }

  function buildResearchPrompt(question, receipts, focus) {
    const q = clean(question) || '[Add the research question]';
    const evidence = clean(receipts) || '[Paste dated source receipts here]';
    const extra = clean(focus);
    return [
      'Research question',
      q,
      '',
      'Use only the source receipts included below for factual claims about current observations. Do not invent data, dates, coverage, definitions, or citations. If the receipts do not support an answer, say what is missing and what source should be checked.',
      '',
      'Separate the response into these parts:',
      '1. Observations: report what each receipt directly states, with an inline citation such as [R1] and the source URL and source date when present.',
      '2. Inference: explain what those observations may imply, and label each interpretation as an inference rather than a reported fact.',
      '3. Alternative explanations: identify plausible reasons the signal could move without the proposed business implication.',
      '4. What would change the conclusion: name a measurable falsifier and any missing cross-check.',
      '5. Limits: note stale, revised, modeled, geographically narrow, or otherwise non-comparable evidence.',
      '',
      extra ? `Analyst focus\n${extra}\n` : '',
      'Source receipts supplied by the analyst',
      evidence,
      '',
      'Do not describe a source as real time unless a receipt establishes the observed timestamp and update cadence. Keep units, time windows, and geographies distinct when they differ.',
    ].filter((line) => line !== undefined).join('\n');
  }

  function parseStored(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function storageGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function render() {
    const input = (() => {
      try { return JSON.parse(storageGet(PROMPT_KEY, '{}')) || {}; } catch { return {}; }
    })();
    return `<section class="qr-module" aria-label="Question tools">
      <style>
        .qr-module{max-width:980px;margin:0 auto;padding:clamp(12px,3vw,28px);color:#14233e}
        .qr-intro{margin:0 0 18px;color:#53627b;line-height:1.55}
        .qr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .qr-field{display:flex;flex-direction:column;gap:6px;min-width:0}
        .qr-field.wide{grid-column:1/-1}
        .qr-field label,.qr-label{font-size:.88rem;font-weight:650;color:#243754}
        .qr-field input,.qr-field textarea{box-sizing:border-box;width:100%;border:1px solid #c7d2e2;border-radius:9px;padding:10px 12px;font:inherit;color:#14233e;background:#fff}
        .qr-field textarea{min-height:98px;resize:vertical;line-height:1.45}
        .qr-card{border:1px solid #dbe3ee;border-radius:14px;background:#fff;padding:clamp(14px,2.6vw,22px);margin:14px 0;box-shadow:0 4px 14px rgba(26,55,98,.045)}
        .qr-card h2,.qr-card h3{margin:0 0 8px;color:#15294a}
        .qr-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
        .qr-button{appearance:none;border:1px solid #b7c6dc;background:#f7faff;color:#173665;border-radius:9px;padding:9px 13px;font:inherit;font-weight:650;cursor:pointer}
        .qr-button.primary{background:#2458c5;border-color:#2458c5;color:white}
        .qr-button:focus-visible,.qr-field input:focus-visible,.qr-field textarea:focus-visible{outline:3px solid #a9c7ff;outline-offset:2px}
        .qr-note,.qr-status{font-size:.88rem;color:#596b85;line-height:1.5}
        .qr-saved{display:grid;gap:8px;margin-top:12px}
        .qr-saved button{text-align:left;width:100%;overflow-wrap:anywhere}
        .qr-output{min-height:260px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88rem}
        @media(max-width:640px){.qr-grid{grid-template-columns:1fr}.qr-field.wide{grid-column:auto}.qr-actions .qr-button{flex:1 1 100%}}
      </style>
      <h1>Question tools</h1>
      <p class="qr-intro">Turn a thesis question into a testable measure, then prepare a source-grounded prompt for the AI model you choose. Plans and prompt drafts stay in this browser profile.</p>
      <section class="qr-card">
        <h2>Question to measure</h2>
        <p class="qr-note">Define the signal and what could disprove the idea before collecting data.</p>
        <form id="qr-plan-form"><div class="qr-grid">${fields.map(([key, label, placeholder, type]) => `<div class="qr-field${key === 'question' || key === 'falsifier' ? ' wide' : ''}"><label for="qr-${key}">${label}</label>${key === 'question' || key === 'falsifier' ? `<textarea id="qr-${key}" name="${key}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(input.plan && input.plan[key] || '')}</textarea>` : `<input id="qr-${key}" name="${key}" type="${type}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(input.plan && input.plan[key] || '')}">`}</div>`).join('')}</div>
          <div class="qr-actions"><button class="qr-button primary" type="submit">Save measure plan</button><button class="qr-button" type="button" id="qr-plan-export">Export plans</button></div><p class="qr-status" id="qr-plan-status" aria-live="polite"></p>
        </form>
        <div class="qr-saved" id="qr-saved-plans"></div>
      </section>
      <section class="qr-card">
        <h2>Prepare an AI research prompt</h2>
        <p class="qr-note">Paste source receipts you have checked. The prompt asks your chosen model to cite those receipts and keep direct observations separate from interpretation. Nothing is sent from this page.</p>
        <div class="qr-grid">
          <div class="qr-field wide"><label for="qr-ai-question">Question for the model</label><textarea id="qr-ai-question" placeholder="State the question to analyze">${escapeHtml(input.question || '')}</textarea></div>
          <div class="qr-field wide"><label for="qr-receipts">Source receipts, including URLs and dates</label><textarea id="qr-receipts" placeholder="Paste dated receipts here. Keep the source name, URL, observation date, geography, unit, and any revision note.">${escapeHtml(input.receipts || '')}</textarea></div>
          <div class="qr-field wide"><label for="qr-focus">Specific analyst focus (optional)</label><input id="qr-focus" type="text" placeholder="For example: test whether the move is demand-led" value="${escapeHtml(input.focus || '')}"></div>
        </div>
        <div class="qr-actions"><button class="qr-button primary" type="button" id="qr-build-prompt">Build prompt</button><button class="qr-button" type="button" id="qr-copy-prompt">Copy prompt</button><button class="qr-button" type="button" id="qr-download-prompt">Download prompt</button></div>
        <label class="qr-field wide" for="qr-prompt-output" style="margin-top:14px"><span class="qr-label">Editable prompt</span><textarea id="qr-prompt-output" class="qr-output" spellcheck="false">${escapeHtml(input.output || '')}</textarea></label>
        <p class="qr-status" id="qr-prompt-status" aria-live="polite"></p>
      </section>
    </section>`;
  }

  function attach(container) {
    if (!container) return;
    const form = container.querySelector('#qr-plan-form');
    const status = container.querySelector('#qr-plan-status');
    const list = container.querySelector('#qr-saved-plans');
    let plans = parseStored(storageGet(PLAN_KEY, '[]'));
    const showPlans = () => {
      list.innerHTML = plans.length ? `<h3>Saved measure plans</h3>${plans.map((plan, index) => `<button class="qr-button" type="button" data-plan-index="${index}">${escapeHtml(plan.question || 'Untitled question')} · ${escapeHtml(plan.metric || 'Metric not set')} · ${escapeHtml(plan.savedAt || '')}</button>`).join('')}` : '<p class="qr-note">No measure plans saved yet.</p>';
    };
    showPlans();
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const plan = normalizePlan(Object.fromEntries(data.entries()));
      if (!plan.question || !plan.metric) {
        status.textContent = 'Add a research question and a metric before saving.';
        return;
      }
      plan.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      plan.savedAt = new Date().toISOString();
      plans = [plan, ...plans];
      const saved = storageSet(PLAN_KEY, JSON.stringify(plans));
      status.textContent = saved ? 'Saved on this device.' : 'Browser storage is unavailable. Export the plan to keep a copy.';
      showPlans();
      persistPromptDraft(container);
    });
    list?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-plan-index]');
      if (!button) return;
      const plan = plans[Number(button.dataset.planIndex)];
      if (!plan) return;
      for (const [key] of fields) {
        const field = form.elements.namedItem(key);
        if (field) field.value = plan[key] || '';
      }
      status.textContent = 'Loaded saved plan. Editing it will save a new copy.';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    container.querySelector('#qr-plan-export')?.addEventListener('click', () => download('field-signals-measure-plans.json', JSON.stringify(plans, null, 2), 'application/json'));
    const promptInputs = ['#qr-ai-question', '#qr-receipts', '#qr-focus', '#qr-prompt-output'];
    for (const selector of promptInputs) container.querySelector(selector)?.addEventListener('input', () => persistPromptDraft(container));
    container.querySelector('#qr-build-prompt')?.addEventListener('click', () => {
      const output = container.querySelector('#qr-prompt-output');
      output.value = buildResearchPrompt(container.querySelector('#qr-ai-question').value, container.querySelector('#qr-receipts').value, container.querySelector('#qr-focus').value);
      persistPromptDraft(container);
      container.querySelector('#qr-prompt-status').textContent = 'Prompt prepared locally. Review the receipts, then paste it into your chosen model.';
    });
    container.querySelector('#qr-copy-prompt')?.addEventListener('click', async () => {
      const output = container.querySelector('#qr-prompt-output');
      const message = container.querySelector('#qr-prompt-status');
      try {
        await navigator.clipboard.writeText(output.value);
        message.textContent = 'Copied to clipboard.';
      } catch {
        output.focus(); output.select();
        message.textContent = 'Clipboard access is unavailable. The prompt is selected so you can copy it.';
      }
    });
    container.querySelector('#qr-download-prompt')?.addEventListener('click', () => download('field-signals-research-prompt.txt', container.querySelector('#qr-prompt-output').value, 'text/plain;charset=utf-8'));
  }

  function persistPromptDraft(container) {
    const data = {
      plan: Object.fromEntries(fields.map(([key]) => [key, container.querySelector(`[name="${key}"]`)?.value || ''])),
      question: container.querySelector('#qr-ai-question')?.value || '',
      receipts: container.querySelector('#qr-receipts')?.value || '',
      focus: container.querySelector('#qr-focus')?.value || '',
      output: container.querySelector('#qr-prompt-output')?.value || '',
    };
    storageSet(PROMPT_KEY, JSON.stringify(data));
  }

  function download(filename, content, type) {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename; link.click();
      URL.revokeObjectURL(url);
    } catch { /* The on-screen draft remains available if download APIs are blocked. */ }
  }

  return {
    render,
    attach,
    logic: { PLAN_KEY, PROMPT_KEY, normalizePlan, buildResearchPrompt },
  };
});
