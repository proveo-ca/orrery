package thinserver

// Move is the P2P payload, matching the browser's chess.js move
// (result.san / result.lan / result.after). See _spec/distribution.md §3.4.
type Move struct {
	San      string `json:"san"`
	Uci      string `json:"uci"`
	FenAfter string `json:"fenAfter"`
	Seq      int    `json:"seq"`
}

// Envelope is the WSS wire message between the two players' embedded servers.
// `t` is the discriminator: hello | move | replay-from | replay | resign | ping | chat.
type Envelope struct {
	T           string `json:"t"`
	GameID      string `json:"gameId,omitempty"`
	StartingFen string `json:"startingFen,omitempty"`
	MyColor     string `json:"myColor,omitempty"` // hello
	LastSeq     int    `json:"lastSeq,omitempty"` // hello
	FromSeq     int    `json:"fromSeq,omitempty"` // replay-from
	Move        *Move  `json:"move,omitempty"`    // move
	Moves       []Move `json:"moves,omitempty"`   // replay
	Text        string `json:"text,omitempty"`    // chat
}
