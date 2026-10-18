export function getSiteUrl(
  configured = process.env.NEXT_PUBLIC_SITE_URL,
  production = process.env.NODE_ENV === "production",
) {
  const value = configured?.trim();
  if (!value) {
    if (production) throw new Error("NEXT_PUBLIC_SITE_URL must be set in production");
    return "http://localhost:3000";
  }

  const hasProtocol = /^https?:\/\//i.test(value);
  const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(value);
  const url = new URL(hasProtocol ? value : `${localHost ? "http" : "https"}://${value}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS");
  if (production && url.protocol !== "https:" && !localHost) throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production");
  return url.origin;
}