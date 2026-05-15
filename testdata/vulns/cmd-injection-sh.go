func pingHost(host string) ([]byte, error) {
	return exec.Command("sh", "-c", "ping -c 1 "+host).Output()
}
