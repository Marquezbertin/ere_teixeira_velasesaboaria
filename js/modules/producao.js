// ============================================
// PRODUCAO (Production - Batch Manufacturing)
// Nervo Saboaria - ERP Artesanal
// ============================================

import { listarTodos, adicionar, atualizar, buscarPorId, buscarPorIndice } from '../db.js';
import {
  formatarMoeda,
  formatarData,
  notificar,
  abrirModal,
  fecharModal,
  initModalClose,
  confirmar
} from '../utils/helpers.js';

const STORE = 'producao';
const STORE_RECEITAS = 'receitas';
const STORE_RECEITA_INSUMOS = 'receita_insumos';
const STORE_INSUMOS = 'insumos';
const STORE_PRODUTOS = 'produtos';
const STORE_FINANCEIRO = 'financeiro';

let receitasCache = [];
let insumosCache = [];
let receitaSelecionada = null;
let insumosReceita = [];

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Produ\u00e7\u00e3o</h2>
      <button class="btn btn-primary" id="btnNovaProducao">
        <span class="material-symbols-outlined">add</span>
        Nova Produ\u00e7\u00e3o
      </button>
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Receita</th>
            <th>Qtd. Produzida</th>
            <th>Custo Total</th>
            <th>A\u00e7\u00f5es</th>
          </tr>
        </thead>
        <tbody id="producao-tbody">
          <tr><td colspan="5">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Producao -->
    <div class="modal" id="modalProducao">
      <div class="modal-overlay"></div>
      <div class="modal-dialog lg">
        <div class="modal-header">
          <h3>Nova Produ\u00e7\u00e3o</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formProducao">
            <div class="form-group">
              <label for="prod-receita">Receita *</label>
              <select id="prod-receita">
                <option value="">-- Selecione uma receita --</option>
              </select>
            </div>

            <div id="prod-receita-detalhes" style="display:none;">
              <div class="form-group">
                <label for="prod-quantidade">Quantidade a Produzir *</label>
                <input type="number" id="prod-quantidade" step="1" min="1" value="1">
              </div>

              <h4 class="section-title">Insumos Necess\u00e1rios</h4>
              <div id="prod-insumos-check">
                <!-- Dynamic insumos availability list -->
              </div>

              <div class="custo-resumo" id="prod-custo" style="margin-top:16px;">
                <div class="custo-line total">
                  <span>Custo Total da Produ\u00e7\u00e3o</span>
                  <span id="prod-custo-valor">R$ 0,00</span>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnConfirmarProducao">Confirmar Produ\u00e7\u00e3o</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Render production history table ----
function renderTabela(producoes) {
  const tbody = document.getElementById('producao-tbody');
  if (!tbody) return;

  if (producoes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">precision_manufacturing</span>
            <p>Nenhuma produ\u00e7\u00e3o registrada.</p>
            <p>Clique em <strong>Nova Produ\u00e7\u00e3o</strong> para come\u00e7ar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort by date descending (most recent first)
  const sorted = [...producoes].sort((a, b) => {
    return new Date(b.data_producao) - new Date(a.data_producao);
  });

  tbody.innerHTML = sorted.map(p => `
    <tr>
      <td>${formatarData(p.data_producao)}</td>
      <td>${escapeText(p.receita_nome)}</td>
      <td>${Number(p.quantidade_produzida)}</td>
      <td>${formatarMoeda(p.custo_total)}</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-sm btn-ver" data-id="${p.id}" title="Ver Detalhes">
          <span class="material-symbols-outlined">visibility</span>
        </button>
      </td>
    </tr>
  `).join('');
}

// ---- Simple text escape (no escapeHtml import needed) ----
function escapeText(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Load data and render table ----
async function carregar() {
  try {
    const producoes = await listarTodos(STORE);
    renderTabela(producoes);
  } catch (error) {
    console.error('Erro ao carregar producoes:', error);
  }
}

// ---- Load caches ----
async function carregarCaches() {
  try {
    receitasCache = await listarTodos(STORE_RECEITAS);
    insumosCache = await listarTodos(STORE_INSUMOS);
  } catch (error) {
    console.error('Erro ao carregar caches:', error);
    receitasCache = [];
    insumosCache = [];
  }
}

// ---- Populate recipe select ----
function popularSelectReceitas() {
  const select = document.getElementById('prod-receita');
  if (!select) return;

  let html = '<option value="">-- Selecione uma receita --</option>';
  for (const r of receitasCache) {
    html += `<option value="${r.id}">${escapeText(r.nome_produto)} (Rend: ${r.rendimento} un)</option>`;
  }
  select.innerHTML = html;
}

// ---- When a recipe is selected ----
async function aoSelecionarReceita() {
  const select = document.getElementById('prod-receita');
  const detalhesDiv = document.getElementById('prod-receita-detalhes');
  const receitaId = select?.value ? Number(select.value) : null;

  if (!receitaId) {
    receitaSelecionada = null;
    insumosReceita = [];
    if (detalhesDiv) detalhesDiv.style.display = 'none';
    return;
  }

  try {
    receitaSelecionada = await buscarPorId(STORE_RECEITAS, receitaId);
    insumosReceita = await buscarPorIndice(STORE_RECEITA_INSUMOS, 'receita_id', receitaId);

    // Refresh insumos cache to get latest stock
    insumosCache = await listarTodos(STORE_INSUMOS);

    if (detalhesDiv) detalhesDiv.style.display = 'block';

    // Reset quantity to 1
    const qtdInput = document.getElementById('prod-quantidade');
    if (qtdInput) qtdInput.value = 1;

    atualizarInsumosCheck();
    atualizarCustoTotal();
  } catch (error) {
    console.error('Erro ao carregar receita selecionada:', error);
  }
}

// ---- Update insumos availability check ----
function atualizarInsumosCheck() {
  const container = document.getElementById('prod-insumos-check');
  if (!container || !receitaSelecionada) return;

  const quantidade = Math.max(parseInt(document.getElementById('prod-quantidade')?.value) || 0, 0);
  const rendimento = receitaSelecionada.rendimento || 1;

  if (insumosReceita.length === 0) {
    container.innerHTML = '<div class="alert alert-warning">Esta receita n\u00e3o possui ingredientes cadastrados.</div>';
    return;
  }

  let html = '<table class="table" style="margin-top:8px;"><thead><tr>' +
    '<th>Insumo</th><th>Necessario</th><th>Disponivel</th><th>Status</th>' +
    '</tr></thead><tbody>';

  let todosDisponiveis = true;

  for (const ri of insumosReceita) {
    const insumo = insumosCache.find(i => i.id === ri.insumo_id);
    const nomeInsumo = insumo ? escapeText(insumo.nome) : 'Insumo removido';
    const unidade = insumo ? escapeText(insumo.unidade_medida) : '';
    const disponivel = insumo ? (insumo.quantidade_atual || 0) : 0;

    // Required = (receita_insumo.quantidade_utilizada / receita.rendimento) * quantidade_produzida
    const necessario = (ri.quantidade_utilizada / rendimento) * quantidade;
    const suficiente = disponivel >= necessario;

    if (!suficiente) todosDisponiveis = false;

    const badgeClass = suficiente ? 'badge-success' : 'badge-danger';
    const badgeText = suficiente ? 'OK' : 'Insuficiente';

    html += `
      <tr>
        <td>${nomeInsumo}</td>
        <td>${necessario.toFixed(2)} ${unidade}</td>
        <td>${disponivel.toFixed(2)} ${unidade}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      </tr>
    `;
  }

  html += '</tbody></table>';

  if (!todosDisponiveis && quantidade > 0) {
    html += '<div class="alert alert-danger" style="margin-top:8px;">Estoque insuficiente para um ou mais insumos. Ajuste a quantidade ou reponha o estoque.</div>';
  }

  container.innerHTML = html;
}

// ---- Update total cost display ----
function atualizarCustoTotal() {
  const custoValorEl = document.getElementById('prod-custo-valor');
  if (!custoValorEl || !receitaSelecionada) return;

  const quantidade = Math.max(parseInt(document.getElementById('prod-quantidade')?.value) || 0, 0);
  const custoTotal = (receitaSelecionada.custo_unitario || 0) * quantidade;

  custoValorEl.textContent = formatarMoeda(custoTotal);
}

// ---- Validate all insumos have sufficient stock ----
function validarEstoque(quantidade) {
  if (!receitaSelecionada || insumosReceita.length === 0) return false;

  const rendimento = receitaSelecionada.rendimento || 1;

  for (const ri of insumosReceita) {
    const insumo = insumosCache.find(i => i.id === ri.insumo_id);
    if (!insumo) return false;

    const necessario = (ri.quantidade_utilizada / rendimento) * quantidade;
    if (insumo.quantidade_atual < necessario) return false;
  }

  return true;
}

// ---- Confirm and execute production ----
async function confirmarProducao() {
  // Validate recipe selected
  if (!receitaSelecionada) {
    notificar('Selecione uma receita.', 'erro');
    return;
  }

  // Validate quantity
  const quantidade = parseInt(document.getElementById('prod-quantidade')?.value) || 0;
  if (quantidade <= 0) {
    notificar('A quantidade deve ser maior que zero.', 'erro');
    return;
  }

  // Refresh insumos cache to ensure latest stock values
  insumosCache = await listarTodos(STORE_INSUMOS);

  // Validate stock availability
  if (!validarEstoque(quantidade)) {
    notificar('Estoque insuficiente para produzir esta quantidade.', 'erro');
    return;
  }

  if (!confirmar(`Confirma a produ\u00e7\u00e3o de ${quantidade} unidade(s) de "${receitaSelecionada.nome_produto}"?`)) {
    return;
  }

  const rendimento = receitaSelecionada.rendimento || 1;
  const custoTotal = (receitaSelecionada.custo_unitario || 0) * quantidade;

  try {
    // 1) Deduct insumos from stock
    for (const ri of insumosReceita) {
      const insumo = await buscarPorId(STORE_INSUMOS, ri.insumo_id);
      if (!insumo) continue;

      const necessario = (ri.quantidade_utilizada / rendimento) * quantidade;
      insumo.quantidade_atual = Math.max((insumo.quantidade_atual || 0) - necessario, 0);
      await atualizar(STORE_INSUMOS, insumo);
    }

    // 2) Find or create the product
    const todosProdutos = await listarTodos(STORE_PRODUTOS);
    let produto = todosProdutos.find(p =>
      p.nome && p.nome.toLowerCase() === receitaSelecionada.nome_produto.toLowerCase()
    );

    if (produto) {
      // Update existing product - recalculate custo_medio
      const estoqueAtual = produto.quantidade_disponivel || 0;
      const custoAtual = produto.custo_medio || 0;

      // novo_custo_medio = (estoque_atual * custo_atual + novo_custo) / (estoque_atual + nova_qtd)
      const novoCustoMedio = (estoqueAtual + quantidade) > 0
        ? ((estoqueAtual * custoAtual) + custoTotal) / (estoqueAtual + quantidade)
        : 0;

      produto.quantidade_disponivel = estoqueAtual + quantidade;
      produto.custo_medio = novoCustoMedio;
      await atualizar(STORE_PRODUTOS, produto);
    } else {
      // Create new product
      await adicionar(STORE_PRODUTOS, {
        nome: receitaSelecionada.nome_produto,
        quantidade_disponivel: quantidade,
        custo_medio: receitaSelecionada.custo_unitario || 0,
        preco_venda: receitaSelecionada.preco_sugerido || 0,
        data_criacao: new Date().toISOString()
      });
    }

    // 3) Save production record
    await adicionar(STORE, {
      receita_id: receitaSelecionada.id,
      receita_nome: receitaSelecionada.nome_produto,
      quantidade_produzida: quantidade,
      custo_total: custoTotal,
      data_producao: new Date().toISOString()
    });

    // 4) Create financial entry (saida)
    await adicionar(STORE_FINANCEIRO, {
      tipo: 'saida',
      categoria: 'producao',
      descricao: `Producao: ${quantidade} un de ${receitaSelecionada.nome_produto}`,
      valor: custoTotal,
      data: new Date().toISOString(),
      origem: 'producao'
    });

    fecharModal('modalProducao');
    notificar('Producao registrada!');
    await carregar();
  } catch (error) {
    console.error('Erro ao registrar producao:', error);
    notificar('Erro ao registrar producao.', 'erro');
  }
}

// ---- View production detail ----
async function verDetalhe(id) {
  try {
    const producao = await buscarPorId(STORE, id);
    if (!producao) return;

    const msg = `Produ\u00e7\u00e3o #${producao.id}\n\n` +
      `Receita: ${producao.receita_nome}\n` +
      `Quantidade: ${producao.quantidade_produzida} un\n` +
      `Custo Total: ${formatarMoeda(producao.custo_total)}\n` +
      `Data: ${formatarData(producao.data_producao)}`;

    alert(msg);
  } catch (error) {
    console.error('Erro ao carregar detalhes da producao:', error);
  }
}

// ---- Open modal for new production ----
async function abrirNovo() {
  receitaSelecionada = null;
  insumosReceita = [];

  await carregarCaches();
  popularSelectReceitas();

  // Reset form state
  const detalhesDiv = document.getElementById('prod-receita-detalhes');
  if (detalhesDiv) detalhesDiv.style.display = 'none';

  const insumosCheck = document.getElementById('prod-insumos-check');
  if (insumosCheck) insumosCheck.innerHTML = '';

  const custoValor = document.getElementById('prod-custo-valor');
  if (custoValor) custoValor.textContent = formatarMoeda(0);

  const selectReceita = document.getElementById('prod-receita');
  if (selectReceita) selectReceita.value = '';

  const qtdInput = document.getElementById('prod-quantidade');
  if (qtdInput) qtdInput.value = 1;

  abrirModal('modalProducao');
}

// ---- Init (load data + set up listeners) ----
export async function init() {
  // Load and render production history
  await carregar();

  // Modal close handlers
  initModalClose('modalProducao');

  // "Nova Producao" button
  document.getElementById('btnNovaProducao')?.addEventListener('click', abrirNovo);

  // Recipe select change
  document.getElementById('prod-receita')?.addEventListener('change', aoSelecionarReceita);

  // Quantity input change - update insumos check and cost
  document.getElementById('prod-quantidade')?.addEventListener('input', () => {
    atualizarInsumosCheck();
    atualizarCustoTotal();
  });

  // Confirm production button
  document.getElementById('btnConfirmarProducao')?.addEventListener('click', confirmarProducao);

  // Delegate table actions (view detail)
  document.getElementById('producao-tbody')?.addEventListener('click', (e) => {
    const btnVer = e.target.closest('.btn-ver');
    if (btnVer) {
      const id = Number(btnVer.dataset.id);
      verDetalhe(id);
    }
  });
}
