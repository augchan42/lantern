import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCampaignSession } from "./useCampaignSession";

beforeEach(() => window.localStorage.clear());

describe("useCampaignSession", () => {
  it("starts empty and persists ids to localStorage", () => {
    const { result } = renderHook(() => useCampaignSession());
    expect(result.current.campaignId).toBeNull();

    act(() => result.current.setCampaignId("c1"));
    act(() => result.current.setSessionId("s1"));

    expect(result.current.campaignId).toBe("c1");
    expect(window.localStorage.getItem("lantern.campaignId")).toBe("c1");
    expect(window.localStorage.getItem("lantern.sessionId")).toBe("s1");
  });

  it("clear() forgets the session but keeps the campaign", () => {
    const { result } = renderHook(() => useCampaignSession());
    act(() => result.current.setCampaignId("c1"));
    act(() => result.current.setSessionId("s1"));
    act(() => result.current.clearSession());
    expect(result.current.sessionId).toBeNull();
    expect(result.current.campaignId).toBe("c1");
  });
});
