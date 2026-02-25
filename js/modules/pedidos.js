// ============================================
// PEDIDOS (Orders)
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
  confirmar,
  badgeStatus
} from '../utils/helpers.js';

const STORE = 'pedidos';
const STORE_ITENS = 'pedido_itens';
const STORE_PRODUTOS = 'produtos';
const STORE_FINANCEIRO = 'financeiro';

let editandoId = null;
let itensTemp = [];       // Current order items in the modal
let produtosCache = [];   // Cached products list for dropdowns
let filtroAtual = 'todos';

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Pedidos</h2>
      <button class="btn btn-primary" id="btnNovoPedido">
        <span class="material-symbols-outlined">add</span>
        Novo Pedido
      </button>
    </div>

    <div class="search-box">
      <span class="material-symbols-outlined">search</span>
      <input type="text" id="busca-pedidos" placeholder="Buscar por cliente..." autocomplete="off">
    </div>

    <div class="tabs" id="pedidos-tabs">
      <button class="tab-btn active" data-filtro="todos">Todos</button>
      <button class="tab-btn" data-filtro="pendente">Pendentes</button>
      <button class="tab-btn" data-filtro="confirmado">Confirmados</button>
      <button class="tab-btn" data-filtro="entregue">Entregues</button>
      <button class="tab-btn" data-filtro="cancelado">Cancelados</button>
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Data</th>
            <th>Itens</th>
            <th>Valor Total</th>
            <th>Status</th>
            <th>Pagamento</th>
            <th>A\u00e7\u00f5es</th>
          </tr>
        </thead>
        <tbody id="pedidos-tbody">
          <tr><td colspan="8">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Pedido (Add/Edit) -->
    <div class="modal" id="modalPedido">
      <div class="modal-overlay"></div>
      <div class="modal-dialog lg">
        <div class="modal-header">
          <h3 id="modalPedidoTitulo">Novo Pedido</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formPedido">
            <div class="form-row">
              <div class="form-group">
                <label for="ped-cliente">Cliente *</label>
                <input type="text" id="ped-cliente" required placeholder="Nome do cliente">
              </div>
              <div class="form-group">
                <label for="ped-data">Data do Pedido</label>
                <input type="date" id="ped-data">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="ped-pagamento">Forma de Pagamento</label>
                <select id="ped-pagamento">
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartao">Cart\u00e3o</option>
                  <option value="Transferencia">Transfer\u00eancia</option>
                  <option value="Fiado">Fiado</option>
                </select>
              </div>
              <div class="form-group"></div>
            </div>

            <!-- Itens do Pedido Section -->
            <h4 class="section-title">Itens do Pedido</h4>
            <div class="ingredientes-list">
              <div class="ing-header">
                <span>Produto</span>
                <span>Qtd</span>
                <span>Pre\u00e7o Unit.</span>
                <span>Subtotal</span>
                <span></span>
              </div>
              <div id="ped-itens">
                <!-- Dynamic item rows go here -->
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnAdicionarItem" style="margin-top:10px;">
              <span class="material-symbols-outlined">add</span>
              Adicionar Item
            </button>

            <!-- Total Summary -->
            <div class="custo-resumo" style="margin-top:20px;">
              <div class="custo-line total">
                <span>Total do Pedido</span>
                <span id="ped-total">R$ 0,00</span>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarPedido">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Render table body ----
function renderTabela(pedidos) {
  const tbody = document.getElementById('pedidos-tbody');
  if (!tbody) return;

  // Apply status filter
  let lista = filtroAtual === 'todos'
    ? pedidos
    : pedidos.filter(p => p.status === filtroAtual);

  // Apply text search
  const busca = (document.getElementById('busca-pedidos')?.value || '').toLowerCase();
  if (busca) {
    lista = lista.filter(p => (p.cliente_nome || '').toLowerCase().includes(busca));
  }

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">shopping_cart</span>
            <p>Nenhum pedido encontrado.</p>
            <p>Clique em <strong>Novo Pedido</strong> para come\u00e7ar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const qtdItens = p._qtdItens ?? 0;

    // Build action buttons based on status
    let acoesBtns = '';

    if (p.status === 'pendente') {
      acoesBtns += `
        <button class="btn btn-icon btn-sm btn-success btn-confirmar" data-id="${p.id}" title="Confirmar Pedido">
          <span class="material-symbols-outlined">check_circle</span>
        </button>
        <button class="btn btn-icon btn-sm btn-warning btn-cancelar-pedido" data-id="${p.id}" title="Cancelar Pedido">
          <span class="material-symbols-outlined">cancel</span>
        </button>
      `;
    }

    if (p.status === 'confirmado') {
      acoesBtns += `
        <button class="btn btn-icon btn-sm btn-success btn-entregar" data-id="${p.id}" title="Marcar como Entregue">
          <span class="material-symbols-outlined">local_shipping</span>
        </button>
        <button class="btn btn-icon btn-sm btn-warning btn-cancelar-pedido" data-id="${p.id}" title="Cancelar Pedido">
          <span class="material-symbols-outlined">cancel</span>
        </button>
      `;
    }

    // Edit only for pendente
    if (p.status === 'pendente') {
      acoesBtns += `
        <button class="btn btn-icon btn-sm btn-editar" data-id="${p.id}" title="Editar">
          <span class="material-symbols-outlined">edit</span>
        </button>
      `;
    }

    // Delete always available
    acoesBtns += `
      <button class="btn btn-icon btn-sm btn-danger btn-remover" data-id="${p.id}" title="Remover">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `;

    return `
      <tr>
        <td>${p.id}</td>
        <td>${escapeHtml(p.cliente_nome)}</td>
        <td>${formatarData(p.data_pedido)}</td>
        <td>${qtdItens}</td>
        <td>${formatarMoeda(p.valor_total)}</td>
        <td>${badgeStatus(p.status)}</td>
        <td>${escapeHtml(p.forma_pagamento)}</td>
        <td class="table-actions">${acoesBtns}</td>
      </tr>
    `;
  }).join('');
}

// ---- Load products for dropdown ----
async function carregarProdutos() {
  try {
    produtosCache = await listarTodos(STORE_PRODUTOS);
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    produtosCache = [];
  }
}

// ---- Build product <select> options ----
function buildProdutoOptions(selectedId) {
  let html = '<option value="">-- Selecione --</option>';
  if (produtosCache.length === 0) {
    html = '<option value="">Nenhum produto cadastrado</option>';
    return html;
  }
  for (const prod of produtosCache) {
    const sel = prod.id === selectedId ? 'selected' : '';
    const estoque = Number(prod.quantidade_disponivel || 0).toFixed(0);
    html += `<option value="${prod.id}" ${sel}>${escapeHtml(prod.nome)} (Estoque: ${estoque} - ${formatarMoeda(prod.preco_venda)})</option>`;
  }
  return html;
}

// ---- Render item rows inside the modal ----
function renderItens() {
  const container = document.getElementById('ped-itens');
  if (!container) return;

  if (itensTemp.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-secondary);font-size:0.85rem;">Nenhum item adicionado.</div>';
    recalcularTotal();
    return;
  }

  container.innerHTML = itensTemp.map((item, idx) => {
    const subtotal = (item.quantidade || 0) * (item.preco_unitario || 0);

    return `
      <div class="ingrediente-row" data-idx="${idx}">
        <select class="item-select" data-idx="${idx}">
          ${buildProdutoOptions(item.produto_id)}
        </select>
        <input type="number" class="item-qtd" data-idx="${idx}" step="1" min="1" value="${item.quantidade || 1}" style="width:80px;">
        <input type="number" class="item-preco" data-idx="${idx}" step="0.01" min="0" value="${(item.preco_unitario || 0).toFixed(2)}" style="width:100px;">
        <span class="ing-custo" style="font-size:0.85rem;color:var(--text-secondary);min-width:90px;">${formatarMoeda(subtotal)}</span>
        <button type="button" class="remove-ing" data-idx="${idx}" title="Remover item">&times;</button>
      </div>
    `;
  }).join('');

  recalcularTotal();
}

// ---- Add an empty item row ----
function adicionarItem() {
  if (produtosCache.length === 0) {
    notificar('Nenhum produto cadastrado. Cadastre produtos antes de criar pedidos.', 'erro');
    return;
  }
  itensTemp.push({
    produto_id: null,
    produto_nome: '',
    quantidade: 1,
    preco_unitario: 0
  });
  renderItens();
}

// ---- Remove an item row ----
function removerItem(idx) {
  itensTemp.splice(idx, 1);
  renderItens();
}

// ---- Recalculate order total ----
function recalcularTotal() {
  let total = 0;
  for (const item of itensTemp) {
    total += (item.quantidade || 0) * (item.preco_unitario || 0);
  }

  const elTotal = document.getElementById('ped-total');
  if (elTotal) elTotal.textContent = formatarMoeda(total);

  // Update individual row subtotals
  const rows = document.querySelectorAll('#ped-itens .ingrediente-row');
  rows.forEach((row, idx) => {
    const item = itensTemp[idx];
    if (!item) return;
    const subtotal = (item.quantidade || 0) * (item.preco_unitario || 0);
    const custoSpan = row.querySelector('.ing-custo');
    if (custoSpan) custoSpan.textContent = formatarMoeda(subtotal);
  });
}

// ---- Calculate total from itensTemp ----
function calcularValorTotal() {
  let total = 0;
  for (const item of itensTemp) {
    total += (item.quantidade || 0) * (item.preco_unitario || 0);
  }
  return total;
}

// ---- Load data and render table ----
async function carregar() {
  try {
    const pedidos = await listarTodos(STORE);
    const todosItens = await listarTodos(STORE_ITENS);

    // Attach item count to each pedido for display
    for (const p of pedidos) {
      p._qtdItens = todosItens.filter(i => i.pedido_id === p.id).length;
    }

    // Sort by id descending (most recent first)
    pedidos.sort((a, b) => b.id - a.id);

    renderTabela(pedidos);
  } catch (error) {
    console.error('Erro ao carregar pedidos:', error);
  }
}

// ---- Get today's date as YYYY-MM-DD ----
function dataHoje() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// ---- Open modal for new order ----
async function abrirNovo() {
  editandoId = null;
  document.getElementById('modalPedidoTitulo').textContent = 'Novo Pedido';
  document.getElementById('formPedido').reset();
  document.getElementById('ped-data').value = dataHoje();
  document.getElementById('ped-pagamento').value = 'Dinheiro';
  itensTemp = [];
  await carregarProdutos();
  renderItens();
  abrirModal('modalPedido');
}

// ---- Open modal for editing ----
async function abrirEdicao(id) {
  try {
    const pedido = await buscarPorId(STORE, id);
    if (!pedido) return;

    // Only allow editing pendente orders
    if (pedido.status !== 'pendente') {
      notificar('Apenas pedidos pendentes podem ser editados.', 'erro');
      return;
    }

    editandoId = id;
    document.getElementById('modalPedidoTitulo').textContent = 'Editar Pedido';

    document.getElementById('ped-cliente').value = pedido.cliente_nome || '';
    document.getElementById('ped-data').value = pedido.data_pedido || dataHoje();
    document.getElementById('ped-pagamento').value = pedido.forma_pagamento || 'Dinheiro';

    // Load products cache and order items
    await carregarProdutos();
    const pedidoItens = await listarTodos(STORE_ITENS);
    const itensDoPedido = pedidoItens.filter(i => i.pedido_id === id);

    itensTemp = itensDoPedido.map(i => ({
      produto_id: i.produto_id,
      produto_nome: i.produto_nome || '',
      quantidade: i.quantidade || 1,
      preco_unitario: i.preco_unitario || 0
    }));

    renderItens();
    abrirModal('modalPedido');
  } catch (error) {
    console.error('Erro ao carregar pedido para edi\u00e7\u00e3o:', error);
  }
}

// ---- Save (add or update) ----
async function salvar() {
  const cliente = document.getElementById('ped-cliente').value.trim();
  if (!cliente) {
    notificar('Informe o nome do cliente.', 'erro');
    return;
  }

  if (itensTemp.length === 0) {
    notificar('Adicione pelo menos um item ao pedido.', 'erro');
    return;
  }

  // Validate all items have a product selected
  for (let i = 0; i < itensTemp.length; i++) {
    if (!itensTemp[i].produto_id) {
      notificar(`Selecione o produto do item ${i + 1}.`, 'erro');
      return;
    }
    if (!itensTemp[i].quantidade || itensTemp[i].quantidade <= 0) {
      notificar(`Informe a quantidade do item ${i + 1}.`, 'erro');
      return;
    }
  }

  const valorTotal = calcularValorTotal();

  const dados = {
    cliente_nome: cliente,
    data_pedido: document.getElementById('ped-data').value || dataHoje(),
    forma_pagamento: document.getElementById('ped-pagamento').value || 'Dinheiro',
    valor_total: valorTotal,
    status: 'pendente'
  };

  try {
    let pedidoId;

    if (editandoId) {
      const original = await buscarPorId(STORE, editandoId);
      dados.id = editandoId;
      dados.status = original?.status || 'pendente';
      dados.data_criacao = original?.data_criacao || new Date().toISOString();
      await atualizar(STORE, dados);
      pedidoId = editandoId;
    } else {
      dados.data_criacao = new Date().toISOString();
      pedidoId = await adicionar(STORE, dados);
    }

    // Delete old pedido_itens for this order
    const todosItens = await listarTodos(STORE_ITENS);
    const itensAntigos = todosItens.filter(i => i.pedido_id === pedidoId);
    for (const old of itensAntigos) {
      await remover(STORE_ITENS, old.id);
    }

    // Save new pedido_itens
    for (const item of itensTemp) {
      if (item.produto_id) {
        const produto = produtosCache.find(p => p.id === item.produto_id);
        await adicionar(STORE_ITENS, {
          pedido_id: pedidoId,
          produto_id: item.produto_id,
          produto_nome: produto ? produto.nome : item.produto_nome,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario
        });
      }
    }

    fecharModal('modalPedido');
    notificar('Pedido salvo!');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar pedido:', error);
    notificar('Erro ao salvar pedido.', 'erro');
  }
}

// ---- Status change: Confirmar ----
async function confirmarPedido(id) {
  if (!confirmar('Confirmar este pedido? O estoque dos produtos sera deduzido.')) return;

  try {
    const pedido = await buscarPorId(STORE, id);
    if (!pedido || pedido.status !== 'pendente') {
      notificar('Pedido nao pode ser confirmado.', 'erro');
      return;
    }

    // Load items for this order
    const todosItens = await listarTodos(STORE_ITENS);
    const itensDoPedido = todosItens.filter(i => i.pedido_id === id);

    // Check stock availability before confirming
    for (const item of itensDoPedido) {
      const produto = await buscarPorId(STORE_PRODUTOS, item.produto_id);
      if (!produto) {
        notificar(`Produto "${escapeHtml(item.produto_nome)}" nao encontrado.`, 'erro');
        return;
      }
      if ((produto.quantidade_disponivel || 0) < item.quantidade) {
        notificar(`Estoque insuficiente para "${escapeHtml(item.produto_nome)}". Disponivel: ${produto.quantidade_disponivel}, Necessario: ${item.quantidade}`, 'erro');
        return;
      }
    }

    // Deduct stock for each item
    for (const item of itensDoPedido) {
      const produto = await buscarPorId(STORE_PRODUTOS, item.produto_id);
      produto.quantidade_disponivel = (produto.quantidade_disponivel || 0) - item.quantidade;
      await atualizar(STORE_PRODUTOS, produto);
    }

    // Create financial entry
    await adicionar(STORE_FINANCEIRO, {
      tipo: 'entrada',
      categoria: 'venda',
      descricao: `Pedido #${id} - ${pedido.cliente_nome}`,
      valor: pedido.valor_total,
      data: new Date().toISOString(),
      origem: 'pedido',
      pedido_id: id
    });

    // Update order status
    pedido.status = 'confirmado';
    await atualizar(STORE, pedido);

    notificar('Pedido confirmado! Estoque atualizado.');
    await carregar();
  } catch (error) {
    console.error('Erro ao confirmar pedido:', error);
    notificar('Erro ao confirmar pedido.', 'erro');
  }
}

// ---- Status change: Entregar ----
async function entregarPedido(id) {
  if (!confirmar('Marcar este pedido como entregue?')) return;

  try {
    const pedido = await buscarPorId(STORE, id);
    if (!pedido || pedido.status !== 'confirmado') {
      notificar('Apenas pedidos confirmados podem ser entregues.', 'erro');
      return;
    }

    pedido.status = 'entregue';
    await atualizar(STORE, pedido);

    notificar('Pedido marcado como entregue!');
    await carregar();
  } catch (error) {
    console.error('Erro ao entregar pedido:', error);
    notificar('Erro ao atualizar pedido.', 'erro');
  }
}

// ---- Status change: Cancelar ----
async function cancelarPedido(id) {
  if (!confirmar('Cancelar este pedido? Se ja confirmado, o estoque sera devolvido e o lancamento financeiro sera revertido.')) return;

  try {
    const pedido = await buscarPorId(STORE, id);
    if (!pedido) return;

    if (pedido.status !== 'pendente' && pedido.status !== 'confirmado') {
      notificar('Este pedido nao pode ser cancelado.', 'erro');
      return;
    }

    // If the order was confirmed, reverse stock and financial entry
    if (pedido.status === 'confirmado') {
      // Return products to stock
      const todosItens = await listarTodos(STORE_ITENS);
      const itensDoPedido = todosItens.filter(i => i.pedido_id === id);

      for (const item of itensDoPedido) {
        const produto = await buscarPorId(STORE_PRODUTOS, item.produto_id);
        if (produto) {
          produto.quantidade_disponivel = (produto.quantidade_disponivel || 0) + item.quantidade;
          await atualizar(STORE_PRODUTOS, produto);
        }
      }

      // Remove financial entry or create reversal
      const lancamentos = await listarTodos(STORE_FINANCEIRO);
      const lancamentoPedido = lancamentos.find(
        l => l.origem === 'pedido' && l.pedido_id === id
      );

      if (lancamentoPedido) {
        await remover(STORE_FINANCEIRO, lancamentoPedido.id);
      }

      // Create a reversal entry for audit trail
      await adicionar(STORE_FINANCEIRO, {
        tipo: 'saida',
        categoria: 'estorno',
        descricao: `Estorno - Pedido #${id} - ${pedido.cliente_nome} (Cancelado)`,
        valor: pedido.valor_total,
        data: new Date().toISOString(),
        origem: 'pedido_cancelado',
        pedido_id: id
      });
    }

    // Update order status
    pedido.status = 'cancelado';
    await atualizar(STORE, pedido);

    notificar('Pedido cancelado!');
    await carregar();
  } catch (error) {
    console.error('Erro ao cancelar pedido:', error);
    notificar('Erro ao cancelar pedido.', 'erro');
  }
}

// ---- Remove with confirmation ----
async function removePedido(id) {
  const pedido = await buscarPorId(STORE, id);
  if (!pedido) return;

  if (pedido.status === 'confirmado') {
    notificar('Cancele o pedido antes de remover.', 'erro');
    return;
  }

  if (!confirmar('Deseja remover este pedido e todos os seus itens?')) return;

  try {
    // Remove associated pedido_itens first
    const todosItens = await listarTodos(STORE_ITENS);
    const itensDoPedido = todosItens.filter(i => i.pedido_id === id);
    for (const item of itensDoPedido) {
      await remover(STORE_ITENS, item.id);
    }

    await remover(STORE, id);
    notificar('Pedido removido!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover pedido:', error);
    notificar('Erro ao remover pedido.', 'erro');
  }
}

// ---- Handle item events (delegated) ----
function handleItemEvents(e) {
  const target = e.target;

  // Product select changed
  if (target.classList.contains('item-select')) {
    const idx = parseInt(target.dataset.idx);
    const val = target.value ? Number(target.value) : null;
    if (itensTemp[idx] !== undefined) {
      itensTemp[idx].produto_id = val;
      // Auto-fill price from product
      if (val) {
        const produto = produtosCache.find(p => p.id === val);
        if (produto) {
          itensTemp[idx].produto_nome = produto.nome;
          itensTemp[idx].preco_unitario = produto.preco_venda || 0;
          // Update the price input in the row
          const row = target.closest('.ingrediente-row');
          const precoInput = row?.querySelector('.item-preco');
          if (precoInput) precoInput.value = (produto.preco_venda || 0).toFixed(2);
        }
      } else {
        itensTemp[idx].produto_nome = '';
        itensTemp[idx].preco_unitario = 0;
      }
      recalcularTotal();
    }
    return;
  }

  // Quantity input changed
  if (target.classList.contains('item-qtd')) {
    const idx = parseInt(target.dataset.idx);
    const val = parseInt(target.value) || 0;
    if (itensTemp[idx] !== undefined) {
      itensTemp[idx].quantidade = Math.max(val, 0);
      recalcularTotal();
    }
    return;
  }

  // Price input changed
  if (target.classList.contains('item-preco')) {
    const idx = parseInt(target.dataset.idx);
    const val = parseFloat(target.value) || 0;
    if (itensTemp[idx] !== undefined) {
      itensTemp[idx].preco_unitario = Math.max(val, 0);
      recalcularTotal();
    }
    return;
  }

  // Remove item button
  if (target.classList.contains('remove-ing')) {
    const idx = parseInt(target.dataset.idx);
    removerItem(idx);
  }
}

// ---- Handle filter tab clicks ----
function handleFiltro(e) {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;

  // Update active tab styling
  document.querySelectorAll('#pedidos-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  filtroAtual = btn.dataset.filtro;
  carregar();
}

// ---- Init (load data + set up listeners) ----
export async function init() {
  // Load and render data
  await carregar();

  // Modal close handlers
  initModalClose('modalPedido');

  // "Novo Pedido" button
  document.getElementById('btnNovoPedido')?.addEventListener('click', abrirNovo);

  // Save button
  document.getElementById('btnSalvarPedido')?.addEventListener('click', salvar);

  // Add item button
  document.getElementById('btnAdicionarItem')?.addEventListener('click', adicionarItem);

  // Delegate item events (select, input, remove)
  const itensContainer = document.getElementById('ped-itens');
  if (itensContainer) {
    itensContainer.addEventListener('change', handleItemEvents);
    itensContainer.addEventListener('input', handleItemEvents);
    itensContainer.addEventListener('click', handleItemEvents);
  }

  // Search
  document.getElementById('busca-pedidos')?.addEventListener('input', carregar);

  // Filter tabs
  document.getElementById('pedidos-tabs')?.addEventListener('click', handleFiltro);

  // Delegate table actions (confirm, deliver, cancel, edit, delete)
  document.getElementById('pedidos-tbody')?.addEventListener('click', (e) => {
    e.preventDefault();

    const btnConfirmar = e.target.closest('.btn-confirmar');
    if (btnConfirmar) {
      const id = Number(btnConfirmar.dataset.id);
      confirmarPedido(id);
      return;
    }

    const btnEntregar = e.target.closest('.btn-entregar');
    if (btnEntregar) {
      const id = Number(btnEntregar.dataset.id);
      entregarPedido(id);
      return;
    }

    const btnCancelar = e.target.closest('.btn-cancelar-pedido');
    if (btnCancelar) {
      const id = Number(btnCancelar.dataset.id);
      cancelarPedido(id);
      return;
    }

    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      const id = Number(btnEditar.dataset.id);
      abrirEdicao(id);
      return;
    }

    const btnRemover = e.target.closest('.btn-remover');
    if (btnRemover) {
      const id = Number(btnRemover.dataset.id);
      removePedido(id);
    }
  });
}
