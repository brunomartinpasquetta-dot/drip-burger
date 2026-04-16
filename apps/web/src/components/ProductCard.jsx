
import React, { useState } from 'react';
import { useCart } from '@/contexts/CartContext.jsx';
import pb from '@/lib/pocketbaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Minus, Plus, ShoppingCart, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const formatPrice = (price) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price || 0);
};

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const [pattyCount, setPattyCount] = useState(1);
  const [imgError, setImgError] = useState(false);

  // Safe fallbacks to ensure no rendering errors occur when product data is missing fields
  const safeProduct = product || {};
  const name = safeProduct.name || 'Producto sin nombre';
  const description = safeProduct.description || 'Sin descripción disponible.';
  const hasMedallions = !!safeProduct.hasMedallions;
  
  const simplePrice = safeProduct.simplePrice || 0;
  const doublePrice = safeProduct.doublePrice || 0;
  const triplePrice = safeProduct.triplePrice || 0;
  const quadruplePrice = safeProduct.quadruplePrice || 0;
  const quintuplePrice = safeProduct.quintuplePrice || 0;
  const fixedPrice = safeProduct.fixedPrice || 0;

  const maxPatty = quintuplePrice > 0 ? 5 : quadruplePrice > 0 ? 4 : 3;

  const imageUrl = safeProduct.image && !imgError
    ? pb.files.getUrl(safeProduct, safeProduct.image)
    : null;

  const currentPrice = hasMedallions
    ? (pattyCount === 1 ? simplePrice
       : pattyCount === 2 ? doublePrice
       : pattyCount === 3 ? triplePrice
       : pattyCount === 4 ? quadruplePrice
       : quintuplePrice)
    : fixedPrice;

  const handleAddToCart = () => {
    const cartProduct = {
      ...safeProduct,
      price: currentPrice,
      name: name
    };
    
    // Add exact units to the cart silently
    addToCart(cartProduct, hasMedallions ? pattyCount : 1, 1);
    toast.success('Agregado al carrito');
    
    // Reset customizations for the next addition
    setPattyCount(1);
  };

  return (
    <Card className="overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-300 flex flex-col h-full group">
      <div className="aspect-square overflow-hidden relative bg-[#0a0a0a] flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50">
            <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
            <span className="text-xs font-bold uppercase tracking-wider">Sin imagen</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
      
      <CardContent className="p-6 flex-1 flex flex-col">
        <h3 className="product-name mb-2">{name}</h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
          {description}
        </p>
        
        <div className="mb-4">
          {hasMedallions ? (
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-muted-foreground">Precios</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <span className={pattyCount === 1 ? "text-primary font-bold" : "text-muted-foreground"}>Simple: {formatPrice(simplePrice)}</span>
                <span className={pattyCount === 2 ? "text-primary font-bold" : "text-muted-foreground"}>Doble: {formatPrice(doublePrice)}</span>
                <span className={pattyCount === 3 ? "text-primary font-bold" : "text-muted-foreground"}>Triple: {formatPrice(triplePrice)}</span>
                {quadruplePrice > 0 && (
                  <span className={pattyCount === 4 ? "text-primary font-bold" : "text-muted-foreground"}>Cuádruple: {formatPrice(quadruplePrice)}</span>
                )}
                {quintuplePrice > 0 && (
                  <span className={pattyCount === 5 ? "text-primary font-bold" : "text-muted-foreground"}>Quíntuple: {formatPrice(quintuplePrice)}</span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Precio Fijo</p>
              <p className="text-2xl font-black text-primary">{formatPrice(fixedPrice)}</p>
            </div>
          )}
        </div>

        {hasMedallions && (
          <div className="space-y-4 bg-background/50 p-4 rounded-xl border border-border/50 mt-auto">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block text-foreground">Medallones</label>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  onClick={() => setPattyCount(Math.max(1, pattyCount - 1))}
                  disabled={pattyCount <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-bold text-lg">{pattyCount}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  onClick={() => setPattyCount(Math.min(maxPatty, pattyCount + 1))}
                  disabled={pattyCount >= maxPatty}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-6 pt-0 mt-auto">
        <Button onClick={handleAddToCart} className="w-full btn-primary" size="lg">
          <ShoppingCart className="mr-2 h-5 w-5" />
          Agregar - {formatPrice(currentPrice)}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
