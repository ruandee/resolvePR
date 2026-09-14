// Package llm reviews code chunks with Claude and validates what comes back.
package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"secpr/internal/ast"
)

// DefaultModel is used when no model is configured.
const DefaultModel = "claude-opus-5"

// defaultMaxTokens leaves headroom for adaptive thinking (which counts
// against max_tokens on current models) plus the findings JSON.
const defaultMaxTokens = 16000

// ErrNoAPIKey is returned by Review when the client has no API key. Callers
// should check it before starting a scan so the failure is immediate and
// clear rather than a 401 from the API.
var ErrNoAPIKey = errors.New("no Anthropic API key: pass --api-key or set ANTHROPIC_API_KEY")

// Client calls the Anthropic Messages API. Construct it once (in main) and
// share it; it is safe for concurrent use. The package never reads the
// environment — the caller resolves APIKey and Model.
type Client struct {
	APIKey string
	Model  string // "" → DefaultModel

	// BaseURL overrides the API endpoint (tests point it at an httptest.Server).
	BaseURL string
	// HTTPClient overrides the transport. nil → the SDK default.
	HTTPClient *http.Client
	// MaxTokens caps the response. 0 → defaultMaxTokens.
	MaxTokens int64

	once sync.Once
	api  *anthropic.Client
}

// Ready reports whether the client can make calls (has an API key).
func (c *Client) Ready() bool { return c != nil && c.APIKey != "" }

// ModelName returns the model this client sends requests with.
func (c *Client) ModelName() string {
	if c.Model == "" {
		return DefaultModel
	}
	return c.Model
}

func (c *Client) sdk() *anthropic.Client {
	c.once.Do(func() {
		opts := []option.RequestOption{option.WithAPIKey(c.APIKey)}
		if c.BaseURL != "" {
			opts = append(opts, option.WithBaseURL(c.BaseURL))
		}
		if c.HTTPClient != nil {
			opts = append(opts, option.WithHTTPClient(c.HTTPClient))
		}
		// The SDK retries 408/409/429/5xx and connection errors with backoff.
		api := anthropic.NewClient(opts...)
		c.api = &api
	})
	return c.api
}

// UserMessage renders the per-chunk user turn. XML tags give the model
// unambiguous delimiters for each input field, reducing the chance of it
// confusing file paths for code or vice-versa.
func UserMessage(ch ast.Chunk) string {
	return fmt.Sprintf(
		"<file>%s</file>\n<language>%s</language>\n<function_name>%s</function_name>\n<changed_lines>%v</changed_lines>\n\n<function_body>\n%s\n</function_body>\n\nReview for security issues. Output JSON only.",
		ch.File, ch.Language, ch.FunctionName, ch.ChangedLines, ch.FunctionBody,
	)
}

// Review asks Claude to security-scan one chunk. Finding.Line values in the
// returned slice are chunk-relative (1 = first line of ch.FunctionBody); the
// scan core maps them to absolute file lines. Results are already passed
// through Validate.
func (c *Client) Review(ctx context.Context, ch ast.Chunk) ([]Finding, error) {
	if !c.Ready() {
		return nil, ErrNoAPIKey
	}
	maxTokens := c.MaxTokens
	if maxTokens == 0 {
		maxTokens = defaultMaxTokens
	}

	resp, err := c.sdk().Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.ModelName(),
		MaxTokens: maxTokens,
		System: []anthropic.TextBlockParam{{
			Text:         systemPrompt,
			CacheControl: anthropic.NewCacheControlEphemeralParam(), // cache across chunks
		}},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(UserMessage(ch))),
		},
		// Structured outputs: the API guarantees the text block is JSON
		// matching FindingsSchema, so no fence-stripping is needed.
		OutputConfig: anthropic.OutputConfigParam{
			Format: anthropic.JSONOutputFormatParam{Schema: FindingsSchema()},
		},
	})
	if err != nil {
		var apiErr *anthropic.Error
		if errors.As(err, &apiErr) {
			return nil, fmt.Errorf("anthropic %d (%s): %w", apiErr.StatusCode, apiErr.Type(), err)
		}
		return nil, fmt.Errorf("anthropic: %w", err)
	}

	switch resp.StopReason {
	case anthropic.StopReasonMaxTokens:
		return nil, fmt.Errorf("anthropic: response truncated at max_tokens=%d", maxTokens)
	case anthropic.StopReasonRefusal:
		return nil, fmt.Errorf("anthropic: request refused (%s)", resp.StopDetails.Category)
	}

	var text strings.Builder
	for _, block := range resp.Content {
		if tb, ok := block.AsAny().(anthropic.TextBlock); ok {
			text.WriteString(tb.Text)
		}
	}

	var parsed struct {
		Findings []Finding `json:"findings"`
	}
	if err := json.Unmarshal([]byte(text.String()), &parsed); err != nil {
		return nil, fmt.Errorf("parse: %w (raw: %s)", err, text.String())
	}
	return Validate(parsed.Findings, ch), nil
}
