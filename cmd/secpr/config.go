package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"secpr/internal/llm"
	"secpr/internal/scan"
)

// llmFlags are shared by every command that talks to Claude.
type llmFlags struct {
	apiKey string
	model  string
}

func (f *llmFlags) register(fs *flag.FlagSet) {
	fs.StringVar(&f.apiKey, "api-key", "", "Anthropic API key (default: $ANTHROPIC_API_KEY)")
	fs.StringVar(&f.model, "model", "", "Claude model (default: $SECPR_MODEL, then "+llm.DefaultModel+")")
}

// client builds the single llm.Client for the process. Resolution order:
// flag → environment → default. The key may be empty; callers decide
// whether that is fatal (it is not for --dry-run).
func (f *llmFlags) client(extraKeyEnv, extraModelEnv string) *llm.Client {
	key := firstNonEmpty(f.apiKey, os.Getenv(extraKeyEnv), os.Getenv("ANTHROPIC_API_KEY"))
	model := firstNonEmpty(f.model, os.Getenv(extraModelEnv), os.Getenv("SECPR_MODEL"), llm.DefaultModel)
	return &llm.Client{APIKey: key, Model: model}
}

func firstNonEmpty(xs ...string) string {
	for _, x := range xs {
		if x = strings.TrimSpace(x); x != "" {
			return x
		}
	}
	return ""
}

// generator is the free-text label written into fixtures.
func generator(c *llm.Client) string {
	return fmt.Sprintf("secpr %s · %s", version, c.ModelName())
}

// checkFailOn validates a --fail-on value.
func checkFailOn(v string) (string, error) {
	v = strings.ToLower(strings.TrimSpace(v))
	if v == "" {
		v = "none"
	}
	if v == "none" {
		return v, nil
	}
	if _, ok := scan.ThresholdRank(v); !ok {
		return "", fmt.Errorf("--fail-on must be one of critical, high, medium, low, none (got %q)", v)
	}
	return v, nil
}

// splitRepo parses "owner/name".
func splitRepo(repo string) (owner, name string, err error) {
	owner, name, ok := strings.Cut(repo, "/")
	if !ok || owner == "" || name == "" || strings.Contains(name, "/") {
		return "", "", fmt.Errorf("repo must be owner/name (got %q)", repo)
	}
	return owner, name, nil
}
