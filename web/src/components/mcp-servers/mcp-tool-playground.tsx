"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircleIcon, PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JsonEditor } from "@/components/editors/json-editor";
import { executeMcpTool, type McpToolDef } from "@/lib/mcp-servers/hooks";

interface McpToolPlaygroundProps {
  tools: McpToolDef[];
  serverId: string;
  connectionConfig: { url: string; transportType: string; headers: Record<string, string> };
}

type ParamFieldType = "string" | "number" | "boolean" | "enum" | "complex";

interface ParamField {
  name: string;
  type: ParamFieldType;
  description?: string;
  required: boolean;
  enumValues?: string[];
  schema: Record<string, unknown>;
}

function classifyParam(name: string, schema: Record<string, unknown>, required: boolean): ParamField {
  const type = schema.type as string | undefined;
  const enumValues = schema.enum as string[] | undefined;

  if (enumValues && Array.isArray(enumValues)) {
    return { name, type: "enum", description: schema.description as string | undefined, required, enumValues: enumValues.map(String), schema };
  }
  if (type === "string") {
    return { name, type: "string", description: schema.description as string | undefined, required, schema };
  }
  if (type === "number" || type === "integer") {
    return { name, type: "number", description: schema.description as string | undefined, required, schema };
  }
  if (type === "boolean") {
    return { name, type: "boolean", description: schema.description as string | undefined, required, schema };
  }
  return { name, type: "complex", description: schema.description as string | undefined, required, schema };
}

function parseParamFields(inputSchema: McpToolDef["inputSchema"]): ParamField[] {
  const properties = inputSchema.properties ?? {};
  const requiredSet = new Set(inputSchema.required ?? []);

  return Object.entries(properties).map(([name, schema]) =>
    classifyParam(name, schema as Record<string, unknown>, requiredSet.has(name))
  );
}

export function McpToolPlayground({ tools, serverId, connectionConfig }: McpToolPlaygroundProps) {
  const [selectedTool, setSelectedTool] = useState<string>(tools[0]?.name ?? "");
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [complexValues, setComplexValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTool = useMemo(
    () => tools.find((t) => t.name === selectedTool),
    [tools, selectedTool]
  );

  const fields = useMemo(
    () => (currentTool ? parseParamFields(currentTool.inputSchema) : []),
    [currentTool]
  );

  const handleToolChange = useCallback((name: string) => {
    setSelectedTool(name);
    setParamValues({});
    setComplexValues({});
    setResult(null);
    setError(null);
  }, []);

  const setParam = useCallback((name: string, value: unknown) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setComplex = useCallback((name: string, value: string) => {
    setComplexValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedTool) return;
    setRunning(true);
    setResult(null);
    setError(null);

    const args: Record<string, unknown> = { ...paramValues };
    for (const field of fields) {
      if (field.type === "complex") {
        const raw = complexValues[field.name];
        if (raw) {
          try {
            args[field.name] = JSON.parse(raw);
          } catch {
            setError(`Invalid JSON for parameter "${field.name}"`);
            setRunning(false);
            return;
          }
        }
      }
    }

    for (const key of Object.keys(args)) {
      if (args[key] === undefined || args[key] === "") {
        delete args[key];
      }
    }

    try {
      const res = await executeMcpTool(serverId, selectedTool, args, connectionConfig);
      if (res.ok) {
        setResult(JSON.stringify(res.result, null, 2));
      } else {
        setError(res.error ?? "Unknown error");
      }
    } finally {
      setRunning(false);
    }
  }, [selectedTool, paramValues, complexValues, fields, serverId, connectionConfig]);

  if (tools.length === 0) return null;

  return (
    <div className="flex h-full">
      {/* Tool list sidebar */}
      <div className="flex w-48 shrink-0 flex-col border-r">
        <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
          <div className="p-1">
            {tools.map((t) => (
              <button
                key={t.name}
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-1.5 text-sm text-left hover:bg-accent",
                  selectedTool === t.name && "bg-muted font-medium"
                )}
                onClick={() => handleToolChange(t.name)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right: params + result */}
      <div className="flex flex-1 flex-col min-w-0">
        {currentTool ? (
          <>
            <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
              <div className="p-4 space-y-3">
                {/* Description */}
                {currentTool.description && (
                  <p className="text-xs text-muted-foreground">{currentTool.description}</p>
                )}

                {/* Parameters */}
                {fields.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Parameters</Label>
                    {fields.map((field) => (
                      <ParamInput
                        key={`${selectedTool}-${field.name}`}
                        field={field}
                        value={field.type === "complex" ? complexValues[field.name] : paramValues[field.name]}
                        onChange={(v) => {
                          if (field.type === "complex") {
                            setComplex(field.name, v as string);
                          } else {
                            setParam(field.name, v);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Result */}
                {result !== null && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Result</Label>
                    <div className="mt-1">
                      <JsonEditor value={result} readOnly height="300px" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Bottom bar: Run button */}
            <div className="flex items-center gap-2 border-t px-4 py-2">
              <Button size="sm" onClick={handleRun} disabled={running || !selectedTool}>
                {running ? (
                  <Spinner className="mr-1 size-3" />
                ) : (
                  <PlayIcon className="mr-1 size-3" />
                )}
                {running ? "Running..." : "Run"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Select a tool from the list.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Param Input ----------

interface ParamInputProps {
  field: ParamField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ParamInput({ field, value, onChange }: ParamInputProps) {
  const label = `${field.name}${field.required ? " *" : ""}`;
  const hint = field.description;

  switch (field.type) {
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch
            size="sm"
            checked={!!value}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <span className="text-xs">{label}</span>
          {hint && <span className="text-xs text-muted-foreground">— {hint}</span>}
        </div>
      );

    case "enum":
      return (
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs">{label}</span>
            {hint && <span className="text-xs text-muted-foreground">— {hint}</span>}
          </div>
          <Select value={(value as string) ?? ""} onValueChange={onChange}>
            <SelectTrigger size="sm" className="mt-1">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.enumValues!.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "number":
      return (
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs">{label}</span>
            {hint && <span className="text-xs text-muted-foreground">— {hint}</span>}
          </div>
          <Input
            type="number"
            className="mt-1"
            value={value === undefined ? "" : String(value)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
          />
        </div>
      );

    case "complex":
      return (
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs">{label}</span>
            <span className="text-xs text-muted-foreground">(JSON)</span>
            {hint && <span className="text-xs text-muted-foreground">— {hint}</span>}
          </div>
          <div className="mt-1">
            <JsonEditor
              value={(value as string) ?? ""}
              onChange={(v) => onChange(v)}
              height="120px"
            />
          </div>
        </div>
      );

    default: // string
      return (
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs">{label}</span>
            {hint && <span className="text-xs text-muted-foreground">— {hint}</span>}
          </div>
          <Input
            className="mt-1"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}
