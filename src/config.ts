export const config = {
  port: parseInt(process.env.PORT || "3340", 10),
  host: process.env.HOST || "0.0.0.0",
  adminKey: process.env.ADMIN_KEY || "",
  rateLimit: {
    windowMs: 60_000,
    maxRequests: parseInt(process.env.RATE_LIMIT || "60", 10),
  },
};
