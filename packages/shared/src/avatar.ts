import { z } from "zod";

export const SKIN_TONES = [
  { id: "porcelain", label: "Porcelain", hex: "#FDE7D6" },
  { id: "peach", label: "Warm Peach", hex: "#F6C9A6" },
  { id: "honey", label: "Honey", hex: "#E5AA7B" },
  { id: "caramel", label: "Caramel", hex: "#C88456" },
  { id: "chestnut", label: "Chestnut", hex: "#9E5E38" },
  { id: "espresso", label: "Espresso", hex: "#6B3C24" },
  { id: "olive", label: "Golden Olive", hex: "#D6A77A" },
  { id: "rose", label: "Rosy Beige", hex: "#EEC0AA" },
] as const;

export const HAIR_STYLES = [
  { id: "bob", label: "Cozy Bob" },
  { id: "wavy", label: "Soft Waves" },
  { id: "ponytail", label: "High Ponytail" },
  { id: "curly", label: "Fluffy Curls" },
  { id: "spiky", label: "Messy Crop" },
  { id: "bun", label: "Top Bun" },
  { id: "beanie", label: "Knit Beanie" },
  { id: "parted", label: "Side Part" },
] as const;

export const HAIR_COLORS = [
  { id: "cocoa", label: "Cocoa", hex: "#4A312C" },
  { id: "ink", label: "Midnight", hex: "#262835" },
  { id: "auburn", label: "Cinnamon", hex: "#A84A32" },
  { id: "honeyblonde", label: "Butter Blonde", hex: "#E4B865" },
  { id: "strawberry", label: "Coral Rose", hex: "#E5808A" },
  { id: "lavender", label: "Lavender Mist", hex: "#9E8BD6" },
  { id: "matcha", label: "Matcha Sage", hex: "#6FA17B" },
  { id: "silver", label: "Cloud Silver", hex: "#C7CCD6" },
  { id: "sky", label: "Sky Pastel", hex: "#74B0DA" },
  { id: "chestnut", label: "Roast Brown", hex: "#764935" },
] as const;

export const TOP_STYLES = [
  { id: "sweater", label: "Knit Sweater" },
  { id: "hoodie", label: "Cozy Hoodie" },
  { id: "cardigan", label: "Café Cardigan" },
  { id: "tee", label: "Relaxed Tee" },
  { id: "apron", label: "Barista Apron" },
] as const;

export const BOTTOM_STYLES = [
  { id: "jeans", label: "Cuffed Pants" },
  { id: "skirt", label: "Pleated Skirt" },
  { id: "shorts", label: "Comfy Shorts" },
] as const;

export const SHOE_STYLES = [
  { id: "sneakers", label: "Sneakers" },
  { id: "boots", label: "Ankle Boots" },
  { id: "loafers", label: "Café Loafers" },
] as const;

export const ACCESSORIES = [
  { id: "none", label: "None" },
  { id: "glasses", label: "Round Glasses" },
  { id: "headphones", label: "Lo-Fi Headphones" },
  { id: "beret", label: "Artist Beret" },
  { id: "scarf", label: "Warm Scarf" },
  { id: "star_pin", label: "Star Hairpin" },
] as const;

export const CLOTHING_COLORS = [
  { id: "latte", label: "Oat Latte", hex: "#E6CFAF" },
  { id: "sage", label: "Sage Leaf", hex: "#8AB696" },
  { id: "terracotta", label: "Terracotta", hex: "#D97C5E" },
  { id: "berry", label: "Warm Berry", hex: "#C86B85" },
  { id: "denim", label: "Soft Denim", hex: "#6B8EB8" },
  { id: "mustard", label: "Honey Gold", hex: "#E5B454" },
  { id: "plum", label: "Soft Plum", hex: "#856B9E" },
  { id: "cream", label: "Whipped Cream", hex: "#F7F1E5" },
  { id: "charcoal", label: "Espresso Ink", hex: "#44414B" },
  { id: "mint", label: "Mint Tea", hex: "#8CD1BE" },
] as const;

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const AvatarConfigSchema = z.object({
  skinTone: hexColorSchema,
  hairStyle: z.enum(["bob", "wavy", "ponytail", "curly", "spiky", "bun", "beanie", "parted"]),
  hairColor: hexColorSchema,
  topStyle: z.enum(["sweater", "hoodie", "cardigan", "tee", "apron"]),
  topColor: hexColorSchema,
  topAccent: hexColorSchema,
  bottomStyle: z.enum(["jeans", "skirt", "shorts"]),
  bottomColor: hexColorSchema,
  shoeStyle: z.enum(["sneakers", "boots", "loafers"]),
  shoeColor: hexColorSchema,
  accessory: z.enum(["none", "glasses", "headphones", "beret", "scarf", "star_pin"]),
});

export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skinTone: "#F6C9A6",
  hairStyle: "bob",
  hairColor: "#4A312C",
  topStyle: "sweater",
  topColor: "#8AB696",
  topAccent: "#F7F1E5",
  bottomStyle: "jeans",
  bottomColor: "#6B8EB8",
  shoeStyle: "sneakers",
  shoeColor: "#44414B",
  accessory: "glasses",
};

function pick<T>(arr: readonly T[], seed: number): T {
  const idx = Math.abs(Math.floor(seed)) % arr.length;
  return arr[idx]!;
}

export function generateRandomAvatarConfig(
  seed: number = Math.floor(Math.random() * 0x7fffffff) ^ Date.now()
): AvatarConfig {
  // Xorshift32 with non-zero seed ensures uniform distribution across all traits
  let s = (seed ^ 0x9e3779b9) >>> 0;
  if (s === 0) s = 0x6d2b79f5;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
  // Warm up state so close numeric seeds diverge cleanly
  next();
  next();
  return {
    skinTone: pick(SKIN_TONES, next()).hex,
    hairStyle: pick(HAIR_STYLES, next()).id,
    hairColor: pick(HAIR_COLORS, next()).hex,
    topStyle: pick(TOP_STYLES, next()).id,
    topColor: pick(CLOTHING_COLORS, next()).hex,
    topAccent: pick(CLOTHING_COLORS, next()).hex,
    bottomStyle: pick(BOTTOM_STYLES, next()).id,
    bottomColor: pick(CLOTHING_COLORS, next()).hex,
    shoeStyle: pick(SHOE_STYLES, next()).id,
    shoeColor: pick(CLOTHING_COLORS, next()).hex,
    accessory: pick(ACCESSORIES, next()).id,
  };
}
