import * as cancellable from 'cancellable';

export const INFINITE = -1;
export const cancelProof = cancellable.cancelProof;
export const CancelError = cancellable.prex.CancelError;
export const CancellationTokenSource = cancellable.prex.CancellationTokenSource;
export const CancellationToken = cancellable.prex.CancellationToken;
export const Semaphore = cancellable.prex.Semaphore;
export const Deferred = cancellable.prex.Deferred;

/**
 * Creates a Deferred
 */
export function createDeferred() {
  let resolve, reject;
  const promise = new Promise((...args) => [resolve, reject] = args);
  return Object.freeze({
    resolve, 
    reject,
    cancel: () => reject(new CancelError()), 
    promise, then: promise.then.bind(promise)
  });
}

/**
 * Wraps a callback as async func with error handling
 * @param {Number} timeoutMs - a timeout 
 * @param {Object} token - a cancellation token 
 */
export async function delay(timeoutMs, token) {
  if (!token?.canBeCanceled) {
    if (timeoutMs === INFINITE) return new Promise();
    return new Promise(resolve => setTimeout(resolve, timeoutMs));
  }

  const deferred = createDeferred();
  const rego = token.register(deferred.cancel);
  try {
    const id = timeoutMs !== INFINITE? 
      setTimeout(() => deferred.resolve(), timeoutMs):
      null;
    try {
      return await deferred.promise;
    } 
    finally {
      id && clearTimeout(id);
    }
  } 
  finally {
    rego.unregister();
  }
}

/**
 * Wraps a callback as async func with error handling
 * @param {Object} token - a cancellation token 
 */
export async function expectAnimationFrame(token) {
  if (!token?.canBeCanceled) {
    return await new Promise(resolve => window.requestAnimationFrame(resolve));
  }
  
  const deferred = createDeferred();
  const rego = token.register(deferred.cancel);
  try {
    const id = window.requestAnimationFrame(v => deferred.resolve(v));
    try {
      await deferred.promise;
    } 
    finally {
      window.cancelAnimationFrame(id);
    }
  } 
  finally {
    rego.unregister();
  }
}

/**
 * Maintain a minimum time interval between  
 * consequent "delay" calls 
 */
export class Interval
{
    #now;

    constructor()
    {
      this.reset();
    }

    reset()
    {
      this.#now = performance.now();
    }

    elapsed() {
      return performance.now() - this.#now;
    }

    async delay(intervalMs, token)
    {
        let lapse = intervalMs - this.elapsed();
        if (lapse > 0)
        {
            await delay(lapse, token);
        }
        this.reset();
        token?.throwIfCancellationRequested();
    }
}


/**
 * Wraps a callback as async func with error handling
 * @param {Function} func - a callback to wrap 
 */
export function asAsync(func) {
  return async () => {
    try {
      await func();
    }
    catch(e) {
      console.error(e);
      alert(e.message);
    }
  };
}

/**
 * Stream events
 */
export async function* allEvents(eventTarget, eventName, token) {
  const queue = [];

  let resolve, reject;
  const thenable = { then: (...args) => [resolve, reject] = args };

  const eventHandler = event => {
    queue.push(event);
    resolve?.();
    resolve = null;
  }

  const rego = token.register(() => reject?.(new CancelError()));
  try {
    eventTarget.addEventListener(eventName, eventHandler);
    try {
      while (true) {
        while (queue.length) {
          token.throwIfCancellationRequested();
          yield queue.shift();
        }
        await thenable;
      }
    }
    finally {
      eventTarget.removeEventListener(eventName, eventHandler);
    }
  }
  finally {
    rego.unregister();
  }
} 


/**
 * Wait for an event
 */
export function once(eventTarget, eventName) {
  return new Promise(resolve => 
    eventTarget.addEventListener(eventName, resolve, { once: true }));
} 

