import type { FiberBrowserNode } from '@fiber-pay/sdk/browser';

const channelCapacity = 50_000_000_000n;

export const channelFundingGuidance =
  'Fund this address with more than 500 Testnet CKB. Opening the channel uses 500 CKB plus a separate on-chain transaction fee.';

export async function readTestnetBalance(node: FiberBrowserNode): Promise<bigint> {
  const { default_funding_lock_script: script } = await node.nodeInfo();
  const response = await fetch('https://testnet.ckb.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'get_cells_capacity',
      params: [{ script, script_type: 'lock' }],
    }),
  });
  if (!response.ok) throw new Error('Balance service unavailable. Please retry.');
  const body = await response.json();
  if (body.error || typeof body.result?.capacity !== 'string') throw new Error('Could not read Testnet balance. Please retry.');
  return BigInt(body.result.capacity);
}

export async function requireNewChannelFunding(node: FiberBrowserNode) {
  if ((await readTestnetBalance(node)) <= channelCapacity) throw new Error(channelFundingGuidance);
}
