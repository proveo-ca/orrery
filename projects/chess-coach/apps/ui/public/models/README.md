## About this Model
_Runs in https://webllm.mlc.ai/_

This model has been compiled to `.wasm` by using https://huggingface.co/NAKSTStudio/chess-gemma-commentary and `mlc-llm`.
> https://llm.mlc.ai/docs/compilation/compile_models.html

```bash
 mlc_llm compile <path-to-your-clone>/dist/chess-gemma-commentary-q0f32-MLC/mlc-chat-config.json --device webgpu -o <path-to-your-clone>/dist/chess-gemma-commentary-q0f32-MLC/gemma-3-270m-q0f32-webgpu.wasm
```

It requires the following:
```bash
mlc_llm gen_config <path-to-your-clone> --quantization q0f32 --conv-template gemma_instruction --context-window-size 2048 --prefill-chunk-size 2048 --max-batch-size 1 -o <path-to-your-clone>/dist/chess-gemma-commentary-q0f32-MLC
```

```bash
 mlc_llm convert_weight <path-to-your-clone> --quantization q0f32  -o <path-to-your-clone>/dist/chess-gemma-commentary-q0f32-MLC 
```
