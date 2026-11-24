package runtimelog

import (
	"fmt"
	"strings"
	"testing"
)

func TestTailKeepsNewestEntriesAndSeparatesErrors(t *testing.T) {
	var logs Buffer
	for i := range Limit + 3 {
		logs.Info(fmt.Sprintf("event %03d", i))
	}
	logs.Error("queue stopped")

	current := strings.Split(logs.Tail(false), "\n")
	if len(current) != Limit || !strings.HasSuffix(current[0], "event 003") ||
		!strings.HasSuffix(current[Limit-1], "event 102") {
		t.Fatal("unexpected output order or retention")
	}
	if failures := logs.Tail(true); !strings.HasSuffix(failures, "queue stopped") ||
		strings.Contains(failures, "\n") {
		t.Fatal("errors must have their own stream")
	}
}
