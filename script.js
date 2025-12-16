	let cifras = [];
	let currentCifraId = null;
	let currentTranspose = 0;
	let editModal, viewModal;

	const notas = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const notasAlt = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
	window.onload = function() {
		editModal = new bootstrap.Modal(document.getElementById('editModal'));
		viewModal = new bootstrap.Modal(document.getElementById('viewModal'));
		loadCifras();
		renderCifras();

		document.getElementById('searchInput').addEventListener('input', function(e) {
			renderCifras(e.target.value);
		});
	};

	function loadCifras() {
		const stored = localStorage.getItem('cifras');
		cifras = stored ? JSON.parse(stored) : [];
	}

	function saveCifras() {
		localStorage.setItem('cifras', JSON.stringify(cifras));
	}

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

		saveCifras();
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
		saveCifras();
		renderCifras();
		viewModal.hide();
	}