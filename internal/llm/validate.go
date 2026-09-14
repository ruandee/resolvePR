package llm

import (
	"log"

	"resolvepr/internal/ast"
)

var validSev = map[string]bool{"CRITICAL": true, "HIGH": true, "MEDIUM": true, "LOW": true}

type dedupeKey struct {
	CWE  string
	Line int
}

func Validate(findings []Finding, ch ast.Chunk) []Finding {
	changed := map[int]bool{}
	for _, l := range ch.ChangedLines {
		changed[l] = true
	}

	seen := map[dedupeKey]bool{}
	var out []Finding

	for _, f := range findings {
		if !validSev[f.Severity] {
			log.Printf("drop [%s line %d]: invalid severity %q", ch.File, f.Line, f.Severity)
			continue
		}
		if !changed[f.Line] {
			log.Printf("drop [%s line %d]: line not in changed set", ch.File, f.Line)
			continue
		}
		if f.Confidence < 0.87 {
			log.Printf("drop [%s line %d %s]: confidence %.2f below threshold", ch.File, f.Line, f.CWE, f.Confidence)
			continue
		}
		if f.CWE == "" || f.Summary == "" || f.WhyItMatters == "" || f.FixPatch == "" {
			log.Printf("drop [%s line %d]: missing required field (cwe=%q summary=%q why=%q fix=%q)",
				ch.File, f.Line, f.CWE, f.Summary, f.WhyItMatters, f.FixPatch)
			continue
		}
		key := dedupeKey{f.CWE, f.Line}
		if seen[key] {
			log.Printf("drop [%s line %d %s]: duplicate", ch.File, f.Line, f.CWE)
			continue
		}
		seen[key] = true
		out = append(out, f)
	}
	return out
}
