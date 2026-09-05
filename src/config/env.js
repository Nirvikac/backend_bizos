import dotenv from "dotenv";
import dns from "node:dns";

// Prefer IPv4 for outbound connections. Hosts like Render have no IPv6
// route, so defaulting to IPv6 (the OS's "verbatim" order) causes
// `connect ENETUNREACH` errors on every outbound call (Gmail SMTP, etc.).
dns.setDefaultResultOrder("ipv4first");

dotenv.config();
