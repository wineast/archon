"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BuiltinComponentDef } from "./builtin-components";

interface BuiltinComponentDetailProps {
  definition: BuiltinComponentDef;
}

export function BuiltinComponentDetail({
  definition,
}: BuiltinComponentDetailProps) {
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{definition.name}</h2>
          <p className="text-sm text-muted-foreground">
            {definition.description}
          </p>
        </div>

        {definition.props && definition.props.length > 0 && (
          <div className="rounded-lg border">
            <div className="border-b px-4 py-2">
              <h3 className="text-sm font-medium">Props</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Prop</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[100px]">Default</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definition.props.map((prop) => (
                  <TableRow key={prop.name}>
                    <TableCell className="font-mono text-xs font-medium">
                      {prop.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px] whitespace-nowrap">
                        {prop.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {prop.default ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {prop.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {definition.examples.map((example) => (
          <div key={example.name} className="rounded-lg border">
            <div className="border-b px-4 py-2">
              <h3 className="text-sm font-medium">{example.name}</h3>
            </div>
            <div className="p-4">{example.render()}</div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
