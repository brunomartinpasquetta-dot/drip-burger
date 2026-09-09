import React from 'react';

// Sol de Mayo (bandera argentina) usando el PNG real ubicado en
// /public/SolDeMayo.png con fondo transparente. Rota lento + halo pulsante
// atrás para dar el efecto de "vivo" sin marear.
//
// Props:
//   size    diámetro en px (default 100)
//   className    extra clases para el wrapper (posición, etc)
//   style        extra estilos inline
const HamburgerSun = ({ size = 100, className = '', style = {} }) => (
	<div
		aria-hidden
		className={`relative inline-flex items-center justify-center pointer-events-none ${className}`}
		style={{ width: size, height: size, ...style }}
	>
		{/* Halo radial suave detrás del sol (estático, no pulsa) */}
		<div
			className="absolute inset-0 rounded-full"
			style={{
				background: 'radial-gradient(circle, rgba(252,191,73,0.35) 0%, rgba(252,191,73,0.12) 40%, transparent 65%)',
			}}
		/>
		{/* Sol de Mayo PNG — quieto, sin animación (no titila) */}
		<img
			src="/SolDeMayo.png?v=2"
			alt=""
			className="relative z-10 w-full h-full object-contain"
			style={{
				filter: 'drop-shadow(0 2px 12px rgba(252,191,73,0.6))',
			}}
		/>
	</div>
);

export default HamburgerSun;
