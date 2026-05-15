package llm

import (
	"crypto/sha256"
	"fmt"
)

type Finding struct {
	ID           string  `json:"id"`
	Repo         string  `json:"repo"`
	PR           int     `json:"pr"`
	File         string  `json:"file"`
	Line         int     `json:"line"`
	CWE          string  `json:"cwe"`
	Severity     string  `json:"severity"`
	Summary      string  `json:"summary"`
	WhyItMatters string  `json:"why_it_matters"`
	FixPatch     string  `json:"fix_patch"`
	Confidence   float64 `json:"confidence"`
	CreatedAt    int64   `json:"created_at"`
	Status       string  `json:"status"` // "open" | "acknowledged" | "fixed"
}

// ContentID returns a stable, content-addressed 8-char hex ID for a finding.
// Two findings on the same CWE + file + line always produce the same ID,
// which is how the store and dashboard deduplicate across PRs.
func ContentID(cwe, file string, line int) string {
	h := sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%d", cwe, file, line)))
	return fmt.Sprintf("F-%x", h[:4]) // e.g. "F-3a9cf12b"
}
