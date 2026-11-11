import http from "node:http";
import next from "next";
import { repositoryRoot } from "./setup-json-store.mjs";
// Isolated production server on an ephemeral local port.
let handler;
const server = http.createServer((request, response) => {
  if (handler) return handler(request, response);
  response.writeHead(503); response.end("Starting");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const app = next({ dev: false, dir: repositoryRoot, hostname: "localhost", port });
await app.prepare();
handler = app.getRequestHandler();
process.send?.({ port });
process.on("message", message => {
  if (message === "stop") server.close(() => { app.close().finally(() => process.exit(0)); });
});
