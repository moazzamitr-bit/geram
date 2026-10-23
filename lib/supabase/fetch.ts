/** Fetch that fails instead of hanging when GoTrue or PostgREST never answers. */
export function fetchWithTimeout(ms: number): typeof fetch {
  return (input, init) => {
    const signal = init?.signal ?? AbortSignal.timeout(ms);
    return fetch(input, { ...init, signal });
  };
}
