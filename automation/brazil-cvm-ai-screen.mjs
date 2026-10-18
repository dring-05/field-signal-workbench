#!/usr/bin/env node
/**
 * Brazil CVM open-filing keyword screen. It reads the official IPE annual
 * archive and follows only recent, public document links. Leads are prompts
 * for human review, never investment conclusions.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const CVM_ARCHIVE = year => `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_${year}.zip`;
const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;
const MAX_DOC_BYTES = 16 * 1024 * 1024;
const MAX_PDF_TEXT_BYTES = 2 * 1024 * 1024;
const AI_PATTERNS = [
  /\bartificial intelligence\b/gi, /\bgenerative\s+AI\b/gi, /\blarge language models?\b/gi,
  /\bmachine learning\b/gi, /\bIA generativa\b/gi, /\bintelig[eê]ncia artificial\b/gi,
  /\bIA[- ](?:generativa|aplicada|embarcada)\b/gi,
];
const BUSINESS_CONTEXT = /customer|commercial|revenue|product|service|business|segment|contract|facility|compute|GPU|operation|deploy|capital|manufactur|sales|cliente|comercial|receita|produto|servi[cç]o|neg[oó]cio|contrato|opera[cç][aã]o|investimento|desenvolv|lan[cç]amento|produ[cç][aã]o/i;
const NAME_AI = /\b(?:AI|IA)\b|intelig[eê]ncia artificial|artificial intelligence/i;
const DATE_FIELDS = ['data_entrega', 'data_entrega_doc', 'dt_entrega', 'data_entrega_documento'];
const TEXT_EXTENSIONS = /\.(?:html?|xhtml|xml|txt|htm)$/i;
const PDF_PYTHON = String.raw`
import sys
from io import BytesIO
from pypdf import PdfReader

raw = sys.stdin.buffer.read()
reader = PdfReader(BytesIO(raw), strict=False)
if reader.is_encrypted:
    raise SystemExit("encrypted PDF")
if len(reader.pages) > 100:
    raise SystemExit("PDF exceeds 100-page extraction limit")
parts = []
size = 0
for page in reader.pages:
    text = page.extract_text() or ""
    encoded = text.encode("utf-8", errors="replace")
    size += len(encoded)
    if size > 2 * 1024 * 1024:
        raise SystemExit("PDF text exceeds 2 MB extraction limit")
    parts.append(text)
sys.stdout.write("\n".join(parts))
`;

const decodeBytes = bytes => {
  const head = Buffer.from(bytes).subarray(0, 512).toString('ascii');
  const encoding = /charset\s*=\s*["']?iso-8859-1|encoding\s*=\s*["'](?:iso-8859-1|latin-1)/i.test(head) ? 'iso-8859-1' : 'utf-8';
  return new TextDecoder(encoding, { fatal: false }).decode(bytes);
};

/** Read bounded ordinary ZIP records. Encrypted and Zip64 entries are skipped. */
export function unzipFiles(input) {
  const zip = Buffer.from(input);
  if (!zip.length || zip.length > MAX_ARCHIVE_BYTES) throw new Error('CVM IPE archive is empty or exceeds the 20 MB safety limit');
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > zip.length) throw new Error('CVM response is not a supported ZIP archive');
  const count = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  const entries = [];
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > zip.length || zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Malformed CVM ZIP central directory');
    const flags = zip.readUInt16LE(cursor + 8), method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20), size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28), extraLength = zip.readUInt16LE(cursor + 30), commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    cursor += 46 + nameLength + extraLength + commentLength;
    if ((flags & 1) || ![0, 8].includes(method) || name.endsWith('/')) continue;
    expanded += size;
    if (expanded > MAX_UNCOMPRESSED_BYTES) throw new Error('CVM archive exceeds the 60 MB uncompressed safety limit');
    if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Malformed CVM ZIP local header');
    const localNameLen = zip.readUInt16LE(localOffset + 26), localExtraLen = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = zip.subarray(start, start + compressedSize);
    const bytes = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.min(size + 1, MAX_UNCOMPRESSED_BYTES) });
    if (bytes.length !== size) throw new Error(`CVM ZIP size mismatch for ${name}`);
    entries.push({ name, bytes, text: decodeBytes(bytes) });
  }
  return entries;
}

function normalizeHeader(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Parse quoted semicolon or comma separated text with Latin-1 support. */
export function parseDelimited(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const sample = lines.slice(0, 5).join('\n');
  const delimiter = (sample.match(/;/g) ?? []).length >= (sample.match(/,/g) ?? []).length ? ';' : ',';
  const parseLine = line => {
    const values = [];
    let value = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === delimiter && !quoted) { values.push(value); value = ''; }
      else value += ch;
    }
    values.push(value);
    return values.map(cell => cell.trim());
  };
  const header = parseLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).flatMap(line => {
    const cells = parseLine(line);
    if (cells.length !== header.length) return [];
    return [Object.fromEntries(header.map((key, i) => [key, cells[i]]))];
  });
}

function findIndexEntry(entries) {
  const supported = entries.filter(item => /\.(?:csv|txt)$/i.test(item.name));
  for (const entry of supported) {
    const rows = parseDelimited(entry.text);
    if (!rows.length) continue;
    const keys = new Set(Object.keys(rows[0]));
    const hasCode = ['codigo_cvm', 'cod_cvm', 'ccvm'].some(key => keys.has(key));
    const hasDelivery = DATE_FIELDS.some(key => keys.has(key));
    const hasCategory = ['categoria', 'categoria_documento'].some(key => keys.has(key));
    if (hasCode && hasDelivery && hasCategory) return { entry, rows };
  }
  throw new Error('CVM ZIP did not contain a recognizable IPE index with issuer code, delivery date, and category fields');
}

function parseDate(value) {
  const source = String(value ?? '').trim();
  const match = source.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : '';
}

function field(row, options) {
  for (const key of options) if (row[key] !== undefined && row[key] !== '') return String(row[key]).trim();
  return '';
}

export function normalizeIpeRows(rows) {
  return rows.map(row => ({
    issuerCode: field(row, ['codigo_cvm', 'cod_cvm', 'ccvm']),
    company: field(row, ['nome_companhia', 'companhia', 'nome_empresa', 'empresa']),
    cnpj: field(row, ['cnpj_companhia', 'cnpj']),
    delivered: parseDate(field(row, DATE_FIELDS)),
    category: field(row, ['categoria', 'categoria_documento']),
    type: field(row, ['tipo', 'tipo_documento']),
    subject: field(row, ['assunto', 'descricao_assunto']),
    protocol: field(row, ['protocolo_entrega', 'protocolo', 'numero_protocolo']),
    version: field(row, ['versao', 'versao_documento']),
    url: field(row, ['link_download', 'url_documento', 'url']),
  })).filter(row => row.issuerCode && row.delivered);
}

function plainText(input) {
  return String(input ?? '').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}

export function findAiEvidence(text) {
  const source = String(text ?? '').replace(/\s+/g, ' ');
  const found = [];
  for (const pattern of AI_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      const start = Math.max(0, match.index - 180), end = Math.min(source.length, match.index + match[0].length + 180);
      const context = source.slice(start, end);
      if (!BUSINESS_CONTEXT.test(context)) continue;
      found.push({ term: match[0], excerpt: context.trim() });
      if (found.length >= 12) return found;
    }
  }
  return found;
}

/** Extract text with pdftotext first and a bounded pypdf fallback. */
export function extractPdfText(bytes, { execFile = execFileSync, python = process.env.PYTHON || 'python3' } = {}) {
  try {
    const text = execFile('pdftotext', ['-layout', '-', '-'], {
      input: bytes, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 15000,
      maxBuffer: MAX_PDF_TEXT_BYTES,
    });
    if (text?.trim()) return text;
  } catch { /* Try the portable Python fallback below. */ }
  try {
    const text = execFile(python, ['-c', PDF_PYTHON], {
      input: bytes, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 20000,
      maxBuffer: MAX_PDF_TEXT_BYTES,
    });
    return text?.trim() ? text : '';
  } catch {
    return '';
  }
}

function probableName(text) {
  const value = plainText(text);
  const matches = [...value.matchAll(/(?:denominacao social|nome empresarial|companhia|empresa)\s*[:\-]?\s*([A-Z0-9][A-Z0-9 .,&()/-]{2,120})/gi)];
  return matches.map(match => match[1].trim())[0] ?? '';
}

export function createLeads(rows, oldNames = {}, { from, to, knownProtocols = [] } = {}) {
  const seen = new Set(knownProtocols);
  const currentNames = { ...oldNames };
  const output = [];
  for (const row of rows) {
    const key = row.cnpj || row.issuerCode;
    if (row.company) currentNames[key] = row.company;
    if (!row.delivered || row.delivered < from || row.delivered > to) continue;
    const filingId = `${row.protocol || `${row.issuerCode}-${row.delivered}-${row.category}`}-v${row.version || '1'}`;
    if (seen.has(filingId)) continue;
    const nameChange = row.company && oldNames[key] && row.company !== oldNames[key] && NAME_AI.test(row.company);
    const metadataText = `${row.category} ${row.type} ${row.subject}`;
    const metadataHits = findAiEvidence(metadataText);
    const nameHit = nameChange ? [{ term: 'issuer name changed to include AI', excerpt: `${oldNames[key]} → ${row.company}` }] : [];
    if (metadataHits.length || nameHit.length) {
      output.push({
        source: 'Brazil CVM IPE', market: 'Brazil', issuerCode: row.issuerCode,
        company: row.company || '', cnpj: row.cnpj || '', filingDate: row.delivered,
        category: row.category, form: [row.type, row.subject].filter(Boolean).join(' / '),
        filingUrl: row.url || 'https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe',
        accession: filingId,
        leadType: nameHit.length ? 'legal-name candidate' : 'AI wording in filing metadata',
        label: nameHit.length ? 'Issuer name changed to include AI, confirm against filing and registry' : 'AI-related wording in filing metadata, open and review original',
        evidence: [...nameHit, ...metadataHits], reviewedByHuman: false,
      });
    }
    seen.add(filingId);
  }
  return { leads: output, companyNames: currentNames, checkedProtocols: [...seen].slice(-20000) };
}

async function get(fetchImpl, url, { maxBytes = MAX_ARCHIVE_BYTES } = {}) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'FieldSignals public-disclosure research screen' }, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`CVM request failed (${response.status}) for ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) throw new Error(`CVM response exceeded ${maxBytes} byte limit`);
  return { contentType: response.headers.get('content-type') ?? '', bytes: data };
}

export async function scan({ fetchImpl = fetch, feed = {}, from, to, year = new Date().getUTCFullYear(), maxDocs = 500, download = true, pdfTextExtractor = extractPdfText } = {}) {
  if (!Number.isInteger(year) || year < 2003 || year > 2100) throw new Error('year must be a valid IPE archive year');
  if (from?.slice(0, 4) !== String(year) || to?.slice(0, 4) !== String(year)) throw new Error('from and to must fall within the selected IPE archive year');
  const archiveUrl = CVM_ARCHIVE(year);
  const archive = await get(fetchImpl, archiveUrl);
  const index = findIndexEntry(unzipFiles(archive.bytes));
  const normalized = normalizeIpeRows(index.rows).filter(row => row.delivered >= from && row.delivered <= to);
  const nameSnapshot = { ...(feed.companyNames ?? {}) };
  const discoveredNames = {};
  // The archive index is not guaranteed to be chronological. Establish each
  // issuer's latest name from delivery dates, not the file's physical row order.
  const chronologicallyOrdered = normalizeIpeRows(index.rows).sort((a, b) =>
    a.delivered.localeCompare(b.delivered)
    || (a.protocol || '').localeCompare(b.protocol || '')
    || (a.version || '').localeCompare(b.version || '')
  );
  for (const row of chronologicallyOrdered) if (row.company) discoveredNames[row.cnpj || row.issuerCode] = row.company;
  const existing = new Set(feed.checkedProtocols ?? []);
  const pendingDocuments = normalized
    .filter(row => row.url && !existing.has(`${row.protocol || `${row.issuerCode}-${row.delivered}-${row.category}`}-v${row.version || '1'}`))
    .sort((a, b) => a.delivered.localeCompare(b.delivered)
      || (a.protocol || '').localeCompare(b.protocol || '')
      || (a.version || '').localeCompare(b.version || ''));
  // Keep the newest records when a bounded scan cannot cover the whole window.
  const toFetch = pendingDocuments.slice(-maxDocs);
  let documentRequests = 0, readableDocuments = 0, pdfDocuments = 0, unparsedPdf = 0, failedDocuments = 0;
  const completedIds = [];
  const evidenceRows = [];
  if (download) {
    for (const row of toFetch) {
      const id = `${row.protocol || `${row.issuerCode}-${row.delivered}-${row.category}`}-v${row.version || '1'}`;
      try {
        const result = await get(fetchImpl, row.url, { maxBytes: MAX_DOC_BYTES });
        documentRequests++;
        const isPdf = result.bytes.subarray(0, 5).toString() === '%PDF-';
        let text = '';
        if (isPdf) {
          pdfDocuments++;
          text = pdfTextExtractor(result.bytes);
          if (!text) unparsedPdf++;
        } else if (TEXT_EXTENSIONS.test(new URL(row.url).pathname) || /(?:text\/|html|xml|json)/i.test(result.contentType)) {
          text = decodeBytes(result.bytes);
        }
        if (text) {
          readableDocuments++;
          const hits = findAiEvidence(plainText(text));
          if (hits.length) evidenceRows.push({ ...row, hits });
        }
        completedIds.push(id);
      } catch {
        failedDocuments++;
      }
    }
  }
  const screenRows = [...evidenceRows.map(row => ({ ...row, subject: row.hits.map(hit => hit.excerpt).join(' ') }))];
  const screened = createLeads([...normalized.filter(row => !row.url), ...screenRows], nameSnapshot, { from, to, knownProtocols: [...existing] });
  // Add a snapshot-based name-change signal only when both snapshots are identifiable.
  const nameLeads = [];
  for (const row of normalized) {
    const key = row.cnpj || row.issuerCode, previous = nameSnapshot[key];
    if (previous && row.company && previous !== row.company && NAME_AI.test(row.company)) {
      nameLeads.push({ source: 'Brazil CVM IPE', market: 'Brazil', issuerCode: row.issuerCode, cnpj: row.cnpj, company: row.company, filingDate: row.delivered, category: row.category, filingUrl: row.url || 'https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe', accession: `name-${key}-${row.delivered}`, leadType: 'legal-name candidate', label: 'Issuer name changed to include AI, confirm against filing and registry', evidence: [{ term: 'issuer name changed to include AI', excerpt: `${previous} → ${row.company}` }], reviewedByHuman: false });
    }
  }
  const leadMap = new Map([...screened.leads, ...nameLeads].map(lead => [lead.accession, lead]));
  const currentDate = to;
  const retained = (feed.leads ?? []).filter(lead => lead.filingDate >= currentDate.slice(0, 4) + '-01-01');
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), market: 'Brazil',
    coverage: 'CVM-registered open companies represented in the annual public IPE archive. The screen is limited to metadata and documents retrieved for the selected date window. It is not a complete list of Brazilian public companies or a conclusion about AI commercialization.',
    archiveUrl, archiveYear: year, archiveFetchedAt: new Date().toISOString(),
    scanWindowStart: from, scanWindowEnd: to,
    sources: ['https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe', archiveUrl],
    scanStats: { indexRows: index.rows.length, recentRows: normalized.length, selectedDocuments: toFetch.length, documentRequests, readableDocuments, pdfDocuments, unparsedPdf, failedDocuments, candidateLeads: leadMap.size, truncated: pendingDocuments.length > toFetch.length },
    leads: [...new Map([...retained, ...leadMap.values()].map(lead => [lead.accession, lead])).values()].sort((a, b) => b.filingDate.localeCompare(a.filingDate)).slice(0, 1000),
    companyNames: { ...nameSnapshot, ...discoveredNames },
    checkedProtocols: [...new Set([...existing, ...screened.checkedProtocols, ...completedIds])].slice(-20000),
  };
}

export function selfTest() {
  const csv = 'CNPJ_Companhia;Codigo_CVM;Nome_Companhia;Data_Entrega;Categoria;Tipo;Especie;Assunto;Protocolo_Entrega;Versao;Link_Download\n"00.000.000/0001-00";12345;EXEMPLO S.A.;12/10/2026;Comunicado ao Mercado;Comunicado;Texto;"IA generativa e nova plataforma para clientes";123IPE2026101201;1;https://www.rad.cvm.gov.br/doc.html';
  const parsed = parseDelimited(csv);
  const rows = normalizeIpeRows(parsed);
  if (rows.length !== 1 || rows[0].issuerCode !== '12345' || rows[0].delivered !== '2026-10-12') throw new Error('CVM IPE index parse failed');
  const hits = findAiEvidence('A companhia lançou uma plataforma de inteligência artificial para clientes corporativos.');
  if (!hits.length) throw new Error('Portuguese AI business phrase failed');
  if (findAiEvidence('A companhia descreveu apenas riscos e incerteza de inteligência artificial.').length) throw new Error('business-context filter failed');
  const lead = createLeads([{ ...rows[0], delivered: '2026-10-12' }], {}, { from: '2026-10-12', to: '2026-10-12' });
  if (lead.leads.length !== 1 || lead.leads[0].leadType !== 'AI wording in filing metadata') throw new Error('metadata lead generation failed');
  const prior = { '00.000.000/0001-00': 'EXEMPLO S.A.' };
  const renamed = createLeads([{ ...rows[0], company: 'EXEMPLO AI S.A.', subject: '', category: 'Alteração do nome empresarial' }], prior, { from: '2026-10-12', to: '2026-10-12' });
  if (!renamed.leads.length || renamed.leads[0].leadType !== 'legal-name candidate') throw new Error('AI name change lead failed');
  if (createLeads([{ ...rows[0], subject: 'IA generativa para clientes' }], {}, { from: '2026-10-12', to: '2026-10-12', knownProtocols: ['123IPE2026101201-v1'] }).leads.length) throw new Error('duplicate filing should be suppressed');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const value = key => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : null; };
  if (args.includes('--self-test')) { selfTest(); console.log('Brazil CVM screen self-tests passed'); return; }
  const now = new Date();
  const end = value('--to') ?? now.toISOString().slice(0, 10);
  const start = value('--from') ?? new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error('from and to must be ordered YYYY-MM-DD dates');
  const year = Number(value('--year') ?? end.slice(0, 4));
  const feedPath = resolve(value('--feed') ?? 'public/brazil-cvm-ai-watch.json');
  let feed = { leads: [], companyNames: {}, checkedProtocols: [] };
  try { feed = JSON.parse(await readFile(feedPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const output = await scan({ feed, year, from: start, to: end, maxDocs: Number(value('--max-docs') ?? 500) });
  await writeFile(feedPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`CVM IPE scan completed: ${output.scanStats.candidateLeads} leads, ${output.scanStats.readableDocuments} readable documents of ${output.scanStats.selectedDocuments} selected.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error); process.exitCode = 1; });
