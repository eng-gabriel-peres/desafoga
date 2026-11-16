"use client";

import { useState } from "react";
import { Aparencia } from "../aparencia";
import { Painel } from "../painel";

export function Conteudo() {
  const [codigo] = useState(() => window.location.hash.slice(1));
  return <Painel acesso={{ codigo }} controles={<Aparencia />} />;
}
