
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import ProductCard from '@/components/ProductCard.jsx';
import FloatingCartBar from '@/components/FloatingCartBar.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CustomerMenuPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const queryParams = {
      filter: 'available = true',
      sort: 'name',
      $autoCancel: false
    };

    try {
      setLoading(true);
      setError(null);
      
      const result = await pb.collection('products').getList(1, 50, queryParams);
      const parsedItems = result.items || [];
      
      setProducts(parsedItems);

    } catch (err) {
      setError('No pudimos cargar el menú en este momento. Por favor, intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Menú - DRIP BURGER</title>
      </Helmet>

      {/* Main App Container */}
      <div className="min-h-screen w-full bg-background flex flex-col">
        <Header />

        {/* Full Width Layout container */}
        <div className="flex-1 w-full relative z-0">
          
          {/* Main Area: Products Grid (100% width) */}
          <main className="w-full h-full relative">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-32">
              <div className="mb-8 md:mb-12 text-center md:text-left">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-2 md:mb-4">
                  El <span className="text-primary">Menú</span>
                </h1>
                <p className="text-sm md:text-lg text-muted-foreground max-w-2xl font-medium">
                  Elegí tu burger. Personalizá los medallones. Disfrutá el estilo DRIP.
                </p>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                      <Skeleton className="aspect-square w-full rounded-none" />
                      <div className="p-4 md:p-6 space-y-4">
                        <Skeleton className="h-6 md:h-8 w-3/4" />
                        <Skeleton className="h-3 md:h-4 w-full" />
                        <Skeleton className="h-3 md:h-4 w-2/3" />
                        <Skeleton className="h-10 md:h-12 w-full mt-4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center text-center py-16 md:py-24 px-4 bg-destructive/10 border border-destructive/20 rounded-2xl mx-auto max-w-lg">
                  <AlertCircle className="h-10 w-10 md:h-12 md:w-12 text-destructive mb-4" />
                  <p className="text-lg md:text-xl font-bold text-destructive mb-6">{error}</p>
                  <Button onClick={loadProducts} variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reintentar
                  </Button>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-16 md:py-24 bg-card border border-border rounded-2xl">
                  <p className="text-lg md:text-xl font-bold uppercase text-muted-foreground">No hay productos disponibles por el momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </main>

        </div>

        {/* Floating Cart Bar - Mobile Only */}
        <div className="md:hidden">
          <FloatingCartBar />
        </div>

      </div>
    </>
  );
};

export default CustomerMenuPage;
