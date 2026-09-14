// Package scan is the ResolvePR pipeline: changed files → language detection →
// diff parsing → AST chunking → LLM review → absolute line mapping →
// validated findings. It knows nothing about webhooks, HTTP servers, or
// process-wide state; every mode of the binary (serve, scan, action) drives
// it through Scanner.Scan and hands the Result to whichever Sinks it wants.
package scan

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"resolvepr/internal/ast"
	"resolvepr/internal/diff"
	"resolvepr/internal/llm"
)

// PRMeta identifies the change set being scanned.
type PRMeta struct {
	Repo    string // "owner/name" (or a local label)
	Number  int    // PR number; 0 for local scans
	Title   string
	HeadSHA string
}

// Reviewer is the LLM boundary. *llm.Client implements it; tests use fakes.
type Reviewer interface {
	Review(ctx context.Context, ch ast.Chunk) ([]llm.Finding, error)
}

// Scanner runs the pipeline. Zero value is not usable: set Reviewer unless
// DryRun is true.
type Scanner struct {
	Reviewer Reviewer
	// DryRun stops before the LLM: chunks are computed, no findings produced,
	// no network calls to Anthropic. Works with no API key.
	DryRun bool
	// Logf receives progress messages. nil = log.Printf.
	Logf func(format string, args ...any)
	// Now returns the timestamp stamped on findings. nil = time.Now.
	Now func() time.Time
}

// FileResult is one changed file after chunking (and review, unless skipped
// or dry-run).
type FileResult struct {
	Filename   string
	Language   string // ast.DetectLang tag; "unknown" allowed
	Status     string // added | modified | renamed | removed
	Patch      string
	Source     []byte
	AddedLines []int       // absolute
	Chunks     []ast.Chunk // ChangedLines are chunk-relative; use AbsoluteChangedLines()
	Hunk       diff.Hunk   // DiffPositions for inline comments
	Skipped    string      // why the file was not reviewed; "" = reviewed
}

// Stats summarises a scan for the fixture and the console.
type Stats struct {
	Files    int   `json:"files"`     // files reviewed (not skipped)
	Chunks   int   `json:"chunks"`    // chunks built
	LLMCalls int   `json:"llm_calls"` // review calls attempted
	Duration int64 `json:"duration_ms"`
}

// Result is everything a Sink needs: per-file chunks plus findings with
// absolute line numbers. It is sufficient to write the fixture JSON without
// a second pass over the source.
type Result struct {
	Meta     PRMeta
	Files    []FileResult
	Findings []llm.Finding
	Stats    Stats
	DryRun   bool
	// Errors lists non-fatal problems (a file that could not be fetched, a
	// chunk whose review failed). The scan still completes.
	Errors []error
}

func (s *Scanner) logf(format string, args ...any) {
	if s.Logf != nil {
		s.Logf(format, args...)
		return
	}
	log.Printf(format, args...)
}

func (s *Scanner) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// Scan runs the pipeline over src. It returns an error only when the file
// list itself cannot be obtained or the reviewer is unusable; per-file and
// per-chunk failures are logged, recorded in Result.Errors, and skipped.
func (s *Scanner) Scan(ctx context.Context, src Source, meta PRMeta) (*Result, error) {
	if !s.DryRun {
		if s.Reviewer == nil {
			return nil, errors.New("scan: no reviewer configured")
		}
		if r, ok := s.Reviewer.(interface{ Ready() bool }); ok && !r.Ready() {
			return nil, llm.ErrNoAPIKey
		}
	}

	start := s.now()
	files, err := src.Files(ctx)
	if err != nil {
		return nil, fmt.Errorf("list changed files: %w", err)
	}

	res := &Result{Meta: meta, DryRun: s.DryRun}
	createdAt := start.Unix()

	for _, f := range files {
		fr := FileResult{Filename: f.Filename, Status: f.Status, Patch: f.Patch, Source: f.Source}
		fr.Language = ast.DetectLang(f.Filename)

		// Parse the patch for every non-removed file, even ones that end up
		// skipped, so the fixture still reports which lines the PR added.
		if f.Status != "removed" {
			fr.Hunk = diff.Parse(f.Patch)
			fr.AddedLines = fr.Hunk.AddedLines
		}
		switch {
		case f.Status == "removed":
			fr.Skipped = "removed"
		case fr.Language == "unknown":
			fr.Skipped = "unsupported language"
		case len(fr.AddedLines) == 0:
			fr.Skipped = "no added lines"
		}
		if fr.Skipped != "" {
			s.logf("[resolvepr] skip %s: %s", f.Filename, fr.Skipped)
			res.Files = append(res.Files, fr)
			continue
		}

		if fr.Source == nil {
			content, err := src.Content(ctx, f.Filename)
			if err != nil {
				s.logf("[resolvepr] file content %s: %v", f.Filename, err)
				res.Errors = append(res.Errors, fmt.Errorf("%s: %w", f.Filename, err))
				fr.Skipped = "content unavailable"
				res.Files = append(res.Files, fr)
				continue
			}
			fr.Source = content
		}

		fr.Chunks = ast.MakeChunks(fr.Source, fr.Language, f.Filename, fr.AddedLines)
		res.Stats.Files++
		res.Stats.Chunks += len(fr.Chunks)

		if !s.DryRun {
			for _, ch := range fr.Chunks {
				res.Stats.LLMCalls++
				findings, err := s.Reviewer.Review(ctx, ch)
				if err != nil {
					s.logf("[resolvepr] llm review %s %s: %v", f.Filename, ch.FunctionName, err)
					res.Errors = append(res.Errors, fmt.Errorf("%s %s: %w", f.Filename, ch.FunctionName, err))
					if ctx.Err() != nil {
						return res, ctx.Err()
					}
					continue
				}
				for _, fnd := range findings {
					res.Findings = append(res.Findings, absolute(fnd, ch, meta, createdAt))
				}
			}
		}
		res.Files = append(res.Files, fr)
	}

	res.Stats.Duration = s.now().Sub(start).Milliseconds()
	return res, nil
}

// absolute converts a chunk-relative finding into the shared Finding
// contract: absolute line, content ID, repo/PR, timestamp, status.
func absolute(f llm.Finding, ch ast.Chunk, meta PRMeta, createdAt int64) llm.Finding {
	f.Line = ch.StartLine + f.Line - 1
	f.File = ch.File
	f.ID = llm.ContentID(f.CWE, ch.File, f.Line)
	f.Repo = meta.Repo
	f.PR = meta.Number
	f.CreatedAt = createdAt
	f.Status = "open"
	return f
}

// MeetsThreshold reports whether any finding is at least as severe as
// threshold ("critical" | "high" | "medium" | "low"). "none" or "" never
// matches.
func MeetsThreshold(findings []llm.Finding, threshold string) bool {
	rank, ok := ThresholdRank(threshold)
	if !ok {
		return false
	}
	for _, f := range findings {
		if llm.SeverityRank(f.Severity) <= rank {
			return true
		}
	}
	return false
}

// ThresholdRank parses a --fail-on value. ok is false for "none"/"".
func ThresholdRank(threshold string) (rank int, ok bool) {
	switch threshold {
	case "critical":
		return 0, true
	case "high":
		return 1, true
	case "medium":
		return 2, true
	case "low":
		return 3, true
	}
	return 0, false
}
