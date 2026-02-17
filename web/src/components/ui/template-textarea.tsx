"use client";

import {
  TemplateEditor,
  type CompletionDocument,
  type CompletionLookup,
} from "./template-editor";

/**
 * Backward-compatible alias – older code imports TemplateTextarea.
 * It wraps TemplateEditor with the same props.
 */
export function TemplateTextarea({
  value,
  onChange,
  variables,
  documents,
  lookups,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  documents?: CompletionDocument[];
  lookups?: CompletionLookup[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <TemplateEditor
      value={value}
      onChange={onChange}
      variables={variables}
      documents={documents}
      lookups={lookups}
      placeholder={placeholder}
      className={className}
    />
  );
}
