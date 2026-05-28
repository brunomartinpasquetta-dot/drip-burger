import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import useBanners from '@/hooks/useBanners';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, GripVertical, ChevronUp, ChevronDown, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const MAX_IMG_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// Estado visual del banner según activo + vigencia (desde/hasta).
const getBannerStatus = (b) => {
  const now = new Date();
  if (!b.activo) return { label: 'Inactivo', borderCls: 'border-l-red-500', textCls: 'text-red-500' };
  if (b.desde) {
    const d = new Date(b.desde);
    if (!Number.isNaN(d.getTime()) && d > now) {
      return { label: 'Programado', borderCls: 'border-l-yellow-500', textCls: 'text-yellow-500' };
    }
  }
  if (b.hasta) {
    const h = new Date(b.hasta);
    if (!Number.isNaN(h.getTime()) && h < now) {
      return { label: 'Vencido', borderCls: 'border-l-yellow-500', textCls: 'text-yellow-500' };
    }
  }
  return { label: 'Vigente', borderCls: 'border-l-green-500', textCls: 'text-green-500' };
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch (_) {
    return '—';
  }
};

// Convierte ISO completo a "YYYY-MM-DD" para <input type="date">.
const isoToDateInput = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch (_) {
    return '';
  }
};

const BannerFormDialog = ({ open, onOpenChange, banner, products, onSaved }) => {
  const [titulo, setTitulo] = useState('');
  const [ctaTexto, setCtaTexto] = useState('');
  const [ctaProductoId, setCtaProductoId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [activo, setActivo] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (banner) {
      setTitulo(banner.titulo || '');
      setCtaTexto(banner.ctaTexto || '');
      setCtaProductoId(banner.ctaProductoId || '');
      setDesde(isoToDateInput(banner.desde));
      setHasta(isoToDateInput(banner.hasta));
      setActivo(banner.activo !== false);
      setImagePreview(banner.imagen ? pb.files.getURL(banner, banner.imagen) : null);
    } else {
      setTitulo('');
      setCtaTexto('');
      setCtaProductoId('');
      setDesde('');
      setHasta('');
      setActivo(true);
      setImagePreview(null);
    }
    setImageFile(null);
  }, [open, banner]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error('Formato inválido. Usá jpg, png o webp.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMG_BYTES) {
      toast.error('La imagen supera los 2MB');
      e.target.value = '';
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error('El título es requerido');
      return;
    }
    if (!banner && !imageFile) {
      toast.error('Subí una imagen para el banner');
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      data.append('titulo', titulo.trim());
      data.append('ctaTexto', ctaTexto.trim());
      // PB relation vacío: usar string vacía para limpiar.
      data.append('ctaProductoId', ctaProductoId || '');
      data.append('activo', activo);
      data.append('desde', desde || '');
      data.append('hasta', hasta || '');
      if (banner == null) {
        // orden = (max+10) se setea afuera; para creación inicial usar 0 si no.
        data.append('orden', 0);
      }
      if (imageFile) data.append('imagen', imageFile);

      let saved;
      if (banner) {
        saved = await pb.collection('banners').update(banner.id, data, { requestKey: null });
        toast.success('Banner actualizado');
      } else {
        saved = await pb.collection('banners').create(data, { requestKey: null });
        toast.success('Banner creado');
      }

      // Validación post-save: PB drops silenciosamente campos desconocidos.
      // Si el título guardado no coincide, avisar.
      if (saved.titulo !== titulo.trim()) {
        console.warn('[BannerForm] post-save mismatch', { sent: titulo, saved: saved.titulo });
      }

      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error('[BannerForm] save failed:', err?.response?.data || err);
      toast.error(err?.message || 'Error al guardar el banner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-wide text-primary">
            {banner ? 'Editar banner' : 'Nuevo banner'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Imagen (max 2MB · jpg/png/webp)
            </Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-24 h-16 rounded-md overflow-hidden bg-background border border-border shrink-0 flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                )}
              </div>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="bg-background border-border text-foreground cursor-pointer file:text-primary file:font-bold file:uppercase file:bg-transparent file:border-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Título (max 60)
            </Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={60}
              required
              className="bg-background border-border text-foreground mt-1"
              placeholder="Ej. 2x1 EN HAMBURGUESAS"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Texto del CTA (opcional, max 20)
              </Label>
              <Input
                value={ctaTexto}
                onChange={(e) => setCtaTexto(e.target.value)}
                maxLength={20}
                className="bg-background border-border text-foreground mt-1"
                placeholder="PEDÍ AHORA"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Producto del CTA (opcional)
              </Label>
              <select
                value={ctaProductoId}
                onChange={(e) => setCtaProductoId(e.target.value)}
                className="mt-1 w-full h-10 rounded-md bg-background border border-border text-foreground px-2 text-sm"
              >
                <option value="">— Sin producto —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Desde (opcional)
              </Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="bg-background border-border text-foreground mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Hasta (opcional)
              </Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="bg-background border-border text-foreground mt-1"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
            <div>
              <Label className="text-sm font-bold uppercase tracking-wider">Activo</Label>
              <p className="text-xs text-muted-foreground">Mostrar en el home si está vigente</p>
            </div>
            <Switch
              checked={activo}
              onCheckedChange={setActivo}
              className="data-[state=checked]:bg-green-500"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="btn-secondary">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar banner'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const BannersAdminContent = () => {
  // Admin ve TODOS los banners (incluye inactivos y fuera de fecha)
  const { banners, loading } = useBanners({ onlyVisible: false });
  const [products, setProducts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await pb.collection('products').getFullList({
          sort: 'orden,created',
          requestKey: null,
        });
        if (mounted) setProducts(res || []);
      } catch (err) {
        console.warn('[BannersAdmin] products load failed (best-effort):', err?.message);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Reordenar persistiendo orden = (idx+1)*10 sobre el array nuevo.
  const reorder = async (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return;
    const arr = banners.slice();
    const srcIdx = arr.findIndex((b) => b.id === sourceId);
    const tgtIdx = arr.findIndex((b) => b.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = arr.splice(srcIdx, 1);
    arr.splice(tgtIdx, 0, moved);
    try {
      await Promise.all(
        arr.map((b, i) => pb.collection('banners').update(b.id, { orden: (i + 1) * 10 }, { requestKey: null }))
      );
    } catch (err) {
      console.error('[BannersAdmin] reorder failed:', err);
      toast.error('No se pudo guardar el orden');
    }
  };

  const moveBanner = async (id, dir) => {
    const idx = banners.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= banners.length) return;
    await reorder(id, banners[targetIdx].id);
  };

  const handleDelete = async (id) => {
    try {
      await pb.collection('banners').delete(id, { requestKey: null });
      toast.success('Banner eliminado');
      setConfirmDelete(null);
    } catch (err) {
      console.error('[BannersAdmin] delete failed:', err);
      toast.error('No se pudo eliminar');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide">
            Banners <span className="text-muted-foreground text-sm">({banners.length})</span>
          </h2>
          <p className="text-[11px] text-muted-foreground font-medium">
            Carousel del home · rota cada 5s · animación pulse en CTA
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          size="sm"
          className="btn-primary h-9 px-3 text-xs font-black uppercase tracking-wide"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo banner
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : banners.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-bold uppercase text-muted-foreground">
            Sin banners. Creá el primero para activar el carousel del home.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <GripVertical className="inline w-3 h-3 mr-1 -mt-0.5" />
            Arrastrá para reordenar · en mobile usá ↑↓
          </p>
          {banners.map((b, idx) => {
            const status = getBannerStatus(b);
            const product = b.ctaProductoId ? products.find((p) => p.id === b.ctaProductoId) : null;
            const imgUrl = b.imagen ? pb.files.getURL(b, b.imagen) : null;
            return (
              <div
                key={b.id}
                draggable
                onDragStart={(e) => {
                  setDraggedId(b.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', b.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropTargetId !== b.id) setDropTargetId(b.id);
                }}
                onDragLeave={() => { if (dropTargetId === b.id) setDropTargetId(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
                  setDraggedId(null);
                  setDropTargetId(null);
                  reorder(sourceId, b.id);
                }}
                onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }}
                className={`bg-card border border-border border-l-[4px] ${status.borderCls} rounded-lg p-3 flex items-start gap-3 transition-all ${
                  draggedId === b.id ? 'opacity-50' : ''
                } ${dropTargetId === b.id && draggedId !== b.id ? 'ring-2 ring-primary/50' : ''}`}
                style={{ cursor: draggedId === b.id ? 'grabbing' : 'grab' }}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/60 mt-1 shrink-0" />

                <div className="w-20 h-14 sm:w-28 sm:h-20 rounded-md overflow-hidden bg-background border border-border shrink-0 flex items-center justify-center">
                  {imgUrl ? (
                    <img src={imgUrl} alt={b.titulo} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black uppercase text-sm leading-tight truncate">{b.titulo || '— Sin título —'}</p>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${status.textCls}`}>
                      · {status.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-medium space-y-0.5">
                    {b.ctaTexto && (
                      <p>
                        CTA: <span className="text-foreground font-bold">{b.ctaTexto}</span>
                        {product && <> → <span className="text-primary">{product.name}</span></>}
                      </p>
                    )}
                    <p>
                      Vigencia: <span className="tabular-nums">{fmtDate(b.desde)}</span>
                      {' '}→{' '}
                      <span className="tabular-nums">{fmtDate(b.hasta)}</span>
                      <span className="ml-2 text-muted-foreground/70">· orden {b.orden ?? 0}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col gap-1 sm:hidden">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border h-7 w-7 p-0"
                      onClick={() => moveBanner(b.id, -1)}
                      disabled={idx === 0}
                      title="Subir"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border h-7 w-7 p-0"
                      onClick={() => moveBanner(b.id, 1)}
                      disabled={idx === banners.length - 1}
                      title="Bajar"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border h-8"
                    onClick={() => { setEditing(b); setFormOpen(true); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 h-8"
                    onClick={() => setConfirmDelete(b)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BannerFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        banner={editing}
        products={products}
        onSaved={() => { /* realtime subscribe refresca solo */ }}
      />

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">¿Eliminar banner?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se borra el banner <span className="text-foreground font-bold">"{confirmDelete?.titulo}"</span>. Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)} className="border-border">
              Cancelar
            </Button>
            <Button
              onClick={() => handleDelete(confirmDelete.id)}
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide border-0"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const BannersAdminPage = () => {
  return (
    <>
      <Helmet><title>Banners - DRIP BURGER</title></Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 max-w-4xl">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <Button asChild variant="outline" size="sm" className="border-border h-8 px-2 text-[11px]">
              <Link to="/gestion"><ArrowLeft className="mr-1 h-3 w-3" />Volver</Link>
            </Button>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">
              Ban<span className="text-primary">ners</span>
            </h1>
            <div className="w-16" />
          </div>

          <BannersAdminContent />
        </div>
      </div>
    </>
  );
};

export default BannersAdminPage;
