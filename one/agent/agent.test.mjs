import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentServer, verifyBearerHeader } from './server.mjs';

const TEST_TOKEN = '0123456789abcdef0123456789abcdef'; // 32 chars

function listenEphemeral(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ port: addr.port, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function createMockBridge({ pauseOnTool = false } = {}) {
  const events = [];
  const bridgeToken = 'bridge-secret-token-32chars-min!!';
  const server = http.createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${bridgeToken}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      const url = req.url;
      if (url === '/event') {
        events.push(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (url === '/model') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, content: `model reply to: ${body.prompt}` }));
        return;
      }
      if (url === '/tool') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (pauseOnTool) {
          res.end(JSON.stringify({ pause: true, approvalId: 'apr_test_001' }));
        } else {
          res.end(JSON.stringify({ ok: true, output: 'tool-executed' }));
        }
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  return { server, bridgeToken, events };
}

test('rejects short configured tokens and verifies Bearer timing-safely', () => {
  assert.throws(() => createAgentServer({ token: 'short-token' }), /at least 32/);
  assert.equal(verifyBearerHeader(`Bearer ${TEST_TOKEN}`, TEST_TOKEN), true);
  assert.equal(verifyBearerHeader('Bearer wrong-length', TEST_TOKEN), false);
  assert.equal(verifyBearerHeader(undefined, TEST_TOKEN), false);
});

test('healthz, auth rejection, PUT /v1/limit, and bridge callback + pause approval flow', async () => {
  const workRoot = mkdtempSync(join(tmpdir(), 'one-agent-test-'));
  const agent = createAgentServer({ token: TEST_TOKEN, maxConcurrent: 2, tempBaseDir: workRoot });
  const bridge = createMockBridge({ pauseOnTool: true });

  try {
    const { baseUrl } = await listenEphemeral(agent.server);
    const { baseUrl: bridgeUrl } = await listenEphemeral(bridge.server);

    const health = await fetch(`${baseUrl}/healthz`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.equal(health.maxConcurrent, 2);

    const unauth = await fetch(`${baseUrl}/v1/limit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxConcurrent: 3 }),
    });
    assert.equal(unauth.status, 401);

    const setLimit = await fetch(`${baseUrl}/v1/limit`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ maxConcurrent: 3 }),
    });
    assert.equal(setLimit.status, 200);
    assert.equal((await setLimit.json()).maxConcurrent, 3);

    const runRes = await fetch(`${baseUrl}/v1/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({
        runId: 'run_pause_1',
        bridgeUrl,
        bridgeToken: bridge.bridgeToken,
        prompt: 'generate storyboard',
        toolCalls: [{ tool: 'spend_credits', args: { amount: 50 } }],
      }),
    });
    assert.equal(runRes.status, 200);
    const runBody = await runRes.json();
    assert.equal(runBody.status, 'paused');
    assert.equal(runBody.approvalId, 'apr_test_001');
    assert.ok(bridge.events.some((e) => e.type === 'run.paused' && e.data.approvalId === 'apr_test_001'));

    // Temp workspace cleaned up after run completes
    assert.deepEqual(readdirSync(workRoot), []);
  } finally {
    await agent.shutdown();
    await new Promise((r) => bridge.server.close(r));
    rmSync(workRoot, { recursive: true, force: true });
  }
});

test('concurrency limit returns 429 and disconnect escalates SIGTERM to SIGKILL + cleans /tmp', async () => {
  const workRoot = mkdtempSync(join(tmpdir(), 'one-agent-cancel-'));
  const agent = createAgentServer({
    token: TEST_TOKEN,
    maxConcurrent: 1,
    killGraceMs: 120, // fast escalation test
    tempBaseDir: workRoot,
  });
  const bridge = createMockBridge({ pauseOnTool: false });

  try {
    const { port, baseUrl } = await listenEphemeral(agent.server);
    const { baseUrl: bridgeUrl } = await listenEphemeral(bridge.server);

    // Open raw socket request that hangs inside child ignoring SIGTERM, then drop socket
    const payload = JSON.stringify({
      runId: 'run_hang_1',
      bridgeUrl,
      bridgeToken: bridge.bridgeToken,
      prompt: 'hang',
      simulateHangMs: 15000,
      ignoreSigtermForTest: true,
    });

    await new Promise((resolve) => {
      const sock = net.connect(port, '127.0.0.1', () => {
        sock.write(
          `POST /v1/runs HTTP/1.1\r\n` +
            `Host: 127.0.0.1:${port}\r\n` +
            `Authorization: Bearer ${TEST_TOKEN}\r\n` +
            `Content-Type: application/json\r\n` +
            `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n` +
            payload,
        );
      });
      // Wait briefly until bridge receives run.started so child is running
      const poll = setInterval(async () => {
        if (bridge.events.some((e) => e.type === 'run.started')) {
          clearInterval(poll);
          // Second concurrent run should receive 429
          const r2 = await fetch(`${baseUrl}/v1/runs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${TEST_TOKEN}`,
            },
            body: JSON.stringify({
              runId: 'run_overflow',
              bridgeUrl,
              bridgeToken: bridge.bridgeToken,
              prompt: 'second',
            }),
          });
          assert.equal(r2.status, 429);
          sock.destroy();
          resolve();
        }
      }, 25);
    });

    // Wait past killGraceMs for SIGKILL + workspace cleanup
    await new Promise((r) => setTimeout(r, 350));
    assert.equal(agent.getActiveRunsCount(), 0);
    assert.deepEqual(readdirSync(workRoot), []);
  } finally {
    await agent.shutdown();
    await new Promise((r) => bridge.server.close(r));
    rmSync(workRoot, { recursive: true, force: true });
  }
});

test('multi-turn ReAct loop appends tool messages and enforces maxTurns budget', async () => {
  const workRoot = mkdtempSync(join(tmpdir(), 'one-agent-react-'));
  const agent = createAgentServer({ token: TEST_TOKEN, maxConcurrent: 2, tempBaseDir: workRoot });

  const bridgeToken = 'react-bridge-secret-32chars-min!!';
  const modelTurns = [];
  const events = [];
  const bridgeServer = http.createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${bridgeToken}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      if (req.url === '/event') {
        events.push(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.url === '/model') {
        modelTurns.push({ turn: body.turn, messagesCount: (body.messages || []).length });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (body.runId === 'run_react_ok' && body.turn === 1) {
          res.end(
            JSON.stringify({
              ok: true,
              content: 'Let me inspect the canvas plan.',
              toolCalls: [{ id: 'tc_1', tool: 'canvas_plan', args: { tool: 'upscale' } }],
            }),
          );
          return;
        }
        if (body.runId === 'run_react_ok' && body.turn === 2) {
          res.end(JSON.stringify({ ok: true, content: 'Final storyboard plan ready.' }));
          return;
        }
        // Infinite tool caller to exercise maxTurns budget
        res.end(
          JSON.stringify({
            ok: true,
            content: `loop turn ${body.turn}`,
            toolCalls: [{ id: `tc_${body.turn}`, tool: 'echo_step', args: { turn: body.turn } }],
          }),
        );
        return;
      }
      if (req.url === '/tool') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, echoed: body.args }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });

  try {
    const { baseUrl } = await listenEphemeral(agent.server);
    const { baseUrl: bridgeUrl } = await listenEphemeral(bridgeServer);

    const res1 = await fetch(`${baseUrl}/v1/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({
        runId: 'run_react_ok',
        bridgeUrl,
        bridgeToken,
        prompt: 'Plan an upscale',
        maxTurns: 4,
      }),
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.status, 'completed');
    assert.equal(body1.turns, 2);
    assert.equal(body1.maxTurnsReached, false);
    assert.equal(body1.toolResults.length, 1);
    assert.ok(body1.messages.some((m) => m.role === 'tool' && m.tool === 'canvas_plan'));
    assert.equal(body1.messages[body1.messages.length - 1].content, 'Final storyboard plan ready.');
    assert.deepEqual(modelTurns, [
      { turn: 1, messagesCount: 1 },
      { turn: 2, messagesCount: 3 },
    ]);
    assert.ok(events.some((e) => e.type === 'tool.called' && e.data.tool === 'canvas_plan'));

    const res2 = await fetch(`${baseUrl}/v1/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({
        runId: 'run_react_budget',
        bridgeUrl,
        bridgeToken,
        prompt: 'loop forever',
        maxTurns: 2,
      }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.status, 'completed');
    assert.equal(body2.turns, 2);
    assert.equal(body2.maxTurnsReached, true);
    assert.equal(body2.toolResults.length, 2);
  } finally {
    await agent.shutdown();
    await new Promise((r) => bridgeServer.close(r));
    rmSync(workRoot, { recursive: true, force: true });
  }
});
