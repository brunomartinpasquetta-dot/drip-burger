
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';

const SettingsPage = () => {
  const [settingsId, setSettingsId] = useState(null);
  const [precioEnvio, setPrecioEnvio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const records = await pb.collection('settings').getList(1, 1, { requestKey: null });
      if (records.items.length > 0) {
        const record = records.items[0];
        setSettingsId(record.id);
        setPrecioEnvio(record.precio_envio || 0);
      }
    } catch (error) {
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = { precio_envio: Number(precioEnvio) };

      if (settingsId) {
        await pb.collection('settings').update(settingsId, data, { requestKey: null });
      } else {
        const newRecord = await pb.collection('settings').create(data, { requestKey: null });
        setSettingsId(newRecord.id);
      }

      toast.success('Configuración guardada correctamente');
    } catch (error) {
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const formatShippingPreview = (price) => {
    const numPrice = Number(price) || 0;
    if (numPrice === 0) {
      return <span className="text-green-500 font-bold text-xl">Envío gratis 🛵</span>;
    }
    const formatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(numPrice);
    return <span className="font-bold text-xl">Envío: {formatted}</span>;
  };

  return (
    <>
      <Helmet>
        <title>Configuración - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
          <div className="flex items-center gap-4 mb-10">
            <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-full border-border">
              <Link to="/gestion">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
              Configur<span className="text-primary">ación</span>
            </h1>
          </div>

          {loading ? (
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-6">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-1/4" />
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border shadow-lg">
              <CardHeader className="pb-6 border-b border-border bg-muted/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black uppercase tracking-wide">Costo de Envío</CardTitle>
                    <CardDescription className="text-base mt-1 font-medium">
                      Definí el precio estándar para los repartos a domicilio.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-8">
                <form onSubmit={handleSave} className="space-y-8">
                  <div className="space-y-4 max-w-md">
                    <Label htmlFor="precio_envio" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Precio de Envío (ARS)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                      <Input
                        id="precio_envio"
                        type="number"
                        min="0"
                        step="0.01"
                        value={precioEnvio}
                        onChange={(e) => setPrecioEnvio(e.target.value)}
                        className="pl-8 bg-background border-border text-foreground h-14 text-lg font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Vista previa para clientes
                    </p>
                    <div className="bg-background border border-border p-4 rounded-xl inline-block">
                      {formatShippingPreview(precioEnvio)}
                    </div>
                  </div>

                  <Button type="submit" size="lg" className="btn-primary h-14 px-8 text-lg" disabled={saving}>
                    <Save className="mr-2 h-5 w-5" />
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
