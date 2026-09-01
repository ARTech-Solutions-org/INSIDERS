import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { sseManager } from "../lib/sse.js";

const router = Router();

router.get("/sync", requireAuth, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  
  // Initial ping to establish connection
  res.write("data: connected\n\n");
  
  sseManager.addClient(res);
});

export default router;
