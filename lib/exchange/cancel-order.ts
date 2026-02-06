import { CancelAction, CancelResult } from "@/lib/domain/types";
import { submitCancel } from "@/lib/api/hyperliquid";
import { signL1Action } from "./signing";
import type { Hex } from "viem";

export interface CancelParams {
  assetId: number;
  orderId: number;
  agentPrivateKey: Hex;
}

/**
 * Cancel an open order on Hyperliquid.
 */
export async function cancelOrder(params: CancelParams): Promise<CancelResult> {
  const { assetId, orderId, agentPrivateKey } = params;

  const action: CancelAction = {
    type: "cancel",
    cancels: [{ a: assetId, o: orderId }],
  };

  const nonce = Date.now();
  const signature = await signL1Action(action, nonce, agentPrivateKey);

  return submitCancel(action, nonce, signature);
}
