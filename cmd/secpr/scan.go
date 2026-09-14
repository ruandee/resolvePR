package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"

	gh "secpr/internal/github"
	"secpr/internal/llm"
	"secpr/internal/scan"
)

const scanUsage = `Usage:
  secpr scan --repo OWNER/NAME --pr N [--token T] [--post]
  secpr scan --local --base REV [--head REV] [--dir PATH] [--repo OWNER/NAME] [--pr N] [--title T]

Common flags:
  --dry-run           chunk only; print what would be sent, call no model
  --json              print the fixture JSON instead of a human report
  --fixture-out PATH  also write the fixture JSON to PATH (for the dashboard demo)
  --fail-on LEVEL     exit 1 if any finding is >= LEVEL (critical|high|medium|low|none; default none)
  --api-key, --model  see "secpr -h"

Examples:
  secpr scan --repo acme/api --pr 142
  secpr scan --local --base main --dry-run
  secpr scan --local --base HEAD~1 --fixture-out demo.json

`

func runScan(args []string) error {
	fs := flag.NewFlagSet("scan", flag.ContinueOnError)
	fs.Usage = func() { fmt.Fprint(os.Stderr, scanUsage); fs.PrintDefaults() }

	var (
		lf         llmFlags
		repo       = fs.String("repo", "", "GitHub repository as owner/name (local mode: label only)")
		pr         = fs.Int("pr", 0, "pull request number (local mode: label only)")
		token      = fs.String("token", "", "GitHub token (default: $GITHUB_TOKEN)")
		post       = fs.Bool("post", false, "post inline comments, summary and check run to the PR")
		local      = fs.Bool("local", false, "scan a local git diff instead of a GitHub PR")
		dir        = fs.String("dir", ".", "local mode: repository directory")
		base       = fs.String("base", "", "local mode: base revision (e.g. main, HEAD~1)")
		head       = fs.String("head", "HEAD", "local mode: head revision")
		title      = fs.String("title", "", "local mode: title to record (default: head commit subject)")
		dryRun     = fs.Bool("dry-run", false, "chunk only; make no model calls")
		asJSON     = fs.Bool("json", false, "print fixture JSON to stdout")
		fixtureOut = fs.String("fixture-out", "", "write fixture JSON to this path")
		failOn     = fs.String("fail-on", "none", "exit non-zero when a finding meets this severity")
		timeout    = fs.Duration("timeout", 10*time.Minute, "overall scan timeout")
	)
	lf.register(fs)
	if err := fs.Parse(args); err != nil {
		return exitCode(2)
	}

	_ = godotenv.Load() // local convenience; missing .env is fine

	threshold, err := checkFailOn(*failOn)
	if err != nil {
		return err
	}
	switch {
	case *local && *base == "":
		return fmt.Errorf("--local requires --base REV (e.g. --base main)")
	case !*local && (*repo == "" || *pr == 0):
		return fmt.Errorf("scan needs --repo OWNER/NAME and --pr N, or --local --base REV")
	}

	// Fail on a missing key before any git or GitHub work.
	client := lf.client("", "")
	if !*dryRun && !client.Ready() {
		return fmt.Errorf("%w (or use --dry-run)", llm.ErrNoAPIKey)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()
	ctx, cancelTimeout := context.WithTimeout(ctx, *timeout)
	defer cancelTimeout()

	var (
		src  scan.Source
		meta scan.PRMeta
		ghs  *scan.GitHubSource
	)
	if *local {
		g := &scan.GitSource{Dir: *dir, Base: *base, Head: *head}
		sha, err := g.HeadSHA(ctx)
		if err != nil {
			return err
		}
		meta = scan.PRMeta{Repo: *repo, Number: *pr, Title: *title, HeadSHA: sha}
		if meta.Repo == "" {
			meta.Repo = g.RemoteRepo(ctx)
		}
		if meta.Repo == "" {
			abs, _ := filepath.Abs(*dir)
			meta.Repo = "local/" + filepath.Base(abs)
		}
		if meta.Title == "" {
			meta.Title, _ = g.HeadSubject(ctx)
		}
		src = g
	} else {
		owner, name, err := splitRepo(*repo)
		if err != nil {
			return err
		}
		tok := firstNonEmpty(*token, os.Getenv("GITHUB_TOKEN"))
		info, err := gh.GetPullRequest(ctx, tok, owner, name, *pr)
		if err != nil {
			return err
		}
		meta = scan.PRMeta{Repo: *repo, Number: *pr, Title: info.Title, HeadSHA: info.HeadSHA}
		ghs = &scan.GitHubSource{Token: tok, Owner: owner, Repo: name, Number: *pr, HeadSHA: info.HeadSHA}
		src = ghs
	}

	sc := &scan.Scanner{Reviewer: client, DryRun: *dryRun}

	var sinks []scan.Sink
	if *post && !*dryRun {
		if ghs == nil {
			return fmt.Errorf("--post only applies to GitHub PRs (--repo/--pr)")
		}
		if ghs.Token == "" {
			return fmt.Errorf("--post needs a GitHub token (--token or $GITHUB_TOKEN)")
		}
		sinks = append(sinks, &scan.GitHubSink{Token: ghs.Token, Owner: ghs.Owner, Repo: ghs.Repo, Number: ghs.Number, HeadSHA: ghs.HeadSHA})
	}
	if *fixtureOut != "" {
		// Allowed in --dry-run too: the fixture then has files and chunks but
		// no findings, which is enough to exercise the dashboard demo.
		sinks = append(sinks, &scan.FixtureSink{Path: *fixtureOut, Generator: generator(client)})
	}
	sinks = append(sinks, &scan.StdoutSink{JSON: *asJSON, Generator: generator(client), ShowBodies: *dryRun})

	res, err := scan.Run(ctx, sc, src, meta, sinks...)
	if err != nil {
		return err
	}
	if *fixtureOut != "" {
		fmt.Fprintf(os.Stderr, "fixture written to %s\n", *fixtureOut)
	}
	if scan.MeetsThreshold(res.Findings, threshold) {
		fmt.Fprintf(os.Stderr, "secpr: findings at or above %s severity (--fail-on)\n", strings.ToUpper(threshold))
		return exitCode(1)
	}
	return nil
}
