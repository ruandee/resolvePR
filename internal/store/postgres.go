package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // registers "pgx" driver
	"resolvepr/internal/llm"
)

const schema = `
CREATE TABLE IF NOT EXISTS findings (
	id            TEXT PRIMARY KEY,
	repo          TEXT    NOT NULL,
	pr_number     INT     NOT NULL,
	file          TEXT    NOT NULL,
	line_number   INT     NOT NULL,
	cwe           TEXT    NOT NULL,
	severity      TEXT    NOT NULL,
	summary       TEXT    NOT NULL,
	why_it_matters TEXT   NOT NULL,
	fix_patch     TEXT    NOT NULL,
	confidence    REAL    NOT NULL,
	status        TEXT    NOT NULL DEFAULT 'open',
	created_at    BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_repo     ON findings(repo);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_status   ON findings(status);

CREATE TABLE IF NOT EXISTS pull_requests (
	id             SERIAL PRIMARY KEY,
	owner          TEXT    NOT NULL,
	repo           TEXT    NOT NULL,
	repo_full      TEXT    NOT NULL,
	pr_number      INT     NOT NULL,
	sha            TEXT    NOT NULL,
	status         TEXT    NOT NULL DEFAULT 'scanning',
	findings_count INT     NOT NULL DEFAULT 0,
	scanned_at     BIGINT  NOT NULL,
	error_message  TEXT,
	UNIQUE (repo_full, pr_number, sha)
);

CREATE INDEX IF NOT EXISTS idx_prs_repo ON pull_requests(repo_full);

ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS error_message TEXT;
`

// PostgresStore implements Store using PostgreSQL.
type PostgresStore struct {
	db *sql.DB
}

// New opens a Postgres connection and runs schema migrations.
func New(dsn string) (*PostgresStore, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("store: open: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("store: ping: %w", err)
	}

	for _, stmt := range splitSQL(schema) {
		if _, err := db.Exec(stmt); err != nil {
			return nil, fmt.Errorf("store: migrate %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}
	return &PostgresStore{db: db}, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func splitSQL(s string) []string {
	var stmts []string
	for _, part := range strings.Split(s, ";") {
		part = strings.TrimSpace(part)
		if part != "" {
			stmts = append(stmts, part)
		}
	}
	return stmts
}

// AddFinding inserts a finding, ignoring conflicts on the primary key.
func (s *PostgresStore) AddFinding(fnd llm.Finding) error {
	_, err := s.db.Exec(`
		INSERT INTO findings
			(id, repo, pr_number, file, line_number, cwe, severity,
			 summary, why_it_matters, fix_patch, confidence, status, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (id) DO NOTHING`,
		fnd.ID, fnd.Repo, fnd.PR, fnd.File, fnd.Line,
		fnd.CWE, fnd.Severity, fnd.Summary, fnd.WhyItMatters,
		fnd.FixPatch, fnd.Confidence, coalesce(fnd.Status, "open"), fnd.CreatedAt,
	)
	return err
}

func coalesce(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

// AllFindings returns findings newest-first with optional filters.
func (s *PostgresStore) AllFindings(repo, status, severity string) ([]llm.Finding, error) {
	q := `SELECT id, repo, pr_number, file, line_number, cwe, severity,
	             summary, why_it_matters, fix_patch, confidence, status, created_at
	      FROM findings WHERE 1=1`
	args := []any{}
	n := 1
	if repo != "" {
		q += fmt.Sprintf(" AND repo = $%d", n)
		args = append(args, repo)
		n++
	}
	if status != "" {
		q += fmt.Sprintf(" AND status = $%d", n)
		args = append(args, status)
		n++
	}
	if severity != "" {
		q += fmt.Sprintf(" AND severity = $%d", n)
		args = append(args, severity)
		n++
	}
	q += " ORDER BY created_at DESC"

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []llm.Finding
	for rows.Next() {
		var f llm.Finding
		if err := rows.Scan(
			&f.ID, &f.Repo, &f.PR, &f.File, &f.Line,
			&f.CWE, &f.Severity, &f.Summary, &f.WhyItMatters,
			&f.FixPatch, &f.Confidence, &f.Status, &f.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// UpsertPR creates or updates a PR scan record.
func (s *PostgresStore) UpsertPR(pr PRRecord) error {
	_, err := s.db.Exec(`
		INSERT INTO pull_requests
			(owner, repo, repo_full, pr_number, sha, status, findings_count, scanned_at, error_message)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (repo_full, pr_number, sha)
		DO UPDATE SET status = $6, findings_count = $7, scanned_at = $8, error_message = $9`,
		pr.Owner, pr.Repo, pr.RepoFull, pr.PR, pr.SHA,
		pr.Status, pr.FindingsCount, pr.ScannedAt, pr.ErrorMessage,
	)
	return err
}

// AllPRs returns all PR scan records newest-first.
func (s *PostgresStore) AllPRs() ([]PRRecord, error) {
	rows, err := s.db.Query(`
		SELECT owner, repo, repo_full, pr_number, sha, status, findings_count, scanned_at, COALESCE(error_message, '')
		FROM pull_requests ORDER BY scanned_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []PRRecord
	for rows.Next() {
		var r PRRecord
		if err := rows.Scan(
			&r.Owner, &r.Repo, &r.RepoFull, &r.PR, &r.SHA,
			&r.Status, &r.FindingsCount, &r.ScannedAt, &r.ErrorMessage,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// HasCompleteScan returns true if a "complete" record already exists for this (repo_full, pr_number, sha).
func (s *PostgresStore) HasCompleteScan(repoFull string, pr int, sha string) (bool, error) {
	var n int
	err := s.db.QueryRow(
		`SELECT COUNT(*) FROM pull_requests WHERE repo_full=$1 AND pr_number=$2 AND sha=$3 AND status='complete'`,
		repoFull, pr, sha,
	).Scan(&n)
	return n > 0, err
}

// Health returns row counts for findings and pull_requests tables.
func (s *PostgresStore) Health() (int64, int64, error) {
	var f, p int64
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM findings`).Scan(&f); err != nil {
		return 0, 0, err
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM pull_requests`).Scan(&p); err != nil {
		return 0, 0, err
	}
	return f, p, nil
}
