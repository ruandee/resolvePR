package main

import (
	"fmt"

	"resolvepr/internal/diff"
)

func main() {
	cases := map[string]string{
		"normal":         "@@ -10,5 +10,8 @@\n a\n b\n+c\n+d\n+e\n f\n g",
		"empty patch":    "",
		"only deletions": "@@ -10,3 +10,1 @@\n-a\n-b\n c",
	}
	for name, patch := range cases {
		h := diff.Parse(patch)
		fmt.Printf("[%s] added=%v positions=%v\n", name, h.AddedLines, h.DiffPositions)
	}
}
