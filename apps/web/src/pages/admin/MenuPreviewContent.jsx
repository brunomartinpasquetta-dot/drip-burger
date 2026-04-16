import React, { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';
import ProductCard from '@/components/ProductCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Vista del menú cliente embebida dentro del panel admin.
// Renderiza la misma grilla que los clientes ven en /menu pero sin el Header
// público ni el "Volver al inicio". Mantiene ProductCard funcional (incluido
// el botón "Agregar") para que el admin pueda verificar sus cambios en vivo.
const MenuPreviewContent = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await pb.collection('products').getList(1, 50, {
        filter: 'available = true',
        sort: 'name',
        requestKey: null,
      });
      setProducts(result.items || []);
    } catch (err) {
      console.error('[MenuPreviewContent] load failed:', err);
      setError('No pudimos cargar el menú. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">
          Vista <span className="text-primary">Menú</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
          Así ven los clientes la grilla de productos. Usala para chequear cambios en vivo.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-10 w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-destructive/10 border border-destructive/20 rounded-xl mx-auto max-w-lg">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-base font-bold text-destructive mb-4">{error}</p>
          <Button onClick={loadProducts} variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <p className="text-base font-bold uppercase text-muted-foreground">No hay productos disponibles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuPreviewContent;
