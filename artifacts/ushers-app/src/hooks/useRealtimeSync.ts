
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource(`${BASE_URL}/api/sync`, {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      console.log("[SSE] Connected to Realtime Sync");
    };

    eventSource.onmessage = (event) => {
      if (event.data === "connected") return;

      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Event received:", data);

        if (data.type === "EVENT_UPDATED" || data.type === "ASSIGNMENT_CREATED") {
          queryClient.invalidateQueries({ queryKey: ["/events"] });
          queryClient.invalidateQueries({ queryKey: ["/ushers/me/assignments"] });
        }
      } catch (err) {
        console.error("[SSE] Failed to parse event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
    };

    return () => {
      console.log("[SSE] Disconnecting");
      eventSource.close();
    };
  }, [queryClient]);
}
