// ============================================
// RELATORIOS GERENCIAIS (Reports + PDF Export)
// Erenice Teixeira - Velas e Saboarias
// ============================================

import { listarTodos } from '../db.js';
import { formatarMoeda, formatarData, mesAnoAtual, nomeMes } from '../utils/helpers.js';

const TIPOS = [
  { value: 'financeiro', label: 'Financeiro Mensal' },
  { value: 'vendas', label: 'Vendas por Periodo' },
  { value: 'producao', label: 'Producao' },
  { value: 'estoque', label: 'Estoque Atual' },
  { value: 'perdas', label: 'Perdas' }
];

// ---- Render (static shell) ----
export function render() {
  const { mes, ano } = mesAnoAtual();

  let mesesOptions = '';
  let m = mes, a = ano;
  for (let i = 0; i < 12; i++) {
    const sel = i === 0 ? ' selected' : '';
    mesesOptions += `<option value="${m}-${a}"${sel}>${nomeMes(m)} ${a}</option>`;
    m--;
    if (m < 1) { m = 12; a--; }
  }

  const tiposOptions = TIPOS.map(t =>
    `<option value="${t.value}">${t.label}</option>`
  ).join('');

  return `
    <div class="module-header">
      <h2>Relatorios Gerenciais</h2>
      <button class="btn btn-primary" id="btnGerarPDF">
        &#128196; Gerar PDF
      </button>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="form-row" style="align-items:flex-end;">
        <div class="form-group">
          <label for="rel-tipo">Tipo de Relatorio</label>
          <select id="rel-tipo">${tiposOptions}</select>
        </div>
        <div class="form-group">
          <label for="rel-periodo">Periodo</label>
          <select id="rel-periodo">${mesesOptions}</select>
        </div>
        <div class="form-group">
          <button class="btn btn-success" id="btnGerarRelatorio" style="margin-bottom:0;">
            Gerar Relatorio
          </button>
        </div>
      </div>
    </div>

    <div id="relatorio-preview" class="relatorio-preview"></div>
  `;
}

// ---- Helpers ----
function escapeText(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function parsePeriodo(val) {
  const [m, a] = val.split('-').map(Number);
  return { mes: m, ano: a };
}

function filtrarPorMes(registros, campoData, mes, ano) {
  return registros.filter(r => {
    if (!r[campoData]) return false;
    const d = new Date(r[campoData]);
    return (d.getMonth() + 1) === mes && d.getFullYear() === ano;
  });
}

function cabecalho(titulo, mes, ano) {
  return `
    <div class="rel-cabecalho">
      <h2>Erenice Teixeira - Velas &amp; Saboaria</h2>
      <h3>${escapeText(titulo)}</h3>
      <p>${nomeMes(mes)} ${ano} &mdash; Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  `;
}

// ---- Relatorio: Financeiro Mensal ----
async function gerarFinanceiro(mes, ano) {
  const lancamentos = await listarTodos('financeiro');
  const filtrados = filtrarPorMes(lancamentos, 'data', mes, ano);

  const entradas = filtrados.filter(l => l.tipo === 'entrada');
  const saidas = filtrados.filter(l => l.tipo === 'saida');
  const totalEntradas = entradas.reduce((s, l) => s + Number(l.valor || 0), 0);
  const totalSaidas = saidas.reduce((s, l) => s + Number(l.valor || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  // Breakdown por categoria
  const categoriasMap = {};
  filtrados.forEach(l => {
    const cat = l.categoria || 'Outros';
    const tipo = l.tipo;
    const key = `${tipo}|${cat}`;
    if (!categoriasMap[key]) categoriasMap[key] = { tipo, categoria: cat, total: 0 };
    categoriasMap[key].total += Number(l.valor || 0);
  });
  const categorias = Object.values(categoriasMap).sort((a, b) => b.total - a.total);

  let html = cabecalho('Relatorio Financeiro Mensal', mes, ano);

  html += `
    <div class="rel-resumo">
      <div class="rel-resumo-item rel-entrada">
        <span class="rel-resumo-label">Total Entradas</span>
        <span class="rel-resumo-valor">${formatarMoeda(totalEntradas)}</span>
      </div>
      <div class="rel-resumo-item rel-saida">
        <span class="rel-resumo-label">Total Saidas</span>
        <span class="rel-resumo-valor">${formatarMoeda(totalSaidas)}</span>
      </div>
      <div class="rel-resumo-item ${saldo >= 0 ? 'rel-entrada' : 'rel-saida'}">
        <span class="rel-resumo-label">Saldo do Periodo</span>
        <span class="rel-resumo-valor">${formatarMoeda(saldo)}</span>
      </div>
    </div>
  `;

  if (categorias.length > 0) {
    html += `
      <h4 class="rel-section-title">Breakdown por Categoria</h4>
      <table class="rel-table">
        <thead><tr><th>Tipo</th><th>Categoria</th><th>Total</th></tr></thead>
        <tbody>
          ${categorias.map(c => `
            <tr>
              <td>${c.tipo === 'entrada' ? 'Entrada' : 'Saida'}</td>
              <td>${escapeText(c.categoria)}</td>
              <td>${formatarMoeda(c.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    html += '<p class="rel-vazio">Nenhum lancamento neste periodo.</p>';
  }

  return html;
}

// ---- Relatorio: Vendas por Periodo ----
async function gerarVendas(mes, ano) {
  const pedidos = await listarTodos('pedidos');
  const itens = await listarTodos('pedido_itens');
  const produtos = await listarTodos('produtos');

  const pedidosMes = filtrarPorMes(pedidos, 'data_pedido', mes, ano);

  const totalPedidos = pedidosMes.length;
  const faturamento = pedidosMes.reduce((s, p) => s + Number(p.valor_total || 0), 0);

  // Top 5 clientes
  const clientesMap = {};
  pedidosMes.forEach(p => {
    const nome = p.cliente_nome || 'Sem nome';
    if (!clientesMap[nome]) clientesMap[nome] = 0;
    clientesMap[nome] += Number(p.valor_total || 0);
  });
  const topClientes = Object.entries(clientesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top 5 produtos
  const pedidoIds = new Set(pedidosMes.map(p => p.id));
  const itensMes = itens.filter(i => pedidoIds.has(i.pedido_id));
  const produtosMap = {};
  itensMes.forEach(i => {
    const prod = produtos.find(p => p.id === i.produto_id);
    const nome = prod ? prod.nome : `Produto #${i.produto_id}`;
    if (!produtosMap[nome]) produtosMap[nome] = { qtd: 0, valor: 0 };
    produtosMap[nome].qtd += Number(i.quantidade || 0);
    produtosMap[nome].valor += Number(i.subtotal || 0);
  });
  const topProdutos = Object.entries(produtosMap)
    .sort((a, b) => b[1].valor - a[1].valor)
    .slice(0, 5);

  // Formas de pagamento
  const pagamentoMap = {};
  pedidosMes.forEach(p => {
    const fp = p.forma_pagamento || 'Nao informado';
    if (!pagamentoMap[fp]) pagamentoMap[fp] = 0;
    pagamentoMap[fp]++;
  });
  const pagamentos = Object.entries(pagamentoMap).sort((a, b) => b[1] - a[1]);

  let html = cabecalho('Relatorio de Vendas por Periodo', mes, ano);

  html += `
    <div class="rel-resumo">
      <div class="rel-resumo-item">
        <span class="rel-resumo-label">Total de Pedidos</span>
        <span class="rel-resumo-valor">${totalPedidos}</span>
      </div>
      <div class="rel-resumo-item rel-entrada">
        <span class="rel-resumo-label">Faturamento</span>
        <span class="rel-resumo-valor">${formatarMoeda(faturamento)}</span>
      </div>
    </div>
  `;

  if (topClientes.length > 0) {
    html += `
      <h4 class="rel-section-title">Top 5 Clientes por Valor</h4>
      <table class="rel-table">
        <thead><tr><th>#</th><th>Cliente</th><th>Total</th></tr></thead>
        <tbody>
          ${topClientes.map(([nome, valor], i) => `
            <tr><td>${i + 1}</td><td>${escapeText(nome)}</td><td>${formatarMoeda(valor)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (topProdutos.length > 0) {
    html += `
      <h4 class="rel-section-title">Top 5 Produtos Mais Vendidos</h4>
      <table class="rel-table">
        <thead><tr><th>#</th><th>Produto</th><th>Qtd</th><th>Valor</th></tr></thead>
        <tbody>
          ${topProdutos.map(([nome, data], i) => `
            <tr><td>${i + 1}</td><td>${escapeText(nome)}</td><td>${data.qtd}</td><td>${formatarMoeda(data.valor)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (pagamentos.length > 0) {
    html += `
      <h4 class="rel-section-title">Distribuicao por Forma de Pagamento</h4>
      <table class="rel-table">
        <thead><tr><th>Forma</th><th>Pedidos</th></tr></thead>
        <tbody>
          ${pagamentos.map(([forma, count]) => `
            <tr><td>${escapeText(forma)}</td><td>${count}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (totalPedidos === 0) {
    html += '<p class="rel-vazio">Nenhum pedido neste periodo.</p>';
  }

  return html;
}

// ---- Relatorio: Producao ----
async function gerarProducao(mes, ano) {
  const producoes = await listarTodos('producao');
  const producoesMes = filtrarPorMes(producoes, 'data_producao', mes, ano);

  const totalLotes = producoesMes.length;
  const custoTotal = producoesMes.reduce((s, p) => s + Number(p.custo_total || 0), 0);

  // Agrupamento por receita
  const receitaMap = {};
  producoesMes.forEach(p => {
    const nome = p.receita_nome || 'Receita desconhecida';
    if (!receitaMap[nome]) receitaMap[nome] = { qtd: 0, custo: 0 };
    receitaMap[nome].qtd += Number(p.quantidade_produzida || 0);
    receitaMap[nome].custo += Number(p.custo_total || 0);
  });
  const receitas = Object.entries(receitaMap).sort((a, b) => b[1].qtd - a[1].qtd);

  let html = cabecalho('Relatorio de Producao', mes, ano);

  html += `
    <div class="rel-resumo">
      <div class="rel-resumo-item">
        <span class="rel-resumo-label">Lotes Produzidos</span>
        <span class="rel-resumo-valor">${totalLotes}</span>
      </div>
      <div class="rel-resumo-item rel-saida">
        <span class="rel-resumo-label">Custo Total</span>
        <span class="rel-resumo-valor">${formatarMoeda(custoTotal)}</span>
      </div>
    </div>
  `;

  if (receitas.length > 0) {
    html += `
      <h4 class="rel-section-title">Quantidade Produzida por Receita</h4>
      <table class="rel-table">
        <thead><tr><th>Receita</th><th>Qtd Produzida</th><th>Custo Total</th></tr></thead>
        <tbody>
          ${receitas.map(([nome, data]) => `
            <tr>
              <td>${escapeText(nome)}</td>
              <td>${data.qtd}</td>
              <td>${formatarMoeda(data.custo)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    html += '<p class="rel-vazio">Nenhuma producao neste periodo.</p>';
  }

  return html;
}

// ---- Relatorio: Estoque Atual ----
async function gerarEstoque() {
  const insumos = await listarTodos('insumos');
  const produtos = await listarTodos('produtos');

  const { mes, ano } = mesAnoAtual();

  let html = cabecalho('Relatorio de Estoque Atual', mes, ano);

  // Insumos
  const insumosOrdenados = [...insumos].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  const insumosAlerta = insumos.filter(i => Number(i.quantidade_atual || 0) <= Number(i.quantidade_minima || 0));

  html += `<h4 class="rel-section-title">Insumos (Materias-Primas)</h4>`;

  if (insumosOrdenados.length > 0) {
    html += `
      <table class="rel-table">
        <thead><tr><th>Nome</th><th>Qtd Atual</th><th>Minimo</th><th>Unidade</th><th>Status</th></tr></thead>
        <tbody>
          ${insumosOrdenados.map(i => {
            const qtd = Number(i.quantidade_atual || 0);
            const min = Number(i.quantidade_minima || 0);
            let status, statusClass;
            if (qtd <= 0) { status = 'Sem estoque'; statusClass = 'rel-badge-danger'; }
            else if (qtd <= min) { status = 'Estoque baixo'; statusClass = 'rel-badge-warning'; }
            else { status = 'OK'; statusClass = 'rel-badge-ok'; }
            return `
              <tr>
                <td>${escapeText(i.nome)}</td>
                <td>${qtd.toFixed(2)}</td>
                <td>${min.toFixed(2)}</td>
                <td>${escapeText(i.unidade_medida || '')}</td>
                <td><span class="${statusClass}">${status}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } else {
    html += '<p class="rel-vazio">Nenhum insumo cadastrado.</p>';
  }

  // Produtos acabados
  const produtosOrdenados = [...produtos].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  html += `<h4 class="rel-section-title">Produtos Acabados</h4>`;

  if (produtosOrdenados.length > 0) {
    html += `
      <table class="rel-table">
        <thead><tr><th>Nome</th><th>Estoque</th><th>Custo Medio</th><th>Preco Venda</th></tr></thead>
        <tbody>
          ${produtosOrdenados.map(p => `
            <tr>
              <td>${escapeText(p.nome)}</td>
              <td>${Number(p.quantidade_disponivel || 0).toFixed(2)}</td>
              <td>${formatarMoeda(p.custo_medio)}</td>
              <td>${formatarMoeda(p.preco_venda)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    html += '<p class="rel-vazio">Nenhum produto cadastrado.</p>';
  }

  // Alertas
  if (insumosAlerta.length > 0) {
    html += `
      <h4 class="rel-section-title">Alertas de Estoque Baixo</h4>
      <div class="rel-alerta">
        <ul>
          ${insumosAlerta.map(i => `
            <li><strong>${escapeText(i.nome)}</strong> &mdash; ${Number(i.quantidade_atual || 0).toFixed(2)} ${escapeText(i.unidade_medida || '')} (minimo: ${Number(i.quantidade_minima || 0).toFixed(2)})</li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  return html;
}

// ---- Relatorio: Perdas ----
async function gerarPerdas(mes, ano) {
  const perdas = await listarTodos('perdas');
  const perdasMes = filtrarPorMes(perdas, 'data', mes, ano);

  const totalPerdas = perdasMes.length;
  const valorTotal = perdasMes.reduce((s, p) => s + Number(p.valor || 0), 0);

  // Por categoria
  const catMap = {};
  perdasMes.forEach(p => {
    const cat = p.categoria || 'Outros';
    if (!catMap[cat]) catMap[cat] = { count: 0, valor: 0 };
    catMap[cat].count++;
    catMap[cat].valor += Number(p.valor || 0);
  });
  const categorias = Object.entries(catMap).sort((a, b) => b[1].valor - a[1].valor);

  // Por produto
  const prodMap = {};
  perdasMes.forEach(p => {
    const nome = p.produto_nome || 'Produto desconhecido';
    if (!prodMap[nome]) prodMap[nome] = { qtd: 0, valor: 0 };
    prodMap[nome].qtd += Number(p.quantidade || 0);
    prodMap[nome].valor += Number(p.valor || 0);
  });
  const porProduto = Object.entries(prodMap).sort((a, b) => b[1].valor - a[1].valor);

  let html = cabecalho('Relatorio de Perdas', mes, ano);

  html += `
    <div class="rel-resumo">
      <div class="rel-resumo-item">
        <span class="rel-resumo-label">Total de Perdas</span>
        <span class="rel-resumo-valor">${totalPerdas}</span>
      </div>
      <div class="rel-resumo-item rel-saida">
        <span class="rel-resumo-label">Valor Total Perdido</span>
        <span class="rel-resumo-valor">${formatarMoeda(valorTotal)}</span>
      </div>
    </div>
  `;

  if (categorias.length > 0) {
    html += `
      <h4 class="rel-section-title">Breakdown por Categoria</h4>
      <table class="rel-table">
        <thead><tr><th>Categoria</th><th>Quantidade</th><th>Valor</th></tr></thead>
        <tbody>
          ${categorias.map(([cat, data]) => `
            <tr>
              <td>${escapeText(cat)}</td>
              <td>${data.count}</td>
              <td>${formatarMoeda(data.valor)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (porProduto.length > 0) {
    html += `
      <h4 class="rel-section-title">Breakdown por Produto</h4>
      <table class="rel-table">
        <thead><tr><th>Produto</th><th>Qtd Perdida</th><th>Valor</th></tr></thead>
        <tbody>
          ${porProduto.map(([nome, data]) => `
            <tr>
              <td>${escapeText(nome)}</td>
              <td>${data.qtd}</td>
              <td>${formatarMoeda(data.valor)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (totalPerdas === 0) {
    html += '<p class="rel-vazio">Nenhuma perda registrada neste periodo.</p>';
  }

  return html;
}

// ---- Gerar relatorio no preview ----
async function gerarRelatorio() {
  const tipo = document.getElementById('rel-tipo').value;
  const periodoVal = document.getElementById('rel-periodo').value;
  const { mes, ano } = parsePeriodo(periodoVal);
  const preview = document.getElementById('relatorio-preview');

  preview.innerHTML = '<p style="text-align:center;padding:24px;color:var(--text-secondary);">Gerando relatorio...</p>';

  let html = '';
  try {
    switch (tipo) {
      case 'financeiro': html = await gerarFinanceiro(mes, ano); break;
      case 'vendas': html = await gerarVendas(mes, ano); break;
      case 'producao': html = await gerarProducao(mes, ano); break;
      case 'estoque': html = await gerarEstoque(); break;
      case 'perdas': html = await gerarPerdas(mes, ano); break;
    }
    preview.innerHTML = html;
  } catch (error) {
    console.error('Erro ao gerar relatorio:', error);
    preview.innerHTML = '<div class="alert alert-danger">Erro ao gerar relatorio. Tente novamente.</div>';
  }
}

// ---- PDF via window.print() ----
function gerarPDF() {
  const preview = document.getElementById('relatorio-preview');
  if (!preview || !preview.innerHTML.trim()) {
    alert('Gere um relatorio antes de exportar para PDF.');
    return;
  }
  window.print();
}

// ---- Init (event binding) ----
export async function init() {
  document.getElementById('btnGerarRelatorio')?.addEventListener('click', gerarRelatorio);
  document.getElementById('btnGerarPDF')?.addEventListener('click', gerarPDF);

  // Gerar o relatorio financeiro automaticamente ao abrir
  await gerarRelatorio();
}
