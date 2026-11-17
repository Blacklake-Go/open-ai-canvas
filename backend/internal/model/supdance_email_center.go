package model

import "time"

func (SupDanceEmailTemplate) TableName() string   { return "supdance_email_templates" }
func (SupDanceEmailRevision) TableName() string   { return "supdance_email_revisions" }
func (SupDanceEmailReceipt) TableName() string    { return "supdance_email_receipts" }
func (SupDanceEmailContact) TableName() string    { return "supdance_email_contacts" }
func (SupDanceEmailBrandAsset) TableName() string { return "supdance_email_brand_assets" }
func (SupDanceEmailCampaign) TableName() string   { return "supdance_email_campaigns" }
func (SupDanceEmailJob) TableName() string        { return "supdance_email_jobs" }

// Templates use immutable revisions and an optimistic lock on their pointers.
type SupDanceEmailTemplate struct {
	Key         string    `json:"key" gorm:"primaryKey;size:80"`
	Locale      string    `json:"locale" gorm:"primaryKey;size:16"`
	DraftID     string    `json:"draftId" gorm:"size:36"`
	PublishedID string    `json:"publishedId" gorm:"size:36"`
	Revision    int64     `json:"revision"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
type SupDanceEmailRevision struct {
	ID          string    `json:"id" gorm:"primaryKey;size:36"`
	Key         string    `json:"key" gorm:"size:80;index"`
	Locale      string    `json:"locale" gorm:"size:16;index"`
	ContentJSON string    `json:"contentJson" gorm:"type:text"`
	Kind        string    `json:"kind" gorm:"size:20"`
	ActorID     string    `json:"actorId" gorm:"size:36"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Receipt deliberately has no body, verification code or recipient address.
// A claimed intent is never automatically replayed after a process crash.
type SupDanceEmailReceipt struct {
	ID           string    `json:"id" gorm:"primaryKey;size:64"`
	LogID        string    `json:"logId" gorm:"size:36;index"`
	Channel      string    `json:"channel" gorm:"size:16"`
	Event        string    `json:"event" gorm:"size:80;index"`
	TemplateID   string    `json:"templateId" gorm:"size:80"`
	TemplateKey  string    `json:"templateKey" gorm:"size:80"`
	BrandVersion string    `json:"brandVersion" gorm:"size:160"`
	MessageID    string    `json:"messageId" gorm:"size:160"`
	Status       string    `json:"status" gorm:"size:24;index"`
	Stage        string    `json:"stage" gorm:"size:32"`
	DurationMS   int64     `json:"durationMs"`
	CreatedAt    time.Time `json:"createdAt" gorm:"index"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type SupDanceEmailContact struct {
	Email          string     `json:"email" gorm:"primaryKey;size:160"`
	Marketing      bool       `json:"marketing"`
	Source         string     `json:"source" gorm:"size:160"`
	Scope          string     `json:"scope" gorm:"size:32"`
	ConsentedAt    *time.Time `json:"consentedAt"`
	UnsubscribedAt *time.Time `json:"unsubscribedAt"`
	Suppression    string     `json:"suppression" gorm:"size:32"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

// Logo bytes are snapshotted by content hash so appearance changes do not break old mail.
type SupDanceEmailBrandAsset struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	ContentType string    `json:"contentType" gorm:"size:80"`
	Data        []byte    `json:"-"`
	CreatedAt   time.Time `json:"createdAt"`
}

type SupDanceEmailCampaign struct {
	ID            string    `json:"id" gorm:"primaryKey;size:36"`
	Name          string    `json:"name" gorm:"size:160"`
	TemplateKey   string    `json:"templateKey" gorm:"size:80"`
	RevisionID    string    `json:"revisionId" gorm:"size:36"`
	VariablesJSON string    `json:"variablesJson" gorm:"type:text"`
	SourceFilter  string    `json:"sourceFilter" gorm:"size:160"`
	Status        string    `json:"status" gorm:"size:24;index"`
	ScheduleAt    time.Time `json:"scheduleAt"`
	CreatedBy     string    `json:"createdBy" gorm:"size:36"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}
type SupDanceEmailJob struct {
	ID            string    `json:"id" gorm:"primaryKey;size:64"`
	CampaignID    string    `json:"campaignId" gorm:"size:36;index"`
	Recipient     string    `json:"-" gorm:"size:160"`
	Status        string    `json:"status" gorm:"size:24;index"`
	Attempts      int       `json:"attempts"`
	NextAttemptAt time.Time `json:"nextAttemptAt" gorm:"index"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}
