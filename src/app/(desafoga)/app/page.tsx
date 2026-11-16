import { redirect } from "next/navigation";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function App() {
  redirect("/app/hoje");
}
