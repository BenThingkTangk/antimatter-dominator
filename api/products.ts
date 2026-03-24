import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProducts, getProductBySlug } from "./_lib/products";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { slug } = req.query;
  if (slug && typeof slug === "string") {
    const product = getProductBySlug(slug);
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.json(product);
  }

  return res.json(getProducts());
}
