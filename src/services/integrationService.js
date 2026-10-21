export const sendOrderToExternalSystem = async (order) => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (order.externalId.endsWith("-FAIL")) {
    throw new Error("External system rejected order");
  }

  return {
    accepted: true,
    externalReference: `EXT-${order.externalId}`,
  };
};
