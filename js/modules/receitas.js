// ============================================
// RECEITAS (Formulas - Soaps & Candles)
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
  confirmar
} from '../utils/helpers.js';

const STORE = 'receitas';
const STORE_INSUMOS_RECEITA = 'receita_insumos';
const STORE_INSUMOS = 'insumos';

let editandoId = null;
let ingredientesTemp = []; // Current recipe ingredients in the modal
let insumosCache = [];     // Cached insumos list for dropdowns

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Receitas (F\u00f3rmulas)</h2>
      <button class="btn btn-primary" id="btnNovaReceita">
        <span class="material-symbols-outlined">add</span>
        Nova Receita
      </button>
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Nome do Produto</th>
            <th>Rendimento (un)</th>
            <th>Custo Total</th>
            <th>Custo/Unidade</th>
            <th>Pre\u00e7o Sugerido</th>
            <th>Margem</th>
            <th>A\u00e7\u00f5es</th>
          </tr>
        </thead>
        <tbody id="receitas-tbody">
          <tr><td colspan="7">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Receita (Add/Edit) -->
    <div class="modal" id="modalReceita">
      <div class="modal-overlay"></div>
      <div class="modal-dialog lg">
        <div class="modal-header">
          <h3 id="modalReceitaTitulo">Nova Receita</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formReceita">
            <div class="form-row">
              <div class="form-group">
                <label for="rec-nome">Nome do Produto *</label>
                <input type="text" id="rec-nome" required>
              </div>
              <div class="form-group">
                <label for="rec-rendimento">Rendimento (unidades)</label>
                <input type="number" id="rec-rendimento" step="1" min="0" value="1">
              </div>
            </div>
            <div class="form-group">
              <label for="rec-descricao">Descri\u00e7\u00e3o</label>
              <textarea id="rec-descricao" rows="3"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="rec-margem">Margem Desejada (%)</label>
                <input type="number" id="rec-margem" step="0.1" min="0" max="99.9" value="50">
              </div>
              <div class="form-group"></div>
            </div>

            <!-- Ingredientes Section -->
            <h4 class="section-title">Ingredientes da Receita</h4>
            <div class="ingredientes-list">
              <div class="ing-header">
                <span>Insumo</span>
                <span>Quantidade</span>
                <span>Custo</span>
                <span></span>
              </div>
              <div id="rec-ingredientes">
                <!-- Dynamic ingredient rows go here -->
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnAdicionarIngrediente" style="margin-top:10px;">
              <span class="material-symbols-outlined">add</span>
              Adicionar Ingrediente
            </button>

            <!-- Cost Summary -->
            <div class="custo-resumo" id="rec-custo-resumo">
              <div class="custo-line">
                <span>Custo Total dos Ingredientes</span>
                <span id="resumo-custo-total">R$ 0,00</span>
              </div>
              <div class="custo-line">
                <span>Rendimento</span>
                <span id="resumo-rendimento">1 unidade(s)</span>
              </div>
              <div class="custo-line">
                <span>Custo por Unidade</span>
                <span id="resumo-custo-unitario">R$ 0,00</span>
              </div>
              <div class="custo-line">
                <span>Margem Desejada</span>
                <span id="resumo-margem">50%</span>
              </div>
              <div class="custo-line total">
                <span>Pre\u00e7o Sugerido</span>
                <span id="resumo-preco-sugerido">R$ 0,00</span>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarReceita">Salvar</button>
        </div>
      </div>
    </div>

    <!-- Modal Detalhe Receita (View) -->
    <div class="modal" id="modalReceitaDetalhe">
      <div class="modal-overlay"></div>
      <div class="modal-dialog lg">
        <div class="modal-header">
          <h3 id="modalDetalheReceitaTitulo">Detalhes da Receita</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body" id="receitaDetalheBody">
          <!-- Dynamic detail content -->
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Fechar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Render table body ----
function renderTabela(receitas) {
  const tbody = document.getElementById('receitas-tbody');
  if (!tbody) return;

  if (receitas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">science</span>
            <p>Nenhuma receita cadastrada.</p>
            <p>Clique em <strong>Nova Receita</strong> para come\u00e7ar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = receitas.map(r => `
    <tr>
      <td>
        <a href="#" class="btn-ver-receita" data-id="${r.id}" style="color:var(--primary);font-weight:600;text-decoration:underline;cursor:pointer;">
          ${escapeHtml(r.nome_produto)}
        </a>
      </td>
      <td>${Number(r.rendimento || 0)}</td>
      <td>${formatarMoeda(r.custo_total)}</td>
      <td>${formatarMoeda(r.custo_unitario)}</td>
      <td>${formatarMoeda(r.preco_sugerido)}</td>
      <td>${Number(r.margem_desejada || 0).toFixed(1)}%</td>
      <td class="table-actions">
        <button class="btn btn-icon btn-sm btn-ver" data-id="${r.id}" title="Ver Detalhes">
          <span class="material-symbols-outlined">visibility</span>
        </button>
        <button class="btn btn-icon btn-sm btn-imprimir-receita" data-id="${r.id}" title="Imprimir Receita">
          <span class="material-symbols-outlined">print</span>
        </button>
        <button class="btn btn-icon btn-sm btn-editar" data-id="${r.id}" title="Editar">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button class="btn btn-icon btn-sm btn-danger btn-remover" data-id="${r.id}" title="Remover">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </td>
    </tr>
  `).join('');
}

// ---- Print recipe sheet ----
async function imprimirReceita(id) {
  try {
    const receita = await buscarPorId(STORE, id);
    if (!receita) return;

    await carregarInsumos();
    const receitaInsumos = await buscarPorIndice(STORE_INSUMOS_RECEITA, 'receita_id', id);

    let ingredientesHtml = '';
    for (const ri of receitaInsumos) {
      const insumo = insumosCache.find(i => i.id === ri.insumo_id);
      ingredientesHtml += `<tr>
        <td>${insumo ? insumo.nome : 'Insumo removido'}</td>
        <td style="text-align:center">${Number(ri.quantidade_utilizada).toFixed(2)}</td>
        <td style="text-align:center">${insumo ? insumo.unidade_medida : '-'}</td>
      </tr>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Receita - ${receita.nome_produto}</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#333;}
        h1{font-size:1.2rem;text-align:center;color:#4a6741;margin-bottom:2px;}
        .sub{text-align:center;color:#999;font-size:0.85rem;margin-bottom:16px;}
        h2{font-size:1rem;color:#4a6741;margin:16px 0 8px;border-bottom:2px solid #4a6741;padding-bottom:4px;}
        .info{display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;}
        table{width:100%;border-collapse:collapse;font-size:0.85rem;margin-top:8px;}
        th{text-align:left;border-bottom:2px solid #4a6741;padding:6px 4px;font-size:0.8rem;}
        td{padding:5px 4px;border-bottom:1px solid #eee;}
        .notes{margin-top:20px;border:1px dashed #ccc;padding:12px;min-height:60px;font-size:0.8rem;color:#999;}
        .footer{text-align:center;font-size:0.75rem;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:10px;}
        @media print{body{margin:0;padding:10px;}}
      </style>
    </head><body>
      <h1>Erenice Teixeira</h1>
      <div class="sub">Velas & Saboaria - Ficha de Receita</div>
      <h2>${receita.nome_produto}</h2>
      <div class="info"><span>Rendimento: ${receita.rendimento || 0} unidades</span><span>Custo/un: ${formatarMoeda(receita.custo_unitario)}</span></div>
      <div class="info"><span>Custo total: ${formatarMoeda(receita.custo_total)}</span><span>Margem: ${Number(receita.margem_desejada || 0).toFixed(1)}%</span></div>
      <h2>Ingredientes</h2>
      <table>
        <thead><tr><th>Insumo</th><th style="text-align:center">Quantidade</th><th style="text-align:center">Unidade</th></tr></thead>
        <tbody>${ingredientesHtml}</tbody>
      </table>
      <div class="notes"><strong>Anotacoes:</strong><br><br></div>
      <div class="footer">Desenvolvido por Bruno Bertin Marquez</div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const janela = window.open('', '_blank');
    janela.document.write(html);
    janela.document.close();
  } catch (error) {
    console.error('Erro ao imprimir receita:', error);
    notificar('Erro ao gerar impressao.', 'erro');
  }
}

// ---- Load insumos for dropdown ----
async function carregarInsumos() {
  try {
    insumosCache = await listarTodos(STORE_INSUMOS);
  } catch (error) {
    console.error('Erro ao carregar insumos:', error);
    insumosCache = [];
  }
}

// ---- Build insumo <select> options ----
function buildInsumoOptions(selectedId) {
  let html = '<option value="">-- Selecione --</option>';
  for (const ins of insumosCache) {
    const sel = ins.id === selectedId ? 'selected' : '';
    html += `<option value="${ins.id}" ${sel}>${escapeHtml(ins.nome)} (${escapeHtml(ins.unidade_medida)} - ${formatarMoeda(ins.custo_unitario)})</option>`;
  }
  return html;
}

// ---- Render ingredient rows inside the modal ----
function renderIngredientes() {
  const container = document.getElementById('rec-ingredientes');
  if (!container) return;

  if (ingredientesTemp.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-secondary);font-size:0.85rem;">Nenhum ingrediente adicionado.</div>';
    recalcularCustos();
    return;
  }

  container.innerHTML = ingredientesTemp.map((ing, idx) => {
    const insumo = insumosCache.find(i => i.id === ing.insumo_id);
    const custoLinha = insumo ? (insumo.custo_unitario * (ing.quantidade_utilizada || 0)) : 0;

    return `
      <div class="ingrediente-row" data-idx="${idx}">
        <select class="ing-select" data-idx="${idx}">
          ${buildInsumoOptions(ing.insumo_id)}
        </select>
        <input type="number" class="ing-qtd" data-idx="${idx}" step="0.01" min="0" value="${ing.quantidade_utilizada || 0}">
        <span class="ing-custo" style="font-size:0.85rem;color:var(--text-secondary);">${formatarMoeda(custoLinha)}</span>
        <button type="button" class="remove-ing" data-idx="${idx}" title="Remover ingrediente">&times;</button>
      </div>
    `;
  }).join('');

  recalcularCustos();
}

// ---- Add an empty ingredient row ----
function adicionarIngrediente() {
  ingredientesTemp.push({
    insumo_id: null,
    quantidade_utilizada: 0
  });
  renderIngredientes();
}

// ---- Remove an ingredient row ----
function removerIngrediente(idx) {
  ingredientesTemp.splice(idx, 1);
  renderIngredientes();
}

// ---- Recalculate all costs in real time ----
function recalcularCustos() {
  let custoTotal = 0;

  for (const ing of ingredientesTemp) {
    const insumo = insumosCache.find(i => i.id === ing.insumo_id);
    if (insumo && ing.quantidade_utilizada > 0) {
      custoTotal += insumo.custo_unitario * ing.quantidade_utilizada;
    }
  }

  const rendimentoEl = document.getElementById('rec-rendimento');
  const margemEl = document.getElementById('rec-margem');

  const rendimento = Math.max(parseFloat(rendimentoEl?.value) || 0, 0);
  const margem = parseFloat(margemEl?.value) || 0;

  const custoUnitario = rendimento > 0 ? custoTotal / rendimento : 0;

  // Avoid division by zero or negative/infinite price when margem >= 100
  let precoSugerido = 0;
  if (margem < 100 && margem >= 0 && custoUnitario > 0) {
    precoSugerido = custoUnitario / (1 - margem / 100);
  }

  // Update summary display
  const elCustoTotal = document.getElementById('resumo-custo-total');
  const elRendimento = document.getElementById('resumo-rendimento');
  const elCustoUnitario = document.getElementById('resumo-custo-unitario');
  const elMargem = document.getElementById('resumo-margem');
  const elPrecoSugerido = document.getElementById('resumo-preco-sugerido');

  if (elCustoTotal) elCustoTotal.textContent = formatarMoeda(custoTotal);
  if (elRendimento) elRendimento.textContent = `${rendimento} unidade(s)`;
  if (elCustoUnitario) elCustoUnitario.textContent = formatarMoeda(custoUnitario);
  if (elMargem) elMargem.textContent = `${margem}%`;
  if (elPrecoSugerido) elPrecoSugerido.textContent = formatarMoeda(precoSugerido);

  // Update individual row costs
  const rows = document.querySelectorAll('#rec-ingredientes .ingrediente-row');
  rows.forEach((row, idx) => {
    const ing = ingredientesTemp[idx];
    if (!ing) return;
    const insumo = insumosCache.find(i => i.id === ing.insumo_id);
    const custoLinha = insumo ? (insumo.custo_unitario * (ing.quantidade_utilizada || 0)) : 0;
    const custoSpan = row.querySelector('.ing-custo');
    if (custoSpan) custoSpan.textContent = formatarMoeda(custoLinha);
  });
}

// ---- Load data and render table ----
async function carregar() {
  try {
    const receitas = await listarTodos(STORE);
    renderTabela(receitas);
  } catch (error) {
    console.error('Erro ao carregar receitas:', error);
  }
}

// ---- Open modal for new recipe ----
async function abrirNovo() {
  editandoId = null;
  document.getElementById('modalReceitaTitulo').textContent = 'Nova Receita';
  document.getElementById('formReceita').reset();
  document.getElementById('rec-rendimento').value = 1;
  document.getElementById('rec-margem').value = 50;
  ingredientesTemp = [];
  await carregarInsumos();
  renderIngredientes();
  abrirModal('modalReceita');
}

// ---- Open modal for editing ----
async function abrirEdicao(id) {
  try {
    const receita = await buscarPorId(STORE, id);
    if (!receita) return;

    editandoId = id;
    document.getElementById('modalReceitaTitulo').textContent = 'Editar Receita';

    document.getElementById('rec-nome').value = receita.nome_produto || '';
    document.getElementById('rec-descricao').value = receita.descricao || '';
    document.getElementById('rec-rendimento').value = receita.rendimento ?? 1;
    document.getElementById('rec-margem').value = receita.margem_desejada ?? 50;

    // Load insumos cache and recipe ingredients
    await carregarInsumos();
    const receitaInsumos = await buscarPorIndice(STORE_INSUMOS_RECEITA, 'receita_id', id);
    ingredientesTemp = receitaInsumos.map(ri => ({
      insumo_id: ri.insumo_id,
      quantidade_utilizada: ri.quantidade_utilizada || 0
    }));

    renderIngredientes();
    abrirModal('modalReceita');
  } catch (error) {
    console.error('Erro ao carregar receita para edi\u00e7\u00e3o:', error);
  }
}

// ---- Save (add or update) ----
async function salvar() {
  const nome = document.getElementById('rec-nome').value.trim();
  if (!nome) {
    notificar('Informe o nome do produto.', 'erro');
    return;
  }

  const rendimento = Math.max(parseFloat(document.getElementById('rec-rendimento').value) || 0, 0);
  const margem = parseFloat(document.getElementById('rec-margem').value) || 0;

  // Calculate final costs
  let custoTotal = 0;
  for (const ing of ingredientesTemp) {
    const insumo = insumosCache.find(i => i.id === ing.insumo_id);
    if (insumo && ing.quantidade_utilizada > 0) {
      custoTotal += insumo.custo_unitario * ing.quantidade_utilizada;
    }
  }

  const custoUnitario = rendimento > 0 ? custoTotal / rendimento : 0;
  let precoSugerido = 0;
  if (margem < 100 && margem >= 0 && custoUnitario > 0) {
    precoSugerido = custoUnitario / (1 - margem / 100);
  }

  const dados = {
    nome_produto: nome,
    descricao: document.getElementById('rec-descricao').value.trim(),
    rendimento,
    margem_desejada: margem,
    custo_total: custoTotal,
    custo_unitario: custoUnitario,
    preco_sugerido: precoSugerido
  };

  try {
    let receitaId;

    if (editandoId) {
      dados.id = editandoId;
      const original = await buscarPorId(STORE, editandoId);
      dados.data_criacao = original?.data_criacao || new Date().toISOString();
      await atualizar(STORE, dados);
      receitaId = editandoId;
    } else {
      dados.data_criacao = new Date().toISOString();
      receitaId = await adicionar(STORE, dados);
    }

    // Delete old receita_insumos for this recipe
    const oldInsumos = await buscarPorIndice(STORE_INSUMOS_RECEITA, 'receita_id', receitaId);
    for (const old of oldInsumos) {
      await remover(STORE_INSUMOS_RECEITA, old.id);
    }

    // Save new receita_insumos
    for (const ing of ingredientesTemp) {
      if (ing.insumo_id) {
        await adicionar(STORE_INSUMOS_RECEITA, {
          receita_id: receitaId,
          insumo_id: ing.insumo_id,
          quantidade_utilizada: ing.quantidade_utilizada || 0
        });
      }
    }

    fecharModal('modalReceita');
    notificar('Receita salva!');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar receita:', error);
    notificar('Erro ao salvar receita.', 'erro');
  }
}

// ---- View recipe detail ----
async function verDetalhe(id) {
  try {
    const receita = await buscarPorId(STORE, id);
    if (!receita) return;

    await carregarInsumos();
    const receitaInsumos = await buscarPorIndice(STORE_INSUMOS_RECEITA, 'receita_id', id);

    document.getElementById('modalDetalheReceitaTitulo').textContent = escapeHtml(receita.nome_produto);

    let ingredientesHtml = '';
    if (receitaInsumos.length > 0) {
      ingredientesHtml = `
        <table class="table" style="margin-top:8px;">
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Unidade</th>
              <th>Quantidade</th>
              <th>Custo Unit.</th>
              <th>Custo Total</th>
            </tr>
          </thead>
          <tbody>
            ${receitaInsumos.map(ri => {
              const insumo = insumosCache.find(i => i.id === ri.insumo_id);
              const custoLinha = insumo ? (insumo.custo_unitario * ri.quantidade_utilizada) : 0;
              return `
                <tr>
                  <td>${insumo ? escapeHtml(insumo.nome) : '<em>Insumo removido</em>'}</td>
                  <td>${insumo ? escapeHtml(insumo.unidade_medida) : '-'}</td>
                  <td>${Number(ri.quantidade_utilizada).toFixed(2)}</td>
                  <td>${insumo ? formatarMoeda(insumo.custo_unitario) : '-'}</td>
                  <td>${formatarMoeda(custoLinha)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      ingredientesHtml = '<p style="color:var(--text-secondary);font-size:0.9rem;">Nenhum ingrediente cadastrado nesta receita.</p>';
    }

    document.getElementById('receitaDetalheBody').innerHTML = `
      <div class="detail-grid">
        <div class="detail-item">
          <label>Nome do Produto</label>
          <span>${escapeHtml(receita.nome_produto)}</span>
        </div>
        <div class="detail-item">
          <label>Rendimento</label>
          <span>${Number(receita.rendimento || 0)} unidade(s)</span>
        </div>
        <div class="detail-item">
          <label>Margem Desejada</label>
          <span>${Number(receita.margem_desejada || 0).toFixed(1)}%</span>
        </div>
        <div class="detail-item">
          <label>Data de Cria\u00e7\u00e3o</label>
          <span>${receita.data_criacao ? new Date(receita.data_criacao).toLocaleDateString('pt-BR') : '-'}</span>
        </div>
      </div>
      ${receita.descricao ? `<div class="detail-item" style="margin-bottom:16px;"><label>Descri\u00e7\u00e3o</label><span>${escapeHtml(receita.descricao)}</span></div>` : ''}

      <h4 class="section-title">Ingredientes</h4>
      ${ingredientesHtml}

      <div class="custo-resumo" style="margin-top:20px;">
        <div class="custo-line">
          <span>Custo Total dos Ingredientes</span>
          <span>${formatarMoeda(receita.custo_total)}</span>
        </div>
        <div class="custo-line">
          <span>Rendimento</span>
          <span>${Number(receita.rendimento || 0)} unidade(s)</span>
        </div>
        <div class="custo-line">
          <span>Custo por Unidade</span>
          <span>${formatarMoeda(receita.custo_unitario)}</span>
        </div>
        <div class="custo-line">
          <span>Margem Desejada</span>
          <span>${Number(receita.margem_desejada || 0).toFixed(1)}%</span>
        </div>
        <div class="custo-line total">
          <span>Pre\u00e7o Sugerido</span>
          <span>${formatarMoeda(receita.preco_sugerido)}</span>
        </div>
      </div>
    `;

    abrirModal('modalReceitaDetalhe');
  } catch (error) {
    console.error('Erro ao carregar detalhes da receita:', error);
  }
}

// ---- Remove with confirmation ----
async function removeReceita(id) {
  if (!confirmar('Deseja remover esta receita e todos os seus ingredientes?')) return;

  try {
    // Remove associated receita_insumos first
    const receitaInsumos = await buscarPorIndice(STORE_INSUMOS_RECEITA, 'receita_id', id);
    for (const ri of receitaInsumos) {
      await remover(STORE_INSUMOS_RECEITA, ri.id);
    }

    await remover(STORE, id);
    notificar('Receita removida!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover receita:', error);
    notificar('Erro ao remover receita.', 'erro');
  }
}

// ---- Handle ingredient events (delegated) ----
function handleIngredienteEvents(e) {
  const target = e.target;

  // Insumo select changed
  if (target.classList.contains('ing-select')) {
    const idx = parseInt(target.dataset.idx);
    const val = target.value ? Number(target.value) : null;
    if (ingredientesTemp[idx] !== undefined) {
      ingredientesTemp[idx].insumo_id = val;
      recalcularCustos();
    }
    return;
  }

  // Quantity input changed
  if (target.classList.contains('ing-qtd')) {
    const idx = parseInt(target.dataset.idx);
    const val = parseFloat(target.value) || 0;
    if (ingredientesTemp[idx] !== undefined) {
      ingredientesTemp[idx].quantidade_utilizada = Math.max(val, 0);
      recalcularCustos();
    }
    return;
  }

  // Remove ingredient button
  if (target.classList.contains('remove-ing')) {
    const idx = parseInt(target.dataset.idx);
    removerIngrediente(idx);
  }
}

// ---- Init (load data + set up listeners) ----
export async function init() {
  // Load and render data
  await carregar();

  // Modal close handlers
  initModalClose('modalReceita');
  initModalClose('modalReceitaDetalhe');

  // "Nova Receita" button
  document.getElementById('btnNovaReceita')?.addEventListener('click', abrirNovo);

  // Save button
  document.getElementById('btnSalvarReceita')?.addEventListener('click', salvar);

  // Add ingredient button
  document.getElementById('btnAdicionarIngrediente')?.addEventListener('click', adicionarIngrediente);

  // Delegate ingredient events (select, input, remove)
  const ingContainer = document.getElementById('rec-ingredientes');
  if (ingContainer) {
    ingContainer.addEventListener('change', handleIngredienteEvents);
    ingContainer.addEventListener('input', handleIngredienteEvents);
    ingContainer.addEventListener('click', handleIngredienteEvents);
  }

  // Recalculate when rendimento or margem changes
  document.getElementById('rec-rendimento')?.addEventListener('input', recalcularCustos);
  document.getElementById('rec-margem')?.addEventListener('input', recalcularCustos);

  // Delegate table actions (view, edit, delete, name link)
  document.getElementById('receitas-tbody')?.addEventListener('click', (e) => {
    e.preventDefault();

    const btnVer = e.target.closest('.btn-ver') || e.target.closest('.btn-ver-receita');
    if (btnVer) {
      const id = Number(btnVer.dataset.id);
      verDetalhe(id);
      return;
    }

    const btnImprimir = e.target.closest('.btn-imprimir-receita');
    if (btnImprimir) {
      const id = Number(btnImprimir.dataset.id);
      imprimirReceita(id);
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
      removeReceita(id);
    }
  });
}
