import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";
const STORAGE_KEY = "hl-agent";

/* ── Agent key management (localStorage) ── */

export interface StoredAgent {
  privateKey: Hex;
  address: string;
}

export function getStoredAgent(userAddress: string): StoredAgent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userAddress.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAgent;
  } catch {
    return null;
  }
}

function storeAgent(userAddress: string, agent: StoredAgent): void {
  localStorage.setItem(
    `${STORAGE_KEY}:${userAddress.toLowerCase()}`,
    JSON.stringify(agent),
  );
}

export function clearAgent(userAddress: string): void {
  localStorage.removeItem(`${STORAGE_KEY}:${userAddress.toLowerCase()}`);
}

/* ── approveAgent flow ── */

function getRawWalletProvider(): any {
  const win = window as any;
  if (Array.isArray(win.ethereum?.providers)) {
    const mm = win.ethereum.providers.find((p: any) => p.isMetaMask && !p.isPrivy);
    if (mm) return mm;
    const nonPrivy = win.ethereum.providers.find((p: any) => !p.isPrivy);
    if (nonPrivy) return nonPrivy;
  }
  if (win.ethereum?.providerMap) {
    const mm = win.ethereum.providerMap.get("MetaMask");
    if (mm) return mm;
  }
  return win.ethereum;
}

function splitSig(sig: string) {
  const raw = sig.startsWith("0x") ? sig.slice(2) : sig;
  return {
    r: "0x" + raw.slice(0, 64),
    s: "0x" + raw.slice(64, 128),
    v: parseInt(raw.slice(128, 130), 16),
  };
}

// Arbitrum mainnet chainId — matches the connected chain, no chain switch needed.
const SIGNATURE_CHAIN_ID = "0xa4b1"; // 42161

export async function approveNewAgent(
  userAddress: string,
): Promise<StoredAgent> {
  const agentPrivateKey = generatePrivateKey();
  const agentAccount = privateKeyToAccount(agentPrivateKey);
  const agentAddress = agentAccount.address.toLowerCase() as `0x${string}`;

  const nonce = Date.now();

  // Action sent to the API — agentName: null for unnamed agent
  const action = {
    type: "approveAgent",
    hyperliquidChain: "Mainnet",
    signatureChainId: SIGNATURE_CHAIN_ID,
    agentAddress,
    agentName: null as string | null,
    nonce,
  };

  // EIP-712 typed data — agentName: "" in the signed message (per nktkas SDK)
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      "HyperliquidTransaction:ApproveAgent": [
        { name: "hyperliquidChain", type: "string" },
        { name: "agentAddress", type: "address" },
        { name: "agentName", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    },
    domain: {
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: parseInt(SIGNATURE_CHAIN_ID),
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    primaryType: "HyperliquidTransaction:ApproveAgent",
    message: {
      hyperliquidChain: "Mainnet",
      agentAddress,
      agentName: "",
      nonce,
    },
  };

  // Sign via raw provider (bypasses Privy's viem wrapper)
  const rawProvider = getRawWalletProvider();
  const signature = (await rawProvider.request({
    method: "eth_signTypedData_v4",
    params: [userAddress.toLowerCase(), JSON.stringify(typedData)],
  })) as string;

  // Submit
  const res = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      nonce,
      signature: splitSig(signature),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Approve agent failed: HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.status !== "ok") {
    throw new Error(
      `Approve agent failed: ${JSON.stringify(data.response ?? data)}`,
    );
  }

  const agent: StoredAgent = { privateKey: agentPrivateKey, address: agentAddress };
  storeAgent(userAddress, agent);
  return agent;
}
