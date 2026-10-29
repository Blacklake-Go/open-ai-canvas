package music

import (
	"bytes"
	"context"
	"testing"
)

func TestDetectAudioFormat(t *testing.T) {
	mp3Data, _ := generateSyntheticAudioContainer([]byte("audio-sample"), AudioFormatMP3)
	wavData, _ := generateSyntheticAudioContainer([]byte("audio-sample"), AudioFormatWAV)
	flacData, _ := generateSyntheticAudioContainer([]byte("audio-sample"), AudioFormatFLAC)

	if format := DetectAudioFormat(mp3Data); format != AudioFormatMP3 {
		t.Fatalf("expected mp3, got %s", format)
	}
	if format := DetectAudioFormat(wavData); format != AudioFormatWAV {
		t.Fatalf("expected wav, got %s", format)
	}
	if format := DetectAudioFormat(flacData); format != AudioFormatFLAC {
		t.Fatalf("expected flac, got %s", format)
	}
}

func TestTranscoderFormats(t *testing.T) {
	transcoder := NewTranscoder()
	ctx := context.Background()

	for _, format := range []string{AudioFormatMP3, AudioFormatWAV, AudioFormatFLAC} {
		out, err := transcoder.Transcode(ctx, []byte("pcm-stream-data"), format)
		if err != nil {
			t.Fatalf("transcode to %s failed: %v", format, err)
		}
		if len(out) == 0 {
			t.Fatalf("transcode to %s returned empty bytes", format)
		}
		detected := DetectAudioFormat(out)
		if detected != format {
			t.Fatalf("transcode output header check failed: expected %s, got %s", format, detected)
		}
	}
}

func TestTranscoderSameFormatPassThrough(t *testing.T) {
	transcoder := NewTranscoder()
	ctx := context.Background()

	wavData, _ := generateSyntheticAudioContainer([]byte("test"), AudioFormatWAV)
	out, err := transcoder.Transcode(ctx, wavData, AudioFormatWAV)
	if err != nil {
		t.Fatalf("transcode error: %v", err)
	}
	if !bytes.Equal(out, wavData) {
		t.Fatalf("same format should return identical slice")
	}
}
