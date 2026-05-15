package store

import (
	"strings"
	"sync"

	"resolvepr/internal/llm"
)

var mu sync.RWMutex
var data = map[string][]llm.Finding{} // key: "owner/repo#PR"

func Add(key string, f llm.Finding) {
	mu.Lock()
	defer mu.Unlock()
	data[key] = append(data[key], f)
}

// List returns all findings for a repo prefix ("owner/repo"), or everything if repo is "".
func List(repo string) []llm.Finding {
	mu.RLock()
	defer mu.RUnlock()
	var out []llm.Finding
	for k, v := range data {
		if repo == "" || strings.HasPrefix(k, repo) {
			out = append(out, v...)
		}
	}
	return out
}
