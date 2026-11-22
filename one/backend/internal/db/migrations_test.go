package db

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func TestCompareLocaleEnMatchesSupdanceBaseline99Migrations(t *testing.T) {
	manifestPath := filepath.Join("..", "..", "..", "..", "docs", "one-baseline", "db-schema-inventory.json")
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatalf("read db-schema-inventory.json: %v", err)
	}
	var inv struct {
		Migrations []struct {
			Order          int    `json:"order"`
			FileName       string `json:"fileName"`
			Sha256Checksum string `json:"sha256Checksum"`
		} `json:"migrations"`
	}
	if err := json.Unmarshal(raw, &inv); err != nil {
		t.Fatalf("unmarshal inventory: %v", err)
	}
	if len(inv.Migrations) != 99 {
		t.Fatalf("expected 99 migrations in baseline, got %d", len(inv.Migrations))
	}

	reversed := make([]string, len(inv.Migrations))
	for i, m := range inv.Migrations {
		reversed[len(inv.Migrations)-1-i] = m.FileName
	}
	sort.Slice(reversed, func(i, j int) bool {
		return CompareLocaleEn(reversed[i], reversed[j]) < 0
	})
	for i, m := range inv.Migrations {
		if reversed[i] != m.FileName {
			t.Fatalf("order mismatch at index %d: got %q, want %q", i, reversed[i], m.FileName)
		}
	}
}

func TestSplitAndFilterMigrationStatements(t *testing.T) {
	sql := "\uFEFF" + `
BEGIN;
-- comment with ; semicolon
CREATE SCHEMA IF NOT EXISTS sys_core;
/* block comment ; inside */
INSERT INTO sys_core.system_settings (key, value) VALUES ('a', '{"x":"semi;colon''quoted"}');
DO $$
BEGIN
  IF true THEN
    PERFORM 1;
  END IF;
END $$;
COMMIT;
`
	stmts := MigrationStatements(sql)
	if len(stmts) != 3 {
		t.Fatalf("expected 3 statements after stripping BEGIN/COMMIT, got %d: %#v", len(stmts), stmts)
	}
	sum1 := ChecksumSQL(sql)
	sum2 := ChecksumSQL(sql[len("\uFEFF"):])
	if sum1 != sum2 || len(sum1) != 64 {
		t.Fatalf("BOM stripping or checksum failed: %s vs %s", sum1, sum2)
	}
}
