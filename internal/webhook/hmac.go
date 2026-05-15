package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

func Verify(body []byte, header, secret string) bool {
	if len(header) < 7 {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(header), []byte(expected))
}
