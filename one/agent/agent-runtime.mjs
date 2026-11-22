import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

async function callBridge(bridgeUrl, bridgeToken, path, body) {
  const res = await fetch(`${bridgeUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bridgeToken}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Bridge ${path} failed with HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function readStdinPayload() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    process.stdin.on('error', reject);
  });
}

async function emitEventBestEffort(bridgeUrl, bridgeToken, body) {
  if (!bridgeUrl || !bridgeToken) return;
  try {
    await callBridge(bridgeUrl, bridgeToken, '/event', body);
  } catch {
    // Best-effort failure telemetry; exit status still reflects the failure.
  }
}

async function run() {
  if (process.env.ONE_AGENT_IGNORE_SIGTERM === '1') {
    process.on('SIGTERM', () => {
      // Test hook for verifying 5s SIGKILL escalation.
    });
  } else {
    process.on('SIGTERM', () => {
      process.exit(143);
    });
  }

  const payload = await readStdinPayload();
  const {
    runId = 'run_default',
    bridgeUrl,
    bridgeToken,
    workspaceDir,
    prompt = '',
    systemPrompt = '',
    model = {},
    tools = [],
    messages: initialMessages,
    toolCalls = [],
    simulateHangMs = 0,
  } = payload;

  if (!bridgeUrl || !bridgeToken) {
    throw new Error('bridgeUrl and bridgeToken are required');
  }

  const maxTurns = Number.isInteger(payload.maxTurns)
    ? Math.min(Math.max(payload.maxTurns, 1), 16)
    : 8;

  try {
    if (workspaceDir) {
      mkdirSync(join(workspaceDir, 'work'), { recursive: true });
    }

    if (simulateHangMs > 0) {
      await callBridge(bridgeUrl, bridgeToken, '/event', {
        runId,
        type: 'run.started',
        data: { status: 'hanging_for_cancel_test' },
      });
      await new Promise((resolve) => setTimeout(resolve, simulateHangMs));
      return;
    }

    await callBridge(bridgeUrl, bridgeToken, '/event', {
      runId,
      type: 'run.started',
      data: { prompt, maxTurns },
    });

    const messages = Array.isArray(initialMessages) && initialMessages.length > 0
      ? [...initialMessages]
      : [{ role: 'user', content: prompt }];

    const toolResults = [];
    let lastModelResp = null;
    let turns = 0;
    let maxTurnsReached = false;

    for (let turn = 1; turn <= maxTurns; turn += 1) {
      turns = turn;
      const modelResp = await callBridge(bridgeUrl, bridgeToken, '/model', {
        runId,
        turn,
        prompt,
        systemPrompt,
        model,
        tools,
        messages,
      });
      lastModelResp = modelResp;

      const modelCalls = Array.isArray(modelResp?.toolCalls) ? modelResp.toolCalls : [];
      const turnCalls = modelCalls.length > 0
        ? modelCalls
        : (turn === 1 && Array.isArray(toolCalls) ? toolCalls : []);

      const assistantText = modelResp?.content ?? modelResp?.text ?? '';
      if (turnCalls.length === 0) {
        if (assistantText) {
          messages.push({ role: 'assistant', content: assistantText });
        }
        break;
      }

      messages.push({
        role: 'assistant',
        content: assistantText,
        toolCalls: turnCalls,
      });

      for (const call of turnCalls) {
        await callBridge(bridgeUrl, bridgeToken, '/event', {
          runId,
          type: 'tool.called',
          data: {
            turn,
            tool: call.tool,
            args: call.args || {},
          },
        });

        const toolResp = await callBridge(bridgeUrl, bridgeToken, '/tool', {
          runId,
          turn,
          tool: call.tool,
          callId: call.id || null,
          args: call.args || {},
        });

        if (toolResp && toolResp.pause === true) {
          await callBridge(bridgeUrl, bridgeToken, '/event', {
            runId,
            type: 'run.paused',
            data: {
              reason: toolResp.reason || 'awaiting_approval',
              approvalId: toolResp.approvalId || null,
              tool: call.tool,
              turn,
            },
          });
          process.stdout.write(
            JSON.stringify({
              ok: true,
              status: 'paused',
              turns,
              approvalId: toolResp.approvalId || null,
              modelResp: lastModelResp,
              toolResults,
              messages,
            }) + '\n',
          );
          return;
        }

        toolResults.push({
          turn,
          tool: call.tool,
          id: call.id || null,
          result: toolResp,
        });
        messages.push({
          role: 'tool',
          tool: call.tool,
          toolCallId: call.id || null,
          content: typeof toolResp === 'string' ? toolResp : JSON.stringify(toolResp ?? {}),
        });
      }

      if (turn === maxTurns) {
        maxTurnsReached = true;
      }
    }

    await callBridge(bridgeUrl, bridgeToken, '/event', {
      runId,
      type: 'run.completed',
      data: {
        turns,
        toolCount: toolResults.length,
        maxTurnsReached,
      },
    });

    process.stdout.write(
      JSON.stringify({
        ok: true,
        status: 'completed',
        turns,
        maxTurnsReached,
        modelResp: lastModelResp,
        toolResults,
        messages,
      }) + '\n',
    );
  } catch (err) {
    await emitEventBestEffort(bridgeUrl, bridgeToken, {
      runId,
      type: 'run.failed',
      data: {
        error: (err && err.message) || String(err),
      },
    });
    throw err;
  }
}

run().catch((err) => {
  process.stderr.write((err && err.stack) || String(err));
  if (process.env.ONE_AGENT_WORKSPACE_DIR) {
    try {
      rmSync(process.env.ONE_AGENT_WORKSPACE_DIR, { recursive: true, force: true });
    } catch {
      // ignore cleanup error on crash
    }
  }
  process.exit(1);
});
