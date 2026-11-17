package auth

import (
	"bufio"
	"encoding/base64"
	"io"
	"mime"
	"mime/multipart"
	"net"
	"net/mail"
	"net/textproto"
	"strings"
	"testing"
	"time"
	"yingce/backend/internal/supdance/emailcenter"
)

func captureSMTP(t *testing.T, confirm bool) (EmailSettingValue, <-chan []byte) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	captured := make(chan []byte, 1)
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
		reader := textproto.NewReader(bufio.NewReader(conn))
		writer := bufio.NewWriter(conn)
		reply := func(line string) { _, _ = writer.WriteString(line + "\r\n"); _ = writer.Flush() }
		reply("220 local capture")
		for {
			line, err := reader.ReadLine()
			if err != nil {
				return
			}
			switch {
			case strings.HasPrefix(line, "EHLO"), strings.HasPrefix(line, "HELO"):
				reply("250 local capture")
			case strings.HasPrefix(line, "MAIL FROM"), strings.HasPrefix(line, "RCPT TO"):
				reply("250 OK")
			case line == "DATA":
				reply("354 send data")
				body, err := reader.ReadDotBytes()
				if err != nil {
					return
				}
				captured <- body
				if confirm {
					reply("250 accepted")
				}
				return
			default:
				reply("500 unsupported")
			}
		}
	}()
	return EmailSettingValue{Enabled: true, Host: "127.0.0.1", Port: listener.Addr().(*net.TCPAddr).Port, Encryption: "none", FromEmail: "support@example.com", FromName: "SupDance"}, captured
}
func TestSMTPCaptureMatchesRendererAndAcceptsEvenWhenQUITFails(t *testing.T) {
	e, _ := emailcenter.FindEvent("registration")
	rendered, err := emailcenter.Render(e, emailcenter.DefaultDocument(e), emailcenter.Brand{Name: "SupDance"}, emailcenter.Payload{Code: "073941", Recipient: "reader@example.com", ExpiresAt: time.Now().Add(time.Minute)})
	if err != nil {
		t.Fatal(err)
	}
	setting, captured := captureSMTP(t, true)
	if err := sendSMTPMail(setting, "reader@example.com", OutgoingMail{Subject: rendered.Subject, HTML: rendered.HTML, Text: rendered.Text}); err != nil {
		t.Fatal("accepted DATA was incorrectly failed by QUIT", err)
	}
	var raw []byte
	select {
	case raw = <-captured:
	case <-time.After(time.Second):
		t.Fatal("SMTP capture missing")
	}
	message, err := mail.ReadMessage(strings.NewReader(string(raw)))
	if err != nil {
		t.Fatal(err)
	}
	subject, err := new(mime.WordDecoder).DecodeHeader(message.Header.Get("Subject"))
	if err != nil || strings.Contains(subject, "073941") {
		t.Fatal("credential leaked in subject")
	}
	if message.Header.Get("To") != "reader@example.com" || message.Header.Get("Bcc") != "" || message.Header.Get("List-Unsubscribe") != "" {
		t.Fatal("security mail exposed other recipients or marketing headers")
	}
	_, params, err := mime.ParseMediaType(message.Header.Get("Content-Type"))
	if err != nil {
		t.Fatal(err)
	}
	parts := multipart.NewReader(message.Body, params["boundary"])
	bodies := map[string]string{}
	for {
		part, err := parts.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		content, err := io.ReadAll(base64.NewDecoder(base64.StdEncoding, part))
		if err != nil {
			t.Fatal(err)
		}
		kind, _, _ := mime.ParseMediaType(part.Header.Get("Content-Type"))
		bodies[kind] = string(content)
	}
	if bodies["text/plain"] != rendered.Text || bodies["text/html"] != rendered.HTML {
		t.Fatal("SMTP HTML/text differ from the shared renderer")
	}
}
func TestSMTPDisconnectAfterDATAYieldsUnknown(t *testing.T) {
	setting, captured := captureSMTP(t, false)
	err := sendSMTPMail(setting, "reader@example.com", OutgoingMail{Subject: "Capture only", Text: "not an authentication challenge"})
	if err == nil {
		t.Fatal("missing final SMTP response was called success")
	}
	status, stage := EmailDeliveryResult(err)
	if status != "unknown" || stage != "finish_data" {
		t.Fatal(status, stage)
	}
	select {
	case <-captured:
	case <-time.After(time.Second):
		t.Fatal("DATA never reached capture")
	}
}
