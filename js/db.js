// ============================================
// DATABASE LAYER - IndexedDB
// Erenice Teixeira - Velas e Saboarias
// ============================================

const DB_NAME = "ereniceVelasDB";
const DB_VERSION = 3;

const STORES_CONFIG = {
  fornecedores: { keyPath: "id", autoIncrement: true, indexes: ["nome"] },
  fornecedor_insumos: { keyPath: "id", autoIncrement: true, indexes: ["fornecedor_id", "insumo_id"] },
  insumos: { keyPath: "id", autoIncrement: true, indexes: ["nome", "categoria"] },
  receitas: { keyPath: "id", autoIncrement: true, indexes: ["nome_produto"] },
  receita_insumos: { keyPath: "id", autoIncrement: true, indexes: ["receita_id", "insumo_id"] },
  producao: { keyPath: "id", autoIncrement: true, indexes: ["receita_id", "data_producao"] },
  produtos: { keyPath: "id", autoIncrement: true, indexes: ["nome"] },
  pedidos: { keyPath: "id", autoIncrement: true, indexes: ["status", "data_pedido", "cliente_nome"] },
  pedido_itens: { keyPath: "id", autoIncrement: true, indexes: ["pedido_id", "produto_id"] },
  financeiro: { keyPath: "id", autoIncrement: true, indexes: ["tipo", "categoria", "data"] },
  contas_pagar: { keyPath: "id", autoIncrement: true, indexes: ["status", "data_vencimento"] },
  contas_receber: { keyPath: "id", autoIncrement: true, indexes: ["status", "data_vencimento"] },
  metas: { keyPath: "id", autoIncrement: true, indexes: ["mes", "ano"] },
  perdas: { keyPath: "id", autoIncrement: true, indexes: ["produto_id", "data", "categoria"] },
  progresso_assistente: { keyPath: "id", autoIncrement: true }
};

let dbInstance = null;

export function abrirBanco() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      for (const [storeName, config] of Object.entries(STORES_CONFIG)) {
        let store;
        if (!db.objectStoreNames.contains(storeName)) {
          store = db.createObjectStore(storeName, {
            keyPath: config.keyPath,
            autoIncrement: config.autoIncrement
          });
        } else {
          store = event.target.transaction.objectStore(storeName);
        }

        if (config.indexes) {
          config.indexes.forEach(idx => {
            if (!store.indexNames.contains(idx)) {
              store.createIndex(idx, idx, { unique: false });
            }
          });
        }
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error);
  });
}

// ---- CRUD Genérico ----

export async function adicionar(storeName, dados) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.add({ ...dados, data_criacao: dados.data_criacao || new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function atualizar(storeName, dados) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(dados);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function remover(storeName, id) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function buscarPorId(storeName, id) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listarTodos(storeName) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function buscarPorIndice(storeName, indexName, valor) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(valor);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function contarRegistros(storeName) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function limparStore(storeName) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---- Backup / Restore ----

export async function exportarTudo() {
  const db = await abrirBanco();
  const backup = {};
  const storeNames = Object.keys(STORES_CONFIG);

  for (const name of storeNames) {
    backup[name] = await listarTodos(name);
  }

  backup._meta = {
    versao: DB_VERSION,
    data_exportacao: new Date().toISOString(),
    app: "Erenice Teixeira - Velas e Saboarias"
  };

  return backup;
}

export async function importarTudo(backup) {
  const db = await abrirBanco();
  const storeNames = Object.keys(STORES_CONFIG);

  for (const name of storeNames) {
    if (backup[name] && Array.isArray(backup[name])) {
      await limparStore(name);
      for (const item of backup[name]) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(name, "readwrite");
          const store = tx.objectStore(name);
          const req = store.put(item);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }
  }
}
