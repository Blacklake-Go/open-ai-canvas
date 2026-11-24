import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useLocation } from 'react-router';
import StudioHeader from '@/components/site/StudioHeader';
import { SpatialBackground } from '@/components/spatial';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAuthRoutes } from '@/lib/authCopy';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { useDocumentTitle } from '@/pages/helpers/pageHelpers';
import DeveloperKeyPanel from './DeveloperKeyPanel';

const prefix = '/api/developer/v1';
const languages = ['cURL', 'Python', 'TypeScript'] as const;
type ExampleLanguage = (typeof languages)[number];
const endpoints = [
  ['GET', '/models', 'models'],
  ['GET', '/wallet', 'wallet'],
  ['POST', '/generations/quote', 'quote'],
  ['POST', '/generations', 'submit'],
  ['GET', '/generations/{id}', 'poll'],
  ['GET', '/generations/{id}/result', 'download'],
] as const;

function pythonExample(origin: string) {
  return `import json
import os
import time
from urllib.request import Request, urlopen

BASE_URL = ${JSON.stringify(origin + prefix)}
token = os.environ["SUPDANCE_API_KEY"]
request_id = os.environ["SUPDANCE_REQUEST_ID"]
max_credits = int(os.environ["SUPDANCE_MAX_CREDITS"])

def call(path, body=None, suffix=None):
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    if suffix:
        headers.update({
            "Content-Type": "application/json",
            "Idempotency-Key": request_id + suffix,
        })
    data = json.dumps(body).encode() if body is not None else None
    with urlopen(Request(BASE_URL + path, headers=headers, data=data), timeout=30) as response:
        return json.load(response)

inputs = {
    "modelId": os.environ["SUPDANCE_MODEL_ID"],
    "parameters": {"prompt": "A ceramic cup on a sunlit table"},
}
quote = call("/generations/quote", inputs, "-quote")
if quote["credits"] > max_credits:
    raise SystemExit("Quote exceeds the credit limit")

task = call("/generations", {**inputs, "quoteId": quote["quoteId"]}, "-task")
print("Task:", task["id"], flush=True)
for _ in range(60):
    result = call("/generations/" + task["id"])
    if result["status"] in {"succeeded", "failed", "canceled", "cancelled"}:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        break
    time.sleep(5)
else:
    print("Still running. Query this task ID to check its status.")
`;
}

function curlExample(origin: string) {
  return `#!/bin/sh
# Requires curl and jq.
set -eu
base=${JSON.stringify(origin + prefix)}
inputs=$(jq -n --arg model "$SUPDANCE_MODEL_ID" \\
  '{modelId:$model,parameters:{prompt:"A ceramic cup on a sunlit table"}}')
post() {
  curl --fail-with-body -sS --max-time 30 \\
    -H "Authorization: Bearer $SUPDANCE_API_KEY" \\
    -H "Idempotency-Key: $SUPDANCE_REQUEST_ID-$2" \\
    -H 'Content-Type: application/json' -d "$3" "$base/$1"
}
quote=$(post generations/quote quote "$inputs")
credits=$(printf '%s' "$quote" | jq -er '.credits')
[ "$credits" -le "$SUPDANCE_MAX_CREDITS" ] || { echo "Quote exceeds the credit limit" >&2; exit 1; }
request=$(printf '%s' "$quote" | jq --argjson inputs "$inputs" '$inputs + {quoteId}')
task=$(post generations task "$request")
id=$(printf '%s' "$task" | jq -er '.id')
printf 'Task: %s\\n' "$id"
attempt=0
while [ "$attempt" -lt 60 ]; do
  result=$(curl --fail-with-body -sS --max-time 30 \\
    -H "Authorization: Bearer $SUPDANCE_API_KEY" "$base/generations/$id")
  case $(printf '%s' "$result" | jq -er '.status') in
    succeeded|failed|canceled|cancelled) printf '%s\\n' "$result"; exit 0 ;;
  esac
  attempt=$((attempt + 1))
  sleep 5
done
echo 'Still running. Query this task ID to check its status.'
`;
}

function typescriptExample(origin: string) {
  return `// Run as a server-side TypeScript module.
const BASE_URL = ${JSON.stringify(origin + prefix)};
function setting(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("Missing " + name);
  return value;
}
const token = setting("SUPDANCE_API_KEY");
const requestId = setting("SUPDANCE_REQUEST_ID");
const maxCredits = Number(setting("SUPDANCE_MAX_CREDITS"));
if (!Number.isSafeInteger(maxCredits) || maxCredits < 0) throw new Error("Invalid credit limit");

async function call<T>(path: string, body?: object, suffix?: string): Promise<T> {
  const headers = new Headers({ Authorization: "Bearer " + token });
  if (suffix) {
    headers.set("Content-Type", "application/json");
    headers.set("Idempotency-Key", requestId + suffix);
  }
  const response = await fetch(BASE_URL + path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

const inputs = {
  modelId: setting("SUPDANCE_MODEL_ID"),
  parameters: { prompt: "A ceramic cup on a sunlit table" },
};
const quote = await call<{ quoteId: string; credits: number }>("/generations/quote", inputs, "-quote");
if (quote.credits > maxCredits) throw new Error("Quote exceeds the credit limit");
const task = await call<{ id: string }>("/generations", { ...inputs, quoteId: quote.quoteId }, "-task");
console.log("Task:", task.id);
for (let attempt = 0; attempt < 60; attempt++) {
  const result = await call<{ status: string }>("/generations/" + task.id);
  if (["succeeded", "failed", "canceled", "cancelled"].includes(result.status)) {
    console.log(result);
    break;
  }
  await new Promise(resolve => setTimeout(resolve, 5000));
}
`;
}

const exampleFactories = { cURL: curlExample, Python: pythonExample, TypeScript: typescriptExample };

export default function DeveloperPlatform() {
  const t = useTranslations('developer');
  const locale = useLocale();
  const { user } = useUserSession();
  const { pathname, search } = useLocation();
  const [copyStatus, setCopyStatus] = useState('');
  const [language, setLanguage] = useState<ExampleLanguage>('Python');
  useDocumentTitle(`${t('title')} — SupDance`);
  const returnTo = encodeURIComponent(`${pathname}${search}#api-key`);
  const login = `${getAuthRoutes(locale).loginUrl}?redirect=${returnTo}`;
  const origin = window.location.origin;
  const code = exampleFactories[language](origin);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('copyError');
    }
  }

  return (
    <div className="relative isolate min-h-screen bg-base text-ink">
      <SpatialBackground variant="minimal" />
      <StudioHeader locale={locale} activeTab="call-api" className="relative z-40" />
      <main className="relative mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-8 sm:py-16">
        <header className="grid gap-3">
          <h1 className="text-page-title text-ink">{t('title')}</h1>
          <p className="max-w-2xl text-body text-ink-muted">{t('intro')}</p>
          <code className="break-all font-mono text-body-sm text-ink-muted">{origin + prefix}</code>
        </header>
        <Card className="grid gap-4 p-4 sm:p-6">
          <section id="api-key" aria-labelledby="developer-key-heading" className="grid scroll-mt-28 gap-4">
            <h2 id="developer-key-heading" className="text-section-title">{t('keys')}</h2>
            <p className="text-body text-ink-muted">{t('keyHelp')}</p>
            {user?.id ? (
              <DeveloperKeyPanel key={String(user.id)} owner={String(user.id)} />
            ) : (
              <Button size="lg" variant="primary" asChild className="justify-self-start">
                <Link href={login}>{t('login')}</Link>
              </Button>
            )}
          </section>
        </Card>
        <Card className="min-w-0 p-4 sm:p-6">
          <section aria-labelledby="developer-example-heading" className="grid min-w-0 gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="developer-example-heading" className="text-section-title">{t('quickstart')}</h2>
              <Button size="lg" onClick={() => void copyCode()}>{t('copyCode')}</Button>
            </div>
            <p className="text-body text-ink-muted">{t('exampleSetup')}</p>
            <Tabs value={language} className="min-w-0" onValueChange={(value: ExampleLanguage) => {
              setLanguage(value);
              setCopyStatus('');
            }}>
              <TabsList aria-label={t('quickstart')} className="min-h-control-lg">
                {languages.map(name => (
                  <TabsTrigger value={name} key={name} className="min-h-control-lg">{name}</TabsTrigger>
                ))}
              </TabsList>
              {languages.map(name => (
                <TabsContent value={name} key={name} className="min-w-0">
                  <pre tabIndex={0} aria-label={name} className="max-w-full overflow-x-auto rounded-lg border border-line-subtle bg-well p-4 text-body-sm control-focus">
                    <code>{name === language ? code : ''}</code>
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
            {copyStatus && <p role="status" className="text-ink-muted">{t(copyStatus)}</p>}
          </section>
        </Card>
        <Card className="p-4 sm:p-6">
          <section aria-labelledby="developer-routes-heading" className="grid gap-3">
            <h2 id="developer-routes-heading" className="text-section-title">{t('endpoints')}</h2>
            <p className="text-body text-ink-muted">{t('authHeader')} <code>Authorization: Bearer &lt;token&gt;</code></p>
            <dl className="divide-y divide-line-subtle">
              {endpoints.map(([method, path, label]) => (
                <div key={method + path} className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
                  <dt className="break-all font-mono text-body-sm text-ink">{method} {path}</dt>
                  <dd className="text-body-sm text-ink-muted">{t(label)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Card>
      </main>
    </div>
  );
}
