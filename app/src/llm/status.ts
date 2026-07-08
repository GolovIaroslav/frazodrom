// PLAN.md §8.8 — model chip: which model would serve the next LLM call, and
// its status (available / daily-limit / no-key / unreachable).

import type { Role } from './types';
import { resolveChain, resolveProviderById } from './registry';
import { getBudgetCeilings, getRoutingConfig } from './settings';
import { hasBudget } from './budget';

export type ChipStatus = 'available' | 'limited' | 'noKey' | 'unreachable' | 'none';

export interface ChipInfo {
  id: string;
  label: string;
  status: ChipStatus;
}

/** Per-candidate status for a role's whole routing chain (popover list, §8.8). */
export async function getChainStatus(role: Role): Promise<ChipInfo[]> {
  const routing = await getRoutingConfig();
  const ceilings = await getBudgetCeilings();
  const ids = routing[role];
  const infos: ChipInfo[] = [];

  for (const id of ids) {
    const provider = await resolveProviderById(id);
    if (!provider) {
      infos.push({ id, label: id, status: 'unreachable' });
      continue;
    }
    const configured = await provider.isConfigured();
    if (!configured) {
      infos.push({ id: provider.id, label: provider.label, status: 'noKey' });
      continue;
    }
    const budgetOk = await hasBudget(provider.id, role, ceilings[role]);
    infos.push({
      id: provider.id,
      label: provider.label,
      status: budgetOk ? 'available' : 'limited',
    });
  }
  return infos;
}

/** The model that will actually be used for the next call — first "available" in the chain. */
export async function getActiveModel(role: Role): Promise<ChipInfo> {
  const chain = await getChainStatus(role);
  const active = chain.find((c) => c.status === 'available');
  return active ?? { id: '', label: '', status: chain.length === 0 ? 'none' : 'limited' };
}

/** True if any candidate in the chain is a resolvable, configured provider. */
export async function hasAnyConfiguredProvider(role: Role): Promise<boolean> {
  const providers = await resolveChain((await getRoutingConfig())[role]);
  for (const p of providers) {
    if (await p.isConfigured()) return true;
  }
  return false;
}
