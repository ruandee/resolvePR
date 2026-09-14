// Package github is a minimal GitHub REST client: App authentication for
// the webhook server, plus the handful of PR endpoints the scanner needs.
package github

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Client wraps GitHub App credentials. Construct once, share across requests.
type Client struct {
	AppID      string
	privateKey *rsa.PrivateKey
}

// NewClient loads the App's private key and stores the App ID.
func NewClient(appID, privateKeyPath string) (*Client, error) {
	pemBytes, err := os.ReadFile(privateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("read pem: %w", err)
	}
	return NewClientFromPEM(appID, pemBytes)
}

// NewClientFromPEM builds a client from in-memory PEM bytes.
func NewClientFromPEM(appID string, pemBytes []byte) (*Client, error) {
	key, err := jwt.ParseRSAPrivateKeyFromPEM(pemBytes)
	if err != nil {
		return nil, fmt.Errorf("parse pem: %w", err)
	}
	return &Client{AppID: appID, privateKey: key}, nil
}

// signJWT creates a short-lived JWT (8 min) signed with the App's private key.
// Used to authenticate as the App ITSELF (not yet as an installation).
func (c *Client) signJWT() (string, error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{
		Issuer:    c.AppID,
		IssuedAt:  jwt.NewNumericDate(now.Add(-30 * time.Second)),
		ExpiresAt: jwt.NewNumericDate(now.Add(8 * time.Minute)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(c.privateKey)
}

// InstallationToken exchanges the App JWT for a 1-hour installation access token.
// THIS is the token you put in `Authorization: token <token>` on all API calls.
func (c *Client) InstallationToken(ctx context.Context, installationID int64) (string, error) {
	appJWT, err := c.signJWT()
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://api.github.com/app/installations/%s/access_tokens", strconv.FormatInt(installationID, 10))
	req, _ := http.NewRequestWithContext(ctx, "POST", url, nil)
	req.Header.Set("Authorization", "Bearer "+appJWT)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("install token %d: %s", resp.StatusCode, raw)
	}

	var t struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(raw, &t); err != nil {
		return "", err
	}
	return t.Token, nil
}

// get performs an authenticated GET. An empty token sends no Authorization
// header, which works for public repositories (rate-limited).
func get(ctx context.Context, token, url, accept string) ([]byte, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	if token != "" {
		req.Header.Set("Authorization", "token "+token)
	}
	req.Header.Set("Accept", accept)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("GET %s: %d: %s", url, resp.StatusCode, raw)
	}
	return raw, nil
}

// PullRequestFile is a slim model of GitHub's per-file PR metadata.
type PullRequestFile struct {
	Filename string `json:"filename"`
	Patch    string `json:"patch"`
	SHA      string `json:"sha"`
	Status   string `json:"status"` // added | modified | renamed | removed | ...
}

// PullRequestFiles lists the files changed in a PR (follows pagination).
func PullRequestFiles(ctx context.Context, token, owner, repo string, prNum int) ([]PullRequestFile, error) {
	var all []PullRequestFile
	for page := 1; ; page++ {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/files?per_page=100&page=%d", owner, repo, prNum, page)
		raw, err := get(ctx, token, url, "application/vnd.github+json")
		if err != nil {
			return nil, fmt.Errorf("list files: %w", err)
		}
		var files []PullRequestFile
		if err := json.Unmarshal(raw, &files); err != nil {
			return nil, err
		}
		all = append(all, files...)
		if len(files) < 100 {
			return all, nil
		}
	}
}

// PullRequest is the PR metadata the scanner needs.
type PullRequest struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	HeadSHA string `json:"-"`
	Head    struct {
		SHA string `json:"sha"`
	} `json:"head"`
}

// GetPullRequest fetches a PR's title and head SHA.
func GetPullRequest(ctx context.Context, token, owner, repo string, prNum int) (PullRequest, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d", owner, repo, prNum)
	raw, err := get(ctx, token, url, "application/vnd.github+json")
	if err != nil {
		return PullRequest{}, fmt.Errorf("get pull request: %w", err)
	}
	var pr PullRequest
	if err := json.Unmarshal(raw, &pr); err != nil {
		return PullRequest{}, err
	}
	pr.HeadSHA = pr.Head.SHA
	return pr, nil
}

// FileContent fetches the RAW bytes of a file at a given commit SHA.
// AST chunker needs the full file source, not just the diff hunks.
func FileContent(ctx context.Context, token, owner, repo, ref, path string) ([]byte, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s?ref=%s", owner, repo, path, ref)
	raw, err := get(ctx, token, url, "application/vnd.github.raw")
	if err != nil {
		return nil, fmt.Errorf("file content: %w", err)
	}
	return raw, nil
}
