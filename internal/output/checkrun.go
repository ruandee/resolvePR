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

type checkRunCreate struct {
	Name    string `json:"name"`
	HeadSHA string `json:"head_sha"`
	Status  string `json:"status"`
}

type checkRunResponse struct {
	ID int64 `json:"id"`
}

type checkRunUpdate struct {
	Status     string         `json:"status"`
	Conclusion string         `json:"conclusion"`
	Output     checkRunOutput `json:"output"`
}

type checkRunOutput struct {
	Title   string `json:"title"`
	Summary string `json:"summary"`
}

// CreateCheck opens an in-progress Check Run on the PR's head commit.
// Returns the Check Run ID — keep it, you need it to complete the run later.
func CreateCheck(ctx context.Context, token, owner, repo, sha string) (int64, error) {
	body, _ := json.Marshal(checkRunCreate{
		Name:    "ResolvePR",
		HeadSHA: sha,
		Status:  "in_progress",
	})

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/check-runs", owner, repo)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return 0, fmt.Errorf("create check %d: %s", resp.StatusCode, raw)
	}

	var r checkRunResponse
	if err := json.Unmarshal(raw, &r); err != nil {
		return 0, err
	}
	return r.ID, nil
}

// CompleteCheck flips the Check Run to completed.
// Conclusion is "failure" if any HIGH or CRITICAL finding exists, else "success".
// This is what makes the red/green badge appear on the PR.
func CompleteCheck(ctx context.Context, token, owner, repo string, checkID int64, findings []llm.Finding) error {
	conclusion := "success"
	for _, f := range findings {
		if f.Severity == "HIGH" || f.Severity == "CRITICAL" {
			conclusion = "failure"
			break
		}
	}

	title := fmt.Sprintf("ResolvePR found %d issues", len(findings))
	if len(findings) == 0 {
		title = "ResolvePR — no issues found"
		conclusion = "success"
	}

	body, _ := json.Marshal(checkRunUpdate{
		Status:     "completed",
		Conclusion: conclusion,
		Output: checkRunOutput{
			Title:   title,
			Summary: buildSummary(findings),
		},
	})

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/check-runs/%d", owner, repo, checkID)
	req, _ := http.NewRequestWithContext(ctx, "PATCH", url, bytes.NewReader(body))
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
		return fmt.Errorf("complete check %d: %s", resp.StatusCode, raw)
	}
	return nil
}

func buildSummary(findings []llm.Finding) string {
	if len(findings) == 0 {
		return "All scanned chunks clean. ResolvePR found no security issues."
	}

	bySev := map[string]int{"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0}
	for _, f := range findings {
		bySev[f.Severity]++
	}

	return fmt.Sprintf(`## ResolvePR found %d issues

| Severity | Count |
|---|---|
| 🔴 CRITICAL | %d |
| 🟠 HIGH | %d |
| 🟡 MEDIUM | %d |

See inline review comments below for details on each finding and suggested fixes.

---
<sub>Powered by Claude · AST-aware chunking</sub>`, len(findings), bySev["CRITICAL"], bySev["HIGH"], bySev["MEDIUM"])
}
