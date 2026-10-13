/* Renders dated, manually reviewed public updates from hardware-market-changes.json. */
(function(root){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(){return `<section class="hmcl" aria-label="Hardware market change log"><style>
    .hmcl{max-width:1120px;margin:auto;color:#172943}.hmcl *{box-sizing:border-box}.hmcl header{border-bottom:1px solid #dce3ed;padding:4px 0 12px}.hmcl h2{font-size:25px;margin:0 0 5px}.hmcl p{font-size:12px;line-height:1.5;color:#607089}.hmcl .hmcl-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.hmcl select{border:1px solid #cbd6e4;border-radius:6px;background:white;padding:7px;font:inherit;font-size:12px}.hmcl .hmcl-row{display:grid;grid-template-columns:130px minmax(0,1fr);gap:14px;padding:13px;border:1px solid #dce3ed;border-radius:8px;background:white;margin:8px 0}.hmcl .hmcl-date{font-size:11px;color:#607089}.hmcl .hmcl-row h3{margin:0;font-size:14px}.hmcl .hmcl-row p{margin:6px 0}.hmcl .hmcl-tag{display:inline-block;border-radius:999px;background:#edf3ff;color:#385b98;padding:2px 7px;font-size:10px;margin-right:5px}.hmcl .hmcl-source{font-size:11px}.hmcl .hmcl-caveat{padding:8px 10px;border-left:3px solid #bd8423;background:#fff8e9;color:#72561c;font-size:11px}.hmcl .hmcl-empty{color:#607089;font-size:12px}
    @media(max-width:620px){.hmcl .hmcl-row{grid-template-columns:1fr;gap:5px}.hmcl h2{font-size:22px}}
  </style><header><h2>Memory, compute, MLCC and substrate changes</h2><p>Public source updates that may affect pricing, product mix, capacity or timing. Forecasts are labeled as forecasts. Each review date belongs to this log, not necessarily to the underlying observation.</p></header><div class="hmcl-caveat">Manually reviewed snapshot. No provider feed or change detector is connected. Check the source and latest date before using a figure.</div><div class="hmcl-toolbar"><label>Show niche <select data-hmcl-filter><option value="">All four niches</option></select></label><span data-hmcl-status role="status" aria-live="polite">Loading dated entries…</span></div><div data-hmcl-list></div></section>`;}
  function attach(container){
    const list=container?.querySelector('[data-hmcl-list]'), filter=container?.querySelector('[data-hmcl-filter]'), status=container?.querySelector('[data-hmcl-status]');
    if(!list)return;
    root.fetch('hardware-market-changes.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(data=>{
      const entries=Array.isArray(data.entries)?[...data.entries].sort((a,b)=>String(b.eventDate||'').localeCompare(String(a.eventDate||''))):[];
      const niches=[...new Set(entries.map(x=>x.niche))];
      filter.innerHTML+=[...niches].map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
      const paint=()=>{
        const rows=entries.filter(x=>!filter.value||x.niche===filter.value);
        list.innerHTML=rows.length?rows.map(x=>`<article class="hmcl-row"><div class="hmcl-date">${esc(x.eventDate)}<br>reviewed ${esc(x.observedAt)}</div><div><h3>${esc(x.companyOrMarket)}</h3><p><span class="hmcl-tag">${esc(x.niche)}</span><span class="hmcl-tag">${esc(x.changeType)}</span><span class="hmcl-tag">${esc(x.sourceKind)}</span></p><p>${esc(x.evidence)}</p><p><strong>Metric read-through:</strong> ${esc(x.operatingMetricImplication)}</p>${x.freshnessCaveat?`<p><strong>Freshness:</strong> ${esc(x.freshnessCaveat)}</p>`:''}<a class="hmcl-source" href="${esc(x.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(x.sourceName)} ↗</a><p>${esc(x.accessNote)}</p></div></article>`).join(''):'<p class="hmcl-empty">No entries in this niche yet.</p>';
        status.textContent=`${rows.length} entries · manual review ${esc(data.reviewedAt)} · ${esc(data.collectionMode)}`;
      };
      filter.addEventListener('change',paint);paint();
    }).catch(()=>{status.textContent='Could not load the dated hardware log.';list.innerHTML='<p class="hmcl-empty">Reload the page or open the source JSON file for the reviewed entries.</p>';});
  }
  const api={title:'Hardware market change log',render,attach};
  root.FieldSignalsModules=root.FieldSignalsModules||{};root.FieldSignalsModules.hardwareMarketChangeLog=api;
  if(typeof module!=='undefined'&&module.exports)module.exports={render,attach};
})(typeof window!=='undefined'?window:globalThis);
