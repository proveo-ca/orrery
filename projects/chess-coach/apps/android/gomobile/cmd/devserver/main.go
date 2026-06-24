// devserver runs the thin server's loopback static host on a desktop (no tsnet,
// no Android) so you can validate the embedded web build, COOP/COEP, cross-origin
// isolation, SAB and WebGPU in a normal browser:
//
//	go run ./cmd/devserver   # then open the printed http://127.0.0.1:PORT/chess/
package main

import (
	"fmt"
	"os"

	"ca.proveo.chess/thinserver"
)

func main() {
	dir, err := os.MkdirTemp("", "chesscoach-dev")
	if err != nil {
		panic(err)
	}
	s := thinserver.NewServer(dir, nil)
	if err := s.Start(); err != nil {
		panic(err)
	}
	fmt.Println("Dev server (static only, no tailnet):", s.LocalURL())
	fmt.Println("Open it in Chrome; check `crossOriginIsolated === true` in the console.")
	select {} // block forever
}
