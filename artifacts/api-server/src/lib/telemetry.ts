import { SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { logger } from "./logger";
import { recordObservabilityEvent } from "./observability";

let sdk: NodeSDK | null = null;
let initialized = false;

export async function initializeTelemetry(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? process.env.HIGHLIGHT_OTLP_ENDPOINT;
  if (!endpoint) {
    logger.info("OpenTelemetry exporter disabled; using local observability fallback");
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: normalizeTraceEndpoint(endpoint),
    headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
  });

  sdk = new NodeSDK({
    traceExporter,
    serviceName: process.env.OTEL_SERVICE_NAME ?? "operation-kobenhavn-api",
  });
  sdk.start();
  logger.info({ endpoint: redactUrl(endpoint) }, "OpenTelemetry exporter started");
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  operation: (span: Span) => Promise<T> | T,
): Promise<T> {
  const tracer = trace.getTracer("operation-kobenhavn");
  return tracer.startActiveSpan(name, { attributes: sanitizeAttributes(attributes) }, async span => {
    const startedAt = performance.now();
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      recordObservabilityEvent({
        source: "system",
        level: "info",
        type: name,
        message: `${name} completed`,
        data: {
          durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
          attributes: sanitizeAttributes(attributes),
        },
      });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      recordObservabilityEvent({
        source: "system",
        level: "error",
        type: name,
        message: `${name} failed`,
        data: {
          durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
          error: error instanceof Error ? error.message : String(error),
          attributes: sanitizeAttributes(attributes),
        },
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function sanitizeAttributes(attributes: Attributes): Attributes {
  const sanitized: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isSensitiveKey(key)) continue;
    if (typeof value === "string") sanitized[key] = redactString(value);
    else sanitized[key] = value;
  }
  return sanitized;
}

function normalizeTraceEndpoint(endpoint: string): string {
  const trimmed = endpoint.replace(/\/+$/, "");
  return trimmed.endsWith("/v1/traces") ? trimmed : `${trimmed}/v1/traces`;
}

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const headers: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (key && value) headers[key] = value;
  }
  return headers;
}

function isSensitiveKey(key: string): boolean {
  return /(authorization|cookie|token|secret|password|api[-_.]?key|\.env|monaco\.secret)/i.test(key);
}

function redactString(value: string): string {
  if (/^(bearer\s+|sk-|pk_|eyJ[A-Za-z0-9_-]+\.)/i.test(value)) return "[REDACTED]";
  if (value.length > 2_000) return `${value.slice(0, 2_000)}…`;
  return value;
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    return url.toString();
  } catch {
    return "[configured]";
  }
}
