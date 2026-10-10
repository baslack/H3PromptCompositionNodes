# H3PromptCompositionNodes

ComfyUI nodes that compose MiniMax H3 prompts in MiniMax's official formats
and encode them for ordinary custom sampling. References are named
definitions you wire in with normal Load Image / Load Video nodes; each clip's
prompt node numbers them, fills in the generated sections, and hands the
result to ComfyUI's own MiniMax H3 nodes.

The prompt formats follow MiniMax's guides in
[MiniMaxAI/MiniMax-H3](https://huggingface.co/MiniMaxAI/MiniMax-H3):
`docs/VIDEO_PROMPT_WRITING_GUIDE_ref_en.md` (Ref2VA) and
`docs/VIDEO_PROMPT_WRITING_GUIDE_base_en.md` (T2VA / I2VA / FL2VA / L2VA).

## Nodes

| Node | Does |
|---|---|
| **MiniMax H3 Definition** | One named reference. `kind` is Subject (any number of images and videos), Picture, Video (optionally with its soundtrack) or Audio, with the guide's role and retention choices. |
| **MiniMax H3 Definitions** | Bundles definitions once for every clip. Names must be unique. |
| **MiniMax H3 Ref2VA Prompt** | One clip's prompt in MiniMax's six-section Ref2VA format. |
| **MiniMax H3 Keyframe Prompt** | T2VA / I2VA / FL2VA / L2VA prompt; the connected first/last frames pick the task. |
| **MiniMax H3 Encode** | Prompt + references → `positive`, `latent` and `composed_prompt`, the exact text the model gets. Width and height snap to multiples of 32 (`size_rounding`, up by default). |

Node IDs use the `MiniMaxH3` prefix (`MiniMaxH3Definition`, …).

## Writing prompts

- Refer to definitions by name: `<Subject fred>`, `<Picture opening>`,
  `<Video dolly>`, `<Audio fredvoice>`, and to a Video definition's soundtrack
  as `<Audio dolly>`.
- Inside a definition, `<Picture 1>` / `<Video 1>` mean that node's own first
  attached image or video.
- Name speakers: `(S fred)`, or `(S fred, S mara)` when they speak together.
- Write `detailed_description` in the guide's form: a style sentence, then
  `[Shot 1] …`, `[Shot 2] At 00:03.000, …`.

Each clip numbers only what its text mentions, in the order the model reads
it, and speakers in the order they first speak in that clip. An unknown name,
a name used with the wrong kind, or a speaker who never speaks in the clip
stops the run with an error naming it. The `retention_analysis` lines,
including which shots each subject appears in, and the summary's task tags are
filled in for you; pick `task_types` to set the tags yourself.

## Requirements

- ComfyUI with its built-in MiniMax H3 nodes (`comfy_extras/nodes_minimax_h3.py`)
  and the MiniMax H3 models.
- **For chaining clips:** the MiniMax H3 Extender fork at
  [baslack/ComfyUI_MiniMax_H3_Extender, branch `local-work`](https://github.com/baslack/ComfyUI_MiniMax_H3_Extender/tree/local-work).
  Its Motion Context RAM, Disk Join and Final Decode nodes carry clips into
  each other and assemble the video. The fork adds what these nodes need:
  an optional `context_latent` for the first clip, shrinking a refined
  context, per-clip name and colour on Disk Join, `chain_mode` for hard cuts,
  and seamless joins in Final Decode (`crossfade_frames`).
- The sample workflows also use DaSiWa Nodes' resolution calculator and
  rgthree's Power Lora Loader; any resolution node and LoRA loader will do.
  Their optional refine pass uses the split/combine AV latent nodes and
  latent upscaler from
  [baslack/Comfyui_Minimax_h3_latent_Upscaler-Plus, branch `local-work`](https://github.com/baslack/Comfyui_Minimax_h3_latent_Upscaler-Plus/tree/local-work).

## Sample workflows

- `Workflow/MiniMax_H3_Graph_Ref2VA.json`: three Ref2VA clips with two
  subjects and dialogue between named speakers, chained with motion context.
  A refine pass is included, bypassed.
- `Workflow/MiniMax_H3_Graph_Keyframe.json`: two keyframe clips on the FL2VA
  model, starting from a first frame and continuing through motion context.
- `Workflow/MiniMax_H3_Graph_Continue_Video.json`: the Ref2VA sample started
  from an existing video. Pick the video in Load Video; the fork's
  **MiniMax H3 Continue Video** makes it Clip 0, and Final Decode crossfades
  it into the first clip.

Each clip is a subgraph with its prompt fields, seed, length, validated
toggle, name and colour promoted, so the collapsed node reads like a clip
card. Duplicate it to add a clip; a pasted copy is independent.

## Building a clip

- Encode → **Motion Context RAM** (the previous clip's `cached_samples` as
  `context_latent`; leave it unconnected for clip 1) → `BasicGuider` →
  `SamplerCustomAdvanced` → **Disk Join**. Use `BasicGuider`; H3 does badly
  with CFG guidance.
- **Disk Join settings:** `clip_name` names the clip's file in individual clip
  exports. `saturation`, `contrast` and `brightness` set its colour in Final
  Decode.
- **Refine:** refine every clip at the same scale, or none.
  1. Split the AV latent and upscale the video only.
  2. Recombine it for a second Motion Context RAM (with the encoder's
     `positive`) and sampler.
  3. Put the first-pass audio back on the refined video.

  A refined previous clip is shrunk automatically for the base pass.
- **Keyframe clips (I2VA / FL2VA)** use the FL2VA model and the same chain as
  Ref2VA clips. The first clip starts from a first frame; the next continues
  the shot through Motion Context RAM, so motion and sound carry across the
  join. Give a clip a last frame only when it must end on a specific picture.
- **Real cuts between shots:** set `chain_mode` to `hard_cut` on the first
  Disk Join. A clip that starts from the previous clip's last frame (via
  **MiniMax H3 Tail From Latent**) should turn on its Join's
  `first_frame_from_previous`, so that frame isn't shown twice.

Continuing an existing video is not available yet.

## Tests

Contract tests run locally against a ComfyUI checkout with ComfyUI's own
Python; `pytest` is the only extra package.

```powershell
cd <this repo>
$env:COMFYUI_PATH = "<ComfyUI checkout>"
$env:PYTHONPATH   = "$env:COMFYUI_PATH;$PWD"
$env:CUDA_VISIBLE_DEVICES = "-1"
<ComfyUI python> -m pytest tests/contract
```

## License

Apache-2.0.
