import prisma from "../lib/prisma.js";

const isSameOrder = (existingOrder, orderData, amountCents) => {
  return (
    existingOrder.customerName === orderData.customerName &&
    existingOrder.customerEmail === orderData.customerEmail &&
    existingOrder.amountCents === amountCents &&
    existingOrder.currency === orderData.currency
  );
};

export const createOrder = async (orderData) => {
  const amountCents = Math.round(orderData.amount * 100);

  try {
    const order = await prisma.order.create({
      data: {
        externalId: orderData.externalId,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        amountCents,
        currency: orderData.currency,
      },
    });

    return {
      outcome: "created",
      order,
    };
  } catch (error) {
    if (error?.code !== "P2002") {
      throw error;
    }

    const existingOrder = await prisma.order.findUnique({
      where: {
        externalId: orderData.externalId,
      },
    });

    if (!existingOrder) {
      throw error;
    }

    if (isSameOrder(existingOrder, orderData, amountCents)) {
      return {
        outcome: "existing",
        order: existingOrder,
      };
    }

    return {
      outcome: "conflict",
      order: existingOrder,
    };
  }
};

export const getOrders = async () => {
  return prisma.order.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getOrderById = async (id) => {
  return prisma.order.findUnique({
    where: {
      id,
    },
  });
};
