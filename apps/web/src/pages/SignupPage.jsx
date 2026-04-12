
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const SignupPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    address: '',
    phone: '',
    email: '',
    password: '',
    passwordConfirm: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.passwordConfirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      await signup(formData);
      toast.success('Cuenta creada. ¡Bienvenido a DRIP BURGER!');
      navigate('/menu');
    } catch (error) {
      toast.error(error.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Registro - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <div className="flex-1 flex items-center justify-center p-4 py-12">
          <div className="w-full max-w-xl">
            <div className="text-center mb-8">
              <img 
                src="https://horizons-cdn.hostinger.com/275f7838-3e15-483d-8eea-e9521d942912/cf52b8972fd221515cb37ac167cfd2a2.png" 
                alt="DRIP BURGER Mascot" 
                className="w-[120px] h-[120px] mx-auto object-contain drop-shadow-[0_0_15px_rgba(245,168,0,0.2)]"
              />
            </div>

            <Card className="bg-card border-border shadow-2xl">
              <CardHeader className="space-y-1 pb-6 text-center">
                <CardTitle className="text-3xl font-black uppercase tracking-tight">Unite a DRIP BURGER</CardTitle>
                <p className="text-sm text-muted-foreground font-medium">Completá tus datos para pedir</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
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
                    <Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección de entrega</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                      placeholder="Calle, número, depto"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono (WhatsApp)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                      placeholder="11 1234-5678"
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        minLength={8}
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordConfirm" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirmar</Label>
                      <Input
                        id="passwordConfirm"
                        type="password"
                        value={formData.passwordConfirm}
                        onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                        required
                        minLength={8}
                        className="bg-background border-border text-foreground h-12"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full btn-primary h-12 mt-4" disabled={loading}>
                    {loading ? 'Creando...' : 'Crear Cuenta'}
                  </Button>
                </form>

                <div className="mt-8 text-center text-sm font-medium">
                  <span className="text-muted-foreground">¿Ya sos parte? </span>
                  <Link to="/login" className="text-primary hover:text-primary/80 uppercase font-bold tracking-wide ml-1 transition-colors">
                    Ingresar
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
