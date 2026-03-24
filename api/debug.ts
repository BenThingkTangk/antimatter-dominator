import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.ANTHROPIC_API_KEY || "";
  res.json({
    keyExists: !!key,
    keyLength: key.length,
    keyPrefix: key.substring(0, 12) + "...",
    keyHasSpaces: key !== key.trim(),
    keyHasNewlines: key.includes("\n") || key.includes("\r"),
  });
}
