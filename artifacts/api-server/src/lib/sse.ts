import { Response } from "express";
import { EventEmitter } from "events";

class SSEManager extends EventEmitter {
  private clients: Set<Response> = new Set();

  addClient(res: Response) {
    this.clients.add(res);
    res.on("close", () => {
      this.clients.delete(res);
    });
  }

  broadcast(event: string, data: any) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(message);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }
}

export const sseManager = new SSEManager();
