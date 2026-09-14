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
					"properties": map[string]any{
						"cwe":            str,
						"severity":       map[string]any{"type": "string", "enum": Severities},
						"line":           map[string]any{"type": "integer"},
						"summary":        str,
						"why_it_matters": str,
						"fix_patch":      str,
						"confidence":     map[string]any{"type": "number"},
					},
				},
			},
		},
	}
}
