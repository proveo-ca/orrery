// Package thinserver is the embedded Android server: it serves the web-full UI
// build over loopback (secure-context origin + COOP/COEP for the WebView) and
// owns the P2P tailnet link for two-player play. It runs NO chess/LLM logic —
// the coach is the in-WebView WASM engine. See _spec/distribution.md.
//
// Built into an Android AAR via `gomobile bind`. The exported surface below is
// the Kotlin↔Go boundary; structured payloads cross as JSON strings and
// outbound events use the Kotlin-implemented Events interface.
//
// SCAFFOLDING: requires `go mod tidy` (pulls tailscale.com + coder/websocket)
// and the Android NDK to build; the tsnet API should be re-checked against the
// resolved version.
package thinserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net"
	"net/http"
	"net/url"
	"sync"

	"github.com/coder/websocket"
	"tailscale.com/tsnet"
)

// Events is implemented in Kotlin and passed to NewServer (gomobile reverse binding).
type Events interface {
	OnPeerMove(json string)     // {san,uci,fenAfter,seq} from the peer
	OnPeerState(state string)   // open | closed | resigned
	OnTailnetState(json string) // {state, magicDNSName, tailnetIPs, needsLogin, authURL}
	OnLog(line string)
}

type Server struct {
	stateDir string
	hostname string
	authKey  string
	ev       Events
	session  *Session

	ts       *tsnet.Server
	httpSrv  *http.Server
	localURL string

	mu   sync.Mutex
	peer *peerConn
}

func NewServer(stateDir string, ev Events) *Server {
	return &Server{
		stateDir: stateDir,
		hostname: "chesscoach-" + shortID(stateDir),
		ev:       ev,
		session:  newSession(stateDir),
	}
}

// Start brings up the loopback static server for the WebView. The tailnet is
// started lazily (HostGame/JoinGame/LoginWithAuthKey) so the UI renders before auth.
func (s *Server) Start() error {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	s.localURL = fmt.Sprintf("http://%s/chess/", ln.Addr().String())
	s.httpSrv = &http.Server{Handler: staticHandler()}
	go func() { _ = s.httpSrv.Serve(ln) }()
	return nil
}

func (s *Server) Stop() error {
	if s.httpSrv != nil {
		_ = s.httpSrv.Close()
	}
	s.mu.Lock()
	if s.peer != nil {
		_ = s.peer.c.Close(websocket.StatusNormalClosure, "stop")
		s.peer = nil
	}
	s.mu.Unlock()
	if s.ts != nil {
		_ = s.ts.Close()
	}
	return nil
}

func (s *Server) LocalURL() string      { return s.localURL }
func (s *Server) TailnetStatus() string { return s.tailnetStatusJSON() }
func (s *Server) SessionSnapshot() string { return s.session.snapshotJSON() }

func (s *Server) LoginWithAuthKey(key string) error {
	s.authKey = key
	return s.startTailnet()
}

// HostGame ensures the tailnet is up and returns the dial string the peer joins with.
func (s *Server) HostGame() string {
	if s.ts == nil {
		_ = s.startTailnet()
	}
	s.session.reset(newGameID(), "w") // host plays White
	return fmt.Sprintf("wss://%s/p2p?room=%s", s.magicDNSName(), s.session.GameID)
}

// JoinGame dials the host's /p2p endpoint over the tailnet (join side plays Black).
func (s *Server) JoinGame(dial string) error {
	if s.ts == nil {
		if err := s.startTailnet(); err != nil {
			return err
		}
	}
	ctx := context.Background()
	hc := &http.Client{Transport: &http.Transport{DialContext: s.ts.Dial}}
	c, _, err := websocket.Dial(ctx, dial, &websocket.DialOptions{HTTPClient: hc})
	if err != nil {
		return err
	}
	s.session.reset(roomFromDial(dial), "b")
	p := &peerConn{c: c, srv: s}
	s.attachPeer(p, "b")
	go p.readLoop(ctx)
	return nil
}

func (s *Server) SendMove(jsonStr string) error {
	var m Move
	if err := json.Unmarshal([]byte(jsonStr), &m); err != nil {
		return err
	}
	stamped := s.session.localMove(m)
	s.mu.Lock()
	p := s.peer
	s.mu.Unlock()
	if p == nil {
		return fmt.Errorf("no peer connected")
	}
	return p.send(Envelope{T: "move", Move: &stamped})
}

func (s *Server) Resign() error {
	s.mu.Lock()
	p := s.peer
	s.mu.Unlock()
	if p == nil {
		return nil
	}
	return p.send(Envelope{T: "resign"})
}

// --- internal peer lifecycle ---

func (s *Server) attachPeer(p *peerConn, myColor string) {
	s.mu.Lock()
	s.peer = p
	s.mu.Unlock()
	s.session.setPeerOpen(true)
	if s.ev != nil {
		s.ev.OnPeerState("open")
	}
	_ = p.send(Envelope{
		T:           "hello",
		GameID:      s.session.GameID,
		StartingFen: s.session.StartingFen,
		MyColor:     myColor,
		LastSeq:     s.session.lastSeq(),
	})
}

func (s *Server) onPeerClosed() {
	s.mu.Lock()
	s.peer = nil
	s.mu.Unlock()
	s.session.setPeerOpen(false)
	if s.ev != nil {
		s.ev.OnPeerState("closed")
	}
}

func (s *Server) magicDNSName() string {
	if s.ts != nil {
		if lc, err := s.ts.LocalClient(); err == nil {
			if st, err := lc.Status(context.Background()); err == nil && st.Self != nil {
				return st.Self.DNSName
			}
		}
	}
	return s.hostname
}

// --- helpers ---

func shortID(seed string) string {
	h := fnv.New32a()
	_, _ = h.Write([]byte(seed))
	return fmt.Sprintf("%x", h.Sum32())
}

func newGameID() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func roomFromDial(dial string) string {
	if u, err := url.Parse(dial); err == nil {
		if r := u.Query().Get("room"); r != "" {
			return r
		}
	}
	return newGameID()
}
