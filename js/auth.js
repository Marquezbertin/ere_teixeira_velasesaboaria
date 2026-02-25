// ============================================
// AUTENTICACAO - Login com Lockout
// ============================================

const USER_FIXO = "Erenice Teixeira";
const HASH_SENHA = "0196d968ecb6871ef8c688fb1f6c966896408eaf61b3a891f4800bfe9153950c";
const MAX_TENTATIVAS = 3;
const TEMPO_BLOQUEIO = 5 * 60 * 1000;

async function gerarHash(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function verificarBloqueio() {
  const bloqueio = localStorage.getItem("login_bloqueio");
  if (!bloqueio) return false;
  const diff = Date.now() - parseInt(bloqueio);
  if (diff >= TEMPO_BLOQUEIO) {
    localStorage.removeItem("login_bloqueio");
    localStorage.removeItem("login_tentativas");
    return false;
  }
  const restante = Math.ceil((TEMPO_BLOQUEIO - diff) / 1000);
  const min = Math.floor(restante / 60);
  const seg = restante % 60;
  return `Muitas tentativas. Tente novamente em ${min}:${seg.toString().padStart(2, '0')}`;
}

function registrarTentativaFalha() {
  let t = parseInt(localStorage.getItem("login_tentativas") || "0") + 1;
  localStorage.setItem("login_tentativas", t.toString());
  if (t >= MAX_TENTATIVAS) {
    localStorage.setItem("login_bloqueio", Date.now().toString());
    return true;
  }
  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("auth") === "true") {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("errorMessage");

  setInterval(() => {
    const msg = verificarBloqueio();
    if (msg) {
      errorEl.textContent = msg;
      errorEl.className = 'lockout-msg';
    } else if (errorEl.className === 'lockout-msg') {
      errorEl.textContent = '';
      errorEl.className = 'error-msg';
    }
  }, 1000);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bloqueioMsg = verificarBloqueio();
    if (bloqueioMsg) {
      errorEl.textContent = bloqueioMsg;
      errorEl.className = 'lockout-msg';
      return;
    }
    const pass = document.getElementById("password").value;
    if (!pass) {
      errorEl.textContent = "Digite sua senha.";
      errorEl.className = 'error-msg';
      return;
    }
    const hashDigitado = await gerarHash(pass);
    if (hashDigitado === HASH_SENHA) {
      localStorage.setItem("auth", "true");
      localStorage.removeItem("login_tentativas");
      localStorage.removeItem("login_bloqueio");
      window.location.href = "dashboard.html";
    } else {
      const bloqueado = registrarTentativaFalha();
      const tentativas = parseInt(localStorage.getItem("login_tentativas") || "0");
      const restantes = MAX_TENTATIVAS - tentativas;
      if (bloqueado) {
        errorEl.textContent = "Conta bloqueada por 5 minutos.";
        errorEl.className = 'lockout-msg';
      } else {
        errorEl.textContent = `Senha incorreta. ${restantes} tentativa(s) restante(s).`;
        errorEl.className = 'error-msg';
      }
    }
  });
});
