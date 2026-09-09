import React, { useEffect, useRef } from 'react';

// Player de intro que arranca el audio en un offset dado (ej. inicio del
// estribillo) y lo suena `duration` ms con fadeout suave. Sin UI, sin
// controls — reproduce y desaparece.
//
// Autoplay: los browsers modernos rechazan .play() sin gesto previo del
// usuario. Truco: si el primer try falla, escuchamos el primer
// click/touch/keydown en el document y disparamos el play ahí.
//
// Props:
//   src        ruta del mp3 (default '/life-is-life.mp3')
//   startAt    segundo desde el cual empezar (default 30 — cerca del
//              estribillo típico). Se puede tunear.
//   duration   ms de reproducción antes del fadeout (default 6000)
//   volume     0..1 (default 0.8)
const AudioIntro = ({
	src = '/life-is-life.mp3',
	startAt = 30,
	duration = 6000,
	volume = 0.8,
}) => {
	const audioRef = useRef(null);

	useEffect(() => {
		const el = audioRef.current;
		if (!el) return;

		const start = () => {
			try {
				el.currentTime = startAt;
				el.volume = volume;
			} catch (_) { /* algunos browsers no permiten set currentTime antes del canplay */ }
			const p = el.play();
			if (p && typeof p.then === 'function') p.catch(() => { /* bloqueado */ });
		};

		// Cuando el audio está listo (canplay), setear currentTime + play
		const onCanPlay = () => {
			el.removeEventListener('canplay', onCanPlay);
			start();
		};
		if (el.readyState >= 3) start(); // ya disponible
		else el.addEventListener('canplay', onCanPlay);

		// Fallback: si el autoplay fue bloqueado, arranca en el primer gesto
		const onGesture = () => {
			if (el.paused) start();
			document.removeEventListener('click', onGesture);
			document.removeEventListener('touchstart', onGesture);
			document.removeEventListener('keydown', onGesture);
		};
		document.addEventListener('click', onGesture, { once: true });
		document.addEventListener('touchstart', onGesture, { once: true });
		document.addEventListener('keydown', onGesture, { once: true });

		// Fadeout suave 800ms antes del final
		const fadeAt = Math.max(0, duration - 800);
		const t1 = setTimeout(() => {
			if (!el || el.paused) return;
			let v = el.volume;
			const step = v / 16;
			const fadeId = setInterval(() => {
				v -= step;
				if (v <= 0.02) {
					clearInterval(fadeId);
					try { el.pause(); } catch {}
				} else {
					el.volume = v;
				}
			}, 50);
		}, fadeAt);

		return () => {
			clearTimeout(t1);
			document.removeEventListener('click', onGesture);
			document.removeEventListener('touchstart', onGesture);
			document.removeEventListener('keydown', onGesture);
			el.removeEventListener('canplay', onCanPlay);
			try { el.pause(); } catch {}
		};
	}, [src, startAt, duration, volume]);

	return <audio ref={audioRef} src={src} preload="auto" playsInline />;
};

export default AudioIntro;
