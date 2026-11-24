package runtimelog

import (
	"strings"
	"sync"
	"time"
)

const Limit = 100

type stream struct {
	lines [Limit]string
	next  int
	count int
}

// Buffer retains process-local operational messages deliberately selected for
// the admin console. Callers pass event constants and safe metrics only.
type Buffer struct {
	mu  sync.Mutex
	out stream
	err stream
}

func (b *Buffer) Info(message string) {
	b.append(false, message)
}

func (b *Buffer) Error(message string) {
	b.append(true, message)
}

func (b *Buffer) append(failure bool, message string) {
	if b == nil {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	tail := &b.out
	if failure {
		tail = &b.err
	}
	tail.lines[tail.next] = time.Now().UTC().Format(time.RFC3339) + " " + message
	tail.next = (tail.next + 1) % Limit
	if tail.count < Limit {
		tail.count++
	}
}

func (b *Buffer) Tail(failure bool) string {
	if b == nil {
		return ""
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	tail := &b.out
	if failure {
		tail = &b.err
	}
	lines := make([]string, tail.count)
	first := (tail.next - tail.count + Limit) % Limit
	for i := range lines {
		lines[i] = tail.lines[(first+i)%Limit]
	}
	return strings.Join(lines, "\n")
}
