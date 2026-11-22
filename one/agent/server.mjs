import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_SCRIPT = join(__dirname, 'agent-runtime.mjs');
const TEMP_PREFIX = 'agent-runtime-';

export function isValidConfiguredToken(token) {
  return typeof token === 'string' && token.length >= 32;
}

export function verifyBearerHeader(authHeader, expectedToken) {
  if (!isValidConfiguredToken(expectedToken)) {
    return false;
  }
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const provided = authHeader.slice('Bearer '.length);
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expectedToken, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function readJSONBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function writeJSON(res, statusCode, payload) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

export function createAgentServer({
  token = process.env.ONE_AGENT_TOKEN || '',
  maxConcurrent = Number.parseInt(process.env.ONE_AGENT_MAX_CONCURRENT || '4', 10) || 4,
  killGraceMs = Number.parseInt(process.env.ONE_AGENT_KILL_GRACE_MS || '5000', 10) || 5000,
  tempBaseDir = tmpdir(),
} = {}) {
  if (!isValidConfiguredToken(token)) {
    throw new Error('ONE_AGENT_TOKEN must be at least 32 characters');
  }

  let limit = Math.max(1, Math.min(64, maxConcurrent));
  const activeChildren = new Set();
  const activeWorkspaces = new Set();

  function cleanupWorkspace(dir) {
    if (!dir) return;
    activeWorkspaces.delete(dir);
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  function cleanupAllWorkspaces() {
    for (const dir of [...activeWorkspaces]) {
      cleanupWorkspace(dir);
    }
  }

  function terminateChildWithEscalation(child) {
    if (!child || child.exitCode !== null || child.killed) return;
    try {
      child.kill('SIGTERM');
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      if (child.exitCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
    }, killGraceMs);
    timer.unref();
    child.once('exit', () => clearTimeout(timer));
  }

  const server = http.createServer(async (req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (req.method === 'GET' && urlPath === '/healthz') {
      writeJSON(res, 200, {
        ok: true,
        activeRuns: activeChildren.size,
        maxConcurrent: limit,
        workspaces: activeWorkspaces.size,
      });
      return;
    }

    if (!verifyBearerHeader(req.headers.authorization, token)) {
      writeJSON(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (req.method === 'PUT' && urlPath === '/v1/limit') {
      try {
        const body = await readJSONBody(req);
        const nextLimit = Number(body.maxConcurrent);
        if (!Number.isInteger(nextLimit) || nextLimit < 1 || nextLimit > 64) {
          writeJSON(res, 400, { error: 'maxConcurrent must be an integer between 1 and 64' });
          return;
        }
        limit = nextLimit;
        writeJSON(res, 200, { ok: true, maxConcurrent: limit });
      } catch (err) {
        writeJSON(res, err.statusCode || 400, { error: err.message });
      }
      return;
    }

    if (req.method === 'POST' && urlPath === '/v1/runs') {
      if (activeChildren.size >= limit) {
        writeJSON(res, 429, {
          error: 'Agent concurrency limit reached',
          activeRuns: activeChildren.size,
          maxConcurrent: limit,
        });
        return;
      }

      let body;
      try {
        body = await readJSONBody(req);
      } catch (err) {
        writeJSON(res, err.statusCode || 400, { error: err.message });
        return;
      }

      if (!body.bridgeUrl || !body.bridgeToken) {
        writeJSON(res, 400, { error: 'bridgeUrl and bridgeToken are required' });
        return;
      }

      const workspaceDir = mkdtempSync(join(tempBaseDir, TEMP_PREFIX));
      activeWorkspaces.add(workspaceDir);

      const childEnv = {
        ...process.env,
        PI_OFFLINE: '1',
        ONE_AGENT_WORKSPACE_DIR: workspaceDir,
      };
      if (body.ignoreSigtermForTest) {
        childEnv.ONE_AGENT_IGNORE_SIGTERM = '1';
      }

      const child = spawn(process.execPath, [RUNTIME_SCRIPT], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: childEnv,
      });
      activeChildren.add(child);

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });

      let finished = false;
      const finalize = (statusCode, payload) => {
        if (finished) return;
        finished = true;
        activeChildren.delete(child);
        cleanupWorkspace(workspaceDir);
        writeJSON(res, statusCode, payload);
      };

      // Client disconnect (before response ends) triggers SIGTERM -> killGraceMs SIGKILL escalation
      res.once('close', () => {
        if (!finished && !res.writableFinished) {
          terminateChildWithEscalation(child);
        }
      });

      child.once('error', (err) => {
        finalize(500, { ok: false, error: err.message });
      });

      child.once('exit', (code, signal) => {
        if (finished) return;
        if (code === 0) {
          let parsed = null;
          try {
            parsed = stdout.trim() ? JSON.parse(stdout.trim()) : { ok: true };
          } catch {
            parsed = { ok: true, rawOutput: stdout.trim() };
          }
          finalize(200, parsed);
          return;
        }
        finalize(500, {
          ok: false,
          code,
          signal,
          error: stderr.trim() || `runtime exited with code=${code} signal=${signal}`,
        });
      });

      child.stdin.write(
        JSON.stringify({
          ...body,
          workspaceDir,
        }),
      );
      child.stdin.end();
      return;
    }

    writeJSON(res, 404, { error: 'Not Found' });
  });

  function shutdown() {
    for (const child of activeChildren) {
      terminateChildWithEscalation(child);
    }
    cleanupAllWorkspaces();
    return new Promise((resolve) => server.close(resolve));
  }

  return {
    server,
    shutdown,
    cleanupAllWorkspaces,
    getActiveWorkspacesCount: () => activeWorkspaces.size,
    getActiveRunsCount: () => activeChildren.size,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT || '8090', 10);
  const host = process.env.HOST || '0.0.0.0';
  const instance = createAgentServer();

  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, async () => {
      await instance.shutdown();
      process.exit(0);
    });
  }

  instance.server.listen(port, host, () => {
    console.log(`one-agent listening on http://${host}:${port}`);
  });
}
