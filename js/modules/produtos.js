// ============================================
// PRODUTOS (Finished Products)
// Nervo Saboaria - ERP Artesanal
// ============================================

import { listarTodos, atualizar, buscarPorId } from '../db.js';
import {
  formatarMoeda,
  notificar,
  abrirModal,
  fecharModal,
  initModalClose,
  escapeHtml,
  stockBadge
} from '../utils/helpers.js';

const STORE = 'produtos';
let editandoId = null;

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Produtos</h2>
    </div>

    <div class="alert alert-info">
      Produtos sao gerados automaticamente pela Producao. Aqui voce pode ajustar os precos de venda.
    </div>

    <div class="search-box">
      <span class="material-symbols-outlined">search</span>
      <input type="text" id="busca-produtos" placeholder="Buscar produto..." autocomplete="off">
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Qtd. Disponivel</th>
            <th>Custo Medio</th>
            <th>Preco Venda</th>
            <th>Margem (%)</th>
            <th>Status</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody id="produtos-tbody">
          <tr><td colspan="7">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Produto -->
    <div class="modal" id="modalProduto">
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Editar Preco de Venda</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formProduto">
            <div class="form-group">
              <label for="prd-nome">Produto</label>
              <input type="text" id="prd-nome" readonly>
            </div>
            <div class="form-group">
              <label for="prd-custo">Custo Medio (R$)</label>
              <input type="text" id="prd-custo" readonly>
            </div>
            <div class="form-group">
              <label for="prd-preco">Preco de Venda (R$)</label>
              <input type="number" id="prd-preco" step="0.01" min="0" required>
            </div>
            <div class="form-group">
              <label>Margem Prevista</label>
              <span id="prd-margem-preview" class="badge">--</span>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarProduto">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Calculate margin ----
function calcularMargem(preco_venda, custo_medio) {
  if (!preco_venda || preco_venda <= 0) return '--';
  return ((preco_venda - custo_medio) / preco_venda * 100).toFixed(1) + '%';
}

// ---- Render table body ----
function renderTabela(produtos) {
  const tbody = document.getElementById('produtos-tbody');
  if (!tbody) return;

  if (produtos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">inventory_2</span>
            <p>Nenhum produto cadastrado.</p>
            <p>Produtos sao criados automaticamente pelo modulo de <strong>Producao</strong>.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = produtos.map(p => `
    <tr>
      <td>${escapeHtml(p.nome)}</td>
      <td>${Number(p.quantidade_disponivel).toFixed(2)}</td>
      <td>${formatarMoeda(p.custo_medio)}</td>
      <td>${formatarMoeda(p.preco_venda)}</td>
      <td>${calcularMargem(p.preco_venda, p.custo_medio)}</td>
      <td>${stockBadge(p.quantidade_disponivel, 5)}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-sm btn-editar" data-id="${p.id}" title="Editar Preco">
          <span class="material-symbols-outlined">edit</span>
        </button>
      </td>
    </tr>
  `).join('');
}

// ---- Load data and render ----
let dadosCache = [];
async function carregar() {
  try {
    dadosCache = await listarTodos(STORE);
    filtrarEExibir();
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
  }
}

function filtrarEExibir() {
  const busca = (document.getElementById('busca-produtos')?.value || '').toLowerCase();
  const filtrados = busca
    ? dadosCache.filter(p => (p.nome || '').toLowerCase().includes(busca))
    : dadosCache;
  renderTabela(filtrados);
}

// ---- Update margin preview in modal ----
function atualizarMargemPreview() {
  const custoEl = document.getElementById('prd-custo');
  const precoEl = document.getElementById('prd-preco');
  const previewEl = document.getElementById('prd-margem-preview');
  if (!custoEl || !precoEl || !previewEl) return;

  const custo = parseFloat(custoEl.dataset.valor) || 0;
  const preco = parseFloat(precoEl.value) || 0;

  previewEl.textContent = calcularMargem(preco, custo);
}

// ---- Open modal for editing ----
async function abrirEdicao(id) {
  try {
    const produto = await buscarPorId(STORE, id);
    if (!produto) return;

    editandoId = id;

    document.getElementById('prd-nome').value = produto.nome || '';

    const custoEl = document.getElementById('prd-custo');
    custoEl.value = formatarMoeda(produto.custo_medio);
    custoEl.dataset.valor = produto.custo_medio ?? 0;

    document.getElementById('prd-preco').value = produto.preco_venda ?? 0;

    atualizarMargemPreview();
    abrirModal('modalProduto');
  } catch (error) {
    console.error('Erro ao carregar produto para edicao:', error);
  }
}

// ---- Save (update preco_venda only) ----
async function salvar() {
  const precoVenda = parseFloat(document.getElementById('prd-preco').value);
  if (isNaN(precoVenda) || precoVenda < 0) {
    notificar('Informe um preco de venda valido.', 'erro');
    return;
  }

  try {
    const produto = await buscarPorId(STORE, editandoId);
    if (!produto) return;

    produto.preco_venda = precoVenda;
    await atualizar(STORE, produto);

    fecharModal('modalProduto');
    notificar('Preco atualizado!');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar preco do produto:', error);
    notificar('Erro ao salvar preco.', 'erro');
  }
}

// ---- Init (load data + set up listeners) ----
export async function init() {
  // Load and render data
  await carregar();

  // Modal close handlers (overlay, X, cancel button)
  initModalClose('modalProduto');

  // Save button
  document.getElementById('btnSalvarProduto')?.addEventListener('click', salvar);

  // Search
  document.getElementById('busca-produtos')?.addEventListener('input', filtrarEExibir);

  // Live margin preview when preco changes
  document.getElementById('prd-preco')?.addEventListener('input', atualizarMargemPreview);

  // Delegate edit clicks on the table body
  document.getElementById('produtos-tbody')?.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      const id = Number(btnEditar.dataset.id);
      abrirEdicao(id);
    }
  });
}
