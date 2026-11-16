import { mesDaqui } from "@/lib/assistente/textos";
import { reais } from "@/lib/formatar";

const L = 520;
const A = 130;

/** Saldo total caindo mês a mês até zero. Os pontos vêm de `simularQuitacao`. */
export function GraficoSaldo({ linhaDoTempo, agora }: { linhaDoTempo: number[]; agora: Date }) {
  const meses = linhaDoTempo.length - 1 || 1;
  const maior = Math.max(1, ...linhaDoTempo);
  const pontos = linhaDoTempo
    .map((v, i) => `${((i / meses) * L).toFixed(1)},${(A - 4 - (v / maior) * (A - 16)).toFixed(1)}`)
    .join(" ");
  const fim = mesDaqui(agora, meses);
  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Gráfico do saldo devedor caindo de ${reais(linhaDoTempo[0])} hoje até zero em ${fim}.`}
        className="block h-32 w-full desk:h-36"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={L} y1={A * f} y2={A * f} stroke="var(--line)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        ))}
        <polygon points={`0,${A} ${pontos} ${L},${A}`} fill="color-mix(in srgb, var(--primary) 14%, transparent)" />
        <polyline points={pontos} fill="none" stroke="var(--primary)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-1.5 flex justify-between text-[0.85rem] text-muted">
        <span>Hoje: {reais(linhaDoTempo[0])}</span>
        <span>
          {fim.charAt(0).toUpperCase() + fim.slice(1)}: R$ 0
        </span>
      </figcaption>
    </figure>
  );
}
