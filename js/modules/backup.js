// ============================================
// BACKUP E RESTAURACAO
// Nervo Saboaria - ERP Artesanal
// ============================================

import { exportarTudo, importarTudo, listarTodos } from '../db.js';
import { notificar, confirmar } from '../utils/helpers.js';

const STORES_LABELS = {
  fornecedores: 'Fornecedores',
  insumos: 'Insumos',
  receitas: 'Receitas',
  producao: 'Producao',
  produtos: 'Produtos',
  pedidos: 'Pedidos',
  financeiro: 'Financeiro',
  metas: 'Metas',
  perdas: 'Perdas'
};

const LS_KEY_LAST_BACKUP = 'erenice_last_backup';

// ---- Render (static shell) ----
export function render() {
  return `
    <div class="module-header">
      <h2>
        <span class="material-symbols-outlined">backup</span>
        Backup e Restauracao
      </h2>
    </div>

    <div class="alert alert-info">
      <span class="material-symbols-outlined">info</span>
      <div>
        <strong>Importante:</strong> Seus dados ficam salvos no navegador. Faca backup regularmente
        para nao perder informacoes. O arquivo de backup pode ser guardado no computador, pendrive ou nuvem.
      </div>
    </div>

    <div class="form-row">
      <!-- EXPORTAR (Backup) -->
      <div class="card" style="flex:1">
        <div style="text-align:center; margin-bottom:1rem;">
          <span class="material-symbols-outlined" style="font-size:3rem;color:var(--primary, #6c5ce7);">cloud_download</span>
          <h3>Exportar (Backup)</h3>
          <p>Gere um arquivo com todos os seus dados para guardar em lugar seguro.</p>
        </div>
        <button class="btn btn-primary" id="btnFazerBackup" style="width:100%;">
          <span class="material-symbols-outlined">download</span>
          Fazer Backup
        </button>
      </div>

      <!-- IMPORTAR (Restaurar) -->
      <div class="card" style="flex:1">
        <div style="text-align:center; margin-bottom:1rem;">
          <span class="material-symbols-outlined" style="font-size:3rem;color:var(--warning, #fdcb6e);">cloud_upload</span>
          <h3>Importar (Restaurar)</h3>
          <p>Restaure seus dados a partir de um arquivo de backup gerado anteriormente.</p>
        </div>
        <div class="alert alert-warning" style="margin-bottom:1rem;">
          <span class="material-symbols-outlined">warning</span>
          <span>Atencao: Ao restaurar, <strong>TODOS</strong> os dados atuais serao substituidos pelos dados do backup.</span>
        </div>
        <div class="form-group" style="margin-bottom:0.75rem;">
          <input type="file" id="inputArquivoBackup" accept=".json" class="form-control">
        </div>
        <button class="btn btn-warning" id="btnRestaurarBackup" style="width:100%;">
          <span class="material-symbols-outlined">upload</span>
          Restaurar Backup
        </button>
      </div>
    </div>

    <!-- Sobre seus dados -->
    <div class="card" style="margin-top:1.5rem;">
      <h3>
        <span class="material-symbols-outlined">database</span>
        Sobre seus dados
      </h3>
      <p id="lastBackupInfo" style="margin-bottom:1rem; color: var(--text-muted, #888);"></p>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th style="text-align:right;">Registros</th>
            </tr>
          </thead>
          <tbody id="dados-contagem-tbody">
            <tr><td colspan="2">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ---- Carregar contagem de registros ----
async function carregarContagens() {
  const tbody = document.getElementById('dados-contagem-tbody');
  if (!tbody) return;

  try {
    let totalGeral = 0;
    const linhas = [];

    for (const [store, label] of Object.entries(STORES_LABELS)) {
      const registros = await listarTodos(store);
      const count = registros.length;
      totalGeral += count;
      linhas.push(`
        <tr>
          <td>${label}</td>
          <td style="text-align:right;">${count}</td>
        </tr>
      `);
    }

    linhas.push(`
      <tr style="font-weight:bold; border-top: 2px solid var(--border, #ddd);">
        <td>Total</td>
        <td style="text-align:right;">${totalGeral}</td>
      </tr>
    `);

    tbody.innerHTML = linhas.join('');
  } catch (error) {
    console.error('Erro ao contar registros:', error);
    tbody.innerHTML = '<tr><td colspan="2">Erro ao carregar contagens.</td></tr>';
  }
}

// ---- Exibir ultimo backup ----
function exibirUltimoBackup() {
  const el = document.getElementById('lastBackupInfo');
  if (!el) return;

  const last = localStorage.getItem(LS_KEY_LAST_BACKUP);
  if (last) {
    const data = new Date(last);
    el.textContent = `Ultimo backup: ${data.toLocaleDateString('pt-BR')} as ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    el.textContent = 'Nenhum backup realizado neste navegador.';
  }
}

// ---- Fazer Backup (Exportar) ----
async function fazerBackup() {
  try {
    const dados = await exportarTudo();
    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    const nomeArquivo = `backup-erenice-velas-${yyyy}-${mm}-${dd}.json`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem(LS_KEY_LAST_BACKUP, new Date().toISOString());
    exibirUltimoBackup();

    notificar('Backup realizado com sucesso!');
  } catch (error) {
    console.error('Erro ao fazer backup:', error);
    notificar('Erro ao gerar backup.', 'erro');
  }
}

// ---- Restaurar Backup (Importar) ----
async function restaurarBackup() {
  const input = document.getElementById('inputArquivoBackup');
  if (!input || !input.files || input.files.length === 0) {
    notificar('Selecione um arquivo primeiro.', 'aviso');
    return;
  }

  const file = input.files[0];

  try {
    const texto = await file.text();
    let dados;

    try {
      dados = JSON.parse(texto);
    } catch {
      notificar('Arquivo invalido!', 'erro');
      return;
    }

    if (!dados._meta) {
      notificar('Arquivo invalido!', 'erro');
      return;
    }

    const dataBackup = dados._meta.data_exportacao
      ? new Date(dados._meta.data_exportacao).toLocaleDateString('pt-BR')
      : 'desconhecida';

    const ok = confirmar(
      `Deseja restaurar o backup de ${dataBackup}?\n\nTODOS os dados atuais serao substituidos pelos dados do arquivo selecionado. Esta acao nao pode ser desfeita.`
    );

    if (!ok) return;

    await importarTudo(dados);

    notificar('Dados restaurados com sucesso! Recarregando...');

    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    notificar('Erro ao restaurar backup.', 'erro');
  }
}

// ---- Init (load data + set up listeners) ----
export async function init() {
  // Carregar contagens e info de ultimo backup
  await carregarContagens();
  exibirUltimoBackup();

  // Botao Fazer Backup
  document.getElementById('btnFazerBackup')?.addEventListener('click', fazerBackup);

  // Botao Restaurar Backup
  document.getElementById('btnRestaurarBackup')?.addEventListener('click', restaurarBackup);
}
