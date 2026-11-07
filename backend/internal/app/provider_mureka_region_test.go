package app

import (
	"bytes"
	"context"
	"encoding/binary"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestMurekaRegionPreservesBothOutsideIntervalsAndRejectsShortResults(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg required")
	}
	dir := t.TempDir()
	// Use actual PCM containers at the delivery rate. Peaks differ at every frame.
	wave := func(name string, seconds int, invert bool) (string, []byte) {
		t.Helper()
		raw := make([]byte, seconds*int(regionRate*regionFrameBytes))
		for i := 0; i < len(raw); i += 4 {
			v := int16((i/4)%24000 - 12000)
			if invert {
				v = -v
			}
			binary.LittleEndian.PutUint16(raw[i:], uint16(v))
			binary.LittleEndian.PutUint16(raw[i+2:], uint16(-v))
		}
		dst := filepath.Join(dir, name+".wav")
		cmd := exec.Command("ffmpeg", "-nostdin", "-v", "error", "-f", "s16le", "-ar", "48000", "-ac", "2", "-i", "pipe:0", "-c:a", "pcm_s16le", dst)
		cmd.Stdin = bytes.NewReader(raw)
		if err := cmd.Run(); err != nil {
			t.Fatal(err)
		}
		return dst, raw
	}
	original, before := wave("original", 5, false)
	render, after := wave("render", 5, true)
	out, err := os.CreateTemp(dir, "final")
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()
	const start, end = 555, 3666
	if err := spliceRegionPCM(context.Background(), out, original, "wav", render, "wav", start, end, 2000000); err != nil {
		t.Fatal(err)
	}
	result, err := os.ReadFile(out.Name())
	if err != nil {
		t.Fatal(err)
	}
	if len(result) != 44+len(before) || string(result[:4]) != "RIFF" || string(result[36:40]) != "data" {
		t.Fatal("wrong WAV envelope or duration")
	}
	a, b := start*192, end*192
	pcm := result[44:]
	if !bytes.Equal(pcm[:a], before[:a]) || !bytes.Equal(pcm[a:b], after[a:b]) || !bytes.Equal(pcm[b:], before[b:]) {
		t.Fatal("render changed samples outside the requested range, or failed to replace inside it")
	}
	tooShort, _ := wave("short", 1, true)
	if err := spliceRegionPCM(context.Background(), out, original, "wav", tooShort, "wav", start, end, 2000000); err == nil {
		t.Fatal("accepted a truncated edit")
	}
}
