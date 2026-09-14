package store

import (
	"testing"

	"secpr/internal/llm"
)

func finding(id, repo, sev, status string) llm.Finding {
	return llm.Finding{ID: id, Repo: repo, Severity: sev, Status: status, CWE: "CWE-89"}
}

func TestMemoryFindingsRoundTrip(t *testing.T) {
	s := NewMemory()
	if err := s.AddFinding(finding("F-1", "a/b", "HIGH", "")); err != nil {
		t.Fatal(err)
	}
	if err := s.AddFinding(finding("F-2", "a/b", "LOW", "open")); err != nil {
		t.Fatal(err)
	}
	// Duplicate ID is silently ignored.
	if err := s.AddFinding(finding("F-1", "a/b", "CRITICAL", "open")); err != nil {
		t.Fatal(err)
	}

	got, err := s.AllFindings("", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d findings, want 2", len(got))
	}
	// Newest first.
	if got[0].ID != "F-2" || got[1].ID != "F-1" {
		t.Fatalf("order = %s,%s; want F-2,F-1", got[0].ID, got[1].ID)
	}
	// Empty status defaults to "open"; the duplicate did not overwrite.
	if got[1].Status != "open" || got[1].Severity != "HIGH" {
		t.Fatalf("F-1 = %+v; want status open, severity HIGH", got[1])
	}
}

func TestMemoryFindingsFilters(t *testing.T) {
	s := NewMemory()
	_ = s.AddFinding(finding("F-1", "a/b", "HIGH", "open"))
	_ = s.AddFinding(finding("F-2", "a/b", "LOW", "fixed"))
	_ = s.AddFinding(finding("F-3", "c/d", "HIGH", "open"))

	cases := []struct {
		repo, status, sev string
		want              []string
	}{
		{"a/b", "", "", []string{"F-2", "F-1"}},
		{"", "open", "", []string{"F-3", "F-1"}},
		{"", "", "HIGH", []string{"F-3", "F-1"}},
		{"a/b", "open", "HIGH", []string{"F-1"}},
		{"zz/zz", "", "", nil},
	}
	for _, c := range cases {
		got, err := s.AllFindings(c.repo, c.status, c.sev)
		if err != nil {
			t.Fatal(err)
		}
		var ids []string
		for _, f := range got {
			ids = append(ids, f.ID)
		}
		if len(ids) != len(c.want) {
			t.Fatalf("filter(%q,%q,%q) = %v, want %v", c.repo, c.status, c.sev, ids, c.want)
		}
		for i := range ids {
			if ids[i] != c.want[i] {
				t.Fatalf("filter(%q,%q,%q) = %v, want %v", c.repo, c.status, c.sev, ids, c.want)
			}
		}
	}
}

func TestMemoryPRUpsertAndHasCompleteScan(t *testing.T) {
	s := NewMemory()
	rec := PRRecord{Owner: "a", Repo: "b", RepoFull: "a/b", PR: 7, SHA: "abc", Status: "scanning", ScannedAt: 1}
	if err := s.UpsertPR(rec); err != nil {
		t.Fatal(err)
	}
	if ok, _ := s.HasCompleteScan("a/b", 7, "abc"); ok {
		t.Fatal("scanning record reported as complete")
	}

	rec.Status = "complete"
	rec.FindingsCount = 3
	if err := s.UpsertPR(rec); err != nil {
		t.Fatal(err)
	}
	prs, _ := s.AllPRs()
	if len(prs) != 1 {
		t.Fatalf("upsert created %d records, want 1", len(prs))
	}
	if prs[0].Status != "complete" || prs[0].FindingsCount != 3 {
		t.Fatalf("record not updated: %+v", prs[0])
	}
	if ok, _ := s.HasCompleteScan("a/b", 7, "abc"); !ok {
		t.Fatal("complete record not found")
	}
	if ok, _ := s.HasCompleteScan("a/b", 7, "other"); ok {
		t.Fatal("different sha reported as complete")
	}
	if ok, _ := s.HasCompleteScan("a/b", 8, "abc"); ok {
		t.Fatal("different PR reported as complete")
	}

	f, p, err := s.Health()
	if err != nil || f != 0 || p != 1 {
		t.Fatalf("Health = %d,%d,%v; want 0,1,nil", f, p, err)
	}
}

// PR numbers used to be keyed with string(rune(n)), so PR 65 became "A" and
// PRs that map to the same rune (or invalid runes) collided.
func TestMemoryPRKeyUsesDecimalNumber(t *testing.T) {
	s := NewMemory()
	for _, n := range []int{65, 66, 650, 65000, 1114112} { // 1114112 > max rune
		if err := s.UpsertPR(PRRecord{RepoFull: "a/b", PR: n, SHA: "abc", Status: "complete"}); err != nil {
			t.Fatal(err)
		}
	}
	prs, _ := s.AllPRs()
	if len(prs) != 5 {
		t.Fatalf("got %d records, want 5 distinct PRs", len(prs))
	}
	if ok, _ := s.HasCompleteScan("a/b", 65, "abc"); !ok {
		t.Fatal("PR 65 not found")
	}
	if got := prKey("a/b", 65, "abc"); got != "a/b/65/abc" {
		t.Fatalf("prKey = %q, want a/b/65/abc", got)
	}
}

func TestMemoryAllPRsNewestFirst(t *testing.T) {
	s := NewMemory()
	_ = s.UpsertPR(PRRecord{RepoFull: "a/b", PR: 1, SHA: "x", ScannedAt: 1})
	_ = s.UpsertPR(PRRecord{RepoFull: "a/b", PR: 2, SHA: "y", ScannedAt: 2})
	prs, _ := s.AllPRs()
	if prs[0].PR != 2 || prs[1].PR != 1 {
		t.Fatalf("order = %d,%d; want 2,1", prs[0].PR, prs[1].PR)
	}
}
