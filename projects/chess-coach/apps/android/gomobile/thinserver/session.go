package thinserver

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

// Session is the authoritative, churn-surviving record of a P2P game. The move
// log is append-only and turn-alternating, so the state is simply the union of
// both peers' appends; a lost message is recovered by seq-gap replay, not by
// conflict resolution. See _spec/distribution.md §3 + _spec/webrtc-p2p.puml.
type Session struct {
	mu          sync.Mutex
	path        string
	GameID      string `json:"gameId"`
	StartingFen string `json:"startingFen"`
	Moves       []Move `json:"moves"`
	MyColor     string `json:"myColor"`
	PeerOpen    bool   `json:"peerOpen"`
}

func newSession(stateDir string) *Session {
	s := &Session{
		path:        filepath.Join(stateDir, "session.json"),
		StartingFen: startingFen,
		Moves:       []Move{},
		MyColor:     "w",
	}
	s.load()
	return s
}

func (s *Session) load() {
	b, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(b, s) // best-effort; a corrupt file falls back to defaults
}

// persist writes atomically (temp + rename). Caller must hold s.mu.
func (s *Session) persist() {
	b, err := json.Marshal(s)
	if err != nil {
		return
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return
	}
	_ = os.Rename(tmp, s.path)
}

func (s *Session) reset(gameID, myColor string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.GameID = gameID
	s.StartingFen = startingFen
	s.Moves = []Move{}
	s.MyColor = myColor
	s.persist()
}

func (s *Session) lastSeq() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.Moves)
}

// append applies an in-order move (1-based seq == len+1). Returns:
//
//	applied=true  — move accepted and persisted
//	applied=false, gap=false — duplicate/old (ignore)
//	applied=false, gap=true  — seq ahead of our log (request a replay)
func (s *Session) append(m Move) (applied bool, gap bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	expected := len(s.Moves) + 1
	switch {
	case m.Seq == expected:
		s.Moves = append(s.Moves, m)
		s.persist()
		return true, false
	case m.Seq <= len(s.Moves):
		return false, false // already have it
	default:
		return false, true // gap → caller replays from len(s.Moves)
	}
}

// localMove stamps the next seq onto a locally-produced move and appends it.
func (s *Session) localMove(m Move) Move {
	s.mu.Lock()
	defer s.mu.Unlock()
	m.Seq = len(s.Moves) + 1
	s.Moves = append(s.Moves, m)
	s.persist()
	return m
}

func (s *Session) movesFrom(seq int) []Move {
	s.mu.Lock()
	defer s.mu.Unlock()
	if seq < 0 || seq >= len(s.Moves) {
		return nil
	}
	out := make([]Move, len(s.Moves)-seq)
	copy(out, s.Moves[seq:])
	return out
}

func (s *Session) setPeerOpen(open bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.PeerOpen = open
	s.persist()
}

func (s *Session) snapshotJSON() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, _ := json.Marshal(s)
	return string(b)
}
