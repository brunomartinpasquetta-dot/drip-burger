
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const ProfileEditPage = () => {
  const { currentUser, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    surname: currentUser?.surname || '',
    address: currentUser?.address || '',
    phone: currentUser?.phone || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateProfile(currentUser.id, formData);
      toast.success('Perfil actualizado con éxito');
    } catch (error) {
      toast.error(error.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Mi Perfil - DRIP</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-5xl font-black uppercase tracking-tighter mb-10">
              Mi <span className="text-primary">Perfil</span>
            </h1>

            <Card className="bg-card border-border">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-2xl font-black uppercase tracking-wide">Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surname" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Apellido</Label>
                      <Input
                        id="surname"
                        value={formData.surname}
                        onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                        required
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                    <Input
                      value={currentUser?.email || ''}
                      disabled
                      className="bg-muted/50 border-border text-muted-foreground h-12 cursor-not-allowed"
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full btn-primary h-14 text-lg mt-4">
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileEditPage;
