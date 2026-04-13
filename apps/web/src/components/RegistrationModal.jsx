
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient';

const RegistrationModal = ({ isOpen, onClose, onSuccess, checkoutData }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    try {
      // Create the user account with the pre-filled data
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        role: 'CUSTOMER',
        nombre_apellido: checkoutData?.nombre_apellido || '',
        telefono: checkoutData?.telefono || '',
        direccion: checkoutData?.direccion || '',
        name: checkoutData?.nombre_apellido || '',
        phone: checkoutData?.telefono || '',
        address: checkoutData?.direccion || '',
        emailVisibility: true
      }, { requestKey: null });

      // Auto-login after successful registration
      await pb.collection('users').authWithPassword(email, password, { requestKey: null });

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Error al registrarse. Es posible que el correo ya esté en uso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Crear Cuenta</DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            Completá tu registro para guardar estos datos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-4">
            {/* Read-only pre-filled fields */}
            <div className="grid gap-3 p-4 bg-muted/20 rounded-xl border border-border">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</Label>
                <Input
                  disabled
                  value={checkoutData?.nombre_apellido || ''}
                  className="h-8 bg-muted/50 cursor-not-allowed opacity-70 text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teléfono</Label>
                  <Input
                    disabled
                    value={checkoutData?.telefono || ''}
                    className="h-8 bg-muted/50 cursor-not-allowed opacity-70 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dirección</Label>
                  <Input
                    disabled
                    value={checkoutData?.direccion || ''}
                    className="h-8 bg-muted/50 cursor-not-allowed opacity-70 text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-2 pt-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-border text-foreground h-12"
                placeholder="tu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="bg-background border-border text-foreground h-12"
                placeholder="Mínimo 8 caracteres"
              />
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-destructive font-medium">Faltan {8 - password.length} caracteres</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" className="w-full bg-[#F5A800] hover:bg-[#F5A800]/90 text-black font-bold uppercase tracking-wide h-12" disabled={loading || password.length < 8}>
              {loading ? 'Registrando...' : 'Completar Registro'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} className="w-full font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground">
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationModal;
