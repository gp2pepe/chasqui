use crate::models::{ApiRequest, HttpExecutionResult, LoadSample, LoadTestResult, RequestBody};
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    Method, Version,
};
use std::collections::BTreeMap;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Semaphore;

/// Interpola variables de entorno `{{var}}` y secretos `{{secret:KEY}}` en memoria.
/// Retorna error si se solicita un `{{secret:KEY}}` que no existe o si el Vault está bloqueado.
pub fn interpolate_template(
    input: &str,
    env_vars: &BTreeMap<String, String>,
    secrets: &BTreeMap<String, String>,
    vault_unlocked: bool,
) -> Result<String, String> {
    let mut result = String::with_capacity(input.len());
    let mut rest = input;

    while let Some(start) = rest.find("{{") {
        result.push_str(&rest[..start]);
        let after_start = &rest[start + 2..];
        if let Some(end) = after_start.find("}}") {
            let token = after_start[..end].trim();
            if let Some(secret_name) = token.strip_prefix("secret:") {
                let clean_key = secret_name.trim();
                if !vault_unlocked {
                    return Err(format!(
                        "La petición usa {{{{secret:{clean_key}}}}}, pero el Vault de secretos está bloqueado."
                    ));
                }
                let secret_val = secrets.get(clean_key).ok_or_else(|| {
                    format!(
                        "No se encontró el secreto '{clean_key}' en el Vault (secrets/vault.enc.toml)."
                    )
                })?;
                result.push_str(secret_val);
            } else if let Some(env_val) = env_vars.get(token) {
                result.push_str(env_val);
            } else {
                // Si no existe la variable de entorno, se deja el placeholder visible
                result.push_str(&format!("{{{{{token}}}}}"));
            }
            rest = &after_start[end + 2..];
        } else {
            result.push_str(&rest[start..]);
            rest = "";
        }
    }
    result.push_str(rest);
    Ok(result)
}

/// Resuelve las variables de entorno en un ApiRequest y, solo si `reveal_secrets == true`,
/// interpola también los secretos del Vault (para exportar a cURL o snippets de código).
pub fn resolve_request_for_export(
    req: &ApiRequest,
    env_vars: &BTreeMap<String, String>,
    secrets: &BTreeMap<String, String>,
    vault_unlocked: bool,
    reveal_secrets: bool,
) -> Result<ApiRequest, String> {
    let interp = |text: &str| -> Result<String, String> {
        if reveal_secrets {
            interpolate_template(text, env_vars, secrets, vault_unlocked)
        } else {
            // Solo interpolar variables de entorno públicas, dejando {{secret:...}} intacto
            let mut result = String::with_capacity(text.len());
            let mut rest = text;
            while let Some(start) = rest.find("{{") {
                result.push_str(&rest[..start]);
                let after = &rest[start + 2..];
                if let Some(end) = after.find("}}") {
                    let token = after[..end].trim();
                    if !token.starts_with("secret:") {
                        if let Some(val) = env_vars.get(token) {
                            result.push_str(val);
                        } else {
                            result.push_str(&format!("{{{{{token}}}}}"));
                        }
                    } else {
                        result.push_str(&format!("{{{{{token}}}}}"));
                    }
                    rest = &after[end + 2..];
                } else {
                    result.push_str(&rest[start..]);
                    rest = "";
                }
            }
            result.push_str(rest);
            Ok(result)
        }
    };

    let mut resolved_url = interp(&req.url)?;
    if !req.query_params.is_empty() {
        if let Ok(mut parsed) = reqwest::Url::parse(&resolved_url) {
            {
                let mut qp = parsed.query_pairs_mut();
                for (k, v) in &req.query_params {
                    if !k.trim().is_empty() {
                        qp.append_pair(&interp(k)?, &interp(v)?);
                    }
                }
            }
            resolved_url = parsed.to_string();
        }
    }

    let mut headers = BTreeMap::new();
    for (k, v) in &req.headers {
        if !k.trim().is_empty() {
            headers.insert(interp(k)?, interp(v)?);
        }
    }

    let body = if let Some(ref b) = req.body {
        Some(RequestBody {
            content_type: b.content_type.clone(),
            payload: interp(&b.payload)?,
        })
    } else {
        None
    };

    Ok(ApiRequest {
        id: req.id.clone(),
        name: req.name.clone(),
        folder: req.folder.clone(),
        method: req.method.clone(),
        url: resolved_url,
        headers,
        query_params: BTreeMap::new(),
        body,
    })
}

pub async fn send_http_request(
    req: &ApiRequest,
    env_vars: &BTreeMap<String, String>,
    secrets: &BTreeMap<String, String>,
    vault_unlocked: bool,
) -> Result<HttpExecutionResult, String> {
    let resolved_base_url = interpolate_template(&req.url, env_vars, secrets, vault_unlocked)?;

    let mut url = reqwest::Url::parse(&resolved_base_url)
        .map_err(|e| format!("URL inválida ('{resolved_base_url}'): {e}"))?;

    {
        let mut query_pairs = url.query_pairs_mut();
        for (k, v) in &req.query_params {
            if !k.trim().is_empty() {
                let rk = interpolate_template(k, env_vars, secrets, vault_unlocked)?;
                let rv = interpolate_template(v, env_vars, secrets, vault_unlocked)?;
                query_pairs.append_pair(&rk, &rv);
            }
        }
    }

    let method = Method::from_str(&req.method.to_uppercase())
        .map_err(|e| format!("Método HTTP inválido '{}': {e}", req.method))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {e}"))?;

    let mut header_map = HeaderMap::new();
    let mut sent_headers_display = BTreeMap::new();
    for (k, v) in &req.headers {
        if !k.trim().is_empty() {
            let rk = interpolate_template(k, env_vars, secrets, vault_unlocked)?;
            let rv = interpolate_template(v, env_vars, secrets, vault_unlocked)?;
            let h_name = HeaderName::from_str(rk.trim())
                .map_err(|e| format!("Header inválido '{rk}': {e}"))?;
            let h_val = HeaderValue::from_str(&rv)
                .map_err(|e| format!("Valor de header inválido para '{rk}': {e}"))?;
            header_map.insert(h_name, h_val);
            let display_val = if v.contains("{{secret:") {
                format!("{} (resuelto desde Vault)", v)
            } else {
                rv
            };
            sent_headers_display.insert(rk.trim().to_string(), display_val);
        }
    }

    let mut builder = client.request(method.clone(), url.clone()).headers(header_map);

    if let Some(ref body) = req.body {
        if body.content_type != "none" && !body.payload.is_empty() && method != Method::GET {
            let resolved_payload =
                interpolate_template(&body.payload, env_vars, secrets, vault_unlocked)?;
            if body.content_type == "json"
                && !req
                    .headers
                    .keys()
                    .any(|k| k.eq_ignore_ascii_case("content-type"))
            {
                builder = builder.header("Content-Type", "application/json");
                sent_headers_display
                    .insert("Content-Type".to_string(), "application/json".to_string());
            }
            builder = builder.body(resolved_payload);
        }
    }

    let started = Instant::now();
    let response = builder
        .send()
        .await
        .map_err(|e| format!("Error de red ejecutando petición: {e}"))?;
    let duration_ms = started.elapsed().as_millis();

    let status = response.status().as_u16();
    let status_text = response
        .status()
        .canonical_reason()
        .unwrap_or("OK")
        .to_string();

    let http_version = match response.version() {
        Version::HTTP_09 => "HTTP/0.9",
        Version::HTTP_10 => "HTTP/1.0",
        Version::HTTP_11 => "HTTP/1.1",
        Version::HTTP_2 => "HTTP/2.0",
        Version::HTTP_3 => "HTTP/3.0",
        _ => "HTTP/1.1",
    }
    .to_string();

    let remote_addr = response.remote_addr().map(|a| a.to_string());

    let mut resp_headers = BTreeMap::new();
    for (k, v) in response.headers() {
        let key_str = k.as_str().to_string();
        let val_str = v.to_str().unwrap_or("<binary>").to_string();
        if let Some(existing) = resp_headers.get_mut(&key_str) {
            *existing = format!("{existing}, {val_str}");
        } else {
            resp_headers.insert(key_str, val_str);
        }
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Error leyendo respuesta HTTP: {e}"))?;
    let size_bytes = bytes.len();
    let raw_body = String::from_utf8_lossy(&bytes).to_string();

    let formatted_body = if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&raw_body)
    {
        serde_json::to_string_pretty(&json_val).unwrap_or_else(|_| raw_body.clone())
    } else {
        raw_body.clone()
    };

    Ok(HttpExecutionResult {
        status,
        status_text,
        http_version,
        remote_addr,
        duration_ms,
        size_bytes,
        headers: resp_headers,
        request_headers: sent_headers_display,
        body: formatted_body,
        raw_body,
        resolved_url: url.to_string(),
        method: method.to_string(),
    })
}

pub fn compute_load_stats(
    samples: Vec<LoadSample>,
    concurrency: usize,
    total_duration_ms: u128,
) -> LoadTestResult {
    let total_requests = samples.len();
    let success_count = samples.iter().filter(|s| s.ok).count();
    let error_count = total_requests.saturating_sub(success_count);

    let mut durations: Vec<u128> = samples.iter().map(|s| s.duration_ms).collect();
    durations.sort_unstable();

    let min_ms = durations.first().copied().unwrap_or(0);
    let max_ms = durations.last().copied().unwrap_or(0);
    let sum_ms: u128 = durations.iter().sum();
    let avg_ms = if total_requests > 0 {
        (sum_ms as f64) / (total_requests as f64)
    } else {
        0.0
    };

    let p50_ms = if !durations.is_empty() {
        durations[durations.len() / 2]
    } else {
        0
    };

    let p95_ms = if !durations.is_empty() {
        let idx = ((durations.len() as f64 * 0.95).ceil() as usize)
            .saturating_sub(1)
            .min(durations.len() - 1);
        durations[idx]
    } else {
        0
    };

    let rps = if total_duration_ms > 0 {
        (total_requests as f64) / ((total_duration_ms as f64) / 1000.0)
    } else {
        total_requests as f64
    };

    LoadTestResult {
        total_requests,
        concurrency,
        success_count,
        error_count,
        total_duration_ms,
        rps: (rps * 100.0).round() / 100.0,
        min_ms,
        max_ms,
        avg_ms: (avg_ms * 100.0).round() / 100.0,
        p50_ms,
        p95_ms,
        samples,
    }
}

/// Ejecuta N peticiones con concurrencia controlada por semáforo para pruebas de latencia y carga.
pub async fn execute_load_test(
    req: &ApiRequest,
    env_vars: &BTreeMap<String, String>,
    secrets: &BTreeMap<String, String>,
    vault_unlocked: bool,
    total_requests: usize,
    concurrency: usize,
) -> Result<LoadTestResult, String> {
    let capped_total = total_requests.clamp(1, 500);
    let capped_concurrency = concurrency.clamp(1, 50).min(capped_total);

    let resolved_base_url = interpolate_template(&req.url, env_vars, secrets, vault_unlocked)?;
    let mut url = reqwest::Url::parse(&resolved_base_url)
        .map_err(|e| format!("URL inválida ('{resolved_base_url}'): {e}"))?;

    {
        let mut query_pairs = url.query_pairs_mut();
        for (k, v) in &req.query_params {
            if !k.trim().is_empty() {
                let rk = interpolate_template(k, env_vars, secrets, vault_unlocked)?;
                let rv = interpolate_template(v, env_vars, secrets, vault_unlocked)?;
                query_pairs.append_pair(&rk, &rv);
            }
        }
    }

    let method = Method::from_str(&req.method.to_uppercase())
        .map_err(|e| format!("Método HTTP inválido '{}': {e}", req.method))?;

    let mut header_map = HeaderMap::new();
    for (k, v) in &req.headers {
        if !k.trim().is_empty() {
            let rk = interpolate_template(k, env_vars, secrets, vault_unlocked)?;
            let rv = interpolate_template(v, env_vars, secrets, vault_unlocked)?;
            let h_name = HeaderName::from_str(rk.trim())
                .map_err(|e| format!("Header inválido '{rk}': {e}"))?;
            let h_val = HeaderValue::from_str(&rv)
                .map_err(|e| format!("Valor de header inválido para '{rk}': {e}"))?;
            header_map.insert(h_name, h_val);
        }
    }

    let resolved_body = if let Some(ref body) = req.body {
        if body.content_type != "none" && !body.payload.is_empty() && method != Method::GET {
            if body.content_type == "json"
                && !header_map.contains_key("content-type")
            {
                header_map.insert("Content-Type", HeaderValue::from_static("application/json"));
            }
            Some(interpolate_template(
                &body.payload,
                env_vars,
                secrets,
                vault_unlocked,
            )?)
        } else {
            None
        }
    } else {
        None
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .pool_max_idle_per_host(capped_concurrency)
        .build()
        .map_err(|e| format!("Error creando cliente HTTP para Load Test: {e}"))?;

    let semaphore = Arc::new(Semaphore::new(capped_concurrency));
    let batch_started = Instant::now();
    let mut handles = Vec::with_capacity(capped_total);

    for idx in 1..=capped_total {
        let sem = Arc::clone(&semaphore);
        let client_clone = client.clone();
        let method_clone = method.clone();
        let url_clone = url.clone();
        let headers_clone = header_map.clone();
        let body_clone = resolved_body.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire_owned().await.unwrap();
            let req_started = Instant::now();
            let mut builder = client_clone
                .request(method_clone, url_clone)
                .headers(headers_clone);
            if let Some(payload) = body_clone {
                builder = builder.body(payload);
            }

            match builder.send().await {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    let ok = resp.status().is_success();
                    let size_bytes = resp.bytes().await.map(|b| b.len()).unwrap_or(0);
                    let duration_ms = req_started.elapsed().as_millis();
                    LoadSample {
                        index: idx,
                        status,
                        duration_ms,
                        size_bytes,
                        ok,
                        error: if ok {
                            None
                        } else {
                            Some(format!("HTTP {status}"))
                        },
                    }
                }
                Err(err) => {
                    let duration_ms = req_started.elapsed().as_millis();
                    LoadSample {
                        index: idx,
                        status: 0,
                        duration_ms,
                        size_bytes: 0,
                        ok: false,
                        error: Some(err.to_string()),
                    }
                }
            }
        });
        handles.push(handle);
    }

    let mut samples = Vec::with_capacity(capped_total);
    for h in handles {
        if let Ok(sample) = h.await {
            samples.push(sample);
        }
    }
    samples.sort_by_key(|s| s.index);

    let total_duration_ms = batch_started.elapsed().as_millis();
    Ok(compute_load_stats(samples, capped_concurrency, total_duration_ms))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_and_env_interpolation_in_memory() {
        let mut env_vars = BTreeMap::new();
        env_vars.insert("base_url".to_string(), "https://api.example.com".to_string());

        let mut secrets = BTreeMap::new();
        secrets.insert("API_KEY".to_string(), "secret_xyz_123".to_string());

        let template = "{{base_url}}/v1/charge?key={{secret:API_KEY}}";
        let resolved = interpolate_template(template, &env_vars, &secrets, true).unwrap();
        assert_eq!(resolved, "https://api.example.com/v1/charge?key=secret_xyz_123");

        let locked_err = interpolate_template(template, &env_vars, &BTreeMap::new(), false);
        assert!(locked_err.is_err());
    }

    #[test]
    fn test_load_stats_calculation() {
        let samples = vec![
            LoadSample { index: 1, status: 200, duration_ms: 100, size_bytes: 50, ok: true, error: None },
            LoadSample { index: 2, status: 200, duration_ms: 200, size_bytes: 50, ok: true, error: None },
            LoadSample { index: 3, status: 500, duration_ms: 300, size_bytes: 20, ok: false, error: Some("HTTP 500".into()) },
        ];
        let stats = compute_load_stats(samples, 2, 500);
        assert_eq!(stats.total_requests, 3);
        assert_eq!(stats.success_count, 2);
        assert_eq!(stats.error_count, 1);
        assert_eq!(stats.min_ms, 100);
        assert_eq!(stats.max_ms, 300);
        assert_eq!(stats.avg_ms, 200.0);
        assert_eq!(stats.p50_ms, 200);
        assert_eq!(stats.rps, 6.0);
    }
}
