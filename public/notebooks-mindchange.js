/*
 * Local signal notebooks with explicit evidence on both sides of a thesis.
 * No network access is used. Entries stay in this browser's localStorage.
 */
(function () {
  const STORAGE_KEY = 'field-signals-nb-notebooks-v1';
  const STORAGE_PREFIX = 'field-signals-nb-';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const today = () => new Date().toISOString().slice(0, 10);
  const id = () => `nb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const blankState = () => ({ activeId: '', notebooks: [] });

  function validSourceUrl(raw) {
    try {
      const parsed = new URL(String(raw || '').trim());
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  }

  function readState(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.notebooks)) return blankState();
      const notebooks = parsed.notebooks.filter(item => item && typeof item.id === 'string' && Array.isArray(item.entries));
      const activeId = notebooks.some(item => item.id === parsed.activeId) ? parsed.activeId : (notebooks[0]?.id || '');
      return { activeId, notebooks };
    } catch {
      return blankState();
    }
  }

  function renderState(state, storageMessage = '') {
    const active = state.notebooks.find(item => item.id === state.activeId);
    const choices = state.notebooks.map(item => `<option value="${esc(item.id)}" ${item.id === state.activeId ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
    const entries = active ? [...active.entries].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(entry => `
      <article class="nb-entry">
        <div class="nb-entry-head"><time datetime="${esc(entry.date)}">${esc(entry.date)}</time><a href="${esc(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source</a></div>
        <p class="nb-label">Observation</p><p>${esc(entry.observation)}</p>
        <div class="nb-evidence-grid">
          <section class="nb-evidence nb-support"><h4>Evidence that supports the thesis</h4><p class="nb-label">Analyst read</p><p>${esc(entry.support || 'Not recorded')}</p></section>
          <section class="nb-evidence nb-weakening"><h4>Evidence that weakens the thesis</h4><p class="nb-label">Analyst read</p><p>${esc(entry.disconfirming || 'Not recorded')}</p></section>
        </div>
        <section class="nb-falsifier"><h4>What would change my mind?</h4><p>${esc(entry.falsifier || 'No test recorded')}</p></section>
      </article>`).join('') : '<p class="nb-empty">Create a notebook for a research question.</p>';

    return `<style>
      .nb-wrap{max-width:980px;margin:0 auto;color:#17263b}.nb-wrap *{box-sizing:border-box}.nb-wrap h1{font-size:26px;margin:0 0 6px}.nb-intro,.nb-muted{color:#64748b;font-size:13px;line-height:1.5}.nb-toolbar,.nb-panel,.nb-entry{border:1px solid #dce4ef;border-radius:9px;background:#fff}.nb-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:13px;margin:16px 0}.nb-toolbar label{font-size:12px;font-weight:650;display:flex;align-items:center;gap:8px}.nb-toolbar select,.nb-form input,.nb-form textarea{font:inherit;color:#17263b;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:9px}.nb-toolbar select{min-width:220px}.nb-panel{padding:17px;margin:14px 0}.nb-panel h2{font-size:17px;margin:0 0 10px}.nb-form{display:grid;gap:10px}.nb-form label{font-size:12px;font-weight:650;color:#43536a}.nb-form input,.nb-form textarea{display:block;width:100%;margin-top:5px;font-size:13px;font-weight:400}.nb-form textarea{min-height:70px;resize:vertical}.nb-form .nb-row{display:grid;grid-template-columns:1fr 2fr;gap:10px}.nb-form button{justify-self:start;border:0;border-radius:6px;background:#2457a6;color:#fff;padding:9px 13px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.nb-form button:hover{background:#194781}.nb-local-note{border-left:3px solid #7696c9;padding:8px 10px;background:#f4f7fc;color:#52647d;font-size:12px}.nb-message{min-height:16px;color:#9a3b31;font-size:12px}.nb-entries{display:grid;gap:11px}.nb-entry{padding:14px}.nb-entry-head{display:flex;justify-content:space-between;gap:10px;color:#64748b;font-size:12px}.nb-entry-head a{color:#2457a6}.nb-entry p{font-size:13px;line-height:1.5;margin:5px 0 10px;white-space:pre-wrap;overflow-wrap:anywhere}.nb-entry .nb-label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:750;color:#64748b;margin:12px 0 3px}.nb-evidence-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.nb-evidence,.nb-falsifier{border-radius:7px;padding:11px;margin-top:8px}.nb-evidence h4,.nb-falsifier h4{font-size:12px;margin:0}.nb-support{background:#f0f7f2;border:1px solid #d2e8d7}.nb-weakening{background:#fff5f1;border:1px solid #f0d8cd}.nb-falsifier{background:#f2f5fa;border:1px solid #dce4ef}.nb-empty{color:#64748b;font-size:13px;padding:12px 0}.nb-wrap a:focus-visible,.nb-wrap button:focus-visible,.nb-wrap select:focus-visible,.nb-wrap input:focus-visible,.nb-wrap textarea:focus-visible{outline:3px solid #8db7f2;outline-offset:2px}
      @media(max-width:620px){.nb-toolbar{display:block}.nb-toolbar label{display:block}.nb-toolbar select{display:block;width:100%;margin-top:6px}.nb-toolbar form{margin-top:11px}.nb-form .nb-row,.nb-evidence-grid{grid-template-columns:1fr}.nb-wrap h1{font-size:23px}}
    </style>
    <section class="nb-wrap" aria-labelledby="nb-title">
      <h1 id="nb-title">Signal notebooks</h1>
      <p class="nb-intro">Keep a dated record of what happened, how you read it, and what could prove that read wrong.</p>
      <p class="nb-local-note">Saved in this browser only. Notebooks do not sync across devices or accounts.</p>
      <div class="nb-toolbar">
        <label for="nb-select">Research question
          <select id="nb-select" name="active-notebook" ${state.notebooks.length ? '' : 'disabled'}>${choices || '<option value="">No notebooks yet</option>'}</select>
        </label>
        <form class="nb-form" data-form="create-notebook" aria-label="Create a research notebook">
          <div class="nb-row"><label>Notebook name<input name="notebook-name" maxlength="80" required placeholder="GPU rental prices"></label><label>Research question<input name="research-question" maxlength="240" required placeholder="Are falling quotes reaching customer economics?"></label></div>
          <button type="submit">Create notebook</button>
        </form>
      </div>
      <p class="nb-message" role="status" aria-live="polite">${esc(storageMessage)}</p>
      ${active ? `<section class="nb-panel"><h2>${esc(active.question)}</h2><p class="nb-muted">${active.entries.length} dated ${active.entries.length === 1 ? 'entry' : 'entries'} · ${esc(active.name)}</p>
        <form class="nb-form" data-form="add-entry" aria-label="Add dated evidence">
          <div class="nb-row"><label>Date<input type="date" name="date" value="${esc(today())}" required></label><label>Source URL<input type="url" name="source-url" placeholder="https://..." required></label></div>
          <label>Observation from the source<textarea name="observation" maxlength="4000" required placeholder="Record the reported value, event, or change. Keep this separate from your interpretation."></textarea></label>
          <div class="nb-row"><label>Evidence that supports the thesis<textarea name="support" maxlength="3000" placeholder="Analyst read. Explain why this observation supports the thesis."></textarea></label><label>Evidence that weakens the thesis<textarea name="disconfirming" maxlength="3000" placeholder="Analyst read. Include contrary evidence or another plausible explanation."></textarea></label></div>
          <label>What would change my mind?<textarea name="falsifier" maxlength="2000" placeholder="Name a result or threshold that would make you revise the thesis."></textarea></label>
          <button type="submit">Save dated entry</button>
        </form>
      </section>` : ''}
      <section class="nb-entries" aria-label="Notebook entries">${entries}</section>
    </section>`;
  }

  const api = {
    title: 'Signal notebooks',
    render() { return renderState(blankState()); },
    attach(container) {
      if (!container) throw new Error('Signal notebooks needs a container element.');
      let state;
      let storageMessage = '';
      let storage;
      try {
        storage = window.localStorage;
        state = readState(storage);
      } catch {
        storage = null;
        state = blankState();
        storageMessage = 'Browser storage is unavailable. Entries will not persist after this page closes.';
      }
      const persist = () => {
        if (!storage) return;
        try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
        catch { storageMessage = 'Browser storage could not save this change. Check available storage and try again.'; }
      };
      const clearStorageMessage = () => { if (storage) storageMessage = ''; };
      const paint = () => { container.innerHTML = renderState(state, storageMessage); };
      const field = (form, name) => form.elements.namedItem(name)?.value?.trim() || '';
      paint();
      container.addEventListener('change', event => {
        if (event.target?.name !== 'active-notebook') return;
        state.activeId = event.target.value;
        persist();
        paint();
      });
      container.addEventListener('submit', event => {
        const form = event.target;
        const action = form?.getAttribute?.('data-form');
        if (!['create-notebook', 'add-entry'].includes(action)) return;
        event.preventDefault();
        if (action === 'create-notebook') {
          const name = field(form, 'notebook-name');
          const question = field(form, 'research-question');
          if (!name || !question) return;
          const notebook = { id: id(), name, question, createdAt: today(), entries: [] };
          state.notebooks.push(notebook);
          state.activeId = notebook.id;
          clearStorageMessage();
          persist();
          paint();
          return;
        }
        const notebook = state.notebooks.find(item => item.id === state.activeId);
        if (!notebook) return;
        const sourceUrl = validSourceUrl(field(form, 'source-url'));
        const observation = field(form, 'observation');
        const date = field(form, 'date');
        if (!sourceUrl || !observation || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          storageMessage = 'Enter a valid date, observation, and http or https source URL.';
          paint();
          return;
        }
        notebook.entries.push({
          id: id(), date, observation, support: field(form, 'support'),
          disconfirming: field(form, 'disconfirming'), sourceUrl,
          falsifier: field(form, 'falsifier'), savedAt: new Date().toISOString()
        });
        clearStorageMessage();
        persist();
        paint();
      });
    }
  };
  window.FieldSignalsModules = window.FieldSignalsModules || {};
  window.FieldSignalsModules.notebooks = api;
})();
