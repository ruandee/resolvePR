func newClient() *Client {
	return &Client{APIKey: os.Getenv("API_KEY")}
}
