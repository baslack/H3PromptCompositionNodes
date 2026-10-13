import { app } from "../../scripts/app.js";

// The prompt nodes' text boxes, and the same boxes promoted onto subgraph cards:
// - a caption strip above each box, since a filled box shows no name;
// - a drag strip below each box that sets its height on its own. Heights are
//   kept in the node's properties; double-click a strip to share space again.
const PROMPT_NODES = new Set(["MiniMaxH3Definition", "MiniMaxH3Ref2VAPrompt", "MiniMaxH3KeyframePrompt"]);
const CAPTION_HEIGHT = 16;
const STRIP_HEIGHT = 10;
const MIN_BOX_HEIGHT = 60;

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

function isPromptBox(node, widget) {
    if (widget.h3PromptBox === undefined) {
        const multiline = !!widget.element?.classList?.contains("comfy-multiline-input");
        widget.h3PromptBox = multiline && (PROMPT_NODES.has(node.comfyClass) || promotesPromptText(node, widget.name));
        if (widget.h3PromptBox) {
            widget.element.style.marginTop = `${CAPTION_HEIGHT}px`;
            widget.element.style.height = `calc(100% - ${CAPTION_HEIGHT + STRIP_HEIGHT}px)`;
            fixHeight(node, widget);
        }
    }
    return widget.h3PromptBox;
}

function savedHeight(node, widget) {
    return node.properties?.h3_box_heights?.[widget.name];
}

// A box with a saved height takes exactly that; the others share what is left.
function fixHeight(node, widget) {
    const layoutSize = widget.computeLayoutSize?.bind(widget);
    if (!layoutSize) return;
    widget.computeLayoutSize = function (n) {
        const size = layoutSize(n);
        const height = savedHeight(node, widget);
        return height ? { ...size, minHeight: height, maxHeight: height } : size;
    };
}

function setHeight(node, widget, height) {
    // computedHeight only catches up at the next layout, so measure from the last height set.
    const before = savedHeight(node, widget) ?? widget.computedHeight ?? height ?? 0;
    node.properties.h3_box_heights ??= {};
    if (height === null) {
        delete node.properties.h3_box_heights[widget.name];
    } else {
        node.properties.h3_box_heights[widget.name] = height;
        // Grow or shrink the node by the box's change, so the other boxes keep their size.
        node.setSize([node.size[0], node.size[1] + height - before]);
    }
    node.setDirtyCanvas(true, true);
}

function ensureStrip(node, widget) {
    const holder = widget.element.parentElement;
    if (!holder || holder.querySelector(":scope > .h3-box-strip")) return;
    const strip = document.createElement("div");
    strip.className = "h3-box-strip";
    strip.title = "Drag to resize this box; double-click to let it share the space again";
    strip.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${STRIP_HEIGHT}px;cursor:ns-resize;` +
        "display:flex;align-items:center;justify-content:center;touch-action:none;";
    const grip = document.createElement("div");
    grip.style.cssText = "width:40px;height:3px;border-radius:2px;background:var(--border-color,#666);pointer-events:none;";
    strip.appendChild(grip);

    strip.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        strip.setPointerCapture(event.pointerId);
        const startY = event.clientY;
        const startHeight = widget.computedHeight ?? MIN_BOX_HEIGHT;
        grip.style.background = "var(--p-primary-color,#8dd7ff)";
        const move = (e) => {
            const scale = app.canvas?.ds?.scale || 1;
            setHeight(node, widget, Math.max(MIN_BOX_HEIGHT, Math.round(startHeight + (e.clientY - startY) / scale)));
        };
        const up = () => {
            strip.removeEventListener("pointermove", move);
            strip.removeEventListener("pointerup", up);
            grip.style.background = "var(--border-color,#666)";
        };
        strip.addEventListener("pointermove", move);
        strip.addEventListener("pointerup", up);
    });
    strip.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        setHeight(node, widget, null);
    });
    if (getComputedStyle(holder).position === "static") holder.style.position = "relative";
    holder.appendChild(strip);
}

function drawCaptions(node, ctx) {
    if (node.flags.collapsed || !node.widgets) return;
    ctx.save();
    ctx.font = `${LiteGraph.NODE_SUBTEXT_SIZE}px Arial`;
    ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
    for (const widget of node.widgets) {
        if (widget.hidden || !isPromptBox(node, widget)) continue;
        const margin = widget.margin ?? 10;
        ctx.fillText(widget.label || widget.name, margin + 4, widget.y + margin + CAPTION_HEIGHT - 4);
        // The frontend may rebuild the box's holder; put the strip back if so.
        ensureStrip(node, widget);
    }
    ctx.restore();
}

app.registerExtension({
    name: "H3PromptComposition.PromptBoxes",
    nodeCreated(node) {
        const draw = node.onDrawForeground;
        node.onDrawForeground = function (ctx) {
            const r = draw?.apply(this, arguments);
            drawCaptions(this, ctx);
            return r;
        };
    },
});
