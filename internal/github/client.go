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

// PullRequestFile is a slim model of GitHub's per-file PR metadata.
type PullRequestFile struct {
	Filename string `json:"filename"`
	Patch    string `json:"patch"`
	SHA      string `json:"sha"`
	Status   string `json:"status"`
}

// PullRequestFiles lists the files changed in a PR.
func PullRequestFiles(ctx context.Context, token, owner, repo string, prNum int) ([]PullRequestFile, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/pulls/%d/files", owner, repo, prNum)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("list files %d: %s", resp.StatusCode, raw)
	}

	var files []PullRequestFile
	if err := json.Unmarshal(raw, &files); err != nil {
		return nil, err
	}
	return files, nil
}

// FileContent fetches the RAW bytes of a file at a given commit SHA.
// AST chunker needs the full file source, not just the diff hunks.
func FileContent(ctx context.Context, token, owner, repo, ref, path string) ([]byte, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s?ref=%s", owner, repo, path, ref)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github.raw")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("file content %d: %s", resp.StatusCode, raw)
	}
	return io.ReadAll(resp.Body)
}
