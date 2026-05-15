func pingHost(host string) ([]byte, error) {
	return exec.Command("ping", "-c", "1", host).Output()
}
