import type { ApiRequest } from "../types";

export interface ImportedCollectionResult {
  requests: ApiRequest[];
  detectedFormat: "postman" | "openapi";
  suggestedBaseUrl?: string;
}

const VALID_HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function makeSafeId(prefix: string, idx: number): string {
  const clean = prefix
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("_")
    .slice(0, 28);
  return `${clean || "req"}_${idx}_${Date.now().toString(36).slice(-4)}`;
}

/**
 * Importa colecciones desde un JSON de Postman (v2.0/v2.1) o especificación OpenAPI 3.x / Swagger 2.0.
 */
export function parseCollectionJson(rawJson: string): ImportedCollectionResult {
  let doc: Record<string, any>;
  try {
    doc = JSON.parse(rawJson);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`El contenido no es un JSON válido: ${detail}`);
  }

  if (doc && (Array.isArray(doc.item) || doc.info?.schema)) {
    return parsePostmanCollection(doc);
  }

  if (doc && (doc.openapi || doc.swagger || doc.paths)) {
    return parseOpenApiSpec(doc);
  }

  throw new Error(
    "Formato JSON no reconocido. Asegúrate de pegar o seleccionar una colección de Postman (v2.1) o un archivo OpenAPI / Swagger JSON."
  );
}

function normalizeMethod(rawMethod: unknown): ApiRequest["method"] {
  const upper = typeof rawMethod === "string" ? rawMethod.toUpperCase() : "GET";
  return VALID_HTTP_METHODS.has(upper)
    ? (upper as ApiRequest["method"])
    : "GET";
}

function extractPostmanUrlAndQuery(urlField: any): {
  url: string;
  query_params: Record<string, string>;
} {
  const query_params: Record<string, string> = {};
  if (typeof urlField === "string") {
    return { url: urlField, query_params };
  }
  if (!urlField || typeof urlField !== "object") {
    return { url: "", query_params };
  }
  const url = typeof urlField.raw === "string" ? urlField.raw : "";
  if (Array.isArray(urlField.query)) {
    for (const q of urlField.query) {
      if (!q?.disabled && q?.key) {
        query_params[String(q.key)] = String(q.value ?? "");
      }
    }
  }
  return { url, query_params };
}

function extractPostmanHeaders(reqObj: any): Record<string, string> {
  const headers: Record<string, string> = {};
  if (Array.isArray(reqObj?.header)) {
    for (const h of reqObj.header) {
      if (!h?.disabled && h?.key) {
        headers[String(h.key)] = String(h.value ?? "");
      }
    }
  }
  if (reqObj?.auth?.type === "bearer" && Array.isArray(reqObj.auth.bearer)) {
    const tokEntry = reqObj.auth.bearer.find((b: any) => b?.key === "token");
    if (tokEntry?.value && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${tokEntry.value}`;
    }
  }
  return headers;
}

function extractPostmanBody(bodyObj: any): {
  content_type: "none" | "json" | "text";
  payload: string;
} {
  if (bodyObj?.mode !== "raw" || !bodyObj?.raw) {
    return { content_type: "none", payload: "" };
  }
  const payload = String(bodyObj.raw);
  try {
    JSON.parse(payload);
    return { content_type: "json", payload };
  } catch {
    return { content_type: "text", payload };
  }
}

function resolveSubFolderName(currentFolder: string, itemName?: string): string {
  if (!itemName) return currentFolder;
  return currentFolder ? `${currentFolder} - ${itemName}` : itemName;
}

function convertPostmanRequestItem(
  item: any,
  folder: string,
  index: number
): ApiRequest {
  const reqObj = typeof item.request === "object" ? item.request : {};
  const method = normalizeMethod(reqObj.method);
  const { url, query_params } = extractPostmanUrlAndQuery(reqObj.url);
  const headers = extractPostmanHeaders(reqObj);
  const body = extractPostmanBody(reqObj.body);
  const name = item.name || `${method} Request ${index}`;

  return {
    id: makeSafeId(name, index),
    name,
    folder,
    method,
    url: url || "{{base_url}}/",
    headers,
    query_params,
    body,
  };
}

function parsePostmanCollection(doc: Record<string, any>): ImportedCollectionResult {
  const requests: ApiRequest[] = [];
  let counter = 1;
  const rootFolder = doc.info?.name || "Postman";

  function traverseItems(items: any[], currentFolder: string): void {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (Array.isArray(item?.item)) {
        traverseItems(
          item.item,
          resolveSubFolderName(currentFolder, item.name)
        );
      } else if (item?.request) {
        requests.push(
          convertPostmanRequestItem(item, currentFolder || rootFolder, counter++)
        );
      }
    }
  }

  traverseItems(doc.item || [], rootFolder);

  const baseVar = Array.isArray(doc.variable)
    ? doc.variable.find(
        (v: any) =>
          v?.key === "base_url" || v?.key === "baseUrl" || v?.key === "url"
      )
    : undefined;

  return {
    requests,
    detectedFormat: "postman",
    suggestedBaseUrl: baseVar?.value ? String(baseVar.value) : undefined,
  };
}

function resolveOpenApiBaseUrl(doc: Record<string, any>): string {
  if (Array.isArray(doc.servers) && doc.servers[0]?.url) {
    return String(doc.servers[0].url).replace(/\/$/, "");
  }
  if (doc.host) {
    const scheme =
      Array.isArray(doc.schemes) && doc.schemes[0] ? doc.schemes[0] : "https";
    const basePath = doc.basePath ? String(doc.basePath).replace(/\/$/, "") : "";
    return `${scheme}://${doc.host}${basePath}`;
  }
  return "https://api.ejemplo.com";
}

function extractOpenApiParams(
  pathParams: any,
  opParams: any
): { headers: Record<string, string>; query_params: Record<string, string> } {
  const headers: Record<string, string> = { Accept: "application/json" };
  const query_params: Record<string, string> = {};
  const combined = [
    ...(Array.isArray(pathParams) ? pathParams : []),
    ...(Array.isArray(opParams) ? opParams : []),
  ];

  for (const p of combined) {
    if (!p?.name) continue;
    const sampleVal = String(p.example ?? p.schema?.default ?? "");
    if (p.in === "query") {
      query_params[String(p.name)] = sampleVal;
    } else if (p.in === "header") {
      headers[String(p.name)] = sampleVal;
    }
  }
  return { headers, query_params };
}

function sampleValueForSchemaProperty(propVal: any): unknown {
  if (propVal?.example !== undefined) return propVal.example;
  if (propVal?.type === "number" || propVal?.type === "integer") return 0;
  if (propVal?.type === "boolean") return false;
  return "string";
}

function extractOpenApiJsonBody(op: any): {
  content_type: "none" | "json";
  payload: string;
} {
  const jsonMedia = op?.requestBody?.content?.["application/json"];
  if (!jsonMedia) {
    return { content_type: "none", payload: "" };
  }
  if (jsonMedia.example) {
    return {
      content_type: "json",
      payload: JSON.stringify(jsonMedia.example, null, 2),
    };
  }
  if (jsonMedia.schema?.properties) {
    const sampleObj: Record<string, unknown> = {};
    for (const [propKey, propVal] of Object.entries<any>(
      jsonMedia.schema.properties
    )) {
      sampleObj[propKey] = sampleValueForSchemaProperty(propVal);
    }
    return {
      content_type: "json",
      payload: JSON.stringify(sampleObj, null, 2),
    };
  }
  return { content_type: "json", payload: "{\n  \n}" };
}

function parseOpenApiSpec(doc: Record<string, any>): ImportedCollectionResult {
  const requests: ApiRequest[] = [];
  let counter = 1;
  const suggestedBaseUrl = resolveOpenApiBaseUrl(doc);
  const defaultFolder = doc.info?.title || "OpenAPI";
  const paths = doc.paths || {};
  const supportedMethods = ["get", "post", "put", "patch", "delete"] as const;

  for (const [pathStr, pathItem] of Object.entries<any>(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const m of supportedMethods) {
      const op = pathItem[m];
      if (!op || typeof op !== "object") continue;

      const method = m.toUpperCase() as ApiRequest["method"];
      const folder =
        Array.isArray(op.tags) && op.tags[0]
          ? String(op.tags[0])
          : defaultFolder;
      const name = op.summary || op.operationId || `${method} ${pathStr}`;
      const { headers, query_params } = extractOpenApiParams(
        pathItem.parameters,
        op.parameters
      );
      const body = extractOpenApiJsonBody(op);
      if (body.content_type === "json") {
        headers["Content-Type"] = "application/json";
      }

      requests.push({
        id: makeSafeId(name, counter++),
        name,
        folder,
        method,
        url: `{{base_url}}${pathStr}`,
        headers,
        query_params,
        body,
      });
    }
  }

  return {
    requests,
    detectedFormat: "openapi",
    suggestedBaseUrl,
  };
}
