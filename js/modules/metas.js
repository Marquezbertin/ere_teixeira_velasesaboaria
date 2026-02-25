// ============================================
// METAS (Goals / Targets)
// Nervo Saboaria - ERP Artesanal
// ============================================

import { listarTodos, adicionar, atualizar, remover } from '../db.js';
import {
  formatarMoeda,
  notificar,
  abrirModal,
  fecharModal,
  initModalClose,
  confirmar,
  mesAnoAtual,
  nomeMes
} from '../utils/helpers.js';

const STORE = 'metas';
const STORE_FIN = 'financeiro';

let editandoId = null;

// ---- Render (static shell + modal) ----
export function render() {
  const { ano } = mesAnoAtual();

  return `
    <div class="module-header">
      <h2>Metas</h2>
      <button class="btn btn-primary" id="btnNovaMeta">
        <span class="material-symbols-outlined">add</span>
        Nova Meta
      </button>
    </div>

    <div class="cards-grid" id="metas-grid">
      <div class="empty-state">
        <p>Carregando...</p>
      </div>
    </div>

    <!-- Modal Meta -->
    <div class="modal" id="modalMeta">
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 id="modalMetaTitulo">Nova Meta</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formMeta">
            <div class="form-row">
              <div class="form-group">
                <label for="meta-mes">Mês *</label>
                <select id="meta-mes" required>
                  <option value="">-- Selecione --</option>
                  <option value="1">Janeiro</option>
                  <option value="2">Fevereiro</option>
                  <option value="3">Março</option>
                  <option value="4">Abril</option>
                  <option value="5">Maio</option>
                  <option value="6">Junho</option>
                  <option value="7">Julho</option>
                  <option value="8">Agosto</option>
                  <option value="9">Setembro</option>
                  <option value="10">Outubro</option>
                  <option value="11">Novembro</option>
                  <option value="12">Dezembro</option>
                </select>
              </div>
              <div class="form-group">
                <label for="meta-ano">Ano *</label>
                <input type="number" id="meta-ano" required min="2020" max="2099" value="${ano}">
              </div>
            </div>
            <div class="form-group">
              <label for="meta-valor">Meta de Faturamento (R$) *</label>
              <input type="number" id="meta-valor" step="0.01" min="0.01" required placeholder="0,00">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarMeta">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Calculate actual faturamento per month from financeiro entries ----
function calcularFaturamentoReal(financeiro) {
  const mapa = {};

  financeiro
    .filter(l => l.tipo === 'entrada')
    .forEach(l => {
      if (!l.data) return;
      const d = new Date(l.data + 'T00:00:00');
      const mes = d.getMonth() + 1;
      const ano = d.getFullYear();
      const chave = `${ano}-${mes}`;
      mapa[chave] = (mapa[chave] || 0) + Number(l.valor || 0);
    });

  return mapa;
}

// ---- Render cards ----
function renderCards(metas, faturamentoMap) {
  const grid = document.getElementById('metas-grid');
  if (!grid) return;

  if (metas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon material-symbols-outlined">flag</span>
        <p>Nenhuma meta cadastrada.</p>
        <p>Clique em <strong>Nova Meta</strong> para definir metas de faturamento.</p>
      </div>
    `;
    return;
  }

  // Sort: current year first, then by month descending
  const { ano: anoAtual } = mesAnoAtual();
  const sorted = [...metas].sort((a, b) => {
    // Current year first
    const aIsCurrentYear = a.ano === anoAtual ? 0 : 1;
    const bIsCurrentYear = b.ano === anoAtual ? 0 : 1;
    if (aIsCurrentYear !== bIsCurrentYear) return aIsCurrentYear - bIsCurrentYear;

    // Then by year descending
    if (a.ano !== b.ano) return b.ano - a.ano;

    // Then by month descending
    return b.mes - a.mes;
  });

  grid.innerHTML = sorted.map(meta => {
    const chave = `${meta.ano}-${meta.mes}`;
    const realizado = faturamentoMap[chave] || 0;
    const metaValor = Number(meta.meta_faturamento) || 0;
    const percentual = metaValor > 0 ? (realizado / metaValor) * 100 : 0;
    const percentualClamped = Math.min(percentual, 100);

    let corBarra = 'danger';
    if (percentual >= 100) corBarra = 'success';
    else if (percentual >= 50) corBarra = 'warning';

    return `
      <div class="card" data-id="${meta.id}">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3>${nomeMes(meta.mes)} ${meta.ano}</h3>
          <div>
            <button class="btn btn-sm btn-icon btn-editar" data-id="${meta.id}" title="Editar">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="btn btn-sm btn-icon btn-remover" data-id="${meta.id}" title="Remover">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
        <div class="card-body">
          <p><strong>Meta de Faturamento:</strong> ${formatarMoeda(metaValor)}</p>
          <p><strong>Realizado:</strong> ${formatarMoeda(realizado)}</p>
          <p><strong>Progresso:</strong> ${percentual.toFixed(1)}%</p>
          <div class="progress-bar">
            <div class="progress-fill ${corBarra}" style="width:${percentualClamped}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- Load data and render ----
async function carregar() {
  try {
    const [metas, financeiro] = await Promise.all([
      listarTodos(STORE),
      listarTodos(STORE_FIN)
    ]);

    const faturamentoMap = calcularFaturamentoReal(financeiro);
    renderCards(metas, faturamentoMap);
  } catch (error) {
    console.error('Erro ao carregar metas:', error);
  }
}

// ---- Open modal for new meta ----
function abrirNovaMeta() {
  const { ano } = mesAnoAtual();
  editandoId = null;

  document.getElementById('formMeta')?.reset();
  document.getElementById('meta-ano').value = ano;
  document.getElementById('modalMetaTitulo').textContent = 'Nova Meta';
  abrirModal('modalMeta');
}

// ---- Open modal for editing ----
async function abrirEditarMeta(id) {
  const metas = await listarTodos(STORE);
  const meta = metas.find(m => m.id === id);
  if (!meta) return;

  editandoId = id;

  document.getElementById('meta-mes').value = meta.mes;
  document.getElementById('meta-ano').value = meta.ano;
  document.getElementById('meta-valor').value = meta.meta_faturamento;
  document.getElementById('modalMetaTitulo').textContent = 'Editar Meta';
  abrirModal('modalMeta');
}

// ---- Save meta ----
async function salvar() {
  const mes = parseInt(document.getElementById('meta-mes').value);
  const ano = parseInt(document.getElementById('meta-ano').value);
  const meta_faturamento = parseFloat(document.getElementById('meta-valor').value);

  // Validation
  if (!mes || !ano || !meta_faturamento) {
    notificar('Preencha todos os campos obrigatórios.', 'erro');
    return;
  }

  if (meta_faturamento <= 0) {
    notificar('O valor da meta deve ser maior que zero.', 'erro');
    return;
  }

  try {
    if (editandoId) {
      // Update existing
      const metas = await listarTodos(STORE);
      const existente = metas.find(m => m.id === editandoId);
      if (!existente) return;

      await atualizar(STORE, {
        ...existente,
        mes,
        ano,
        meta_faturamento
      });
    } else {
      // Add new
      await adicionar(STORE, {
        mes,
        ano,
        meta_faturamento,
        data_criacao: new Date().toISOString()
      });
    }

    notificar('Meta salva!');
    fecharModal('modalMeta');
    editandoId = null;
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar meta:', error);
    notificar('Erro ao salvar meta.', 'erro');
  }
}

// ---- Remove meta ----
async function removerMeta(id) {
  if (!confirmar('Deseja realmente remover esta meta?')) return;

  try {
    await remover(STORE, id);
    notificar('Meta removida!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover meta:', error);
    notificar('Erro ao remover meta.', 'erro');
  }
}

// ---- Init (event binding) ----
export async function init() {
  await carregar();

  // Modal close handlers
  initModalClose('modalMeta');

  // "Nova Meta" button
  document.getElementById('btnNovaMeta')?.addEventListener('click', abrirNovaMeta);

  // Save button
  document.getElementById('btnSalvarMeta')?.addEventListener('click', salvar);

  // Delegate card actions (edit & delete)
  document.getElementById('metas-grid')?.addEventListener('click', (e) => {
    const btnEditar = e.target.closest('.btn-editar');
    if (btnEditar) {
      const id = Number(btnEditar.dataset.id);
      abrirEditarMeta(id);
      return;
    }

    const btnRemover = e.target.closest('.btn-remover');
    if (btnRemover) {
      const id = Number(btnRemover.dataset.id);
      removerMeta(id);
    }
  });
}
