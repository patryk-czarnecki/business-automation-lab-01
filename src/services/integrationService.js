export const sendOrderToExternalSystem = async (order) => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    accepted: true,
    externalReference: `EXT-${order.externalId}`,
  };
};
