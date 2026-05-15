package store

import (
	"testing"

	"resolvepr/internal/llm"
)

func reset() {
	mu.Lock()
	defer mu.Unlock()
	data = map[string][]llm.Finding{}
}

func TestAddAndListAll(t *testing.T) {
	reset()
	Add("owner/repo#1", llm.Finding{CWE: "CWE-89", Severity: "HIGH"})
	Add("owner/repo#1", llm.Finding{CWE: "CWE-22", Severity: "MEDIUM"})

	got := List("")
	if len(got) != 2 {
		t.Fatalf("want 2 findings, got %d", len(got))
	}
}

func TestListFiltersByRepo(t *testing.T) {
	reset()
	Add("alice/api#1", llm.Finding{CWE: "CWE-89"})
	Add("bob/service#2", llm.Finding{CWE: "CWE-22"})

	got := List("alice/api")
	if len(got) != 1 {
		t.Fatalf("want 1 finding for alice/api, got %d", len(got))
	}
	if got[0].CWE != "CWE-89" {
		t.Fatalf("wrong finding returned: %+v", got[0])
	}
}

func TestListEmptyRepo(t *testing.T) {
	reset()
	got := List("")
	if got != nil {
		t.Fatalf("want nil for empty store, got %v", got)
	}
}

func TestListNoMatch(t *testing.T) {
	reset()
	Add("alice/api#1", llm.Finding{CWE: "CWE-89"})

	got := List("bob/service")
	if len(got) != 0 {
		t.Fatalf("want 0 findings for non-matching repo, got %d", len(got))
	}
}
