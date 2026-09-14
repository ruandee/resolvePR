package diff

import (
	"reflect"
	"testing"
)

func TestParseSingleHunk(t *testing.T) {
	patch := "@@ -10,5 +10,8 @@\n a\n b\n+c\n+d\n+e\n f\n g"
	h := Parse(patch)

	if want := []int{12, 13, 14}; !reflect.DeepEqual(h.AddedLines, want) {
		t.Fatalf("AddedLines = %v, want %v", h.AddedLines, want)
	}
	// position = GitHub's: the line just below the first "@@" header is 1.
	want := map[int]int{12: 3, 13: 4, 14: 5}
	if !reflect.DeepEqual(h.DiffPositions, want) {
		t.Fatalf("DiffPositions = %v, want %v", h.DiffPositions, want)
	}
}

func TestParseEmptyPatch(t *testing.T) {
	h := Parse("")
	if len(h.AddedLines) != 0 {
		t.Fatalf("AddedLines = %v, want empty", h.AddedLines)
	}
	if h.DiffPositions == nil || len(h.DiffPositions) != 0 {
		t.Fatalf("DiffPositions = %v, want empty non-nil map", h.DiffPositions)
	}
}

func TestParseDeletionsOnly(t *testing.T) {
	h := Parse("@@ -10,3 +10,1 @@\n-a\n-b\n c")
	if len(h.AddedLines) != 0 {
		t.Fatalf("AddedLines = %v, want none for a deletion-only hunk", h.AddedLines)
	}
}

func TestParseMultiHunk(t *testing.T) {
	patch := "@@ -1,3 +1,4 @@\n a\n+b\n c\n d\n@@ -20,2 +21,4 @@\n x\n+y\n+z\n w"
	h := Parse(patch)

	if want := []int{2, 22, 23}; !reflect.DeepEqual(h.AddedLines, want) {
		t.Fatalf("AddedLines = %v, want %v", h.AddedLines, want)
	}
	// Positions keep counting across later hunk headers (GitHub semantics).
	want := map[int]int{2: 2, 22: 7, 23: 8}
	if !reflect.DeepEqual(h.DiffPositions, want) {
		t.Fatalf("DiffPositions = %v, want %v", h.DiffPositions, want)
	}
}

func TestParseHunkHeaderWithoutCount(t *testing.T) {
	// "+5 @@" (no ",n") is what git emits for single-line hunks.
	h := Parse("@@ -5 +5 @@\n-old\n+new")
	if want := []int{5}; !reflect.DeepEqual(h.AddedLines, want) {
		t.Fatalf("AddedLines = %v, want %v", h.AddedLines, want)
	}
	if h.DiffPositions[5] != 2 {
		t.Fatalf("position = %d, want 2", h.DiffPositions[5])
	}
}

func TestParseMixedRemoveAndAdd(t *testing.T) {
	// Removed lines do not advance the new-file counter.
	h := Parse("@@ -1,4 +1,4 @@\n a\n-b\n+B\n c\n-d\n+D")
	if want := []int{2, 4}; !reflect.DeepEqual(h.AddedLines, want) {
		t.Fatalf("AddedLines = %v, want %v", h.AddedLines, want)
	}
}

func TestParseSkipsFileHeaders(t *testing.T) {
	// GitHub never sends these, but a raw git patch might; they must not
	// be counted as context lines.
	h := Parse("--- a/f.go\n+++ b/f.go\n@@ -1,1 +1,2 @@\n a\n+b")
	if want := []int{2}; !reflect.DeepEqual(h.AddedLines, want) {
		t.Fatalf("AddedLines = %v, want %v", h.AddedLines, want)
	}
}
