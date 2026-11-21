import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../src/server/apiApp';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
