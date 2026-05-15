func readUserFile(filename string) ([]byte, error) {
	path := filepath.Join("/var/uploads", filename)
	return os.ReadFile(path)
}
