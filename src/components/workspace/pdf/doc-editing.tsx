"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  ImageIcon,
  Map,
  Minus,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import type { CustomBlock, ItineraryOutput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { compressImageFile } from "./image-utils";

/** Mutating callback wired to the projects store's `patchItinerary` updater. */
export type DocPatch = (
  updater: (itinerary: ItineraryOutput) => ItineraryOutput,
) => void;

export interface DocEditor {
  patch: DocPatch;
}

function makeId() {
  return `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function isHidden(itinerary: ItineraryOutput, key: string): boolean {
  return (itinerary.hiddenElements ?? []).includes(key);
}

export function toggleHidden(patch: DocPatch, key: string) {
  patch((itinerary) => {
    const set = new Set(itinerary.hiddenElements ?? []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    return { ...itinerary, hiddenElements: [...set] };
  });
}

export function blocksFor(
  itinerary: ItineraryOutput,
  anchor: string,
): CustomBlock[] {
  return (itinerary.customBlocks ?? [])
    .filter((block) => block.anchor === anchor)
    .sort((a, b) => a.order - b.order);
}

function addBlock(patch: DocPatch, anchor: string, type: CustomBlock["type"]) {
  patch((itinerary) => {
    const blocks = itinerary.customBlocks ?? [];
    const maxOrder = blocks
      .filter((block) => block.anchor === anchor)
      .reduce((max, block) => Math.max(max, block.order), -1);
    const block: CustomBlock = {
      id: makeId(),
      anchor,
      order: maxOrder + 1,
      type,
      variant:
        type === "text" ? "body" : type === "divider" ? "rule" : "",
      text: type === "text" ? "" : "",
      image: "",
    };
    return { ...itinerary, customBlocks: [...blocks, block] };
  });
}

function updateBlock(patch: DocPatch, id: string, value: Partial<CustomBlock>) {
  patch((itinerary) => ({
    ...itinerary,
    customBlocks: (itinerary.customBlocks ?? []).map((block) =>
      block.id === id ? { ...block, ...value } : block,
    ),
  }));
}

function removeBlock(patch: DocPatch, id: string) {
  patch((itinerary) => ({
    ...itinerary,
    customBlocks: (itinerary.customBlocks ?? []).filter(
      (block) => block.id !== id,
    ),
  }));
}

function moveBlock(patch: DocPatch, block: CustomBlock, direction: -1 | 1) {
  patch((itinerary) => {
    const siblings = (itinerary.customBlocks ?? [])
      .filter((candidate) => candidate.anchor === block.anchor)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((candidate) => candidate.id === block.id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length)
      return itinerary;
    const a = siblings[index];
    const b = siblings[swapIndex];
    return {
      ...itinerary,
      customBlocks: (itinerary.customBlocks ?? []).map((candidate) => {
        if (candidate.id === a.id) return { ...candidate, order: b.order };
        if (candidate.id === b.id) return { ...candidate, order: a.order };
        return candidate;
      }),
    };
  });
}

/**
 * Inline-editable text. Renders plain text when not editing. While editing it is
 * an uncontrolled contentEditable whose content is set imperatively so the caret
 * never jumps; edits commit on blur.
 */
export function EditableText({
  value,
  editable,
  onCommit,
  as: Tag = "span",
  className,
  style,
  placeholder,
}: {
  value: string;
  editable: boolean;
  onCommit: (next: string) => void;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (document.activeElement !== node && node.textContent !== value) {
      node.textContent = value;
    }
  }, [value, editable]);

  if (!editable) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  return React.createElement(Tag, {
    ref: ref as React.Ref<HTMLElement>,
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: "textbox",
    "aria-multiline": Tag !== "span",
    "aria-label": placeholder ?? value ?? "Editable text",
    "data-placeholder": placeholder,
    className: cn("rc-editable", className),
    style,
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      const next = event.currentTarget.textContent ?? "";
      if (next !== value) onCommit(next);
    },
  });
}

/**
 * Wraps a removable built-in element. Hiding is reversible: in edit mode a hidden
 * element collapses to a "Restore" bar; in clean/export mode it renders nothing.
 */
export function Removable({
  editable,
  hidden,
  onToggle,
  label,
  className,
  children,
}: {
  editable: boolean;
  hidden: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (hidden) {
    if (!editable) return null;
    return (
      <button
        type="button"
        onClick={onToggle}
        className="rc-edit-only rc-restore-bar"
        title={`Restore ${label}`}
      >
        <Eye className="size-3.5" />
        Restore {label}
      </button>
    );
  }
  if (!editable) return <>{children}</>;
  return (
    <div className={cn("rc-edit-group", className)}>
      {children}
      <button
        type="button"
        onClick={onToggle}
        title={`Remove ${label}`}
        aria-label={`Remove ${label}`}
        className="rc-edit-only rc-remove-btn"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

const TEXT_VARIANTS: { id: string; label: string }[] = [
  { id: "heading", label: "Heading" },
  { id: "subheading", label: "Eyebrow" },
  { id: "body", label: "Body" },
  { id: "callout", label: "Callout" },
];

const DIVIDER_VARIANTS: { id: string; label: string }[] = [
  { id: "rule", label: "Accent" },
  { id: "line", label: "Line" },
  { id: "space", label: "Space" },
];

function textVariantClass(variant: string): string {
  switch (variant) {
    case "heading":
      return "text-2xl font-semibold";
    case "subheading":
      return "rc-doc-eyebrow";
    case "callout":
      return "rc-doc-callout text-sm leading-relaxed";
    default:
      return "text-base leading-relaxed";
  }
}

function CustomBlockView({
  block,
  editable,
  patch,
  isFirst,
  isLast,
}: {
  block: CustomBlock;
  editable: boolean;
  patch: DocPatch;
  isFirst: boolean;
  isLast: boolean;
}) {
  const inputId = React.useId();

  const body =
    block.type === "divider" ? (
      block.variant === "space" ? (
        <div style={{ height: "1.5rem" }} />
      ) : block.variant === "line" ? (
        <div className="rc-doc-hairline" />
      ) : (
        <div className="rc-doc-rule" />
      )
    ) : block.type === "route-map" ? (
      <div className="rounded-2xl border border-[var(--doc-border)] bg-[var(--doc-paper-soft)] p-5">
        <p className="rc-doc-eyebrow">Route map</p>
        <div className="rc-doc-rule mt-2" />
        <EditableText
          as="p"
          value={
            block.text ||
            "Add an exported route map image here, or use this block as a buyer-facing route-map placeholder."
          }
          editable={editable}
          placeholder="Route map caption..."
          onCommit={(next) => updateBlock(patch, block.id, { text: next })}
          className="mt-4 text-sm leading-relaxed"
          style={{ color: "var(--doc-ink-soft)" }}
        />
      </div>
    ) : block.type === "image" ? (
      block.image ? (
        <div
          className="overflow-hidden rounded-2xl"
          style={{ border: "1px solid var(--doc-border)" }}
        >
          <div className="rc-doc-img-frame">
            <img className="rc-doc-img" src={block.image} alt="" />
          </div>
        </div>
      ) : editable ? (
        <div className="rc-edit-only rc-block-placeholder">
          <ImageIcon className="size-4" />
          Add an image below
        </div>
      ) : null
    ) : (
      <EditableText
        as="p"
        value={block.text}
        editable={editable}
        placeholder="Type text..."
        onCommit={(next) => updateBlock(patch, block.id, { text: next })}
        className={cn(
          textVariantClass(block.variant),
          block.variant === "callout" && "rc-doc-callout-block",
        )}
        style={
          block.variant === "body" || block.variant === "callout"
            ? { color: "var(--doc-ink-soft)" }
            : undefined
        }
      />
    );

  if (!editable) {
    if (block.type === "image" && !block.image) return null;
    return <div className="rc-doc-block">{body}</div>;
  }

  return (
    <div className="rc-doc-block rc-edit-group">
      {body}
      <div className="rc-edit-only rc-block-bar">
        <button
          type="button"
          onClick={() => moveBlock(patch, block, -1)}
          disabled={isFirst}
          title="Move up"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => moveBlock(patch, block, 1)}
          disabled={isLast}
          title="Move down"
        >
          <ChevronDown className="size-3.5" />
        </button>
        {block.type === "text" ? (
          <select
            value={block.variant || "body"}
            onChange={(event) =>
              updateBlock(patch, block.id, { variant: event.target.value })
            }
            title="Text style"
          >
            {TEXT_VARIANTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
        {block.type === "divider" ? (
          <select
            value={block.variant || "rule"}
            onChange={(event) =>
              updateBlock(patch, block.id, { variant: event.target.value })
            }
            title="Divider style"
          >
            {DIVIDER_VARIANTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
        {block.type === "image" ? (
          <>
            <label htmlFor={inputId} className="rc-block-upload">
              {block.image ? "Replace" : "Upload"}
              <input
                id={inputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const compressed = await compressImageFile(file);
                  updateBlock(patch, block.id, { image: compressed });
                }}
              />
            </label>
            {block.image ? (
              <button
                type="button"
                onClick={() => updateBlock(patch, block.id, { image: "" })}
                title="Clear image"
              >
                <Minus className="size-3.5" />
              </button>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          onClick={() => removeBlock(patch, block.id)}
          title="Delete block"
          className="rc-block-delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Renders custom blocks for an anchor plus an insertion bar (edit mode only). */
export function AnchorSlot({
  anchor,
  itinerary,
  editable,
  patch,
}: {
  anchor: string;
  itinerary: ItineraryOutput;
  editable: boolean;
  patch: DocPatch;
}) {
  const blocks = blocksFor(itinerary, anchor);
  if (!editable && blocks.length === 0) return null;
  return (
    <div className="rc-doc-blocks">
      {blocks.map((block, index) => (
        <CustomBlockView
          key={block.id}
          block={block}
          editable={editable}
          patch={patch}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
        />
      ))}
      {editable ? (
        <div className="rc-edit-only rc-insert-bar">
          <Plus className="size-3.5" />
          <button type="button" onClick={() => addBlock(patch, anchor, "text")}>
            <Type className="size-3.5" />
            Text
          </button>
          <button
            type="button"
            onClick={() => addBlock(patch, anchor, "image")}
          >
            <ImageIcon className="size-3.5" />
            Image
          </button>
          <button
            type="button"
            onClick={() => addBlock(patch, anchor, "divider")}
          >
            <Minus className="size-3.5" />
            Divider
          </button>
          <button
            type="button"
            onClick={() => addBlock(patch, anchor, "route-map")}
          >
            <Map className="size-3.5" />
            Route map
          </button>
        </div>
      ) : null}
    </div>
  );
}
