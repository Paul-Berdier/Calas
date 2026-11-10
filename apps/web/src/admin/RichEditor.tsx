import { useEffect, useRef, useState } from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link,
  Unlink,
  ImagePlus,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button, Field, Modal } from "./ui";
import { MediaPicker } from "./components/MediaPicker";
import type { ContentImage } from "../lib/cms/types";

const EditorialImage = Image.extend({
  addAttributes() {
    return {
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-media-id"),
        renderHTML: (attributes) =>
          attributes.mediaId ? { "data-media-id": attributes.mediaId } : {},
      },
      alt: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "img[data-media-id]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "img",
      {
        ...HTMLAttributes,
        src: `/media/${encodeURIComponent(String(node.attrs.mediaId))}/?w=960`,
      },
    ];
  },
});
export const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
export function RichEditor({
  value,
  onChange,
  label = "Texte de l’article",
  disabled = false,
}: {
  value?: JSONContent;
  onChange: (value: JSONContent) => void;
  label?: string;
  disabled?: boolean;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false),
    [imageOpen, setImageOpen] = useState(false),
    [href, setHref] = useState(""),
    [linkError, setLinkError] = useState("");
  const [image, setImage] = useState<ContentImage>();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto", "tel"],
        },
      }),
      EditorialImage.configure({ allowBase64: false }),
    ],
    content: value ?? emptyDocument,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
      transformPastedHTML: (html) => {
        const document = new DOMParser().parseFromString(html, "text/html");
        document
          .querySelectorAll(
            "script,style,iframe,object,embed,form,svg,math,img",
          )
          .forEach((element) => element.remove());
        document.querySelectorAll("*").forEach((element) => {
          for (const attribute of [...element.attributes])
            if (!["href", "colspan", "rowspan"].includes(attribute.name))
              element.removeAttribute(attribute.name);
        });
        return document.body.innerHTML;
      },
    },
    onUpdate: ({ editor }) => callback.current(editor.getJSON()),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            h2: editor.isActive("heading", { level: 2 }),
            h3: editor.isActive("heading", { level: 3 }),
            bullet: editor.isActive("bulletList"),
            ordered: editor.isActive("orderedList"),
            quote: editor.isActive("blockquote"),
            link: editor.isActive("link"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
            words: editor.getText().trim().split(/\s+/).filter(Boolean).length,
          }
        : null,
  });
  useEffect(() => {
    if (
      editor &&
      JSON.stringify(editor.getJSON()) !==
        JSON.stringify(value ?? emptyDocument)
    )
      editor.commands.setContent(value ?? emptyDocument, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  function addLink() {
    const trimmed = href.trim();
    if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(trimmed)) {
      setLinkError(
        "Utilisez une adresse https://, un lien interne /page/, mailto: ou tel:.",
      );
      return;
    }
    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmed })
      .run();
    setLinkOpen(false);
    setLinkError("");
  }
  const tools = [
    {
      label: "Gras (Ctrl+B)",
      icon: Bold,
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italique (Ctrl+I)",
      icon: Italic,
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Titre de niveau 2",
      icon: Heading2,
      active: state?.h2,
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Titre de niveau 3",
      icon: Heading3,
      active: state?.h3,
      run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Liste à puces",
      icon: List,
      active: state?.bullet,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Liste numérotée",
      icon: ListOrdered,
      active: state?.ordered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Citation",
      icon: Quote,
      active: state?.quote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
  ];
  return (
    <div>
      <div className="admin-rich-editor">
        <div
          className="admin-rich-toolbar"
          role="toolbar"
          aria-label={`Mise en forme — ${label}`}
        >
          {tools.map((tool) => (
            <Button
              key={tool.label}
              variant="ghost"
              size="icon"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={Boolean(tool.active)}
              disabled={disabled || !editor}
              onClick={tool.run}
            >
              <tool.icon />
            </Button>
          ))}
          <span className="admin-rich-separator" />
          <Button
            variant="ghost"
            size="icon"
            title="Ajouter ou modifier un lien"
            aria-label="Ajouter ou modifier un lien"
            aria-pressed={Boolean(state?.link)}
            disabled={disabled || !editor}
            onClick={() => {
              setHref(editor?.getAttributes("link").href ?? "https://");
              setLinkOpen(true);
            }}
          >
            <Link />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Retirer le lien"
            aria-label="Retirer le lien"
            disabled={disabled || !state?.link}
            onClick={() => editor?.chain().focus().unsetLink().run()}
          >
            <Unlink />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Insérer une image de la médiathèque"
            aria-label="Insérer une image de la médiathèque"
            disabled={disabled || !editor}
            onClick={() => {
              setImage(undefined);
              setImageOpen(true);
            }}
          >
            <ImagePlus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Séparateur"
            aria-label="Séparateur"
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          >
            <Minus />
          </Button>
          <span className="admin-rich-separator" />
          <Button
            variant="ghost"
            size="icon"
            title="Annuler (Ctrl+Z)"
            aria-label="Annuler la dernière modification"
            disabled={disabled || !state?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Rétablir (Ctrl+Maj+Z)"
            aria-label="Rétablir la modification"
            disabled={disabled || !state?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 />
          </Button>
        </div>
        <EditorContent editor={editor} />
        <div className="admin-rich-footer">
          <span>{state?.words ?? 0} mots</span>
          <span>Texte collé : mise en forme nettoyée</span>
        </div>
      </div>
      <Modal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Insérer un lien"
        description="Sélectionnez d’abord les mots qui porteront le lien."
      >
        <Field label="Adresse du lien">
          {(id) => (
            <input
              id={id}
              className="admin-input"
              value={href}
              onChange={(event) => setHref(event.target.value)}
            />
          )}
        </Field>
        {linkError && (
          <p className="admin-error" role="alert">
            {linkError}
          </p>
        )}
        <div className="admin-actions">
          <Button onClick={addLink}>Appliquer le lien</Button>
          <Button variant="secondary" onClick={() => setLinkOpen(false)}>
            Annuler
          </Button>
        </div>
      </Modal>
      <Modal
        open={imageOpen}
        onOpenChange={setImageOpen}
        title="Une image dans l’article"
        description="Choisissez une image et décrivez ce qu’elle apporte au lecteur."
      >
        <MediaPicker
          label="Image à insérer"
          value={image}
          onChange={setImage}
        />
        <div className="admin-actions">
          <Button
            disabled={!image?.mediaId || !image.alt.trim()}
            onClick={() => {
              if (image) {
                editor
                  ?.chain()
                  .focus()
                  .insertContent({
                    type: "image",
                    attrs: { mediaId: image.mediaId, alt: image.alt },
                  })
                  .run();
                setImageOpen(false);
              }
            }}
          >
            Insérer l’image
          </Button>
          <Button variant="secondary" onClick={() => setImageOpen(false)}>
            Annuler
          </Button>
        </div>
      </Modal>
    </div>
  );
}
