package store

import (
	"sync"

	"resolvepr/internal/llm"
)

// MemoryStore is a thread-safe in-process fallback used when no DATABASE_URL is set.
type MemoryStore struct {
	mu       sync.RWMutex
	byID     map[string]llm.Finding
	order    []string // insertion order, newest last
	prs      []PRRecord
	prByKey  map[string]int // "repo_full/pr/sha" -> index in prs
}

func NewMemory() *MemoryStore {
	return &MemoryStore{
		byID:    make(map[string]llm.Finding),
		prByKey: make(map[string]int),
	}
}

func (s *MemoryStore) AddFinding(fnd llm.Finding) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byID[fnd.ID]; ok {
		return nil // duplicate
	}
	if fnd.Status == "" {
		fnd.Status = "open"
	}
	s.byID[fnd.ID] = fnd
	s.order = append(s.order, fnd.ID)
	return nil
}

func (s *MemoryStore) AllFindings(repo, status, severity string) ([]llm.Finding, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]llm.Finding, 0, len(s.order))
	for i := len(s.order) - 1; i >= 0; i-- {
		f := s.byID[s.order[i]]
		if repo != "" && f.Repo != repo {
			continue
		}
		if status != "" && f.Status != status {
			continue
		}
		if severity != "" && f.Severity != severity {
			continue
		}
		out = append(out, f)
	}
	return out, nil
}

func (s *MemoryStore) UpsertPR(pr PRRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := pr.RepoFull + "/" + string(rune(pr.PR)) + "/" + pr.SHA
	if idx, ok := s.prByKey[key]; ok {
		s.prs[idx] = pr
	} else {
		s.prByKey[key] = len(s.prs)
		s.prs = append(s.prs, pr)
	}
	return nil
}

func (s *MemoryStore) AllPRs() ([]PRRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]PRRecord, len(s.prs))
	// Return newest-first
	for i, pr := range s.prs {
		out[len(s.prs)-1-i] = pr
	}
	return out, nil
}

func (s *MemoryStore) HasCompleteScan(repoFull string, pr int, sha string) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, rec := range s.prs {
		if rec.RepoFull == repoFull && rec.PR == pr && rec.SHA == sha && rec.Status == "complete" {
			return true, nil
		}
	}
	return false, nil
}

func (s *MemoryStore) Health() (int64, int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return int64(len(s.byID)), int64(len(s.prs)), nil
}
