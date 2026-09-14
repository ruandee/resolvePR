package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	gh "secpr/internal/github"
	"secpr/internal/llm"
	"secpr/internal/scan"
	"secpr/internal/store"
	"secpr/internal/webhook"
)

const serveUsage = `Usage:
  secpr serve [--port 8080] [--api-key K] [--model M]

Self-hosted GitHub App webhook server. Environment:
  WEBHOOK_SECRET           GitHub App webhook secret (HMAC)
  GITHUB_APP_ID            GitHub App ID
  GITHUB_PRIVATE_KEY_PATH  path to the App's private key PEM
  GITHUB_PRIVATE_KEY       ...or the PEM contents inline
  ANTHROPIC_API_KEY        Anthropic API key
  DATABASE_URL             Postgres DSN (optional; in-memory store if unset)
  PORT                     listen port (default 8080)

Endpoints: POST /webhook, POST /rescan, GET /findings, GET /prs, GET /health

`

// server holds what the handlers need. No package-level globals.
type server struct {
	gh      *gh.Client
	db      store.Store
	llm     *llm.Client
	secret  string
	scanWg  sync.WaitGroup
	scanner *scan.Scanner
}

type webhookEvent struct {
	Action      string `json:"action"`
	Number      int    `json:"number"`
	PullRequest struct {
		Title string `json:"title"`
		Head  struct {
			SHA string `json:"sha"`
		} `json:"head"`
	} `json:"pull_request"`
	Repository struct {
		Name  string `json:"name"`
		Owner struct {
			Login string `json:"login"`
		} `json:"owner"`
	} `json:"repository"`
	Installation struct {
		ID int64 `json:"id"`
	} `json:"installation"`
}

func runServe(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ContinueOnError)
	fs.Usage = func() { fmt.Fprint(os.Stderr, serveUsage); fs.PrintDefaults() }
	var (
		lf   llmFlags
		port = fs.String("port", "", "listen port (default: $PORT, then 8080)")
	)
	lf.register(fs)
	if err := fs.Parse(args); err != nil {
		return exitCode(2)
	}
	_ = godotenv.Load()

	// GitHub App credentials. GITHUB_PRIVATE_KEY (inline PEM) is the
	// container-friendly form; GITHUB_PRIVATE_KEY_PATH the local one.
	appID := os.Getenv("GITHUB_APP_ID")
	var ghc *gh.Client
	var err error
	switch {
	case appID == "":
		return fmt.Errorf("GITHUB_APP_ID is required")
	case os.Getenv("GITHUB_PRIVATE_KEY") != "":
		ghc, err = gh.NewClientFromPEM(appID, []byte(os.Getenv("GITHUB_PRIVATE_KEY")))
	case os.Getenv("GITHUB_PRIVATE_KEY_PATH") != "":
		ghc, err = gh.NewClient(appID, os.Getenv("GITHUB_PRIVATE_KEY_PATH"))
	default:
		return fmt.Errorf("GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH is required")
	}
	if err != nil {
		return fmt.Errorf("github client: %w", err)
	}

	client := lf.client("", "")
	if !client.Ready() {
		return llm.ErrNoAPIKey
	}

	var db store.Store
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		log.Printf("connecting to postgres...")
		pg, err := store.New(dsn)
		if err != nil {
			return fmt.Errorf("store: %w", err)
		}
		db = pg
		log.Printf("postgres connected and schema migrated")
	} else {
		log.Printf("DATABASE_URL not set — using in-memory store (data lost on restart)")
		db = store.NewMemory()
	}

	s := &server{
		gh:      ghc,
		db:      db,
		llm:     client,
		secret:  os.Getenv("WEBHOOK_SECRET"),
		scanner: &scan.Scanner{Reviewer: client},
	}
	if s.secret == "" {
		log.Printf("WARNING: WEBHOOK_SECRET is empty — webhook signatures will not verify")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/webhook", s.handleWebhook)
	mux.HandleFunc("/findings", s.handleFindings)
	mux.HandleFunc("/prs", s.handlePRs)
	mux.HandleFunc("/rescan", s.handleRescan)

	p := firstNonEmpty(*port, os.Getenv("PORT"), "8080")
	srv := &http.Server{Addr: ":" + p, Handler: corsMiddleware(mux)}
	go func() {
		log.Printf("SecPR %s listening on :%s (model %s)", version, p, client.ModelName())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit
	log.Printf("shutdown signal received — draining active scans")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	_ = srv.Shutdown(shutCtx)
	s.scanWg.Wait()
	log.Printf("shutdown complete")
	return nil
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func (s *server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	findings, prs, err := s.db.Health()
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "error", "error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":   "ok",
		"version":  version,
		"findings": findings,
		"prs":      prs,
	})
}

func (s *server) handleWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "read error", http.StatusBadRequest)
		return
	}
	if !webhook.Verify(body, r.Header.Get("X-Hub-Signature-256"), s.secret) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}
	switch r.Header.Get("X-GitHub-Event") {
	case "ping":
		_, _ = w.Write([]byte("pong"))
		return
	case "pull_request":
	default:
		w.WriteHeader(http.StatusNoContent)
		return
	}
	var evt webhookEvent
	if err := json.Unmarshal(body, &evt); err != nil {
		http.Error(w, "json parse error", http.StatusBadRequest)
		return
	}
	if evt.Action != "opened" && evt.Action != "synchronize" && evt.Action != "reopened" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.WriteHeader(http.StatusNoContent)
	s.scanWg.Add(1)
	go func() {
		defer s.scanWg.Done()
		s.processPR(evt)
	}()
}

// handleFindings serves all findings from the store as JSON.
// Query params: ?repo=owner/name  ?status=open  ?severity=CRITICAL
func (s *server) handleFindings(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	findings, err := s.db.AllFindings(q.Get("repo"), q.Get("status"), q.Get("severity"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if findings == nil {
		findings = []llm.Finding{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(findings)
}

// handlePRs serves all PR scan records from the store as JSON.
func (s *server) handlePRs(w http.ResponseWriter, _ *http.Request) {
	prs, err := s.db.AllPRs()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if prs == nil {
		prs = []store.PRRecord{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(prs)
}

func (s *server) handleRescan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Owner          string `json:"owner"`
		Repo           string `json:"repo"`
		PR             int    `json:"pr"`
		SHA            string `json:"sha"`
		InstallationID int64  `json:"installation_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if body.Owner == "" || body.Repo == "" || body.PR == 0 || body.SHA == "" {
		http.Error(w, "owner, repo, pr, sha required", http.StatusBadRequest)
		return
	}
	var evt webhookEvent
	evt.Action = "opened"
	evt.Number = body.PR
	evt.PullRequest.Head.SHA = body.SHA
	evt.Repository.Name = body.Repo
	evt.Repository.Owner.Login = body.Owner
	evt.Installation.ID = body.InstallationID

	s.scanWg.Add(1)
	go func() {
		defer s.scanWg.Done()
		s.processPR(evt)
	}()
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "queued"})
}

// ── PR processing ────────────────────────────────────────────────────────────

func (s *server) processPR(evt webhookEvent) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	owner := evt.Repository.Owner.Login
	repo := evt.Repository.Name
	meta := scan.PRMeta{
		Repo:    owner + "/" + repo,
		Number:  evt.Number,
		Title:   evt.PullRequest.Title,
		HeadSHA: evt.PullRequest.Head.SHA,
	}
	log.Printf("[secpr] processing %s#%d sha=%s", meta.Repo, meta.Number, shortSHA(meta.HeadSHA))

	// Skip if this exact commit was already successfully scanned.
	if exists, err := s.db.HasCompleteScan(meta.Repo, meta.Number, meta.HeadSHA); err == nil && exists {
		log.Printf("[secpr] skip duplicate scan %s#%d sha=%s", meta.Repo, meta.Number, shortSHA(meta.HeadSHA))
		return
	}

	storeSink := &scan.StoreSink{Store: s.db}

	token, err := s.gh.InstallationToken(ctx, evt.Installation.ID)
	if err != nil {
		log.Printf("[secpr] install token: %v", err)
		_ = storeSink.Begin(ctx, meta)
		storeSink.Fail(ctx, meta, fmt.Errorf("install token: %w", err))
		return
	}

	src := &scan.GitHubSource{Token: token, Owner: owner, Repo: repo, Number: meta.Number, HeadSHA: meta.HeadSHA}
	sinks := []scan.Sink{
		storeSink,
		&scan.GitHubSink{Token: token, Owner: owner, Repo: repo, Number: meta.Number, HeadSHA: meta.HeadSHA},
	}
	res, err := scan.Run(ctx, s.scanner, src, meta, sinks...)
	if err != nil {
		log.Printf("[secpr] scan %s#%d failed: %v", meta.Repo, meta.Number, err)
		return
	}
	log.Printf("[secpr] done %s#%d — %d finding(s)", meta.Repo, meta.Number, len(res.Findings))
}
