package main

import (
	"fmt"
	"os"

	"resolvepr/internal/ast"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: test-chunker <file>")
		os.Exit(1)
	}
	src, err := os.ReadFile(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	lang := ast.DetectLang(os.Args[1])
	chunks := ast.MakeChunks(src, lang, os.Args[1], []int{25, 26, 27})
	for _, c := range chunks {
		fmt.Printf("=== %s @ %d ===\n%s\n", c.FunctionName, c.StartLine, c.FunctionBody)
	}
}
