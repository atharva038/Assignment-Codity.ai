/**
 * ============================================================================
 * Queue Sharding & Consistent Hashing Utilities — Distributed Job Scheduler
 * ============================================================================
 * Implements deterministic partition routing and consistent hashing for
 * distributing jobs across partitioned queues and dedicated worker fleets.
 *
 * VIVA EXPLANATION:
 * 1. FNV-1a Hashing: Computes a fast, uniform 32-bit integer hash from any
 *    shard key (e.g. `userId`, `tenantId`, `customerId`, or `orderId`).
 * 2. Deterministic Routing: Ensures all jobs associated with the same key
 *    consistently route to the exact same queue partition/shard.
 * 3. Worker Fleet Isolation: Allows dedicating specific worker pools to individual
 *    queue shards, preventing high-volume noisy tenants from starving others.
 */

/**
 * Computes a 32-bit FNV-1a hash of a given string key.
 * FNV-1a provides excellent dispersion and low collision rates for sharding.
 *
 * @param key The input string key (e.g. tenant ID, user UUID)
 * @returns 32-bit positive unsigned integer hash
 */
export function fnv1aHash(key: string): number {
  let hash = 0x811c9dc5; // 32-bit FNV offset basis
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    // 32-bit FNV prime multiplication: hash = (hash * 16777619) & 0xffffffff
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Calculates a zero-based shard index from a shard key and total shard count.
 *
 * @param shardKey Partition identifier (e.g., "org_enterprise_123", "user_456")
 * @param totalShards Total number of available shards (must be >= 1)
 * @returns Shard index in range [0, totalShards - 1]
 */
export function calculateShardIndex(shardKey: string, totalShards: number): number {
  if (totalShards <= 1) {
    return 0;
  }
  const hash = fnv1aHash(shardKey);
  return hash % totalShards;
}

/**
 * Deterministically routes a job to a specific queue ID from an array of shard queues.
 *
 * @param shardKey Unique partition key (e.g., tenantId, customerId)
 * @param shardQueueIds Array of available queue IDs representing the shards
 * @returns The selected queue ID
 */
export function routeToQueueShard(shardKey: string, shardQueueIds: string[]): string {
  if (!shardQueueIds || shardQueueIds.length === 0) {
    throw new Error('Cannot route to queue shard: shardQueueIds array is empty');
  }
  if (shardQueueIds.length === 1) {
    return shardQueueIds[0];
  }
  const index = calculateShardIndex(shardKey, shardQueueIds.length);
  return shardQueueIds[index];
}
