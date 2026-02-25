// ============================================
// INSUMOS (Raw Materials / Materias-Primas)
// Nervo Saboaria - ERP Artesanal
// ============================================

import { listarTodos, adicionar, atualizar, remover, buscarPorId, buscarPorIndice } from '../db.js';
import {
  formatarMoeda,
  notificar,
  abrirModal,
  fecharModal,
  initModalClose,
  escapeHtml,
  confirmar,
  stockBadge
} from '../utils/helpers.js';

const STORE = 'insumos';
let editandoId = null;
let fornecedoresCache = [];

// ---- Carregar fornecedores para o dropdown ----
async function carregarFornecedores() {
  try {
    fornecedoresCache = await listarTodos('fornecedores');
  } catch (e) {
    fornecedoresCache = [];
  }
}

function buildFornecedorOptions(selectedId) {
  let html = '<option value="">-- Nenhum --</option>';
  for (const f of fornecedoresCache) {
    const sel = f.id === selectedId ? 'selected' : '';
    html += `<option value="${f.id}" ${sel}>${escapeHtml(f.nome)}</option>`;
  }
  return html;
}

function getNomeFornecedor(id) {
  if (!id) return '-';
  const f = fornecedoresCache.find(x => x.id === id);
  return f ? escapeHtml(f.nome) : '-';
}

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Insumos (Mat\u00e9rias-Primas)</h2>
      <button class="btn btn-primary" id="btnNovoInsumo">
        <span class="material-symbols-outlined">add</span>
        Novo Insumo
      </button>
    </div>

    <div class="search-box">
      <span class="material-symbols-outlined">search</span>
      <input type="text" id="busca-insumos" placeholder="Buscar insumo..." autocomplete="off">
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Fornecedor</th>
            <th>Categoria</th>
            <th>Unidade</th>
            <th>Qtd. Atual</th>
            <th>Custo Unit.</th>
            <th>Estoque Min.</th>
            <th>Status</th>
            <th>A\u00e7\u00f5es</th>
          </tr>
        </thead>
        <tbody id="insumos-tbody">
          <tr><td colspan="9">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Insumo -->
    <div class="modal" id="modalInsumo">
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 id="modalInsumoTitulo">Novo Insumo</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formInsumo">
            <div class="form-row">
              <div class="form-group">
                <label for="ins-nome">Nome *</label>
                <input type="text" id="ins-nome" required>
              </div>
              <div class="form-group">
                <label for="ins-fornecedor">Fornecedor</label>
                <select id="ins-fornecedor">
                  <option value="">-- Nenhum --</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="ins-categoria">Categoria</label>
                <select id="ins-categoria">
                  <option value="Oleos/Gorduras">\u00d3leos/Gorduras</option>
                  <option value="Essencias">Ess\u00eancias</option>
                  <option value="Corantes">Corantes</option>
                  <option value="Bases">Bases</option>
                  <option value="Embalagens">Embalagens</option>
                  <option value="Decoracao">Decora\u00e7\u00e3o</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div class="form-group">
                <label for="ins-unidade_medida">Unidade de Medida</label>
                <select id="ins-unidade_medida">
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="un">un</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="ins-quantidade_atual">Qtd. Atual</label>
                <input type="number" id="ins-quantidade_atual" step="0.01" min="0" value="0">
              </div>
              <div class="form-group">
                <label for="ins-custo_unitario">Custo Unit\u00e1rio (R$)</label>
                <input type="number" id="ins-custo_unitario" step="0.01" min="0" value="0">
              </div>
            </div>
            <div class="form-group">
              <label for="ins-estoque_minimo">Estoque M\u00ednimo</label>
              <input type="number" id="ins-estoque_minimo" step="0.01" min="0" value="0">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarInsumo">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Render table body ----
function renderTabela(insumos) {
  const tbody = document.getElementById('insumos-tbody');
  if (!tbody) return;

  if (insumos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">inventory_2</span>
            <p>Nenhum insumo cadastrado.</p>
            <p>Clique em <strong>Novo Insumo</strong> para come\u00e7ar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = insumos.map(i => `
    <tr>
      <td>${escapeHtml(i.nome)}</td>
      <td>${getNomeFornecedor(i.fornecedor_id)}</td>
      <td>${escapeHtml(i.categoria)}</td>
      <td>${escapeHtml(i.unidade_medida)}</td>
      <td>${Number(i.quantidade_atual).toFixed(2)}</td>
      <td>${formatarMoeda(i.custo_unitario)}</td>
      <td>${Number(i.estoque_minimo).toFixed(2)}</td>
      <td>${stockBadge(i.quantidade_atual, i.estoque_minimo)}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-sm btn-editar" data-id="${i.id}" title="Editar">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button class="btn btn-icon btn-sm btn-danger btn-remover" data-id="${i.id}" title="Remover">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </td>
    </tr>
  `).join('');
}

// ---- Load data and render ----
let dadosCache = [];
async function carregar() {
  try {
    await carregarFornecedores();
    dadosCache = await listarTodos(STORE);
    filtrarEExibir();
  } catch (error) {
    console.error('Erro ao carregar insumos:', error);
  }
}

function filtrarEExibir() {
  const busca = (document.getElementById('busca-insumos')?.value || '').toLowerCase();
  const filtrados = busca
    ? dadosCache.filter(i => (i.nome || '').toLowerCase().includes(busca) || (i.categoria || '').toLowerCase().includes(busca))
    : dadosCache;
  renderTabela(filtrados);
}

// ---- Open modal for new insumo ----
async function abrirNovo() {
  editandoId = null;
  document.getElementById('modalInsumoTitulo').textContent = 'Novo Insumo';
  document.getElementById('formInsumo').reset();
  await carregarFornecedores();
  document.getElementById('ins-fornecedor').innerHTML = buildFornecedorOptions(null);
  abrirModal('modalInsumo');
}

// ---- Open modal for editing ----
async function abrirEdicao(id) {
  try {
    const insumo = await buscarPorId(STORE, id);
    if (!insumo) return;

    editandoId = id;
    document.getElementById('modalInsumoTitulo').textContent = 'Editar Insumo';

    await carregarFornecedores();
    document.getElementById('ins-fornecedor').innerHTML = buildFornecedorOptions(insumo.fornecedor_id);

    document.getElementById('ins-nome').value = insumo.nome || '';
    document.getElementById('ins-categoria').value = insumo.categoria || 'Outros';
    document.getElementById('ins-unidade_medida').value = insumo.unidade_medida || 'kg';
    document.getElementById('ins-quantidade_atual').value = insumo.quantidade_atual ?? 0;
    document.getElementById('ins-custo_unitario').value = insumo.custo_unitario ?? 0;
    document.getElementById('ins-estoque_minimo').value = insumo.estoque_minimo ?? 0;

    abrirModal('modalInsumo');
  } catch (error) {
    console.error('Erro ao carregar insumo para edi\u00e7\u00e3o:', error);
  }
}

// ---- Save (add or update) ----
async function salvar() {
  const nome = document.getElementById('ins-nome').value.trim();
  if (!nome) {
    notificar('Informe o nome do insumo.', 'erro');
    return;
  }

  const fornecedorVal = document.getElementById('ins-fornecedor').value;

  const dados = {
    nome,
    fornecedor_id: fornecedorVal ? Number(fornecedorVal) : null,
    categoria: document.getElementById('ins-categoria').value,
    unidade_medida: document.getElementById('ins-unidade_medida').value,
    quantidade_atual: parseFloat(document.getElementById('ins-quantidade_atual').value) || 0,
    custo_unitario: parseFloat(document.getElementById('ins-custo_unitario').value) || 0,
    estoque_minimo: parseFloat(document.getElementById('ins-estoque_minimo').value) || 0
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

    fecharModal('modalInsumo');
    notificar('Insumo salvo!');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar insumo:', error);
    notificar('Erro ao salvar insumo.', 'erro');
  }
}

// ---- Remove with confirmation (checks if used in recipes) ----
async function removeInsumo(id) {
  try {
    // Verifica se o insumo esta sendo usado em alguma receita
    const usos = await buscarPorIndice('receita_insumos', 'insumo_id', id);
    if (usos.length > 0) {
      // Busca nomes das receitas que usam este insumo
      const nomes = [];
      for (const uso of usos) {
        const receita = await buscarPorId('receitas', uso.receita_id);
        if (receita) nomes.push(receita.nome_produto || 'Receita sem nome');
      }
      const listaReceitas = nomes.length > 0 ? nomes.join(', ') : `${usos.length} receita(s)`;
      notificar(`Este insumo esta sendo usado em: ${listaReceitas}. Remova das receitas primeiro.`, 'erro');
      return;
    }

    if (!confirmar('Deseja remover este insumo?')) return;

    await remover(STORE, id);
    notificar('Insumo removido!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover insumo:', error);
    notificar('Erro ao remover insumo.', 'erro');
  }
}

// ---- Init (load data + set up listeners) ----
export async function init() {
  await carregar();

  initModalClose('modalInsumo');

  document.getElementById('btnNovoInsumo')?.addEventListener('click', abrirNovo);
  document.getElementById('btnSalvarInsumo')?.addEventListener('click', salvar);
  document.getElementById('busca-insumos')?.addEventListener('input', filtrarEExibir);

  document.getElementById('insumos-tbody')?.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      const id = Number(btnEditar.dataset.id);
      abrirEdicao(id);
      return;
    }

    const btnRemover = e.target.closest('.btn-remover');
    if (btnRemover) {
      const id = Number(btnRemover.dataset.id);
      removeInsumo(id);
    }
  });
}
