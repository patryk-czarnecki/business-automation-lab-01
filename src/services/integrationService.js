export class IntegrationError extends Error {
  constructor(message, retryable = false) {
    super(message);
    this.name = "IntegrationError";
    this.retryable = retryable;
  }
}

const failedOnceOrders = new Set();

export const sendOrderToExternalSystem = async (order) => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (order.externalId.endsWith("-FAIL")) {
    throw new IntegrationError("External system rejected order", false);
  }

  if (
    order.externalId.endsWith("-RETRY") &&
    !failedOnceOrders.has(order.externalId)
  ) {
    failedOnceOrders.add(order.externalId);

    throw new IntegrationError("Temporary external system failure", true);
  }

  return {
    accepted: true,
    externalReference: `EXT-${order.externalId}`,
  };
};
