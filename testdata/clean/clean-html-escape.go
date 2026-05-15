func renderProfile(w http.ResponseWriter, name string) {
	fmt.Fprintf(w, "<h1>Welcome, %s</h1>", html.EscapeString(name))
}
