// ============================================
// PAINEL (Dashboard Home)
// Nervo Saboaria - ERP Artesanal
// ============================================

import { listarTodos, buscarPorIndice } from '../db.js';
import { formatarMoeda, mesAnoAtual, nomeMes } from '../utils/helpers.js';

// ---- Status badge mapping ----
const STATUS_BADGE = {
  pendente: 'badge-warning',
  confirmado: 'badge-info',
  entregue: 'badge-success',
  cancelado: 'badge-danger'
};

// ---- Helper: filter financeiro entries for current month ----
function filtrarMesAtual(registros, campo = 'data') {
  const { mes, ano } = mesAnoAtual();
  return registros.filter(r => {
    if (!r[campo]) return false;
    const d = new Date(r[campo]);
    return (d.getMonth() + 1) === mes && d.getFullYear() === ano;
  });
}

// ---- Render (static shell) ----
export function render() {
  const { mes, ano } = mesAnoAtual();
  const titulo = `${nomeMes(mes)} ${ano}`;

  return `
    <div class="painel-dashboard">
      <h2 class="section-title">Painel - ${titulo}</h2>

      <!-- KPI Cards -->
      <div class="cards-grid" id="painel-kpis">
        ${renderKpiPlaceholders()}
      </div>

      <!-- Alertas de Estoque Baixo -->
      <div id="painel-alertas"></div>

      <!-- Meta do Mes -->
      <div id="painel-meta"></div>

      <!-- Pedidos Recentes -->
      <div id="painel-pedidos-recentes">
        <h3 class="section-title">Pedidos Recentes</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Data</th>
                <th>Status</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody id="painel-pedidos-tbody">
              <tr><td colspan="4">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ---- Placeholder KPI cards while loading ----
function renderKpiPlaceholders() {
  const placeholders = [
    { icon: 'trending_up', label: 'Faturamento do M\u00eas' },
    { icon: 'trending_down', label: 'Despesas do M\u00eas' },
    { icon: 'account_balance', label: 'Lucro do M\u00eas' },
    { icon: 'pending_actions', label: 'Pedidos Pendentes' },
    { icon: 'inventory_2', label: 'Produtos Cadastrados' },
    { icon: 'receipt_long', label: 'Receitas Cadastradas' }
  ];

  return placeholders.map(p => `
    <div class="card card-kpi">
      <span class="kpi-icon material-symbols-outlined">${p.icon}</span>
      <span class="kpi-value">--</span>
      <span class="kpi-label">${p.label}</span>
    </div>
  `).join('');
}

// ---- Init (async data load + re-render dynamic parts) ----
export async function init() {
  try {
    // Fetch all data in parallel
    const [financeiro, pedidos, produtos, receitas, insumos, metas] = await Promise.all([
      listarTodos('financeiro'),
      listarTodos('pedidos'),
      listarTodos('produtos'),
      listarTodos('receitas'),
      listarTodos('insumos'),
      listarTodos('metas')
    ]);

    const { mes, ano } = mesAnoAtual();

    // ---- Calculate KPIs ----
    const finMesAtual = filtrarMesAtual(financeiro);

    const faturamento = finMesAtual
      .filter(f => f.tipo === 'entrada')
      .reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);

    const despesas = finMesAtual
      .filter(f => f.tipo === 'saida')
      .reduce((acc, f) => acc + (parseFloat(f.valor) || 0), 0);

    const lucro = faturamento - despesas;

    const pedidosPendentes = pedidos.filter(p => p.status === 'pendente').length;
    const totalProdutos = produtos.length;
    const totalReceitas = receitas.length;

    // ---- Render KPI cards ----
    const kpisEl = document.getElementById('painel-kpis');
    if (kpisEl) {
      const lucroClass = lucro >= 0 ? 'success' : 'danger';
      kpisEl.innerHTML = `
        <div class="card card-kpi">
          <span class="kpi-icon material-symbols-outlined">trending_up</span>
          <span class="kpi-value">${formatarMoeda(faturamento)}</span>
          <span class="kpi-label">Faturamento do M\u00eas</span>
        </div>
        <div class="card card-kpi">
          <span class="kpi-icon material-symbols-outlined">trending_down</span>
          <span class="kpi-value">${formatarMoeda(despesas)}</span>
          <span class="kpi-label">Despesas do M\u00eas</span>
        </div>
        <div class="card card-kpi ${lucroClass}">
          <span class="kpi-icon material-symbols-outlined">account_balance</span>
          <span class="kpi-value">${formatarMoeda(lucro)}</span>
          <span class="kpi-label">Lucro do M\u00eas</span>
        </div>
        <div class="card card-kpi">
          <span class="kpi-icon material-symbols-outlined">pending_actions</span>
          <span class="kpi-value">${pedidosPendentes}</span>
          <span class="kpi-label">Pedidos Pendentes</span>
        </div>
        <div class="card card-kpi">
          <span class="kpi-icon material-symbols-outlined">inventory_2</span>
          <span class="kpi-value">${totalProdutos}</span>
          <span class="kpi-label">Produtos Cadastrados</span>
        </div>
        <div class="card card-kpi">
          <span class="kpi-icon material-symbols-outlined">receipt_long</span>
          <span class="kpi-value">${totalReceitas}</span>
          <span class="kpi-label">Receitas Cadastradas</span>
        </div>
      `;
    }

    // ---- Low stock alerts ----
    const alertasEl = document.getElementById('painel-alertas');
    if (alertasEl) {
      const baixoEstoque = insumos.filter(i => {
        const qtd = parseFloat(i.quantidade_atual) || 0;
        const min = parseFloat(i.estoque_minimo) || 0;
        return qtd <= min && min > 0;
      });

      if (baixoEstoque.length > 0) {
        alertasEl.innerHTML = `
          <div class="alert alert-warning">
            <strong>Estoque Baixo!</strong> ${baixoEstoque.length} insumo(s) com estoque abaixo do m\u00ednimo:
            <ul>
              ${baixoEstoque.map(i => `
                <li>
                  <strong>${i.nome || 'Sem nome'}</strong> -
                  Atual: ${parseFloat(i.quantidade_atual || 0).toFixed(2)} ${i.unidade || ''} /
                  M\u00ednimo: ${parseFloat(i.estoque_minimo || 0).toFixed(2)} ${i.unidade || ''}
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      } else {
        alertasEl.innerHTML = '';
      }

      // Alerta de backup
      const ultimoBackup = localStorage.getItem('erenice_last_backup');
      if (ultimoBackup) {
        const diasDesde = (Date.now() - parseInt(ultimoBackup)) / (1000 * 60 * 60 * 24);
        if (diasDesde >= 5) {
          const diasTxt = Math.floor(diasDesde);
          alertasEl.innerHTML += `
            <div class="alert alert-info">
              <strong>Lembrete:</strong> Seu ultimo backup foi ha ${diasTxt} dia(s).
              O proximo backup automatico sera feito em breve.
              <a href="#" onclick="navegarPara('backup');return false;" style="color:inherit;font-weight:700;text-decoration:underline;">
                Fazer backup agora
              </a>
            </div>
          `;
        }
      } else {
        alertasEl.innerHTML += `
          <div class="alert alert-info">
            <strong>Dica:</strong> Faca backups regularmente para nao perder seus dados.
            <a href="#" onclick="navegarPara('backup');return false;" style="color:inherit;font-weight:700;text-decoration:underline;">
              Ir para Backup
            </a>
          </div>
        `;
      }
    }

    // ---- Indicador de protecao dos dados ----
    const alertasContainer = document.getElementById('painel-alertas');
    if (alertasContainer) {
      const tsBackup = localStorage.getItem('erenice_dados_seguranca_ts');
      let msgProtecao = 'Seus dados estao salvos e protegidos neste computador.';
      if (tsBackup) {
        const dt = new Date(tsBackup);
        const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        msgProtecao = `Seus dados estao salvos e protegidos. Ultima gravacao: hoje as ${horaStr}.`;
      }
      alertasContainer.innerHTML = `
        <div class="alert" style="background:var(--success-bg, #d4edda);color:var(--success-text, #155724);border:1px solid var(--success-border, #c3e6cb);">
          <span class="material-symbols-outlined" style="color:var(--success-text, #155724);">verified_user</span>
          <span>${msgProtecao}</span>
        </div>
      ` + alertasContainer.innerHTML;
    }

    // ---- Recent orders (last 5, newest first) ----
    const tbodyEl = document.getElementById('painel-pedidos-tbody');
    if (tbodyEl) {
      const pedidosOrdenados = [...pedidos]
        .sort((a, b) => {
          const dA = a.data_pedido ? new Date(a.data_pedido).getTime() : 0;
          const dB = b.data_pedido ? new Date(b.data_pedido).getTime() : 0;
          return dB - dA;
        })
        .slice(0, 5);

      if (pedidosOrdenados.length === 0) {
        tbodyEl.innerHTML = '<tr><td colspan="4">Nenhum pedido cadastrado.</td></tr>';
      } else {
        tbodyEl.innerHTML = pedidosOrdenados.map(p => {
          const badgeClass = STATUS_BADGE[p.status] || 'badge-neutral';
          const dataFormatada = p.data_pedido
            ? new Date(p.data_pedido).toLocaleDateString('pt-BR')
            : '-';
          return `
            <tr>
              <td>${p.cliente_nome || '-'}</td>
              <td>${dataFormatada}</td>
              <td><span class="badge ${badgeClass}">${p.status || '-'}</span></td>
              <td>${formatarMoeda(p.valor_total)}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // ---- Monthly goal (Meta do Mes) ----
    const metaEl = document.getElementById('painel-meta');
    if (metaEl) {
      const metaMes = metas.find(m =>
        parseInt(m.mes) === mes && parseInt(m.ano) === ano
      );

      if (metaMes && metaMes.meta_faturamento) {
        const metaValor = parseFloat(metaMes.meta_faturamento) || 0;
        const percentual = metaValor > 0
          ? Math.min((faturamento / metaValor) * 100, 100)
          : 0;
        const percentualExibir = metaValor > 0
          ? ((faturamento / metaValor) * 100).toFixed(1)
          : '0.0';

        metaEl.innerHTML = `
          <h3 class="section-title">Meta do M\u00eas - ${nomeMes(mes)} ${ano}</h3>
          <div class="card">
            <p>
              <strong>Faturamento:</strong> ${formatarMoeda(faturamento)} de ${formatarMoeda(metaValor)}
              (${percentualExibir}%)
            </p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percentual}%"></div>
            </div>
          </div>
        `;
      } else {
        metaEl.innerHTML = '';
      }
    }

  } catch (error) {
    console.error('Erro ao carregar painel:', error);

    // Graceful fallback - show error state without crashing
    const kpisEl = document.getElementById('painel-kpis');
    if (kpisEl) {
      kpisEl.innerHTML = `
        <div class="alert alert-warning">
          N\u00e3o foi poss\u00edvel carregar os dados do painel. Tente novamente.
        </div>
      `;
    }
  }
}
