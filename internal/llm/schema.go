package llm

import (
	"crypto/sha256"
	"fmt"
)

// Finding is one security issue. This is the shared JSON contract with the
// dashboard — do not rename or retype fields.
type Finding struct {
	ID           string  `json:"id"`       // "F-" + first 8 hex of sha256("cwe:file:line")
	Repo         string  `json:"repo"`     // "owner/name"
	PR           int     `json:"pr"`       // PR number (0 for local scans)
	File         string  `json:"file"`     // path within the repo
	Line         int     `json:"line"`     // absolute 1-based line in the new file
	CWE          string  `json:"cwe"`      // e.g. "CWE-89"
	Severity     string  `json:"severity"` // CRITICAL | HIGH | MEDIUM | LOW
	Summary      string  `json:"summary"`
	WhyItMatters string  `json:"why_it_matters"`
	FixPatch     string  `json:"fix_patch"`  // replacement text for the vulnerable line(s)
	Confidence   float64 `json:"confidence"` // 0.87 | 0.91 | 0.95 | 0.99 after validation
	CreatedAt    int64   `json:"created_at"` // unix seconds
	Status       string  `json:"status"`     // open | acknowledged | fixed | suppressed
}

// Severities in descending order of importance.
var Severities = []string{"CRITICAL", "HIGH", "MEDIUM", "LOW"}

// SeverityRank returns 0 for CRITICAL … 3 for LOW, and len(Severities) for
// anything unknown, so lower is more severe.
func SeverityRank(sev string) int {
	for i, s := range Severities {
		if s == sev {
			return i
		}
	}
	return len(Severities)
}

// ContentID returns a stable, content-addressed 8-char hex ID for a finding.
// Two findings on the same CWE + file + line always produce the same ID,
// which is how the store and dashboard deduplicate across PRs.
func ContentID(cwe, file string, line int) string {
	h := sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%d", cwe, file, line)))
	return fmt.Sprintf("F-%x", h[:4]) // e.g. "F-3a9cf12b"
}

// findingProperties is a struct, not a map, so encoding/json preserves the
// declared field order. The constrained decoder emits keys in schema order,
// and that order matters: with the alphabetical order a Go map produces
// (confidence first, why_it_matters last) the response ends on a free-text
// string and the model sometimes never closes it, spiralling to max_tokens.
// Ending on `confidence` (a number) terminates cleanly, and it matches the
// example in the system prompt.
type findingProperties struct {
	CWE          map[string]any `json:"cwe"`
	Severity     map[string]any `json:"severity"`
	Line         map[string]any `json:"line"`
	Summary      map[string]any `json:"summary"`
	WhyItMatters map[string]any `json:"why_it_matters"`
	FixPatch     map[string]any `json:"fix_patch"`
	Confidence   map[string]any `json:"confidence"`
}

// FindingsSchema is the JSON schema the model's response is constrained to
// (structured outputs). It mirrors the `interface Finding` in the system
// prompt. Every object sets additionalProperties:false as the API requires.
func FindingsSchema() map[string]any {
	str := map[string]any{"type": "string"}
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"findings"},
		"properties": map[string]any{
			"findings": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required": []string{
						"cwe", "severity", "line", "summary",
						"why_it_matters", "fix_patch", "confidence",
					},
					"properties": findingProperties{
						CWE:          str,
						Severity:     map[string]any{"type": "string", "enum": Severities},
						Line:         map[string]any{"type": "integer"},
						Summary:      str,
						WhyItMatters: str,
						FixPatch:     str,
						Confidence:   map[string]any{"type": "number"},
					},
				},
			},
		},
	}
}
