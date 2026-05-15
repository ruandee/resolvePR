package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"resolvepr/internal/ast"
	"resolvepr/internal/llm"
)

func main() {
	body, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintln(os.Stderr, "read stdin:", err)
		os.Exit(1)
	}
	ch := ast.Chunk{
		File:         "test.go",
		Language:     "go",
		FunctionName: "test",
		FunctionBody: string(body),
		StartLine:    1,
		ChangedLines: []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
	}
	findings, err := llm.Review(context.Background(), ch)
	if err != nil {
		fmt.Fprintln(os.Stderr, "review:", err)
		os.Exit(1)
	}
	json.NewEncoder(os.Stdout).Encode(findings)
}
