"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { nanoid } from "nanoid";
import type { EnumRefOption } from "./parameter-row";
import { ParameterRow } from "./parameter-row";
import type { SchemaRow } from "@/db/schema";

interface ParameterListProps {
  fieldName: string;
  label: string;
  enumRefOptions?: EnumRefOption[];
  enumRefValues?: Record<string, string[]>;
  schemas?: SchemaRow[];
}

export function ParameterList({
  fieldName,
  label,
  enumRefOptions,
  enumRefValues,
  schemas,
}: ParameterListProps) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldName,
  });

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="mt-1 space-y-2">
        {fields.map((field, index) => (
          <ParameterRow
            key={field.id}
            fieldPath={`${fieldName}.${index}`}
            onDelete={() => remove(index)}
            enumRefOptions={enumRefOptions}
            enumRefValues={enumRefValues}
            schemas={schemas}
          />
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              id: nanoid(),
              name: "",
              type: "string",
              description: "",
              required: false,
            })
          }
          className="gap-1"
        >
          <PlusIcon className="size-3" />
          Add Parameter
        </Button>
      </div>
    </div>
  );
}
