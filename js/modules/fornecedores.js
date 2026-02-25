// ============================================
// FORNECEDORES (Suppliers)
// Nervo Saboaria - ERP Artesanal
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

const STORE = 'fornecedores';
let editandoId = null;

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Fornecedores</h2>
      <button class="btn btn-primary" id="btnNovoFornecedor">
        <span class="material-symbols-outlined">add</span>
        Novo Fornecedor
      </button>
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Contato</th>
            <th>Telefone</th>
            <th>Email</th>
            <th>A\u00e7\u00f5es</th>
          </tr>
        </thead>
        <tbody id="fornecedores-tbody">
          <tr><td colspan="5">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Fornecedor -->
    <div class="modal" id="modalFornecedor">
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 id="modalFornecedorTitulo">Novo Fornecedor</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formFornecedor">
            <div class="form-row">
              <div class="form-group">
                <label for="forn-nome">Nome *</label>
                <input type="text" id="forn-nome" required>
              </div>
              <div class="form-group">
                <label for="forn-contato">Contato</label>
                <input type="text" id="forn-contato">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="forn-telefone">Telefone</label>
                <input type="text" id="forn-telefone">
              </div>
              <div class="form-group">
                <label for="forn-email">Email</label>
                <input type="email" id="forn-email">
              </div>
            </div>
            <div class="form-group">
              <label for="forn-observacoes">Observa\u00e7\u00f5es</label>
              <textarea id="forn-observacoes" rows="3"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarFornecedor">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Render table body ----
function renderTabela(fornecedores) {
  const tbody = document.getElementById('fornecedores-tbody');
  if (!tbody) return;

  if (fornecedores.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">local_shipping</span>
            <p>Nenhum fornecedor cadastrado.</p>
            <p>Clique em <strong>Novo Fornecedor</strong> para come\u00e7ar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = fornecedores.map(f => `
    <tr>
      <td>${escapeHtml(f.nome)}</td>
      <td>${escapeHtml(f.contato)}</td>
      <td>${escapeHtml(f.telefone)}</td>
      <td>${escapeHtml(f.email)}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-sm btn-editar" data-id="${f.id}" title="Editar">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button class="btn btn-icon btn-sm btn-danger btn-remover" data-id="${f.id}" title="Remover">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </td>
    </tr>
  `).join('');
}

// ---- Load data and render ----
async function carregar() {
  try {
    const fornecedores = await listarTodos(STORE);
    renderTabela(fornecedores);
  } catch (error) {
    console.error('Erro ao carregar fornecedores:', error);
  }
}

// ---- Open modal for new supplier ----
function abrirNovo() {
  editandoId = null;
  document.getElementById('modalFornecedorTitulo').textContent = 'Novo Fornecedor';
  document.getElementById('formFornecedor').reset();
  abrirModal('modalFornecedor');
}

// ---- Open modal for editing ----
async function abrirEdicao(id) {
  try {
    const fornecedor = await buscarPorId(STORE, id);
    if (!fornecedor) return;

    editandoId = id;
    document.getElementById('modalFornecedorTitulo').textContent = 'Editar Fornecedor';

    document.getElementById('forn-nome').value = fornecedor.nome || '';
    document.getElementById('forn-contato').value = fornecedor.contato || '';
    document.getElementById('forn-telefone').value = fornecedor.telefone || '';
    document.getElementById('forn-email').value = fornecedor.email || '';
    document.getElementById('forn-observacoes').value = fornecedor.observacoes || '';

    abrirModal('modalFornecedor');
  } catch (error) {
    console.error('Erro ao carregar fornecedor para edi\u00e7\u00e3o:', error);
  }
}

// ---- Save (add or update) ----
async function salvar() {
  const nome = document.getElementById('forn-nome').value.trim();
  if (!nome) {
    notificar('Informe o nome do fornecedor.', 'erro');
    return;
  }

  const dados = {
    nome,
    contato: document.getElementById('forn-contato').value.trim(),
    telefone: document.getElementById('forn-telefone').value.trim(),
    email: document.getElementById('forn-email').value.trim(),
    observacoes: document.getElementById('forn-observacoes').value.trim()
  };

  try {
    if (editandoId) {
      dados.id = editandoId;
      // Preserve original creation date
      const original = await buscarPorId(STORE, editandoId);
      dados.data_criacao = original?.data_criacao || new Date().toISOString();
      await atualizar(STORE, dados);
    } else {
      dados.data_criacao = new Date().toISOString();
      await adicionar(STORE, dados);
    }

    fecharModal('modalFornecedor');
    notificar('Fornecedor salvo!');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar fornecedor:', error);
    notificar('Erro ao salvar fornecedor.', 'erro');
  }
}

// ---- Remove with confirmation ----
async function removeFornecedor(id) {
  if (!confirmar('Deseja remover este fornecedor?')) return;

  try {
    await remover(STORE, id);
    notificar('Fornecedor removido!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover fornecedor:', error);
    notificar('Erro ao remover fornecedor.', 'erro');
  }
}

// ---- Init (load data + set up listeners) ----
export async function init() {
  // Load and render data
  await carregar();

  // Modal close handlers (overlay, X, cancel button)
  initModalClose('modalFornecedor');

  // "Novo Fornecedor" button
  document.getElementById('btnNovoFornecedor')?.addEventListener('click', abrirNovo);

  // Save button
  document.getElementById('btnSalvarFornecedor')?.addEventListener('click', salvar);

  // Delegate edit/delete clicks on the table body
  document.getElementById('fornecedores-tbody')?.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      const id = Number(btnEditar.dataset.id);
      abrirEdicao(id);
      return;
    }

    const btnRemover = e.target.closest('.btn-remover');
    if (btnRemover) {
      const id = Number(btnRemover.dataset.id);
      removeFornecedor(id);
    }
  });
}
