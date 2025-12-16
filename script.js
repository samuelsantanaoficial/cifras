let cifras = [];
let currentCifraId = null;
let currentTranspose = 0;
let editModal, viewModal;

const notas = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const notasAlt = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

window.onload = async function() {
    editModal = new bootstrap.Modal(document.getElementById('editModal'));
    viewModal = new bootstrap.Modal(document.getElementById('viewModal'));
    
    // 1. Tenta carregar do arquivo oficial (GitHub/Netlify)
    await loadExternalCifras();
    
    // 2. Carrega as edições locais (LocalStorage) se houver e mescla
    loadLocalCifras();
    
    renderCifras();

    document.getElementById('searchInput').addEventListener('input', function(e) {
        renderCifras(e.target.value);
    });
};

// --- NOVAS FUNÇÕES DE CARREGAMENTO/SALVAMENTO ---

async function loadExternalCifras() {
    try {
        // Tenta ler o arquivo cifras.json que está no servidor (Netlify)
        const response = await fetch('cifras.json');
        if (response.ok) {
            const externalData = await response.json();
            // Define o JSON como a base inicial de todas as cifras
            cifras = externalData; 
        }
    } catch (error) {
        console.warn('Nenhum arquivo externo cifras.json encontrado ou erro ao carregar. Usando apenas LocalStorage.');
    }
}

function loadLocalCifras() {
    const stored = localStorage.getItem('cifras');
    if (stored) {
        const localData = JSON.parse(stored);
        
        // Mescla: Prioriza o que está no LocalStorage (edições não salvas no GitHub)
        localData.forEach(localCifra => {
            const index = cifras.findIndex(c => c.id === localCifra.id);
            if (index !== -1) {
                // Atualiza a cifra do JSON com a versão editada localmente
                cifras[index] = localCifra;
            } else {
                // Adiciona cifras novas criadas localmente
                cifras.push(localCifra);
            }
        });
    }
}

function saveCifras() {
    // Salva no LocalStorage para que as edições não se percam antes do backup
    localStorage.setItem('cifras', JSON.stringify(cifras));
}

function downloadBackup() {
    // Cria um "arquivo" invisível com os dados atuais
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cifras, null, 2));
    const downloadAnchorNode = document.createElement('a');
    
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "cifras.json"); // Nome do arquivo a ser baixado
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    alert('Backup baixado! Substitua o arquivo cifras.json no seu GitHub com este novo arquivo.');
}

// --- RESTANTE DAS FUNÇÕES (RENDERIZAÇÃO, CRUD E TRANSPOSER) ---

function renderCifras(search = '') {
    const list = document.getElementById('cifrasList');
    const empty = document.getElementById('emptyState');

    let filtered = cifras;
    if (search) {
        search = search.toLowerCase();
        filtered = cifras.filter(c => 
            c.musica.toLowerCase().includes(search) || 
            c.artista.toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = filtered.map(cifra => `
        <div class="cifra-card" onclick="viewCifra('${cifra.id}')">
            <h5 class="mb-1">${cifra.musica}</h5>
            <div class="text-muted">${cifra.artista} • Tom: ${cifra.tom}</div>
        </div>
    `).join('');
}

function openAddModal() {
    currentCifraId = null;
    document.getElementById('modalTitle').textContent = 'Nova Cifra';
    document.getElementById('artistaInput').value = '';
    document.getElementById('musicaInput').value = '';
    document.getElementById('tomInput').value = 'C';
    document.getElementById('cifraInput').value = '';
    editModal.show();
}

function saveCifra() {
    const artista = document.getElementById('artistaInput').value.trim();
    const musica = document.getElementById('musicaInput').value.trim();
    const tom = document.getElementById('tomInput').value;
    const conteudo = document.getElementById('cifraInput').value;

    if (!artista || !musica || !conteudo) {
        alert('Preencha todos os campos!');
        return;
    }

    if (currentCifraId) {
        const index = cifras.findIndex(c => c.id === currentCifraId);
        cifras[index] = { ...cifras[index], artista, musica, tom, conteudo };
    } else {
        const novaCifra = {
            id: Date.now().toString(),
            artista,
            musica,
            tom,
            conteudo,
            criado: new Date().toISOString()
        };
        cifras.unshift(novaCifra);
    }

    saveCifras(); // Salva no LocalStorage
    renderCifras();
    editModal.hide();
}

function viewCifra(id) {
    currentCifraId = id;
    currentTranspose = 0;
    const cifra = cifras.find(c => c.id === id);

    document.getElementById('viewTitle').textContent = cifra.musica;
    document.getElementById('viewArtist').textContent = cifra.artista;
    document.getElementById('currentTom').textContent = cifra.tom;

    renderCifraContent(cifra);
    viewModal.show();
}

function renderCifraContent(cifra) {
    const content = document.getElementById('cifraContent');
    const lines = cifra.conteudo.split('\n');

    const html = lines.map(line => {
        // Regex para capturar acordes (inclui sustenidos/bemóis, menores 'm', sétimas '7', barras '/C', etc.)
        const chordRegex = /\b([A-G][#b]?(?:m|maj|dim|aug|sus|add)?[0-9]?(?:\/[A-G][#b]?)?)\b/g;
        return line.replace(chordRegex, match => {
            const transposed = transposeChord(match, currentTranspose);
            return `<span class="chord">${transposed}</span>`;
        });
    }).join('\n');

    content.innerHTML = html;
}

function transposeChord(chord, semitones) {
    const match = chord.match(/^([A-G][#b]?)(.*)/);
    if (!match) return chord;

    let [_, note, suffix] = match;

    let index = notas.indexOf(note);
    if (index === -1) {
        index = notasAlt.indexOf(note);
        if (index === -1) return chord;
    }

    index = (index + semitones + 12) % 12;
    return notas[index] + suffix;
}

function transpose(semitones) {
    currentTranspose += semitones;
    const cifra = cifras.find(c => c.id === currentCifraId);

    const originalIndex = notas.indexOf(cifra.tom);
    const newIndex = (originalIndex + currentTranspose + 12) % 12;
    document.getElementById('currentTom').textContent = notas[newIndex];

    renderCifraContent(cifra);
}

function resetTranspose() {
    currentTranspose = 0;
    const cifra = cifras.find(c => c.id === currentCifraId);
    document.getElementById('currentTom').textContent = cifra.tom;
    renderCifraContent(cifra);
}

function editCifra() {
    const cifra = cifras.find(c => c.id === currentCifraId);
    document.getElementById('modalTitle').textContent = 'Editar Cifra';
    document.getElementById('artistaInput').value = cifra.artista;
    document.getElementById('musicaInput').value = cifra.musica;
    document.getElementById('tomInput').value = cifra.tom;
    document.getElementById('cifraInput').value = cifra.conteudo;

    viewModal.hide();
    editModal.show();
}

function deleteCifra() {
    if (!confirm('Tem certeza que deseja excluir esta cifra?')) return;

    cifras = cifras.filter(c => c.id !== currentCifraId);
    saveCifras(); // Atualiza o LocalStorage
    renderCifras();
    viewModal.hide();
}