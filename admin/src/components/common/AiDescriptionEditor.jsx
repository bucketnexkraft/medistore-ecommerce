import { useId, useMemo, useState } from "react";
import ReactQuill from "react-quill";

const TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 items-center rounded-md border border-violet-200 bg-white px-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60";

export default function AiDescriptionEditor({
  field,
  onGenerate,
  isGenerating = false,
  canGenerate = true,
  readOnly = false,
  labelText = "Product Description",
  promptPlaceholder = "Optional. Example: Make it more premium, friendly, and concise.",
  promptLabel = "AI Prompt",
  showAiButton = true,
}) {
  const reactId = useId();
  const toolbarId = useMemo(
    () => `ai-quill-toolbar-${reactId.replace(/:/g, "")}`,
    [reactId]
  );
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptValue, setPromptValue] = useState("");

  const modules = useMemo(
    () => ({
      toolbar: {
        container: `#${toolbarId}`,
      },
    }),
    [toolbarId]
  );

  const buttonDisabled = readOnly || isGenerating || !canGenerate;

  const openPromptModal = () => {
    if (buttonDisabled) {
      return;
    }

    setShowPromptModal(true);
  };

  const closePromptModal = () => {
    if (!isGenerating) {
      setShowPromptModal(false);
    }
  };

  const submitPrompt = async () => {
    if (buttonDisabled) {
      return;
    }

    await onGenerate?.(promptValue);
    setShowPromptModal(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="label p-0">
          <span className="label-text font-medium">{labelText}</span>
        </label>
        {!readOnly && showAiButton && (
          <button
            type="button"
            className={`${TOOLBAR_BUTTON_CLASS} border-violet-600 bg-violet-50 text-violet-700`}
            onClick={openPromptModal}
            disabled={buttonDisabled}
          >
            {isGenerating ? "Generating..." : "Generate with AI"}
          </button>
        )}
      </div>
      <div
        id={toolbarId}
        className="ql-toolbar ql-snow rounded-t-2xl border-slate-200 bg-white px-3 py-2"
      >
        <span className="ql-formats">
          <select className="ql-header" defaultValue="">
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="">Normal</option>
          </select>
          <button type="button" className="ql-bold" />
          <button type="button" className="ql-italic" />
          <button type="button" className="ql-underline" />
          <button type="button" className="ql-link" />
          <button type="button" className="ql-list" value="ordered" />
          <button type="button" className="ql-list" value="bullet" />
          <button type="button" className="ql-clean" />
        </span>
      </div>

      <ReactQuill
        {...field}
        theme="snow"
        modules={modules}
        readOnly={readOnly}
        className={`bg-white rounded-b-2xl ${readOnly ? "opacity-80" : ""}`}
      />

      {showPromptModal && !readOnly && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {promptLabel}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Add a short instruction, then generate the product description.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={closePromptModal}
                disabled={isGenerating}
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5">
              <textarea
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                rows={5}
                className="textarea textarea-bordered w-full text-base"
                placeholder={promptPlaceholder}
              />
              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-500">
                <span>Optional. Leave blank to use the default product context.</span>
                <span>{promptValue.length}/1000</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closePromptModal}
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitPrompt}
                disabled={buttonDisabled}
              >
                {isGenerating ? "Generating..." : "Submit Prompt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
