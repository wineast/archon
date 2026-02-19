/**
 * Proxy ontology operations to external APIs.
 * externalConfig shape:
 * {
 *   baseUrl: string;
 *   authType?: "bearer";
 *   authToken?: string;
 *   endpoints?: {
 *     query?: string;   // GET  baseUrl + query
 *     get?: string;     // GET  baseUrl + get/:id
 *     create?: string;  // POST baseUrl + create
 *     update?: string;  // PUT  baseUrl + update/:id
 *     delete?: string;  // DEL  baseUrl + delete/:id
 *   }
 * }
 */
export async function proxyToExternal(
  config: Record<string, unknown>,
  operation: "query" | "get" | "create" | "update" | "delete",
  params: Record<string, unknown>
): Promise<unknown> {
  const baseUrl = config.baseUrl as string | undefined;
  if (!baseUrl) throw new Error("externalConfig.baseUrl is required");

  const endpoints = (config.endpoints ?? {}) as Record<string, string>;
  const path = endpoints[operation] ?? `/${operation}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.authType === "bearer" && config.authToken) {
    headers["Authorization"] = `Bearer ${config.authToken as string}`;
  }

  let url = `${baseUrl.replace(/\/$/, "")}${path}`;
  let method: string;
  let body: string | undefined;

  switch (operation) {
    case "query": {
      method = "GET";
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) url += `?${qsStr}`;
      break;
    }
    case "get": {
      method = "GET";
      if (params.id) url += `/${params.id}`;
      break;
    }
    case "create": {
      method = "POST";
      body = JSON.stringify(params);
      break;
    }
    case "update": {
      method = "PUT";
      const { id, ...data } = params;
      if (id) url += `/${id}`;
      body = JSON.stringify(data);
      break;
    }
    case "delete": {
      method = "DELETE";
      if (params.id) url += `/${params.id}`;
      break;
    }
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  const res = await fetch(url, { method, headers, body });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`External API error ${res.status}: ${text}`);
  }

  return res.json();
}
