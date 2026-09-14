package llm

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"secpr/internal/ast"
)

// fakeAnthropic is an httptest.Server that speaks just enough of the
// Messages API for Review: it records the request and returns a canned
// message whose text block is the JSON the model would have produced.
type fakeAnthropic struct {
	*httptest.Server
	requests []map[string]any
	headers  []http.Header
	reply    func(n int) (status int, body string)
}

func newFakeAnthropic(t *testing.T, reply func(n int) (int, string)) *fakeAnthropic {
	t.Helper()
	f := &fakeAnthropic{reply: reply}
	f.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/messages" || r.Method != http.MethodPost {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
			http.Error(w, "not found", 404)
			return
		}
		raw, _ := io.ReadAll(r.Body)
		var req map[string]any
		if err := json.Unmarshal(raw, &req); err != nil {
			t.Errorf("request body is not JSON: %v", err)
		}
		f.requests = append(f.requests, req)
		f.headers = append(f.headers, r.Header.Clone())
		status, body := f.reply(len(f.requests))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(f.Close)
	return f
}

func messageWithText(text string) string {
	b, _ := json.Marshal(map[string]any{
		"id":            "msg_test",
		"type":          "message",
		"role":          "assistant",
		"model":         "claude-opus-5",
		"content":       []map[string]any{{"type": "text", "text": text}},
		"stop_reason":   "end_turn",
		"stop_sequence": nil,
		"usage":         map[string]any{"input_tokens": 10, "output_tokens": 5},
	})
	return string(b)
}

var testChunk = ast.Chunk{
	File:         "internal/handlers/search.go",
	Language:     "go",
	FunctionName: "searchUsers",
	Kind:         ast.KindFunction,
	FunctionBody: "func searchUsers(db *sql.DB, q string) {\n\tdb.Query(\"SELECT * FROM users WHERE name = '\" + q + \"'\")\n}",
	StartLine:    10,
	EndLine:      12,
	ChangedLines: []int{2},
}

func TestReviewNoAPIKey(t *testing.T) {
	c := &Client{}
	_, err := c.Review(context.Background(), testChunk)
	if !errors.Is(err, ErrNoAPIKey) {
		t.Fatalf("err = %v, want ErrNoAPIKey", err)
	}
	if c.Ready() {
		t.Fatal("Ready() with no key")
	}
}

func TestReviewRequestShapeAndParse(t *testing.T) {
	modelJSON := `{"findings":[{"cwe":"CWE-89","severity":"HIGH","line":2,"summary":"concat","why_it_matters":"dump","fix_patch":"\tdb.Query(\"... ?\", q)","confidence":0.95},` +
		`{"cwe":"CWE-20","severity":"LOW","line":1,"summary":"not a changed line","why_it_matters":"x","fix_patch":"y","confidence":0.99}]}`
	srv := newFakeAnthropic(t, func(int) (int, string) { return 200, messageWithText(modelJSON) })

	c := &Client{APIKey: "sk-test", Model: "claude-opus-5", BaseURL: srv.URL}
	findings, err := c.Review(context.Background(), testChunk)
	if err != nil {
		t.Fatal(err)
	}

	// Validate ran: the line-1 finding (not in changed set) was dropped.
	if len(findings) != 1 || findings[0].CWE != "CWE-89" || findings[0].Line != 2 {
		t.Fatalf("findings = %+v, want one CWE-89 on chunk line 2", findings)
	}
	// Findings stay chunk-relative; the scan core maps them.
	if findings[0].Line != 2 {
		t.Fatalf("line = %d, want chunk-relative 2", findings[0].Line)
	}

	if len(srv.requests) != 1 {
		t.Fatalf("got %d requests, want 1", len(srv.requests))
	}
	req := srv.requests[0]
	hdr := srv.headers[0]

	if hdr.Get("x-api-key") != "sk-test" {
		t.Errorf("x-api-key = %q", hdr.Get("x-api-key"))
	}
	if req["model"] != "claude-opus-5" {
		t.Errorf("model = %v", req["model"])
	}
	if _, has := req["temperature"]; has {
		t.Error("temperature must not be sent (current models reject it)")
	}
	if mt, _ := req["max_tokens"].(float64); mt < 1024 {
		t.Errorf("max_tokens = %v, too low", req["max_tokens"])
	}

	// System prompt is a single cached block with the untouched prompt text.
	sys, _ := req["system"].([]any)
	if len(sys) != 1 {
		t.Fatalf("system = %v, want one block", req["system"])
	}
	block := sys[0].(map[string]any)
	if block["text"] != systemPrompt {
		t.Error("system prompt text was altered")
	}
	cc, _ := block["cache_control"].(map[string]any)
	if cc["type"] != "ephemeral" {
		t.Errorf("cache_control = %v, want ephemeral", block["cache_control"])
	}

	// Structured outputs with the findings schema.
	oc, _ := req["output_config"].(map[string]any)
	format, _ := oc["format"].(map[string]any)
	if format["type"] != "json_schema" {
		t.Errorf("output_config.format.type = %v, want json_schema", format["type"])
	}
	schema, _ := format["schema"].(map[string]any)
	if schema["additionalProperties"] != false {
		t.Error("schema must set additionalProperties:false")
	}
	if _, ok := schema["properties"].(map[string]any)["findings"]; !ok {
		t.Error("schema missing findings property")
	}

	// The user turn carries the chunk fields.
	msgs, _ := req["messages"].([]any)
	if len(msgs) != 1 {
		t.Fatalf("messages = %v", req["messages"])
	}
	m := msgs[0].(map[string]any)
	if m["role"] != "user" {
		t.Errorf("role = %v", m["role"])
	}
	var userText string
	switch content := m["content"].(type) {
	case string:
		userText = content
	case []any:
		for _, b := range content {
			userText += b.(map[string]any)["text"].(string)
		}
	}
	for _, want := range []string{
		"<file>internal/handlers/search.go</file>",
		"<language>go</language>",
		"<function_name>searchUsers</function_name>",
		"<changed_lines>[2]</changed_lines>",
		testChunk.FunctionBody,
	} {
		if !strings.Contains(userText, want) {
			t.Errorf("user message missing %q:\n%s", want, userText)
		}
	}
}

func TestReviewEmptyFindings(t *testing.T) {
	srv := newFakeAnthropic(t, func(int) (int, string) { return 200, messageWithText(`{"findings":[]}`) })
	c := &Client{APIKey: "sk-test", BaseURL: srv.URL}
	findings, err := c.Review(context.Background(), testChunk)
	if err != nil {
		t.Fatal(err)
	}
	if len(findings) != 0 {
		t.Fatalf("findings = %+v, want none", findings)
	}
	if srv.requests[0]["model"] != DefaultModel {
		t.Fatalf("default model = %v, want %s", srv.requests[0]["model"], DefaultModel)
	}
}

func TestReviewAPIError(t *testing.T) {
	srv := newFakeAnthropic(t, func(int) (int, string) {
		return 401, `{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}`
	})
	c := &Client{APIKey: "sk-bad", BaseURL: srv.URL}
	_, err := c.Review(context.Background(), testChunk)
	if err == nil || !strings.Contains(err.Error(), "401") || !strings.Contains(err.Error(), "authentication_error") {
		t.Fatalf("err = %v, want a 401 authentication_error", err)
	}
	if len(srv.requests) != 1 {
		t.Fatalf("401 must not be retried; got %d requests", len(srv.requests))
	}
}

func TestReviewRetriesOverloaded(t *testing.T) {
	srv := newFakeAnthropic(t, func(n int) (int, string) {
		if n == 1 {
			return 529, `{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}`
		}
		return 200, messageWithText(`{"findings":[]}`)
	})
	c := &Client{APIKey: "sk-test", BaseURL: srv.URL}
	if _, err := c.Review(context.Background(), testChunk); err != nil {
		t.Fatalf("expected the SDK to retry a 529: %v", err)
	}
	if len(srv.requests) != 2 {
		t.Fatalf("got %d requests, want 2 (one retry)", len(srv.requests))
	}
}

func TestReviewTruncated(t *testing.T) {
	srv := newFakeAnthropic(t, func(int) (int, string) {
		msg := messageWithText(`{"findings":[`)
		return 200, strings.Replace(msg, `"end_turn"`, `"max_tokens"`, 1)
	})
	c := &Client{APIKey: "sk-test", BaseURL: srv.URL}
	_, err := c.Review(context.Background(), testChunk)
	if err == nil || !strings.Contains(err.Error(), "max_tokens") {
		t.Fatalf("err = %v, want a max_tokens error", err)
	}
}

func TestReviewMalformedJSON(t *testing.T) {
	srv := newFakeAnthropic(t, func(int) (int, string) { return 200, messageWithText(`not json`) })
	c := &Client{APIKey: "sk-test", BaseURL: srv.URL}
	if _, err := c.Review(context.Background(), testChunk); err == nil {
		t.Fatal("want a parse error")
	}
}
