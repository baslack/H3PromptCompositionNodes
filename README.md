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
| **MiniMax H3 Seconds to Frames** | A clip length in seconds → the frame count for Encode's `length` (24 fps, snapped up to the model's 17k+5 grid), plus the actual seconds. 5 s → 124 frames (5.17 s). |

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
- **The sample workflows also use:**
  - [KJNodes](https://github.com/kijai/ComfyUI-KJNodes): the SageAttention
    patches (they need the `sageattention` package) and Model Preview
    Override for the live preview (with `taeh3.safetensors` in
    `models/vae_approx`);
  - [ComfyUI-Custom-Scripts](https://github.com/pythongosssss/ComfyUI-Custom-Scripts):
    the turbo LoRA loader;
  - [rgthree-comfy](https://github.com/rgthree/rgthree-comfy): Power Lora
    Loader, Seed and Fast Groups Bypasser;
  - [ComfyUI-Easy-Use](https://github.com/yolain/ComfyUI-Easy-Use): Set and
    Get nodes;
  - the **Shift Selection** sigma-shift presets, built from
    [baslack/scripts_nodes](https://github.com/baslack/scripts_nodes)
    (Enumerator), [ComfyUI-Impact-Pack](https://github.com/ltdrdata/ComfyUI-Impact-Pack)
    (Switch) and [ComfyLiterals](https://github.com/M1kep/ComfyLiterals)
    (Float);
  - Remove Preview Override from scripts_nodes, which keeps the live
    preview off the refine pass;
  - DaSiWa Nodes' resolution calculator; any resolution node will do;
  - the AV latent split and latent upscaler for refine, from
    [baslack/Comfyui_Minimax_h3_latent_Upscaler-Plus, branch `local-work`](https://github.com/baslack/Comfyui_Minimax_h3_latent_Upscaler-Plus/tree/local-work).

## Sample workflows

- `Workflow/MiniMax_H3_Graph_Ref2VA.json`: Ref2VA clips with two subjects
  and dialogue between named speakers, chained with motion context.
- `Workflow/MiniMax_H3_Graph_Keyframe.json`: FL2VA clips through a row of
  keyframe images. Clip N runs from Keyframe N-1 to Keyframe N, so the clips
  play as one shot through your keyframes. The joins are plain cuts
  (`hard_cut`), and each clip from Clip 2 on hides the first frame it shares
  with the clip before (`first_frame_from_previous`).
- `Workflow/MiniMax_H3_Graph_Continue_Video.json`: the Ref2VA sample started
  from an existing video. Pick the video in Load Video (in the **Source
  video** group); the fork's **MiniMax H3 Continue Video** makes it Clip 0,
  and Final Decode crossfades it into the first clip. Continue Video's width
  and height are the clips' final size: the refined size when refine is on.

**Layout of the samples** (each has 9 clips, with Clips 1–3 on):
- **Global controls:**
  - models: SageAttention patches → an optional turbo LoRA (bypass it for
    a turbo-merged checkpoint) → **Content LoRAs (all clips)** → sigma
    shifts from **Shift Selection** presets;
  - resolution;
  - first-pass and refine samplers and schedulers (refine denoise 0.2);
  - **Refine (all clips)**, **Keep first-pass audio (refine)** and
    **Refine megapixels**: the refined size, so changing the first-pass
    resolution doesn't change it. It's a text field (ComfyLiterals Float),
    because number fields round to one decimal place;
  - **Live preview:** one preview for every clip, showing whichever clip is
    sampling. It sits before the clip LoRAs, so each clip is previewed with
    its own LoRAs. Each clip's refine removes it with **Remove Preview
    Override**, so the refine pass isn't previewed;
  - **Clips on / off**, which bypasses whole clip groups;
  - **Project (cache name)**: names the clip cache files,
    `ComfyUI/user/h3_extender_cache/chain_<name>.*`. Give every workflow its
    own name; two workflows with the same name share one cache, and a copied
    workflow keeps its original's name until you change it.

  Set nodes (➡️) publish these, and each clip reads them with Get nodes
  (⬅️).
- **Turn clips on in order.** A bypassed clip passes the chain straight
  through, so the video ends at the last clip that ran. Clips after it stay
  cached while the clips before them are read from disk: turn them back on
  and validated ones are read from disk too. A clip that runs again
  unvalidated deletes the cached clips after it, since they continued the
  old version. The last clip that ran is re-cut when the clips after it
  leave or come back.
- **References** (Ref2VA and Continue Video): four spare definitions (image
  plus definition), bypassed and already wired into Definitions. Turn one
  on, name it and pick its image to use it.
- **Keyframes** (FL2VA): Keyframe 0-9 in order. Set nodes publish them, and
  each clip gets its first and last frame with Get nodes.
- **Output** (Final Decode) sits at the top right, and the notes are above
  the controls.
- **Bookmarks** (rgthree): press **1** for the controls and references (or
  keyframes), and **2**, **3** and **4** for Clips 1–3, 4–6 and 7–9.
- **Each clip group:** its **Seed (rgthree)**, its own **LoRAs** (used by
  both passes), the clip card and the composed prompt. If a clip goes wrong
  in the live preview, stop the run, change that clip's seed and queue
  again; validated clips are read from disk.
- **The clip card** (a subgraph):
  - its prompt fields, labelled above each box. Drag the strip under a box
    to set its height on its own (the card grows or shrinks with it);
    double-click the strip to let the box share the space again;
  - length in seconds, name, `validated` and colour;
  - `run_mode`, which only the chain's first clip reads.

  Copy a whole clip group to add a clip; a pasted copy is independent.
- **VRAM:** VRAM Debug nodes inside each clip unload models before sampling
  and before the refine pass.

## Building a clip

- Encode → **Motion Context RAM** (the previous clip's `cached_samples` as
  `context_latent`; leave it unconnected for clip 1) → `BasicGuider` →
  `SamplerCustomAdvanced` → **Disk Join**. Use `BasicGuider`; H3 does badly
  with CFG guidance.
- **Length:** **MiniMax H3 Seconds to Frames** → Encode's `length`.
- **Disk Join settings:** `clip_name` names the clip's file in individual clip
  exports. `saturation`, `contrast` and `brightness` set its colour in Final
  Decode. `project`, from the fork's **MiniMax H3 Project**, names the
  cache; the chain's first Disk Join (or Continue Video) reads it.
- **Refine:** refine every clip to the same size, or none.
  1. Split the AV latent and upscale the video only, in the upscaler's
     `megapixels` mode. The first pass's aspect ratio is kept, and the refined
     size must be larger than the first pass.
  2. To keep the first-pass audio, give the audio latent a noise mask of 0
     (Solid Mask → Set Latent Noise Mask). H3 then holds it unchanged through
     the second pass.
  3. Recombine with core **Concat AV Latent**, which keeps the mask.
  4. Pass the encoder's `positive` through **MiniMax H3 Resize Target
     Conditioning** (with the latent upscaler provider), so keyframe clips'
     first and last frames match the refined size. Ref2VA references are left
     as they are.
  5. Then a second Motion Context RAM and sampler.
  6. An **If/Else Switch** picks the first-pass or refined samples for Disk
     Join. It's lazy, so refine doesn't run when it's off.

  A refined previous clip is shrunk automatically for the base pass.
- **Keyframe clips (I2VA / FL2VA)** use the FL2VA model. Two ways to chain
  them:
  - **Through keyframes**, as in the sample: each clip gets a first and a
    last frame, and the next clip starts from the same picture. Set
    `chain_mode` to `hard_cut` and leave `context_latent` unconnected. Turn
    on `first_frame_from_previous` from the second clip on, so the shared
    frame isn't shown twice.
  - **Through motion context**, like Ref2VA clips: the next clip continues
    the shot from Motion Context RAM, so motion and sound carry across the
    join. Give a clip a last frame only when it must end on a specific
    picture.
- **Real cuts between shots:** set `chain_mode` to `hard_cut` on the first
  Disk Join. A clip that starts from the previous clip's last frame (via
  **MiniMax H3 Tail From Latent**, or a shared keyframe) should turn on its
  Join's `first_frame_from_previous`, so that frame isn't shown twice.

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
