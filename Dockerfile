# ── Build stage ───────────────────────────────────────────────────────────────
FROM golang:1.26-bookworm AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# CGO required for go-tree-sitter
RUN CGO_ENABLED=1 GOOS=linux go build -o /secpr ./cmd/secpr

# ── Runtime stage ─────────────────────────────────────────────────────────────
# debian:bookworm-slim has glibc — needed for CGO binaries
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /secpr /secpr
# `serve` reads PORT (Cloud Run injects it); `action` ignores it.
EXPOSE 8080
# The GitHub Action (action.yml) passes `action`; the self-hosted webhook
# server runs the image with `serve`.
ENTRYPOINT ["/secpr"]
CMD ["serve"]
