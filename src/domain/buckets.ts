// Derivált kosarak a decisions-ből. NEM perzisztált forrás.
// A members SORRENDJE = az items (queue) sorrendje → determinisztikus
// besorolási sorrend és a thumbnail forrása (members[0]).
// Lásd: docs/superpowers/specs/2026-06-17-keprendezo-design.md.

import { DELETE_BUCKET } from './types'
import type { MediaItem, Decision, Bucket, BucketKey } from './types'

export function deriveBuckets(
  items: MediaItem[],
  decisions: Record<string, Decision>,
): Record<BucketKey, Bucket> {
  const buckets: Record<BucketKey, Bucket> = {}

  for (const it of items) {
    const decision = decisions[it.fileName]
    if (!decision) continue

    const key = decision.bucket
    let bucket = buckets[key]
    if (!bucket) {
      bucket = {
        key,
        kind: key === DELETE_BUCKET ? 'delete' : 'normal',
        members: [],
        thumbnail: null,
      }
      buckets[key] = bucket
    }
    bucket.members.push(it.fileName)
    bucket.thumbnail = bucket.members[0]
  }

  return buckets
}
