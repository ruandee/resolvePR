package scan

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"resolvepr/internal/diff"
)

func TestStripDiffHeader(t *testing.T) {
	raw := "diff --git a/f.go b/f.go\nindex 1..2 100644\n--- a/f.go\n+++ b/f.go\n@@ -1,2 +1,3 @@\n a\n+b\n c\n"
	want := "@@ -1,2 +1,3 @@\n a\n+b\n c"
	if got := StripDiffHeader(raw); got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
	// Already hunks-only, CRLF normalised, trailing newline trimmed.
	if got := StripDiffHeader("@@ -1 +1 @@\r\n-a\r\n+b\r\n"); got != "@@ -1 +1 @@\n-a\n+b" {
		t.Fatalf("got %q", got)
	}
	// No hunks (binary / mode change) → empty.
	if got := StripDiffHeader("diff --git a/x b/x\nBinary files differ\n"); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
	if got := StripDiffHeader(""); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}

func TestRepoFromRemote(t *testing.T) {
	cases := map[string]string{
		"https://github.com/acme/api.git":   "acme/api",
		"https://github.com/acme/api":       "acme/api",
		"git@github.com:acme/api.git":       "acme/api",
		"ssh://git@github.com/acme/api.git": "acme/api",
		"https://gitlab.com/acme/api.git":   "",
		"/local/path/repo":                  "",
		"":                                  "",
	}
	for in, want := range cases {
		if got := repoFromRemote(in); got != want {
			t.Errorf("repoFromRemote(%q) = %q, want %q", in, got, want)
		}
	}
}

// GitSource against a real temporary repository: two commits, one modified
// file, one added, one removed, one renamed. Skipped when git is missing.
func TestGitSource(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	dir := t.TempDir()
	run := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t",
			"GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_NOSYSTEM=1")
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}
	write := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	run("init", "-q", "-b", "main")
	run("config", "core.autocrlf", "false")
	write("db.go", "package p\n\nfunc a() {\n\tx := 1\n}\n")
	write("gone.go", "package p\n")
	write("moved.go", "package p\n\nfunc m() {}\n")
	run("add", ".")
	run("commit", "-q", "-m", "base")

	write("db.go", "package p\n\nfunc a() {\n\tx := 1\n\ty := 2\n}\n")
	write("new.go", "package p\n\nfunc n() {}\n")
	if err := os.Remove(filepath.Join(dir, "gone.go")); err != nil {
		t.Fatal(err)
	}
	run("mv", "moved.go", "renamed.go")
	run("add", "-A")
	run("commit", "-q", "-m", "change: add y")
	headSHA := run("rev-parse", "HEAD")

	src := &GitSource{Dir: dir, Base: "HEAD~1"}
	ctx := context.Background()

	if sha, err := src.HeadSHA(ctx); err != nil || sha != headSHA {
		t.Fatalf("HeadSHA = %q, %v; want %q", sha, err, headSHA)
	}
	if subj, err := src.HeadSubject(ctx); err != nil || subj != "change: add y" {
		t.Fatalf("HeadSubject = %q, %v", subj, err)
	}
	if repo := src.RemoteRepo(ctx); repo != "" {
		t.Fatalf("RemoteRepo = %q, want empty (no origin)", repo)
	}

	files, err := src.Files(ctx)
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]ChangedFile{}
	for _, f := range files {
		byName[f.Filename] = f
	}
	if len(files) != 4 {
		t.Fatalf("got %d files: %+v", len(files), files)
	}

	db := byName["db.go"]
	if db.Status != "modified" {
		t.Errorf("db.go status = %s", db.Status)
	}
	if !strings.HasPrefix(db.Patch, "@@") || strings.Contains(db.Patch, "diff --git") || strings.Contains(db.Patch, "+++") {
		t.Errorf("db.go patch not stripped to hunks:\n%s", db.Patch)
	}
	if h := diff.Parse(db.Patch); !reflect.DeepEqual(h.AddedLines, []int{5}) {
		t.Errorf("db.go added lines = %v, want [5]", h.AddedLines)
	}
	if byName["new.go"].Status != "added" || byName["gone.go"].Status != "removed" {
		t.Errorf("statuses: new=%s gone=%s", byName["new.go"].Status, byName["gone.go"].Status)
	}
	if r := byName["renamed.go"]; r.Status != "renamed" {
		t.Errorf("renamed.go = %+v", r)
	}
	if byName["gone.go"].Patch != "" {
		t.Errorf("removed file should carry no patch")
	}

	content, err := src.Content(ctx, "db.go")
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "package p\n\nfunc a() {\n\tx := 1\n\ty := 2\n}\n" {
		t.Errorf("Content = %q", content)
	}

	// Full pipeline in dry-run over the git source: one function chunk.
	res, err := (&Scanner{DryRun: true, Logf: t.Logf}).Scan(ctx, src, PRMeta{Repo: "local/x"})
	if err != nil {
		t.Fatal(err)
	}
	var chunks []string
	for _, f := range res.Files {
		for _, c := range f.Chunks {
			chunks = append(chunks, f.Filename+":"+c.FunctionName)
		}
	}
	// renamed.go has no added lines; new.go's package clause is inert (no window for it).
	want := []string{"db.go:a", "new.go:n"}
	if !reflect.DeepEqual(chunks, want) {
		t.Fatalf("chunks = %v, want %v", chunks, want)
	}

	if _, err := (&GitSource{Dir: dir}).Files(ctx); err == nil {
		t.Fatal("want error when Base is empty")
	}
}
