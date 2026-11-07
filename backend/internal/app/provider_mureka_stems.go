package app

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"strings"
	"time"

	"yingce/backend/internal/model"
)

func startMurekaStems(ctx context.Context, info providerAnalyticsContext, config providerConfig, archive string) (map[string]interface{}, error) {
	if !murekaOutputURL(archive) {
		return nil, errors.New("Mureka returned no usable stem archive")
	}
	task, ok := ctx.Value(mediaExecutionTaskKey{}).(model.Task)
	if !ok || task.Status != model.TaskStatusRunning || task.ID != info.TaskID || task.UserID != info.UserID {
		return nil, errors.New("stem extraction requires an active media task")
	}
	cp := &mediaCheckpoint{Mode: "audio", MurekaOperation: "stems", StemArchiveURL: archive, StartedAt: time.Now()}
	if err := info.Service.saveMediaCheckpoint(&task, cp, "download"); err != nil {
		return nil, err
	}
	return info.Service.materializeTaskMedia(ctx, &task, config, cp)
}

// Stage members individually so a failed download can recover from the encrypted ZIP receipt.
func (s *Service) stageMurekaStems(ctx context.Context, task *model.Task, config providerConfig, cp *mediaCheckpoint) error {
	archive, _, err := getProviderExternalBinary(withProviderRequestKind(ctx, "download"), providerConfig{InterfaceType: "mureka-music-tools"}, cp.StemArchiveURL)
	if err != nil {
		return &mediaRecoveryError{stage: "download", retryable: retryableProtocolMediaDownload(err), cause: err}
	}
	var staged []mediaCheckpointItem
	err = readMurekaStems(archive, func(label string, wav []byte) error {
		name, err := s.stageInlineMedia(wav)
		if err == nil {
			staged = append(staged, mediaCheckpointItem{StemName: label, MIMEType: "audio/wav", TempName: name})
		}
		return err
	})
	if err == nil {
		next := *cp
		next.StemArchiveURL = ""
		next.Items = staged
		if err = s.saveMediaCheckpoint(task, &next, "download"); err == nil {
			*cp = next
			return nil
		}
	}
	for _, item := range staged {
		_ = os.Remove(s.mediaTempPath(item.TempName))
	}
	return err
}

func readMurekaStems(data []byte, visit func(string, []byte) error) error {
	const memberLimit = 64 << 20
	const totalLimit = 192 << 20
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return fmt.Errorf("invalid Mureka ZIP: %w", err)
	}
	if len(archive.File) > 32 {
		return errors.New("too many members in stem archive")
	}
	seen := map[string]bool{}
	var total uint64
	for _, file := range archive.File {
		if file.FileInfo().IsDir() || !strings.EqualFold(path.Ext(file.Name), ".wav") {
			continue
		}
		if !file.Mode().IsRegular() || path.IsAbs(file.Name) || strings.Contains(file.Name, "\\") || path.Clean(file.Name) != file.Name || strings.HasPrefix(file.Name, "../") {
			return errors.New("unsafe stem archive member")
		}
		label := strings.TrimSuffix(path.Base(file.Name), path.Ext(file.Name))
		if label == "" || len(label) > 128 || strings.ContainsAny(label, "\r\n\t") || seen[strings.ToLower(label)] || len(seen) >= 5 {
			return errors.New("invalid or duplicate stem label")
		}
		if file.UncompressedSize64 < 12 || file.UncompressedSize64 > memberLimit || total+file.UncompressedSize64 > totalLimit {
			return errors.New("stem archive exceeds the audio size limits")
		}
		reader, err := file.Open()
		if err != nil {
			return err
		}
		wav, err := io.ReadAll(io.LimitReader(reader, memberLimit+1))
		reader.Close()
		if err != nil {
			return err
		}
		if uint64(len(wav)) != file.UncompressedSize64 || !audioSignatureMatches("audio/wav", wav) {
			return errors.New("invalid WAV in stem archive")
		}
		if err = visit(label, wav); err != nil {
			return err
		}
		total += file.UncompressedSize64
		seen[strings.ToLower(label)] = true
	}
	if len(seen) == 0 {
		return errors.New("no WAV tracks in stem archive")
	}
	return nil
}
