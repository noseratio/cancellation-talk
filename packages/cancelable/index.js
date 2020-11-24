export const prex = globalThis.prex;

/**
 * A cancellable promise.
 * @extends Promise
 */
export class CancellablePromise extends Promise {
  static get [Symbol.species]() { return Promise; }

  constructor(executor, token) {
    const withCancellation = async () => {
      // create a new linked token source 
      const linkedSource = new prex.CancellationTokenSource(token?.canBeCanceled? [token]: []);
      try {
        const linkedToken = linkedSource.token;
        const deferred = new prex.Deferred();
  
        linkedToken.register(() => deferred.reject(new prex.CancelError()));
  
        executor({ 
          resolve: value => deferred.resolve(value),
          reject: error => deferred.reject(error),
          token: linkedToken
        });

        await deferred.promise;
      } 
      finally {
        // this will also free all linkedToken registrations,
        // so the executor doesn't have to worry about it
        linkedSource.close();
      }
    };

    super((resolve, reject) => withCancellation().then(resolve, reject));
  }
}

/**
 * A cancellable Delay.
 * @extends Promise
 */
export class Delay extends CancellablePromise {
  static get [Symbol.species]() { return Promise; }

  constructor(delayMs, token) {
    const start = performance.now();
    super(({ resolve, token }) => {
      const id = setTimeout(() => resolve(performance.now() - start), delayMs);
      token.register(() => clearTimeout(id));
    }, token);
  }
}

/**
 * Ignores cancellation error, rethrows otherwise
 * @example
 * // promise.catch(cancelProof);
 */
export function cancelProof(e) {
  if (e instanceof prex.CancelError) {
    return;
  }
  throw e;
} 
