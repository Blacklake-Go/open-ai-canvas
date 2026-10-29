package music

import (
	"time"

	"yingce/backend/internal/supdance/domain"
)

// MusicGenerationStatus defines the lifecycle status of a music generation task.
type MusicGenerationStatus string

const (
	StatusSubmitted   MusicGenerationStatus = "submitted"
	StatusQueued      MusicGenerationStatus = "queued"
	StatusGenerating  MusicGenerationStatus = "generating"
	StatusTranscoding MusicGenerationStatus = "transcoding"
	StatusCompleted   MusicGenerationStatus = "completed"
	StatusFailed      MusicGenerationStatus = "failed"
	StatusCancelled   MusicGenerationStatus = "cancelled"
)

// NonTerminalStatuses returns all active statuses that represent in-flight tasks.
var NonTerminalStatuses = []MusicGenerationStatus{
	StatusSubmitted,
	StatusQueued,
	StatusGenerating,
	StatusTranscoding,
}

// SupDanceMusicGeneration represents a persistent AI music generation record.
// Strictly mapped to table "supdance_music_generations" adhering to domain.TableNamespacePrefix.
type SupDanceMusicGeneration struct {
	ID                    string                `json:"id" gorm:"primaryKey;size:36"`
	UserID                string                `json:"userId" gorm:"size:36;not null;index:idx_music_gen_user_created,priority:1"`
	TaskID                string                `json:"taskId" gorm:"size:64;not null;uniqueIndex;index:idx_music_gen_task"`
	UpstreamTaskID        string                `json:"upstreamTaskId,omitempty" gorm:"size:120;index"`
	Model                 string                `json:"model" gorm:"size:64;not null;index"`
	Mode                  string                `json:"mode,omitempty" gorm:"size:32;default:'simple'"`
	Prompt                string                `json:"prompt" gorm:"type:text"`
	Title                 string                `json:"title,omitempty" gorm:"size:255"`
	Lyrics                string                `json:"lyrics" gorm:"type:text"`
	Tags                  string                `json:"tags,omitempty" gorm:"size:500"`
	Instrumental          bool                  `json:"instrumental" gorm:"default:false"`
	DurationTargetSeconds int                   `json:"durationTargetSeconds" gorm:"not null;default:0"`
	Status                MusicGenerationStatus `json:"status" gorm:"size:32;not null;index:idx_music_gen_status"`
	Stage                 string                `json:"stage" gorm:"size:64;not null"`
	ResultAudioURL        string                `json:"resultAudioUrl" gorm:"type:text"`
	ResultDurationMs      int64                 `json:"resultDurationMs" gorm:"default:0"`
	Format                string                `json:"format,omitempty" gorm:"size:16;default:'mp3'"`
	StemsJSON             string                `json:"stemsJson,omitempty" gorm:"type:text"`
	ResourceID            string                `json:"resourceId,omitempty" gorm:"size:36;index"`
	BillingOrderID        string                `json:"billingOrderId,omitempty" gorm:"size:64;index"`
	MicrocreditsCost      int64                 `json:"microcreditsCost" gorm:"default:0"`
	ErrorMessage          string                `json:"errorMessage,omitempty" gorm:"type:text"`
	CreatedAt             time.Time             `json:"createdAt" gorm:"not null;index:idx_music_gen_user_created,priority:2"`
	UpdatedAt             time.Time             `json:"updatedAt" gorm:"not null"`
}

// TableName returns the isolated table name adhering to domain.TableNamespacePrefix.
func (SupDanceMusicGeneration) TableName() string {
	return domain.TableNamespacePrefix + "music_generations"
}
