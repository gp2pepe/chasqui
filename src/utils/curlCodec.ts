import type { ApiRequest } from "../types";

const escapeSingleQuotes = (str: string): string =>
  str.replaceAll("'", String.raw`'\''`);

function buildUrlWithQueryParams(req: ApiRequest): string {
  const entries = Object.entries(req.query_params || {}).filter(([k]) =>
    k.trim()
  );
  if (entries.length === 0) return req.url;
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return req.url.includes("?") ? `${req.url}&${qs}` : `${req.url}?${qs}`;
}

function resolveRequestHeaders(req: ApiRequest): Record<string, string> {
  const headers = { ...req.headers };
  const hasJsonBody =
    req.body?.content_type === "json" &&
    Boolean(req.body.payload.trim()) &&
    req.method !== "GET";
  const hasContentType = Object.keys(headers).some(
    (k) => k.toLowerCase() === "content-type"
  );
  if (hasJsonBody && !hasContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function hasActiveBody(req: ApiRequest): boolean {
  return Boolean(
    req.body &&
      req.body.content_type !== "none" &&
      req.body.payload.trim() &&
      req.method !== "GET"
  );
}

export function generateCurlCommand(req: ApiRequest): string {
  const fullUrl = buildUrlWithQueryParams(req);
  const lines: string[] = [
    `curl -X ${req.method} '${escapeSingleQuotes(fullUrl)}'`,
  ];

  const headers = resolveRequestHeaders(req);
  for (const [k, v] of Object.entries(headers)) {
    if (k.trim()) {
      const headerPair = `${k.trim()}: ${v}`;
      lines.push(`  -H '${escapeSingleQuotes(headerPair)}'`);
    }
  }

  if (hasActiveBody(req) && req.body) {
    lines.push(`  --data-raw '${escapeSingleQuotes(req.body.payload)}'`);
  }

  return lines.join(" \\\n");
}

export function generateFetchSnippet(req: ApiRequest): string {
  const fullUrl = buildUrlWithQueryParams(req);
  const headers = resolveRequestHeaders(req);
  const bodyPart = hasActiveBody(req)
    ? `\n  body: ${JSON.stringify(req.body?.payload)},`
    : "";
  const formattedHeaders = JSON.stringify(headers, null, 4).replaceAll(
    "\n",
    "\n  "
  );

  return `const response = await fetch(${JSON.stringify(fullUrl)}, {
  method: ${JSON.stringify(req.method)},
  headers: ${formattedHeaders},${bodyPart}
});

const data = await response.text();
console.log(response.status, data);`;
}

export function generatePythonRequestsSnippet(req: ApiRequest): string {
  const fullUrl = buildUrlWithQueryParams(req);
  const headers = resolveRequestHeaders(req);
  const includeBody = hasActiveBody(req);
  const payloadDecl = includeBody
    ? `payload = ${JSON.stringify(req.body?.payload)}\n`
    : "";
  const dataArg = includeBody ? ",\n    data=payload" : "";

  return `import requests

url = ${JSON.stringify(fullUrl)}
headers = ${JSON.stringify(headers, null, 4)}
${payloadDecl}response = requests.request(
    ${JSON.stringify(req.method)},
    url,
    headers=headers${dataArg}
)

print(response.status_code)
print(response.text)`;
}

export function generateGoHttpSnippet(req: ApiRequest): string {
  const fullUrl = buildUrlWithQueryParams(req);
  const includeBody = hasActiveBody(req);

  const headerLines = Object.entries(req.headers)
    .filter(([k]) => k.trim())
    .map(
      ([k, v]) => `\treq.Header.Set(${JSON.stringify(k)}, ${JSON.stringify(v)})`
    )
    .join("\n");

  const stringsImport = includeBody ? '\n\t"strings"' : "";
  const reqCreation = includeBody
    ? `\tpayload := strings.NewReader(${JSON.stringify(req.body?.payload)})\n\treq, _ := http.NewRequest(${JSON.stringify(req.method)}, url, payload)`
    : `\treq, _ := http.NewRequest(${JSON.stringify(req.method)}, url, nil)`;
  const headerBlock = headerLines ? `${headerLines}\n` : "";

  return `package main

import (
\t"fmt"
\t"io"
\t"net/http"${stringsImport}
)

func main() {
\turl := ${JSON.stringify(fullUrl)}
${reqCreation}
${headerBlock}\tres, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()
\tbody, _ := io.ReadAll(res.Body)
\tfmt.Println(res.Status)
\tfmt.Println(string(body))
}`;
}

function tokenizeShellCommand(input: string): string[] {
  const cleaned = input.replaceAll(/\\\r?\n/g, " ").trim();
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (quote !== null) {
      if (ch === "\\" && quote === '"' && i + 1 < cleaned.length) {
        current += cleaned[++i];
      } else if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function parseHeaderToken(
  rawHeader: string,
  headers: Record<string, string>
): void {
  const colonIdx = rawHeader.indexOf(":");
  if (colonIdx > 0) {
    const hk = rawHeader.slice(0, colonIdx).trim();
    const hv = rawHeader.slice(colonIdx + 1).trim();
    headers[hk] = hv;
  }
}

function detectBodyContentType(payload: string): "none" | "json" | "text" {
  if (!payload) return "none";
  try {
    JSON.parse(payload);
    return "json";
  } catch {
    return "text";
  }
}

function formatImportedName(method: string, url: string): string {
  try {
    const u = new URL(url);
    return `${method} ${u.pathname}`;
  } catch {
    return `Importado cURL (${method})`;
  }
}

const DATA_FLAGS = new Set([
  "-d",
  "--data",
  "--data-raw",
  "--data-binary",
  "--json",
]);
const VALID_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Convierte un comando cURL pegado por el usuario en un objeto ApiRequest.
 */
export function parseCurlCommand(curlInput: string): ApiRequest {
  const tokens = tokenizeShellCommand(curlInput);

  let method: ApiRequest["method"] = "GET";
  let explicitMethod = false;
  let url = "";
  const headers: Record<string, string> = {};
  let bodyPayload = "";

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const nextTok = tokens[i + 1];

    if (tok === "curl") continue;

    if ((tok === "-X" || tok === "--request") && nextTok !== undefined) {
      const upper = nextTok.toUpperCase();
      if (VALID_METHODS.has(upper)) {
        method = upper as ApiRequest["method"];
        explicitMethod = true;
      }
      i++;
    } else if ((tok === "-H" || tok === "--header") && nextTok !== undefined) {
      parseHeaderToken(nextTok, headers);
      i++;
    } else if (DATA_FLAGS.has(tok) && nextTok !== undefined) {
      bodyPayload = nextTok;
      if (tok === "--json" && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      if (!explicitMethod) {
        method = "POST";
      }
      i++;
    } else if ((tok === "-u" || tok === "--user") && nextTok !== undefined) {
      headers["Authorization"] = `Basic ${btoa(nextTok)}`;
      i++;
    } else if (tok === "--url" && nextTok !== undefined) {
      url = nextTok;
      i++;
    } else if (!tok.startsWith("-") && !url) {
      url = tok;
    }
  }

  return {
    id: `curl_${Date.now().toString(36)}`,
    name: formatImportedName(method, url),
    folder: "Importados",
    method,
    url: url || "https://httpbin.org/get",
    headers,
    query_params: {},
    body: {
      content_type: detectBodyContentType(bodyPayload),
      payload: bodyPayload,
    },
  };
}
