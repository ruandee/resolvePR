package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"resolvepr/internal/ast"
)

type apiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// systemBlock lets us attach cache_control to the system prompt so Anthropic
// caches it across requests — saves tokens and cuts per-request latency.
type systemBlock struct {
	Type         string        `json:"type"`
	Text         string        `json:"text"`
	CacheControl *cacheControl `json:"cache_control,omitempty"`
}

type cacheControl struct {
	Type string `json:"type"` // "ephemeral"
}

type apiRequest struct {
	Model       string        `json:"model"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float64       `json:"temperature"`
	System      []systemBlock `json:"system"`
	Messages    []apiMessage  `json:"messages"`
}

type apiResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// Review calls the LLM to security-scan a chunk. Finding.Line values in the
// returned slice are chunk-relative (1 = first line of ch.FunctionBody).
func Review(ctx context.Context, ch ast.Chunk) ([]Finding, error) {
	// XML tags give the model unambiguous delimiters for each input field,
	// reducing the chance of it confusing file paths for code or vice-versa.
	user := fmt.Sprintf(
		"<file>%s</file>\n<language>%s</language>\n<function_name>%s</function_name>\n<changed_lines>%v</changed_lines>\n\n<function_body>\n%s\n</function_body>\n\nReview for security issues. Output JSON only.",
		ch.File, ch.Language, ch.FunctionName, ch.ChangedLines, ch.FunctionBody,
	)

	body, _ := json.Marshal(apiRequest{
		Model:       "claude-sonnet-4-6",
		MaxTokens:   1024,
		Temperature: 0, // deterministic output for structured JSON
		System: []systemBlock{{
			Type: "text",
			Text: systemPrompt,
			CacheControl: &cacheControl{Type: "ephemeral"}, // cache across requests
		}},
		Messages: []apiMessage{{Role: "user", Content: user}},
	})

	raw, err := doWithRetry(ctx, body)
	if err != nil {
		return nil, err
	}

	var apiResp apiResponse
	if err := json.Unmarshal(raw, &apiResp); err != nil {
		return nil, err
	}

	var text string
	for _, block := range apiResp.Content {
		if block.Type == "text" {
			text += block.Text
		}
	}
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	var parsed struct {
		Findings []Finding `json:"findings"`
	}
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return nil, fmt.Errorf("parse: %w (raw: %s)", err, text)
	}
	return Validate(parsed.Findings, ch), nil
}

// doWithRetry posts to the Anthropic API with exponential backoff on 429/529.
func doWithRetry(ctx context.Context, body []byte) ([]byte, error) {
	const maxAttempts = 4
	delays := []time.Duration{0, 2 * time.Second, 4 * time.Second, 8 * time.Second}

	for attempt := 0; attempt < maxAttempts; attempt++ {
		if delays[attempt] > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delays[attempt]):
			}
		}

		req, _ := http.NewRequestWithContext(ctx, "POST",
			"https://api.anthropic.com/v1/messages",
			bytes.NewReader(body),
		)
		req.Header.Set("x-api-key", os.Getenv("ANTHROPIC_API_KEY"))
		req.Header.Set("anthropic-version", "2023-06-01")
		req.Header.Set("content-type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == 429 || resp.StatusCode == 529 {
			continue
		}
		if resp.StatusCode != 200 {
			return nil, fmt.Errorf("anthropic %d: %s", resp.StatusCode, raw)
		}
		return raw, nil
	}
	return nil, fmt.Errorf("anthropic: rate limited after %d attempts", maxAttempts)
}
