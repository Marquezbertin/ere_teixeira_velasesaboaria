// ============================================
// HELPERS & UTILITÁRIOS
// ============================================

export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
}

export function formatarData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

export function formatarDataHora(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function mesAnoAtual() {
  const d = new Date();
  return { mes: d.getMonth() + 1, ano: d.getFullYear() };
}

export function nomeMes(n) {
  const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return nomes[n] || '';
}

export function notificar(mensagem, tipo = 'sucesso') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function confirmar(msg) {
  return window.confirm(msg);
}

export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function abrirModal(id) {
  document.getElementById(id)?.classList.add('active');
}

export function fecharModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

export function initModalClose(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.querySelector('.modal-close')?.addEventListener('click', () => fecharModal(modalId));
  modal.querySelector('.modal-overlay')?.addEventListener('click', () => fecharModal(modalId));
  modal.querySelector('.btn-cancelar')?.addEventListener('click', () => fecharModal(modalId));
}

export function badgeStatus(status) {
  const map = {
    pendente: 'warning',
    confirmado: 'info',
    entregue: 'success',
    cancelado: 'danger',
    pago: 'success',
    parcial: 'warning',
    vencido: 'danger',
    aberto: 'info'
  };
  return `<span class="badge badge-${map[status] || 'neutral'}">${status}</span>`;
}

export function stockBadge(qtd, minimo) {
  if (qtd <= 0) return '<span class="badge badge-danger">Sem estoque</span>';
  if (qtd <= minimo) return '<span class="badge badge-warning">Estoque baixo</span>';
  return '<span class="badge badge-success">OK</span>';
}
