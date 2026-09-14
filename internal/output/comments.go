package output

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"resolvepr/internal/llm"
)

var sevEmoji = map[string]string{
	"CRITICAL": "🔴",
	"HIGH":     "🟠",
	"MEDIUM":   "🟡",
	"LOW":      "🔵",
}

type prComment struct {
	Body     string `json:"body"`
	CommitID string `json:"commit_id"`
	Path     string `json:"path"`
	// line + side anchor the comment to a line of the new file directly, which
	// is what GitHub documents today; the older position-in-diff field needs
	// error-prone arithmetic over the patch.
	Line int    `json:"line"`
	Side string `json:"side"`
}

// PostComment posts ONE inline review comment with a click-to-apply suggestion
// block, anchored to line (1-based, in the new file at sha). The line must be
// part of the PR diff — an added or context line — or GitHub rejects it with
// 422; callers check that with diff.Hunk.DiffPositions before calling.
func PostComment(ctx context.Context, token, owner, repo string, prNum int, sha, file string, line int, f llm.Finding) error {
	payload, _ := json.Marshal(prComment{
		Body:     buildCommentBody(f),
		CommitID: sha,
		Path:     file,
		Line:     line,
		Side:     "RIGHT",
	})

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/comments", owner, repo, prNum)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("post comment %d: %s", resp.StatusCode, raw)
	}
	return nil
}

// PostSummary posts ONE PR-level comment (not inline) with the severity table.
// Issue Comments API, not Review Comments — different endpoint.
func PostSummary(ctx context.Context, token, owner, repo string, prNum int, findings []llm.Finding) error {
	payload, _ := json.Marshal(map[string]string{"body": buildSummary(findings)})

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/comments", owner, repo, prNum)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("post summary %d: %s", resp.StatusCode, raw)
	}
	return nil
}

func buildCommentBody(f llm.Finding) string {
	emoji := sevEmoji[f.Severity]
	if emoji == "" {
		emoji = "⚪"
	}
	return fmt.Sprintf(
		"%s **%s** · %s\n\n%s\n\n**Why it matters:** %s\n\n"+"```suggestion\n%s\n```"+"\n\n_ResolvePR · confidence %.0f%%_",
		emoji, f.Severity, f.CWE, f.Summary, f.WhyItMatters, f.FixPatch, f.Confidence*100,
	)
}
