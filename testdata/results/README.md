# Prompt iteration history

The system prompt in `internal/llm/prompt.go` was tuned over four rounds
against the fixtures in `testdata/vulns/` (ten single-function files, each
with one textbook vulnerability) and `testdata/clean/` (ten safe functions
that look superficially suspicious: prepared statements, `exec.Command`
with separate args, `html.EscapeString`, `os.Getenv` for secrets, ...).

The loop for each round was:

1. Run every fixture through the chunker + reviewer harness with the
   current prompt (the old `cmd/test-claude` harness; today the equivalent
   is `internal/llm` `Client.Review` on a single chunk).
2. Check two things: every vuln fixture produces exactly one finding with
   the right CWE and line, and every clean fixture produces `{"findings": []}`.
3. Edit the prompt to fix the failures, without regressing the other set.

What is kept here:

| File | What it is |
|---|---|
| `prompt-v0.txt` | The starting prompt — loose schema, free-floating confidence, no examples. It over-reported on the clean set and returned prose around the JSON. |
| `vuln-results-v3.json` | Raw findings from round 3 on three vuln fixtures (`cmd-injection-sh`, `cmd-injection-shell`, `hardcoded-jwt`). Note the duplicated CWE-326 on the same line and the `confidence: 1` values — both were addressed in v4 by the fixed confidence scale and the one-CWE-per-line rule. |
| `clean-results-v4.json` | Round 4 over the whole clean set: every file produced no findings (the file lists the fixture headers with nothing under them). This is the prompt that shipped. |

The differences between v0 and the current prompt, in order of impact:

- A fixed confidence scale (0.87 / 0.91 / 0.95 / 0.99) with instructions to
  omit anything below 0.87, instead of "lower the confidence if unsure".
  `llm.Validate` enforces the same floor.
- Explicit safe patterns that must not be flagged (`exec.Command` with
  separate args, ignored return values, existing sanitisation).
- A worked example of a correct finding, including the `fix_patch` shape
  (replacement text only, original indentation, no diff markers).
- One CWE per line, and "only lines in `<changed_lines>`" stated twice.

Do not edit the prompt wording without re-running both fixture sets.

## Re-run on Claude Opus 5 (2026-09-14)

When the reviewer moved from the hackathon model (`claude-sonnet-4-6`,
`temperature: 0`, free-form JSON) to `claude-opus-5` with structured
outputs, both sets were re-run unchanged through the shipped binary
(`resolvepr scan --local --fixture-out`; each set staged as one PR whose base
holds only the `package` line, so every file yields exactly one function
chunk).

| File | Result |
|---|---|
| `opus5-vulns-2026-09-14.json` | 10/10 vulnerable functions flagged with the intended CWE (78, 798, 22, 89, 916, 79), confidence 0.95–0.99. 10 LLM calls, 45 s. |
| `opus5-clean-2026-09-14.json` | 0 findings across all 10 clean functions (11 chunks). 31 s. |

The prompt wording was not changed for the new model. One transport-level
fix was needed instead (see `internal/llm/schema.go`): the structured-output
schema must list the finding's properties in the prompt's order, ending on
the numeric `confidence` field, or the constrained decoder occasionally
never closes the final string and runs to `max_tokens`.
