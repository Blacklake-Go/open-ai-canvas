package app

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"yingce/backend/internal/canvas"
	"yingce/backend/internal/model"
)

var supdanceOpenAIID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

type SupdanceOpenAIProject struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
}

type SupdanceOpenAICanvas struct {
	ID        string `json:"id"`
	ProjectID string `json:"projectId"`
	Title     string `json:"title"`
}

type SupdanceOpenAINode struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Label string `json:"label"`
}

type SupdanceOpenAICanvasContext struct {
	ID        string               `json:"id"`
	ProjectID string               `json:"projectId"`
	Revision  string               `json:"revision"`
	Nodes     []SupdanceOpenAINode `json:"nodes"`
}

type SupdanceOpenAIShot struct {
	Number          int     `json:"number"`
	Scene           string  `json:"scene"`
	Framing         string  `json:"framing"`
	Camera          string  `json:"camera"`
	Movement        string  `json:"movement"`
	DurationSeconds float64 `json:"durationSeconds"`
	Action          string  `json:"action"`
	Setting         string  `json:"setting"`
	Dialogue        string  `json:"dialogue"`
	Sound           string  `json:"sound"`
	Lighting        string  `json:"lighting"`
	ImagePrompt     string  `json:"imagePrompt"`
	VideoPrompt     string  `json:"videoPrompt"`
}

type SupdanceOpenAIAction struct {
	Kind      string               `json:"kind"`
	ProjectID string               `json:"projectId,omitempty"`
	CanvasID  string               `json:"canvasId,omitempty"`
	Revision  string               `json:"revision,omitempty"`
	Shots     []SupdanceOpenAIShot `json:"shots,omitempty"`
}

type SupdanceOpenAIQuote struct {
	ID        string `json:"id"`
	Credits   int    `json:"credits"`
	ExpiresAt int64  `json:"expiresAt"`
}

type SupdanceOpenAICanvasReceipt struct {
	Kind     string   `json:"kind"`
	CanvasID string   `json:"canvasId"`
	Revision string   `json:"revision"`
	NodeIDs  []string `json:"nodeIds"`
}

func (s *Service) SupdanceOpenAIUser(userID string) error {
	if !supdanceOpenAIID.MatchString(userID) {
		return NewAppError(http.StatusForbidden, "Supdance account unavailable")
	}
	user, err := s.repo.User(userID)
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && user.Status != model.UserStatusActive) {
		return NewAppError(http.StatusForbidden, "Supdance account unavailable")
	}
	return err
}

func supdanceOpenAIProject(item model.Project) SupdanceOpenAIProject {
	return SupdanceOpenAIProject{ID: item.ID, Title: truncateRunes(item.Name, 120), Summary: truncateRunes(item.Description, 1000)}
}

func (s *Service) SupdanceOpenAIProjects(userID string) ([]SupdanceOpenAIProject, error) {
	projects, _, err := s.repo.ProjectsPage(userID, 1, 100)
	result := make([]SupdanceOpenAIProject, 0, len(projects))
	for _, project := range projects {
		result = append(result, supdanceOpenAIProject(project))
	}
	return result, err
}

func (s *Service) SupdanceOpenAIGetProject(userID, projectID string) (SupdanceOpenAIProject, error) {
	project, err := s.repo.ProjectForUser(userID, projectID)
	if err != nil {
		return SupdanceOpenAIProject{}, supdanceOpenAINotFound(err)
	}
	return supdanceOpenAIProject(*project), nil
}

func (s *Service) SupdanceOpenAICanvases(userID, projectID string) ([]SupdanceOpenAICanvas, error) {
	page, err := s.ProjectCanvasesPage(userID, projectID, 1, 100)
	result := make([]SupdanceOpenAICanvas, 0, len(page.Canvases))
	for _, item := range page.Canvases {
		result = append(result, SupdanceOpenAICanvas{ID: item.ID, ProjectID: projectID, Title: truncateRunes(item.Title, 120)})
	}
	return result, supdanceOpenAINotFound(err)
}

type supdanceOpenAICanvasDoc struct {
	Nodes []struct {
		ID       string `json:"id"`
		Type     string `json:"type"`
		Title    string `json:"title"`
		Position struct {
			Y float64 `json:"y"`
		} `json:"position"`
	} `json:"nodes"`
}

func (s *Service) supdanceOpenAICanvasForUser(userID, projectID, canvasID string) (*model.CanvasProject, error) {
	if _, err := s.repo.ProjectForUser(userID, projectID); err != nil {
		return nil, supdanceOpenAINotFound(err)
	}
	item, err := s.repo.CanvasProjectForUser(userID, canvasID)
	if err != nil {
		return nil, supdanceOpenAINotFound(err)
	}
	if item.ProjectID != projectID {
		return nil, supdanceOpenAINotFound(gorm.ErrRecordNotFound)
	}
	return item, nil
}

func supdanceOpenAINotFound(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return NewAppError(http.StatusNotFound, "Supdance project or canvas unavailable")
	}
	return err
}

func (s *Service) SupdanceOpenAIGetCanvas(userID, projectID, canvasID string) (SupdanceOpenAICanvasContext, error) {
	item, err := s.supdanceOpenAICanvasForUser(userID, projectID, canvasID)
	if err != nil {
		return SupdanceOpenAICanvasContext{}, err
	}
	var document supdanceOpenAICanvasDoc
	if err := json.Unmarshal([]byte(item.PayloadJSON), &document); err != nil {
		return SupdanceOpenAICanvasContext{}, err
	}
	nodes := make([]SupdanceOpenAINode, 0, min(100, len(document.Nodes)))
	for _, node := range document.Nodes {
		if !supdanceOpenAIID.MatchString(node.ID) || !supdanceOpenAIID.MatchString(node.Type) {
			continue
		}
		nodes = append(nodes, SupdanceOpenAINode{ID: node.ID, Type: node.Type, Label: truncateRunes(defaultString(node.Title, node.Type), 120)})
		if len(nodes) == 100 {
			break
		}
	}
	return SupdanceOpenAICanvasContext{ID: item.ID, ProjectID: item.ProjectID,
		Revision: strconv.FormatInt(item.Revision, 10), Nodes: nodes}, nil
}

func (action SupdanceOpenAIAction) revision() (int64, error) {
	revision, err := strconv.ParseInt(action.Revision, 10, 64)
	if action.Kind != "canvas" || !supdanceOpenAIID.MatchString(action.ProjectID) || !supdanceOpenAIID.MatchString(action.CanvasID) ||
		err != nil || revision < 1 || len(action.Shots) < 1 || len(action.Shots) > 24 {
		return 0, BadAuthRequest("Invalid Supdance storyboard change")
	}
	seen := make(map[int]bool, len(action.Shots))
	for _, shot := range action.Shots {
		if shot.Number < 1 || shot.Number > 120 || seen[shot.Number] || shot.DurationSeconds <= 0 || shot.DurationSeconds > 120 ||
			utf8.RuneCountInString(shot.Dialogue) > 2000 {
			return 0, BadAuthRequest("Invalid Supdance shot")
		}
		seen[shot.Number] = true
		for _, value := range []string{shot.Scene, shot.Framing, shot.Camera, shot.Movement, shot.Action, shot.Setting, shot.Sound, shot.Lighting, shot.ImagePrompt, shot.VideoPrompt} {
			if strings.TrimSpace(value) == "" || utf8.RuneCountInString(value) > 2000 {
				return 0, BadAuthRequest("Invalid Supdance shot detail")
			}
		}
	}
	return revision, nil
}

func supdanceOpenAISign(secret []byte, userID string, action SupdanceOpenAIAction, header []byte) []byte {
	payload, _ := json.Marshal(action)
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte("supdance-openai-canvas-v1\x00" + userID + "\x00"))
	mac.Write(header)
	mac.Write(payload)
	return mac.Sum(nil)
}

func (s *Service) SupdanceOpenAIPreview(userID string, secret []byte, action SupdanceOpenAIAction) (SupdanceOpenAIQuote, error) {
	revision, err := action.revision()
	if err != nil {
		return SupdanceOpenAIQuote{}, err
	}
	if _, err := s.activeProjectForUser(userID, action.ProjectID); err != nil {
		return SupdanceOpenAIQuote{}, supdanceOpenAINotFound(err)
	}
	item, err := s.supdanceOpenAICanvasForUser(userID, action.ProjectID, action.CanvasID)
	if err != nil {
		return SupdanceOpenAIQuote{}, err
	}
	if item.Revision != revision {
		return SupdanceOpenAIQuote{}, NewAppError(http.StatusConflict, "Supdance canvas revision changed")
	}
	var document supdanceOpenAICanvasDoc
	if err := json.Unmarshal([]byte(item.PayloadJSON), &document); err != nil {
		return SupdanceOpenAIQuote{}, err
	}
	y := int64(160)
	for _, node := range document.Nodes {
		if node.Position.Y > 0 && node.Position.Y < 10_000_000 {
			y = max(y, int64(node.Position.Y)+640)
		}
	}
	expires := time.Now().Add(10 * time.Minute).UnixMilli()
	header := binary.BigEndian.AppendUint64(nil, uint64(expires))
	header = binary.BigEndian.AppendUint64(header, uint64(y))
	token := append(header, supdanceOpenAISign(secret, userID, action, header)...)
	return SupdanceOpenAIQuote{ID: base64.RawURLEncoding.EncodeToString(token), ExpiresAt: expires}, nil
}

func (s *Service) SupdanceOpenAICommit(userID string, secret []byte, key, quote string, action SupdanceOpenAIAction) (SupdanceOpenAICanvasReceipt, error) {
	var result SupdanceOpenAICanvasReceipt
	revision, err := action.revision()
	if err != nil || !supdanceOpenAIID.MatchString(key) {
		return result, BadAuthRequest("Invalid Supdance storyboard change")
	}
	token, err := base64.RawURLEncoding.DecodeString(quote)
	if err != nil || len(token) != 16+sha256.Size || !hmac.Equal(token[16:], supdanceOpenAISign(secret, userID, action, token[:16])) {
		return result, NewAppError(http.StatusConflict, "Supdance preview changed")
	}
	if _, err := s.activeProjectForUser(userID, action.ProjectID); err != nil {
		return result, supdanceOpenAINotFound(err)
	}
	if _, err := s.supdanceOpenAICanvasForUser(userID, action.ProjectID, action.CanvasID); err != nil {
		return result, err
	}
	y := int64(binary.BigEndian.Uint64(token[8:16]))
	expires := time.UnixMilli(int64(binary.BigEndian.Uint64(token[:8])))
	req := canvas.CanvasOperationsRequest{
		MutationID: "supdance-openai-" + key, BaseRevision: &revision,
		StrictWrite: &canvas.StrictCanvasWrite{ProjectID: action.ProjectID, ExpiresAt: expires},
	}
	result = SupdanceOpenAICanvasReceipt{Kind: "canvas", CanvasID: action.CanvasID, NodeIDs: make([]string, 0, len(action.Shots))}
	for i, shot := range action.Shots {
		digest := sha256.Sum256([]byte(fmt.Sprintf("supdance-openai\x00%s\x00%s\x00%d", userID, key, i)))
		id := fmt.Sprintf("supdance-%x", digest[:16])
		body, _ := json.MarshalIndent(shot, "", "  ")
		node, err := json.Marshal(map[string]any{
			"id": id, "type": "text", "title": fmt.Sprintf("Shot %02d · %s", shot.Number, truncateRunes(shot.Scene, 80)),
			"position": map[string]int64{"x": int64(160 + (i%4)*420), "y": y + int64(i/4)*480},
			"metadata": map[string]any{"content": string(body), "status": "success"},
		})
		if err != nil {
			return SupdanceOpenAICanvasReceipt{}, err
		}
		req.Operations = append(req.Operations, canvas.CanvasOperation{Type: "create_node", Node: node})
		result.NodeIDs = append(result.NodeIDs, id)
	}
	summary, err := s.ApplyUserCanvasOperations(userID, action.CanvasID, req)
	if err != nil {
		return SupdanceOpenAICanvasReceipt{}, err
	}
	result.Revision = strconv.FormatInt(summary.Revision, 10)
	return result, nil
}
