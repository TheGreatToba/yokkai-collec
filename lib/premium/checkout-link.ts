export function stripePaymentDestination(
  value: unknown,
  kind: "checkout" | "portal"
) {
  if (typeof value !== "string")
    throw new Error("Invalid payment destination.");
  const destination = new URL(value);
  const origin =
    kind === "checkout"
      ? "https://checkout.stripe.com"
      : "https://billing.stripe.com";
  if (
    destination.origin !== origin ||
    destination.username ||
    destination.password
  )
    throw new Error("Invalid payment destination.");
  return destination.href;
}
