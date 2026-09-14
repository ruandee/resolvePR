package scan

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"secpr/internal/ast"
	"secpr/internal/llm"
	"secpr/internal/store"
)

// ── fakes ────────────────────────────────────────────────────────────────────

type fakeSource struct {
	files    []ChangedFile
	contents map[string][]byte
	loaded   []string // filenames Content was called for
	err      error
}

func (f *fakeSource) Files(context.Context) ([]ChangedFile, error) { return f.files, f.err }
func (f *fakeSource) Content(_ context.Context, name string) ([]byte, error) {
	f.loaded = append(f.loaded, name)
	c, ok := f.contents[name]
	if !ok {
		return nil, errors.New("no such file")
	}
	return c, nil
}

// fakeReviewer returns canned chunk-relative findings keyed by function name.
type fakeReviewer struct {
	byFunc map[string][]llm.Finding
	calls  []ast.Chunk
	err    error
}

func (r *fakeReviewer) Review(_ context.Context, ch ast.Chunk) ([]llm.Finding, error) {
	r.calls = append(r.calls, ch)
	if r.err != nil {
		return nil, r.err
	}
	return r.byFunc[ch.FunctionName], nil
}

// ── fixtures ─────────────────────────────────────────────────────────────────

const searchSrc = `package handlers

import "database/sql"

func listUsers(db *sql.DB) {}

func searchUsers(db *sql.DB, q string) ([]User, error) {
	rows, err := db.Query("SELECT * FROM users WHERE name = '" + q + "'")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUsers(rows)
}
`

// searchUsers spans lines 7-14; line 8 is the concatenation.
const searchPatch = "@@ -4,6 +4,11 @@\n \n func listUsers(db *sql.DB) {}\n \n+func searchUsers(db *sql.DB, q string) ([]User, error) {\n+\trows, err := db.Query(\"SELECT * FROM users WHERE name = '\" + q + \"'\")\n+\tif err != nil {\n+\t\treturn nil, err\n+\t}\n+\tdefer rows.Close()\n+\treturn scanUsers(rows)\n+}"

const configSrc = "# config\nkey: value\n"

func fixedNow() time.Time { return time.Unix(1757800000, 0) }

func newScenario() (*fakeSource, *fakeReviewer, PRMeta) {
	src := &fakeSource{
		files: []ChangedFile{
			{Filename: "internal/handlers/search.go", Status: "modified", Patch: searchPatch},
			{Filename: "config.yaml", Status: "added", Patch: "@@ -0,0 +1,2 @@\n+# config\n+key: value"},
			{Filename: "old.go", Status: "removed", Patch: "@@ -1,2 +0,0 @@\n-package old\n-"},
			{Filename: "docs.go", Status: "modified", Patch: "@@ -1,3 +1,2 @@\n package docs\n-// gone\n // kept"},
		},
		contents: map[string][]byte{
			"internal/handlers/search.go": []byte(searchSrc),
			"config.yaml":                 []byte(configSrc),
			"old.go":                      []byte("package old\n"),
			"docs.go":                     []byte("package docs\n// kept\n"),
		},
	}
	rev := &fakeReviewer{byFunc: map[string][]llm.Finding{
		"searchUsers": {{
			CWE: "CWE-89", Severity: "CRITICAL", Line: 2, // chunk-relative → file line 8
			Summary: "concat", WhyItMatters: "dump table", FixPatch: "\trows, err := db.Query(\"... ?\", q)", Confidence: 0.95,
		}},
	}}
	meta := PRMeta{Repo: "acme/api", Number: 142, Title: "Add user search endpoint", HeadSHA: "3f2a9c1d0000000000000000000000000000abcd"}
	return src, rev, meta
}

// ── tests ────────────────────────────────────────────────────────────────────

func TestScanEndToEnd(t *testing.T) {
	src, rev, meta := newScenario()
	sc := &Scanner{Reviewer: rev, Now: fixedNow, Logf: t.Logf}

	res, err := sc.Scan(context.Background(), src, meta)
	if err != nil {
		t.Fatal(err)
	}

	// Only the reviewable file was fetched.
	if !reflect.DeepEqual(src.loaded, []string{"internal/handlers/search.go"}) {
		t.Fatalf("Content called for %v, want only search.go", src.loaded)
	}
	// One chunk reviewed.
	if len(rev.calls) != 1 || rev.calls[0].FunctionName != "searchUsers" {
		t.Fatalf("reviewer calls = %+v", rev.calls)
	}
	if rev.calls[0].StartLine != 7 || rev.calls[0].EndLine != 14 {
		t.Fatalf("chunk lines %d-%d, want 7-14", rev.calls[0].StartLine, rev.calls[0].EndLine)
	}

	// Finding mapped to absolute line with the full contract filled in.
	if len(res.Findings) != 1 {
		t.Fatalf("findings = %+v", res.Findings)
	}
	f := res.Findings[0]
	want := llm.Finding{
		ID:   llm.ContentID("CWE-89", "internal/handlers/search.go", 8),
		Repo: "acme/api", PR: 142, File: "internal/handlers/search.go", Line: 8,
		CWE: "CWE-89", Severity: "CRITICAL", Summary: "concat", WhyItMatters: "dump table",
		FixPatch: "\trows, err := db.Query(\"... ?\", q)", Confidence: 0.95,
		CreatedAt: 1757800000, Status: "open",
	}
	if f != want {
		t.Fatalf("finding =\n%+v\nwant\n%+v", f, want)
	}

	// Skip reasons.
	skipped := map[string]string{}
	for _, fr := range res.Files {
		skipped[fr.Filename] = fr.Skipped
	}
	if skipped["config.yaml"] != "unsupported language" || skipped["old.go"] != "removed" || skipped["docs.go"] != "no added lines" || skipped["internal/handlers/search.go"] != "" {
		t.Fatalf("skip reasons = %v", skipped)
	}
	if res.Stats.Files != 1 || res.Stats.Chunks != 1 || res.Stats.LLMCalls != 1 {
		t.Fatalf("stats = %+v", res.Stats)
	}
}

// The fixture written from a Result must match the contract the dashboard
// replays: absolute lines everywhere, end_line present, chunk kinds.
func TestFixtureMatchesContract(t *testing.T) {
	src, rev, meta := newScenario()
	sc := &Scanner{Reviewer: rev, Now: fixedNow, Logf: t.Logf}
	res, err := sc.Scan(context.Background(), src, meta)
	if err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := WriteFixture(&buf, ToFixture(res, "secpr test · fake", 1757800001)); err != nil {
		t.Fatal(err)
	}

	// Decode into a generic map so the assertions are about the JSON keys
	// (the contract), not the Go struct.
	var doc map[string]any
	if err := json.Unmarshal(buf.Bytes(), &doc); err != nil {
		t.Fatalf("fixture is not JSON: %v\n%s", err, buf.String())
	}

	if doc["schema_version"] != float64(1) || doc["generated_at"] != float64(1757800001) || doc["generator"] != "secpr test · fake" {
		t.Errorf("header = %v %v %v", doc["schema_version"], doc["generated_at"], doc["generator"])
	}

	pr := doc["pr"].(map[string]any)
	if pr["repo"] != "acme/api" || pr["number"] != float64(142) || pr["title"] != "Add user search endpoint" || pr["head_sha"] != meta.HeadSHA {
		t.Errorf("pr = %v", pr)
	}

	files := pr["files"].([]any)
	byName := map[string]map[string]any{}
	for _, f := range files {
		m := f.(map[string]any)
		byName[m["filename"].(string)] = m
	}
	if _, has := byName["old.go"]; has {
		t.Error("removed file must be omitted from the fixture")
	}
	for _, name := range []string{"internal/handlers/search.go", "config.yaml", "docs.go"} {
		if _, has := byName[name]; !has {
			t.Errorf("fixture missing file %s", name)
		}
	}

	sf := byName["internal/handlers/search.go"]
	if sf["language"] != "go" || sf["status"] != "modified" || sf["patch"] != searchPatch || sf["source"] != searchSrc {
		t.Errorf("search.go file record = %v", sf)
	}
	if got := toInts(sf["added_lines"]); !reflect.DeepEqual(got, []int{7, 8, 9, 10, 11, 12, 13, 14}) {
		t.Errorf("added_lines = %v (must be absolute)", got)
	}
	chunks := sf["chunks"].([]any)
	if len(chunks) != 1 {
		t.Fatalf("chunks = %v", chunks)
	}
	ch := chunks[0].(map[string]any)
	if ch["function_name"] != "searchUsers" || ch["kind"] != "function" || ch["start_line"] != float64(7) || ch["end_line"] != float64(14) {
		t.Errorf("chunk = %v", ch)
	}
	if got := toInts(ch["changed_lines"]); !reflect.DeepEqual(got, []int{7, 8, 9, 10, 11, 12, 13, 14}) {
		t.Errorf("chunk.changed_lines = %v (must be ABSOLUTE, not chunk-relative)", got)
	}
	for _, key := range []string{"function_name", "kind", "start_line", "end_line", "changed_lines"} {
		if _, has := ch[key]; !has {
			t.Errorf("chunk missing key %s", key)
		}
	}

	// Skipped files carry chunks: [] (never null) and unknown language.
	cf := byName["config.yaml"]
	if cf["language"] != "unknown" || cf["status"] != "added" {
		t.Errorf("config.yaml = %v", cf)
	}
	if cs, ok := cf["chunks"].([]any); !ok || len(cs) != 0 {
		t.Errorf("config.yaml chunks = %v, want []", cf["chunks"])
	}
	// Skipped for language, but the patch is still parsed so the fixture
	// reports what the PR added.
	if al, ok := cf["added_lines"].([]any); !ok || len(al) != 2 {
		t.Errorf("config.yaml added_lines = %v, want 2 lines", cf["added_lines"])
	}
	if cf["source"] != "" {
		// Not fetched (skipped) — empty string, not null.
		t.Errorf("config.yaml source = %q, want empty", cf["source"])
	}

	findings := doc["findings"].([]any)
	if len(findings) != 1 {
		t.Fatalf("findings = %v", findings)
	}
	fd := findings[0].(map[string]any)
	wantKeys := []string{"id", "repo", "pr", "file", "line", "cwe", "severity", "summary", "why_it_matters", "fix_patch", "confidence", "created_at", "status"}
	for _, k := range wantKeys {
		if _, has := fd[k]; !has {
			t.Errorf("finding missing key %s", k)
		}
	}
	if len(fd) != len(wantKeys) {
		t.Errorf("finding has %d keys, want exactly %d: %v", len(fd), len(wantKeys), fd)
	}
	if fd["line"] != float64(8) || fd["id"] != llm.ContentID("CWE-89", "internal/handlers/search.go", 8) || fd["status"] != "open" || fd["created_at"] != float64(1757800000) {
		t.Errorf("finding = %v", fd)
	}

	stats := doc["stats"].(map[string]any)
	for _, k := range []string{"files", "chunks", "llm_calls", "duration_ms"} {
		if _, has := stats[k]; !has {
			t.Errorf("stats missing %s", k)
		}
	}
	if stats["files"] != float64(1) || stats["chunks"] != float64(1) || stats["llm_calls"] != float64(1) {
		t.Errorf("stats = %v", stats)
	}
}

func TestFixtureEmptyScanHasEmptyArrays(t *testing.T) {
	res := &Result{Meta: PRMeta{Repo: "a/b"}}
	var buf bytes.Buffer
	if err := WriteFixture(&buf, ToFixture(res, "g", 1)); err != nil {
		t.Fatal(err)
	}
	s := buf.String()
	if !strings.Contains(s, `"files": []`) || !strings.Contains(s, `"findings": []`) {
		t.Fatalf("empty collections must be [] not null:\n%s", s)
	}
}

func TestScanDryRunMakesNoReviewCalls(t *testing.T) {
	src, rev, meta := newScenario()
	sc := &Scanner{DryRun: true, Logf: t.Logf} // no Reviewer at all
	res, err := sc.Scan(context.Background(), src, meta)
	if err != nil {
		t.Fatal(err)
	}
	if len(rev.calls) != 0 || len(res.Findings) != 0 {
		t.Fatalf("dry run made calls/findings: %d/%d", len(rev.calls), len(res.Findings))
	}
	if !res.DryRun || res.Stats.Chunks != 1 || res.Stats.LLMCalls != 0 {
		t.Fatalf("dry-run result = %+v", res.Stats)
	}
	// The human report lists the chunk that would be sent.
	var buf bytes.Buffer
	PrintResult(&buf, res, true)
	out := buf.String()
	for _, want := range []string{"dry run", "searchUsers", "lines 7-14", "func searchUsers("} {
		if !strings.Contains(out, want) {
			t.Errorf("report missing %q:\n%s", want, out)
		}
	}
}

func TestScanRefusesWithoutReviewer(t *testing.T) {
	src, _, meta := newScenario()
	if _, err := (&Scanner{}).Scan(context.Background(), src, meta); err == nil {
		t.Fatal("want error when no reviewer and not dry-run")
	}
	// A reviewer that reports itself not ready (no API key) fails before
	// any file is fetched.
	_, err := (&Scanner{Reviewer: &llm.Client{}}).Scan(context.Background(), src, meta)
	if !errors.Is(err, llm.ErrNoAPIKey) {
		t.Fatalf("err = %v, want ErrNoAPIKey", err)
	}
	if len(src.loaded) != 0 {
		t.Fatal("files were fetched despite missing key")
	}
}

func TestScanReviewErrorIsNonFatal(t *testing.T) {
	src, rev, meta := newScenario()
	rev.err = errors.New("boom")
	sc := &Scanner{Reviewer: rev, Logf: t.Logf}
	res, err := sc.Scan(context.Background(), src, meta)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Findings) != 0 || len(res.Errors) != 1 {
		t.Fatalf("findings=%d errors=%v", len(res.Findings), res.Errors)
	}
}

func TestScanSourceListError(t *testing.T) {
	src := &fakeSource{err: errors.New("api down")}
	_, err := (&Scanner{Reviewer: &fakeReviewer{}}).Scan(context.Background(), src, PRMeta{})
	if err == nil || !strings.Contains(err.Error(), "api down") {
		t.Fatalf("err = %v", err)
	}
}

func TestScanContentErrorSkipsFile(t *testing.T) {
	src, rev, meta := newScenario()
	delete(src.contents, "internal/handlers/search.go")
	res, err := (&Scanner{Reviewer: rev, Logf: t.Logf}).Scan(context.Background(), src, meta)
	if err != nil {
		t.Fatal(err)
	}
	if res.Files[0].Skipped != "content unavailable" || len(res.Errors) != 1 {
		t.Fatalf("file = %+v, errors = %v", res.Files[0], res.Errors)
	}
}

func TestScanPrePopulatedSourceIsNotRefetched(t *testing.T) {
	src, rev, meta := newScenario()
	src.files[0].Source = []byte(searchSrc)
	if _, err := (&Scanner{Reviewer: rev, Logf: t.Logf}).Scan(context.Background(), src, meta); err != nil {
		t.Fatal(err)
	}
	if len(src.loaded) != 0 {
		t.Fatalf("Content called for %v; pre-populated Source must be used", src.loaded)
	}
}

func TestRunLifecycleAndSinks(t *testing.T) {
	src, rev, meta := newScenario()
	mem := store.NewMemory()
	dir := t.TempDir()
	fixturePath := filepath.Join(dir, "out.json")
	var stdout bytes.Buffer

	sc := &Scanner{Reviewer: rev, Now: fixedNow, Logf: t.Logf}
	res, err := Run(context.Background(), sc, src, meta,
		&StoreSink{Store: mem, Now: fixedNow},
		&FixtureSink{Path: fixturePath, Generator: "g"},
		&StdoutSink{W: &stdout},
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Findings) != 1 {
		t.Fatalf("findings = %v", res.Findings)
	}

	// Store: PR record complete with count, finding persisted.
	if ok, _ := mem.HasCompleteScan("acme/api", 142, meta.HeadSHA); !ok {
		t.Error("store has no complete record")
	}
	prs, _ := mem.AllPRs()
	if len(prs) != 1 || prs[0].Owner != "acme" || prs[0].Repo != "api" || prs[0].FindingsCount != 1 {
		t.Errorf("pr records = %+v", prs)
	}
	if fs, _ := mem.AllFindings("acme/api", "", ""); len(fs) != 1 {
		t.Errorf("stored findings = %v", fs)
	}

	// Fixture file written and parseable.
	raw, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatal(err)
	}
	var fx Fixture
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatal(err)
	}
	if fx.SchemaVersion != 1 || fx.PR.Number != 142 || len(fx.Findings) != 1 || len(fx.PR.Files) != 3 {
		t.Errorf("fixture = %+v", fx)
	}

	// Human report mentions the finding.
	if out := stdout.String(); !strings.Contains(out, "CWE-89") || !strings.Contains(out, "search.go:8") {
		t.Errorf("stdout report:\n%s", out)
	}
}

func TestRunFailMarksStore(t *testing.T) {
	mem := store.NewMemory()
	src := &fakeSource{err: errors.New("api down")}
	meta := PRMeta{Repo: "a/b", Number: 3, HeadSHA: "abc"}
	_, err := Run(context.Background(), &Scanner{Reviewer: &fakeReviewer{}}, src, meta, &StoreSink{Store: mem})
	if err == nil {
		t.Fatal("want error")
	}
	prs, _ := mem.AllPRs()
	if len(prs) != 1 || prs[0].Status != "failed" || !strings.Contains(prs[0].ErrorMessage, "api down") {
		t.Fatalf("pr records = %+v", prs)
	}
}

func TestStdoutSinkJSON(t *testing.T) {
	src, rev, meta := newScenario()
	res, _ := (&Scanner{Reviewer: rev, Now: fixedNow, Logf: t.Logf}).Scan(context.Background(), src, meta)
	var buf bytes.Buffer
	if err := (&StdoutSink{W: &buf, JSON: true, Generator: "g"}).Emit(context.Background(), res); err != nil {
		t.Fatal(err)
	}
	var fx Fixture
	if err := json.Unmarshal(buf.Bytes(), &fx); err != nil {
		t.Fatalf("--json output is not a fixture: %v", err)
	}
	if fx.Generator != "g" || len(fx.Findings) != 1 {
		t.Fatalf("fixture = %+v", fx)
	}
}

func TestMeetsThreshold(t *testing.T) {
	fs := []llm.Finding{{Severity: "MEDIUM"}, {Severity: "LOW"}}
	cases := map[string]bool{"critical": false, "high": false, "medium": true, "low": true, "none": false, "": false}
	for th, want := range cases {
		if got := MeetsThreshold(fs, th); got != want {
			t.Errorf("MeetsThreshold(%q) = %v, want %v", th, got, want)
		}
	}
	if MeetsThreshold(nil, "low") {
		t.Error("no findings must never meet a threshold")
	}
}

func toInts(v any) []int {
	xs, _ := v.([]any)
	out := make([]int, 0, len(xs))
	for _, x := range xs {
		out = append(out, int(x.(float64)))
	}
	return out
}
