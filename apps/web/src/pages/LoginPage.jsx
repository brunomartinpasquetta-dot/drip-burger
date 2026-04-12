
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(formData.email, formData.password);
      toast.success('Ingreso exitoso');
      
      if (user.role === 'ADMIN') {
        navigate('/gestion');
      } else {
        navigate('/');
      }
    } catch (error) {
      toast.error(error.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Ingreso Staff - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <div className="flex-1 flex items-center justify-center p-4 py-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <img 
                src="https://horizons-cdn.hostinger.com/275f7838-3e15-483d-8eea-e9521d942912/cf52b8972fd221515cb37ac167cfd2a2.png" 
                alt="DRIP BURGER Mascot" 
                className="w-[160px] h-[160px] mx-auto object-contain drop-shadow-[0_0_15px_rgba(245,168,0,0.2)]"
              />
            </div>

            <Card className="bg-card border-border shadow-2xl">
              <CardHeader className="space-y-1 pb-6 text-center">
                <CardTitle className="text-3xl font-black uppercase tracking-tight">Acceso Staff</CardTitle>
                <p className="text-sm text-muted-foreground font-medium">Solo personal autorizado</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                      placeholder="admin@dripburger.com"
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      className="bg-background border-border text-foreground h-12"
                      placeholder="••••••••"
                    />
                  </div>

                  <Button type="submit" className="w-full btn-primary h-12 mt-2" disabled={loading}>
                    {loading ? 'Verificando...' : 'Entrar'}
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

export default LoginPage;
