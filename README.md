# SecPR

SecPR reviews every pull request for security vulnerabilities with Claude and posts the results as inline comments, a summary, and a check run — pinned to the exact changed line, with a click-to-apply fix. It only sends the functions a PR actually touched, so the review is fast, cheap, and low-noise.

---

## Install (GitHub Action, no infrastructure)

1. Fork or use this repo as the action source.
2. Add an `ANTHROPIC_API_KEY` secret to the repository you want reviewed (**Settings → Secrets and variables → Actions**).
3. Add `.github/workflows/secpr.yml`:

```yaml
name: SecPR
on: pull_request
jobs:
  secpr:
    runs-on: ubuntu-latest
    permissions: { contents: read, pull-requests: write, checks: write }
    steps:
      - uses: OWNER/secpr@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

That's it. The next PR gets a **SecPR** check run, inline comments with `suggestion` blocks, and a severity summary.

Optional inputs:

| Input | Default | Meaning |
|---|---|---|
| `anthropic_api_key` | — | Required. Your Anthropic key; billed to you. |
| `github_token` | `${{ github.token }}` | Token used to post comments and the check run. |
| `model` | `claude-opus-5` | Any current Claude model that supports structured outputs. |
| `fail_on` | `high` | Fail the check when a finding is at or above this severity (`critical`, `high`, `medium`, `low`, `none`). |

Notes:

- PRs from forks get a read-only `GITHUB_TOKEN`; SecPR logs the failed comment posts and still prints the findings in the job log, the job summary, and as workflow annotations.
- The action uses the PR head SHA from the event (not the merge commit), so annotations line up with the diff.
- The action runs as a Docker container built from this repo's `Dockerfile` (CGO for tree-sitter), so the first run on a runner takes a couple of minutes.

---

## CLI

One binary, three modes. Build it with `go build ./cmd/secpr` (see [Development](#development) for the CGO requirement).

```bash
export ANTHROPIC_API_KEY=sk-ant-...

# Review a GitHub PR (public repo needs no token; private needs GITHUB_TOKEN)
secpr scan --repo acme/api --pr 142

# ...and post the comments + check run to it
secpr scan --repo acme/api --pr 142 --post --token $GITHUB_TOKEN

# Review your local branch against main, before opening a PR
secpr scan --local --base main

# See exactly which functions would be sent to the model — no API key needed
secpr scan --local --base main --dry-run

# Write the fixture JSON the dashboard's /demo page replays
secpr scan --local --base HEAD~1 --fixture-out demo.json

# Machine-readable output, and a non-zero exit on anything HIGH or worse
secpr scan --local --base main --json --fail-on high
```

Flags common to `scan`:

| Flag | Meaning |
|---|---|
| `--api-key` / `--model` | Override `ANTHROPIC_API_KEY` / `SECPR_MODEL` (default model `claude-opus-5`). |
| `--dry-run` | Run diff parsing and AST chunking only; print the chunks; make no model calls. |
| `--json` | Print the fixture document (files, chunks, findings, stats) instead of a human report. |
| `--fixture-out PATH` | Also write that document to a file. |
| `--fail-on LEVEL` | Exit 1 when any finding meets the level. Default `none`. |
| `--local --base REV [--head REV] [--dir PATH]` | Scan `git diff BASE..HEAD` in a local checkout. `--repo`, `--pr`, `--title` are labels only. |
| `--repo OWNER/NAME --pr N [--token T] [--post]` | Scan a GitHub PR. `--post` writes comments and the check run. |

`secpr action` is what `action.yml` runs; it reads the GitHub Actions environment (`GITHUB_EVENT_PATH`, `INPUT_*`) and needs no flags. `secpr serve` is the self-hosted webhook server (below). `secpr version` prints the version.

---

## How it works

```
PR opened → GitHub Action · CLI · webhook
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼               ▼
              Fetch diff      AST chunking    (HMAC verify,
                    │              │           webhook mode)
                    └──────┬───────┘
                           ▼
                     Claude AI review
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        Inline PR     Check run     Fixture / JSON
        comments    annotations    (or Postgres in
                                    webhook mode)
                                        │
                                        ▼
                               Next.js Dashboard
```

1. The changed files are listed (GitHub API or `git diff --name-status`), removed and non-code files are skipped.
2. Each patch is parsed to the set of **added** line numbers.
3. The full file at the PR head is parsed with tree-sitter (Go, JavaScript/TypeScript, Python, Java, Rust, Ruby). For every added line, the innermost enclosing function becomes one chunk. Lines outside any function, or in languages without a grammar, fall back to a ±30-line window.
4. Each chunk goes to Claude with the system prompt (cached across chunks) and the list of changed lines. The response is constrained to a JSON schema of findings.
5. `Validate` drops anything that is not on a changed line, is below the confidence floor, is missing a field, or duplicates a CWE on the same line — the hallucination filter.
6. Chunk-relative lines become absolute file lines; findings are posted as inline comments with a `suggestion` block, summarised in a PR comment, and reported through a check run.

Most scanners run against whole files or repositories and drown developers in noise. Given a diff like:

```diff
+ func transfer(amount int, to string) {
+     db.Exec("UPDATE accounts SET balance = balance - " + amount)
+ }
```

SecPR extracts just the `transfer` function, understands it's Go, and flags the SQL injection on the exact diff line — not across a 500-line file.

The system prompt was tuned against `testdata/vulns/` and `testdata/clean/`; the iteration history is in [`testdata/results/`](testdata/results/README.md).

---

## Self-hosted webhook mode (optional)

If you would rather run SecPR as a GitHub App than as an Action — for org-wide coverage and the dashboard's live findings feed — `secpr serve` is the long-running webhook server:

```bash
# Required: WEBHOOK_SECRET, GITHUB_APP_ID, GITHUB_PRIVATE_KEY_PATH (or GITHUB_PRIVATE_KEY), ANTHROPIC_API_KEY
# Optional: DATABASE_URL (Neon/Postgres; in-memory store if unset), PORT (8080), SECPR_MODEL
secpr serve
ngrok http 8080   # point the App's webhook URL at https://<id>.ngrok-free.app/webhook
```

It exposes `POST /webhook`, `POST /rescan`, `GET /findings`, `GET /prs`, `GET /health`. The `Dockerfile` defaults to `serve`, and `.github/workflows/cloud-run-deploy.yml` is a manual (`workflow_dispatch`) Cloud Run deploy for it. The Action path needs none of this.

The dashboard that reads from it lives in [`secpr-dashboard/`](secpr-dashboard/) (Next.js; see its README). Its `/demo` page replays a fixture produced by `secpr scan --fixture-out`.

---

## Development

Go 1.26+, a C compiler, and `CGO_ENABLED=1` — tree-sitter is a C library.

```bash
export CGO_ENABLED=1
go build ./... && go vet ./... && go test ./...
go run ./cmd/secpr --help
```

The tests need no network and no API key: the Anthropic client is exercised against an `httptest` server, the scan pipeline against a fake source and a fake reviewer, and `GitSource` against a temporary git repository. CI (`.github/workflows/ci.yml`) runs the same three commands on `ubuntu-latest`.

Layout:

```
cmd/secpr/         scan · action · serve · version
internal/scan/     the pipeline: Source → Scanner → Result → Sinks; fixture writer
internal/ast/      tree-sitter chunking (Chunk has absolute StartLine/EndLine)
internal/diff/     unified-diff → added lines + diff positions
internal/llm/      Anthropic SDK client, system prompt, JSON schema, Validate
internal/output/   GitHub comments, summary, check run
internal/github/   GitHub REST + App auth
internal/store/    Postgres / in-memory store (serve mode only)
internal/webhook/  HMAC verification
testdata/          prompt fixtures and iteration history
```

---

## Bring your own key

SecPR ships no key and runs no service of its own. Every review is billed to the `ANTHROPIC_API_KEY` you provide, at Anthropic's normal rates; the system prompt is cached, so a typical PR costs a few cents. The key is read only by the process you run (the Action container, your shell, or your server) and is sent only to `api.anthropic.com`.
