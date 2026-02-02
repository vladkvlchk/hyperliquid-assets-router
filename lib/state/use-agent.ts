"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getStoredAgent,
  clearAgent,
  approveNewAgent,
  type StoredAgent,
} from "@/lib/exchange/agent";

export function useAgent(userAddress: string | undefined) {
  const [agent, setAgent] = useState<StoredAgent | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Load stored agent on mount / address change
  useEffect(() => {
    if (!userAddress) {
      setAgent(null);
      return;
    }
    setAgent(getStoredAgent(userAddress));
  }, [userAddress]);

  const approve = useCallback(async () => {
    if (!userAddress) return;
    setIsApproving(true);
    setApproveError(null);
    try {
      const stored = await approveNewAgent(userAddress);
      setAgent(stored);
    } catch (e) {
      console.error("[agent] approval error:", e);
      setApproveError(e instanceof Error ? e.message : "Agent approval failed");
    } finally {
      setIsApproving(false);
    }
  }, [userAddress]);

  const revoke = useCallback(() => {
    if (!userAddress) return;
    clearAgent(userAddress);
    setAgent(null);
  }, [userAddress]);

  return { agent, isApproving, approveError, approve, revoke };
}
