import prisma from "../lib/prisma.js";
import {
  sendOrderToExternalSystem,
  IntegrationError,
} from "./integrationService.js";

import { calculateNextRetryAt } from "./retryPolicy.js";

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

export const processOrder = async (id, { scheduled = false } = {}) => {
  const order = await prisma.order.findUnique({
    where: {
      id,
    },
  });

  if (!order) {
    return {
      outcome: "not_found",
    };
  }

  const processableStatuses = scheduled ? ["FAILED"] : ["RECEIVED", "FAILED"];

  if (!processableStatuses.includes(order.status)) {
    return {
      outcome: "invalid_status",
      order,
    };
  }

  const claim = await prisma.$transaction(async (tx) => {
    const claimResult = await tx.order.updateMany({
      where: {
        id,
        status: {
          in: processableStatuses,
        },
        ...(scheduled && {
          nextRetryAt: {
            lte: new Date(),
          },
        }),
      },
      data: {
        status: "PROCESSING",
      },
    });

    if (claimResult.count !== 1) {
      return null;
    }

    const attempt = await tx.integrationAttempt.create({
      data: {
        orderId: id,
        status: "STARTED",
      },
    });

    const processingOrder = await tx.order.findUniqueOrThrow({
      where: {
        id,
      },
    });

    return {
      processingOrder,
      attempt,
    };
  });

  if (!claim) {
    const currentOrder = await prisma.order.findUnique({
      where: {
        id,
      },
    });

    if (!currentOrder) {
      return {
        outcome: "not_found",
      };
    }

    return {
      outcome: "invalid_status",
      order: currentOrder,
    };
  }

  const { processingOrder, attempt } = claim;

  let integrationResult;

  try {
    integrationResult = await sendOrderToExternalSystem(processingOrder);
  } catch (error) {
    const failedOrder = await prisma.$transaction(async (tx) => {
      const attemptNumber = await tx.integrationAttempt.count({
        where: {
          orderId: id,
        },
      });

      const canRetry = error instanceof IntegrationError && error.retryable;

      const nextRetryAt = canRetry ? calculateNextRetryAt(attemptNumber) : null;

      await tx.integrationAttempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown integration error",
          finishedAt: new Date(),
        },
      });

      return tx.order.update({
        where: {
          id,
        },
        data: {
          status: "FAILED",
          nextRetryAt,
        },
      });
    });

    return {
      outcome: "failed",
      order: failedOrder,
    };
  }

  const [, completedOrder] = await prisma.$transaction([
    prisma.integrationAttempt.update({
      where: {
        id: attempt.id,
      },
      data: {
        status: "SUCCEEDED",
        externalReference: integrationResult.externalReference,
        finishedAt: new Date(),
      },
    }),

    prisma.order.update({
      where: {
        id,
      },
      data: {
        status: "COMPLETED",
        nextRetryAt: null,
      },
    }),
  ]);

  return {
    outcome: "completed",
    order: completedOrder,
    integration: integrationResult,
  };
};
