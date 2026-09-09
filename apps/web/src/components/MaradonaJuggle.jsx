import React, { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';

// Caricatura de fútbol haciendo jueguitos en el borde inferior del home.
// Reproduce el audio configurado como banda sonora del intro (~6 s).
//
// Opciones de renderizado (elige la primera disponible):
//   1) Lottie: pasa `lottieUrl` (JSON de LottieFiles/Rive). Es lo que
//      produce animaciones "profesionales" — vector, alta calidad.
//   2) Fallback SVG interno detallado (multi-frame kick + ball con arco
//      real, no un ping-pong vertical).
//
// Autoplay del audio: los browsers modernos rechazan `.play()` sin
// interacción previa del usuario. Truco: escuchar el primer evento de
// gesture (click/keydown/touchstart) EN CUALQUIER PARTE del document y
// disparar el play en ese momento. Suele funcionar en el primer click de
// la sesión (ej. la persona hace click en el botón "Hacer Pedido").
//
// Props:
//   duration       ms totales (default 6000)
//   audioSrc       ruta al mp3 (default '/life-is-life.mp3')
//   lottieUrl      URL a un JSON Lottie (opcional) — si se pasa reemplaza el SVG
//   audioVolume    0..1 (default 0.75)

const MaradonaJuggle = ({
	duration = 6000,
	audioSrc = '/life-is-life.mp3',
	lottieUrl = null,
	audioVolume = 0.75,
}) => {
	const [visible, setVisible] = useState(true);
	const [lottieData, setLottieData] = useState(null);
	const audioRef = useRef(null);

	// Cargar Lottie JSON si se pasa URL
	useEffect(() => {
		if (!lottieUrl) return;
		let cancelled = false;
		fetch(lottieUrl)
			.then((r) => r.ok ? r.json() : Promise.reject(r.status))
			.then((json) => { if (!cancelled) setLottieData(json); })
			.catch((err) => console.warn('[MaradonaJuggle] Lottie fetch fail:', err));
		return () => { cancelled = true; };
	}, [lottieUrl]);

	// Audio + autoplay con fallback a "primer gesto del usuario"
	useEffect(() => {
		const el = audioRef.current;
		if (!el) return;
		el.volume = audioVolume;
		el.currentTime = 0;

		let startedAt = 0;
		const tryPlay = () => {
			const p = el.play();
			if (p && typeof p.then === 'function') {
				p.then(() => { startedAt = performance.now(); })
				 .catch(() => { /* bloqueado, esperamos gesture */ });
			}
		};

		tryPlay();

		// Fallback: si el autoplay fue bloqueado, arranca al primer gesto
		const onGesture = () => {
			if (el.paused) tryPlay();
			// El listener se auto-remueve — solo lo necesitamos una vez
			document.removeEventListener('click', onGesture);
			document.removeEventListener('touchstart', onGesture);
			document.removeEventListener('keydown', onGesture);
		};
		document.addEventListener('click', onGesture, { once: true });
		document.addEventListener('touchstart', onGesture, { once: true });
		document.addEventListener('keydown', onGesture, { once: true });

		// Fadeout suave al final de la duración
		const fadeStart = duration - 900;
		const t1 = setTimeout(() => {
			if (!el || el.paused) return;
			let v = el.volume;
			const step = v / 18;
			const fadeId = setInterval(() => {
				v -= step;
				if (v <= 0.02) {
					clearInterval(fadeId);
					try { el.pause(); } catch {}
				} else {
					el.volume = v;
				}
			}, 50);
		}, Math.max(0, fadeStart));

		const t2 = setTimeout(() => setVisible(false), duration);

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			document.removeEventListener('click', onGesture);
			document.removeEventListener('touchstart', onGesture);
			document.removeEventListener('keydown', onGesture);
			try { el.pause(); } catch {}
		};
	}, [duration, audioVolume]);

	if (!visible) return null;

	const useLottie = lottieUrl && lottieData;

	return (
		<div
			aria-hidden
			className="pointer-events-none fixed bottom-0 left-1/2 -translate-x-1/2 z-[35]"
			style={{
				width: useLottie ? '260px' : '200px',
				animation: `maradona-slide-in 700ms cubic-bezier(0.34,1.56,0.64,1) forwards, maradona-fade-out 700ms ease-in ${duration - 700}ms forwards`,
			}}
		>
			<audio ref={audioRef} src={audioSrc} preload="auto" />

			{useLottie ? (
				<Lottie animationData={lottieData} loop autoplay style={{ width: '100%', height: 'auto' }} />
			) : (
				<DetailedSVG />
			)}

			<style>{`
				@keyframes maradona-slide-in {
					from { transform: translate(-50%, 100%); opacity: 0; }
					to   { transform: translate(-50%, 0);    opacity: 1; }
				}
				@keyframes maradona-fade-out {
					from { transform: translate(-50%, 0);    opacity: 1; }
					to   { transform: translate(-50%, 100%); opacity: 0; }
				}
				@keyframes ball-arc {
					0%   { transform: translate(0, 0)     rotate(0deg)   scale(1); }
					25%  { transform: translate(-8px, -32px) rotate(90deg)  scale(1.02); }
					50%  { transform: translate(0, -46px) rotate(180deg) scale(1.04); }
					75%  { transform: translate(8px, -32px)  rotate(270deg) scale(1.02); }
					100% { transform: translate(0, 0)     rotate(360deg) scale(1); }
				}
				@keyframes hip-sway {
					0%, 100% { transform: rotate(-2deg); }
					50%      { transform: rotate(2deg); }
				}
				@keyframes torso-bob {
					0%, 100% { transform: translateY(0); }
					50%      { transform: translateY(-3px); }
				}
				@keyframes head-nod {
					0%, 100% { transform: translateY(0) rotate(-2deg); }
					50%      { transform: translateY(-2px) rotate(2deg); }
				}
				@keyframes leg-kick {
					0%   { transform: rotate(0deg); }
					25%  { transform: rotate(-30deg); }
					50%  { transform: rotate(-45deg); }
					75%  { transform: rotate(-20deg); }
					100% { transform: rotate(0deg); }
				}
				@keyframes arm-balance-l {
					0%, 100% { transform: rotate(-20deg); }
					50%      { transform: rotate(-35deg); }
				}
				@keyframes arm-balance-r {
					0%, 100% { transform: rotate(25deg); }
					50%      { transform: rotate(40deg); }
				}
				@keyframes shadow-pulse {
					0%, 100% { transform: scale(1);   opacity: 0.4; }
					50%      { transform: scale(0.85); opacity: 0.55; }
				}
			`}</style>
		</div>
	);
};

// ── SVG detallado (fallback si no hay Lottie) ─────────────────────
const DetailedSVG = () => (
	<svg viewBox="0 0 200 240" width="100%" height="100%">
		{/* Fondo: piso de cancha con líneas */}
		<defs>
			<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="rgba(0,120,60,0)" />
				<stop offset="100%" stopColor="rgba(0,60,30,0.35)" />
			</linearGradient>
		</defs>

		{/* Sombra bajo el pie de apoyo, pulsante con la cadencia del ball */}
		<ellipse
			cx="100" cy="230" rx="50" ry="6"
			fill="rgba(0,0,0,0.55)"
			style={{ animation: 'shadow-pulse 550ms ease-in-out infinite', transformOrigin: '100px 230px' }}
		/>

		{/* Pelota — trayectoria en arco (no ping-pong) + rotación 360° */}
		<g style={{ animation: 'ball-arc 1100ms cubic-bezier(0.4,0,0.2,1) infinite', transformOrigin: '135px 138px' }}>
			<g transform="translate(135, 138)">
				<circle r="14" fill="#fff" stroke="#000" strokeWidth="1.5" />
				<polygon points="0,-9 6,-3 4,4 -4,4 -6,-3" fill="#000" />
				<polygon points="-11,-1 -6,-4 -3,2 -6,6 -11,3" fill="#111" />
				<polygon points="11,-1 6,-4 3,2 6,6 11,3" fill="#111" />
				<polygon points="0,7 5,4 8,9 3,12 -5,10" fill="#111" />
			</g>
		</g>

		{/* Personaje — grupos anidados para animaciones independientes */}
		<g transform="translate(0, 0)">
			{/* Pierna de apoyo (izquierda) */}
			<g>
				{/* Muslo */}
				<rect x="86" y="140" width="14" height="45" rx="6" fill="#111" />
				{/* Rodilla */}
				<circle cx="93" cy="184" r="6" fill="#111" />
				{/* Pantorrilla */}
				<rect x="87" y="184" width="12" height="40" rx="5" fill="#111" />
				{/* Botín */}
				<path d="M 78 224 Q 78 218, 84 217 L 108 216 Q 116 218, 116 226 L 108 228 Q 90 228, 78 226 Z" fill="#F5A800" stroke="#000" strokeWidth="1.5" />
				<circle cx="87" cy="222" r="1.5" fill="#000" opacity="0.7" />
				<circle cx="97" cy="222" r="1.5" fill="#000" opacity="0.7" />
				<circle cx="107" cy="222" r="1.5" fill="#000" opacity="0.7" />
			</g>

			{/* Pierna que patea (derecha) — ciclo de kick multi-fase */}
			<g style={{ animation: 'leg-kick 1100ms cubic-bezier(0.4,0,0.2,1) infinite', transformOrigin: '108px 140px' }}>
				<rect x="106" y="140" width="14" height="42" rx="6" fill="#111" />
				<circle cx="113" cy="182" r="6" fill="#111" />
				<rect x="107" y="180" width="12" height="26" rx="5" fill="#111" transform="rotate(-15 113 195)" />
				<path d="M 100 206 Q 100 200, 106 199 L 128 200 Q 136 202, 136 210 L 128 212 Q 112 213, 100 210 Z" fill="#F5A800" stroke="#000" strokeWidth="1.5" transform="rotate(-15 113 195)" />
			</g>

			{/* Torso con camiseta rayada — bob sutil */}
			<g style={{ animation: 'torso-bob 1100ms ease-in-out infinite', transformOrigin: '100px 100px' }}>
				<g style={{ animation: 'hip-sway 1100ms ease-in-out infinite', transformOrigin: '100px 140px' }}>
					{/* Camiseta */}
					<path d="M 70 78 Q 70 74, 76 72 L 124 72 Q 130 74, 130 78 L 132 145 L 68 145 Z" fill="#ffffff" stroke="#000" strokeWidth="1.8" />
					{/* Rayas celestes */}
					<rect x="68" y="82" width="64" height="12" fill="#75AADB" />
					<rect x="68" y="105" width="64" height="12" fill="#75AADB" />
					<rect x="68" y="128" width="64" height="12" fill="#75AADB" />
					{/* Número 10 */}
					<text x="100" y="122" textAnchor="middle" fontSize="22" fontWeight="900" fill="#0a0a0a" fontFamily="Impact, Arial Black, sans-serif" letterSpacing="-1">10</text>
					{/* Cuello */}
					<path d="M 92 72 Q 100 78, 108 72" fill="#0a0a0a" stroke="#000" strokeWidth="1.5" />
				</g>
			</g>

			{/* Brazo izquierdo — balance activo */}
			<g style={{ animation: 'arm-balance-l 1100ms ease-in-out infinite', transformOrigin: '76px 80px' }}>
				<path d="M 76 78 Q 60 92, 52 110 Q 50 116, 55 118 L 62 116 Q 70 100, 82 92 Z" fill="#ffffff" stroke="#000" strokeWidth="1.5" />
				<circle cx="55" cy="118" r="5" fill="#d4a37b" stroke="#000" strokeWidth="1" />
			</g>

			{/* Brazo derecho — balance opuesto */}
			<g style={{ animation: 'arm-balance-r 1100ms ease-in-out infinite', transformOrigin: '124px 80px' }}>
				<path d="M 124 78 Q 140 90, 148 105 Q 150 112, 145 114 L 138 112 Q 130 100, 118 92 Z" fill="#ffffff" stroke="#000" strokeWidth="1.5" />
				<circle cx="145" cy="114" r="5" fill="#d4a37b" stroke="#000" strokeWidth="1" />
			</g>

			{/* Cabeza — nod sutil */}
			<g style={{ animation: 'head-nod 1100ms ease-in-out infinite', transformOrigin: '100px 60px' }}>
				{/* Cuello atrás */}
				<rect x="94" y="66" width="12" height="8" fill="#d4a37b" stroke="#000" strokeWidth="1" />
				{/* Cara */}
				<circle cx="100" cy="52" r="22" fill="#d4a37b" stroke="#000" strokeWidth="1.5" />
				{/* Pelo rulo/mullet */}
				<path d="M 78 46 Q 76 26, 100 24 Q 124 26, 122 46 Q 118 34, 108 32 Q 100 30, 92 32 Q 82 34, 78 46 Z" fill="#3a2820" />
				<path d="M 78 50 Q 74 60, 76 68 L 82 66 Q 82 58, 84 52 Z" fill="#3a2820" />
				<path d="M 122 50 Q 126 60, 124 68 L 118 66 Q 118 58, 116 52 Z" fill="#3a2820" />
				{/* Cejas */}
				<path d="M 88 46 L 96 45" stroke="#3a2820" strokeWidth="2.2" strokeLinecap="round" />
				<path d="M 104 45 L 112 46" stroke="#3a2820" strokeWidth="2.2" strokeLinecap="round" />
				{/* Ojos */}
				<circle cx="91" cy="52" r="1.8" fill="#0a0a0a" />
				<circle cx="109" cy="52" r="1.8" fill="#0a0a0a" />
				{/* Nariz */}
				<path d="M 100 54 Q 98 60, 100 62 L 102 61" stroke="#3a2820" strokeWidth="1.2" fill="none" strokeLinecap="round" />
				{/* Sonrisa */}
				<path d="M 92 66 Q 100 71, 108 66" stroke="#0a0a0a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
				{/* Cintita mundialista arriba de la cabeza */}
				<rect x="78" y="30" width="44" height="4" fill="#75AADB" opacity="0.9" />
				<rect x="78" y="34" width="44" height="4" fill="#ffffff" opacity="0.9" />
			</g>
		</g>
	</svg>
);

export default MaradonaJuggle;
