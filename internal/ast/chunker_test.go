package ast

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func readTestdata(t *testing.T, rel string) []byte {
	t.Helper()
	src, err := os.ReadFile(filepath.Join("..", "..", "testdata", rel))
	if err != nil {
		t.Fatal(err)
	}
	return src
}

func TestDetectLang(t *testing.T) {
	cases := map[string]string{
		"a.go": "go", "b.js": "js", "c.jsx": "js", "d.ts": "ts", "e.tsx": "tsx",
		"f.py": "py", "g.java": "java", "h.rs": "rs", "i.rb": "rb",
		"j.c": "c", "k.cpp": "cpp", "l.kt": "kt", "m.swift": "swift",
		"n.cs": "cs", "o.php": "php", "p.sh": "sh",
		"README.md": "unknown", "Makefile": "unknown", "x.yaml": "unknown",
	}
	for file, want := range cases {
		if got := DetectLang(file); got != want {
			t.Errorf("DetectLang(%q) = %q, want %q", file, got, want)
		}
	}
}

// Changed lines inside a function → one function chunk with the right
// name, absolute start/end and chunk-relative changed lines.
func TestMakeChunksGoFunction(t *testing.T) {
	src := readTestdata(t, "clean/clean-prepared.go") // searchUsers spans lines 5-12
	chunks := MakeChunks(src, "go", "db.go", []int{6, 7, 8})

	if len(chunks) != 1 {
		t.Fatalf("got %d chunks, want 1: %+v", len(chunks), chunks)
	}
	c := chunks[0]
	if c.FunctionName != "searchUsers" || c.Kind != KindFunction {
		t.Fatalf("chunk = %s/%s, want searchUsers/function", c.FunctionName, c.Kind)
	}
	if c.StartLine != 5 || c.EndLine != 12 {
		t.Fatalf("lines %d-%d, want 5-12", c.StartLine, c.EndLine)
	}
	if want := []int{2, 3, 4}; !reflect.DeepEqual(c.ChangedLines, want) {
		t.Fatalf("ChangedLines = %v (relative), want %v", c.ChangedLines, want)
	}
	if want := []int{6, 7, 8}; !reflect.DeepEqual(c.AbsoluteChangedLines(), want) {
		t.Fatalf("AbsoluteChangedLines = %v, want %v", c.AbsoluteChangedLines(), want)
	}
	if !strings.HasPrefix(c.FunctionBody, "func searchUsers(") || !strings.HasSuffix(c.FunctionBody, "}") {
		t.Fatalf("FunctionBody does not cover the whole function:\n%s", c.FunctionBody)
	}
	if c.File != "db.go" || c.Language != "go" {
		t.Fatalf("file/lang = %s/%s", c.File, c.Language)
	}
}

// Every vuln fixture is a single function; a change on its second line
// must resolve to that function, and EndLine must be the real last line
// even when the fixture lacks a closing brace (sqli-concat.go) or a
// trailing newline.
func TestMakeChunksVulnFixtures(t *testing.T) {
	want := map[string]struct {
		name       string
		start, end int
	}{
		"cmd-injection-sh.go":    {"pingHost", 1, 3},
		"cmd-injection-shell.go": {"archiveLog", 1, 3},
		"hardcoded-jwt.go":       {"signToken", 1, 5},
		"hardcoded-secret.go":    {"newClient", 1, 3},
		"path-traversal.go":      {"readUserFile", 1, 4},
		"sqli-concat.go":         {"searchUsers", 2, 6},
		"sqli-sprintf.go":        {"getOrder", 1, 4},
		"weak-crypto.go":         {"hashPassword", 1, 5},
		"xss-innerhtml.go":       {"renderProfile", 1, 3},
		"xss-template.go":        {"renderComment", 1, 4},
	}
	for file, w := range want {
		src := readTestdata(t, "vulns/"+file)
		chunks := MakeChunks(src, "go", file, []int{2})
		if len(chunks) != 1 {
			t.Errorf("%s: got %d chunks, want 1", file, len(chunks))
			continue
		}
		c := chunks[0]
		if c.Kind != KindFunction {
			t.Errorf("%s: kind = %s, want function", file, c.Kind)
		}
		if w.name != "" && c.FunctionName != w.name {
			t.Errorf("%s: name = %s, want %s", file, c.FunctionName, w.name)
		}
		if c.StartLine != w.start || c.EndLine != w.end {
			t.Errorf("%s: lines %d-%d, want %d-%d", file, c.StartLine, c.EndLine, w.start, w.end)
		}
		if lines := strings.Count(c.FunctionBody, "\n") + 1; lines != w.end-w.start+1 {
			t.Errorf("%s: body has %d lines, want %d", file, lines, w.end-w.start+1)
		}
		if !reflect.DeepEqual(c.ChangedLines, []int{2 - w.start + 1}) {
			t.Errorf("%s: ChangedLines = %v", file, c.ChangedLines)
		}
	}
}

func TestMakeChunksCleanFixtures(t *testing.T) {
	dir := filepath.Join("..", "..", "testdata", "clean")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		src, _ := os.ReadFile(filepath.Join(dir, e.Name()))
		lineCount := len(splitLines(src))
		// Change the last line of the file: it is inside the (only) function
		// in every clean fixture, so we must get a function chunk whose
		// EndLine is the real last line.
		chunks := MakeChunks(src, "go", e.Name(), []int{lineCount})
		if len(chunks) != 1 || chunks[0].Kind != KindFunction {
			t.Errorf("%s: chunks = %+v, want one function chunk", e.Name(), chunks)
			continue
		}
		if chunks[0].EndLine != lineCount {
			t.Errorf("%s: EndLine = %d, want %d", e.Name(), chunks[0].EndLine, lineCount)
		}
	}
}

// Two changed lines in different functions → two chunks, in source order.
func TestMakeChunksTwoFunctions(t *testing.T) {
	src := []byte("package p\n\nfunc a() {\n\tx := 1\n}\n\nfunc b() {\n\ty := 2\n}\n")
	chunks := MakeChunks(src, "go", "p.go", []int{4, 8})
	if len(chunks) != 2 {
		t.Fatalf("got %d chunks, want 2", len(chunks))
	}
	if chunks[0].FunctionName != "a" || chunks[0].StartLine != 3 || chunks[0].EndLine != 5 {
		t.Errorf("chunk 0 = %+v", chunks[0])
	}
	if chunks[1].FunctionName != "b" || chunks[1].StartLine != 7 || chunks[1].EndLine != 9 {
		t.Errorf("chunk 1 = %+v", chunks[1])
	}
}

// Methods resolve by their name, and nested closures pick the innermost
// enclosing function.
func TestMakeChunksMethodAndClosure(t *testing.T) {
	src := []byte(strings.Join([]string{
		"package p",
		"",
		"type S struct{}",
		"",
		"func (s *S) Handle() {",
		"\tgo func() {",
		"\t\tpanic(1)",
		"\t}()",
		"}",
		"",
	}, "\n"))
	chunks := MakeChunks(src, "go", "p.go", []int{7})
	if len(chunks) != 1 {
		t.Fatalf("got %d chunks, want 1", len(chunks))
	}
	// The innermost function is the closure (a func_literal, no name).
	if chunks[0].StartLine != 6 || chunks[0].EndLine != 8 || chunks[0].Kind != KindFunction {
		t.Fatalf("chunk = %+v, want closure lines 6-8", chunks[0])
	}
	if !strings.HasPrefix(chunks[0].FunctionName, "func_literal@") {
		t.Fatalf("name = %q, want func_literal@N", chunks[0].FunctionName)
	}

	chunks = MakeChunks(src, "go", "p.go", []int{5})
	if len(chunks) != 1 || chunks[0].FunctionName != "Handle" || chunks[0].StartLine != 5 || chunks[0].EndLine != 9 {
		t.Fatalf("method chunk = %+v", chunks)
	}
}

// Changed lines outside any function → window fallback.
// A 12-line file whose line 3 is a top-level var (reviewable, outside any
// function) — package and import lines are inert and covered elsewhere.
const outsideSrc = `package db

var defaultLimit = 100

func searchUsers(db *sql.DB, q string) ([]User, error) {
	rows, err := db.Query("SELECT * FROM users WHERE name = ?", q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUsers(rows)
}
`

func TestMakeChunksOutsideFunctionUsesWindow(t *testing.T) {
	src := []byte(outsideSrc)
	chunks := MakeChunks(src, "go", "db.go", []int{3})
	if len(chunks) != 1 {
		t.Fatalf("got %d chunks, want 1", len(chunks))
	}
	c := chunks[0]
	if c.Kind != KindWindow || c.FunctionName != "chunk@1-12" {
		t.Fatalf("chunk = %s/%s, want chunk@1-12/window", c.FunctionName, c.Kind)
	}
	if c.StartLine != 1 || c.EndLine != 12 {
		t.Fatalf("lines %d-%d, want 1-12 (clamped to file)", c.StartLine, c.EndLine)
	}
	if !reflect.DeepEqual(c.ChangedLines, []int{3}) {
		t.Fatalf("ChangedLines = %v, want [3]", c.ChangedLines)
	}
	if strings.Count(c.FunctionBody, "\n") != 11 {
		t.Fatalf("window body has %d lines, want 12", strings.Count(c.FunctionBody, "\n")+1)
	}
}

// Mixed: one line in a function, one outside → function chunk + window.
func TestMakeChunksMixedInsideAndOutside(t *testing.T) {
	src := []byte(outsideSrc)
	chunks := MakeChunks(src, "go", "db.go", []int{3, 6})
	if len(chunks) != 2 {
		t.Fatalf("got %d chunks, want 2", len(chunks))
	}
	if chunks[0].Kind != KindFunction || chunks[0].FunctionName != "searchUsers" {
		t.Errorf("chunk 0 = %+v", chunks[0])
	}
	if chunks[1].Kind != KindWindow || !reflect.DeepEqual(chunks[1].ChangedLines, []int{3}) {
		t.Errorf("chunk 1 = %+v", chunks[1])
	}
}

// Unsupported language (no tree-sitter grammar) → window fallback with a
// ±30 window and relative changed lines.
func TestMakeChunksUnsupportedLanguageWindow(t *testing.T) {
	var b strings.Builder
	for i := 1; i <= 100; i++ {
		b.WriteString("line\n")
	}
	src := []byte(b.String())
	chunks := MakeChunks(src, "sh", "x.sh", []int{50, 52})
	if len(chunks) != 1 {
		t.Fatalf("got %d chunks, want 1", len(chunks))
	}
	c := chunks[0]
	if c.Kind != KindWindow || c.StartLine != 20 || c.EndLine != 82 {
		t.Fatalf("chunk = %s lines %d-%d, want window 20-82", c.Kind, c.StartLine, c.EndLine)
	}
	if want := []int{31, 33}; !reflect.DeepEqual(c.ChangedLines, want) {
		t.Fatalf("ChangedLines = %v, want %v", c.ChangedLines, want)
	}
	if want := []int{50, 52}; !reflect.DeepEqual(c.AbsoluteChangedLines(), want) {
		t.Fatalf("AbsoluteChangedLines = %v, want %v", c.AbsoluteChangedLines(), want)
	}
}

// Window groups split when changed lines are more than 5 apart.
func TestMakeChunksWindowGroups(t *testing.T) {
	src := []byte(strings.Repeat("x\n", 200))
	chunks := MakeChunks(src, "unknown", "f.txt", []int{10, 12, 100})
	if len(chunks) != 2 {
		t.Fatalf("got %d chunks, want 2 groups", len(chunks))
	}
	if chunks[0].StartLine != 1 || chunks[0].EndLine != 42 {
		t.Errorf("group 0 = %d-%d, want 1-42", chunks[0].StartLine, chunks[0].EndLine)
	}
	if chunks[1].StartLine != 70 || chunks[1].EndLine != 130 {
		t.Errorf("group 1 = %d-%d, want 70-130", chunks[1].StartLine, chunks[1].EndLine)
	}
}

// Blank lines between functions are not reviewable and must not produce
// window chunks; non-blank orphans (a package clause, an import) still do.
func TestMakeChunksIgnoresBlankOrphans(t *testing.T) {
	// 1 package, 3 var, 5-7 func a, 9-11 func b; 2/4/8 blank.
	src := []byte("package p\n\nvar z = 3\n\nfunc a() {\n\tx := 1\n}\n\nfunc b() {\n\ty := 2\n}\n")
	chunks := MakeChunks(src, "go", "p.go", []int{2, 6, 8, 10})
	if len(chunks) != 2 {
		t.Fatalf("got %d chunks, want 2 function chunks and no windows: %+v", len(chunks), chunks)
	}
	for _, c := range chunks {
		if c.Kind != KindFunction {
			t.Errorf("unexpected %s chunk %s", c.Kind, c.FunctionName)
		}
	}
	// Only blank orphans → no chunks at all.
	if got := MakeChunks(src, "go", "p.go", []int{2, 4, 8}); len(got) != 0 {
		t.Fatalf("blank-only change produced %+v", got)
	}
	// The package clause is inert too.
	if got := MakeChunks(src, "go", "p.go", []int{1}); len(got) != 0 {
		t.Fatalf("package-line change produced %+v, want nothing", got)
	}
	// A reviewable orphan (top-level var) still gets a window.
	if got := MakeChunks(src, "go", "p.go", []int{3, 4}); len(got) != 1 || got[0].Kind != KindWindow || !reflect.DeepEqual(got[0].ChangedLines, []int{3}) {
		t.Fatalf("var-line change = %+v, want one window with changed [3]", got)
	}
}

// Groups far apart in a small file clamp to the same window; they are
// merged rather than sent twice.
func TestMakeChunksMergesIdenticalWindows(t *testing.T) {
	// 30-line file: 5, 20 and 28 are three groups (>5 apart) whose ±30
	// windows all clamp to 1-30.
	src := []byte(strings.Repeat("x\n", 30))
	chunks := MakeChunks(src, "unknown", "f.txt", []int{5, 20, 28})
	if len(chunks) != 1 {
		t.Fatalf("got %d chunks, want 1 merged window: %+v", len(chunks), chunks)
	}
	c := chunks[0]
	if c.StartLine != 1 || c.EndLine != 30 || c.FunctionName != "chunk@1-30" {
		t.Fatalf("chunk = %+v", c)
	}
	if !reflect.DeepEqual(c.ChangedLines, []int{5, 20, 28}) {
		t.Fatalf("ChangedLines = %v, want [5 20 28]", c.ChangedLines)
	}
	// Windows that differ are kept apart.
	chunks = MakeChunks([]byte(strings.Repeat("x\n", 100)), "unknown", "f.txt", []int{10, 90})
	if len(chunks) != 2 {
		t.Fatalf("got %d chunks, want 2 distinct windows", len(chunks))
	}
}

func TestMakeChunksNoChangedLines(t *testing.T) {
	if got := MakeChunks([]byte("package p\n"), "go", "p.go", nil); got != nil {
		t.Fatalf("got %v, want nil", got)
	}
}

func TestMakeChunksChangedLinePastEOF(t *testing.T) {
	// A stale diff can reference lines the source does not have; must not panic.
	if got := MakeChunks([]byte("a\nb\n"), "unknown", "f", []int{500}); len(got) != 0 {
		t.Fatalf("got %v, want no chunks", got)
	}
}

func TestMakeChunksJavaScript(t *testing.T) {
	src := []byte(strings.Join([]string{
		"const express = require('express');",
		"",
		"function render(req, res) {",
		"  res.send('<h1>' + req.query.name + '</h1>');",
		"}",
		"",
		"const handler = (req, res) => {",
		"  res.json({ ok: true });",
		"};",
		"",
	}, "\n"))
	chunks := MakeChunks(src, "js", "app.js", []int{4})
	if len(chunks) != 1 || chunks[0].FunctionName != "render" || chunks[0].StartLine != 3 || chunks[0].EndLine != 5 {
		t.Fatalf("js function chunk = %+v", chunks)
	}
	if !reflect.DeepEqual(chunks[0].ChangedLines, []int{2}) {
		t.Fatalf("ChangedLines = %v, want [2]", chunks[0].ChangedLines)
	}

	// Arrow function assigned to a const: innermost function is the arrow.
	chunks = MakeChunks(src, "js", "app.js", []int{8})
	if len(chunks) != 1 || chunks[0].Kind != KindFunction || chunks[0].StartLine != 7 || chunks[0].EndLine != 9 {
		t.Fatalf("js arrow chunk = %+v", chunks)
	}
}

func TestMakeChunksTypeScript(t *testing.T) {
	src := []byte(strings.Join([]string{
		"import { Request, Response } from 'express';",
		"",
		"export class UserController {",
		"  async search(req: Request, res: Response): Promise<void> {",
		"    const rows = await db.query(`SELECT * FROM users WHERE name = '${req.query.q}'`);",
		"    res.json(rows);",
		"  }",
		"}",
		"",
	}, "\n"))
	chunks := MakeChunks(src, "ts", "users.ts", []int{5})
	if len(chunks) != 1 {
		t.Fatalf("got %d chunks, want 1", len(chunks))
	}
	c := chunks[0]
	if c.FunctionName != "search" || c.Kind != KindFunction || c.StartLine != 4 || c.EndLine != 7 {
		t.Fatalf("ts method chunk = %+v", c)
	}
	if !reflect.DeepEqual(c.ChangedLines, []int{2}) {
		t.Fatalf("ChangedLines = %v, want [2]", c.ChangedLines)
	}
}

func TestMakeChunksPython(t *testing.T) {
	src := []byte(strings.Join([]string{
		"import subprocess",
		"TIMEOUT = 5",
		"",
		"def ping(host):",
		"    return subprocess.run('ping -c 1 ' + host, shell=True)",
		"",
		"",
		"class Svc:",
		"    async def fetch(self, url):",
		"        return await http.get(url)",
		"",
	}, "\n"))
	chunks := MakeChunks(src, "py", "svc.py", []int{5})
	if len(chunks) != 1 || chunks[0].FunctionName != "ping" || chunks[0].StartLine != 4 || chunks[0].EndLine != 5 {
		t.Fatalf("py function chunk = %+v", chunks)
	}
	chunks = MakeChunks(src, "py", "svc.py", []int{10})
	if len(chunks) != 1 || chunks[0].FunctionName != "fetch" || chunks[0].StartLine != 9 || chunks[0].EndLine != 10 {
		t.Fatalf("py async method chunk = %+v", chunks)
	}
	// Module-level import → inert, nothing to review.
	if chunks = MakeChunks(src, "py", "svc.py", []int{1}); len(chunks) != 0 {
		t.Fatalf("py import-line chunk = %+v, want none", chunks)
	}
	// Module-level statement → window.
	chunks = MakeChunks(src, "py", "svc.py", []int{2})
	if len(chunks) != 1 || chunks[0].Kind != KindWindow {
		t.Fatalf("py module-level chunk = %+v, want window", chunks)
	}
}

// A newly added file changes every line. The package clause, import block
// and comments are inert and must not produce a window chunk that duplicates
// the function chunks — that is how a real finding ended up pinned to an
// `"os/exec"` import line on the first live run.
func TestMakeChunksNewFileHeaderIsInert(t *testing.T) {
	src := []byte(`package ops

import (
	"net/http"
	"os/exec"
)

// Health pings an upstream host named in the query string.
func Health(w http.ResponseWriter, r *http.Request) {
	host := r.URL.Query().Get("host")
	pingHost(host)
}

func pingHost(host string) ([]byte, error) {
	return exec.Command("sh", "-c", "ping -c 1 "+host).Output()
}
`)
	all := make([]int, 16)
	for i := range all {
		all[i] = i + 1
	}
	chunks := MakeChunks(src, "go", "health.go", all)
	var names []string
	for _, c := range chunks {
		names = append(names, c.Kind+":"+c.FunctionName)
	}
	want := []string{"function:Health", "function:pingHost"}
	if !reflect.DeepEqual(names, want) {
		t.Fatalf("chunks = %v, want %v (no window for package/import/comment lines)", names, want)
	}
}

// A top-level const is reviewable (hard-coded secrets live there), so a
// changed const line outside any function still gets a window.
func TestMakeChunksTopLevelConstStillWindowed(t *testing.T) {
	src := []byte(`package cfg

import "os"

const apiKey = "sk-live-4xK9mN2pL8wR3vQs9"

func key() string { return apiKey }
`)
	chunks := MakeChunks(src, "go", "cfg.go", []int{1, 3, 5})
	if len(chunks) != 1 || chunks[0].Kind != KindWindow {
		t.Fatalf("chunks = %+v, want exactly one window chunk for the const line", chunks)
	}
	if got := chunks[0].AbsoluteChangedLines(); !reflect.DeepEqual(got, []int{5}) {
		t.Fatalf("window changed lines = %v, want [5] (package and import lines dropped)", got)
	}
}

func TestMakeChunksPythonImportsAreInert(t *testing.T) {
	src := []byte(`import os
from subprocess import run
# helper module

def ping(host):
    return run("ping -c 1 " + host, shell=True)
`)
	chunks := MakeChunks(src, "py", "ping.py", []int{1, 2, 3, 5, 6})
	if len(chunks) != 1 || chunks[0].Kind != KindFunction || chunks[0].FunctionName != "ping" {
		t.Fatalf("chunks = %+v, want only the ping() function chunk", chunks)
	}
}
