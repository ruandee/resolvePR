package scan

import (
	"encoding/json"
	"io"

	"secpr/internal/llm"
)

// FixtureSchemaVersion is bumped when the fixture shape changes.
const FixtureSchemaVersion = 1

// Fixture is the JSON document `secpr scan --fixture-out` writes and the
// dashboard's /demo page replays. This is a shared contract — do not rename
// or retype fields.
type Fixture struct {
	SchemaVersion int           `json:"schema_version"`
	GeneratedAt   int64         `json:"generated_at"` // unix seconds
	Generator     string        `json:"generator"`    // free text, e.g. "secpr 0.1.0 · claude-opus-5"
	PR            FixturePR     `json:"pr"`
	Findings      []llm.Finding `json:"findings"`
	Stats         *Stats        `json:"stats,omitempty"`
}

type FixturePR struct {
	Repo    string        `json:"repo"`
	Number  int           `json:"number"`
	Title   string        `json:"title"`
	HeadSHA string        `json:"head_sha"`
	Files   []FixtureFile `json:"files"`
}

type FixtureFile struct {
	Filename   string         `json:"filename"`
	Language   string         `json:"language"` // ast.DetectLang tag; "unknown" allowed
	Status     string         `json:"status"`   // added | modified | renamed
	Patch      string         `json:"patch"`    // hunks only
	Source     string         `json:"source"`   // full new-file contents at head
	AddedLines []int          `json:"added_lines"`
	Chunks     []FixtureChunk `json:"chunks"`
}

type FixtureChunk struct {
	FunctionName string `json:"function_name"` // or "chunk@10-70" for the window fallback
	Kind         string `json:"kind"`          // "function" | "window"
	StartLine    int    `json:"start_line"`    // absolute, inclusive
	EndLine      int    `json:"end_line"`      // absolute, inclusive
	ChangedLines []int  `json:"changed_lines"` // absolute
}

// ToFixture converts a scan Result into the fixture document. Skipped files
// are included with an empty chunk list so the demo can show what was
// touched but not reviewed; removed files are omitted (no new-file source).
func ToFixture(res *Result, generator string, generatedAt int64) Fixture {
	fx := Fixture{
		SchemaVersion: FixtureSchemaVersion,
		GeneratedAt:   generatedAt,
		Generator:     generator,
		PR: FixturePR{
			Repo:    res.Meta.Repo,
			Number:  res.Meta.Number,
			Title:   res.Meta.Title,
			HeadSHA: res.Meta.HeadSHA,
			Files:   []FixtureFile{},
		},
		Findings: []llm.Finding{},
	}
	stats := res.Stats
	fx.Stats = &stats

	for _, f := range res.Files {
		if f.Status == "removed" {
			continue
		}
		ff := FixtureFile{
			Filename:   f.Filename,
			Language:   f.Language,
			Status:     f.Status,
			Patch:      f.Patch,
			Source:     string(f.Source),
			AddedLines: nonNil(f.AddedLines),
			Chunks:     []FixtureChunk{},
		}
		for _, ch := range f.Chunks {
			ff.Chunks = append(ff.Chunks, FixtureChunk{
				FunctionName: ch.FunctionName,
				Kind:         ch.Kind,
				StartLine:    ch.StartLine,
				EndLine:      ch.EndLine,
				ChangedLines: nonNil(ch.AbsoluteChangedLines()),
			})
		}
		fx.PR.Files = append(fx.PR.Files, ff)
	}
	if res.Findings != nil {
		fx.Findings = res.Findings
	}
	return fx
}

// WriteFixture encodes the fixture as indented JSON.
func WriteFixture(w io.Writer, fx Fixture) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	return enc.Encode(fx)
}

func nonNil(xs []int) []int {
	if xs == nil {
		return []int{}
	}
	return xs
}
