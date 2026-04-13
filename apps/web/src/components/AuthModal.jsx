
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import pb from '@/lib/pocketbaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2 } from 'lucide-react';

const AuthModal = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Register State
  const [regData, setRegData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    direccion: '',
    email: '',
    password: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(loginEmail, loginPassword, rememberMe);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Check if email exists
      const existing = await pb.collection('users').getList(1, 1, {
        filter: `email="${regData.email}"`,
        requestKey: null
      });

      if (existing.items.length > 0) {
        throw new Error('Ya tenés una cuenta con ese email. Ingresá.');
      }

      // 2. Create user
      const nombre_apellido = `${regData.nombre} ${regData.apellido}`.trim();
      await pb.collection('users').create({
        email: regData.email,
        password: regData.password,
        passwordConfirm: regData.password,
        name: regData.nombre,
        surname: regData.apellido,
        nombre_apellido: nombre_apellido,
        telefono: regData.telefono,
        phone: regData.telefono,
        direccion: regData.direccion,
        address: regData.direccion,
        role: 'CUSTOMER'
      }, { requestKey: null });

      // 3. Auto-login after registration (default to rememberMe = true for new accounts)
      await login(regData.email, regData.password, true);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegChange = (e) => {
    setRegData({ ...regData, [e.target.name]: e.target.value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight text-center">
            {activeTab === 'login' ? 'Bienvenido a Drip' : 'Sumate a Drip'}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground font-medium">
            {activeTab === 'login' 
              ? 'Ingresá a tu cuenta para pedir más rápido.' 
              : 'Creá tu cuenta y empezá a disfrutar.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-background">
              <TabsTrigger value="login" className="font-bold uppercase text-xs tracking-wider">Ingresar</TabsTrigger>
              <TabsTrigger value="register" className="font-bold uppercase text-xs tracking-wider">Registrarme</TabsTrigger>
            </TabsList>
          </div>

          {error && (
            <div className="mx-6 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          <div className="px-6 pb-6 max-h-[60vh] overflow-y-auto">
            <TabsContent value="login" className="mt-0 space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input 
                    id="login-email" 
                    type="email" 
                    placeholder="tu@email.com" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <Input 
                    id="login-password" 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                  />
                  <Label htmlFor="remember" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                    Recordarme
                  </Label>
                </div>
                <Button type="submit" className="w-full btn-primary font-bold uppercase tracking-wide mt-2" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ingresar'}
                </Button>
                <div className="text-center mt-4">
                  <button 
                    type="button" 
                    onClick={() => { setError(''); setActiveTab('register'); }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                  >
                    ¿No tenés cuenta? <span className="text-primary font-bold">Registrate</span>
                  </button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-0 space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-nombre">Nombre</Label>
                    <Input id="reg-nombre" name="nombre" value={regData.nombre} onChange={handleRegChange} required className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-apellido">Apellido</Label>
                    <Input id="reg-apellido" name="apellido" value={regData.apellido} onChange={handleRegChange} required className="bg-background" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-telefono">Teléfono</Label>
                  <Input id="reg-telefono" name="telefono" type="tel" value={regData.telefono} onChange={handleRegChange} required className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-direccion">Dirección de envío</Label>
                  <Input id="reg-direccion" name="direccion" value={regData.direccion} onChange={handleRegChange} required className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" name="email" type="email" value={regData.email} onChange={handleRegChange} required className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Contraseña</Label>
                  <Input id="reg-password" name="password" type="password" minLength={8} value={regData.password} onChange={handleRegChange} required className="bg-background" />
                </div>
                <Button type="submit" className="w-full btn-primary font-bold uppercase tracking-wide mt-2" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Cuenta'}
                </Button>
                <div className="text-center mt-4">
                  <button 
                    type="button" 
                    onClick={() => { setError(''); setActiveTab('login'); }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                  >
                    ¿Ya tenés cuenta? <span className="text-primary font-bold">Ingresá</span>
                  </button>
                </div>
              </form>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
