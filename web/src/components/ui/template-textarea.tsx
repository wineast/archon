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
  variableMap,
  documents,
  placeholder,
  className,
  height,
}: {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  variableMap?: Record<string, unknown>;
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
      variableMap={variableMap}
      documents={documents}
      placeholder={placeholder}
      className={className}
      height={height}
    />
  );
}
