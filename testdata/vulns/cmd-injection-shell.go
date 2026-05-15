func archiveLog(filename string) error {
	return exec.Command("bash", "-c", "tar -czf /tmp/log.tgz "+filename).Run()
}
