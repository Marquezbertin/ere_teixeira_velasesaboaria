// ============================================
// PROMOCOES (Marketing - Compartilhamento)
// Erenice Teixeira - Velas e Saboarias
// ============================================

import { listarTodos, adicionar, remover, buscarPorId } from '../db.js';
import {
  notificar,
  confirmar,
  formatarData,
  escapeHtml
} from '../utils/helpers.js';

const STORE = 'promocoes';

// ---- Render ----
export function render() {
  return `
    <div class="module-header">
      <h2>Promocoes</h2>
      <button class="btn btn-primary" id="btnNovaPromocao">
        <span class="material-symbols-outlined">add</span>
        Nova Promocao
      </button>
    </div>

    <div class="alert alert-info">
      <span class="material-symbols-outlined">info</span>
      <span>Crie promocoes com imagem e texto para enviar aos seus clientes pelo WhatsApp.</span>
    </div>

    <div id="promocoes-lista" class="cards-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
      <div>Carregando...</div>
    </div>

    <!-- Modal Nova Promocao -->
    <div class="modal" id="modalPromocao">
      <div class="modal-overlay"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nova Promocao</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="formPromocao">
            <div class="form-group">
              <label for="promo-titulo">Titulo *</label>
              <input type="text" id="promo-titulo" placeholder="Ex: Promocao de Verao" required>
            </div>
            <div class="form-group">
              <label for="promo-texto">Texto da mensagem *</label>
              <textarea id="promo-texto" rows="4" placeholder="Escreva o texto que sera enviado junto com a imagem..."></textarea>
            </div>
            <div class="form-group">
              <label for="promo-imagem">Imagem (foto ou arte)</label>
              <input type="file" id="promo-imagem" accept="image/*" class="form-control">
              <div id="promo-preview" style="margin-top:8px;"></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvarPromocao">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

// ---- Render cards ----
function renderLista(promocoes) {
  const container = document.getElementById('promocoes-lista');
  if (!container) return;

  if (promocoes.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;">
        <div class="empty-state">
          <span class="empty-icon material-symbols-outlined">campaign</span>
          <p>Nenhuma promocao criada.</p>
          <p>Clique em <strong>Nova Promocao</strong> para criar sua primeira.</p>
        </div>
      </div>
    `;
    return;
  }

  // Most recent first
  const sorted = [...promocoes].sort((a, b) => new Date(b.data_criacao) - new Date(a.data_criacao));

  container.innerHTML = sorted.map(p => {
    const temImagem = p.imagem_base64 ? true : false;
    const imgHtml = temImagem
      ? `<img src="${p.imagem_base64}" alt="Promocao" style="width:100%;border-radius:var(--radius);max-height:200px;object-fit:cover;margin-bottom:12px;">`
      : `<div style="background:var(--primary-bg);border-radius:var(--radius);height:100px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;color:var(--text-secondary);">
          <span class="material-symbols-outlined" style="font-size:2.5rem;">image</span>
        </div>`;

    return `
      <div class="card" style="padding:16px;">
        ${imgHtml}
        <h4 style="margin-bottom:4px;">${escapeHtml(p.titulo)}</h4>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;white-space:pre-line;">${escapeHtml(p.texto).substring(0, 120)}${p.texto.length > 120 ? '...' : ''}</p>
        <p style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:12px;">Criada em ${formatarData(p.data_criacao)}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-whatsapp-promo" data-id="${p.id}" style="background:#25d366;color:#fff;flex:1;">
            <span class="material-symbols-outlined" style="font-size:1rem;">share</span>
            WhatsApp
          </button>
          <button class="btn btn-sm btn-danger btn-remover-promo" data-id="${p.id}" style="flex:0;">
            <span class="material-symbols-outlined" style="font-size:1rem;">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ---- Load ----
async function carregar() {
  try {
    const promocoes = await listarTodos(STORE);
    renderLista(promocoes);
  } catch (error) {
    console.error('Erro ao carregar promocoes:', error);
  }
}

// ---- Read image as base64 ----
function lerImagemBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---- Save ----
async function salvar() {
  const titulo = document.getElementById('promo-titulo').value.trim();
  const texto = document.getElementById('promo-texto').value.trim();
  const fileInput = document.getElementById('promo-imagem');

  if (!titulo) {
    notificar('Informe o titulo da promocao.', 'erro');
    return;
  }
  if (!texto) {
    notificar('Escreva o texto da mensagem.', 'erro');
    return;
  }

  let imagemBase64 = null;
  if (fileInput.files && fileInput.files[0]) {
    try {
      imagemBase64 = await lerImagemBase64(fileInput.files[0]);
    } catch (e) {
      console.error('Erro ao ler imagem:', e);
      notificar('Erro ao processar a imagem.', 'erro');
      return;
    }
  }

  try {
    await adicionar(STORE, {
      titulo,
      texto,
      imagem_base64: imagemBase64,
      data_criacao: new Date().toISOString()
    });

    fecharModalPromocao();
    notificar('Promocao salva!');
    await carregar();
  } catch (error) {
    console.error('Erro ao salvar promocao:', error);
    notificar('Erro ao salvar promocao.', 'erro');
  }
}

// ---- Share via WhatsApp (with image using Web Share API) ----
async function compartilharWhatsApp(id) {
  try {
    const promo = await buscarPorId(STORE, id);
    if (!promo) return;

    const texto = `*${promo.titulo}*\n\n${promo.texto}\n\n_Erenice Teixeira - Velas & Saboaria_`;

    // Try Web Share API with image (works on mobile and modern desktop)
    if (promo.imagem_base64 && navigator.canShare) {
      try {
        // Convert base64 to File
        const response = await fetch(promo.imagem_base64);
        const blob = await response.blob();
        const file = new File([blob], 'promocao.jpg', { type: blob.type });

        const shareData = {
          text: texto,
          files: [file]
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch (shareError) {
        // User cancelled or Web Share failed - fall back to text-only
        if (shareError.name === 'AbortError') return;
        console.warn('Web Share com imagem nao suportado, usando texto:', shareError);
      }
    }

    // Fallback: WhatsApp text-only (works everywhere)
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  } catch (error) {
    console.error('Erro ao compartilhar:', error);
    notificar('Erro ao compartilhar.', 'erro');
  }
}

// ---- Delete ----
async function removerPromocao(id) {
  if (!confirmar('Deseja remover esta promocao?')) return;

  try {
    await remover(STORE, id);
    notificar('Promocao removida!');
    await carregar();
  } catch (error) {
    console.error('Erro ao remover promocao:', error);
    notificar('Erro ao remover.', 'erro');
  }
}

// ---- Modal helpers ----
function abrirModalPromocao() {
  document.getElementById('formPromocao')?.reset();
  document.getElementById('promo-preview').innerHTML = '';
  document.getElementById('modalPromocao')?.classList.add('active');
}

function fecharModalPromocao() {
  document.getElementById('modalPromocao')?.classList.remove('active');
}

// ---- Init ----
export async function init() {
  await carregar();

  // Modal close
  const modal = document.getElementById('modalPromocao');
  if (modal) {
    modal.querySelector('.modal-close')?.addEventListener('click', fecharModalPromocao);
    modal.querySelector('.modal-overlay')?.addEventListener('click', fecharModalPromocao);
    modal.querySelector('.btn-cancelar')?.addEventListener('click', fecharModalPromocao);
  }

  // New button
  document.getElementById('btnNovaPromocao')?.addEventListener('click', abrirModalPromocao);

  // Save button
  document.getElementById('btnSalvarPromocao')?.addEventListener('click', salvar);

  // Image preview
  document.getElementById('promo-imagem')?.addEventListener('change', async (e) => {
    const preview = document.getElementById('promo-preview');
    const file = e.target.files?.[0];
    if (file && preview) {
      const base64 = await lerImagemBase64(file);
      preview.innerHTML = `<img src="${base64}" style="max-width:100%;max-height:200px;border-radius:var(--radius);border:1px solid var(--border);">`;
    }
  });

  // Delegate card actions
  document.getElementById('promocoes-lista')?.addEventListener('click', (e) => {
    const btnWhatsApp = e.target.closest('.btn-whatsapp-promo');
    if (btnWhatsApp) {
      compartilharWhatsApp(Number(btnWhatsApp.dataset.id));
      return;
    }

    const btnRemover = e.target.closest('.btn-remover-promo');
    if (btnRemover) {
      removerPromocao(Number(btnRemover.dataset.id));
    }
  });
}
