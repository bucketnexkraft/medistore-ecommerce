import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import DOMPurify from "dompurify";

const TOOLBAR_BUTTONS = [
  { label: "B", title: "Bold", command: "bold" },
  { label: "I", title: "Italic", command: "italic" },
  { label: "U", title: "Underline", command: "underline" },
  { label: "S", title: "Strike", command: "strikeThrough" },
  { label: "H1", title: "Heading 1", command: "formatBlock", value: "<h1>" },
  { label: "H2", title: "Heading 2", command: "formatBlock", value: "<h2>" },
  { label: "H3", title: "Heading 3", command: "formatBlock", value: "<h3>" },
  { label: "P", title: "Paragraph", command: "formatBlock", value: "<p>" },
  { label: "UL", title: "Bullet List", command: "insertUnorderedList" },
  { label: "OL", title: "Numbered List", command: "insertOrderedList" },
  { label: "Quote", title: "Blockquote", command: "formatBlock", value: "<blockquote>" },
  { label: "Code", title: "Code Block", command: "formatBlock", value: "<pre>" },
  { label: "Link", title: "Insert Link", action: "link" },
  { label: "Image", title: "Insert Image", action: "image" },
  { label: "Clear", title: "Clear Formatting", command: "removeFormat" },
];

const sanitizeHtml = (value) =>
  DOMPurify.sanitize(value || "", {
    USE_PROFILES: { html: true },
  });

const normalizeEditorValue = (value) => {
  const sanitized = sanitizeHtml(value);
  return sanitized === "<p><br></p>" ? "" : sanitized;
};

const ReactQuillShim = forwardRef(function ReactQuillShim(
  {
    value = "",
    onChange,
    onBlur,
    placeholder = "Write something...",
    readOnly = false,
    className = "",
  },
  ref
) {
  const editorRef = useRef(null);

  const syncEditorContent = (nextValue) => {
    const editor = editorRef.current;
    if (!editor) return;
    const normalized = normalizeEditorValue(nextValue);
    if (editor.innerHTML !== normalized) {
      editor.innerHTML = normalized;
    }
  };

  useEffect(() => {
    syncEditorContent(value);
  }, [value]);

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    blur: () => editorRef.current?.blur(),
    getEditor: () => editorRef.current,
  }));

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const sanitized = normalizeEditorValue(editor.innerHTML);
    if (editor.innerHTML !== sanitized) {
      editor.innerHTML = sanitized;
    }
    onChange?.(sanitized);
  };

  const runCommand = (command, commandValue = null) => {
    if (readOnly || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const handleAction = (action) => {
    if (readOnly) return;

    if (action === "link") {
      const url = window.prompt("Enter a link URL");
      if (url) {
        runCommand("createLink", url);
      }
      return;
    }

    if (action === "image") {
      const url = window.prompt("Enter an image URL");
      if (url) {
        runCommand("insertImage", url);
      }
    }
  };

  return (
    <div className={`rq-container ${className}`.trim()}>
      {!readOnly ? (
        <div className="rq-toolbar" role="toolbar" aria-label="Text formatting toolbar">
          {TOOLBAR_BUTTONS.map((button) => (
            <button
              key={`${button.label}-${button.command || button.action}`}
              type="button"
              className="rq-toolbar-button"
              title={button.title}
              onClick={() =>
                button.action ? handleAction(button.action) : runCommand(button.command, button.value)
              }
            >
              {button.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={editorRef}
        className={`rq-editor ${readOnly ? "is-readonly" : ""}`.trim()}
        contentEditable={!readOnly}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={() => {
          emitChange();
          onBlur?.();
        }}
      />
    </div>
  );
});

export default ReactQuillShim;
