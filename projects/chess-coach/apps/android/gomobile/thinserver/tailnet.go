package thinserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"

	"tailscale.com/tsnet"
)

// startTailnet brings up the embedded Tailscale node (userspace WireGuard +
// netstack — no root, no system tailscaled) and serves the /p2p WSS endpoint
// over the tailnet with a real MagicDNS cert. See _spec/distribution.md §3.3
// (Model B). NOTE: requires `go mod tidy` + the Android NDK to build; the tsnet
// API surface should be re-checked against the resolved tailscale.com version.
func (s *Server) startTailnet() error {
	s.ts = &tsnet.Server{
		Dir:      filepath.Join(s.stateDir, "tsnet"),
		Hostname: s.hostname,
		AuthKey:  s.authKey,
		Logf: func(format string, args ...any) {
			if s.ev != nil {
				s.ev.OnLog(fmt.Sprintf(format, args...))
			}
		},
	}
	if _, err := s.ts.Up(context.Background()); err != nil {
		return err
	}
	s.pushTailnetStatus()

	ln, err := s.ts.ListenTLS("tcp", ":443") // MagicDNS cert via Tailscale HTTPS
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/p2p", s.handlePeerAccept)
	go func() { _ = (&http.Server{Handler: mux}).Serve(ln) }()
	return nil
}

// tailnetStatusJSON reports node state for the Kotlin shell (auth gating, the
// MagicDNS dial string, login URL when interactive auth is required).
func (s *Server) tailnetStatusJSON() string {
	out := map[string]any{"state": "stopped"}
	if s.ts != nil {
		if lc, err := s.ts.LocalClient(); err == nil {
			if st, err := lc.Status(context.Background()); err == nil {
				out["state"] = st.BackendState
				if st.Self != nil {
					out["magicDNSName"] = st.Self.DNSName
					out["tailnetIPs"] = st.TailscaleIPs
				}
				out["needsLogin"] = st.BackendState == "NeedsLogin"
				out["authURL"] = st.AuthURL
			}
		}
	}
	b, _ := json.Marshal(out)
	return string(b)
}

func (s *Server) pushTailnetStatus() {
	if s.ev != nil {
		s.ev.OnTailnetState(s.tailnetStatusJSON())
	}
}
