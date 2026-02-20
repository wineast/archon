import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return parseCsv(file);
  }
  if (ext === "xlsx" || ext === "xls") {
    return parseExcel(file);
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields ?? [];
        const rows = results.data as Record<string, unknown>[];
        resolve({ headers, rows });
      },
      error(err) {
        reject(err);
      },
    });
  });
}

function parseExcel(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve({ headers: [], rows: [] });
          return;
        }
        const sheet = workbook.Sheets[sheetName]!;
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const headers =
          json.length > 0 ? Object.keys(json[0]!) : [];
        resolve({ headers, rows: json });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Infer basic column types from a set of rows.
 */
export function inferColumnTypes(
  headers: string[],
  rows: Record<string, unknown>[]
): Record<string, "string" | "number" | "boolean"> {
  const result: Record<string, "string" | "number" | "boolean"> = {};
  for (const header of headers) {
    const values = rows
      .map((r) => r[header])
      .filter((v) => v != null && v !== "");

    if (values.length === 0) {
      result[header] = "string";
      continue;
    }

    const allNumber = values.every((v) => !isNaN(Number(v)));
    if (allNumber) {
      result[header] = "number";
      continue;
    }

    const allBool = values.every((v) => {
      const s = String(v).toLowerCase();
      return s === "true" || s === "false" || s === "0" || s === "1";
    });
    if (allBool) {
      result[header] = "boolean";
      continue;
    }

    result[header] = "string";
  }
  return result;
}
