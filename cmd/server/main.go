package main

import (
	"context"
	"encoding/json"
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

	"resolvepr/internal/ast"
	"resolvepr/internal/diff"
	gh "resolvepr/internal/github"
	"resolvepr/internal/llm"
	"resolvepr/internal/output"
	"resolvepr/internal/store"
	"resolvepr/internal/webhook"
)

// ── CORS middleware ───────────────────────────────────────────────────────────

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

// ── Globals ───────────────────────────────────────────────────────────────────

var (
	ghClient *gh.Client
	db       store.Store
	scanWg   sync.WaitGroup
)

type webhookEvent struct {
	Action      string `json:"action"`
	Number      int    `json:"number"`
	PullRequest struct {
		Head struct {
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

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	godotenv.Load()

	// Write GitHub private key to temp file (Fly.io pattern)
	if pk := os.Getenv("GITHUB_PRIVATE_KEY"); pk != "" {
		if err := os.WriteFile("/tmp/key.pem", []byte(pk), 0600); err != nil {
			log.Fatalf("write private key: %v", err)
		}
		os.Setenv("GITHUB_PRIVATE_KEY_PATH", "/tmp/key.pem")
	}

	appID := os.Getenv("GITHUB_APP_ID")
	keyPath := os.Getenv("GITHUB_PRIVATE_KEY_PATH")
	if appID == "" || keyPath == "" {
		log.Fatal("GITHUB_APP_ID and GITHUB_PRIVATE_KEY_PATH are required")
	}

	c, err := gh.NewClient(appID, keyPath)
	if err != nil {
		log.Fatalf("github client: %v", err)
	}
	ghClient = c

	// ── Database ──────────────────────────────────────────────────────────────
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		log.Printf("connecting to postgres...")
		pg, err := store.New(dsn)
		if err != nil {
			log.Fatalf("store: %v", err)
		}
		db = pg
		log.Printf("postgres connected and schema migrated")
	} else {
		log.Printf("DATABASE_URL not set — using in-memory store (data lost on restart)")
		db = store.NewMemory()
	}

	// ── Routes ────────────────────────────────────────────────────────────────
	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/webhook", handleWebhook)
	mux.HandleFunc("/findings", handleFindings)
	mux.HandleFunc("/prs", handlePRs)
	mux.HandleFunc("/rescan", handleRescan)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{Addr: ":" + port, Handler: corsMiddleware(mux)}
	go func() {
		log.Printf("SecPR listening on :%s", port)
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
	srv.Shutdown(shutCtx)
	scanWg.Wait()
	log.Printf("shutdown complete")
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	findings, prs, err := db.Health()
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]any{"status": "error", "error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"status":   "ok",
		"findings": findings,
		"prs":      prs,
	})
}

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "read error", http.StatusBadRequest)
		return
	}
	if !webhook.Verify(body, r.Header.Get("X-Hub-Signature-256"), os.Getenv("WEBHOOK_SECRET")) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}
	switch r.Header.Get("X-GitHub-Event") {
	case "ping":
		w.Write([]byte("pong"))
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
	scanWg.Add(1)
	go func() {
		defer scanWg.Done()
		processPR(evt)
	}()
}

// handleFindings serves all findings from the store as JSON.
// Query params: ?repo=owner/name  ?status=open  ?severity=CRITICAL
func handleFindings(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	findings, err := db.AllFindings(q.Get("repo"), q.Get("status"), q.Get("severity"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if findings == nil {
		findings = []llm.Finding{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(findings)
}

// handlePRs serves all PR scan records from the store as JSON.
func handlePRs(w http.ResponseWriter, r *http.Request) {
	prs, err := db.AllPRs()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if prs == nil {
		prs = []store.PRRecord{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(prs)
}

func handleRescan(w http.ResponseWriter, r *http.Request) {
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
	scanWg.Add(1)
	go func() {
		defer scanWg.Done()
		processPR(webhookEvent{
			Action: "opened",
			Number: body.PR,
			PullRequest: struct {
				Head struct {
					SHA string `json:"sha"`
				} `json:"head"`
			}{Head: struct {
				SHA string `json:"sha"`
			}{SHA: body.SHA}},
			Repository: struct {
				Name  string `json:"name"`
				Owner struct {
					Login string `json:"login"`
				} `json:"owner"`
			}{Name: body.Repo, Owner: struct {
				Login string `json:"login"`
			}{Login: body.Owner}},
			Installation: struct {
				ID int64 `json:"id"`
			}{ID: body.InstallationID},
		})
	}()
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"status": "queued"})
}

// ── PR processing ─────────────────────────────────────────────────────────────

func processPR(evt webhookEvent) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	owner := evt.Repository.Owner.Login
	repo := evt.Repository.Name
	prNum := evt.Number
	sha := evt.PullRequest.Head.SHA
	repoFull := fmt.Sprintf("%s/%s", owner, repo)
	now := time.Now().Unix()

	log.Printf("[secpr] processing %s#%d sha=%s", repoFull, prNum, sha[:7])

	// Skip if this exact commit was already successfully scanned
	if exists, err := db.HasCompleteScan(repoFull, prNum, sha); err == nil && exists {
		log.Printf("[secpr] skip duplicate scan %s#%d sha=%s", repoFull, prNum, sha[:7])
		return
	}

	// Record PR as "scanning" immediately
	_ = db.UpsertPR(store.PRRecord{
		Owner: owner, Repo: repo, RepoFull: repoFull,
		PR: prNum, SHA: sha, Status: "scanning",
		FindingsCount: 0, ScannedAt: now,
	})

	token, err := ghClient.InstallationToken(ctx, evt.Installation.ID)
	if err != nil {
		log.Printf("[secpr] install token: %v", err)
		_ = db.UpsertPR(store.PRRecord{Owner: owner, Repo: repo, RepoFull: repoFull, PR: prNum, SHA: sha, Status: "failed", ScannedAt: now, ErrorMessage: fmt.Sprintf("install token: %v", err)})
		return
	}

	checkID, err := output.CreateCheck(ctx, token, owner, repo, sha)
	if err != nil {
		log.Printf("[secpr] create check: %v", err)
	}
	_ = checkID

	files, err := gh.PullRequestFiles(ctx, token, owner, repo, prNum)
	if err != nil {
		log.Printf("[secpr] list files: %v", err)
		_ = db.UpsertPR(store.PRRecord{Owner: owner, Repo: repo, RepoFull: repoFull, PR: prNum, SHA: sha, Status: "failed", ScannedAt: now, ErrorMessage: fmt.Sprintf("list files: %v", err)})
		return
	}

	var allFindings []llm.Finding

	for _, f := range files {
		if f.Status == "removed" {
			continue
		}
		lang := ast.DetectLang(f.Filename)
		if lang == "unknown" {
			continue
		}
		hunk := diff.Parse(f.Patch)
		if len(hunk.AddedLines) == 0 {
			continue
		}
		source, err := gh.FileContent(ctx, token, owner, repo, sha, f.Filename)
		if err != nil {
			log.Printf("[secpr] file content %s: %v", f.Filename, err)
			continue
		}
		chunks := ast.MakeChunks(source, lang, f.Filename, hunk.AddedLines)
		for _, ch := range chunks {
			findings, err := llm.Review(ctx, ch)
			if err != nil {
				log.Printf("[secpr] llm review %s: %v", ch.FunctionName, err)
				continue
			}
			for _, fnd := range findings {
				fileLine := ch.StartLine + fnd.Line - 1
				pos, ok := hunk.DiffPositions[fileLine]
				if !ok {
					log.Printf("[secpr] no diff position for line %d in %s — skipping", fileLine, f.Filename)
					continue
				}
				if err := output.PostComment(ctx, token, owner, repo, prNum, sha, f.Filename, pos, fnd); err != nil {
					log.Printf("[secpr] post comment: %v", err)
				}
				fnd.ID = llm.ContentID(fnd.CWE, f.Filename, fileLine)
				fnd.Repo = repoFull
				fnd.PR = prNum
				fnd.File = f.Filename
				fnd.Line = fileLine
				fnd.CreatedAt = now
				fnd.Status = "open"
				if err := db.AddFinding(fnd); err != nil {
					log.Printf("[secpr] store finding: %v", err)
				}
				allFindings = append(allFindings, fnd)
			}
		}
	}

	// Mark PR as complete with final finding count
	_ = db.UpsertPR(store.PRRecord{
		Owner: owner, Repo: repo, RepoFull: repoFull,
		PR: prNum, SHA: sha, Status: "complete",
		FindingsCount: len(allFindings), ScannedAt: now,
	})

	if err := output.PostSummary(ctx, token, owner, repo, prNum, allFindings); err != nil {
		log.Printf("[secpr] post summary: %v", err)
	}
	if checkID != 0 {
		if err := output.CompleteCheck(ctx, token, owner, repo, checkID, allFindings); err != nil {
			log.Printf("[secpr] complete check: %v", err)
		}
	}
	log.Printf("[secpr] done %s#%d — %d finding(s)", repoFull, prNum, len(allFindings))
}
