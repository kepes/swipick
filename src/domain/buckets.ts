// Derived buckets from decisions. NOT a persisted source.
// The ORDER of members = the items (queue) order → deterministic
// classification order and the source of the thumbnail (members[0]).
// See: docs/superpowers/specs/2026-06-17-swipick-design.md.

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
