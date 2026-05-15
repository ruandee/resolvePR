// Package store provides persistence for findings and PR scan records.
// Use New(dsn) for PostgreSQL or NewMemory() for a local in-process fallback.
package store

import "resolvepr/internal/llm"

// PRRecord tracks a pull request that ResolvePR has scanned.
type PRRecord struct {
	Owner         string `json:"owner"`
	Repo          string `json:"repo"`
	RepoFull      string `json:"repo_full"`
	PR            int    `json:"pr"`
	SHA           string `json:"sha"`
	Status        string `json:"status"`        // "scanning" | "complete" | "failed"
	FindingsCount int    `json:"findings_count"` // updated after scan finishes
	ScannedAt     int64  `json:"scanned_at"`
	ErrorMessage  string `json:"error_message,omitempty"`
}

// Store is the persistence interface implemented by both Postgres and Memory.
type Store interface {
	// AddFinding persists a finding; silently skips exact duplicates (same ID).
	AddFinding(fnd llm.Finding) error
	// AllFindings returns findings newest-first with optional server-side filters.
	AllFindings(repo, status, severity string) ([]llm.Finding, error)
	// UpsertPR creates or updates a PR scan record.
	UpsertPR(pr PRRecord) error
	// AllPRs returns all PR scan records newest-first.
	AllPRs() ([]PRRecord, error)
	// HasCompleteScan returns true if a "complete" record already exists for this exact (repo_full, pr_number, sha).
	HasCompleteScan(repoFull string, pr int, sha string) (bool, error)
	// Health returns row counts for findings and pull_requests tables.
	Health() (findings int64, prs int64, err error)
}
