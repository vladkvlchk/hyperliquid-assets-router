import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { arbitrum } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: {
    [arbitrum.id]: http(),
  },
});
