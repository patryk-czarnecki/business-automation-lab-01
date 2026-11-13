const retryDelaysMs = [30_000, 120_000];

export const MAX_ATTEMPTS = retryDelaysMs.length + 1;

export const calculateNextRetryAt = (attemptNumber, now = new Date()) => {
  const delay = retryDelaysMs[attemptNumber - 1];

  if (delay === undefined) {
    return null;
  }

  return new Date(now.getTime() + delay);
};
