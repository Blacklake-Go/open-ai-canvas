#!/usr/bin/env python3
"""Generate the public pricing HTML snapshot from the reviewed Lark document."""

import html
import json
import re
import shutil
import subprocess
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


DOCUMENT_ID = "TDGPdDZwZooWnHxqha7juh3gpHJ"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "pricing.html"
PRIVATE = re.compile(r"内部|上游|成本|毛利|返佣|IMPORTRANGE|SECRET_")
USD_CNY_RATE = Decimal("6.67421")
RATE_TIMESTAMP = "2026-11-04 18:27 UTC"
RATE_SOURCE = "https://www.xe.com/en-us/currencyconverter/convert/?Amount=1&From=USD&To=CNY"


def usd_price(cell, precision):
    match = re.fullmatch(r"¥([\d,]+(?:\.\d+)?)", cell)
    if not match:
        raise ValueError(f"Expected a CNY price: {cell}")
    cny = Decimal(match.group(1).replace(",", ""))
    quantum = Decimal("1").scaleb(-precision)
    usd = (cny / USD_CNY_RATE).quantize(quantum, rounding=ROUND_HALF_UP)
    return f"${usd:,.{precision}f}"


def fetch_document():
    command = shutil.which("lark-cli")
    if not command:
        raise RuntimeError("lark-cli is required to refresh the pricing snapshot")
    result = subprocess.run((command, "docs", "+fetch", "--doc", DOCUMENT_ID, "--doc-format", "markdown"),
                            text=True, capture_output=True, check=True, timeout=120)
    payload = json.loads(result.stdout)
    if not payload.get("ok"):
        raise RuntimeError(str(payload.get("error")))
    return payload["data"]["document"]["content"]


def render_content(markdown):
    if PRIVATE.search(markdown):
        raise ValueError("Private pricing text found in public document")
    sections = []
    lines = markdown.splitlines()
    index = 0
    table_count = 0
    while index < len(lines):
        line = lines[index].strip()
        if line.startswith("# "):
            sections.append("<h1>" + html.escape(line[2:]) + "</h1>")
        elif line.startswith("## "):
            title = line[3:]
            anchor = "section-" + str(table_count + 1)
            sections.append('<section id="' + anchor + '"><h2>' + html.escape(title) + "</h2>")
            if table_count:
                sections[-1] = "</section>" + sections[-1]
        elif line.startswith("> "):
            sections.append('<p class="meta">' + html.escape(line[2:]) + "</p>")
            sections.append('<p class="rate-note">美元参考换算：1 USD = ' + str(USD_CNY_RATE) +
                            ' CNY（<a href="' + RATE_SOURCE + '" rel="noopener noreferrer">Xe 中间价</a>，' +
                            RATE_TIMESTAMP + '）。套餐金额保留 2 位、模型参考价保留 3 位小数；最终支付金额以结账页为准。</p>')
        elif line.startswith("| "):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                raw = lines[index].strip().strip("|")
                cells = [part.strip().replace("\\|", "|").replace("\\~", "~").replace("\\$", "$")
                         for part in re.split(r"(?<!\\)\|", raw)]
                if not all(re.fullmatch(r"-+", cell) for cell in cells):
                    rows.append(cells)
                index += 1
            if len(rows) < 2 or any(len(row) != len(rows[0]) for row in rows):
                raise ValueError("Malformed pricing table")
            price_column = len(rows[0]) - 1
            if "售价" not in rows[0][price_column] and "参考价" not in rows[0][price_column]:
                raise ValueError("Expected a public price column")
            rows[0][price_column] += " (USD)"
            for row in rows[1:]:
                row[price_column] = usd_price(row[price_column], 2 if table_count < 2 else 3)
            rows = [[html.escape(cell) for cell in row] for row in rows]
            head = "<thead><tr>" + "".join("<th scope=\"col\">" + cell + "</th>" for cell in rows[0]) + "</tr></thead>"
            body = "<tbody>" + "".join("<tr>" + "".join("<td>" + cell + "</td>" for cell in row) + "</tr>" for row in rows[1:]) + "</tbody>"
            sections.append('<div class="table-scroll"><table>' + head + body + "</table></div>")
            table_count += 1
            continue
        elif line and not line.startswith("| ---"):
            sections.append("<p>" + html.escape(line) + "</p>")
        index += 1
    sections.append("</section>")
    if table_count != 6:
        raise ValueError("Expected six public pricing tables")
    return "\n".join(sections)


def render_page(content):
    return """<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <link rel="icon" href="/supdance-mark.png" type="image/png">
  <title>价目表 · Supdance</title>
  <meta name="description" content="Supdance 积分套餐、云存储与 AI 模型公开价目表。">
  <style>
    :root, html[data-theme="dark"] {
      color-scheme: dark;
      --bg: #000; --fg: #fff; --muted: #a2a2ad;
      --border: rgba(255,255,255,.12); --header: rgba(0,0,0,.88); --card: rgba(255,255,255,.03);
    }
    html[data-theme="light"] {
      color-scheme: light;
      --bg: #fff; --fg: #111; --muted: #666;
      --border: rgba(0,0,0,.12); --header: rgba(255,255,255,.88); --card: rgba(0,0,0,.02);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC",sans-serif; }
    header { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 64px; padding: 8px clamp(20px,4vw,48px); background: var(--header); border-bottom: 1px solid var(--border); backdrop-filter: blur(16px); }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--fg); font-weight: 600; text-decoration: none; white-space: nowrap; }
    .brand-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: #000; }
    .brand-mark img { width: 27px; height: 27px; object-fit: contain; }
    .badge { padding: 8px 10px; border-radius: 4px; background: var(--card); color: var(--muted); font: 11px/1.4 ui-monospace,SFMono-Regular,monospace; letter-spacing: .08em; }
    nav { display: flex; align-items: center; gap: 18px; }
    nav a { color: var(--muted); text-decoration: none; white-space: nowrap; font-size: 13px; }
    nav a:hover, nav a:focus-visible { color: var(--fg); }
    .controls { display: flex; align-items: center; gap: 10px; }
    button, select { min-height: 44px; border: 1px solid var(--border); background: transparent; color: var(--fg); cursor: pointer; }
    .language-control { position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding-left: 12px; border: 1px solid var(--border); border-radius: 999px; }
    .language-control svg { width: 16px; height: 16px; pointer-events: none; }
    button { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; padding: 8px; border-radius: 50%; transition: background-color .18s, color .18s, transform .18s; }
    button:hover { background: var(--card); transform: scale(1.06); }
    button:active { transform: scale(.92); }
    button svg { width: 18px; height: 18px; stroke-width: 1.8; transition: transform .25s; }
    button:hover svg { transform: rotate(12deg) scale(1.05); }
    select { min-width: 96px; max-width: 130px; padding: 8px 10px 8px 0; border: 0; }
    select option { background: var(--bg); color: var(--fg); }
    a:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid var(--fg); outline-offset: 3px; }
    main { max-width: 920px; margin: auto; padding: clamp(48px,7vw,96px) 24px 100px; }
    h1 { margin: 0 0 10px; font-size: clamp(34px,5vw,54px); line-height: 1.12; letter-spacing: -.035em; }
    h2 { margin: 0 0 18px; font-size: 23px; letter-spacing: -.02em; }
    .meta { margin: 0 0 12px; color: var(--muted); font: 12px/1.7 ui-monospace,SFMono-Regular,monospace; }
    .rate-note { margin: 0 0 48px; padding-bottom: 24px; border-bottom: 1px solid var(--border); font-size: 12px; }
    .rate-note a { color: var(--fg); }
    section { margin-top: 52px; scroll-margin-top: 88px; }
    p { color: var(--muted); }
    .table-scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; min-width: 620px; font-size: 13px; }
    th, td { padding: 11px 14px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
    tr:last-child td { border-bottom: 0; }
    th { color: var(--fg); font-weight: 600; white-space: nowrap; background: var(--card); }
    td { color: var(--muted); }
    td:last-child { color: var(--fg); font-variant-numeric: tabular-nums; white-space: nowrap; }
    footer { margin-top: 70px; padding-top: 24px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }
    @media (max-width: 720px) { header { align-items: flex-start; flex-wrap: wrap; } nav { order: 3; width: 100%; overflow-x: auto; gap: 14px; } main { padding-top: 48px; } }
    ::view-transition-old(root) { animation: none; }
    ::view-transition-new(root) { animation: none; clip-path: var(--theme-reveal-from); }
    html[data-theme-revealing="true"] body { transition: none; }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } button, button svg { transition: none; } }
  </style>
</head>
<body>
  <header>
    <a href="/" class="brand" aria-label="Supdance 首页"><span class="brand-mark"><img src="/supdance-mark.png" alt=""></span><span>Supdance</span><span class="badge">PRICING</span></a>
    <nav aria-label="页面导航"><a href="/terms">服务条款</a><a href="/privacy">隐私政策</a><a href="/aup">可接受使用</a><a href="/legal">法律中心</a></nav>
    <div class="controls"><span class="language-control"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 8 6 6m-7 0 6-6 2-3H3m5-2v2m5 16 5-11 5 11m-8-4h6"/></svg><select id="language-select" aria-label="语言"><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en-US">English</option><option value="es-ES">Español</option><option value="ja-JP">日本語</option><option value="ko-KR">한국어</option></select></span><button type="button" id="theme-toggle" aria-label="切换明暗主题"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg></button></div>
  </header>
  <main>
""" + content + """
    <footer>Supdance · 价格以实际购买页面为准。</footer>
  </main>
  <script src="/pricing-i18n.js" defer></script>
</body>
</html>
"""


if __name__ == "__main__":
    body = render_content(fetch_document())
    page = render_page(body)
    if PRIVATE.search(page):
        raise ValueError("Private pricing text found in HTML output")
    OUTPUT.write_text(page, encoding="utf-8")
    print(f"Generated {OUTPUT} ({page.count('<tbody>')} tables, {page.count('<tr>') - 6} data rows)")
