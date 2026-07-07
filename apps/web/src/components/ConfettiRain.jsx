import React, { useEffect, useMemo, useState } from 'react';

// Lluvia de papel picado celeste/blanco (estilo cancha de fútbol argentino).
// Se dispara al montar y dura ~duration ms. Puros divs con CSS keyframes,
// sin deps externas.
//
// Versión simplificada: 1 span por pieza, animación única `confetti-fall`
// que hace caída + rotación en una sola keyframe (evita conflictos entre
// múltiples animaciones sobre `transform`).

const COLORS = [
	'#75AADB', '#5B9BD5', '#B8DBF0', '#E6F3FA', '#FFFFFF', '#F5F5F5',
];

const SHAPES = [
	{ w: [5, 8],   h: [12, 22], weight: 0.45 }, // strip fina
	{ w: [8, 13],  h: [10, 16], weight: 0.35 }, // rectangulito
	{ w: [7, 10],  h: [7, 10],  weight: 0.20 }, // cuadradito
];

const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const pickShape = () => {
	const r = Math.random();
	let acc = 0;
	for (const s of SHAPES) {
		acc += s.weight;
		if (r <= acc) return s;
	}
	return SHAPES[SHAPES.length - 1];
};

const ConfettiRain = ({ pieces = 180, duration = 5000 }) => {
	const [active, setActive] = useState(true);

	const items = useMemo(() => (
		Array.from({ length: pieces }, (_, i) => {
			const shape = pickShape();
			return {
				id: i,
				left: rand(-2, 102),
				delay: rand(0, 1500),
				fallDuration: rand(3500, 6500),
				w: rand(shape.w[0], shape.w[1]),
				h: rand(shape.h[0], shape.h[1]),
				rotStart: rand(-180, 180),
				rotEnd: rand(720, 1440) * (Math.random() < 0.5 ? -1 : 1),
				sway: rand(30, 90) * (Math.random() < 0.5 ? -1 : 1),
				color: pick(COLORS),
				easing: pick(['cubic-bezier(0.35,0.7,0.55,1)', 'cubic-bezier(0.45,0.05,0.55,0.95)', 'cubic-bezier(0.55,0.1,0.35,0.9)']),
			};
		})
	), [pieces]);

	useEffect(() => {
		const id = setTimeout(() => setActive(false), duration);
		return () => clearTimeout(id);
	}, [duration]);

	if (!active) return null;

	return (
		<div
			aria-hidden
			className="pointer-events-none fixed inset-0 z-[30] overflow-hidden"
		>
			{items.map((p) => (
				<span
					key={p.id}
					style={{
						position: 'absolute',
						top: '-30px',
						left: `${p.left}%`,
						width: `${p.w}px`,
						height: `${p.h}px`,
						backgroundColor: p.color,
						boxShadow: `0 1px 2px rgba(0,0,0,0.25), inset 0 -${Math.max(1, p.h * 0.15)}px 0 rgba(0,0,0,0.12)`,
						borderRadius: '1.5px',
						animation: `confetti-fall-${p.id % 4} ${p.fallDuration}ms ${p.easing} ${p.delay}ms forwards`,
						['--rot-start']: `${p.rotStart}deg`,
						['--rot-end']: `${p.rotEnd}deg`,
						['--sway']: `${p.sway}px`,
						willChange: 'transform, opacity',
					}}
				/>
			))}
			<style>{`
				@keyframes confetti-fall-0 {
					0%   { transform: translate3d(0, -30px, 0) rotate(var(--rot-start)); opacity: 0; }
					8%   { opacity: 1; }
					50%  { transform: translate3d(var(--sway), 50vh, 0) rotate(calc(var(--rot-start) + var(--rot-end) * 0.5)); }
					100% { transform: translate3d(calc(var(--sway) * -0.6), 110vh, 0) rotate(var(--rot-end)); opacity: 0.9; }
				}
				@keyframes confetti-fall-1 {
					0%   { transform: translate3d(0, -30px, 0) rotate(var(--rot-start)); opacity: 0; }
					8%   { opacity: 1; }
					50%  { transform: translate3d(calc(var(--sway) * -1), 45vh, 0) rotate(calc(var(--rot-start) + var(--rot-end) * 0.5)); }
					100% { transform: translate3d(var(--sway), 110vh, 0) rotate(var(--rot-end)); opacity: 0.9; }
				}
				@keyframes confetti-fall-2 {
					0%   { transform: translate3d(0, -30px, 0) rotate(var(--rot-start)); opacity: 0; }
					8%   { opacity: 1; }
					35%  { transform: translate3d(var(--sway), 35vh, 0) rotate(calc(var(--rot-start) + var(--rot-end) * 0.35)); }
					70%  { transform: translate3d(calc(var(--sway) * -0.8), 75vh, 0) rotate(calc(var(--rot-start) + var(--rot-end) * 0.7)); }
					100% { transform: translate3d(0, 110vh, 0) rotate(var(--rot-end)); opacity: 0.9; }
				}
				@keyframes confetti-fall-3 {
					0%   { transform: translate3d(0, -30px, 0) rotate(var(--rot-start)); opacity: 0; }
					8%   { opacity: 1; }
					100% { transform: translate3d(var(--sway), 110vh, 0) rotate(var(--rot-end)); opacity: 0.9; }
				}
			`}</style>
		</div>
	);
};

export default ConfettiRain;
