package scan

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"resolvepr/internal/llm"
	"resolvepr/internal/output"
	"resolvepr/internal/store"
)

// Sink receives a finished scan. Each mode of the binary picks the sinks it
// wants: GitHub (comments + check run), Store, Stdout, Fixture.
type Sink interface {
	Emit(ctx context.Context, res *Result) error
}

// LifecycleSink is a Sink that also wants to know when a scan starts and
// when it fails before producing a Result (check run "in_progress", PR
// record "scanning"/"failed").
type LifecycleSink interface {
	Sink
	Begin(ctx context.Context, meta PRMeta) error
	Fail(ctx context.Context, meta PRMeta, err error)
}

// Run drives one scan through its sinks: Begin on lifecycle sinks, Scan,
// then Emit on every sink (or Fail if the scan errored). Sink errors are
// logged, never fatal — a comment that cannot be posted must not lose the
// findings.
func Run(ctx context.Context, sc *Scanner, src Source, meta PRMeta, sinks ...Sink) (*Result, error) {
	for _, s := range sinks {
		if ls, ok := s.(LifecycleSink); ok {
			if err := ls.Begin(ctx, meta); err != nil {
				sc.logf("[resolvepr] %T begin: %v", s, err)
			}
		}
	}
	res, err := sc.Scan(ctx, src, meta)
	if err != nil {
		for _, s := range sinks {
			if ls, ok := s.(LifecycleSink); ok {
				ls.Fail(ctx, meta, err)
			}
		}
		return res, err
	}
	for _, s := range sinks {
		if err := s.Emit(ctx, res); err != nil {
			sc.logf("[resolvepr] %T emit: %v", s, err)
		}
	}
	return res, nil
}

// ── GitHub ───────────────────────────────────────────────────────────────────

// GitHubSink posts inline review comments, a PR summary comment, and a
// check run. Every call is best-effort: a fork PR with a read-only token
// gets log lines, not a crash.
type GitHubSink struct {
	Token   string
	Owner   string
	Repo    string
	Number  int
	HeadSHA string
	Logf    func(format string, args ...any)

	checkID int64
}

func (g *GitHubSink) logf(format string, args ...any) {
	if g.Logf != nil {
		g.Logf(format, args...)
		return
	}
	log.Printf(format, args...)
}

func (g *GitHubSink) Begin(ctx context.Context, _ PRMeta) error {
	id, err := output.CreateCheck(ctx, g.Token, g.Owner, g.Repo, g.HeadSHA)
	if err != nil {
		return fmt.Errorf("create check run (continuing without one): %w", err)
	}
	g.checkID = id
	return nil
}

func (g *GitHubSink) Fail(ctx context.Context, _ PRMeta, err error) {
	if g.checkID == 0 {
		return
	}
	if cerr := output.CompleteCheck(ctx, g.Token, g.Owner, g.Repo, g.checkID, nil); cerr != nil {
		g.logf("[resolvepr] complete check after failure: %v", cerr)
	}
}

func (g *GitHubSink) Emit(ctx context.Context, res *Result) error {
	positions := map[string]map[int]int{}
	for _, f := range res.Files {
		positions[f.Filename] = f.Hunk.DiffPositions
	}
	for _, fnd := range res.Findings {
		pos, ok := positions[fnd.File][fnd.Line]
		if !ok {
			g.logf("[resolvepr] no diff position for %s:%d — skipping inline comment", fnd.File, fnd.Line)
			continue
		}
		if err := output.PostComment(ctx, g.Token, g.Owner, g.Repo, g.Number, g.HeadSHA, fnd.File, pos, fnd); err != nil {
			g.logf("[resolvepr] post comment %s:%d: %v", fnd.File, fnd.Line, err)
		}
	}
	if err := output.PostSummary(ctx, g.Token, g.Owner, g.Repo, g.Number, res.Findings); err != nil {
		g.logf("[resolvepr] post summary: %v", err)
	}
	if g.checkID != 0 {
		if err := output.CompleteCheck(ctx, g.Token, g.Owner, g.Repo, g.checkID, res.Findings); err != nil {
			g.logf("[resolvepr] complete check: %v", err)
		}
	}
	return nil
}

// ── Store ────────────────────────────────────────────────────────────────────

// StoreSink persists findings and the PR scan record. Only the webhook
// server uses it; scan and action run without a store.
type StoreSink struct {
	Store store.Store
	Now   func() time.Time
}

func (s *StoreSink) now() int64 {
	if s.Now != nil {
		return s.Now().Unix()
	}
	return time.Now().Unix()
}

func (s *StoreSink) record(meta PRMeta, status string, count int, errMsg string) store.PRRecord {
	owner, repo, _ := strings.Cut(meta.Repo, "/")
	return store.PRRecord{
		Owner: owner, Repo: repo, RepoFull: meta.Repo,
		PR: meta.Number, SHA: meta.HeadSHA, Status: status,
		FindingsCount: count, ScannedAt: s.now(), ErrorMessage: errMsg,
	}
}

func (s *StoreSink) Begin(_ context.Context, meta PRMeta) error {
	return s.Store.UpsertPR(s.record(meta, "scanning", 0, ""))
}

func (s *StoreSink) Fail(_ context.Context, meta PRMeta, err error) {
	_ = s.Store.UpsertPR(s.record(meta, "failed", 0, err.Error()))
}

func (s *StoreSink) Emit(_ context.Context, res *Result) error {
	var firstErr error
	for _, f := range res.Findings {
		if err := s.Store.AddFinding(f); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if err := s.Store.UpsertPR(s.record(res.Meta, "complete", len(res.Findings), "")); err != nil && firstErr == nil {
		firstErr = err
	}
	return firstErr
}

// ── Fixture ──────────────────────────────────────────────────────────────────

// FixtureSink writes the fixture JSON to a file ("-" = stdout).
type FixtureSink struct {
	Path      string
	Generator string
}

func (f *FixtureSink) Emit(_ context.Context, res *Result) error {
	fx := ToFixture(res, f.Generator, time.Now().Unix())
	if f.Path == "-" {
		return WriteFixture(os.Stdout, fx)
	}
	file, err := os.Create(f.Path)
	if err != nil {
		return err
	}
	defer file.Close()
	if err := WriteFixture(file, fx); err != nil {
		return err
	}
	return file.Close()
}

// ── Stdout ───────────────────────────────────────────────────────────────────

// StdoutSink prints the result for a human (or, with JSON set, the fixture
// document for a machine).
type StdoutSink struct {
	W         io.Writer // nil = os.Stdout
	JSON      bool
	Generator string
	// ShowBodies prints each chunk's source (what would be sent to the
	// model). Used by --dry-run.
	ShowBodies bool
}

func (s *StdoutSink) Emit(_ context.Context, res *Result) error {
	w := s.W
	if w == nil {
		w = os.Stdout
	}
	if s.JSON {
		return WriteFixture(w, ToFixture(res, s.Generator, time.Now().Unix()))
	}
	PrintResult(w, res, s.ShowBodies)
	return nil
}

// PrintResult renders a human-readable report.
func PrintResult(w io.Writer, res *Result, showBodies bool) {
	title := res.Meta.Repo
	if res.Meta.Number > 0 {
		title += fmt.Sprintf("#%d", res.Meta.Number)
	}
	if res.Meta.HeadSHA != "" {
		title += " @ " + shortSHA(res.Meta.HeadSHA)
	}
	if res.Meta.Title != "" {
		title += " — " + res.Meta.Title
	}
	fmt.Fprintf(w, "ResolvePR scan: %s\n", title)
	if res.DryRun {
		fmt.Fprintln(w, "(dry run — nothing was sent to the model)")
	}
	fmt.Fprintln(w)

	for _, f := range res.Files {
		if f.Skipped != "" {
			fmt.Fprintf(w, "  %s  [%s] skipped: %s\n", f.Filename, f.Status, f.Skipped)
			continue
		}
		fmt.Fprintf(w, "  %s  [%s, %s] %d added line(s), %d chunk(s)\n",
			f.Filename, f.Status, f.Language, len(f.AddedLines), len(f.Chunks))
		for _, ch := range f.Chunks {
			fmt.Fprintf(w, "    %-8s %s  lines %d-%d  changed %v\n",
				ch.Kind, ch.FunctionName, ch.StartLine, ch.EndLine, ch.AbsoluteChangedLines())
			if showBodies {
				for i, line := range strings.Split(ch.FunctionBody, "\n") {
					fmt.Fprintf(w, "      %4d | %s\n", ch.StartLine+i, line)
				}
			}
		}
	}
	fmt.Fprintln(w)

	if res.DryRun {
		fmt.Fprintf(w, "%d file(s), %d chunk(s) would be reviewed.\n", res.Stats.Files, res.Stats.Chunks)
		return
	}

	if len(res.Findings) == 0 {
		fmt.Fprintf(w, "No findings. %d file(s), %d chunk(s), %d LLM call(s), %s.\n",
			res.Stats.Files, res.Stats.Chunks, res.Stats.LLMCalls, time.Duration(res.Stats.Duration)*time.Millisecond)
		return
	}

	findings := append([]llm.Finding(nil), res.Findings...)
	sort.SliceStable(findings, func(i, j int) bool {
		return llm.SeverityRank(findings[i].Severity) < llm.SeverityRank(findings[j].Severity)
	})
	tw := tabwriter.NewWriter(w, 0, 4, 2, ' ', 0)
	fmt.Fprintln(tw, "SEVERITY\tCWE\tLOCATION\tCONF\tSUMMARY")
	for _, f := range findings {
		fmt.Fprintf(tw, "%s\t%s\t%s:%d\t%.0f%%\t%s\n", f.Severity, f.CWE, f.File, f.Line, f.Confidence*100, f.Summary)
	}
	tw.Flush()
	fmt.Fprintln(w)
	for _, f := range findings {
		fmt.Fprintf(w, "%s %s at %s:%d\n  %s\n  Why it matters: %s\n  Fix:\n", f.Severity, f.CWE, f.File, f.Line, f.Summary, f.WhyItMatters)
		for _, line := range strings.Split(f.FixPatch, "\n") {
			fmt.Fprintf(w, "    %s\n", line)
		}
		fmt.Fprintln(w)
	}
	fmt.Fprintf(w, "%d finding(s). %d file(s), %d chunk(s), %d LLM call(s), %s.\n",
		len(findings), res.Stats.Files, res.Stats.Chunks, res.Stats.LLMCalls, time.Duration(res.Stats.Duration)*time.Millisecond)
	if len(res.Errors) > 0 {
		fmt.Fprintf(w, "%d error(s) during scan — see log.\n", len(res.Errors))
	}
}

func shortSHA(sha string) string {
	if len(sha) > 8 {
		return sha[:8]
	}
	return sha
}
