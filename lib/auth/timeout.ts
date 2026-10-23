/** Reject if `promise` is still pending after `ms`. Does not cancel the underlying work. */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label = "timeout"): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
