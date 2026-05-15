func signToken(claims jwt.Claims) (string, error) {
	secret := []byte("supersecret123")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}
