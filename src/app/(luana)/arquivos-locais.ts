/**
 * Guarda no próprio navegador (IndexedDB) os arquivos enviados na conversa,
 * para a pessoa poder abri-los de novo. Nada disso vai para o servidor.
 */

const BANCO = "luana-arquivos";
const TABELA = "arquivos";
/** Quantos arquivos ficam guardados; os mais antigos saem. */
const MAXIMO = 80;

interface Registro {
  chave: string;
  arquivo: Blob;
  guardadoEm: number;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(TABELA, { keyPath: "chave" });
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error);
  });
}

function concluir<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rejeitar) => {
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error);
  });
}

/** Guarda o arquivo; devolve false se o navegador não permitir (aba privada, sem espaço). */
export async function guardarArquivo(chave: string, arquivo: Blob): Promise<boolean> {
  try {
    const banco = await abrir();
    const tabela = banco.transaction(TABELA, "readwrite").objectStore(TABELA);
    await concluir(tabela.put({ chave, arquivo, guardadoEm: Date.now() } satisfies Registro));

    const todos = await concluir<Registro[]>(tabela.getAll());
    const excedentes = todos.sort((a, b) => a.guardadoEm - b.guardadoEm).slice(0, Math.max(0, todos.length - MAXIMO));
    for (const antigo of excedentes) tabela.delete(antigo.chave);
    return true;
  } catch {
    return false;
  }
}

export async function buscarArquivo(chave: string): Promise<Blob | null> {
  try {
    const banco = await abrir();
    const registro = await concluir<Registro | undefined>(
      banco.transaction(TABELA, "readonly").objectStore(TABELA).get(chave),
    );
    return registro?.arquivo ?? null;
  } catch {
    return null;
  }
}
