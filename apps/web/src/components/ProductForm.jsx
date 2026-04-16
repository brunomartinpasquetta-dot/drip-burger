
import React, { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const ProductForm = ({ product, open, onOpenChange, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hasMedallions: true,
    simplePrice: '',
    doublePrice: '',
    triplePrice: '',
    quadruplePrice: 0,
    quintuplePrice: 0,
    fixedPrice: '',
    available: true,
    internalNote: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        hasMedallions: product.hasMedallions ?? true,
        simplePrice: product.simplePrice || '',
        doublePrice: product.doublePrice || '',
        triplePrice: product.triplePrice || '',
        quadruplePrice: product.quadruplePrice || 0,
        quintuplePrice: product.quintuplePrice || 0,
        fixedPrice: product.fixedPrice || '',
        available: product.available ?? true,
        internalNote: product.internalNote || ''
      });
      if (product.image) {
        setImagePreview(pb.files.getUrl(product, product.image));
      } else {
        setImagePreview(null);
      }
    } else {
      setFormData({
        name: '',
        description: '',
        hasMedallions: true,
        simplePrice: '',
        doublePrice: '',
        triplePrice: '',
        quadruplePrice: 0,
        quintuplePrice: 0,
        fixedPrice: '',
        available: true,
        internalNote: ''
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [product, open]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('hasMedallions', formData.hasMedallions);
      data.append('available', formData.available);
      data.append('internalNote', formData.internalNote);

      // PocketBase requires numbers or empty strings for number fields, not undefined
      if (formData.hasMedallions) {
        data.append('simplePrice', formData.simplePrice || 0);
        data.append('doublePrice', formData.doublePrice || 0);
        data.append('triplePrice', formData.triplePrice || 0);
        data.append('quadruplePrice', Number(formData.quadruplePrice) || 0);
        data.append('quintuplePrice', Number(formData.quintuplePrice) || 0);
        data.append('fixedPrice', 0);
      } else {
        data.append('fixedPrice', formData.fixedPrice || 0);
        data.append('simplePrice', 0);
        data.append('doublePrice', 0);
        data.append('triplePrice', 0);
        data.append('quadruplePrice', 0);
        data.append('quintuplePrice', 0);
      }

      // Add dummy price field to satisfy schema if needed, though we use specific ones
      data.append('price', formData.hasMedallions ? (formData.simplePrice || 0) : (formData.fixedPrice || 0));

      if (imageFile) {
        data.append('image', imageFile);
      }

      if (product) {
        await pb.collection('products').update(product.id, data, { requestKey: null });
        toast.success('Producto actualizado');
      } else {
        await pb.collection('products').create(data, { requestKey: null });
        toast.success('Producto creado');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-wide text-primary">
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre del producto</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-background border-border text-foreground mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                className="bg-background border-border text-foreground mt-1 min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="image" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Foto del producto</Label>
              <div className="mt-2 flex items-center gap-4">
                {imagePreview && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="bg-background border-border text-foreground cursor-pointer file:text-primary file:font-bold file:uppercase file:bg-transparent file:border-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold uppercase tracking-wider">Tiene medallones</Label>
                <p className="text-xs text-muted-foreground">Activar para precios por cantidad de medallones</p>
              </div>
              <Switch
                checked={formData.hasMedallions}
                onCheckedChange={(checked) => setFormData({ ...formData, hasMedallions: checked })}
              />
            </div>

            <div className="p-4 bg-background rounded-lg border border-border space-y-4">
              {formData.hasMedallions ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="simplePrice" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Precio Simple</Label>
                    <Input
                      id="simplePrice"
                      type="number"
                      step="0.01"
                      value={formData.simplePrice}
                      onChange={(e) => setFormData({ ...formData, simplePrice: e.target.value })}
                      className="bg-card border-border text-foreground mt-1"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="doublePrice" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Precio Doble</Label>
                    <Input
                      id="doublePrice"
                      type="number"
                      step="0.01"
                      value={formData.doublePrice}
                      onChange={(e) => setFormData({ ...formData, doublePrice: e.target.value })}
                      className="bg-card border-border text-foreground mt-1"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="triplePrice" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Precio Triple</Label>
                    <Input
                      id="triplePrice"
                      type="number"
                      step="0.01"
                      value={formData.triplePrice}
                      onChange={(e) => setFormData({ ...formData, triplePrice: e.target.value })}
                      className="bg-card border-border text-foreground mt-1"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quadruplePrice" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Precio Cuádruple</Label>
                    <Input
                      id="quadruplePrice"
                      type="number"
                      step="0.01"
                      value={formData.quadruplePrice}
                      onChange={(e) => setFormData({ ...formData, quadruplePrice: e.target.value })}
                      className="bg-card border-border text-foreground mt-1"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quintuplePrice" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Precio Quíntuple</Label>
                    <Input
                      id="quintuplePrice"
                      type="number"
                      step="0.01"
                      value={formData.quintuplePrice}
                      onChange={(e) => setFormData({ ...formData, quintuplePrice: e.target.value })}
                      className="bg-card border-border text-foreground mt-1"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="fixedPrice" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Precio Fijo</Label>
                  <Input
                    id="fixedPrice"
                    type="number"
                    step="0.01"
                    value={formData.fixedPrice}
                    onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
                    className="bg-card border-border text-foreground mt-1"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold uppercase tracking-wider">Disponible</Label>
                <p className="text-xs text-muted-foreground">Mostrar en el menú público</p>
              </div>
              <Switch
                checked={formData.available}
                onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
              />
            </div>

            <div>
              <Label htmlFor="internalNote" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nota interna (Solo Admin)</Label>
              <Textarea
                id="internalNote"
                value={formData.internalNote}
                onChange={(e) => setFormData({ ...formData, internalNote: e.target.value })}
                className="bg-background border-border text-foreground mt-1"
                placeholder="Notas privadas..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="btn-secondary">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar Producto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;
