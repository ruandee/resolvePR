package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"secpr/internal/llm"
	"secpr/internal/output"
	"secpr/internal/scan"
)

const actionUsage = `Usage:
  secpr action [--fail-on LEVEL] [--api-key K] [--model M]

Runs inside GitHub Actions. Reads:
  GITHUB_EVENT_PATH        pull_request event payload (number, head sha, repo)
  INPUT_GITHUB_TOKEN       or GITHUB_TOKEN — token for comments and the check run
  INPUT_ANTHROPIC_API_KEY  or ANTHROPIC_API_KEY
  INPUT_MODEL              or SECPR_MODEL
  INPUT_FAIL_ON            default "high"
  GITHUB_STEP_SUMMARY      if set, the summary table is appended to the job summary

`

// actionEvent is the subset of the pull_request webhook payload we need.
// The head SHA comes from here, NOT from GITHUB_SHA (that is the synthetic
// merge commit, which the check run and inline comments must not target).
type actionEvent struct {
	Number      int `json:"number"`
	PullRequest struct {
		Number int    `json:"number"`
		Title  string `json:"title"`
		Head   struct {
			SHA string `json:"sha"`
		} `json:"head"`
	} `json:"pull_request"`
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
}

func runAction(args []string) error {
	fs := flag.NewFlagSet("action", flag.ContinueOnError)
	fs.Usage = func() { fmt.Fprint(os.Stderr, actionUsage); fs.PrintDefaults() }
	var (
		lf      llmFlags
		failOn  = fs.String("fail-on", "", "exit non-zero when a finding meets this severity (default: $INPUT_FAIL_ON, then high)")
		timeout = fs.Duration("timeout", 30*time.Minute, "overall scan timeout")
	)
	lf.register(fs)
	if err := fs.Parse(args); err != nil {
		return exitCode(2)
	}

	threshold, err := checkFailOn(firstNonEmpty(*failOn, os.Getenv("INPUT_FAIL_ON"), "high"))
	if err != nil {
		return err
	}

	eventPath := os.Getenv("GITHUB_EVENT_PATH")
	if eventPath == "" {
		return fmt.Errorf("GITHUB_EVENT_PATH is not set — `secpr action` must run inside GitHub Actions on a pull_request event")
	}
	raw, err := os.ReadFile(eventPath)
	if err != nil {
		return fmt.Errorf("read event: %w", err)
	}
	var evt actionEvent
	if err := json.Unmarshal(raw, &evt); err != nil {
		return fmt.Errorf("parse event: %w", err)
	}
	number := evt.PullRequest.Number
	if number == 0 {
		number = evt.Number
	}
	if number == 0 || evt.PullRequest.Head.SHA == "" || evt.Repository.FullName == "" {
		return fmt.Errorf("event at %s is not a pull_request payload (need pull_request.number, pull_request.head.sha, repository.full_name)", eventPath)
	}
	owner, name, err := splitRepo(evt.Repository.FullName)
	if err != nil {
		return err
	}

	token := firstNonEmpty(os.Getenv("INPUT_GITHUB_TOKEN"), os.Getenv("GITHUB_TOKEN"))
	if token == "" {
		fmt.Fprintln(os.Stderr, "::warning::no GitHub token (github_token input / GITHUB_TOKEN); results will only be printed")
	}

	client := lf.client("INPUT_ANTHROPIC_API_KEY", "INPUT_MODEL")
	if !client.Ready() {
		fmt.Fprintln(os.Stderr, "::error::anthropic_api_key input is empty — add ANTHROPIC_API_KEY to the repository secrets and pass it as `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`")
		return llm.ErrNoAPIKey
	}

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	meta := scan.PRMeta{
		Repo:    evt.Repository.FullName,
		Number:  number,
		Title:   evt.PullRequest.Title,
		HeadSHA: evt.PullRequest.Head.SHA,
	}
	src := &scan.GitHubSource{Token: token, Owner: owner, Repo: name, Number: number, HeadSHA: meta.HeadSHA}
	sc := &scan.Scanner{Reviewer: client}

	var sinks []scan.Sink
	if token != "" {
		// Comment/check failures (e.g. fork PRs with a read-only token) are
		// logged by the sink; the summary below still prints.
		sinks = append(sinks, &scan.GitHubSink{Token: token, Owner: owner, Repo: name, Number: number, HeadSHA: meta.HeadSHA})
	}
	sinks = append(sinks, &scan.StdoutSink{Generator: generator(client)})

	fmt.Printf("SecPR %s reviewing %s#%d (%s) with %s\n", version, meta.Repo, number, shortSHA(meta.HeadSHA), client.ModelName())
	res, err := scan.Run(ctx, sc, src, meta, sinks...)
	if err != nil {
		fmt.Fprintf(os.Stderr, "::error::%v\n", err)
		return err
	}

	if path := os.Getenv("GITHUB_STEP_SUMMARY"); path != "" {
		if f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o644); err == nil {
			fmt.Fprintln(f, output.BuildSummary(res.Findings))
			f.Close()
		}
	}
	for _, f := range res.Findings {
		// Workflow annotations show up in the Files tab even when comments
		// could not be posted.
		fmt.Printf("::%s file=%s,line=%d,title=%s %s::%s\n",
			annotationLevel(f.Severity), f.File, f.Line, f.CWE, f.Severity, escapeAnnotation(f.Summary))
	}

	if scan.MeetsThreshold(res.Findings, threshold) {
		fmt.Fprintf(os.Stderr, "::error::SecPR found findings at or above %s severity (fail_on)\n", strings.ToUpper(threshold))
		return exitCode(1)
	}
	return nil
}

func annotationLevel(sev string) string {
	switch sev {
	case "CRITICAL", "HIGH":
		return "error"
	case "MEDIUM":
		return "warning"
	}
	return "notice"
}

// escapeAnnotation encodes characters that terminate a workflow command.
func escapeAnnotation(s string) string {
	r := strings.NewReplacer("%", "%25", "\r", "%0D", "\n", "%0A")
	return r.Replace(s)
}

func shortSHA(sha string) string {
	if len(sha) > 8 {
		return sha[:8]
	}
	return sha
}
