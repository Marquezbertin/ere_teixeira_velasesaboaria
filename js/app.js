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
import * as relatorios from './modules/relatorios.js';

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
  relatorios:   { mod: relatorios,   titulo: 'Relatorios' },
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
  // Solicita armazenamento persistente (impede o navegador de apagar dados)
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      console.log('Armazenamento persistente ativado - dados protegidos.');
    } else {
      console.warn('Armazenamento persistente nao foi concedido pelo navegador.');
    }
  }

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

  // Indicador de offline/online
  const offlineBanner = document.createElement('div');
  offlineBanner.id = 'offlineBanner';
  offlineBanner.style.cssText = 'display:none;position:fixed;bottom:0;left:0;right:0;background:#c49a2a;color:#fff;text-align:center;padding:8px;font-size:0.85rem;z-index:9999;';
  offlineBanner.textContent = 'Voce esta sem internet. Pode continuar trabalhando normalmente - seus dados estao seguros.';
  document.body.appendChild(offlineBanner);

  function atualizarStatusConexao() {
    offlineBanner.style.display = navigator.onLine ? 'none' : 'block';
  }
  window.addEventListener('online', atualizarStatusConexao);
  window.addEventListener('offline', atualizarStatusConexao);
  atualizarStatusConexao();
});

// ============================================
// BACKUP AUTOMATICO (a cada 7 dias)
// ============================================
const BACKUP_INTERVALO_DIAS = 1;
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
    // Backup silencioso - salva no localStorage sem abrir dialogo de download
    const dados = await exportarTudo();
    const json = JSON.stringify(dados);
    localStorage.setItem('erenice_dados_seguranca', json);
    localStorage.setItem('erenice_dados_seguranca_ts', new Date().toISOString());
    localStorage.setItem(BACKUP_KEY, Date.now().toString());
    console.log('Backup automatico silencioso realizado com sucesso.');
  } catch (err) {
    console.error('Falha no backup automatico:', err);
  }
}
