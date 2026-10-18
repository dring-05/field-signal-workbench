// Add the published denominator, outlier, and freshness checks to each row's
// existing details panel. The base renderer remains responsible for filtering
// and pagination; this wrapper only adds visible quality context.
(() => {
  const renderRows = renderTaiwanRows;
  renderTaiwanRows = function(query) {
    renderRows(query);
    const target = document.querySelector('#taiwan-feed-table');
    if (!target) return;
    const needle = String(query || '').trim().toLowerCase();
    const pageSize = 100;
    const rows = taiwanFeedRows.filter(row => !needle || [row.Market, row['Company code'], row['Company name'], row['English company name or official abbreviation'], row.Industry].join(' ').toLowerCase().includes(needle)).sort(compareTaiwanAcceleration);
    const visible = rows.slice(taiwanPageNumber * pageSize, (taiwanPageNumber + 1) * pageSize);
    target.querySelectorAll('tbody tr').forEach((tr, index) => {
      const row = visible[index];
      const list = tr.querySelector('details dl');
      if (!row || !list) return;
      const legacy = !Object.prototype.hasOwnProperty.call(row, 'Revenue denominator quality');
      const currentRevenue = Number(String(row.Revenue ?? '').replace(/,/g, ''));
      const yearAgoBase = Number(String(row['Revenue year-ago month'] ?? '').replace(/,/g, ''));
      const legacyRatio = Number.isFinite(currentRevenue) && currentRevenue > 0 && Number.isFinite(yearAgoBase)
        ? yearAgoBase / currentRevenue * 100 : NaN;
      const legacyBaseStatus = !Number.isFinite(legacyRatio) || yearAgoBase <= 0
        ? 'Missing or invalid comparison base'
        : legacyRatio < 1 ? 'Low base below 1% of current revenue' : 'Usable by 1% base rule';
      const legacyOutlier = Math.abs(Number(String(row['Revenue YoY %'] ?? '').replace(/,/g, ''))) >= 500
        ? 'Review outlier: reported YoY growth at least 500%' : 'None identified by 500% rule';
      const items = [
        ['Revenue base quality', legacy
          ? `${legacyBaseStatus} · ${Number.isFinite(legacyRatio) ? legacyRatio.toFixed(2) : 'unknown'}% of current revenue; legacy feed`
          : `${row['Revenue denominator quality'] || 'Not checked'} · ${taiwanMetric(row['Year-ago base / current revenue %'])}% of current revenue`],
        ['Growth outlier flag', legacy ? `${legacyOutlier}; legacy feed` : row['Revenue growth outlier status'] || 'Not checked'],
        ['Freshness', `${row['Freshness status'] || 'Unavailable in legacy feed'} · market latest ${row['Market latest report month'] || 'unknown'}`],
      ];
      for (const [label, value] of items) {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        list.append(dt, dd);
      }
    });
  };
})();
