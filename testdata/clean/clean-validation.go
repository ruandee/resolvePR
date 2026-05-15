func validateEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}
