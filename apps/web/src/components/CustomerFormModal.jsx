import React, { useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const emptyForm = {
  nombre: '',
  apellido: '',
  telefono: '',
  direccion: '',
  email: '',
  password: '',
  passwordConfirm: '',
};

const CustomerFormModal = ({ open, onOpenChange, customer, onSuccess }) => {
  const isEdit = !!customer;
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) {
      setFormData(emptyForm);
      setErrors({});
      return;
    }
    if (customer) {
      const full = customer.nombre_apellido || customer.name || '';
      const parts = full.split(' ');
      const nombre = parts[0] || '';
      const apellido = parts.slice(1).join(' ') || customer.surname || '';
      setFormData({
        nombre,
        apellido,
        telefono: customer.telefono || customer.phone || '',
        direccion: customer.direccion || customer.address || '',
        email: customer.email || '',
        password: '',
        passwordConfirm: '',
      });
    } else {
      setFormData(emptyForm);
    }
    setErrors({});
  }, [open, customer]);

  const validate = () => {
    const e = {};
    if (!formData.nombre.trim()) e.nombre = true;
    if (!formData.apellido.trim()) e.apellido = true;
    if (!formData.telefono.trim()) e.telefono = true;
    if (!formData.direccion.trim()) e.direccion = true;
    if (!formData.email.trim()) e.email = true;
    if (!isEdit) {
      if (!formData.password || formData.password.length < 8) e.password = true;
      if (formData.password !== formData.passwordConfirm) e.passwordConfirm = true;
    } else if (formData.password) {
      if (formData.password.length < 8) e.password = true;
      if (formData.password !== formData.passwordConfirm) e.passwordConfirm = true;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error('Revisá los campos marcados en rojo');
      return;
    }
    setLoading(true);
    try {
      const nombre_apellido = `${formData.nombre} ${formData.apellido}`.trim();
      const basePayload = {
        email: formData.email.trim(),
        name: formData.nombre,
        surname: formData.apellido,
        nombre_apellido,
        telefono: formData.telefono,
        phone: formData.telefono,
        direccion: formData.direccion,
        address: formData.direccion,
        role: 'CUSTOMER',
        emailVisibility: true,
      };

      if (isEdit) {
        const payload = { ...basePayload };
        if (formData.password) {
          payload.password = formData.password;
          payload.passwordConfirm = formData.passwordConfirm;
        }
        await pb.collection('users').update(customer.id, payload, { requestKey: null });
        toast.success('Cliente actualizado');
      } else {
        await pb.collection('users').create({
          ...basePayload,
          password: formData.password,
          passwordConfirm: formData.passwordConfirm,
          verified: true,
        }, { requestKey: null });
        toast.success('Cliente creado');
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('[CustomerFormModal] save failed:', error?.response?.data || error);
      const msg = error?.response?.data?.email?.message
        || error?.response?.data?.password?.message
        || error?.message
        || 'Error al guardar el cliente';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (field) =>
    `bg-background border-border text-foreground h-10 ${errors[field] ? 'border-destructive bg-destructive/10' : ''}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">
            {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            {isEdit
              ? 'Modificá los datos del cliente. Dejá la contraseña vacía para no cambiarla.'
              : 'Completá los datos para crear un nuevo cliente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className={inputCls('nombre')}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Apellido</Label>
              <Input
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                className={inputCls('apellido')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputCls('email')}
              placeholder="cliente@email.com"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teléfono</Label>
            <Input
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              className={inputCls('telefono')}
              placeholder="11 1234 5678"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dirección</Label>
            <Input
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              className={inputCls('direccion')}
              placeholder="Calle 123, Piso 4, Dpto B"
            />
          </div>

          <div className="pt-3 border-t border-border space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {isEdit ? 'Cambiar contraseña (opcional)' : 'Contraseña'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isEdit ? 'Nueva' : 'Contraseña'}
                </Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={inputCls('password')}
                  placeholder={isEdit ? 'Dejar vacío' : 'Mínimo 8 caracteres'}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Confirmar</Label>
                <Input
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  className={inputCls('passwordConfirm')}
                  placeholder="Repetir contraseña"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 h-11 font-bold uppercase tracking-wide text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 h-11 font-black uppercase tracking-wide shadow-sm"
            >
              {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerFormModal;
