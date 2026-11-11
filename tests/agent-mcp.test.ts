import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CalasApi, connectionSettings } from '../apps/mcp/src/api';

const token = 'calas_' + 'a'.repeat(43);
const mcpRequire = createRequire(new URL('../apps/mcp/package.json', import.meta.url));

test('configuration MCP refuse transport distant en clair, URL ambiguë et secret invalide', () => {
  for (const url of ['http://example.com', 'https://user:password@example.com', 'https://example.com/admin', 'https://example.com/?key=secret', 'file:///tmp/foo']) {
    assert.throws(() => connectionSettings({ CALAS_MCP_URL: url, CALAS_MCP_TOKEN: token }));
  }
  assert.throws(() => connectionSettings({ CALAS_MCP_URL: 'https://example.com', CALAS_MCP_TOKEN: '' }));
  assert.equal(connectionSettings({ CALAS_MCP_URL: 'https://example.com', CALAS_MCP_TOKEN: token }).endpoint.pathname, '/api/agent/tools/');
});

test('vrai échange MCP stdio : découverte, schéma, appel HTTPS simulé localement et erreurs sans secrets', { timeout: 30_000 }, async () => {
  const requests: Record<string, unknown>[] = [];
  let rejected = false;
  const server = createServer(async (request, response) => {
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    assert.equal(request.headers.cookie, undefined);
    assert.equal(request.url, '/api/agent/tools/');
    response.setHeader('content-type', 'application/json');
    if (request.method === 'GET') { response.end(JSON.stringify({ tools: [{ name: 'calas_identity', description: 'Identité de recette',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } }] })); return; }
    const bytes = []; for await (const chunk of request) bytes.push(chunk);
    requests.push(JSON.parse(Buffer.concat(bytes).toString()));
    if (rejected) { response.statusCode = 401; response.end(JSON.stringify({ error: { message: token } })); }
    else response.end(JSON.stringify({ result: { name: 'Recette', role: 'editor' } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const { Client } = await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client')).href);
  const { StdioClientTransport } = await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client/stdio')).href);
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('../apps/mcp/dist/index.mjs', import.meta.url))],
    env: { CALAS_MCP_URL: url, CALAS_MCP_TOKEN: token }, stderr: 'pipe' });
  let diagnostics = ''; transport.stderr?.on('data', (chunk: Buffer) => { diagnostics += chunk.toString(); });
  const client = new Client({ name: 'calas-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const listed = await client.listTools(); assert.equal(listed.tools.length, 1);
    const result = await client.callTool({ name: 'calas_identity', arguments: {} });
    assert.deepEqual(JSON.parse(result.content[0].text), { name: 'Recette', role: 'editor' });
    assert.deepEqual(requests, [{ name: 'calas_identity', arguments: {} }]);
    rejected = true;
    const denied = await client.callTool({ name: 'calas_identity', arguments: {} });
    assert.equal(denied.isError, true); assert(!JSON.stringify(denied).includes(token));
    const invalid = await client.callTool({ name: 'calas_identity', arguments: { unexpected: true } });
    assert.equal(invalid.isError, true); assert.equal(requests.length, 2);
    assert(!diagnostics.includes(token));
  } finally { await client.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('le connecteur ne suit pas une redirection contenant le bearer', async () => {
  const server = createServer((_, response) => { response.writeHead(302, { location: 'https://example.com/collect' }); response.end(); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  try {
    const api = new CalasApi(connectionSettings({ CALAS_MCP_URL: `http://127.0.0.1:${address.port}`, CALAS_MCP_TOKEN: token }));
    await assert.rejects(api.tools(), error => error instanceof Error && !error.message.includes(token) && !error.message.includes('collect'));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
