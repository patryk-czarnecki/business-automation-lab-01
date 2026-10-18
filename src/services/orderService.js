import prisma from "../lib/prisma.js";

export const createOrder = async (orderData) => {
  const amountCents = Math.round(orderData.amount * 100);

  return prisma.order.create({
    data: {
      externalId: orderData.externalId,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      amountCents,
      currency: orderData.currency,
    },
  });
};
