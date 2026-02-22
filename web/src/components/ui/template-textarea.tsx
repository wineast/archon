"use client";

import {
  MdEditor,
  type CompletionDocument,
  type CompletionTool,
  type CompletionOntologyType,
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
  tools,
  ontologyTypes,
  placeholder,
  className,
  height,
}: {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  variableMap?: Record<string, unknown>;
  documents?: CompletionDocument[];
  tools?: CompletionTool[];
  ontologyTypes?: CompletionOntologyType[];
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
      tools={tools}
      ontologyTypes={ontologyTypes}
      placeholder={placeholder}
      className={className}
      height={height}
    />
  );
}
