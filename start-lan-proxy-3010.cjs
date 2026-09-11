const http = require("node:http");

const listenHost = "0.0.0.0";
const listenPort = 3010;
const targetHost = "localhost";
const targetPort = 3006;

const server = http.createServer((clientReq, clientRes) => {
  const options = {
    hostname: targetHost,
    port: targetPort,
    method: clientReq.method,
    path: clientReq.url,
    headers: {
      ...clientReq.headers,
      host: `${targetHost}:${targetPort}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on("error", (error) => {
    clientRes.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    clientRes.end(`LAN proxy failed: ${error.message}`);
  });

  clientReq.pipe(proxyReq);
});

server.listen(listenPort, listenHost, () => {
  console.log(`LAN proxy: http://${listenHost}:${listenPort} -> http://${targetHost}:${targetPort}`);
});
