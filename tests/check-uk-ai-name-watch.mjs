import assert from 'node:assert/strict';
import { basicAuth, leadFromStreamEvent, parseStreamText, readCompanyStream } from '../automation/uk-ai-name-watch.mjs';

const makeEvent = ({ company = 'Example AI plc', previous = 'Example Holdings plc', date = '2026-10-16', type = 'plc', changed = ['company_name', 'previous_company_names'] } = {}) => ({
  data: {
    company_number: '01234567', company_name: company, company_status: 'active', type,
    previous_company_names: [{ name: previous, effective_from: '2001-01-01', ceased_on: date }],
  },
  event: { type: 'changed', fields_changed: changed, published_at: `${date}T12:30:00`, timepoint: 721 },
  resource_id: '01234567', resource_kind: 'company-profile#company-profile', resource_uri: '/company/01234567',
});

const lead = leadFromStreamEvent(makeEvent(), { from: '2026-10-01', to: '2026-10-31' });
assert.equal(lead.company, 'Example AI plc');
assert.equal(lead.leadType, 'AI-branded legal-name change');
assert.equal(lead.evidenceSource, 'Companies House profile history');
assert.equal(lead.previousName, 'Example Holdings plc');
assert.equal(lead.changeDate, '2026-10-16');
assert.equal(lead.companyType, 'plc');
assert.match(lead.listingStatus, /not verified/i);
assert.equal(lead.streamTimepoint, 721);
assert.match(lead.registryUrl, /01234567/);

assert.equal(leadFromStreamEvent(makeEvent({ company: 'Artificial Intelligence Holdings plc' }))?.previousName, 'Example Holdings plc');
assert.equal(leadFromStreamEvent(makeEvent({ previous: 'Example AI Holdings plc' })), null, 'AI already in former name is not a newly introduced AI rename');
assert.equal(leadFromStreamEvent(makeEvent({ company: 'Example Holdings plc' })), null, 'non-AI current name is ignored');
assert.equal(leadFromStreamEvent(makeEvent({ date: '2025-01-01' }), { from: '2026-10-01', to: '2026-10-31' }), null, 'old renames are excluded');
assert.equal(leadFromStreamEvent(makeEvent({ changed: ['registered_office_address'] })), null, 'unrelated profile updates are ignored');
assert.equal(leadFromStreamEvent({ ...makeEvent(), resource_kind: 'filing-history#filing-history' }), null);
assert.equal(leadFromStreamEvent({ ...makeEvent(), event: { type: 'deleted' } }), null);

const parsed = parseStreamText(`${JSON.stringify(makeEvent())}\n${JSON.stringify(makeEvent({ company: 'Example plc' }))}\n{broken`, { from: '2026-10-01', to: '2026-10-31' });
assert.equal(parsed.leads.length, 1);
assert.equal(parsed.errors.length, 1);

assert.match(basicAuth('example-test-key'), /^Basic /);
assert.throws(() => basicAuth(''), /CH_API_KEY/);
let observedUrl, observedAuthorization;
const live = await readCompanyStream({ apiKey: 'test-api-key-123', timepoint: 700, maxEvents: 1, seconds: 2,
  from: '2026-10-01', to: '2026-10-31',
  fetchImpl: async (url, options) => {
    observedUrl = new URL(url); observedAuthorization = options.headers.Authorization;
    const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`${JSON.stringify(makeEvent())}\n`)); controller.close(); } });
    return new Response(body, { status: 200 });
  },
});
assert.equal(observedUrl.searchParams.get('timepoint'), '700');
assert.match(observedAuthorization, /^Basic /);
assert.equal(observedAuthorization.includes('test-api-key-123'), false, 'raw key is not sent in the header');
assert.equal(live.eventsRead, 1);
assert.equal(live.latestTimepoint, 721);
assert.equal(live.leads.length, 1);

console.log('UK Companies House AI name-watch checks passed');
