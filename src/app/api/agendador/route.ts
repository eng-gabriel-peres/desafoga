import { NextResponse, type NextRequest } from "next/server";
import { autorizadoNoAgendador } from "@/lib/desafoga/agendador";
import { rodarAgendador } from "@/lib/desafoga/servidor/agendador";

export const maxDuration = 60;

/**
 * Mensagens automáticas da Luana (check-ins, conta que vence amanhã, dia de
 * guardar). Chamado a cada 15 minutos pelo workflow `agendador.yml` do GitHub
 * com `Authorization: Bearer <AGENDADOR_SEGREDO>`. Cada mensagem sai uma vez
 * só, então chamar a mais não repete nada.
 */
async function rodar(request: NextRequest) {
  if (!autorizadoNoAgendador(request.headers.get("authorization"), process.env.AGENDADOR_SEGREDO)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json(await rodarAgendador());
}

export const POST = rodar;
export const GET = rodar;
