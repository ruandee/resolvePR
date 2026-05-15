package main

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"resolvepr/internal/github"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: test-github <installation-id>")
		os.Exit(1)
	}
	installID, _ := strconv.ParseInt(os.Args[1], 10, 64)

	client, err := github.NewClient(os.Getenv("GITHUB_APP_ID"), os.Getenv("GITHUB_PRIVATE_KEY_PATH"))
	if err != nil {
		fmt.Println("client error:", err)
		os.Exit(1)
	}

	token, err := client.InstallationToken(context.Background(), installID)
	if err != nil {
		fmt.Println("token error:", err)
		os.Exit(1)
	}

	fmt.Printf("got token: %s...%s (len %d)\n", token[:5], token[len(token)-5:], len(token))
}
