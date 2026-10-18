#!/usr/bin/env node
/**
 * UK Companies House live company-profile stream screen for legal name changes
 * that newly introduce AI wording. This produces review leads, not short calls.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const STREAM_URL = 'https://stream.companieshouse.gov.uk/companies';
const API_BASE = 'https://api.company-information.service.gov.uk/company';
const AI_NAME = /(?:\bartificial\s+intelligence\b|\bgenerative\s+ai\b|\bmachine\s+learning\b|\bai\b)/i;
const COMPANY_NUMBER = /^[A-Z0-9]{2,8}$/i;

function validDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) throw new Error(`${label} must be YYYY-MM-DD`);
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error(`${label} is not a valid date`);
  return value;
}

const companyUrl = number => `${API_BASE}/${encodeURIComponent(number)}`;

function newestPreviousName(profile) {
  const names = Array.isArray(profile?.previous_company_names) ? profile.previous_company_names : [];
  return names.filter(item => item?.name && /^\d{4}-\d{2}-\d{2}$/.test(item.ceased_on ?? ''))
    .sort((a, b) => b.ceased_on.localeCompare(a.ceased_on))[0] ?? null;
}

/** Parse one Companies House companyProfileStream record into a rename lead. */
export function leadFromStreamEvent(event, { from, to } = {}) {
  const data = event?.data;
  if (event?.resource_kind !== 'company-profile#company-profile' || event?.event?.type === 'deleted' || !data) return null;
  const changed = event?.event?.fields_changed;
  if (Array.isArray(changed) && changed.length && !changed.some(field => ['company_name', 'previous_company_names'].includes(field))) return null;
  const companyNumber = String(data.company_number ?? event.resource_id ?? '').toUpperCase();
  const company = String(data.company_name ?? '').trim();
  if (!COMPANY_NUMBER.test(companyNumber) || !company || !AI_NAME.test(company)) return null;
  const previous = newestPreviousName(data);
  if (!previous || AI_NAME.test(previous.name)) return null;
  const changeDate = previous.ceased_on;
  if (from && changeDate < from || to && changeDate > to) return null;
  return {
    source: 'Companies House company profile stream', market: 'United Kingdom',
    issuerId: companyNumber, company, previousName: previous.name, changeDate,
    companyType: data.type ?? '', companyStatus: data.company_status ?? '',
    listingStatus: 'Not verified. PLC status does not prove an exchange listing.',
    evidence: `Companies House records the previous name as “${previous.name}” through ${changeDate} and the current name as “${company}”.`,
    registryUrl: `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`,
    apiUrl: companyUrl(companyNumber), streamTimepoint: event.event?.timepoint ?? null,
    streamPublishedAt: event.event?.published_at ?? null, reviewedByHuman: false,
  };
}

/** Parse newline-delimited company-profile stream events. */
export function parseStreamText(text, options = {}) {
  const leads = [], errors = [];
  for (const [index, line] of String(text ?? '').split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); }
    catch { errors.push({ line: index + 1, message: 'Invalid JSON stream event' }); continue; }
    const lead = leadFromStreamEvent(event, options);
    if (lead) leads.push(lead);
  }
  return { leads, errors };
}

export function basicAuth(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8) throw new Error('Set CH_API_KEY to a Companies House API key. Registration and API access are free; this key is required for every stream request.');
  return `Basic ${Buffer.from(`${apiKey.trim()}:`).toString('base64')}`;
}

/** Consume a bounded portion of the live stream, stopping after the event cap or time limit. */
export async function readCompanyStream({ apiKey, timepoint, maxEvents = 1000, seconds = 45, fetchImpl = fetch, from, to } = {}) {
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 100000) throw new Error('maxEvents must be between 1 and 100000');
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 300) throw new Error('seconds must be between 0 and 300');
  const auth = basicAuth(apiKey);
  const url = new URL(STREAM_URL);
  if (timepoint !== undefined && timepoint !== null && timepoint !== '') {
    if (!/^\d+$/.test(String(timepoint))) throw new Error('timepoint must be a non-negative integer');
    url.searchParams.set('timepoint', String(timepoint));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('stream time limit reached')), seconds * 1000);
  const response = await fetchImpl(url, { headers: { Authorization: auth, Accept: 'application/json' }, signal: controller.signal });
  if (!response.ok) { clearTimeout(timer); throw new Error(`Companies House stream failed (${response.status})`); }
  if (!response.body) { clearTimeout(timer); throw new Error('Companies House stream response has no body'); }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', count = 0, latestTimepoint = timepoint ?? null;
  const lines = [];
  try {
    while (count < maxEvents) {
      let chunk;
      try { chunk = await reader.read(); }
      catch (error) { if (controller.signal.aborted) break; throw error; }
      const { value, done } = chunk;
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0 && count < maxEvents) {
        const line = pending.slice(0, newline).trim(); pending = pending.slice(newline + 1);
        if (!line) continue;
        let event;
        try { event = JSON.parse(line); } catch { throw new Error('Companies House stream returned malformed JSON'); }
        count++; lines.push(line);
        if (event?.event?.timepoint !== undefined) latestTimepoint = event.event.timepoint;
      }
    }
  } finally {
    clearTimeout(timer);
    try { await reader.cancel(); } catch { /* stream closed by cap or timer */ }
  }
  const parsed = parseStreamText(lines.join('\n'), { from, to });
  return { ...parsed, eventsRead: count, latestTimepoint };
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--input' || key === '--output' || key === '--from' || key === '--to' || key === '--timepoint' || key === '--max-events' || key === '--seconds') options[key.slice(2)] = args[++i];
    else if (key === '--help') options.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return options;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write('Usage: node automation/uk-ai-name-watch.mjs [--input stream.ndjson | live with CH_API_KEY] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--timepoint N] [--max-events N] [--seconds N] [--output leads.json]\nDefault date window is the last 30 days. Live mode requires a free Companies House API key.\n');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const from = args.from ? validDate(args.from, '--from') : thirtyDaysAgo;
  const to = args.to ? validDate(args.to, '--to') : today;
  if (from && to && from > to) throw new Error('--from must not be after --to');
  const options = { from, to };
  let result;
  if (args.input) result = { ...parseStreamText(await readFile(resolve(args.input), 'utf8'), options), eventsRead: undefined, latestTimepoint: undefined };
  else {
    result = await readCompanyStream({ apiKey: process.env.CH_API_KEY, timepoint: args.timepoint,
      maxEvents: Number(args['max-events'] ?? 1000), seconds: Number(args.seconds ?? 45), ...options });
  }
  const output = { source: 'Companies House company profile stream', generatedAt: new Date().toISOString(),
    coverage: 'UK companies registry updates observed during this stream connection. UK exchange listing is not determined.', ...result };
  const json = `${JSON.stringify(output, null, 2)}\n`;
  if (args.output) await writeFile(resolve(args.output), json);
  process.stdout.write(json);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
