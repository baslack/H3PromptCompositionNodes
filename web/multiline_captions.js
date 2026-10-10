import { app } from "../../scripts/app.js";

// A multiline text box shows its name only as a placeholder, so a filled box is
// unlabelled. Draw the name in a strip above each box on the prompt nodes, and
// on subgraph cards where those boxes are promoted.
const PROMPT_NODES = new Set(["MiniMaxH3Definition", "MiniMaxH3Ref2VAPrompt", "MiniMaxH3KeyframePrompt"]);
const CAPTION_HEIGHT = 16;

function promotesPromptText(node, name) {
    const subgraph = node.subgraph;
    const input = subgraph?.inputs.find((i) => i.name === name);
    return !!input?.linkIds.some((id) => {
        const link = subgraph.getLink(id);
        const target = link && subgraph.getNodeById(link.target_id);
        if (!target) return false;
        if (PROMPT_NODES.has(target.comfyClass)) return true;
        return !!target.subgraph && promotesPromptText(target, target.inputs[link.target_slot]?.name);
    });
}

function wantsCaption(node, widget) {
    if (widget.h3Caption === undefined) {
        const multiline = !!widget.element?.classList?.contains("comfy-multiline-input");
        widget.h3Caption = multiline && (PROMPT_NODES.has(node.comfyClass) || promotesPromptText(node, widget.name));
        if (widget.h3Caption) {
            widget.element.style.marginTop = `${CAPTION_HEIGHT}px`;
            widget.element.style.height = `calc(100% - ${CAPTION_HEIGHT}px)`;
        }
    }
    return widget.h3Caption;
}

function drawCaptions(node, ctx) {
    if (node.flags.collapsed || !node.widgets) return;
    ctx.save();
    ctx.font = `${LiteGraph.NODE_SUBTEXT_SIZE}px Arial`;
    ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
    for (const widget of node.widgets) {
        if (widget.hidden || !wantsCaption(node, widget)) continue;
        const margin = widget.margin ?? 10;
        ctx.fillText(widget.label || widget.name, margin + 4, widget.y + margin + CAPTION_HEIGHT - 4);
    }
    ctx.restore();
}

app.registerExtension({
    name: "H3PromptComposition.MultilineCaptions",
    nodeCreated(node) {
        const draw = node.onDrawForeground;
        node.onDrawForeground = function (ctx) {
            const r = draw?.apply(this, arguments);
            drawCaptions(this, ctx);
            return r;
        };
    },
});
