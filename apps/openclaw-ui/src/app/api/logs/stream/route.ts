import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const encoder = new TextEncoder();

function event(data: unknown) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function readLastLines(filePath: string, maxLines = 120) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return text.split(/\r?\n/).filter(Boolean).slice(-maxLines);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const openclawDir = process.env.OPENCLAW_DIR ?? "/root/.openclaw";
  const logPath = path.join(openclawDir, "logs", "gateway.log");

  let offset = 0;
  let interval: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", close);

      const initialLines = readLastLines(logPath, 120);
      initialLines.forEach((line) => controller.enqueue(event({ line, ts: new Date().toISOString() })));
      if (!fs.existsSync(logPath)) {
        controller.enqueue(
          event({
            line: `Log file not found: ${logPath}`,
            ts: new Date().toISOString(),
          }),
        );
      } else {
        offset = fs.statSync(logPath).size;
      }

      interval = setInterval(() => {
        if (closed) return;
        try {
          if (!fs.existsSync(logPath)) return;
          const stats = fs.statSync(logPath);
          if (stats.size < offset) {
            // rotated/truncated
            offset = 0;
          }
          if (stats.size === offset) return;

          const length = stats.size - offset;
          const fd = fs.openSync(logPath, "r");
          const buffer = Buffer.alloc(Math.max(length, 0));
          fs.readSync(fd, buffer, 0, length, offset);
          fs.closeSync(fd);

          offset = stats.size;

          buffer
            .toString("utf8")
            .split(/\r?\n/)
            .filter(Boolean)
            .forEach((line) => {
              controller.enqueue(event({ line, ts: new Date().toISOString() }));
            });
        } catch (error) {
          controller.enqueue(
            event({
              line: `Log stream error: ${error instanceof Error ? error.message : "unknown"}`,
              ts: new Date().toISOString(),
            }),
          );
        }
      }, 1000);
    },
    cancel() {
      if (interval) clearInterval(interval);
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
