# Demo fixtures

Each `*.json` file in this directory is one recorded scan of one pull request. The `/demo` page replays
them — there is no backend, no network call and no model call behind the demo; everything it shows comes
from these files, imported at build time by `lib/fixtures.ts`.

## Producing a fixture

Real fixtures come from the scanner:

```bash
secpr scan --repo owner/name --pr 142 --fixture-out secpr-dashboard/demo-fixtures/owner-name-142.json
cd secpr-dashboard
npm run validate:fixtures
```

Then add the new file to the `FIXTURES` list in `lib/fixtures.ts` (the validator fails until you do) and
it appears as a card on the demo's first step.

The two fixtures currently checked in are **placeholders**: hand-built from the hackathon eval output in
`testdata/` and `vuln-results-v3.json`, with `generator` set accordingly. They are internally consistent
(they pass the validator) but the surrounding code is invented. Replace them with real scanner output.

## Schema (`schema_version: 1`)

```jsonc
{
  "schema_version": 1,
  "generated_at": 1757800000,                    // unix seconds
  "generator": "secpr 0.1.0 · claude-opus-5",   // free text, shown in the demo header
  "pr": {
    "repo": "owner/name",
    "number": 142,
    "title": "Add user search endpoint",
    "head_sha": "3f2a9c1d",
    "files": [
      {
        "filename": "internal/handlers/search.go",
        "language": "go",                        // go | js | ts | tsx | py | java | rs | rb | … | unknown
        "status": "modified",                    // added | modified | renamed
        "patch": "@@ -10,5 +10,8 @@\n a\n+b\n",  // GitHub `patch` format: unified-diff hunks only, no file header
        "source": "package handlers\n...",       // full new-file contents at head
        "added_lines": [12, 13, 14],             // absolute 1-based lines in the new file
        "chunks": [
          {
            "function_name": "searchUsers",      // or "chunk@10-70" for the window fallback
            "kind": "function",                  // "function" | "window"
            "start_line": 10,                    // absolute, inclusive
            "end_line": 25,                      // absolute, inclusive
            "changed_lines": [12, 13, 14]        // absolute
          }
        ]
      }
    ]
  },
  "findings": [
    {
      "id": "F-3a9cf12b",                        // "F-" + 8 hex (sha256 of cwe:file:line)
      "repo": "owner/name",
      "pr": 142,
      "file": "internal/handlers/search.go",
      "line": 87,                                // absolute 1-based line in the new file
      "cwe": "CWE-89",
      "severity": "CRITICAL",                    // CRITICAL | HIGH | MEDIUM | LOW
      "summary": "...",
      "why_it_matters": "...",
      "fix_patch": "...",                        // replacement text for the vulnerable line(s), original indentation
      "confidence": 0.95,                        // 0.87 | 0.91 | 0.95 | 0.99
      "created_at": 1757800000,
      "status": "open"                           // open | acknowledged | fixed | suppressed
    }
  ],
  "stats": { "files": 3, "chunks": 5, "llm_calls": 5, "duration_ms": 8400 }   // optional
}
```

### Rules the validator enforces

- `schema_version` is `1`.
- For every scanned file, `added_lines` equals the new-file line numbers of the `+` lines derived from `patch`
  (a skipped file — `chunks: []` — may leave `added_lines` empty; that is only a warning).
- Every chunk: `changed_lines ⊆ added_lines`, and
  `start_line ≤ min(changed_lines) ≤ max(changed_lines) ≤ end_line ≤ number of lines in source`
  (line count uses Go's `strings.Split` semantics, so a trailing newline counts as one more line).
- Every finding's `file` exists in `pr.files`, and its `line` is in some chunk's `changed_lines` of that file.
- `severity`, `status`, file `status` and chunk `kind` are in their enums; ids look like `F-xxxxxxxx`.
- Every `*.json` here is imported in `lib/fixtures.ts`.

Files with `chunks: []` are shown as **skipped** (unknown language or nothing added). Findings are expected
to be post-validation output — the demo does not re-apply the ≥ 0.87 confidence gate.
