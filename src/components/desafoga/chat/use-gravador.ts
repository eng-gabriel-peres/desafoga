"use client";

import { useEffect, useRef, useState } from "react";

const FORMATOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const MAXIMO_EM_SEGUNDOS = 120;

/**
 * Grava uma mensagem de voz com o microfone. `segundos` é null quando não
 * está gravando. Ao parar, entrega o áudio para `aoTerminar`.
 */
export function useGravador(aoTerminar: (audio: Blob) => void, aoFalhar: (motivo: string) => void) {
  const [segundos, setSegundos] = useState<number | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const descartar = useRef(false);
  const callbacks = useRef({ aoTerminar, aoFalhar });

  useEffect(() => {
    callbacks.current = { aoTerminar, aoFalhar };
  });

  function parar(jogarFora = false) {
    descartar.current = jogarFora;
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    if (gravador.current?.state === "recording") gravador.current.stop();
  }

  async function comecar() {
    if (segundos !== null) return;
    let microfone: MediaStream;
    try {
      microfone = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      callbacks.current.aoFalhar("Não consegui usar o microfone. Libere o acesso no navegador ou escreva a mensagem.");
      return;
    }
    const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
    const novo = new MediaRecorder(microfone, formato ? { mimeType: formato, audioBitsPerSecond: 32000 } : undefined);
    const pedacos: Blob[] = [];
    novo.ondataavailable = (e) => e.data.size > 0 && pedacos.push(e.data);
    novo.onstop = () => {
      microfone.getTracks().forEach((t) => t.stop());
      gravador.current = null;
      setSegundos(null);
      const audio = new Blob(pedacos, { type: (novo.mimeType || "audio/webm").split(";")[0] });
      if (!descartar.current && audio.size > 0) callbacks.current.aoTerminar(audio);
    };
    gravador.current = novo;
    descartar.current = false;
    novo.start();
    setSegundos(0);
    let s = 0;
    relogio.current = setInterval(() => {
      s += 1;
      setSegundos(s);
      if (s >= MAXIMO_EM_SEGUNDOS) parar();
    }, 1000);
  }

  // Sai da tela gravando: descarta.
  useEffect(() => () => parar(true), []);

  return { segundos, comecar, parar };
}
