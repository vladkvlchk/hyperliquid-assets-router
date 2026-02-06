import { encode } from "@msgpack/msgpack";
import { keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { OrderAction, CancelAction } from "@/lib/domain/types";

type L1Action = OrderAction | CancelAction;

/**
 * Minimal EIP-1193 provider interface — used by agent.ts for wallet signing.
 */
export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/**
 * Hyperliquid L1 action signing via the phantom agent pattern.
 *
 * Algorithm (from the official Python SDK):
 * 1. msgpack-encode the action object
 * 2. Append: nonce (8 bytes big-endian) + vault flag (0x00 = no vault)
 * 3. keccak256 the combined bytes → connectionId
 * 4. EIP-712 sign an "Agent" struct with { source: "a", connectionId }
 *    Domain: { name: "Exchange", version: "1", chainId: 1337, verifyingContract: 0x0 }
 *
 * Signing uses the agent's private key directly (privateKeyToAccount) —
 * no wallet popup, no chainId validation from MetaMask/Privy.
 */

const EXCHANGE_DOMAIN = {
  name: "Exchange" as const,
  version: "1" as const,
  chainId: 1337,
  verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
};

const AGENT_TYPES = {
  Agent: [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ],
} as const;

/**
 * Format a number to the Hyperliquid wire format:
 * up to 8 decimal places, trailing zeros stripped, "-0" → "0".
 */
export function floatToWire(n: number): string {
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

/**
 * Compute the action hash used as the phantom agent's connectionId.
 */
function actionHash(action: L1Action, nonce: number): `0x${string}` {
  const encoded = encode(action);

  // nonce as 8 bytes big-endian
  const nonceBytes = new Uint8Array(8);
  const view = new DataView(nonceBytes.buffer);
  view.setBigUint64(0, BigInt(nonce));

  // vault flag: 0x00 = no vault
  const vaultFlag = new Uint8Array([0]);

  // Concatenate: msgpack(action) + nonce + vaultFlag
  const combined = new Uint8Array(
    encoded.length + nonceBytes.length + vaultFlag.length,
  );
  combined.set(encoded, 0);
  combined.set(nonceBytes, encoded.length);
  combined.set(vaultFlag, encoded.length + nonceBytes.length);

  return keccak256(combined);
}

/**
 * Sign an L1 action using the agent's private key.
 * Pure local signing — no wallet interaction, no chainId validation.
 */
export async function signL1Action(
  action: L1Action,
  nonce: number,
  agentPrivateKey: Hex,
): Promise<`0x${string}`> {
  const connectionId = actionHash(action, nonce);
  const account = privateKeyToAccount(agentPrivateKey);

  return account.signTypedData({
    domain: EXCHANGE_DOMAIN,
    types: AGENT_TYPES,
    primaryType: "Agent",
    message: {
      source: "a", // "a" = mainnet, "b" = testnet
      connectionId,
    },
  });
}
