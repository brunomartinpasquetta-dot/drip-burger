
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const ProfilePage = () => {
  const { currentUser, updateProfile, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [formData, setFormData] = useState({
    nombre_apellido: '',
    telefono: '',
    direccion: '',
    email: ''
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    password: '',
    passwordConfirm: ''
  });

  useEffect(() => {
    if (currentUser) {
      setFormData({
        nombre_apellido: currentUser.nombre_apellido || currentUser.name || '',
        telefono: currentUser.telefono || '',
        direccion: currentUser.direccion || '',
        email: currentUser.email || ''
      });
    }
  }, [currentUser]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        nombre_apellido: formData.nombre_apellido,
        telefono: formData.telefono,
        direccion: formData.direccion,
        email: formData.email
      });
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      toast.error(error.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.password !== passwordData.passwordConfirm) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }

    if (passwordData.password.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    setPasswordLoading(true);
    try {
      await updateProfile({
        oldPassword: passwordData.oldPassword,
        password: passwordData.password,
        passwordConfirm: passwordData.passwordConfirm
      });
      toast.success('Contraseña actualizada correctamente');
      setPasswordData({ oldPassword: '', password: '', passwordConfirm: '' });
    } catch (error) {
      toast.error('Error al actualizar la contraseña. Verificá tu contraseña actual.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Mi Perfil - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-8">
            Mi <span className="text-primary">Perfil</span>
          </h1>

          <div className="space-y-8">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xl font-black uppercase tracking-wide">Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleProfileSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="nombre_apellido" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre y Apellido</Label>
                    <Input
                      id="nombre_apellido"
                      value={formData.nombre_apellido}
                      onChange={(e) => setFormData({ ...formData, nombre_apellido: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="telefono" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono</Label>
                      <Input
                        id="telefono"
                        type="tel"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        required
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="direccion" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección de entrega por defecto</Label>
                    <Input
                      id="direccion"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                    />
                  </div>

                  <Button type="submit" className="btn-primary h-12 px-8" disabled={loading}>
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-xl font-black uppercase tracking-wide">Cambiar Contraseña</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="oldPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contraseña Actual</Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      value={passwordData.oldPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nueva Contraseña</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordData.password}
                        onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                        required
                        minLength={8}
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordConfirm" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirmar Nueva Contraseña</Label>
                      <Input
                        id="passwordConfirm"
                        type="password"
                        value={passwordData.passwordConfirm}
                        onChange={(e) => setPasswordData({ ...passwordData, passwordConfirm: e.target.value })}
                        required
                        minLength={8}
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>
                  </div>

                  <Button type="submit" variant="outline" className="btn-secondary h-12 px-8" disabled={passwordLoading}>
                    {passwordLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="pt-8 border-t border-border flex justify-end">
              <Button onClick={logout} variant="destructive" className="font-bold uppercase tracking-wide h-12 px-8">
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;
