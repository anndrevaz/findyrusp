import { getFirestore, collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _db = null;
let _usuarioAtual = null;

export function iniciarAprovacoes(db, usuarioAtual) {
  _db = db;
  _usuarioAtual = usuarioAtual;
  injetarEstilos();
  injetarModal();
}

function injetarEstilos() {
  if (document.getElementById("estilos-aprovacoes")) return;
  const style = document.createElement("style");
  style.id = "estilos-aprovacoes";
  style.textContent = `
    .banner-pendentes {
      background: #fff8f6;
      border: 1px solid #fdd;
      border-radius: 10px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .banner-pendentes:hover { background: #fff0ec; }
    .banner-pendentes span { font-size: 14px; color: #e85d3d; font-weight: 600; }
    .banner-pendentes small { font-size: 12px; color: #aaa; }

    .overlay-aprovacoes {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.4); z-index: 200;
      justify-content: center; align-items: center;
    }
    .overlay-aprovacoes.ativo { display: flex; }
    .modal-aprovacoes {
      background: white; border-radius: 16px;
      padding: 32px; width: 100%; max-width: 520px;
      margin: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      max-height: 80vh; overflow-y: auto;
    }
    .modal-aprovacoes h2 { font-size: 18px; color: #222; margin-bottom: 4px; }
    .modal-aprovacoes .subtitulo { font-size: 13px; color: #aaa; margin-bottom: 24px; }

    .solicitacao-card {
      background: #f9f9f9; border-radius: 10px;
      padding: 16px; margin-bottom: 12px;
    }
    .solicitacao-topo {
      display: flex; align-items: center; gap: 12px; margin-bottom: 10px;
    }
    .solicitacao-topo img {
      width: 44px; height: 44px;
      border-radius: 50%; object-fit: cover;
    }
    .solicitacao-info .nome { font-size: 14px; font-weight: 600; color: #222; }
    .solicitacao-info .turma-nome { font-size: 12px; color: #aaa; margin-top: 2px; }
    .solicitacao-apresentacao {
      font-size: 13px; color: #555; line-height: 1.6;
      background: white; border-radius: 8px;
      padding: 10px 12px; margin-bottom: 12px;
      border: 1px solid #eee;
    }
    .solicitacao-acoes { display: flex; gap: 8px; }
    .btn-aprovar {
      flex: 2; padding: 10px;
      background: #e85d3d; border: none;
      border-radius: 8px; font-size: 13px;
      cursor: pointer; color: white; font-weight: 600;
      transition: background 0.2s;
    }
    .btn-aprovar:hover { background: #d44e2f; }
    .btn-recusar {
      flex: 1; padding: 10px;
      background: white; border: 1.5px solid #ddd;
      border-radius: 8px; font-size: 13px;
      cursor: pointer; color: #888;
    }
    .btn-fechar-aprovacoes {
      width: 100%; padding: 12px; margin-top: 8px;
      background: white; border: 1.5px solid #ddd;
      border-radius: 8px; font-size: 14px;
      cursor: pointer; color: #888;
    }
    .sem-pendentes {
      text-align: center; padding: 32px 0;
      color: #aaa; font-size: 14px;
    }
  `;
  document.head.appendChild(style);
}

function injetarModal() {
  if (document.getElementById("overlay-aprovacoes")) return;
  const div = document.createElement("div");
  div.innerHTML = `
    <div class="overlay-aprovacoes" id="overlay-aprovacoes">
      <div class="modal-aprovacoes">
        <h2>Solicitações pendentes</h2>
        <div class="subtitulo" id="aprovacoes-subtitulo"></div>
        <div id="lista-solicitacoes"></div>
        <button class="btn-fechar-aprovacoes" onclick="window.fecharAprovacoes()">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

export async function carregarPendentes(turmaIdFiltro = null) {
  const snapshot = await getDocs(collection(_db, "turmas"));
  const turmas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filtra só turmas que o usuário é membro
  const minhasTurmas = turmas.filter(t =>
    (t.membros || []).some(m => m.uid === _usuarioAtual.uid)
  );

  // Se turmaIdFiltro, mostra só pendentes daquela turma
  const turmasFiltradas = turmaIdFiltro
    ? minhasTurmas.filter(t => t.id === turmaIdFiltro)
    : minhasTurmas;

  const pendentes = [];
  turmasFiltradas.forEach(turma => {
    (turma.pendentes || []).forEach(p => {
      pendentes.push({ ...p, turmaId: turma.id, turmaNome: turma.nome });
    });
  });

  return pendentes;
}

export async function renderizarBanner(container, turmaIdFiltro = null) {
  const pendentes = await carregarPendentes(turmaIdFiltro);
  if (pendentes.length === 0) return;

  const banner = document.createElement("div");
  banner.className = "banner-pendentes";
  banner.id = "banner-pendentes";
  banner.onclick = () => abrirAprovacoes(turmaIdFiltro);
  banner.innerHTML = `
    <span>📋 ${pendentes.length} ${pendentes.length === 1 ? 'solicitação pendente' : 'solicitações pendentes'}</span>
    <small>Clique para ver →</small>
  `;
  container.insertBefore(banner, container.firstChild);
}

async function abrirAprovacoes(turmaIdFiltro = null) {
  const pendentes = await carregarPendentes(turmaIdFiltro);
  const lista = document.getElementById("lista-solicitacoes");
  const subtitulo = document.getElementById("aprovacoes-subtitulo");

  subtitulo.textContent = turmaIdFiltro
    ? "Solicitações para esta turma"
    : "Solicitações em todas as suas turmas";

  if (pendentes.length === 0) {
    lista.innerHTML = '<div class="sem-pendentes">Nenhuma solicitação pendente.</div>';
  } else {
    lista.innerHTML = pendentes.map((p, i) => `
      <div class="solicitacao-card" id="sol-${i}">
        <div class="solicitacao-topo">
          <img src="${p.foto}" alt="">
          <div class="solicitacao-info">
            <div class="nome">${p.nome}</div>
            <div class="turma-nome">${p.turmaNome}</div>
          </div>
        </div>
        <div class="solicitacao-apresentacao">${p.apresentacao}</div>
        <div class="solicitacao-acoes">
          <button class="btn-recusar" onclick="window.recusarMembro('${p.turmaId}', ${i}, '${p.uid}')">Recusar</button>
          <button class="btn-aprovar" onclick="window.aprovarMembro('${p.turmaId}', ${i}, '${p.uid}', '${p.nome}', '${p.foto}')">Aprovar</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById("overlay-aprovacoes").classList.add("ativo");
}

window.fecharAprovacoes = () => {
  document.getElementById("overlay-aprovacoes").classList.remove("ativo");
};

window.aprovarMembro = async (turmaId, index, uid, nome, foto) => {
  const btn = document.querySelector(`#sol-${index} .btn-aprovar`);
  btn.disabled = true;
  btn.textContent = "Aprovando...";

  const ref = doc(_db, "turmas", turmaId);
  const snap = await getDocs(collection(_db, "turmas"));
  const turmaSnap = snap.docs.find(d => d.id === turmaId);
  const turmaData = turmaSnap.data();
  const pendente = (turmaData.pendentes || []).find(p => p.uid === uid);

  if (pendente) {
    await updateDoc(ref, {
      membros: arrayUnion({ uid: pendente.uid, nome: pendente.nome, foto: pendente.foto, email: pendente.email }),
      pendentes: arrayRemove(pendente)
    });
  }

  document.getElementById(`sol-${index}`).remove();

  const lista = document.getElementById("lista-solicitacoes");
  if (!lista.querySelector(".solicitacao-card")) {
    lista.innerHTML = '<div class="sem-pendentes">Nenhuma solicitação pendente.</div>';
    const banner = document.getElementById("banner-pendentes");
    if (banner) banner.remove();
  }
};

window.recusarMembro = async (turmaId, index, uid) => {
  const ref = doc(_db, "turmas", turmaId);
  const snap = await getDocs(collection(_db, "turmas"));
  const turmaSnap = snap.docs.find(d => d.id === turmaId);
  const turmaData = turmaSnap.data();
  const pendente = (turmaData.pendentes || []).find(p => p.uid === uid);

  if (pendente) {
    await updateDoc(ref, { pendentes: arrayRemove(pendente) });
  }

  document.getElementById(`sol-${index}`).remove();

  const lista = document.getElementById("lista-solicitacoes");
  if (!lista.querySelector(".solicitacao-card")) {
    lista.innerHTML = '<div class="sem-pendentes">Nenhuma solicitação pendente.</div>';
    const banner = document.getElementById("banner-pendentes");
    if (banner) banner.remove();
  }
};