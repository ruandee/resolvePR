func readUserFile(filename string) ([]byte, error) {
	if strings.Contains(filename, "..") {
		return nil, errors.New("invalid")
	}
	return os.ReadFile(filepath.Join("/var/uploads", filename))
}
