"use client";

import {
  MdEditor,
  type CompletionDocument,
} from "@/components/editors/md-editor";

/**
 * Backward-compatible alias – older code imports TemplateTextarea.
 * It wraps MdEditor with the same props.
 */
export function TemplateTextarea({
  value,
  onChange,
  variables,
  documents,
  placeholder,
  className,
  height,
}: {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  documents?: CompletionDocument[];
  placeholder?: string;
  className?: string;
  height?: string;
}) {
  return (
    <MdEditor
      value={value}
      onChange={onChange}
      variables={variables}
      documents={documents}
      placeholder={placeholder}
      className={className}
      height={height}
    />
  );
}
