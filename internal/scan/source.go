package scan

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"

	gh "resolvepr/internal/github"
)

// ChangedFile is one file touched by a change set.
type ChangedFile struct {
	Filename string // path within the repo (the new path for renames)
	Status   string // added | modified | renamed | removed
	Patch    string // GitHub `patch` format: hunks only, no diff --git/---/+++ header
	Source   []byte // full new-file contents at head; nil = not loaded yet
}

// Source yields the files changed by a pull request or local diff.
//
// Files may return ChangedFile values without Source populated; the scanner
// calls Content only for files it will actually review, so implementations
// backed by a network API avoid fetching skipped files (removed, unknown
// language, no added lines). In-memory implementations may pre-populate
// Source and never see a Content call.
type Source interface {
	Files(ctx context.Context) ([]ChangedFile, error)
	Content(ctx context.Context, filename string) ([]byte, error)
}

// ── GitHub ───────────────────────────────────────────────────────────────────

// GitHubSource reads a pull request through the GitHub REST API.
type GitHubSource struct {
	Token   string // installation/PAT/Actions token; "" works for public repos
	Owner   string
	Repo    string
	Number  int
	HeadSHA string // commit to read file contents from
}

func (s *GitHubSource) Files(ctx context.Context) ([]ChangedFile, error) {
	files, err := gh.PullRequestFiles(ctx, s.Token, s.Owner, s.Repo, s.Number)
	if err != nil {
		return nil, err
	}
	out := make([]ChangedFile, 0, len(files))
	for _, f := range files {
		out = append(out, ChangedFile{Filename: f.Filename, Status: f.Status, Patch: f.Patch})
	}
	return out, nil
}

func (s *GitHubSource) Content(ctx context.Context, filename string) ([]byte, error) {
	return gh.FileContent(ctx, s.Token, s.Owner, s.Repo, s.HeadSHA, filename)
}

// ── Local git ────────────────────────────────────────────────────────────────

// GitSource reads a change set from a local git repository by shelling out
// to git. Base and Head are any revisions git understands.
type GitSource struct {
	Dir  string // repository directory; "" = current directory
	Base string // e.g. "main", "HEAD~1"
	Head string // "" = HEAD
}

func (s *GitSource) head() string {
	if s.Head == "" {
		return "HEAD"
	}
	return s.Head
}

func (s *GitSource) git(ctx context.Context, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	if s.Dir != "" {
		cmd.Dir = s.Dir
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(stderr.String()))
	}
	return stdout.Bytes(), nil
}

// HeadSHA resolves the head revision to a full commit hash.
func (s *GitSource) HeadSHA(ctx context.Context) (string, error) {
	out, err := s.git(ctx, "rev-parse", s.head())
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// HeadSubject returns the head commit's subject line (used as a PR title
// stand-in for local scans).
func (s *GitSource) HeadSubject(ctx context.Context) (string, error) {
	out, err := s.git(ctx, "log", "-1", "--format=%s", s.head())
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// RemoteRepo tries to derive "owner/name" from the origin remote URL.
// Returns "" if there is no origin or it does not look like a GitHub URL.
func (s *GitSource) RemoteRepo(ctx context.Context) string {
	out, err := s.git(ctx, "remote", "get-url", "origin")
	if err != nil {
		return ""
	}
	return repoFromRemote(strings.TrimSpace(string(out)))
}

// repoFromRemote extracts owner/name from a GitHub remote URL
// (https://github.com/owner/name[.git], git@github.com:owner/name[.git],
// ssh://git@github.com/owner/name). Anything else yields "".
func repoFromRemote(url string) string {
	url = strings.TrimSuffix(strings.TrimSpace(url), "/")
	url = strings.TrimSuffix(url, ".git")
	if !strings.Contains(url, "github.com") {
		return ""
	}
	if !strings.Contains(url, "://") {
		// scp-like syntax: user@host:owner/name
		if i := strings.Index(url, ":"); i >= 0 {
			url = url[i+1:]
		}
	}
	parts := strings.Split(url, "/")
	if len(parts) < 2 {
		return ""
	}
	owner, name := parts[len(parts)-2], parts[len(parts)-1]
	if owner == "" || name == "" || strings.Contains(owner, ".") {
		return ""
	}
	return owner + "/" + name
}

func (s *GitSource) Files(ctx context.Context) ([]ChangedFile, error) {
	if s.Base == "" {
		return nil, fmt.Errorf("git source: base revision is required")
	}
	out, err := s.git(ctx, "diff", "--name-status", "-M", s.Base, s.head())
	if err != nil {
		return nil, err
	}

	var files []ChangedFile
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimRight(line, "\r")
		if line == "" {
			continue
		}
		fields := strings.Split(line, "\t")
		if len(fields) < 2 {
			continue
		}
		code := fields[0]
		var f ChangedFile
		var oldPath string
		switch code[0] {
		case 'A':
			f.Status, f.Filename = "added", fields[1]
		case 'M', 'T':
			f.Status, f.Filename = "modified", fields[1]
		case 'D':
			f.Status, f.Filename = "removed", fields[1]
		case 'R', 'C':
			if len(fields) < 3 {
				continue
			}
			f.Status, oldPath, f.Filename = "renamed", fields[1], fields[2]
		default:
			continue
		}
		if f.Status == "removed" {
			files = append(files, f)
			continue
		}
		paths := []string{f.Filename}
		if oldPath != "" {
			paths = append(paths, oldPath)
		}
		args := append([]string{"diff", "-U3", "-M", s.Base, s.head(), "--"}, paths...)
		raw, err := s.git(ctx, args...)
		if err != nil {
			return nil, err
		}
		f.Patch = StripDiffHeader(string(raw))
		files = append(files, f)
	}
	return files, nil
}

func (s *GitSource) Content(ctx context.Context, filename string) ([]byte, error) {
	return s.git(ctx, "show", s.head()+":"+filename)
}

// StripDiffHeader removes everything before the first hunk header so a
// `git diff` patch matches the GitHub API's `patch` field (hunks only).
// Returns "" for patches with no hunks (binary files, mode-only changes).
func StripDiffHeader(patch string) string {
	patch = strings.ReplaceAll(patch, "\r\n", "\n")
	i := strings.Index(patch, "\n@@")
	switch {
	case strings.HasPrefix(patch, "@@"):
		// already hunks-only
	case i >= 0:
		patch = patch[i+1:]
	default:
		return ""
	}
	return strings.TrimRight(patch, "\n")
}
