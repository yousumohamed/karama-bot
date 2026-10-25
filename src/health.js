import http from 'node:http';
import { PORT } from './config.js';

/**
 * Small web server so Render sees an open port, and so uptime monitors
 * (Render health checks, cron-job.org) can ping GET /health.
 * Returns 200 while the bot is connected to Discord, 503 otherwise.
 */
export function startHealthServer(client) {
  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/health') {
      const ready = client.isReady();
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(
        JSON.stringify({
          status: ready ? 'ok' : 'starting',
          bot: ready ? client.user.tag : null,
          servers: ready ? client.guilds.cache.size : 0,
          ping: ready ? client.ws.ping : null,
          uptime: Math.round(process.uptime()),
        }),
      );
      return;
    }

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('karaama-bot is running. See /health');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  // If the port is taken (another app on your PC), try the next few instead of crashing.
  let port = PORT;
  server.on('error', (err) => {
    if (err.code !== 'EADDRINUSE' || port >= PORT + 10) {
      console.warn(`[health] web server not started: ${err.message}`);
      return;
    }
    console.warn(`[health] port ${port} is in use, trying ${port + 1}`);
    server.listen(++port);
  });
  server.on('listening', () => console.log(`🌐 Health check on http://localhost:${port}/health`));
  server.listen(port);
  return server;
}
