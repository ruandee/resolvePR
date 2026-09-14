package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func sign(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyAccepts(t *testing.T) {
	body := []byte(`{"action":"opened"}`)
	if !Verify(body, sign(body, "s3cret"), "s3cret") {
		t.Fatal("valid signature rejected")
	}
}

func TestVerifyRejects(t *testing.T) {
	body := []byte(`{"action":"opened"}`)
	cases := map[string]struct {
		header, secret string
		body           []byte
	}{
		"wrong secret":     {sign(body, "s3cret"), "other", body},
		"tampered body":    {sign(body, "s3cret"), "s3cret", []byte(`{"action":"closed"}`)},
		"empty header":     {"", "s3cret", body},
		"short header":     {"sha256", "s3cret", body},
		"missing prefix":   {hex.EncodeToString(make([]byte, 32)), "s3cret", body},
		"wrong algorithm":  {"sha1=" + sign(body, "s3cret")[7:], "s3cret", body},
		"garbage header":   {"sha256=nothex", "s3cret", body},
		"empty secret":     {sign(body, "s3cret"), "", body},
		"trailing garbage": {sign(body, "s3cret") + "x", "s3cret", body},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			if Verify(c.body, c.header, c.secret) {
				t.Fatalf("signature accepted but should be rejected")
			}
		})
	}
}
