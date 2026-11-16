import { Gamepad2, Gift, Package, Pill, Shirt, ShoppingCart, Sofa, Utensils, type LucideIcon } from "lucide-react";
import type { Categoria } from "@/lib/finance";

/** As 8 categorias da grade de registro, na ordem em que aparecem. */
export const CATEGORIAS: Categoria[] = ["Mercado", "Roupa", "Comida pronta", "Farmácia", "Casa", "Lazer", "Presente", "Outro"];

export const ICONE_DA_CATEGORIA: Record<Categoria, LucideIcon> = {
  Mercado: ShoppingCart,
  Roupa: Shirt,
  "Comida pronta": Utensils,
  Farmácia: Pill,
  Casa: Sofa,
  Lazer: Gamepad2,
  Presente: Gift,
  Outro: Package,
};
