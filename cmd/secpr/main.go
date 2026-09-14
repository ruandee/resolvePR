// Command secpr is the SecPR binary: AI security review for pull requests.
//
//	secpr scan    review a GitHub PR or a local git diff from the command line
//	secpr action  run inside GitHub Actions (reads the event, posts comments)
//	secpr serve   long-running GitHub App webhook server (self-hosted)
//	secpr version print the version
package main

import (
	"fmt"
	"os"
)

// version is overridden at build time: -ldflags "-X main.version=1.2.3".
var version = "0.1.0-dev"

const usage = `SecPR — AI security review for pull requests

Usage:
  secpr <command> [flags]

Commands:
  scan      Review a GitHub PR (--repo/--pr) or a local diff (--local --base)
  action    Run as a GitHub Action (reads GITHUB_EVENT_PATH and INPUT_* env)
  serve     Run the GitHub App webhook server (self-hosted mode)
  version   Print the version

Run "secpr <command> -h" for the flags of each command.

Environment:
  ANTHROPIC_API_KEY   Anthropic API key (or --api-key)
  SECPR_MODEL         model override (or --model); default claude-opus-5
  GITHUB_TOKEN        GitHub token for scan --repo/--pr and action mode
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "scan":
		err = runScan(os.Args[2:])
	case "action":
		err = runAction(os.Args[2:])
	case "serve":
		err = runServe(os.Args[2:])
	case "version", "--version", "-v":
		fmt.Printf("secpr %s\n", version)
	case "help", "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "secpr: unknown command %q\n\n%s", os.Args[1], usage)
		os.Exit(2)
	}
	if err != nil {
		var ec exitCode
		if asExit(err, &ec) {
			os.Exit(int(ec))
		}
		fmt.Fprintf(os.Stderr, "secpr: %v\n", err)
		os.Exit(1)
	}
}

// exitCode is returned by subcommands that already printed their message and
// only want a specific process exit status (e.g. --fail-on threshold met).
type exitCode int

func (e exitCode) Error() string { return fmt.Sprintf("exit %d", int(e)) }

func asExit(err error, target *exitCode) bool {
	ec, ok := err.(exitCode)
	if ok {
		*target = ec
	}
	return ok
}
