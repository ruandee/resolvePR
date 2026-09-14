package diff

import (
	"regexp"
	"strconv"
	"strings"
)

var hunkRe = regexp.MustCompile(`^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@`)

// Hunk holds parsed information from a unified diff patch.
type Hunk struct {
	// AddedLines is the list of line numbers (in the NEW file) that were added.
	AddedLines []int
	// DiffPositions maps a new-file line number -> its position within the patch.
	// Use this when posting inline comments — GitHub wants the position, not the line.
	DiffPositions map[int]int
}

// Parse takes the .Patch field from GitHub's PR files API and returns the changed lines
// plus the position-in-diff for each one.
func Parse(patch string) Hunk {
	h := Hunk{DiffPositions: map[int]int{}}
	if patch == "" {
		return h
	}

	// GitHub's position: the line just below the FIRST "@@" header is 1, and
	// the count keeps increasing through every later line, including later
	// "@@" headers. Lines before the first header (raw git "---"/"+++"
	// file headers) are not counted at all.
	var newLine int
	pos := 0
	inHunk := false
	for _, line := range strings.Split(patch, "\n") {
		// Hunk header — reset newLine to start of this hunk
		if m := hunkRe.FindStringSubmatch(line); m != nil {
			if inHunk {
				pos++
			}
			inHunk = true
			n, _ := strconv.Atoi(m[1])
			newLine = n - 1
			continue
		}
		if !inHunk {
			continue // file header lines before the first hunk
		}
		pos++

		// File header lines mid-patch (never in GitHub's per-file patch, but skip safely)
		if strings.HasPrefix(line, "+++") || strings.HasPrefix(line, "---") {
			continue
		}

		switch {
		case strings.HasPrefix(line, "+"):
			newLine++
			h.AddedLines = append(h.AddedLines, newLine)
			h.DiffPositions[newLine] = pos
		case strings.HasPrefix(line, "-"):
			// removed line — present in old file only, no new line counter bump
		default:
			// context line (or empty) — bumps new line counter
			newLine++
		}
	}
	return h
}
