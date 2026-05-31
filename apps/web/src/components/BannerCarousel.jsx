import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import useBanners from '@/hooks/useBanners';

// Carousel auto-rotativo de banners promocionales del home.
// - Auto-rotate cada 5s, pausa al hover.
// - Fade entre slides (transition-opacity).
// - Swipe táctil en mobile (threshold 50px).
// - Si hay 1 solo banner: sin dots, sin auto-rotate.
// - 0 banners: retorna null (home queda sin gap).
const ROTATE_MS = 5000;
const SWIPE_THRESHOLD = 50;

const BannerCarousel = () => {
  const { banners } = useBanners();
  const [index, setIndex] = useState(0);
  const [imgError, setImgError] = useState({});
  const hoveringRef = useRef(false);
  const touchStartX = useRef(null);
  const navigate = useNavigate();

  // Fallback estático: si no hay banners en PB, mostrar el banner default
  // que vive en /public/banner.jpg. Cuando admin crea uno en PB, lo reemplaza.
  const effectiveBanners = (banners && banners.length > 0)
    ? banners
    : [{ id: '__default__', titulo: '', __staticSrc: '/banner.jpg' }];
  const len = effectiveBanners.length;

  // Si cambia la lista, asegurar que el índice activo siga siendo válido.
  useEffect(() => {
    if (index >= len) setIndex(0);
  }, [len, index]);

  // Auto-rotate solo si hay >1 banner.
  useEffect(() => {
    if (len <= 1) return undefined;
    const id = setInterval(() => {
      if (!hoveringRef.current) {
        setIndex((i) => (i + 1) % len);
      }
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [len]);

  if (len === 0) return null;

  const goTo = (i) => setIndex(((i % effectiveBanners.length) + effectiveBanners.length) % effectiveBanners.length);

  const handleCtaClick = (banner) => {
    const pid = banner.ctaProductoId;
    if (pid) {
      const el = document.getElementById(`product-${pid}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      // Fallback: el producto no está en esta página → ir al menú.
      navigate(`/menu#product-${pid}`);
      return;
    }
    navigate('/menu');
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const diff = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < SWIPE_THRESHOLD || effectiveBanners.length <= 1) return;
    goTo(index + (diff < 0 ? 1 : -1));
  };

  // Click en banner sin CTA propio → llevar al menú (incentivo a pedir)
  const handleBannerClick = (banner) => {
    if (banner.ctaTexto) return; // ya tiene su propio botón
    handleCtaClick(banner);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div
        className="banner-promo relative w-full aspect-[5/2] rounded-xl overflow-hidden mb-6 bg-[#1a1a1a] cursor-pointer ring-1 ring-[#F5A800]/30 shadow-[0_0_24px_rgba(245,168,0,0.25)]"
        onMouseEnter={() => { hoveringRef.current = true; }}
        onMouseLeave={() => { hoveringRef.current = false; }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => handleBannerClick(effectiveBanners[index])}
        role="button"
        tabIndex={0}
      >
        {effectiveBanners.map((banner, i) => {
          const isActive = i === index;
          const imgUrl = banner.__staticSrc
            ? banner.__staticSrc
            : (banner.imagen ? pb.files.getURL(banner, banner.imagen) : null);
          const broken = imgError[banner.id];
          return (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
              aria-hidden={!isActive}
            >
              {imgUrl && !broken ? (
                <img
                  src={imgUrl}
                  alt={banner.titulo || 'Banner'}
                  className="w-full h-full object-cover"
                  onError={() => setImgError((p) => ({ ...p, [banner.id]: true }))}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                  <p
                    className="text-2xl md:text-3xl text-white text-center px-4"
                    style={{ fontFamily: '"Bangers", system-ui, sans-serif' }}
                  >
                    {banner.titulo}
                  </p>
                </div>
              )}

              {/* Overlay para legibilidad del título y CTA */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {/* Título + CTA — abajo a la izquierda */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 flex items-end justify-between gap-3">
                <h3
                  className="text-2xl md:text-3xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight"
                  style={{ fontFamily: '"Bangers", system-ui, sans-serif', letterSpacing: '0.02em' }}
                >
                  {banner.titulo}
                </h3>
                {banner.ctaTexto && (
                  <button
                    type="button"
                    onClick={() => handleCtaClick(banner)}
                    className="shrink-0 bg-[#F5A800] text-black font-bold uppercase tracking-wide text-xs md:text-sm px-4 py-2 rounded animate-pulse hover:animate-none hover:scale-105 transition-transform"
                  >
                    {banner.ctaTexto}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Dots — solo si hay más de un banner */}
        {effectiveBanners.length > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {effectiveBanners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Ir al banner ${i + 1}`}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === index ? 'bg-[#F5A800]' : 'bg-[#2a2a2a] hover:bg-[#4a4a4a]'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BannerCarousel;
