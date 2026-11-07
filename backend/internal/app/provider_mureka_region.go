package app

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"yingce/backend/internal/model"
)

// Both inputs are decoded to the same PCM format before replacing whole frames.
// Only the confirmed interval is written over the decoded original.
const regionRate int64 = 48000
const regionFrameBytes int64 = 4 // stereo, signed 16-bit PCM

func (s *Service) preserveMurekaRegion(ctx context.Context, task *model.Task, take string, takeType string) (name string, err error) {
	var input struct {
		Metadata struct {
			Music struct {
				Operation              string
				SourceResourceID       string
				EditStartMs, EditEndMs int64
			}
		}
	}
	if err := json.Unmarshal([]byte(task.InputJSON), &input); err != nil {
		return "", err
	}
	req := input.Metadata.Music
	if req.Operation != "region" || req.SourceResourceID == "" || req.EditStartMs < 0 || req.EditEndMs <= req.EditStartMs || req.EditEndMs-req.EditStartMs < 3000 {
		return "", errors.New("invalid music region receipt")
	}
	original, reader, err := s.OpenResource(task.UserID, req.SourceResourceID)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	if original.Kind != "audio" || original.Status != model.ResourceStatusReady || original.Size <= 0 || original.Size > murekaSourceLimit {
		return "", errors.New("original recording is unavailable")
	}
	originalFile, err := s.newMediaTemp(original.Size)
	if err != nil {
		return "", err
	}
	defer os.Remove(originalFile.Name())
	n, copyErr := io.Copy(originalFile, io.LimitReader(reader, original.Size+1))
	closeErr := originalFile.Close()
	if copyErr != nil || closeErr != nil || n != original.Size {
		return "", errors.New("incomplete original recording")
	}
	policy, err := s.RuntimePolicy()
	if err != nil {
		return "", err
	}
	limit := min(megabytes(policy.Resource.GeneratedFileMB), mediaStagingBudget/2)
	mixed, err := s.newMediaTemp(limit)
	if err != nil {
		return "", err
	}
	defer func() {
		if err != nil {
			os.Remove(mixed.Name())
		}
	}()
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	sourceDemux := "mp3"
	if original.MimeType == "audio/mp4" || original.MimeType == "audio/m4a" || original.MimeType == "audio/x-m4a" {
		sourceDemux = "mov"
	}
	takeDemux := "mp3"
	if takeType == "audio/wav" || takeType == "audio/x-wav" {
		takeDemux = "wav"
	}
	if err = spliceRegionPCM(ctx, mixed, originalFile.Name(), sourceDemux, take, takeDemux, req.EditStartMs, req.EditEndMs, limit); err != nil {
		mixed.Close()
		return "", err
	}
	if err = mixed.Close(); err != nil {
		return "", err
	}
	return filepath.Base(mixed.Name()), nil
}

func spliceRegionPCM(ctx context.Context, out *os.File, original, originalFormat, take, takeFormat string, startMs, endMs, limit int64) error {
	const header = 44
	// Check against the byte budget ahead of multiplying user-controlled timestamps.
	if limit <= header || startMs < 0 || endMs <= startMs || endMs > (limit-header)/(regionFrameBytes*regionRate/1000) {
		return errors.New("region exceeds the available audio length or output size")
	}
	start, end := startMs*(regionRate/1000), endMs*(regionRate/1000)
	if _, err := out.Seek(header, io.SeekStart); err != nil {
		return err
	}
	length, err := copyRegionPCM(ctx, original, originalFormat, "aresample=48000", out, limit-header)
	if err != nil {
		return err
	}
	if length%regionFrameBytes != 0 || end*regionFrameBytes > length {
		return errors.New("region exceeds the decoded original audio")
	}
	if err = out.Truncate(header + length); err != nil {
		return err
	}
	if _, err = out.Seek(header+start*regionFrameBytes, io.SeekStart); err != nil {
		return err
	}
	desired := (end - start) * regionFrameBytes
	filter := fmt.Sprintf("aresample=48000,atrim=start_sample=%d:end_sample=%d", start, end)
	written, err := copyRegionPCM(ctx, take, takeFormat, filter, out, desired)
	if err != nil {
		return err
	}
	if written != desired {
		return errors.New("generated audio does not contain the entire selected region")
	}
	var wav [header]byte
	copy(wav[:], "RIFF")
	binary.LittleEndian.PutUint32(wav[4:], uint32(length+36))
	copy(wav[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(wav[16:], 16)
	binary.LittleEndian.PutUint16(wav[20:], 1)
	binary.LittleEndian.PutUint16(wav[22:], 2)
	binary.LittleEndian.PutUint32(wav[24:], uint32(regionRate))
	binary.LittleEndian.PutUint32(wav[28:], uint32(regionRate*regionFrameBytes))
	binary.LittleEndian.PutUint16(wav[32:], uint16(regionFrameBytes))
	binary.LittleEndian.PutUint16(wav[34:], 16)
	copy(wav[36:], "data")
	binary.LittleEndian.PutUint32(wav[40:], uint32(length))
	_, err = out.WriteAt(wav[:], 0)
	return err
}

func copyRegionPCM(ctx context.Context, path, demuxer, filter string, out io.Writer, limit int64) (int64, error) {
	child, cancel := context.WithCancel(ctx)
	defer cancel()
	cmd := exec.CommandContext(child, "ffmpeg", "-nostdin", "-v", "error", "-protocol_whitelist", "file", "-threads", "1", "-f", demuxer, "-i", path, "-map", "0:a:0", "-vn", "-filter_threads", "1", "-af", filter, "-ac", "2", "-ar", "48000", "-f", "s16le", "pipe:1")
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return 0, err
	}
	if err = cmd.Start(); err != nil {
		return 0, err
	}
	n, copyErr := io.Copy(out, io.LimitReader(pipe, limit+1))
	if n > limit || copyErr != nil {
		cancel()
	}
	processErr := cmd.Wait()
	if n > limit {
		return 0, errors.New("decoded audio exceeds the editing size limit")
	}
	if copyErr != nil {
		return 0, copyErr
	}
	if processErr != nil || n == 0 {
		return 0, errors.New("could not decode the audio for region editing")
	}
	return n, nil
}
