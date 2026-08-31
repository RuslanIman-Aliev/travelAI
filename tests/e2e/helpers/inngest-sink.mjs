import { createServer } from "node:http";

/**
 * A stand-in for the Inngest dev server, used only by the e2e run.
 *
 * Trip creation enqueues its background job on the server now, so a browser-side
 * `page.route` stub can no longer intercept it - the request never leaves Node.
 * Pointing `INNGEST_DEV` at this process lets the real code path run end to end:
 * the action really sends the event, the trip really lands in `generating`, and
 * the page really polls the database for it.
 *
 * It deliberately does not execute anything. Running a live Gemini call would
 * make the suite slow, costly and non-deterministic, which is the opposite of
 * what an e2e check is for.
 */
const PORT = Number(process.env.INNGEST_SINK_PORT ?? 8288);
const HOST = "127.0.0.1";

const received = [];

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, received: received.length }));
    return;
  }

  // `POST /e/<event-key>` is how the SDK sends events in dev mode.
  if (request.method === "POST" && url.pathname.startsWith("/e/")) {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      let events = [];
      try {
        const parsed = JSON.parse(body || "[]");
        events = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        events = [];
      }

      received.push(...events);

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ids: events.map(
            (event, index) => event?.id ?? `sink-${received.length}-${index}`,
          ),
          status: 200,
        }),
      );
    });
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`[inngest-sink] listening on http://${HOST}:${PORT}`);
});
