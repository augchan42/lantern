"use client";
import { useCallback, useEffect, useState } from "react";

const CAMPAIGN_KEY = "lantern.campaignId";
const SESSION_KEY = "lantern.sessionId";

export function useCampaignSession() {
  const [campaignId, setCampaignIdState] = useState<string | null>(null);
  const [sessionId, setSessionIdState] = useState<string | null>(null);

  // Hydrate from localStorage on mount (client-only).
  useEffect(() => {
    setCampaignIdState(window.localStorage.getItem(CAMPAIGN_KEY));
    setSessionIdState(window.localStorage.getItem(SESSION_KEY));
  }, []);

  const setCampaignId = useCallback((id: string | null) => {
    setCampaignIdState(id);
    if (id) window.localStorage.setItem(CAMPAIGN_KEY, id);
    else window.localStorage.removeItem(CAMPAIGN_KEY);
  }, []);

  const setSessionId = useCallback((id: string | null) => {
    setSessionIdState(id);
    if (id) window.localStorage.setItem(SESSION_KEY, id);
    else window.localStorage.removeItem(SESSION_KEY);
  }, []);

  const clearSession = useCallback(() => setSessionId(null), [setSessionId]);

  return { campaignId, sessionId, setCampaignId, setSessionId, clearSession };
}
