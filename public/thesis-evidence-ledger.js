/* Analyst-entered thesis evidence. No network requests; all records stay local. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'field-signals-thesis-evidence-v1';
  const DIRECTIONS = ['Supports', 'Challenges', 'Mixed', 'Context only'];
  const MAX_ENTRIES = 1000;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = (value, max=6000) => String(value == null ? '' : value).trim().slice(0,max);
  const makeId = () => `te-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  function normalize(input, now = new Date().toISOString()) {
    const row = {
      id: text(input?.id,100) || makeId(), loggedAt: text(input?.loggedAt,80) || now,
      company: text(input?.company,180), ticker: text(input?.ticker,60).toUpperCase(),
      thesis: text(input?.thesis,1200), direction: DIRECTIONS.includes(input?.direction) ? input.direction : 'Context only',
      observation: text(input?.observation,2400), metric: text(input?.metric,180), period: text(input?.period,100),
      sourceName: text(input?.sourceName,180), sourceUrl: text(input?.sourceUrl,1200), sourceDate: text(input?.sourceDate,100),
      implication: text(input?.implication,1400), nextCheck: text(input?.nextCheck,1000), confidence: ['Low','Medium','High'].includes(input?.confidence) ? input.confidence : 'Unrated',
      correctsId: text(input?.correctsId,100),
    };
    if (!row.company && !row.ticker) return { error: 'Add a company name or ticker.' };
    if (!row.thesis) return { error: 'Write the thesis claim this observation bears on.' };
    if (!row.observation) return { error: 'Record the observation before interpreting it.' };
    if (!row.sourceName || !row.sourceUrl) return { error: 'Add a source name and URL.' };
    try { const url = new URL(row.sourceUrl); if (!['http:','https:'].includes(url.protocol)) throw new Error(); }
    catch { return { error: 'Source URL must use http or https.' }; }
    if (row.correctsId && row.correctsId === row.id) return { error: 'A record cannot correct itself.' };
    return row;
  }

  function read(storage) {
    try { const data = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]'); return Array.isArray(data) ? data.filter(x=>x&&typeof x==='object').slice(0,MAX_ENTRIES) : []; }
    catch { return []; }
  }
  function write(storage, entries) { try { storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0,MAX_ENTRIES))); return true; } catch { return false; } }
  function importEntries(current, incoming) {
    if (!Array.isArray(incoming)) return { error: 'Backup must contain an entries array.' };
    const result = [...current], seen = new Set(current.map(x=>x.id)); let added=0;
    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') continue;
      const row = normalize({...raw, id: seen.has(text(raw.id,100)) ? makeId() : raw.id}, text(raw.loggedAt,80) || new Date().toISOString());
      if (row.error || result.length >= MAX_ENTRIES) continue;
      result.push(row); seen.add(row.id); added++;
    }
    return { entries: result, added };
  }
  function download(content, filename) {
    const url = URL.createObjectURL(new Blob([content], {type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  }
  function render() {
    return `<section class="te-ledger" aria-label="Thesis evidence ledger"><style>
      .te-ledger{max-width:1080px;margin:auto;color:#172943}.te-ledger *{box-sizing:border-box}.te-head{border-bottom:1px solid #dce3ed;padding:4px 0 14px}.te-head h2{font-size:25px;margin:0 0 5px}.te-muted{font-size:12px;color:#607089;line-height:1.5}.te-note{padding:10px 12px;background:#f2f6fd;border-left:3px solid #5578bb;font-size:12px;color:#435976}.te-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;background:#fff;border:1px solid #dce3ed;border-radius:8px;padding:13px;margin:12px 0}.te-form label{display:grid;gap:4px;font-size:11px;font-weight:650;color:#50617a}.te-form .wide{grid-column:1/-1}.te-form input,.te-form textarea,.te-form select{width:100%;min-width:0;border:1px solid #cbd6e4;border-radius:6px;padding:8px;font:12px/1.4 inherit;color:#172943;background:#fff}.te-form textarea{min-height:58px}.te-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.te-btn{border:1px solid #cbd7e7;border-radius:6px;padding:7px 10px;background:#fff;color:#274f9f;font-size:12px;font-weight:650;cursor:pointer}.te-btn.primary{background:#275bd7;color:#fff}.te-list{display:grid;gap:9px}.te-item{padding:12px 14px;background:#fff;border:1px solid #dce3ed;border-radius:8px}.te-item h3{font-size:14px;margin:0}.te-meta,.te-source{font-size:11px;color:#63738a;margin:4px 0;overflow-wrap:anywhere}.te-evidence{font-size:12px;white-space:pre-wrap;margin:8px 0}.te-chip{display:inline-block;background:#edf3ff;border-radius:99px;padding:2px 7px;font-size:10px;color:#385b98;margin-left:5px}.te-chip.challenge{background:#fff1e9;color:#93511d}.te-chip.mixed{background:#fff7dd;color:#805c10}.te-group{margin:15px 0 7px;font-size:15px}.te-filter{max-width:420px;margin:9px 0}.te-status{font-size:11px;color:#53647d;min-height:1em}.te-correction{font-size:10px;color:#865c14}.te-empty{color:#68768c;font-size:12px}
      @media(max-width:680px){.te-form{grid-template-columns:1fr}.te-form .wide{grid-column:auto}.te-head h2{font-size:22px}}
    </style><header class="te-head"><h2>Thesis evidence ledger</h2><p class="te-muted">Log what happened, where it came from, and which operating metric it may affect. Keep evidence separate from your interpretation, then write the next observable check.</p></header><p class="te-note">A saved observation is not proof of causation. Label what supports or challenges the thesis, keep periods and units attached, and add a correction record if an earlier entry was wrong. Existing entries are never removed by this tool.</p>
    <form class="te-form" data-te-form><label>Company<input name="company" maxlength="180" placeholder="Company name"></label><label>Ticker or identifier<input name="ticker" maxlength="60" placeholder="e.g. 2330 TW"></label><label>Evidence direction<select name="direction">${DIRECTIONS.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="wide">Thesis claim<textarea name="thesis" maxlength="1200" required placeholder="What specific claim does this evidence bear on?"></textarea></label><label class="wide">Observation<textarea name="observation" maxlength="2400" required placeholder="What did the source report? Include value, unit, geography, and period."></textarea></label><label>Operating metric<input name="metric" maxlength="180" placeholder="Units, ASP, utilization, margin"></label><label>Period<input name="period" maxlength="100" placeholder="FY2027, Sep 2026"></label><label>Confidence<select name="confidence"><option>Unrated</option><option>Low</option><option>Medium</option><option>High</option></select></label><label>Source name<input name="sourceName" maxlength="180" required placeholder="Filing, tracker, dataset"></label><label>Source URL<input name="sourceUrl" type="url" maxlength="1200" required placeholder="https://"></label><label>Source date<input name="sourceDate" maxlength="100" placeholder="Publication or observation date"></label><label class="wide">Operating-metric implication<textarea name="implication" maxlength="1400" placeholder="How might the observation flow through to the metric? What is still unproven?"></textarea></label><label class="wide">Next check<textarea name="nextCheck" maxlength="1000" placeholder="What future observation would strengthen, weaken, or falsify this claim?"></textarea></label><label>Corrects prior record ID<input name="correctsId" maxlength="100" placeholder="Optional. Earlier entry remains saved."></label><div class="te-actions wide"><button class="te-btn primary" type="submit">Add evidence</button><button class="te-btn" type="button" data-te-export>Export JSON</button><label class="te-btn" for="te-import-file">Import JSON</label><input id="te-import-file" data-te-import type="file" accept="application/json,.json" hidden></div><p class="te-status wide" data-te-status role="status" aria-live="polite"></p></form><label class="te-filter">Filter entries<input data-te-filter type="search" placeholder="Company, thesis, metric, source"></label><div class="te-list" data-te-list></div><p class="te-muted">Stored in this browser profile only. It is not password protected, encrypted, synced, or backed up. Export a copy before changing browsers.</p></section>`;
  }
  function attach(container) {
    if (!container) return;
    let storage; try { storage = root.localStorage; } catch { storage = null; }
    let entries = read(storage);
    const form=container.querySelector('[data-te-form]'), list=container.querySelector('[data-te-list]'), status=container.querySelector('[data-te-status]');
    const paint=filter=>{
      const q=text(filter,200).toLowerCase();
      const found=entries.filter(x=>[x.company,x.ticker,x.thesis,x.observation,x.metric,x.sourceName,x.period].join(' ').toLowerCase().includes(q));
      if(!found.length){list.innerHTML='<p class="te-empty">No matching evidence yet.</p>';return;}
      const groups=new Map();
      for(const row of found){const key=[row.company||row.ticker||'Company not set',row.ticker].filter(Boolean).join(' · ');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
      list.innerHTML=[...groups].map(([name,rows])=>`<section><h3 class="te-group">${esc(name)}</h3>${rows.map(row=>{const kind=row.direction==='Challenges'?'challenge':row.direction==='Mixed'?'mixed':'';return `<article class="te-item"><h3>${esc(row.thesis)}<span class="te-chip ${kind}">${esc(row.direction)}</span></h3><p class="te-meta">${esc(row.metric||'Metric not set')}${row.period?` · ${esc(row.period)}`:''} · logged ${esc(row.loggedAt.slice(0,10))} · ${esc(row.confidence)} confidence</p><p class="te-evidence"><strong>Observation:</strong> ${esc(row.observation)}</p>${row.implication?`<p class="te-evidence"><strong>Possible operating link:</strong> ${esc(row.implication)}</p>`:''}${row.nextCheck?`<p class="te-evidence"><strong>Next check:</strong> ${esc(row.nextCheck)}</p>`:''}<p class="te-source"><a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(row.sourceName)} ↗</a>${row.sourceDate?` · source date ${esc(row.sourceDate)}`:''} · record ${esc(row.id)}</p>${row.correctsId?`<p class="te-correction">Correction record for ${esc(row.correctsId)}. Earlier entry retained.</p>`:''}</article>`;}).join('')}</section>`).join('');
    };
    paint('');
    form?.addEventListener('submit',event=>{event.preventDefault();const row=normalize(Object.fromEntries(new FormData(form).entries()));if(row.error){status.textContent=row.error;return;}if(entries.length>=MAX_ENTRIES){status.textContent='Ledger limit reached. Export a backup before adding more.';return;}entries.unshift(row);if(!write(storage,entries)){entries.shift();status.textContent='Could not save in this browser. Existing entries are intact.';return;}form.reset();status.textContent='Evidence added. Earlier entries remain in the ledger.';paint(container.querySelector('[data-te-filter]').value);});
    container.querySelector('[data-te-filter]')?.addEventListener('input',event=>paint(event.target.value));
    container.querySelector('[data-te-export]')?.addEventListener('click',()=>download(JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries},null,2),'field-signals-thesis-evidence.json'));
    container.querySelector('[data-te-import]')?.addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());const result=importEntries(entries,data.entries);if(result.error){status.textContent=result.error;return;}if(!write(storage,result.entries)){status.textContent='Could not save import. Existing entries are intact.';return;}entries=result.entries;status.textContent=`Imported ${result.added} valid entries. Existing evidence was retained.`;paint(container.querySelector('[data-te-filter]').value);}catch{status.textContent='Could not read that backup. Existing evidence was retained.';}event.target.value='';});
    if(!storage)status.textContent='Browser storage is unavailable. Export evidence if you need to keep it after closing this page.';
  }
  const api={title:'Thesis evidence ledger',render,attach};
  root.FieldSignalsModules=root.FieldSignalsModules||{};root.FieldSignalsModules.thesisEvidenceLedger=api;
  if(typeof module!=='undefined'&&module.exports)module.exports={STORAGE_KEY,DIRECTIONS,normalize,read,write,importEntries,render};
})(typeof window!=='undefined'?window:globalThis);
