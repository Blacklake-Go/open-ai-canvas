package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/domain/generation"
	"one/backend/internal/outbound"
	"one/backend/internal/pkg/seckey"
)

var reI18nPlaceholder = regexp.MustCompile(`\{([A-Za-z0-9_]+)\}`)

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}

func enrichCostMetricsUSDToCNY(row map[string]any) {
	if row == nil {
		return
	}
	costUSD := adminAFloat(row["total_cost_usd"])
	row["total_cost_usd"] = round4(costUSD)
	row["total_cost_cny"] = round2(costUSD * generation.DefaultUSDToCNY)
	row["total_cost_credits"] = int64(math.Round(costUSD * 100))
}

func enrichProfitMetrics(row map[string]any) {
	if row == nil {
		return
	}
	credits := adminAFloat(row["total_credits"])
	costUSD := adminAFloat(row["total_cost_usd"])
	revCNY := credits * generation.CNYPerCredit
	revUSD := revCNY / generation.DefaultUSDToCNY
	costCNY := costUSD * generation.DefaultUSDToCNY
	profitCNY := revCNY - costCNY
	marginPct := 0.0
	if revCNY > 0 {
		marginPct = round2((profitCNY / revCNY) * 100)
	}
	row["revenue_cny"] = round2(revCNY)
	row["revenue_usd"] = round4(revUSD)
	row["cost_usd"] = round4(costUSD)
	row["cost_cny"] = round2(costCNY)
	row["gross_profit_cny"] = round2(profitCNY)
	row["gross_margin_pct"] = marginPct
}

func extractPlaceholderSet(s string) []string {
	matches := reI18nPlaceholder.FindAllStringSubmatch(s, -1)
	if len(matches) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(matches))
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		if !seen[m[1]] {
			seen[m[1]] = true
			out = append(out, m[1])
		}
	}
	sort.Strings(out)
	return out
}

func computeLanguageCoverageDiagnostics(locales []string, merged map[string]any) []map[string]any {
	allKeysSet := map[string]bool{}
	baselinePlaceholders := map[string]string{}
	baseLocale := "en"
	if len(adminAJSONMap(merged["en"])) == 0 && len(adminAJSONMap(merged["zh-CN"])) > 0 {
		baseLocale = "zh-CN"
	}

	for _, loc := range locales {
		entry := adminAJSONMap(merged[loc])
		for k, v := range entry {
			allKeysSet[k] = true
			if loc == baseLocale {
				if vars := extractPlaceholderSet(adminAStr(v)); len(vars) > 0 {
					baselinePlaceholders[k] = strings.Join(vars, ",")
				}
			}
		}
	}
	allKeys := make([]string, 0, len(allKeysSet))
	for k := range allKeysSet {
		allKeys = append(allKeys, k)
	}
	sort.Strings(allKeys)

	out := make([]map[string]any, 0, len(locales))
	for _, loc := range locales {
		entry := adminAJSONMap(merged[loc])
		missing := make([]string, 0)
		invalid := make([]string, 0)
		formatErrors := make([]string, 0)
		validCount := 0

		for _, k := range allKeys {
			val, ok := entry[k]
			if !ok {
				missing = append(missing, k)
				continue
			}
			text := strings.TrimSpace(adminAStr(val))
			if text == "" {
				invalid = append(invalid, k)
				continue
			}
			if wantVars, hasVars := baselinePlaceholders[k]; hasVars {
				gotVars := strings.Join(extractPlaceholderSet(text), ",")
				if gotVars != wantVars {
					formatErrors = append(formatErrors, k)
					continue
				}
			}
			validCount++
		}
		out = append(out, map[string]any{
			"locale":       loc,
			"coverage":     validCount,
			"totalKeys":    len(allKeys),
			"missing":      missing,
			"formatErrors": formatErrors,
			"invalid":      invalid,
		})
	}
	return out
}

func resolveTwitterBearerToken(ctx context.Context, pool *pgxpool.Pool, cfg map[string]any, encKey string) string {
	if tok := strings.TrimSpace(adminAStr(cfg["bearerToken"])); tok != "" {
		return tok
	}
	if tok := strings.TrimSpace(adminAStr(adminAJSONMap(cfg["cookies"])["bearerToken"])); tok != "" {
		return tok
	}
	if pool != nil && encKey != "" {
		if tok, err := seckey.ReadProviderSecret(ctx, pool.QueryRow, encKey, "twitter", "bearer_token"); err == nil && strings.TrimSpace(tok) != "" {
			return strings.TrimSpace(tok)
		}
	}
	return firstNonEmpty(strings.TrimSpace(os.Getenv("X_BEARER_TOKEN")), strings.TrimSpace(os.Getenv("TWITTER_BEARER_TOKEN")))
}

func executeTwitterCrawlHTTP(ctx context.Context, allowedHosts []string, bearerToken, category string, limit int, targetAuthor string) ([]map[string]any, error) {
	if strings.TrimSpace(bearerToken) == "" {
		return nil, errors.New("twitter bearer token is not configured")
	}
	if limit <= 0 {
		limit = 15
	}
	if limit < 10 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	baseURL := firstNonEmpty(strings.TrimSpace(os.Getenv("ONE_X_API_BASE")), "https://api.twitter.com/2")
	if _, err := outbound.ValidateExternalURL(baseURL, allowedHosts...); err != nil {
		return nil, fmt.Errorf("invalid X API URL: %w", err)
	}
	client := outbound.NewSafeHTTPClient(15*time.Second, allowedHosts...)

	query := "prompt (ai OR midjourney OR sora OR runway) -is:retweet lang:en"
	if category != "" && category != "all" {
		query = fmt.Sprintf("prompt %s -is:retweet", category)
	}
	if author := strings.TrimPrefix(strings.TrimSpace(targetAuthor), "@"); author != "" {
		query = fmt.Sprintf("from:%s -is:retweet", author)
	}

	endpoint := fmt.Sprintf("%s/tweets/search/recent?query=%s&max_results=%d&tweet.fields=created_at,author_id,text&expansions=author_id&user.fields=username",
		strings.TrimRight(baseURL, "/"), url.QueryEscape(query), limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+bearerToken)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("X API v2 HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var parsed struct {
		Data []struct {
			ID        string `json:"id"`
			Text      string `json:"text"`
			AuthorID  string `json:"author_id"`
			CreatedAt string `json:"created_at"`
		} `json:"data"`
		Includes struct {
			Users []struct {
				ID       string `json:"id"`
				Username string `json:"username"`
			} `json:"users"`
		} `json:"includes"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("decode X API v2 response: %w", err)
	}

	usernames := make(map[string]string, len(parsed.Includes.Users))
	for _, u := range parsed.Includes.Users {
		usernames[u.ID] = u.Username
	}

	out := make([]map[string]any, 0, len(parsed.Data))
	for _, t := range parsed.Data {
		author := firstNonEmpty(usernames[t.AuthorID], strings.TrimPrefix(strings.TrimSpace(targetAuthor), "@"), t.AuthorID)
		itemCategory := category
		if itemCategory == "" || itemCategory == "all" {
			itemCategory = "image"
		}
		out = append(out, map[string]any{
			"id":        "x_" + t.ID,
			"tweetId":   t.ID,
			"author":    author,
			"prompt":    strings.TrimSpace(t.Text),
			"category":  itemCategory,
			"url":       fmt.Sprintf("https://x.com/%s/status/%s", url.PathEscape(author), url.PathEscape(t.ID)),
			"status":    "pending",
			"createdAt": firstNonEmpty(t.CreatedAt, time.Now().UTC().Format(time.RFC3339)),
		})
	}
	return out, nil
}
