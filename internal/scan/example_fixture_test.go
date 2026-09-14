package scan

import (
	"context"
	"os"
	"strings"
	"testing"

	"secpr/internal/llm"
)

// TestWriteExampleFixture regenerates testdata/fixtures/example-scan.json,
// the checked-in sample of the fixture contract. It is a no-op unless
// SECPR_WRITE_FIXTURE names the output path:
//
//	SECPR_WRITE_FIXTURE=testdata/fixtures/example-scan.json go test ./internal/scan -run TestWriteExampleFixture
//
// (relative to the package directory, so from the repo root use
// ../../testdata/fixtures/example-scan.json).
func TestWriteExampleFixture(t *testing.T) {
	path := os.Getenv("SECPR_WRITE_FIXTURE")
	if path == "" {
		t.Skip("set SECPR_WRITE_FIXTURE=<path> to regenerate the example fixture")
	}

	const handlerSrc = `package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os/exec"
)

func listUsers(db *sql.DB) ([]User, error) {
	rows, err := db.Query("SELECT id, name FROM users")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUsers(rows)
}

func searchUsers(db *sql.DB, q string) ([]User, error) {
	rows, err := db.Query("SELECT * FROM users WHERE name = '" + q + "'")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUsers(rows)
}

func renderProfile(w http.ResponseWriter, name string) {
	fmt.Fprintf(w, "<h1>Welcome, %s</h1>", name)
}

func pingHost(host string) ([]byte, error) {
	return exec.Command("sh", "-c", "ping -c 1 "+host).Output()
}
`
	const handlerPatch = "@@ -4,6 +4,7 @@ import (\n" +
		" \t\"database/sql\"\n \t\"fmt\"\n \t\"net/http\"\n+\t\"os/exec\"\n )\n \n func listUsers(db *sql.DB) ([]User, error) {\n" +
		"@@ -14,3 +15,20 @@ func listUsers(db *sql.DB) ([]User, error) {\n" +
		" \tdefer rows.Close()\n \treturn scanUsers(rows)\n }\n" +
		"+\n+func searchUsers(db *sql.DB, q string) ([]User, error) {\n+\trows, err := db.Query(\"SELECT * FROM users WHERE name = '\" + q + \"'\")\n+\tif err != nil {\n+\t\treturn nil, err\n+\t}\n+\tdefer rows.Close()\n+\treturn scanUsers(rows)\n+}\n" +
		"+\n+func renderProfile(w http.ResponseWriter, name string) {\n+\tfmt.Fprintf(w, \"<h1>Welcome, %s</h1>\", name)\n+}\n" +
		"+\n+func pingHost(host string) ([]byte, error) {\n+\treturn exec.Command(\"sh\", \"-c\", \"ping -c 1 \"+host).Output()\n+}"

	const clientSrc = `import { api } from "./api";

export async function search(q: string) {
  const res = await api.get("/users/search", { params: { q } });
  return res.data;
}
`
	const clientPatch = "@@ -1,6 +1,6 @@\n import { api } from \"./api\";\n \n export async function search(q: string) {\n-  const res = await api.get(\"/users/search?q=\" + q);\n+  const res = await api.get(\"/users/search\", { params: { q } });\n   return res.data;\n }"

	src := &fakeSource{
		files: []ChangedFile{
			{Filename: "internal/handlers/users.go", Status: "modified", Patch: handlerPatch, Source: []byte(handlerSrc)},
			{Filename: "web/src/users.ts", Status: "modified", Patch: clientPatch, Source: []byte(clientSrc)},
			{Filename: "README.md", Status: "modified", Patch: "@@ -1,2 +1,3 @@\n # api\n+Search endpoint added.\n "},
		},
	}
	rev := &fakeReviewer{byFunc: map[string][]llm.Finding{
		"searchUsers": {{
			CWE: "CWE-89", Severity: "HIGH", Line: 2,
			Summary:      "User-supplied 'q' is concatenated directly into a SQL string without parameterisation.",
			WhyItMatters: "An attacker can append OR 1=1-- to dump the entire users table, or use UNION SELECT to exfiltrate arbitrary data.",
			FixPatch:     "\trows, err := db.Query(\"SELECT * FROM users WHERE name = ?\", q)",
			Confidence:   0.99,
		}},
		"renderProfile": {{
			CWE: "CWE-79", Severity: "MEDIUM", Line: 2,
			Summary:      "Unescaped 'name' is written into an HTML response.",
			WhyItMatters: "An attacker can supply a name containing <script> and run JavaScript in other users' browsers.",
			FixPatch:     "\tfmt.Fprintf(w, \"<h1>Welcome, %s</h1>\", html.EscapeString(name))",
			Confidence:   0.95,
		}},
		"pingHost": {{
			CWE: "CWE-78", Severity: "CRITICAL", Line: 2,
			Summary:      "'host' is interpolated into a shell command run via sh -c.",
			WhyItMatters: "An attacker can pass \"; rm -rf /\" as the host and execute arbitrary commands on the server.",
			FixPatch:     "\treturn exec.Command(\"ping\", \"-c\", \"1\", host).Output()",
			Confidence:   0.99,
		}},
	}}
	meta := PRMeta{Repo: "acme/api", Number: 142, Title: "Add user search endpoint", HeadSHA: "3f2a9c1d7b4e2f0a9c1d7b4e2f0a9c1d7b4e2f0a"}

	sc := &Scanner{Reviewer: rev, Now: fixedNow, Logf: t.Logf}
	res, err := sc.Scan(context.Background(), src, meta)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Findings) != 3 {
		t.Fatalf("scenario produced %d findings, want 3", len(res.Findings))
	}
	res.Stats.Duration = 8400 // deterministic

	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := WriteFixture(f, ToFixture(res, "secpr 0.1.0 · example (fake reviewer)", 1757800000)); err != nil {
		t.Fatal(err)
	}
	t.Logf("wrote %s", strings.TrimSpace(path))
}
