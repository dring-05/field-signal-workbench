/* Local snapshot of the separate Open Access Research Tools directory. */
(function(root){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr=v=>Array.isArray(v)?v.join(', '):String(v||'');
  const day=v=>String(v||'').slice(0,10);
  function render(header){return `${header('Open tools directory','Free public-market research sources','A local copy of the separate Open Access Research Tools directory. Start with the curated list, then search the full source library.', '<strong data-ot-count>Loading</strong> tools')}<section class="section ot-directory" aria-label="Open tools directory"><style>
    .ot-directory{--ot-line:#dce3ed}.ot-intro{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px}.ot-control{display:grid;gap:4px;font-size:11px;color:#53647d}.ot-control input,.ot-control select{border:1px solid #cbd6e4;border-radius:6px;background:white;padding:8px 9px;font:inherit;font-size:12px;color:#172943}.ot-search{flex:1 1 280px}.ot-check{display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid var(--ot-line);border-radius:6px;background:white;font-size:11px;color:#53647d}.ot-list{display:grid;gap:8px}.ot-row{display:grid;grid-template-columns:118px minmax(0,1fr) auto;gap:13px;align-items:center;padding:10px 12px;border:1px solid var(--ot-line);border-radius:8px;background:white}.ot-row:hover{border-color:#bacbe6;box-shadow:0 4px 13px #1424400c}.ot-thumb{width:118px;height:74px;object-fit:cover;border:1px solid #e1e7ef;border-radius:5px;background:#f1f4f8}.ot-thumb-missing{display:grid;place-items:center;font-size:10px;color:#8491a4}.ot-main{min-width:0}.ot-main h2{margin:0;font-size:14px}.ot-meta{display:flex;gap:5px;flex-wrap:wrap;margin:3px 0}.ot-tag{display:inline-flex;background:#edf3ff;color:#395991;border-radius:4px;padding:2px 6px;font-size:10px}.ot-main p{font-size:11px;color:#63738a;margin:3px 0;line-height:1.4}.ot-actions{display:flex;gap:6px;align-items:center}.ot-actions a{white-space:nowrap}.ot-details{grid-column:1/-1;border-top:1px solid #edf0f5;padding-top:8px;margin-top:0}.ot-details summary{font-size:11px;color:#34527e;cursor:pointer}.ot-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 12px;margin-top:8px}.ot-detail-grid div{font-size:11px;color:#53647d}.ot-detail-grid strong{color:#273e5e}.ot-detail-grid .ot-wide{grid-column:1/-1}.ot-snapshot{font-size:9px;color:#77859a;margin-top:3px}.ot-status{font-size:11px;color:#607089;padding:8px 0}.ot-none{padding:16px;border:1px dashed #cbd6e4;border-radius:8px;color:#607089;font-size:12px}.ot-foot{font-size:10px;color:#76839a;margin-top:12px}.ot-bottom{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px}.ot-bottom button{border:1px solid #cbd7e7;background:white;border-radius:6px;padding:7px 10px;color:#274f9f;font-size:11px;font-weight:650;cursor:pointer}
    @media(max-width:700px){.ot-row{grid-template-columns:76px minmax(0,1fr);gap:8px;padding:9px}.ot-thumb{width:76px;height:60px}.ot-actions{grid-column:2;grid-row:2}.ot-details{grid-column:1/-1;grid-template-columns:1fr}.ot-details .ot-wide{grid-column:auto}.ot-row:has(.ot-thumb-missing){grid-template-columns:1fr}.ot-bottom{align-items:flex-start;flex-direction:column}}
  </style><div class="ot-intro"><label class="ot-control ot-search">Search name, company, signal, access, cadence, sector, or niche<input type="search" data-ot-search placeholder="Try HBM, API, monthly, free, wages, or streaming"></label><label class="ot-control">Sector<select data-ot-sector><option value="">All sectors</option></select></label><label class="ot-control">Technology niche<select data-ot-niche><option value="">All niches</option></select></label><label class="ot-control">Geography<select data-ot-geography><option value="">All regions</option></select></label><label class="ot-check"><input type="checkbox" data-ot-starting checked> Curated starting list</label></div><p class="ot-status" data-ot-status role="status" aria-live="polite">Loading the local directory copy…</p><div class="ot-list" data-ot-list></div><div class="ot-bottom"><span class="ot-foot" data-ot-foot></span><button type="button" data-ot-more hidden>Show more</button></div><p class="ot-foot">This is a copied snapshot of the separate repository's directory data, last reviewed <span data-ot-review-date>from source metadata</span>. Provider status and free access can change. Thumbnails are dated page snapshots, not live site previews. To update this copy, refresh from the source directory and preview folder.</p></section>`;}
  function attach(container){
    const list=container?.querySelector('[data-ot-list]'),status=container?.querySelector('[data-ot-status]');if(!list)return;
    const search=container.querySelector('[data-ot-search]'),sector=container.querySelector('[data-ot-sector]'),niche=container.querySelector('[data-ot-niche]'),geography=container.querySelector('[data-ot-geography]'),starting=container.querySelector('[data-ot-starting]'),more=container.querySelector('[data-ot-more]'),count=container.querySelector('[data-ot-count]'),foot=container.querySelector('[data-ot-foot]');
    root.fetch('open-tools-directory.json').then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(data=>{
      const records=Array.isArray(data.records)?data.records:[];
      const sectors=[...new Set(records.map(x=>x.Sector).filter(Boolean))].sort();
      const niches=[...new Set(records.flatMap(x=>Array.isArray(x['Tech niches'])?x['Tech niches']:[]).filter(Boolean))].sort();
      const regions=[...new Set(records.flatMap(x=>Array.isArray(x.Regions)?x.Regions:[x.Geography]).filter(Boolean))].sort();
      sector.innerHTML+=[...sectors].map(x=>`<option>${esc(x)}</option>`).join('');
      niche.innerHTML+=[...niches].map(x=>`<option>${esc(x)}</option>`).join('');
      geography.innerHTML+=[...regions].map(x=>`<option>${esc(x)}</option>`).join('');
      let limit=50;
      container.querySelector('[data-ot-review-date]').textContent=day(data.reviewDate)||'not stated';
      function paint(){
        const q=search.value.trim().toLowerCase();
        const filtered=records.filter(r=>{
          if(starting.checked&&r['Starting list']!=='Yes')return false;
          if(sector.value&&r.Sector!==sector.value)return false;
          const rn=Array.isArray(r['Tech niches'])?r['Tech niches']:[];
          if(niche.value&&!rn.includes(niche.value))return false;
          const rg=Array.isArray(r.Regions)?r.Regions:[r.Geography];
          if(geography.value&&!rg.includes(geography.value))return false;
          const text=[r.Name,r.Sector,r.Theme,r.Geography,r['Observable signal'],r['Research use'],r['Main limitation'],r['How to use'],r.Access,r.Account,r['Free scope'],r['Update cadence'],r['Freshness note'],arr(r['Tech niches']),arr(r.Regions)].join(' ').toLowerCase();
          return !q||text.includes(q);
        });
        count.textContent=`${filtered.length} shown`;
        status.textContent=`${filtered.length} matching · ${records.length} in copied directory · source review ${day(data.reviewDate)}`;
        const visible=filtered.slice(0,limit);
        list.innerHTML=visible.length?visible.map(r=>{
          const img=String(r['Preview image']||'').split('/').pop();
          const captured=day(r['Preview captured at']);
          const nichesText=arr(r['Tech niches']);
          return `<article class="ot-row"><div>${img?`<img class="ot-thumb" loading="lazy" src="open-tools-previews/${encodeURIComponent(img)}" alt="Snapshot of ${esc(r.Name)}">`:'<div class="ot-thumb ot-thumb-missing">No saved snapshot</div>'}<div class="ot-snapshot">${captured?`Snapshot ${esc(captured)}`:'No capture date'}</div></div><div class="ot-main"><h2>${esc(r.Name)}</h2><div class="ot-meta"><span class="ot-tag">${esc(r.Sector||'Sector not set')}</span>${r.Theme?`<span class="ot-tag">${esc(r.Theme)}</span>`:''}${nichesText?`<span class="ot-tag">${esc(nichesText)}</span>`:''}</div><p><strong>Signal:</strong> ${esc(r['Observable signal']||'Not specified')}</p><p>${esc(r['Research use']||'')}</p></div><div class="ot-actions"><a class="btn" href="${esc(r.URL)}" target="_blank" rel="noopener noreferrer">Open source ↗</a></div><details class="ot-details"><summary>Access, coverage, freshness, and notes</summary><div class="ot-detail-grid"><div><strong>Free access:</strong> ${esc(r.Access||'Not specified')} · ${esc(r.Account||'')}</div><div><strong>Cadence:</strong> ${esc(r['Update cadence']||'Not stated')}</div><div><strong>Freshness:</strong> ${esc(r['Freshness note']||'Not reviewed')}</div><div><strong>Coverage:</strong> ${esc(r.Geography||'Not specified')}${r.Regions?` · ${esc(arr(r.Regions))}`:''}</div><div class="ot-wide"><strong>Limit:</strong> ${esc(r['Main limitation']||'Check provider coverage and definitions.')}</div><div class="ot-wide"><strong>How to use:</strong> ${esc(r['How to use']||'Open the source and check its latest data and access conditions.')}</div><div class="ot-wide"><strong>Evidence:</strong> <a href="${esc(r['Evidence URL']||r.URL)}" target="_blank" rel="noopener noreferrer">${esc(r['Source check']||'Provider source')} ↗</a> · checked ${esc(day(r['Freshness checked at']||r['Review date']))}</div></div></details></article>`;
        }).join(''):'<p class="ot-none">No tools match those filters.</p>';
        more.hidden=visible.length>=filtered.length;foot.textContent=`Showing ${visible.length} of ${filtered.length}. Curated list ${data.stats?.startingListCount||76}; full snapshot ${records.length}.`;
      }
      [search,sector,niche,geography,starting].forEach(el=>el.addEventListener('input',()=>{limit=50;paint()}));
      more.addEventListener('click',()=>{limit+=50;paint()});
      paint();
    }).catch(error=>{status.textContent=`Could not load the copied directory: ${error.message}`;list.innerHTML='<p class="ot-none">Reload the page or check the local directory JSON file.</p>';});
  }
  root.OpenToolsDirectory={render,attach};
})(typeof window!=='undefined'?window:globalThis);
