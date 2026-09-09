// Player imperativo con PRECARGA al import.
//
// Problema típico si se instancia en el click: el mp3 pesa 10 MB y
// recién arranca a bajar en el click → play() no puede hacer seek al
// timestamp deseado porque el buffer no llegó. Solución: crear el
// Audio al importarse el módulo (una vez), setear preload="auto" para
// que el browser lo descargue en background, y en el click solo hacer
// play() sobre el objeto ya listo.

let audioEl = null;
let ensureAudio = null;
let currentFadeId = null;

const SRC = '/life-is-life.mp3';

if (typeof window !== 'undefined') {
	ensureAudio = () => {
		if (audioEl) return audioEl;
		audioEl = new Audio(SRC);
		audioEl.preload = 'auto';
		audioEl.crossOrigin = 'anonymous';
		// Sin loop — cortamos manualmente después de duration ms
		audioEl.load();
		return audioEl;
	};
	// Ensure it's ready ASAP tras el primer import
	ensureAudio();
}

export const playIntroAudio = ({
	startAt = 30,
	duration = 6000,
	volume = 0.8,
	fadeMs = 800,
} = {}) => {
	const audio = ensureAudio ? ensureAudio() : null;
	if (!audio) return;

	if (currentFadeId) {
		clearInterval(currentFadeId);
		currentFadeId = null;
	}
	try { audio.pause(); } catch {}
	try { audio.currentTime = startAt; } catch {}
	audio.volume = volume;

	const doPlay = () => {
		const p = audio.play();
		if (p && typeof p.then === 'function') p.catch((err) => {
			console.warn('[playIntroAudio] play falló:', err);
		});
	};

	if (audio.readyState >= 2) {
		// HAVE_CURRENT_DATA o mejor — seek está garantizado
		doPlay();
	} else {
		// Todavía descargando metadata. Esperamos canplay una vez.
		const onReady = () => {
			audio.removeEventListener('canplay', onReady);
			try { audio.currentTime = startAt; } catch {}
			doPlay();
		};
		audio.addEventListener('canplay', onReady, { once: true });
	}

	// Fadeout suave los últimos `fadeMs` ms
	const fadeAt = Math.max(0, duration - fadeMs);
	setTimeout(() => {
		if (!audio || audio.paused) return;
		let v = audio.volume;
		const step = v / (fadeMs / 50);
		currentFadeId = setInterval(() => {
			v -= step;
			if (v <= 0.02) {
				clearInterval(currentFadeId);
				currentFadeId = null;
				try { audio.pause(); } catch {}
			} else {
				audio.volume = v;
			}
		}, 50);
	}, fadeAt);
};
