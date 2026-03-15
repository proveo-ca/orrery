# Chess Coach UI Roadmap

## Phase 1: Porting Maia (lc0) to the Browser (WASM)
Currently, the web mode uses Stockfish for AI moves. We want to replace this with Maia (running on lc0.js) to match the Docker backend's human-like play.

### Steps:
- [x] 1. **Serve Assets:** 
   - Place the compiled `lc0.js` and its corresponding `.wasm` file into the `public/` directory.
   - Add the Maia weights files (e.g., `maia-1100.pb.gz`, `maia-1500.pb.gz`, `maia-1900.pb.gz`) to the `public/` directory.
- [x] 2. **Virtual File System (VFS) Integration:**
   - WASM binaries cannot read the host file system directly. Modify the `lc0.js` initialization (or use Emscripten's `--preload-file` / `FS.createPreloadedFile`) to load the Maia weights file into the Emscripten virtual file system. This ensures `lc0` can find the weights when the `WeightsFile` UCI option is set.
- [x] 3. **Create `MaiaEngine.ts`:**
   - Create a new engine wrapper class (similar to `StockfishEngine.ts`).
   - Use `UciDriver` to communicate with the `lc0.js` Web Worker.
   - Implement methods to set the `WeightsFile` UCI option based on the selected difficulty.
   - Implement move generation using `go nodes 1` (since Maia is a policy network).
- [x] 4. **Update `EngineBridge.ts`:**
   - Swap the `player` instance from `StockfishEngine` to the new `MaiaEngine` for the `getAiMove()` function.
   - Keep `StockfishEngine` for the `evaluator` instance (used for hints and hover evaluations).

## Phase 2: Porting NAKST Gemma Commentary to WebLLM (WebGPU)
Currently, the web mode uses `Llama-3.1-8B-Instruct` for commentary. We want to replace this with the fine-tuned `NAKSTStudio/chess-gemma-commentary` model.

### Steps:
- [x] 1. **Convert the Model for MLC/WebLLM:**
   - The raw GGUF/Q8_0 file cannot be used directly in the browser. Use the [MLC LLM Python package](https://llm.mlc.ai/docs/compilation/compile_models.html) to convert the model into the MLC format (WebGPU compatible).
   - Example commands:
     ```bash
     mlc_llm convert_weight --model-type gemma --quantization q4f16_1 /path/to/gemma
     mlc_llm gen_config /path/to/gemma --quantization q4f16_1 --conv-template gemma_instruction
     ```
- [x] 2. **Host the Compiled Model:**
   - Place the resulting compiled weights (a `mlc-chat-config.json` and several `.bin` shards) into the `public/models/gemma-chess/` directory, or host them on a dedicated CDN/HuggingFace repo.
- [x] 3. **Update `LlmClient.ts`:**
   - Modify the WebLLM initialization (`CreateWebWorkerMLCEngine`) to include a custom `AppConfig` that points to the hosted model URL.
   - Change `this.modelId` to match the custom model's ID.
- [x] 4. **Prompt Adjustments in `Orchestrator.ts`:**
   - Ensure the prompt formatting exactly matches what the NAKST Gemma model expects (it likely has a specific instruction template compared to Llama 3.1).
   - Test and refine the system and user prompts for both standard advice and blunder explanations.
