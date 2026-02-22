"use client";

import { JsEditor } from "@/components/editors/js-editor";
import { KeyField } from "@/components/ui/key-field";
import { InlineSchemaEditor } from "@/components/schemas/inline-schema-editor";
import type { FunctionRow } from "@/db/schema";
import type { PoolMeta } from "@/components/pool/types";
import { PoolRefBadge } from "@/components/pool/pool-ref-badge";

interface FunctionPoolViewProps {
  fn: FunctionRow;
  poolMeta: PoolMeta;
}

export function FunctionPoolView({ fn, poolMeta }: FunctionPoolViewProps) {
  const isBuiltin = poolMeta.origin === "builtin";

  return (
    <div className="space-y-3">
      <PoolRefBadge origin={poolMeta.origin} />
      <KeyField value={fn.key} />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Name</p>
        <p className="mt-0.5 text-sm">{fn.name || "\u2014"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Description</p>
        <p className="mt-0.5 text-sm whitespace-pre-wrap">{fn.description || "\u2014"}</p>
      </div>
      <InlineSchemaEditor
        label="Input (JSON Schema / Template)"
        value={fn.parametersSchema ?? null}
        onChange={() => {}}
        readOnly
      />
      <InlineSchemaEditor
        label="Output (JSON Schema / Template)"
        value={fn.returnParametersSchema ?? null}
        onChange={() => {}}
        readOnly
      />
      {isBuiltin ? (
        <p className="text-xs text-muted-foreground italic">
          系统内置函数的代码由平台管理，不可编辑。
        </p>
      ) : fn.code ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Code (JavaScript)</p>
          <div className="mt-1">
            <JsEditor value={fn.code} onChange={() => {}} readOnly height="400px" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
