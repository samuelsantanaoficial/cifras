let cifras = [];
let currentTranspose = 0;
let currentCifra = null;
let editModalInstance = null;

// NÃO declare "let Tonal" - ele já existe globalmente!
// Apenas use window.Tonal diretamente

window.onload = async function() {
    console.log('🎵 Iniciando aplicação...');
    
    // Aguarda Tonal.js carregar
    await waitForTonal();
    
    // 1. Carrega dados
    await loadExternalCifras();
    loadLocalCifras();

    // 2. Verifica em qual página estamos
    const path = window.location.pathname;
    const isView = path.includes('view.html');

    if (isView) {
        console.log('📄 Carregando página de visualização...');
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        
        if (id) {
            loadVisualizationPage(id);
        } else {
            alert('Cifra não especificada!');
            window.location.href = 'index.html';
        }

        const modalEl = document.getElementById('editModal');
        if(modalEl) editModalInstance = new bootstrap.Modal(modalEl);

    } else {
        console.log('🏠 Carregando página inicial...');
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            renderCifrasList();
            searchInput.addEventListener('input', (e) => renderCifrasList(e.target.value));
        }
    }
};

// Aguarda o Tonal.js carregar
async function waitForTonal() {
    console.log('⏳ Aguardando Tonal.js...');
    let attempts = 0;
    
    while (!window.Tonal && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (window.Tonal) {
        console.log('✅ Tonal.js carregado com sucesso!');
    } else {
        console.warn('⚠️ Tonal.js não carregou - usando modo fallback');
    }
}

// ======================================================
// LÓGICA DE DADOS (JSON/Local)
// ======================================================

async function loadExternalCifras() {
    try {
        const response = await fetch('cifras.json');
        if (response.ok) {
            cifras = await response.json();
            console.log(`📁 Carregadas ${cifras.length} cifras do JSON`);
        }
    } catch (e) { 
        console.log('ℹ️ Sem JSON externo ou erro ao carregar'); 
    }
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
        console.log(`💾 Dados locais carregados`);
    }
}

function saveCifrasToLocal() {
    localStorage.setItem('cifras', JSON.stringify(cifras));
    console.log('💾 Dados salvos localmente');
}

function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cifras, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "cifras-backup-" + new Date().toISOString().split('T')[0] + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    console.log('⬇️ Backup baixado');
}

// ======================================================
// PÁGINA INICIAL: LISTAGEM
// ======================================================

function renderCifrasList(search = '') {
    const list = document.getElementById('cifrasList');
    if (!list) return;

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

    list.innerHTML = filtered.map(c => `
        <div class="cifra-card" onclick="window.location.href='view.html?id=${c.id}'">
            <h5 class="mb-1">${c.musica}</h5>
            <div class="text-muted">${c.artista} • Tom: ${c.tom}</div>
        </div>
    `).join('');
}

// ======================================================
// PÁGINA DE VISUALIZAÇÃO
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
    
    currentTranspose = 0;
    renderCifraContent();
    console.log(`🎵 Cifra carregada: ${currentCifra.musica}`);
}

// ======================================================
// TRANSPOSIÇÃO COM TONAL.JS
// ======================================================

function renderCifraContent() {
    console.log('🎨 Renderizando conteúdo... transpose:', currentTranspose);
    
    const el = document.getElementById('cifraContent');
    const tomDisplay = document.getElementById('currentTom');
    const enharmonicBadge = document.getElementById('enharmonicBadge');
    
    if (!el || !currentCifra) {
        console.error('❌ Elemento não encontrado ou cifra inválida');
        return;
    }

    // Atualiza o tom exibido
    if (window.Tonal) {
        updateKeyWithTonal(tomDisplay, enharmonicBadge);
    } else {
        updateKeyFallback(tomDisplay);
        if (enharmonicBadge) enharmonicBadge.style.display = 'none';
    }

    // Renderiza conteúdo
    const lines = currentCifra.conteudo.split('\n');
    
    const html = lines.map(line => {
        // ANÁLISE DE CONTEXTO: É uma linha de acordes ou de letra?
        const isChordLine = detectChordLine(line);
        
        if (!isChordLine) {
            // Se não é linha de acordes, retorna sem processamento
            return line;
        }
        
        // É linha de acordes, processa normalmente
        const chordRegex = /\b([A-G][#b]?)([^/\s\n]*)(?:\/([A-G][#b]?))?\b/g;
        
        return line.replace(chordRegex, (match, root, suffix, bass) => {
            // VALIDAÇÃO: só transpõe se for um acorde válido
            if (!isValidChord(match)) {
                return match; // Retorna texto original (não é acorde)
            }
            
            if (window.Tonal) {
                return transposeChordWithTonal(root, suffix, bass, match);
            } else {
                return transposeChordFallback(root, suffix, bass, match);
            }
        });
    }).join('\n');

    el.innerHTML = html;
    console.log('✅ Conteúdo renderizado');
}

// Detecta se uma linha contém principalmente acordes ou letra
function detectChordLine(line) {
    if (!line || line.trim() === '') return false;
    
    const trimmed = line.trim();
    
    // 1. Linhas entre colchetes são seções [Intro], [Refrão]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return false;
    }
    
    // 2. Remove parênteses que podem conter acordes: (Am G)
    const lineWithoutParens = trimmed.replace(/\([^)]+\)/g, match => {
        // Verifica se dentro dos parênteses tem acordes
        const inside = match.slice(1, -1).trim();
        const words = inside.split(/\s+/);
        const allChords = words.every(w => isValidChord(w.trim()));
        if (allChords) return match; // Mantém se todos são acordes
        return ''; // Remove se não são acordes
    });
    
    // 3. Conta palavras vs possíveis acordes
    const words = lineWithoutParens.split(/\s+/).filter(w => w.trim());
    
    if (words.length === 0) return false;
    
    // 4. Verifica quantas palavras PARECEM acordes
    let chordCount = 0;
    let textCount = 0;
    
    for (const word of words) {
        // Remove pontuação
        const clean = word.replace(/[,.:;!?()]/g, '').trim();
        if (!clean) continue;
        
        // Se tem acento ou ç, definitivamente não é acorde
        if (/[áéíóúâêîôûãõàèìòùäëïöüç]/i.test(clean)) {
            textCount += 2; // Peso maior para palavras acentuadas
            continue;
        }
        
        // Palavras muito longas (7+ chars) raramente são acordes
        if (clean.length > 7) {
            textCount++;
            continue;
        }
        
        // Palavras que começam com minúscula não são acordes
        if (/^[a-z]/.test(clean)) {
            textCount++;
            continue;
        }
        
        // Testa se é um acorde válido
        if (isValidChord(clean)) {
            chordCount++;
        } else if (clean.length > 2) {
            // Palavra de 3+ chars que não é acorde = provavelmente texto
            textCount++;
        }
    }
    
    // 5. Decisão baseada em proporção
    // Se tem pelo menos 1 acorde e zero texto claro, é linha de acorde
    if (chordCount >= 1 && textCount === 0) {
        return true;
    }
    
    // Se tem mais acordes que texto, é linha de acorde
    if (chordCount > textCount) {
        return true;
    }
    
    // Se tem 2+ acordes e pouco texto (1), ainda considera acorde
    if (chordCount >= 2 && textCount <= 1) {
        return true;
    }
    
    return false;
}

// Atualiza tom com Tonal.js
function updateKeyWithTonal(tomDisplay, enharmonicBadge) {
    try {
        const interval = window.Tonal.Interval.fromSemitones(currentTranspose);
        let newKey = window.Tonal.Note.transpose(currentCifra.tom, interval);
        newKey = window.Tonal.Note.simplify(newKey);
        tomDisplay.textContent = newKey;

        const enharmonic = window.Tonal.Note.enharmonic(newKey);
        if (enharmonicBadge && enharmonic && enharmonic !== newKey) {
            enharmonicBadge.textContent = `ou ${enharmonic}`;
            enharmonicBadge.style.display = 'inline';
        } else if (enharmonicBadge) {
            enharmonicBadge.style.display = 'none';
        }
    } catch (e) {
        console.error('Erro ao transpor tom:', e);
        tomDisplay.textContent = currentCifra.tom;
        if (enharmonicBadge) enharmonicBadge.style.display = 'none';
    }
}

// Atualiza tom - modo fallback
function updateKeyFallback(tomDisplay) {
    const notas = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const notasAlt = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    
    // Extrai apenas a nota do tom (sem m, 7, etc)
    const tomBase = currentCifra.tom.match(/^[A-G][#b]?/)?.[0] || currentCifra.tom;
    
    let idx = notas.indexOf(tomBase);
    if (idx === -1) idx = notasAlt.indexOf(tomBase);
    
    if (idx !== -1) {
        const newIdx = (idx + currentTranspose + 12) % 12;
        tomDisplay.textContent = notas[newIdx];
    } else {
        tomDisplay.textContent = currentCifra.tom;
    }
}

// Transpõe acorde com Tonal.js
function transposeChordWithTonal(root, suffix, bass, original) {
    if (!isValidNote(root)) return original;

    try {
        const interval = window.Tonal.Interval.fromSemitones(currentTranspose);
        let newRoot = window.Tonal.Note.transpose(root, interval);
        
        // ENHARMONIA INTELIGENTE baseada no tom
        newRoot = getEnharmonicForKey(newRoot, currentCifra.tom, currentTranspose);

        let newBass = '';
        if (bass && isValidNote(bass)) {
            let transposedBass = window.Tonal.Note.transpose(bass, interval);
            transposedBass = getEnharmonicForKey(transposedBass, currentCifra.tom, currentTranspose);
            newBass = '/' + transposedBass;
        }

        const transposedChord = newRoot + (suffix || '') + newBass;
        return `<span class="chord">${transposedChord}</span>`;
    } catch (e) {
        console.error('Erro ao transpor acorde:', e);
        return original;
    }
}

// Escolhe enharmonia correta baseada no tom - VERSÃO MUSICAL CORRETA
function getEnharmonicForKey(note, originalKey, transposeSteps) {
    if (!window.Tonal) return note;
    
    try {
        // Calcula o novo tom
        const interval = window.Tonal.Interval.fromSemitones(transposeSteps);
        let newKey = window.Tonal.Note.transpose(originalKey, interval);
        
        // Extrai apenas a nota do tom (sem m, 7, etc)
        const keyNote = newKey.match(/^[A-G][#b]?/)?.[0] || newKey;
        
        // CORREÇÃO: Converte tons raros/incorretos para equivalentes corretos
        const correctedKey = correctKeySignature(keyNote);
        
        // Determina se o tom usa # ou b
        const usesSharps = isSharpKey(correctedKey);
        const usesFlats = isFlatKey(correctedKey);
        
        // Simplifica a nota primeiro
        let simplified = window.Tonal.Note.simplify(note);
        
        // Se a nota já está "natural" (sem acidentes), retorna
        if (!/[#b]/.test(simplified)) {
            return simplified;
        }
        
        // Pega a enharmonia
        const enharmonic = window.Tonal.Note.enharmonic(simplified);
        
        if (!enharmonic || enharmonic === simplified) {
            return simplified;
        }
        
        // Decide qual usar baseado no tom
        if (usesSharps) {
            // Tom usa sustenidos: prefere notas com #
            if (simplified.includes('#')) return simplified;
            if (enharmonic.includes('#')) return enharmonic;
            // Se nenhuma tem #, usa a simplificada
            return simplified;
        }
        
        if (usesFlats) {
            // Tom usa bemóis: prefere notas com b
            if (simplified.includes('b')) return simplified;
            if (enharmonic.includes('b')) return enharmonic;
            // Se nenhuma tem b, usa a simplificada
            return simplified;
        }
        
        // Tom natural (C, Am): usa a mais comum (simplificada)
        return simplified;
        
    } catch (e) {
        console.error('Erro ao processar enharmonia:', e);
        return note;
    }
}

// Corrige assinaturas de tom para as mais comuns/corretas
function correctKeySignature(keyNote) {
    const corrections = {
        // Tons com sustenidos que existem mas são raros
        'A#': 'Bb',  // A# → Bb (muito mais comum)
        'D#': 'Eb',  // D# → Eb (muito mais comum)
        'G#': 'Ab',  // G# → Ab (muito mais comum)
        
        // Tons com bemóis que praticamente não existem
        'Gb': 'F#',  // Gb raramente usado, F# é padrão
        'Cb': 'B',   // Cb não existe na prática
        'Fb': 'E',   // Fb não existe na prática
        'E#': 'F',   // E# não existe na prática
        'B#': 'C',   // B# não existe na prática
        
        // Dobrados acidentes (nunca devem aparecer)
        'Abb': 'G',
        'Bbb': 'A',
        'Cbb': 'Bb',
        'Dbb': 'C',
        'Ebb': 'D',
        'Fbb': 'Eb',
        'Gbb': 'F',
        'A##': 'B',
        'C##': 'D',
        'D##': 'E',
        'E##': 'F#',
        'F##': 'G',
        'G##': 'A',
    };
    
    return corrections[keyNote] || keyNote;
}

// Verifica se o tom usa sustenidos - LISTA CORRETA
function isSharpKey(keyNote) {
    const sharpKeys = [
        'G',   // 1 sustenido: F#
        'D',   // 2 sustenidos: F#, C#
        'A',   // 3 sustenidos: F#, C#, G#
        'E',   // 4 sustenidos: F#, C#, G#, D#
        'B',   // 5 sustenidos: F#, C#, G#, D#, A#
        'F#',  // 6 sustenidos: F#, C#, G#, D#, A#, E#
        'C#',  // 7 sustenidos: todos
    ];
    return sharpKeys.includes(keyNote);
}

// Verifica se o tom usa bemóis - LISTA CORRETA
function isFlatKey(keyNote) {
    const flatKeys = [
        'F',   // 1 bemol: Bb
        'Bb',  // 2 bemóis: Bb, Eb
        'Eb',  // 3 bemóis: Bb, Eb, Ab
        'Ab',  // 4 bemóis: Bb, Eb, Ab, Db
        'Db',  // 5 bemóis: Bb, Eb, Ab, Db, Gb
    ];
    return flatKeys.includes(keyNote);
}

// Transpõe acorde - modo fallback
function transposeChordFallback(root, suffix, bass, original) {
    const notas = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const notasAlt = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    
    let idx = notas.indexOf(root);
    if (idx === -1) idx = notasAlt.indexOf(root);
    if (idx === -1) return original;
    
    const newIdx = (idx + currentTranspose + 12) % 12;
    const newRoot = notas[newIdx];
    
    let newBass = '';
    if (bass) {
        let bassIdx = notas.indexOf(bass);
        if (bassIdx === -1) bassIdx = notasAlt.indexOf(bass);
        if (bassIdx !== -1) {
            const newBassIdx = (bassIdx + currentTranspose + 12) % 12;
            newBass = '/' + notas[newBassIdx];
        }
    }
    
    const transposed = newRoot + (suffix || '') + newBass;
    return `<span class="chord">${transposed}</span>`;
}

function isValidNote(note) {
    if (!note) return false;
    if (!window.Tonal) {
        const notas = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const notasAlt = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        return notas.includes(note) || notasAlt.includes(note);
    }
    try {
        const noteObj = window.Tonal.Note.get(note);
        return noteObj.name !== null && noteObj.name !== '';
    } catch {
        return false;
    }
}

// Valida se o texto é realmente um acorde válido - USANDO TONAL.JS
function isValidChord(chordString) {
    if (!chordString || chordString.length > 15) return false;
    
    // Modo com Tonal.js (PRIORIDADE)
    if (window.Tonal) {
        try {
            // Separa baixo se existir (Ex: C/G -> C e G)
            const parts = chordString.split('/');
            const mainChord = parts[0];
            const bassNote = parts[1];
            
            // Valida o acorde principal
            const chordData = window.Tonal.Chord.get(mainChord);
            
            // Se o Tonal reconheceu o acorde (tem tônica)
            if (chordData.tonic && chordData.tonic !== '') {
                // Se tem baixo, valida o baixo também
                if (bassNote) {
                    const bassData = window.Tonal.Note.get(bassNote);
                    return bassData.name && bassData.name !== '';
                }
                return true;
            }
            
            // Se não é acorde, tenta validar como nota simples (C, D#, etc)
            if (chordString.length <= 3 && !chordString.includes('/')) {
                const noteData = window.Tonal.Note.get(chordString);
                return noteData.name && noteData.name !== '';
            }
            
            return false;
        } catch (e) {
            console.log('Erro ao validar:', chordString, e);
            return false;
        }
    }
    
    // Fallback SEM Tonal.js (apenas padrões básicos)
    const basicPattern = /^[A-G][#b]?(m|maj|dim|aug|sus[24]?|add)?[0-9]*(M|°|º|ø)?(\([#b]?[0-9]+\)|[#b][0-9]+)?(\/[A-G][#b]?)?$/;
    return basicPattern.test(chordString);
}

// Funções de transposição - CRÍTICAS
function transpose(val) {
    console.log(`🎵 Transpor: ${val} semitons (atual: ${currentTranspose})`);
    currentTranspose += val;
    renderCifraContent();
}

function resetTranspose() {
    console.log('🔄 Reset transposição');
    currentTranspose = 0;
    renderCifraContent();
}

// ======================================================
// ADICIONAR E EDITAR (CRUD)
// ======================================================

const addModalEl = document.getElementById('addModal');
let addModalInstance = null;
if (addModalEl) addModalInstance = new bootstrap.Modal(addModalEl);

function openAddModal() {
    console.log('➕ Abrindo modal de adicionar');
    document.getElementById('newArtista').value = '';
    document.getElementById('newMusica').value = '';
    document.getElementById('newTom').value = 'C';
    document.getElementById('newConteudo').value = '';
    if(addModalInstance) addModalInstance.show();
}

function saveNewCifra() {
    const artista = document.getElementById('newArtista').value.trim();
    const musica = document.getElementById('newMusica').value.trim();
    const tom = document.getElementById('newTom').value;
    const conteudo = document.getElementById('newConteudo').value;

    if(!artista || !musica || !conteudo) {
        alert('Preencha todos os campos obrigatórios!');
        return;
    }

    const nova = {
        id: Date.now().toString(),
        artista, 
        musica, 
        tom, 
        conteudo,
        criado: new Date().toISOString()
    };
    
    cifras.unshift(nova);
    saveCifrasToLocal();
    renderCifrasList();
    if(addModalInstance) addModalInstance.hide();
    console.log('✅ Nova cifra salva:', musica);
}

function editCurrentCifra() {
    if (!currentCifra) return;
    
    console.log('✏️ Editando cifra:', currentCifra.musica);
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
        cifras[idx].artista = document.getElementById('editArtista').value.trim();
        cifras[idx].musica = document.getElementById('editMusica').value.trim();
        cifras[idx].tom = document.getElementById('editTom').value;
        cifras[idx].conteudo = document.getElementById('editConteudo').value;
        cifras[idx].modificado = new Date().toISOString();
        
        saveCifrasToLocal();
        
        currentCifra = cifras[idx];
        loadVisualizationPage(id);
        editModalInstance.hide();
        console.log('✅ Cifra editada:', currentCifra.musica);
    }
}

function deleteCurrentCifra() {
    if(!currentCifra) return;
    
    if(confirm(`Tem certeza que deseja excluir "${currentCifra.musica}"?\n\nEsta ação não pode ser desfeita.`)) {
        console.log('🗑️ Excluindo cifra:', currentCifra.musica);
        cifras = cifras.filter(c => c.id !== currentCifra.id);
        saveCifrasToLocal();
        window.location.href = 'index.html';
    }
}