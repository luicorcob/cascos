import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadCommerceOrdersForBusiness(context, business) {
  const businessId = clean(business?.id);
  const businessSlug = clean(business?.slug);

  if (!context?.root || (!businessId && !businessSlug)) {
    return [];
  }

  const configuredPath = clean(process.env.STORE_DB_PATH);
  const storePath = configuredPath
    ? (path.isAbsolute(configuredPath) ? configuredPath : path.resolve(context.root, configuredPath))
    : path.join(context.root, "data", "store-db.json");

  try {
    const payload = JSON.parse(await readFile(storePath, "utf8"));
    const orders = Array.isArray(payload?.orders) ? payload.orders : [];

    return orders.filter((order) => {
      const orderBusinessId = clean(order?.businessId);
      const orderBusinessSlug = clean(order?.businessSlug);

      return Boolean(
        (businessId && orderBusinessId === businessId)
        || (businessSlug && orderBusinessSlug === businessSlug)
      );
    });
  } catch {
    return [];
  }
}

export function mergeTimelineOrders(existingOrders, commerceOrders) {
  const merged = [];
  const seen = new Set();

  [existingOrders, commerceOrders]
    .filter(Array.isArray)
    .forEach((orders) => {
      orders.forEach((order) => {
        const key = clean(order?.id || order?.orderNumber || order?.reference);

        if (key && seen.has(key)) {
          return;
        }

        if (key) {
          seen.add(key);
        }

        merged.push(order);
      });
    });

  return merged;
}

function clean(value) {
  return String(value ?? "").trim();
}
