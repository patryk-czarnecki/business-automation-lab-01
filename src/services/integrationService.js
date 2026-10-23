const failedOnceOrders = new Set();

export const sendOrderToExternalSystem = async (order) => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (order.externalId.endsWith("-FAIL")) {
    throw new Error("External system rejected order");
  }

  if (
    order.externalId.endsWith("-RETRY") &&
    !failedOnceOrders.has(order.externalId)
  ) {
    failedOnceOrders.add(order.externalId);
    throw new Error("Temporary external system failure");
  }

  return {
    accepted: true,
    externalReference: `EXT-${order.externalId}`,
  };
};
