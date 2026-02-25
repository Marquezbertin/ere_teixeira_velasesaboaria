// ============================================
// CONCORRENTES (Pesquisa de Precos)
// Erenice Teixeira - Velas e Saboarias
// ============================================

import { listarTodos, adicionar, atualizar, remover, buscarPorId } from '../db.js';
import {
  formatarMoeda,
  formatarData,
  notificar,
  abrirModal,
  fecharModal,
  initModalClose,
  escapeHtml,
  confirmar
} from '../utils/helpers.js';

const STORE = 'concorrentes';
let editandoId = null;

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Concorrentes</h2>
      <button class="btn btn-primary" id="btnNovoConcorrente">
        <span class="material-symbols-outlined">add</span>
        Novo Concorrente
      </button>
    </div>

    <div class="search-box">
      <span class="material-symbols-outlined">search</span>
      <input type="text" id="busca-concorrentes" placeholder="Buscar por concorrente, produto ou descricao..." autocomplete="off">
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Concorrente</th>
            <th>Produto</th>
            <th>Preco</th>
            <th>URL</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody id="concorrentes-tbody">
          <tr><td colspan="5">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Concorrente -->
    <div class="modal" id="modalConcorrente">
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 id="modalConcorrenteTitulo">Novo Concorrente</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formConcorrente">
            <div class="form-row">
              <div class="form-group">
                <label for="conc-concorrente">Concorrente/Loja *</label>
                <input type="text" id="conc-concorrente" required>
              </div>
              <div class="form-group">
                <label for="conc-produto">Produto *</label>
                <input type="text" id="conc-produto" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="conc-preco">Preco (R$)</label>
                <input type="number" id="conc-preco" step="0.01" min="0">
              </div>
              <div class="form-group">
                <label for="conc-url">URL do Site</label>
                <input type="url" id="conc-url" placeholder="https://">
              </div>
            </div>
            <div class="form-group">
              <label for="conc-descricao">Descricao do Produto</label>
              <textarea id="conc-descricao" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label for="conc-observacoes">Observacoes</label>
              <textarea id="conc-observacoes" rows="2"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarConcorrente">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Render table body ----
function renderTabela(concorrentes) {
  const tbody = document.getElementById('concorrentes-tbody');
  if (!tbody) return;

  if (concorrentes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">storefront</span>
            <p>Nenhum concorrente cadastrado.</p>
            <p>Clique em <strong>Novo Concorrente</strong> para comecar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = concorrentes.map(c => {
    const urlHtml = c.url
      ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(c.url)}">${escapeHtml(truncarUrl(c.url))}</a>`
      : '-';
    return `
    <tr>
      <td>${escapeHtml(c.concorrente)}</td>
      <td>${escapeHtml(c.produto)}</td>
      <td>${c.preco ? formatarMoeda(c.preco) : '-'}</td>
      <td>${urlHtml}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-sm btn-editar" data-id="${c.id}" title="Editar">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button class="btn btn-icon btn-sm btn-danger btn-remover" data-id="${c.id}" title="Remover">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </td>
    </tr>
  `}).join('');
}

function truncarUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '...' : url;
  }
}

// ---- Load data and render ----
let dadosCache = [];
async function carregar() {
  try {
    dadosCache = await listarTodos(STORE);
    // Mais recentes primeiro
    dadosCache.sort((a, b) => (b.data_criacao || '').localeCompare(a.data_criacao || ''));
    filtrarEExibir();
  } catch (error) {
    console.error('Erro ao carregar concorrentes:', error);
  }
}

function filtrarEExibir() {
  const busca = (document.getElementById('busca-concorrentes')?.value || '').toLowerCase();
  const filtrados = busca
    ? dadosCache.filter(c =>
        (c.concorrente || '').toLowerCase().includes(busca) ||
        (c.produto || '').toLowerCase().includes(busca) ||
        (c.descricao || '').toLowerCase().includes(busca))
    : dadosCache;
  renderTabela(filtrados);
}

// ---- Open modal for new entry ----
function abrirNovo() {
  editandoId = null;
  document.getElementById('modalConcorrenteTitulo').textContent = 'Novo Concorrente';
  document.getElementById('formConcorrente').reset();
  abrirModal('modalConcorrente');
}

// ---- Open modal for editing ----
async function abrirEdicao(id) {
  try {
    const registro = await buscarPorId(STORE, id);
    if (!registro) return;

    editandoId = id;
    document.getElementById('modalConcorrenteTitulo').textContent = 'Editar Concorrente';

    document.getElementById('conc-concorrente').value = registro.concorrente || '';
    document.getElementById('conc-produto').value = registro.produto || '';
    document.getElementById('conc-preco').value = registro.preco || '';
    document.getElementById('conc-url').value = registro.url || '';
    document.getElementById('conc-descricao').value = registro.descricao || '';
    document.getElementById('conc-observacoes').value = registro.observacoes || '';

    abrirModal('modalConcorrente');
  } catch (error) {
    console.error('Erro ao carregar concorrente para edicao:', error);
  }
}

// ---- Save (add or update) ----
async function salvar() {
  const concorrente = document.getElementById('conc-concorrente').value.trim();
  const produto = document.getElementById('conc-produto').value.trim();

  if (!concorrente) {
    notificar('Informe o nome do concorrente/loja.', 'erro');
    return;
  }
  if (!produto) {
    notificar('Informe o nome do produto.', 'erro');
    return;
  }

  const precoRaw = document.getElementById('conc-preco').value;
  const dados = {
    concorrente,
    produto,
    preco: precoRaw ? parseFloat(precoRaw) : null,
    url: document.getElementById('conc-url').value.trim(),
    descricao: document.getElementById('conc-descricao').value.trim(),
    observacoes: document.getElementById('conc-observacoes').value.trim()
  };

  try {
    if (editandoId) {
      dados.id = editandoId;
      const original = await buscarPorId(STORE, editandoId);
      dados.data_criacao = original?.data_criacao || new Date().toISOString();
      await atualizar(STORE, dados);
    } else {
      dados.data_criacao = new Date().toISOString();
      await adicionar(STORE, dados);
    }

    fecharModal('modalConcorrente');
    notificar('Concorrente salvo!');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar concorrente:', error);
    notificar('Erro ao salvar concorrente.', 'erro');
  }
}

// ---- Remove with confirmation ----
async function removeConcorrente(id) {
  if (!confirmar('Deseja remover este concorrente?')) return;

  try {
    await remover(STORE, id);
    notificar('Concorrente removido!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover concorrente:', error);
    notificar('Erro ao remover concorrente.', 'erro');
  }
}

// ---- Init (load data + set up listeners) ----
export async function init() {
  await carregar();

  initModalClose('modalConcorrente');

  document.getElementById('btnNovoConcorrente')?.addEventListener('click', abrirNovo);
  document.getElementById('btnSalvarConcorrente')?.addEventListener('click', salvar);
  document.getElementById('busca-concorrentes')?.addEventListener('input', filtrarEExibir);

  document.getElementById('concorrentes-tbody')?.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      const id = Number(btnEditar.dataset.id);
      abrirEdicao(id);
      return;
    }

    const btnRemover = e.target.closest('.btn-remover');
    if (btnRemover) {
      const id = Number(btnRemover.dataset.id);
      removeConcorrente(id);
    }
  });
}
