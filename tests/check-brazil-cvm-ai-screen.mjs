import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLeads, findAiEvidence, normalizeIpeRows, parseDelimited, scan, selfTest, unzipFiles } from '../automation/brazil-cvm-ai-screen.mjs';

function checksum(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [nameText, text] of entries) {
    const name = Buffer.from(nameText), data = Buffer.from(text, 'utf8'), crc = checksum(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30);
    locals.push(local, data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralBytes = Buffer.concat(centrals), centralOffset = offset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

assert.equal(selfTest(), true);
const indexText = await readFile(new URL('./fixtures/cvm-ipe-index-reconstructed.csv', import.meta.url), 'utf8');
const rows = normalizeIpeRows(parseDelimited(indexText));
assert.equal(rows.length, 1);
assert.equal(rows[0].protocol, '123IPE2026101201');
const extracted = unzipFiles(makeStoredZip([['ipe.csv', indexText]]));
assert.equal(extracted.length, 1);

const indexArchive = makeStoredZip([['ipe_cia_aberta_2026.csv', indexText]]);
const html = await readFile(new URL('./fixtures/cvm-ipe-document-reconstructed.html', import.meta.url), 'utf8');
const calls = [];
const fetchImpl = async url => {
  calls.push(String(url));
  const bytes = String(url).endsWith('.zip') ? indexArchive : Buffer.from(html);
  return {
    ok: true, status: 200,
    headers: { get: key => key.toLowerCase() === 'content-type' ? (String(url).endsWith('.zip') ? 'application/zip' : 'text/html; charset=utf-8') : null },
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  };
};
const result = await scan({ fetchImpl, year: 2026, from: '2026-10-12', to: '2026-10-12', feed: {}, maxDocs: 10 });
assert.equal(calls.length, 2);
assert.equal(result.scanStats.documentRequests, 1);
assert.equal(result.scanStats.readableDocuments, 1);
assert.equal(result.leads.length, 1);
assert.equal(result.leads[0].source, 'Brazil CVM IPE');
assert.match(result.leads[0].evidence[0].excerpt, /inteligência artificial/i);
assert.equal(result.checkedProtocols.length, 1);
const repeated = await scan({ fetchImpl, year: 2026, from: '2026-10-12', to: '2026-10-12', feed: result, maxDocs: 10 });
assert.equal(repeated.scanStats.selectedDocuments, 0, 'completed documents should not be re-downloaded');
assert.equal(findAiEvidence('Artificial intelligence product for customers').length > 0, true);
assert.equal(createLeads([{ ...rows[0], subject: 'Inteligência artificial para plataforma comercial' }], {}, { from: '2026-10-12', to: '2026-10-12' }).leads.length, 1);

// The official index may not be in date order. A capped scan must select the
// newest delivery, and issuer-name snapshots must use the latest dated row.
const shuffledIndex = [
  'CNPJ_Companhia;Codigo_CVM;Nome_Companhia;Data_Entrega;Categoria;Tipo;Especie;Assunto;Protocolo_Entrega;Versao;Link_Download',
  '"00.000.000/0001-00";12345;LATEST AI S.A.;12/10/2026;Comunicado ao Mercado;Comunicado;Texto;Atualização de plataforma;newest-protocol;1;https://www.rad.cvm.gov.br/newest.html',
  '"00.000.000/0001-00";12345;OLD EXAMPLE S.A.;10/10/2026;Comunicado ao Mercado;Comunicado;Texto;Informação operacional;older-protocol;1;https://www.rad.cvm.gov.br/older.html',
].join('\n');
const shuffledArchive = makeStoredZip([['ipe_cia_aberta_2026.csv', shuffledIndex]]);
const fetchedDocuments = [];
const shuffledFetch = async url => {
  const source = String(url);
  const bytes = source.endsWith('.zip')
    ? shuffledArchive
    : (fetchedDocuments.push(source), Buffer.from('<html><body>Plataforma de inteligência artificial para clientes e serviços comerciais.</body></html>'));
  return {
    ok: true, status: 200,
    headers: { get: key => key.toLowerCase() === 'content-type' ? (source.endsWith('.zip') ? 'application/zip' : 'text/html; charset=utf-8') : null },
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  };
};
const capped = await scan({ fetchImpl: shuffledFetch, year: 2026, from: '2026-10-10', to: '2026-10-12', feed: {}, maxDocs: 1 });
assert.deepEqual(fetchedDocuments, ['https://www.rad.cvm.gov.br/newest.html']);
assert.equal(capped.scanStats.selectedDocuments, 1);
assert.equal(capped.scanStats.truncated, true);
assert.equal(capped.companyNames['00.000.000/0001-00'], 'LATEST AI S.A.');
assert.equal(capped.leads[0].company, 'LATEST AI S.A.');
console.log('Brazil CVM AI screen tests passed');
