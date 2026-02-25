// ============================================
// FINANCEIRO (Cash-basis Financial Control)
// Nervo Saboaria - ERP Artesanal
// ============================================

import { listarTodos, adicionar, remover } from '../db.js';
import {
  formatarMoeda,
  formatarData,
  notificar,
  abrirModal,
  fecharModal,
  initModalClose,
  confirmar,
  mesAnoAtual,
  nomeMes
} from '../utils/helpers.js';

const STORE = 'financeiro';

const CATEGORIAS_SAIDA = [
  { value: 'materia-prima', label: 'Matéria-Prima' },
  { value: 'embalagens', label: 'Embalagens' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'feiras', label: 'Feiras' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'administrativas', label: 'Administrativas' },
  { value: 'outros', label: 'Outros' }
];

const CATEGORIAS_ENTRADA = [
  { value: 'venda', label: 'Venda' },
  { value: 'servico', label: 'Serviço' },
  { value: 'outros', label: 'Outros' }
];

let filtroMesAno = null; // { mes, ano }

// ---- Render (static shell + modal) ----
export function render() {
  return `
    <div class="module-header">
      <h2>Financeiro</h2>
      <div>
        <button class="btn btn-success" id="btnNovaEntrada">
          <span class="material-symbols-outlined">add</span>
          Nova Entrada
        </button>
        <button class="btn btn-danger" id="btnNovaSaida">
          <span class="material-symbols-outlined">remove</span>
          Nova Saída
        </button>
      </div>
    </div>

    <div class="form-group" style="max-width:280px; margin-bottom:20px;">
      <label for="fin-filtro-mes">Período</label>
      <select id="fin-filtro-mes"></select>
    </div>

    <div class="cards-grid" id="fin-cards">
      <div class="card card-kpi success">
        <span class="kpi-label">Total Entradas</span>
        <span class="kpi-value" id="fin-total-entradas">R$ 0,00</span>
      </div>
      <div class="card card-kpi danger">
        <span class="kpi-label">Total Saídas</span>
        <span class="kpi-value" id="fin-total-saidas">R$ 0,00</span>
      </div>
      <div class="card card-kpi success" id="fin-card-saldo">
        <span class="kpi-label">Saldo</span>
        <span class="kpi-value" id="fin-saldo">R$ 0,00</span>
      </div>
    </div>

    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Categoria</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th>Origem</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="fin-tbody">
          <tr><td colspan="7">Carregando...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Financeiro -->
    <div class="modal" id="modalFinanceiro">
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 id="modalFinanceiroTitulo">Novo Lançamento</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formFinanceiro">
            <input type="hidden" id="fin-tipo" value="entrada">
            <div class="form-group">
              <label for="fin-categoria">Categoria *</label>
              <select id="fin-categoria" required>
                <option value="">-- Selecione --</option>
              </select>
            </div>
            <div class="form-group">
              <label for="fin-descricao">Descrição *</label>
              <input type="text" id="fin-descricao" required placeholder="Descrição do lançamento">
            </div>
            <div class="form-group">
              <label for="fin-valor">Valor (R$) *</label>
              <input type="number" id="fin-valor" step="0.01" min="0.01" required placeholder="0,00">
            </div>
            <div class="form-group">
              <label for="fin-data">Data *</label>
              <input type="date" id="fin-data" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarFinanceiro">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Build month/year filter options (last 12 months) ----
function popularFiltroMes() {
  const select = document.getElementById('fin-filtro-mes');
  if (!select) return;

  const { mes, ano } = mesAnoAtual();
  filtroMesAno = { mes, ano };

  let html = '';
  let m = mes;
  let a = ano;

  for (let i = 0; i < 12; i++) {
    const selected = i === 0 ? ' selected' : '';
    html += `<option value="${m}-${a}"${selected}>${nomeMes(m)} ${a}</option>`;
    m--;
    if (m < 1) {
      m = 12;
      a--;
    }
  }

  select.innerHTML = html;
}

// ---- Populate categoria select based on tipo ----
function popularCategorias(tipo) {
  const select = document.getElementById('fin-categoria');
  if (!select) return;

  const lista = tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
  select.innerHTML = '<option value="">-- Selecione --</option>' +
    lista.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
}

// ---- Filter entries by selected month/year ----
function filtrarPorMes(lancamentos) {
  if (!filtroMesAno) return lancamentos;

  return lancamentos.filter(l => {
    if (!l.data) return false;
    const d = new Date(l.data + 'T00:00:00');
    return (d.getMonth() + 1) === filtroMesAno.mes && d.getFullYear() === filtroMesAno.ano;
  });
}

// ---- Update summary cards ----
function atualizarCards(lancamentos) {
  const entradas = lancamentos
    .filter(l => l.tipo === 'entrada')
    .reduce((acc, l) => acc + Number(l.valor || 0), 0);

  const saidas = lancamentos
    .filter(l => l.tipo === 'saida')
    .reduce((acc, l) => acc + Number(l.valor || 0), 0);

  const saldo = entradas - saidas;

  document.getElementById('fin-total-entradas').textContent = formatarMoeda(entradas);
  document.getElementById('fin-total-saidas').textContent = formatarMoeda(saidas);
  document.getElementById('fin-saldo').textContent = formatarMoeda(saldo);

  // Update saldo card color
  const cardSaldo = document.getElementById('fin-card-saldo');
  if (cardSaldo) {
    cardSaldo.classList.remove('success', 'danger');
    cardSaldo.classList.add(saldo >= 0 ? 'success' : 'danger');
  }
}

// ---- Render table body ----
function renderTabela(lancamentos) {
  const tbody = document.getElementById('fin-tbody');
  if (!tbody) return;

  // Filter by month
  const filtrados = filtrarPorMes(lancamentos);

  // Update cards with filtered data
  atualizarCards(filtrados);

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <span class="empty-icon material-symbols-outlined">account_balance</span>
            <p>Nenhum lançamento neste período.</p>
            <p>Clique em <strong>Nova Entrada</strong> ou <strong>Nova Saída</strong> para registrar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort by date descending
  const sorted = [...filtrados].sort((a, b) => {
    return new Date(b.data) - new Date(a.data);
  });

  tbody.innerHTML = sorted.map(l => {
    const tipoBadge = l.tipo === 'entrada'
      ? '<span class="badge badge-success">Entrada</span>'
      : '<span class="badge badge-danger">Saída</span>';

    const origemLabel = escapeText(l.origem || 'manual');

    // Only show delete for manual entries
    const acoes = l.origem === 'manual'
      ? `<button class="btn btn-icon btn-sm btn-danger btn-remover" data-id="${l.id}" title="Remover">
           <span class="material-symbols-outlined">delete</span>
         </button>`
      : '<span style="color:var(--text-muted);font-size:0.85em;">—</span>';

    return `
      <tr>
        <td>${formatarData(l.data)}</td>
        <td>${tipoBadge}</td>
        <td>${escapeText(l.categoria)}</td>
        <td>${escapeText(l.descricao)}</td>
        <td>${formatarMoeda(l.valor)}</td>
        <td>${origemLabel}</td>
        <td class="table-actions">${acoes}</td>
      </tr>
    `;
  }).join('');
}

// ---- Simple text escape ----
function escapeText(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Today as YYYY-MM-DD ----
function hojeISO() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ---- Load data and render ----
async function carregar() {
  try {
    const lancamentos = await listarTodos(STORE);
    renderTabela(lancamentos);
  } catch (error) {
    console.error('Erro ao carregar financeiro:', error);
  }
}

// ---- Open modal for new entry ----
function abrirNovaEntrada() {
  document.getElementById('formFinanceiro')?.reset();
  document.getElementById('fin-tipo').value = 'entrada';
  document.getElementById('fin-data').value = hojeISO();
  document.getElementById('modalFinanceiroTitulo').textContent = 'Nova Entrada';
  popularCategorias('entrada');
  abrirModal('modalFinanceiro');
}

// ---- Open modal for new expense ----
function abrirNovaSaida() {
  document.getElementById('formFinanceiro')?.reset();
  document.getElementById('fin-tipo').value = 'saida';
  document.getElementById('fin-data').value = hojeISO();
  document.getElementById('modalFinanceiroTitulo').textContent = 'Nova Saída';
  popularCategorias('saida');
  abrirModal('modalFinanceiro');
}

// ---- Save entry ----
async function salvar() {
  const tipo = document.getElementById('fin-tipo').value;
  const categoria = document.getElementById('fin-categoria').value;
  const descricao = document.getElementById('fin-descricao').value.trim();
  const valor = parseFloat(document.getElementById('fin-valor').value);
  const data = document.getElementById('fin-data').value;

  // Validation
  if (!categoria || !descricao || !valor || !data) {
    notificar('Preencha todos os campos obrigatórios.', 'erro');
    return;
  }

  if (valor <= 0) {
    notificar('O valor deve ser maior que zero.', 'erro');
    return;
  }

  const registro = {
    tipo,
    categoria,
    descricao,
    valor,
    data,
    origem: 'manual',
    data_criacao: new Date().toISOString()
  };

  try {
    await adicionar(STORE, registro);
    notificar('Lançamento salvo!');
    fecharModal('modalFinanceiro');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar lançamento:', error);
    notificar('Erro ao salvar lançamento.', 'erro');
  }
}

// ---- Remove entry ----
async function removerLancamento(id) {
  if (!confirmar('Deseja realmente remover este lançamento?')) return;

  try {
    await remover(STORE, id);
    notificar('Lançamento removido!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover lançamento:', error);
    notificar('Erro ao remover lançamento.', 'erro');
  }
}

// ---- Init (event binding) ----
export async function init() {
  // Populate month filter and load data
  popularFiltroMes();
  await carregar();

  // Modal close handlers
  initModalClose('modalFinanceiro');

  // "Nova Entrada" button
  document.getElementById('btnNovaEntrada')?.addEventListener('click', abrirNovaEntrada);

  // "Nova Saida" button
  document.getElementById('btnNovaSaida')?.addEventListener('click', abrirNovaSaida);

  // Save button
  document.getElementById('btnSalvarFinanceiro')?.addEventListener('click', salvar);

  // Month filter change
  document.getElementById('fin-filtro-mes')?.addEventListener('change', (e) => {
    const [m, a] = e.target.value.split('-').map(Number);
    filtroMesAno = { mes: m, ano: a };
    carregar();
  });

  // Delegate table actions (delete)
  document.getElementById('fin-tbody')?.addEventListener('click', (e) => {
    const btnRemover = e.target.closest('.btn-remover');
    if (btnRemover) {
      const id = Number(btnRemover.dataset.id);
      removerLancamento(id);
    }
  });
}
