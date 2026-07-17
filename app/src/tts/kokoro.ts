// PLAN.md §9.1 — kokoro-js: lazy-loaded, high-quality offline TTS. Loaded
// only once the user opts in ("Enable quality voice") — the model is
// ~86 MB (Phase 5 perf spike). `@huggingface/transformers` (kokoro-js's engine)
// caches downloaded model files in the browser's Cache API by default
// (`transformers-cache`), so after the first successful load the model works
// fully offline — no extra caching code needed for the model weights
// themselves. Synthesis OUTPUT (per sentence+voice+speed) is cached
// separately in `tts/cache.ts`, since even a cached model is well below
// real-time on typical hardware (Phase 5 spike: RTF 2.5x on a fast desktop CPU,
// ~11-17x under a mid/low Android CPU-throttle proxy).

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

export type ModelLoadProgress = { status: string; progress?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KokoroTTSInstance = any;

let loadingPromise: Promise<KokoroTTSInstance> | null = null;
let loadedModel: KokoroTTSInstance | null = null;

/**
 * Loads (or returns the already-loaded) kokoro-js model. `dtype: 'q8'` is
 * the smallest quantization that showed no synthesis-speed regression vs
 * `q4` in the Phase 5 spike, at a known ~86 MB download. `device: 'wasm'` is the
 * only backend verified to work everywhere — WebGPU could not be benchmarked
 * in the sandboxed spike environment (no `navigator.gpu`) and real-device
 * support is inconsistent, so it is not used here.
 */
export async function loadKokoroModel(
  onProgress?: (p: ModelLoadProgress) => void,
): Promise<KokoroTTSInstance> {
  if (loadedModel) return loadedModel;
  if (!loadingPromise) {
    loadingPromise = import('kokoro-js')
      .then(({ KokoroTTS }) =>
        KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback: onProgress,
        }),
      )
      .then((model) => {
        loadedModel = model;
        return model;
      })
      .catch((err) => {
        loadingPromise = null; // allow retry on next call
        throw err;
      });
  }
  return loadingPromise;
}

export function isKokoroLoaded(): boolean {
  return loadedModel !== null;
}

export interface KokoroSynthesisResult {
  blob: Blob;
}

/** Synthesizes `text` with the given voice+speed. Caller owns the output cache (`tts/cache.ts`). */
export async function synthesizeWithKokoro(
  text: string,
  voiceId: string,
  speed: number,
): Promise<KokoroSynthesisResult> {
  const model = await loadKokoroModel();
  const audio = await model.generate(text, { voice: voiceId, speed });
  return { blob: audio.toBlob() as Blob };
}
