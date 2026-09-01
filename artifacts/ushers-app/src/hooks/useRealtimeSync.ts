
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  getListEventsQueryKey, 
  getListMyAssignmentsQueryKey, 
  getGetEventQueryKey 
} from '@workspace/api-client-react';

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

    const handleEventUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Event received:", event.type, data);
        
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListMyAssignmentsQueryKey() });
        if (data.id) {
          queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(data.id) });
          queryClient.invalidateQueries({ queryKey: ['events', data.id] }); // used in event-detail.tsx
        }
      } catch (err) {
        console.error("[SSE] Failed to parse event:", err);
      }
    };

    eventSource.addEventListener("EVENT_UPDATED", handleEventUpdate);
    eventSource.addEventListener("ASSIGNMENT_CREATED", handleEventUpdate);
    eventSource.addEventListener("USHER_UPDATED", () => {
       queryClient.invalidateQueries({ queryKey: ['/ushers/me/profile'] });
    });

    eventSource.onmessage = (event) => {
      if (event.data === "connected") return;
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
