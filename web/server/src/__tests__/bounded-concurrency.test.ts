import { describe, expect, it } from 'vitest';

import { mapWithBoundedConcurrencyPreservingOrder } from '../services/bounded-concurrency.js';

describe('bounded concurrency', () => {
  it('runs reads concurrently within the configured bound and preserves input order', async () => {
    const items = Array.from({ length: 12 }, (_, index) => index + 1);
    let active = 0;
    let maxActive = 0;
    const completionOrder: number[] = [];

    const results = await mapWithBoundedConcurrencyPreservingOrder(
      items,
      3,
      async item => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, (4 - (item % 4)) * 2));
        completionOrder.push(item);
        active -= 1;
        return `result-${item}`;
      },
    );

    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(completionOrder).not.toEqual(items);
    expect(results).toEqual(items.map(item => `result-${item}`));
  });

  it('rejects a non-positive concurrency instead of silently skipping work', async () => {
    await expect(mapWithBoundedConcurrencyPreservingOrder([1], 0, async item => item))
      .rejects.toThrow('concurrency must be a positive integer');
  });

  it('fails the whole ordered read when any worker rejects', async () => {
    await expect(mapWithBoundedConcurrencyPreservingOrder(
      ['readable-1', 'broken', 'readable-2'],
      2,
      async item => {
        if (item === 'broken') throw new Error('metadata read failed');
        return item;
      },
    )).rejects.toThrow('metadata read failed');
  });
});
