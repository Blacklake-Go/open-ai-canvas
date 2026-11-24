package handler

import (
	"fmt"
	"net/http"
	"strings"

	"one/backend/internal/middleware"
)

const feedbackAdminJoin = ` FROM ops_bill.feedback_reports f LEFT JOIN auth_usr.users u ON u.id=f.user_id`

func adminFeedbackList(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, problem := adminADB(d)
	if problem != nil {
		return nil, nil, problem
	}
	query := `SELECT f.id, f.user_id, f.kind, f.title, f.detail, f.github_url, f.status, f.reward_coins, f.created_at,
		u.email AS user_email, u.user_number, u.display_name,
		CASE WHEN jsonb_typeof(f.attachments)='array' THEN jsonb_array_length(f.attachments) ELSE 0 END AS attachment_count` + feedbackAdminJoin
	clauses := []string{"TRUE"}
	args := []any{}
	bind := func(value string) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}
	if kind := r.URL.Query().Get("kind"); kind != "" {
		clauses = append(clauses, "f.kind="+bind(kind))
	}
	if status := r.URL.Query().Get("status"); status != "" {
		clauses = append(clauses, "f.status="+bind(status))
	}
	if q := strings.TrimSpace(r.URL.Query().Get("q")); q != "" {
		q = string([]rune(q)[:min(len([]rune(q)), 250)])
		clauses = append(clauses, "strpos(lower(concat_ws(' ',f.title,f.detail,f.page_url,f.github_url,u.email,u.display_name)),lower("+bind(q)+"))>0")
	}
	rows, meta, err := adminAPaged(r.Context(), pool, r, query+" WHERE "+strings.Join(clauses, " AND "), "f.created_at", "f.id", args...)
	if err != nil {
		return nil, nil, adminAInternal(err, "反馈列表读取失败")
	}
	return map[string]any{"rows": rows}, meta, nil
}

func adminFeedbackDetail(_ http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	pool, problem := adminADB(d)
	if problem != nil {
		return nil, nil, problem
	}
	id := pathParam(r, "id")
	record, exists, err := adminAQueryOne(r.Context(), pool,
		`SELECT f.*, u.email AS email, u.user_number FROM ops_bill.feedback_reports f LEFT JOIN auth_usr.users u ON u.id=f.user_id WHERE f.id=$1`, id)
	if err != nil {
		return nil, nil, adminAInternal(err, "反馈详情读取失败")
	}
	if !exists {
		return nil, nil, adminErr("FEEDBACK_NOT_FOUND", "提交记录不存在", http.StatusNotFound)
	}
	attachments, err := feedbackAttachmentMetadata(id, record["attachments"], true)
	if err != nil {
		return nil, nil, adminAInternal(err, "反馈附件记录读取失败")
	}
	record["attachments"] = attachments
	return map[string]any{"feedback": record}, nil, nil
}

func adminFeedbackAttachment(w http.ResponseWriter, r *http.Request, d *Dependencies, _ *middleware.SessionUser, _ string) (any, map[string]any, *adminError) {
	if problem := writeFeedbackAttachment(w, r, d, ""); problem != nil {
		return nil, nil, adminErr(problem.code, problem.message, problem.status)
	}
	return AdminAlreadyWritten, nil, nil
}
