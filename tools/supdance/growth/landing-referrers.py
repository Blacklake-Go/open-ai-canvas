"""Summarize SupDance web access logs from stdin without emitting raw rows."""

import json
import re
import sys
from collections import Counter
from urllib.parse import urlsplit


DOCUMENT_REQUEST = re.compile(
    r'"GET (?:/|/create/?|/index\.html) HTTP/[0-9.]+" (?:200|304) \S+ "([^"]*)"'
)
SITE_HOSTS = {"supdance.com", "www.supdance.com"}
X_HOSTS = {"t.co", "x.com", "www.x.com", "twitter.com", "www.twitter.com"}
EXTERNAL_DOMAINS = ("google.com", "youtube.com", "bilibili.com", "tiktok.com", "bing.com")


def source_bucket(referrer: str) -> str:
    if referrer in ("", "-"):
        return "no_referrer"
    try:
        host = (urlsplit(referrer).hostname or "").lower()
    except ValueError:
        return "unparseable_referrer"
    if not host:
        return "unparseable_referrer"
    if host in SITE_HOSTS:
        return "same_site"
    if host in X_HOSTS:
        return "x_referrer"
    for domain in EXTERNAL_DOMAINS:
        if host == domain or host.endswith("." + domain):
            return domain
    return "other_referrer"


def main() -> None:
    counts: Counter[str] = Counter()
    log_lines = 0
    for line in sys.stdin:
        log_lines += 1
        match = DOCUMENT_REQUEST.search(line)
        if match:
            counts[source_bucket(match[1])] += 1
    print(json.dumps({
        "log_lines": log_lines,
        "document_requests": sum(counts.values()),
        "referrers": counts,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
