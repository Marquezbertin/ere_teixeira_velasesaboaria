// ============================================
// PERDAS E AVARIAS (Product Losses)
// Nervo Saboaria - ERP Artesanal
// ============================================

import { listarTodos, adicionar, remover, buscarPorId, atualizar } from '../db.js';
import {
  formatarMoeda,
  formatarData,
  notificar,
  abrirModal,
  fecharModal,
  initModalClose,
  confirmar
} from '../utils/helpers.js';

const STORE = 'perdas';

const CATEGORIAS = [
  { value: 'Quebra', label: 'Quebra' },
  { value: 'Validade', label: 'Validade' },
  { value: 'Doacao', label: 'Doacao' },
  { value: 'Defeito', label: 'Defeito' },
  { value: 'Outros', label: 'Outros' }
];

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Perdas e Avarias</h2>
      <div>
        <button class="btn btn-danger" id="btnRegistrarPerda">
          <span class="material-symbols-outlined">add</span>
          Registrar Perda
        </button>
      </div>
    </div>

    <div class="cards-grid" id="perd-cards">
      <div class="card card-kpi">
        <span class="kpi-label">Total de Perdas</span>
        <span class="kpi-value" id="perd-total-count">0</span>
      </div>
      <div class="card card-kpi danger">
        <span class="kpi-label">Valor Total Perdido</span>
        <span class="kpi-value" id="perd-total-valor">R$ 0,00</span>
      </div>
      <div class="card card-kpi">
        <span class="kpi-label">Categoria mais frequente</span>
        <span class="kpi-value" id="perd-categoria-freq">--</span>
      </div>
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Produto</th>
            <th>Quantidade</th>
            <th>Motivo</th>
            <th>Categoria</th>
            <th>Valor da Perda</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody id="perd-tbody">
          <tr><td colspan="7">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Perda -->
    <div class="modal" id="modalPerda">
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Registrar Perda</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formPerda">
            <div class="form-group">
              <label for="perd-produto">Produto *</label>
              <select id="perd-produto" required>
                <option value="">-- Selecione --</option>
              </select>
              <small id="perd-estoque-info" style="color:var(--text-muted);"></small>
            </div>
            <div class="form-group">
              <label for="perd-quantidade">Quantidade *</label>
              <input type="number" id="perd-quantidade" min="1" step="1" required placeholder="0">
            </div>
            <div class="form-group">
              <label for="perd-categoria">Categoria *</label>
              <select id="perd-categoria" required>
                <option value="">-- Selecione --</option>
              </select>
            </div>
            <div class="form-group">
              <label for="perd-motivo">Motivo / Descricao</label>
              <textarea id="perd-motivo" rows="3" placeholder="Descreva o motivo da perda..."></textarea>
            </div>
            <div class="form-group">
              <label>Valor estimado da perda</label>
              <span id="perd-valor-preview" class="badge" style="font-size:1.1em;">R$ 0,00</span>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarPerda">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Simple text escape ----
function escapeText(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Cached products for the modal ----
let produtosCache = [];

// ---- Update summary cards ----
function atualizarCards(perdas) {
  const totalCount = perdas.length;
  const totalValor = perdas.reduce((acc, p) => acc + Number(p.valor || 0), 0);

  document.getElementById('perd-total-count').textContent = totalCount;
  document.getElementById('perd-total-valor').textContent = formatarMoeda(totalValor);

  // Find most frequent category
  if (totalCount === 0) {
    document.getElementById('perd-categoria-freq').textContent = '--';
    return;
  }

  const contagem = {};
  perdas.forEach(p => {
    const cat = p.categoria || 'Outros';
    contagem[cat] = (contagem[cat] || 0) + 1;
  });

  let maxCat = '--';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(contagem)) {
    if (count > maxCount) {
      maxCount = count;
      maxCat = cat;
    }
  }

  document.getElementById('perd-categoria-freq').textContent = maxCat;
}

// ---- Render table body ----
function renderTabela(perdas) {
  const tbody = document.getElementById('perd-tbody');
  if (!tbody) return;

  atualizarCards(perdas);

  if (perdas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">report_problem</span>
            <p>Nenhuma perda registrada.</p>
            <p>Clique em <strong>Registrar Perda</strong> para lancar uma perda ou avaria.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort by date descending
  const sorted = [...perdas].sort((a, b) => new Date(b.data) - new Date(a.data));

  tbody.innerHTML = sorted.map(p => `
    <tr>
      <td>${formatarData(p.data)}</td>
      <td>${escapeText(p.produto_nome)}</td>
      <td>${Number(p.quantidade)}</td>
      <td>${escapeText(p.motivo)}</td>
      <td>${escapeText(p.categoria)}</td>
      <td>${formatarMoeda(p.valor)}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-sm btn-danger btn-remover" data-id="${p.id}" title="Remover">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </td>
    </tr>
  `).join('');
}

// ---- Load data and render ----
async function carregar() {
  try {
    const perdas = await listarTodos(STORE);
    renderTabela(perdas);
  } catch (error) {
    console.error('Erro ao carregar perdas:', error);
  }
}

// ---- Populate product select ----
async function popularProdutos() {
  const select = document.getElementById('perd-produto');
  if (!select) return;

  try {
    produtosCache = await listarTodos('produtos');

    select.innerHTML = '<option value="">-- Selecione --</option>' +
      produtosCache
        .filter(p => Number(p.quantidade_disponivel) > 0)
        .map(p => `<option value="${p.id}">${escapeText(p.nome)} (estoque: ${Number(p.quantidade_disponivel).toFixed(2)})</option>`)
        .join('');
  } catch (error) {
    console.error('Erro ao carregar produtos para select:', error);
  }
}

// ---- Populate category select ----
function popularCategorias() {
  const select = document.getElementById('perd-categoria');
  if (!select) return;

  select.innerHTML = '<option value="">-- Selecione --</option>' +
    CATEGORIAS.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
}

// ---- Get selected product from cache ----
function getProdutoSelecionado() {
  const select = document.getElementById('perd-produto');
  if (!select || !select.value) return null;

  const id = Number(select.value);
  return produtosCache.find(p => p.id === id) || null;
}

// ---- Update stock info and valor preview ----
function atualizarEstoqueInfo() {
  const infoEl = document.getElementById('perd-estoque-info');
  const qtdInput = document.getElementById('perd-quantidade');
  if (!infoEl) return;

  const produto = getProdutoSelecionado();
  if (!produto) {
    infoEl.textContent = '';
    if (qtdInput) {
      qtdInput.max = '';
    }
    atualizarValorPreview();
    return;
  }

  const disponivel = Number(produto.quantidade_disponivel);
  infoEl.textContent = `Estoque disponivel: ${disponivel.toFixed(2)} unidades`;

  if (qtdInput) {
    qtdInput.max = Math.floor(disponivel);
  }

  atualizarValorPreview();
}

function atualizarValorPreview() {
  const previewEl = document.getElementById('perd-valor-preview');
  if (!previewEl) return;

  const produto = getProdutoSelecionado();
  const qtd = parseInt(document.getElementById('perd-quantidade')?.value) || 0;

  if (!produto || qtd <= 0) {
    previewEl.textContent = 'R$ 0,00';
    return;
  }

  const custoMedio = Number(produto.custo_medio) || 0;
  const valor = qtd * custoMedio;
  previewEl.textContent = formatarMoeda(valor);
}

// ---- Open modal for new loss ----
async function abrirNovaPerda() {
  document.getElementById('formPerda')?.reset();
  document.getElementById('perd-estoque-info').textContent = '';
  document.getElementById('perd-valor-preview').textContent = 'R$ 0,00';

  await popularProdutos();
  popularCategorias();

  abrirModal('modalPerda');
}

// ---- Save loss ----
async function salvar() {
  const produtoId = Number(document.getElementById('perd-produto').value);
  const quantidade = parseInt(document.getElementById('perd-quantidade').value);
  const categoria = document.getElementById('perd-categoria').value;
  const motivo = document.getElementById('perd-motivo').value.trim();

  // Validation
  if (!produtoId || !quantidade || !categoria) {
    notificar('Preencha todos os campos obrigatorios.', 'erro');
    return;
  }

  if (quantidade <= 0) {
    notificar('A quantidade deve ser maior que zero.', 'erro');
    return;
  }

  // Fetch fresh product data to validate stock
  let produto;
  try {
    produto = await buscarPorId('produtos', produtoId);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    notificar('Erro ao buscar produto.', 'erro');
    return;
  }

  if (!produto) {
    notificar('Produto nao encontrado.', 'erro');
    return;
  }

  const disponivel = Number(produto.quantidade_disponivel) || 0;

  if (quantidade > disponivel) {
    notificar(`Quantidade excede o estoque disponivel (${disponivel.toFixed(2)}).`, 'erro');
    return;
  }

  const custoMedio = Number(produto.custo_medio) || 0;
  const valor = quantidade * custoMedio;
  const agora = new Date().toISOString();

  try {
    // 1. Deduct from product stock
    produto.quantidade_disponivel = disponivel - quantidade;
    await atualizar('produtos', produto);

    // 2. Save perda record
    await adicionar(STORE, {
      produto_id: produtoId,
      produto_nome: produto.nome,
      quantidade,
      categoria,
      motivo,
      valor,
      data: agora,
      data_criacao: agora
    });

    // 3. Create financial entry (saida)
    await adicionar('financeiro', {
      tipo: 'saida',
      categoria: 'perda',
      descricao: `Perda: ${quantidade} un de ${produto.nome} (${categoria})`,
      valor,
      data: agora,
      origem: 'perda',
      data_criacao: agora
    });

    notificar('Perda registrada!');
    fecharModal('modalPerda');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar perda:', error);
    notificar('Erro ao registrar perda.', 'erro');
  }
}

// ---- Remove loss record ----
async function removerPerda(id) {
  if (!confirmar('Deseja realmente remover este registro de perda?')) return;

  try {
    await remover(STORE, id);
    notificar('Registro removido!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover perda:', error);
    notificar('Erro ao remover registro.', 'erro');
  }
}

// ---- Init (event binding) ----
export async function init() {
  // Load and render data
  await carregar();

  // Modal close handlers
  initModalClose('modalPerda');

  // "Registrar Perda" button
  document.getElementById('btnRegistrarPerda')?.addEventListener('click', abrirNovaPerda);

  // Save button
  document.getElementById('btnSalvarPerda')?.addEventListener('click', salvar);

  // Product select change -> update stock info and valor preview
  document.getElementById('perd-produto')?.addEventListener('change', () => {
    atualizarEstoqueInfo();
    // Reset quantity when product changes
    const qtdInput = document.getElementById('perd-quantidade');
    if (qtdInput) qtdInput.value = '';
    atualizarValorPreview();
  });

  // Quantity change -> update valor preview
  document.getElementById('perd-quantidade')?.addEventListener('input', atualizarValorPreview);

  // Delegate table actions (delete)
  document.getElementById('perd-tbody')?.addEventListener('click', (e) => {
    const btnRemover = e.target.closest('.btn-remover');
    if (btnRemover) {
      const id = Number(btnRemover.dataset.id);
      removerPerda(id);
    }
  });
}
