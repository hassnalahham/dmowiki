"use client";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code2, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Redo, Undo } from "lucide-react";
import { useState } from "react";
import { MediaPicker } from "./media-picker";

/** HTML that the visual editor can't represent faithfully (tables, inline styles, layout markup). */
export function isComplexHtml(html: string) {
  return /<table|style=|<center|class="[^"]*(?:gallery|thumb|wikitable)/i.test(html);
}

function Btn({ on, active, label, children }: { on: () => void; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={on}
      className={`rounded p-1.5 ${active ? "bg-panel-2 text-accent" : "text-muted hover:text-text"}`}
    >
      {children}
    </button>
  );
}

export function RichEditor({ name, initialHtml }: { name: string; initialHtml: string }) {
  const [html, setHtml] = useState(initialHtml);
  const [mode, setMode] = useState<"visual" | "html">(isComplexHtml(initialHtml) ? "html" : "visual");
  const [picker, setPicker] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Image],
    content: mode === "visual" ? initialHtml : "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    editorProps: { attributes: { class: "tiptap wiki-content px-4 py-3" } },
  });

  const switchTo = (m: "visual" | "html") => {
    if (m === mode) return;
    if (m === "visual") {
      if (isComplexHtml(html) && !confirm("This content has tables or custom styling that the visual editor will simplify. Continue?")) return;
      editor?.commands.setContent(html);
    }
    setMode(m);
  };

  const insertImage = (url: string, alt: string) => {
    if (mode === "visual") editor?.chain().focus().setImage({ src: url, alt }).run();
    else setHtml((h) => `${h}\n<img src="${url}" alt="${alt.replace(/"/g, "&quot;")}" />`);
    setPicker(false);
  };

  return (
    <div className="rounded-lg border border-border bg-bg-soft">
      <input type="hidden" name={name} value={html} />
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1">
        <div className="mr-2 flex rounded-md border border-border p-0.5 text-xs">
          {(["visual", "html"] as const).map((m) => (
            <button key={m} type="button" onClick={() => switchTo(m)} className={`rounded px-2 py-0.5 ${mode === m ? "bg-panel-2 text-text" : "text-muted"}`}>
              {m === "visual" ? "Visual" : "HTML"}
            </button>
          ))}
        </div>
        {mode === "visual" && editor && (
          <>
            <Btn label="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-4 w-4" /></Btn>
            <Btn label="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-4 w-4" /></Btn>
            <Btn label="Heading" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></Btn>
            <Btn label="Subheading" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></Btn>
            <Btn label="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></Btn>
            <Btn label="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></Btn>
            <Btn label="Quote" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></Btn>
            <Btn label="Code" on={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}><Code2 className="h-4 w-4" /></Btn>
            <Btn
              label="Link"
              active={editor.isActive("link")}
              on={() => {
                const prev = editor.getAttributes("link").href as string | undefined;
                const url = prompt("Link URL (e.g. /wiki/Agumon)", prev ?? "");
                if (url === null) return;
                if (!url) editor.chain().focus().unsetLink().run();
                else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
              }}
            >
              <Link2 className="h-4 w-4" />
            </Btn>
            <Btn label="Undo" on={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></Btn>
            <Btn label="Redo" on={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></Btn>
          </>
        )}
        <Btn label="Insert image" on={() => setPicker(true)}><ImagePlus className="h-4 w-4" /></Btn>
      </div>
      {mode === "visual" ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck={false}
          className="block min-h-[420px] w-full resize-y bg-transparent px-4 py-3 font-mono text-xs text-text outline-none"
          aria-label="HTML source"
        />
      )}
      {picker && <MediaPicker onClose={() => setPicker(false)} onPick={(m) => insertImage(m.path, m.alt ?? m.filename)} />}
    </div>
  );
}
