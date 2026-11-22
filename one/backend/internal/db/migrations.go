package db

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const MigrationLockKey = "supdance:postgresql:migrations"

type MigrationFile struct {
	FileName string
	Version  string
	SQL      string
	Checksum string
}

type MigrationStatus struct {
	OK      bool     `json:"ok"`
	Applied []string `json:"applied"`
	Pending []string `json:"pending"`
	Drifted []string `json:"drifted"`
	Latest  string   `json:"latest,omitempty"`
}

var (
	leadingLineComment  = regexp.MustCompile(`^--[^\n]*(?:\n|$)\s*`)
	leadingBlockComment = regexp.MustCompile(`^/\*[\s\S]*?\*/\s*`)
	txControlStmt       = regexp.MustCompile(`^(?i)(?:BEGIN|COMMIT|END)(?:\s+(?:WORK|TRANSACTION))?$`)
	dollarTagRe         = regexp.MustCompile(`^\$[A-Za-z0-9_]*\$`)
)

// CompareLocaleEn approximates JavaScript `a.localeCompare(b, 'en')` ordering
// for migration filenames (case-insensitive primary comparison, exact rune tie-breaker,
// punctuation before digits before letters).
func CompareLocaleEn(a, b string) int {
	ra := []rune(a)
	rb := []rune(b)
	n := len(ra)
	if len(rb) < n {
		n = len(rb)
	}
	for i := 0; i < n; i++ {
		la := unicode.ToLower(ra[i])
		lb := unicode.ToLower(rb[i])
		if la != lb {
			ca := charWeight(la)
			cb := charWeight(lb)
			if ca != cb {
				if ca < cb {
					return -1
				}
				return 1
			}
			if la < lb {
				return -1
			}
			return 1
		}
	}
	if len(ra) != len(rb) {
		if len(ra) < len(rb) {
			return -1
		}
		return 1
	}
	for i := 0; i < n; i++ {
		if ra[i] != rb[i] {
			if ra[i] < rb[i] {
				return -1
			}
			return 1
		}
	}
	return 0
}

func charWeight(r rune) int {
	switch {
	case unicode.IsPunct(r) || unicode.IsSymbol(r):
		return 0
	case unicode.IsDigit(r):
		return 1
	case unicode.IsLetter(r):
		return 2
	default:
		return 3
	}
}

func ChecksumSQL(sql string) string {
	clean := strings.TrimPrefix(sql, "\uFEFF")
	sum := sha256.Sum256([]byte(clean))
	return hex.EncodeToString(sum[:])
}

func LoadMigrations(dir string) ([]MigrationFile, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read migrations dir %q: %w", dir, err)
	}
	var names []string
	for _, ent := range entries {
		if ent.IsDir() {
			continue
		}
		name := ent.Name()
		if strings.HasSuffix(name, ".sql") && !strings.HasPrefix(name, "._") {
			names = append(names, name)
		}
	}
	sort.Slice(names, func(i, j int) bool {
		return CompareLocaleEn(names[i], names[j]) < 0
	})

	out := make([]MigrationFile, 0, len(names))
	for _, name := range names {
		raw, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return nil, fmt.Errorf("read migration %q: %w", name, err)
		}
		sql := strings.TrimPrefix(string(raw), "\uFEFF")
		version := strings.TrimSuffix(name, filepath.Ext(name))
		out = append(out, MigrationFile{
			FileName: name,
			Version:  version,
			SQL:      sql,
			Checksum: ChecksumSQL(sql),
		})
	}
	return out, nil
}

// SplitSQLStatements splits multi-statement PostgreSQL migration SQL on top-level
// semicolons while preserving comments, single-quoted strings (with ”), and $tag$...$tag$ blocks.
func SplitSQLStatements(sql string) []string {
	sql = strings.TrimPrefix(sql, "\uFEFF")
	var results []string
	var cur strings.Builder
	i := 0
	n := len(sql)
	for i < n {
		ch := sql[i]
		if ch == '-' && i+1 < n && sql[i+1] == '-' {
			end := strings.IndexByte(sql[i:], '\n')
			if end == -1 {
				cur.WriteString(sql[i:])
				i = n
			} else {
				cur.WriteString(sql[i : i+end+1])
				i += end + 1
			}
			continue
		}
		if ch == '/' && i+1 < n && sql[i+1] == '*' {
			end := strings.Index(sql[i+2:], "*/")
			if end == -1 {
				cur.WriteString(sql[i:])
				i = n
			} else {
				cur.WriteString(sql[i : i+2+end+2])
				i += 2 + end + 2
			}
			continue
		}
		if ch == '\'' {
			j := i + 1
			for j < n {
				if sql[j] == '\'' && j+1 < n && sql[j+1] == '\'' {
					j += 2
					continue
				}
				if sql[j] == '\'' {
					j++
					break
				}
				j++
			}
			cur.WriteString(sql[i:j])
			i = j
			continue
		}
		if ch == '$' {
			if m := dollarTagRe.FindString(sql[i:]); m != "" {
				closeIdx := strings.Index(sql[i+len(m):], m)
				if closeIdx == -1 {
					cur.WriteString(sql[i:])
					i = n
				} else {
					end := i + len(m) + closeIdx + len(m)
					cur.WriteString(sql[i:end])
					i = end
				}
				continue
			}
		}
		if ch == ';' {
			if trimmed := strings.TrimSpace(cur.String()); trimmed != "" {
				results = append(results, trimmed)
			}
			cur.Reset()
			i++
			continue
		}
		cur.WriteByte(ch)
		i++
	}
	if trimmed := strings.TrimSpace(cur.String()); trimmed != "" {
		results = append(results, trimmed)
	}
	return results
}

func MigrationStatements(sql string) []string {
	raw := SplitSQLStatements(sql)
	out := make([]string, 0, len(raw))
	for _, stmt := range raw {
		cmd := strings.TrimSpace(stmt)
		for {
			if loc := leadingLineComment.FindStringIndex(cmd); loc != nil && loc[0] == 0 {
				cmd = cmd[loc[1]:]
				continue
			}
			if loc := leadingBlockComment.FindStringIndex(cmd); loc != nil && loc[0] == 0 {
				cmd = cmd[loc[1]:]
				continue
			}
			break
		}
		cmd = strings.TrimSpace(strings.TrimPrefix(cmd, "\uFEFF"))
		if cmd == "" || txControlStmt.MatchString(cmd) {
			continue
		}
		out = append(out, stmt)
	}
	return out
}

func EnsureLedger(ctx context.Context, tx pgx.Tx) error {
	stmts := []string{
		`CREATE SCHEMA IF NOT EXISTS sys_core`,
		`CREATE TABLE IF NOT EXISTS sys_core.schema_migrations (
			version TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			checksum TEXT,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			execution_ms INTEGER NOT NULL DEFAULT 0
		)`,
		`ALTER TABLE sys_core.schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT`,
		`ALTER TABLE sys_core.schema_migrations ADD COLUMN IF NOT EXISTS execution_ms INTEGER NOT NULL DEFAULT 0`,
	}
	for _, s := range stmts {
		if _, err := tx.Exec(ctx, s); err != nil {
			return fmt.Errorf("ensure schema_migrations ledger: %w", err)
		}
	}
	return nil
}

// VerifyAndApplyMigrations preserves exact compatibility with Supdance Pro's
// `sys_core.schema_migrations` ledger. When applyPending is false it verifies
// checksums and reports pending/drifted migrations without mutating schema.
func VerifyAndApplyMigrations(ctx context.Context, pool *pgxpool.Pool, dir string, applyPending bool) (*MigrationStatus, error) {
	if pool == nil {
		return nil, errors.New("database pool is required")
	}
	files, err := LoadMigrations(dir)
	if err != nil {
		return nil, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, MigrationLockKey); err != nil {
		return nil, err
	}
	if err := EnsureLedger(ctx, tx); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `SELECT version, COALESCE(checksum, '') FROM sys_core.schema_migrations ORDER BY version`)
	if err != nil {
		return nil, err
	}
	appliedMap := map[string]string{}
	var appliedList []string
	for rows.Next() {
		var ver, sum string
		if err := rows.Scan(&ver, &sum); err != nil {
			rows.Close()
			return nil, err
		}
		appliedMap[ver] = sum
		appliedList = append(appliedList, ver)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	status := &MigrationStatus{Applied: appliedList}
	for _, f := range files {
		prevSum, ok := appliedMap[f.Version]
		if ok {
			if prevSum != "" && prevSum != f.Checksum {
				status.Drifted = append(status.Drifted, f.Version)
			}
			continue
		}
		if !applyPending {
			status.Pending = append(status.Pending, f.Version)
			continue
		}
		started := time.Now()
		for _, stmt := range MigrationStatements(f.SQL) {
			if _, err := tx.Exec(ctx, stmt); err != nil {
				return nil, fmt.Errorf("apply migration %s: %w", f.FileName, err)
			}
		}
		elapsedMs := int(time.Since(started).Milliseconds())
		if _, err := tx.Exec(ctx,
			`INSERT INTO sys_core.schema_migrations (version, name, checksum, execution_ms) VALUES ($1, $2, $3, $4)`,
			f.Version, f.FileName, f.Checksum, elapsedMs,
		); err != nil {
			return nil, fmt.Errorf("record migration %s: %w", f.FileName, err)
		}
		status.Applied = append(status.Applied, f.Version)
	}
	if len(status.Drifted) > 0 {
		return status, fmt.Errorf("migration checksum mismatch for versions: %v", status.Drifted)
	}
	if len(status.Applied) > 0 {
		status.Latest = status.Applied[len(status.Applied)-1]
	}
	status.OK = len(status.Pending) == 0 && len(status.Drifted) == 0
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return status, nil
}
