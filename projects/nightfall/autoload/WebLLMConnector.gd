extends Node
# WebLLMConnector: bridge to browser WebLLM / nano models for cat "agentic" reasoning
# TODO: implement JSON-RPC or postMessage to web_harness for LLM calls
# Cats will call this for planning mischief or reacting to player.

signal llm_response_ready(response: String)

func query_cat_brain(prompt: String) -> void:
	# Placeholder — later connect to WebLLM in browser export
	print("LLM query (stub): ", prompt)
	llm_response_ready.emit("The cat decides to knock over the vase.")
