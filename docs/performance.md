# Processing performance

The approved screens, provider models, quotas and one-at-a-time processing
order remain unchanged. This pass reduces unnecessary work:

- An incoming shared recording opens type selection without loading a second
  document. People and recording data load together; Connections is not on
  that path. Initial access data is reused instead of fetched again.
- Foreground progress polling permits one outstanding request. Hidden tabs
  pause. Active recordings refresh each second; completed recordings refresh
  every 15 seconds and immediately on returning to the page.
- The notification badge reads a count rather than the entire recording list.
- Seven query indexes support queued work, pending uploads, recording/person
  suggestions, open tasks and person notes. An invented multi-notebook fixture
  verifies each query plan and identical results before/after migration.
- Content-hashed public assets can stay in the browser cache for a year.
  HTML, notebook APIs and unversioned files remain `no-store`. The Sprite
  proxy already compresses assets; no additional compression dependency was
  introduced.
- Connector discovery is validated and deduplicated in memory for five
  minutes. Errors are not cached; authorization/not-found responses invalidate
  the cache without replaying a potentially billable request.
- Successful transcription is persisted before waiting for provider cleanup.
  Cleanup overlaps reading, but the queue waits for it before the next job or
  graceful shutdown. Failed transcription still waits for cleanup. A hard
  process kill retains the existing provider-cleanup limitation.
- The tool schema advertises the two-line summary constraint. Independent
  lookups/proposals can share a response. An explicit final tool avoids a
  separate acknowledgement request, but only after the whole response ends
  successfully. Quote, person, date and approval checks remain authoritative.

## Evidence and limits

`tests/phone/frontend-performance.spec.ts` and `shared-return.spec.ts` gate
network responses to prove that upload data is no longer blocked by unrelated
requests and that the return uses one document/access request. The previous
build failed these assertions. A 2.2-second progress response no longer starts
three overlapping reads.

`npx tsx --test tests/reader-performance.test.ts` compares a scripted Dana
case: three model requests with the old acknowledgement versus two with the
completion tool; the same accepted context shrinks from 667 to 486 bytes.
This is a fake-response benchmark, not measured provider latency.

`tests/gateway-performance.test.ts` proves concurrent discovery deduplication,
expiry/invalidation and that reading can start while provider deletion is
held. It also proves the next queued recording and shutdown still wait for
cleanup. No automated check sends a tester's recording to a provider.

## Read timings without reading recordings

Run on the existing Sprite from `/home/sprite/kai`:

```sh
npx tsx scripts/processing-stats.ts
```

The command opens the database read-only and reports aggregate counts and
median timings for the latest 20 instrumented recordings. It prints no IDs,
recording content, personal addresses, credentials or absolute timestamps.
It calls no provider. A null median means there is no eligible measurement.

Timings begin with the new build; old recordings cannot be reconstructed.
Queue time starts after recording type is confirmed, rather than while a
person is choosing. Listening and reading measure cumulative work across
automatic retries. First suggestion and ready measure from processing request
and subtract any wait for speaker identification. Ready is recorded before
provider cleanup finishes; finished includes that cleanup. Automatic restart
or timeout is retained as a fixed category and count. An explicit manual retry
starts a fresh measurement while retaining the original receipt timestamp.

These counters live with the recording and are deleted with it. The normal
notebook APIs and MCP do not expose them. Real-provider improvement must be
measured from new, explicitly submitted recordings; fewer scripted requests
alone does not establish a live speedup.
An abrupt process kill can lose an in-flight stage duration; the restart
category remains available on the next attempt.
