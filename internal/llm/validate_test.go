package llm

import (
	"testing"

	"secpr/internal/ast"
)

func good(line int) Finding {
	return Finding{
		CWE: "CWE-89", Severity: "HIGH", Line: line,
		Summary: "s", WhyItMatters: "w", FixPatch: "f", Confidence: 0.95,
	}
}

var chunk = ast.Chunk{File: "db.go", ChangedLines: []int{2, 3}}

func TestValidateKeepsGoodFinding(t *testing.T) {
	out := Validate([]Finding{good(2)}, chunk)
	if len(out) != 1 {
		t.Fatalf("got %d, want 1", len(out))
	}
}

func TestValidateDropRules(t *testing.T) {
	cases := map[string]Finding{}

	f := good(2)
	f.Severity = "SEVERE"
	cases["invalid severity"] = f

	f = good(2)
	f.Severity = "high" // case-sensitive
	cases["lowercase severity"] = f

	cases["line not in changed set"] = good(4)
	cases["line zero"] = good(0)

	f = good(2)
	f.Confidence = 0.86
	cases["confidence below threshold"] = f

	f = good(2)
	f.CWE = ""
	cases["missing cwe"] = f

	f = good(2)
	f.Summary = ""
	cases["missing summary"] = f

	f = good(2)
	f.WhyItMatters = ""
	cases["missing why_it_matters"] = f

	f = good(2)
	f.FixPatch = ""
	cases["missing fix_patch"] = f

	for name, f := range cases {
		t.Run(name, func(t *testing.T) {
			if out := Validate([]Finding{f}, chunk); len(out) != 0 {
				t.Fatalf("finding kept, want dropped: %+v", out)
			}
		})
	}
}

func TestValidateConfidenceBoundary(t *testing.T) {
	f := good(2)
	f.Confidence = 0.87
	if out := Validate([]Finding{f}, chunk); len(out) != 1 {
		t.Fatal("0.87 is the minimum allowed confidence and must be kept")
	}
}

func TestValidateDedupesCWELine(t *testing.T) {
	a, b := good(2), good(2)
	b.Summary = "different wording, same CWE and line"
	c := good(2)
	c.CWE = "CWE-79" // different CWE, same line → kept
	d := good(3)     // same CWE, different line → kept

	out := Validate([]Finding{a, b, c, d}, chunk)
	if len(out) != 3 {
		t.Fatalf("got %d, want 3 (one duplicate dropped): %+v", len(out), out)
	}
	if out[0].Summary != "s" {
		t.Fatal("first occurrence must win")
	}
}

func TestValidateEmptyInput(t *testing.T) {
	if out := Validate(nil, chunk); out != nil {
		t.Fatalf("got %v, want nil", out)
	}
}

func TestContentIDStable(t *testing.T) {
	a := ContentID("CWE-89", "db.go", 12)
	b := ContentID("CWE-89", "db.go", 12)
	c := ContentID("CWE-89", "db.go", 13)
	if a != b {
		t.Fatalf("same input gave %s and %s", a, b)
	}
	if a == c {
		t.Fatal("different line gave the same ID")
	}
	if len(a) != 10 || a[:2] != "F-" {
		t.Fatalf("ID %q does not look like F-xxxxxxxx", a)
	}
}

func TestSeverityRank(t *testing.T) {
	if SeverityRank("CRITICAL") >= SeverityRank("HIGH") || SeverityRank("HIGH") >= SeverityRank("MEDIUM") ||
		SeverityRank("MEDIUM") >= SeverityRank("LOW") || SeverityRank("LOW") >= SeverityRank("bogus") {
		t.Fatal("severity ranks are not ordered")
	}
}
