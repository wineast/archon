"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { nanoid } from "nanoid";
import type { EnumDatasetOption } from "./parameter-row";
import { ParameterRow } from "./parameter-row";
import type { SchemaRow } from "@/db/schema";

interface ParameterListProps {
  fieldName: string;
  label: string;
  enumDatasetOptions?: EnumDatasetOption[];
  enumDatasetValues?: Record<string, string[]>;
  schemas?: SchemaRow[];
}

export function ParameterList({
  fieldName,
  label,
  enumDatasetOptions,
  enumDatasetValues,
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
            enumDatasetOptions={enumDatasetOptions}
            enumDatasetValues={enumDatasetValues}
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
