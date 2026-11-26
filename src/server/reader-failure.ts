/** Fixed categories only: never persist an upstream message or recording content. */
export type ReaderFailureCode='provider_busy'|'provider_refused'|'provider_stream'|'stream_incomplete'|'response_limit'|'invalid_response'|'reading_limit'|'missing_summary'|'reading_timeout'|'reading_failed';
export class ReaderFailure extends Error {constructor(public code:ReaderFailureCode){super(code)}}
