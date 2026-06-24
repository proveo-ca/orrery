package thinserver

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/coder/websocket"
)

// peerConn wraps the single P2P websocket to the other player's embedded server.
type peerConn struct {
	c   *websocket.Conn
	srv *Server
}

func (p *peerConn) send(env Envelope) error {
	b, err := json.Marshal(env)
	if err != nil {
		return err
	}
	return p.c.Write(context.Background(), websocket.MessageText, b)
}

// readLoop dispatches inbound envelopes until the socket closes.
func (p *peerConn) readLoop(ctx context.Context) {
	defer p.srv.onPeerClosed()
	for {
		_, data, err := p.c.Read(ctx)
		if err != nil {
			return
		}
		var env Envelope
		if json.Unmarshal(data, &env) != nil {
			continue
		}
		p.srv.onEnvelope(p, env)
	}
}

// handlePeerAccept is the /p2p handler on the tailnet listener (host side).
func (s *Server) handlePeerAccept(w http.ResponseWriter, r *http.Request) {
	c, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	p := &peerConn{c: c, srv: s}
	s.attachPeer(p, "w") // host plays White
	go p.readLoop(r.Context())
}

// onEnvelope is the shared inbound-message handler (host + join).
func (s *Server) onEnvelope(p *peerConn, env Envelope) {
	switch env.T {
	case "hello":
		// Reconcile: if the peer is ahead of us, ask for the tail.
		if env.LastSeq > s.session.lastSeq() {
			_ = p.send(Envelope{T: "replay-from", FromSeq: s.session.lastSeq()})
		}
	case "move":
		if env.Move == nil {
			return
		}
		applied, gap := s.session.append(*env.Move)
		if applied {
			s.emitPeerMove(*env.Move)
		} else if gap {
			_ = p.send(Envelope{T: "replay-from", FromSeq: s.session.lastSeq()})
		}
	case "replay-from":
		_ = p.send(Envelope{T: "replay", Moves: s.session.movesFrom(env.FromSeq)})
	case "replay":
		for _, m := range env.Moves {
			if applied, _ := s.session.append(m); applied {
				s.emitPeerMove(m)
			}
		}
	case "resign":
		if s.ev != nil {
			s.ev.OnPeerState("resigned")
		}
	case "ping":
		// keepalive — ignore
	case "chat":
		// reserved
	}
}

func (s *Server) emitPeerMove(m Move) {
	if s.ev == nil {
		return
	}
	b, _ := json.Marshal(m)
	s.ev.OnPeerMove(string(b))
}
