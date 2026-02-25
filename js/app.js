// ============================================
// APP PRINCIPAL - Router + Navegacao
// ============================================

import { abrirBanco, exportarTudo } from './db.js';
import * as painel from './modules/painel.js';
import * as fornecedores from './modules/fornecedores.js';
import * as insumos from './modules/insumos.js';
import * as receitas from './modules/receitas.js';
import * as producao from './modules/producao.js';
import * as produtos from './modules/produtos.js';
import * as pedidos from './modules/pedidos.js';
import * as financeiro from './modules/financeiro.js';
import * as metas from './modules/metas.js';
import * as perdas from './modules/perdas.js';
import * as backup from './modules/backup.js';

// Auth check
if (localStorage.getItem("auth") !== "true") {
  window.location.href = "index.html";
}

const MODULES = {
  painel:       { mod: painel,       titulo: 'Painel' },
  fornecedores: { mod: fornecedores, titulo: 'Fornecedores' },
  insumos:      { mod: insumos,      titulo: 'Insumos (Materias-Primas)' },
  receitas:     { mod: receitas,     titulo: 'Receitas (Formulas)' },
  producao:     { mod: producao,     titulo: 'Producao' },
  produtos:     { mod: produtos,     titulo: 'Produtos' },
  pedidos:      { mod: pedidos,      titulo: 'Pedidos' },
  financeiro:   { mod: financeiro,   titulo: 'Financeiro' },
  metas:        { mod: metas,        titulo: 'Metas' },
  perdas:       { mod: perdas,       titulo: 'Perdas' },
  backup:       { mod: backup,       titulo: 'Backup e Restauracao' },
};

let rotaAtual = null;

async function navegar(rota) {
  const config = MODULES[rota];
  if (!config) return;

  rotaAtual = rota;

  // Atualiza nav
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.classList.toggle('active', item.dataset.route === rota);
  });

  // Atualiza titulo
  document.getElementById('pageTitle').textContent = config.titulo;

  // Renderiza modulo
  const area = document.getElementById('appContent');
  area.innerHTML = config.mod.render();
  await config.mod.init();

  // Fecha sidebar no mobile
  document.getElementById('sidebar').classList.remove('open');

  // Atualiza hash
  window.location.hash = rota;
}

// Funcao global para navegacao entre modulos
window.navegarPara = function(rota) {
  navegar(rota);
};

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa banco
  await abrirBanco();

  // Data no topbar
  const dataEl = document.getElementById('topbarDate');
  if (dataEl) {
    const hoje = new Date();
    dataEl.textContent = hoje.toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // Navegacao sidebar
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => navegar(item.dataset.route));
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('auth');
    window.location.href = 'index.html';
  });

  // Menu toggle mobile
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Rota inicial (hash ou painel)
  const hashRota = window.location.hash.replace('#', '');
  navegar(MODULES[hashRota] ? hashRota : 'painel');

  // Backup automatico periodico
  verificarBackupAutomatico();
});

// ============================================
// BACKUP AUTOMATICO (a cada 7 dias)
// ============================================
const BACKUP_INTERVALO_DIAS = 7;
const BACKUP_KEY = 'erenice_last_backup';

async function verificarBackupAutomatico() {
  try {
    const ultimoBackup = localStorage.getItem(BACKUP_KEY);
    const agora = Date.now();

    if (!ultimoBackup) {
      // Nunca fez backup - faz o primeiro
      await executarBackupAutomatico();
      return;
    }

    const diasDesdeUltimo = (agora - parseInt(ultimoBackup)) / (1000 * 60 * 60 * 24);

    if (diasDesdeUltimo >= BACKUP_INTERVALO_DIAS) {
      await executarBackupAutomatico();
    } else {
      const diasRestantes = Math.ceil(BACKUP_INTERVALO_DIAS - diasDesdeUltimo);
      console.log(`Proximo backup automatico em ${diasRestantes} dia(s).`);
    }
  } catch (err) {
    console.error('Erro no backup automatico:', err);
  }
}

async function executarBackupAutomatico() {
  try {
    const dados = await exportarTudo();
    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const hoje = new Date();
    const dataStr = hoje.toISOString().split('T')[0];
    const nomeArquivo = `backup-erenice-velas-${dataStr}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem(BACKUP_KEY, Date.now().toString());

    // Notificacao visual
    mostrarNotificacaoBackup(nomeArquivo);
  } catch (err) {
    console.error('Falha no backup automatico:', err);
  }
}

function mostrarNotificacaoBackup(nomeArquivo) {
  const toast = document.createElement('div');
  toast.className = 'toast toast-sucesso';
  toast.innerHTML = `Backup automatico salvo: <strong>${nomeArquivo}</strong>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}
