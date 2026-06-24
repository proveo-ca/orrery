module ca.proveo.chess/thinserver

go 1.22

// Run `go mod tidy` to populate the checksum db. Heavy deps (tailscale.com pulls
// in WireGuard + gVisor netstack) — they only need to resolve at build time.
require (
	github.com/coder/websocket v1.8.12
	tailscale.com v1.80.0
)
