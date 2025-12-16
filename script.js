let cifras = [];
let currentTranspose = 0;
let currentCifra = null; // Armazena a cifra aberta na página de visualização
let editModalInstance = null;

const notas = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const notasAlt = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

window.onload = async function() {
    // 1. Carrega dados
    await loadExternalCifras();
    loadLocalCifras();

    // 2. Verifica em qual página estamos
    const path = window.location.pathname;
    const isView = path.includes('view.html');

    if (isView) {
        // --- Lógica da Página de Visualização ---
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        
        if (id) {
            loadVisualizationPage(id);
        } else {
            alert('Cifra não especificada!');
            window.location.href = 'index.html';
        }

        // Configura modal de edição se existir na página
        const modalEl = document.getElementById('editModal');
        if(modalEl) editModalInstance = new bootstrap.Modal(modalEl);

    } else {
        // --- Lógica da Página Inicial (Home) ---
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            renderCifrasList();
            searchInput.addEventListener('input', (e) => renderCifrasList(e.target.value));
        }
    }
};

// ======================================================
// LÓGICA DE DADOS (JSON/Local)
// ======================================================

async function loadExternalCifras() {
    try {
        const response = await fetch('cifras.json');
        if (response.ok) cifras = await response.json();
    } catch (e) { console.log('Sem JSON externo'); }
}

function loadLocalCifras() {
    const stored = localStorage.getItem('cifras');
    if (stored) {
        const localData = JSON.parse(stored);
        localData.forEach(local => {
            const idx = cifras.findIndex(c => c.id === local.id);
            if (idx !== -1) cifras[idx] = local;
            else cifras.push(local);
        });
    }
}

function saveCifrasToLocal() {
    localStorage.setItem('cifras', JSON.stringify(cifras));
}

function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cifras, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "cifras.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// ======================================================
// PÁGINA INICIAL: LISTAGEM
// ======================================================

function renderCifrasList(search = '') {
    const list = document.getElementById('cifrasList');
    if (!list) return; // Não estamos na home

    let filtered = cifras;
    if (search) {
        search = search.toLowerCase();
        filtered = cifras.filter(c => 
            c.musica.toLowerCase().includes(search) || 
            c.artista.toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = '<div class="text-center mt-5">Nenhuma cifra encontrada.</div>';
        return;
    }

    // AQUI MUDOU: O link agora leva para view.html
    list.innerHTML = filtered.map(c => `
        <div class="cifra-card" onclick="window.location.href='view.html?id=${c.id}'">
            <h5 class="mb-1">${c.musica}</h5>
            <div class="text-muted">${c.artista} • Tom: ${c.tom}</div>
        </div>
    `).join('');
}

// ======================================================
// NOVA PÁGINA: VISUALIZAÇÃO
// ======================================================

function loadVisualizationPage(id) {
    currentCifra = cifras.find(c => c.id === id);
    if (!currentCifra) {
        alert('Música não encontrada.');
        window.location.href = 'index.html';
        return;
    }

    document.title = `${currentCifra.musica} - ${currentCifra.artista}`;
    document.getElementById('viewTitle').textContent = currentCifra.musica;
    document.getElementById('songName').textContent = currentCifra.musica;
    document.getElementById('artistName').textContent = currentCifra.artista;
    
    // Renderiza inicialmente sem transposição (0)
    currentTranspose = 0;
    renderCifraContent();
}

// ======================================================
// CORAÇÃO DO SISTEMA: TRANSPOSIÇÃO INTELIGENTE
// ======================================================

function renderCifraContent() {
    const el = document.getElementById('cifraContent');
    const tomDisplay = document.getElementById('currentTom');
    if (!el || !currentCifra) return;

    // Atualiza mostrador do Tom
    const tomOriginalIdx = getNoteIndex(currentCifra.tom);
    if (tomOriginalIdx !== -1) {
        const novoTomIdx = (tomOriginalIdx + currentTranspose + 12) % 12;
        tomDisplay.textContent = notas[novoTomIdx];
    } else {
        tomDisplay.textContent = currentCifra.tom; // Fallback se o tom escrito estiver "errado"
    }

    const lines = currentCifra.conteudo.split('\n');
    
    // REGEX APRIMORADO:
    // Captura: (Nota)(Sufixo opcional)(/Baixo opcional)
    // Ex: "C#m7(b5)/G" -> G1="C#", G2="m7(b5)", G3="/G"
    const chordRegex = /\b([A-G][#b]?)([^/\s]*)(?:\/([A-G][#b]?))?\b/g;

    const html = lines.map(line => {
        // Se a linha parece ser letra (muito longa sem acordes claros), não tente transpor excessivamente
        // Mas a lógica padrão é substituir padrões de acorde
        return line.replace(chordRegex, (match, root, suffix, bass) => {
            // Verifica se é realmente um acorde válido (segurança extra)
            if (getNoteIndex(root) === -1) return match;

            // 1. Transpõe a Tônica (Root)
            const newRoot = transposeNote(root, currentTranspose);
            
            // 2. Transpõe o Baixo (se existir)
            let newBass = "";
            if (bass && getNoteIndex(bass) !== -1) {
                newBass = "/" + transposeNote(bass, currentTranspose);
            }

            // 3. Reconstrói: Nota + Sufixo Original + Novo Baixo
            return `<span class="chord">${newRoot}${suffix || ''}${newBass}</span>`;
        });
    }).join('\n');

    el.innerHTML = html;
}

// Auxiliar: Pega índice da nota (0-11)
function getNoteIndex(noteStr) {
    let idx = notas.indexOf(noteStr);
    if (idx === -1) idx = notasAlt.indexOf(noteStr);
    return idx;
}

// Auxiliar: Transpõe uma nota individual
function transposeNote(noteStr, semitones) {
    let idx = getNoteIndex(noteStr);
    if (idx === -1) return noteStr; // Retorna original se não reconhecer
    
    let newIdx = (idx + semitones + 12) % 12;
    return notas[newIdx];
}

function transpose(val) {
    currentTranspose += val;
    renderCifraContent();
}

function resetTranspose() {
    currentTranspose = 0;
    renderCifraContent();
}

// ======================================================
// ADICIONAR E EDITAR (CRUD)
// ======================================================

// Adicionar (Na Home)
const addModalEl = document.getElementById('addModal'); // Se vc mantiver o modal de add na home
let addModalInstance = null;
if (addModalEl) addModalInstance = new bootstrap.Modal(addModalEl);

function openAddModal() {
    // Limpa campos...
    document.getElementById('newArtista').value = '';
    document.getElementById('newMusica').value = '';
    document.getElementById('newConteudo').value = '';
    if(addModalInstance) addModalInstance.show();
}

function saveNewCifra() {
    const artista = document.getElementById('newArtista').value;
    const musica = document.getElementById('newMusica').value;
    const tom = document.getElementById('newTom').value;
    const conteudo = document.getElementById('newConteudo').value;

    if(!artista || !musica) return alert('Preencha os dados');

    const nova = {
        id: Date.now().toString(),
        artista, musica, tom, conteudo
    };
    cifras.unshift(nova);
    saveCifrasToLocal();
    renderCifrasList();
    if(addModalInstance) addModalInstance.hide();
}

// Editar (Na página View)
function editCurrentCifra() {
    document.getElementById('editId').value = currentCifra.id;
    document.getElementById('editArtista').value = currentCifra.artista;
    document.getElementById('editMusica').value = currentCifra.musica;
    document.getElementById('editTom').value = currentCifra.tom;
    document.getElementById('editConteudo').value = currentCifra.conteudo;
    editModalInstance.show();
}

function saveEdits() {
    const id = document.getElementById('editId').value;
    const idx = cifras.findIndex(c => c.id === id);
    
    if (idx !== -1) {
        cifras[idx].artista = document.getElementById('editArtista').value;
        cifras[idx].musica = document.getElementById('editMusica').value;
        cifras[idx].tom = document.getElementById('editTom').value;
        cifras[idx].conteudo = document.getElementById('editConteudo').value;
        
        saveCifrasToLocal();
        
        // Recarrega a visualização atual
        currentCifra = cifras[idx];
        loadVisualizationPage(id); // Re-renderiza cabeçalho e título
        editModalInstance.hide();
    }
}

function deleteCurrentCifra() {
    if(confirm('Tem certeza? Isso apaga a música.')) {
        cifras = cifras.filter(c => c.id !== currentCifra.id);
        saveCifrasToLocal();
        window.location.href = 'index.html';
    }
}