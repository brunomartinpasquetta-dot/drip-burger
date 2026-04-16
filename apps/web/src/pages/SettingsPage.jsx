
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  MessageCircle,
  CreditCard,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Send,
  Power,
  AlertCircle,
  Loader2,
  Truck,
  Clock,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  waStatus, waConnect, waDisconnect, waTest, waToggle,
  mpStatus, mpSave, mpTest, mpToggle,
} from '@/lib/integrationsClient';
import { computeIsOpen } from '@/hooks/useStoreHours';
import { useAuth } from '@/contexts/AuthContext.jsx';

const formatShippingPreview = (price) => {
  const num = Number(price) || 0;
  if (num === 0) return 'Envío gratis 🛵';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num);
};

// ── Helpers de presentación ──────────────────────────────────────
const BORDER_BY_STATUS = {
  connected: 'border-l-green-500',
  pending_qr: 'border-l-yellow-500',
  disconnected: 'border-l-red-500',
  error: 'border-l-red-500',
};

const STATUS_LABEL = {
  connected: 'Conectado',
  pending_qr: 'Pendiente de QR',
  disconnected: 'Desconectado',
  error: 'Error',
};

const STATUS_DOT_COLOR = {
  connected: 'text-green-500',
  pending_qr: 'text-yellow-500',
  disconnected: 'text-red-500',
  error: 'text-red-500',
};

const StatusDot = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide ${STATUS_DOT_COLOR[status] || 'text-muted-foreground'}`}>
    <span className="text-[10px]">●</span>
    {STATUS_LABEL[status] || 'Desconocido'}
  </span>
);

// ══════════════════════════════════════════════════════════════════
//  Operación — Costo de envío + Horarios de atención
//  Un solo card con 2 secciones separadas por border-t.
//  Border-l dinámico: verde si está abierto, rojo si está cerrado
//  (el estado de apertura es visible de un vistazo sin scrollear).
// ══════════════════════════════════════════════════════════════════
const DEFAULT_MAX_MEDALLIONS = 20;

const OperacionCard = () => {
  const { isAuthReady, currentUser } = useAuth();
  const [settingsId, setSettingsId] = useState(null);
  const [precioEnvio, setPrecioEnvio] = useState(0);
  const [horaApertura, setHoraApertura] = useState('');
  const [horaCierre, setHoraCierre] = useState('');
  const [maxMedallionsPerSlot, setMaxMedallionsPerSlot] = useState(DEFAULT_MAX_MEDALLIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    // No fetchear hasta que auth esté hidratado. Evita requests huérfanos que
    // disparan el banner rojo de error apenas el componente monta.
    if (!isAuthReady || !currentUser) return;
    let mounted = true;
    (async () => {
      try {
        const records = await pb.collection('settings').getList(1, 1, { requestKey: null });
        if (!mounted) return;
        if (records.items.length > 0) {
          const rec = records.items[0];
          setSettingsId(rec.id);
          setPrecioEnvio(rec.precio_envio || 0);
          setHoraApertura(rec.hora_apertura || '');
          setHoraCierre(rec.hora_cierre || '');
          const savedMax = Number(rec.maxMedallionsPerSlot);
          setMaxMedallionsPerSlot(
            Number.isFinite(savedMax) && savedMax > 0 ? savedMax : DEFAULT_MAX_MEDALLIONS
          );
        }
      } catch (err) {
        console.error('[OperacionCard] load failed:', err);
        if (mounted) toast.error('Error al cargar la configuración');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isAuthReady, currentUser]);

  // Re-render cada 60s para que el preview de "Abierto/Cerrado" se actualice
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const handleSave = async () => {
    // Guard: exigir ambos horarios explícitos para evitar el estado "siempre
    // abierto" por default tolerante que ya pisó la tienda antes.
    if (!horaApertura || !horaCierre) {
      toast.error('Completá ambos horarios (apertura y cierre) antes de guardar');
      return;
    }
    setSaving(true);
    try {
      const cleanMax = Math.max(0, Math.floor(Number(maxMedallionsPerSlot) || 0));
      const data = {
        precio_envio: Number(precioEnvio),
        hora_apertura: horaApertura,
        hora_cierre: horaCierre,
        maxMedallionsPerSlot: cleanMax,
      };
      if (settingsId) {
        await pb.collection('settings').update(settingsId, data, { requestKey: null });
      } else {
        const nueva = await pb.collection('settings').create(data, { requestKey: null });
        setSettingsId(nueva.id);
      }
      toast.success('Configuración guardada');
    } catch (err) {
      console.error('[OperacionCard] save failed:', err?.response?.data || err);
      toast.error(`Error al guardar: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const previewIsOpen = computeIsOpen(horaApertura, horaCierre);
  const borderCls = previewIsOpen ? 'border-l-green-500' : 'border-l-red-500';

  return (
    <div className={`bg-card border border-border border-l-[6px] ${borderCls} rounded-lg overflow-hidden shadow-sm`}>
      {/* Row 1: título + chip de estado abierto/cerrado en vivo */}
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Truck className="w-5 h-5 text-primary shrink-0" />
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">Operación</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide border ${
            previewIsOpen
              ? 'bg-green-500/20 text-green-400 border-green-500/50'
              : 'bg-red-500/20 text-red-400 border-red-500/50'
          }`}
        >
          <span className="text-[8px]">●</span>
          {previewIsOpen ? 'Abierto ahora' : 'Cerrado ahora'}
        </span>
      </div>

      {/* Sección: Costo de envío */}
      <div className="px-4 pb-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Costo de envío</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={precioEnvio}
                onChange={(e) => setPrecioEnvio(e.target.value)}
                className="pl-7 bg-background border-border text-foreground h-10 text-sm font-black tabular-nums"
                placeholder="0"
              />
            </div>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            Preview: <span className="text-foreground">{formatShippingPreview(precioEnvio)}</span>
          </span>
        </div>
      </div>

      {/* Sección: Horarios de atención */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">
          <Clock className="inline w-3 h-3 mr-1 -mt-0.5" />
          Horarios de atención
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Apertura</label>
            <Input
              type="time"
              value={horaApertura}
              onChange={(e) => setHoraApertura(e.target.value)}
              className="bg-background border-border text-foreground h-10 text-sm font-black tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cierre</label>
            <Input
              type="time"
              value={horaCierre}
              onChange={(e) => setHoraCierre(e.target.value)}
              className="bg-background border-border text-foreground h-10 text-sm font-black tabular-nums"
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-medium mt-2">
          Fuera del horario el botón "Hacer Pedido" queda deshabilitado. Soporta cruce de medianoche.
        </p>
      </div>

      {/* Sección: Capacidad de producción por tanda */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">
          <Clock className="inline w-3 h-3 mr-1 -mt-0.5" />
          Capacidad de producción por tanda
        </p>
        <div className="max-w-sm space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
            Máximo de medallones
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              max="500"
              step="1"
              value={maxMedallionsPerSlot}
              onChange={(e) => setMaxMedallionsPerSlot(e.target.value)}
              className="bg-background border-border text-foreground h-10 text-sm font-black tabular-nums w-32"
            />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">medallones</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-medium mt-2">
          Máximo de medallones que podés preparar en cada horario. Los productos sin medallones no cuentan.
        </p>
      </div>

      {/* Row: Guardar */}
      <div className="px-4 py-3 border-t border-border">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="btn-primary h-10 px-4 text-xs font-black uppercase tracking-wide shadow-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1 h-4 w-4" />Guardar cambios</>}
        </Button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
//  WhatsApp Card
// ══════════════════════════════════════════════════════════════════
const WhatsAppCard = () => {
  const { isAuthReady, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [busyAction, setBusyAction] = useState(null); // 'connect' | 'disconnect' | 'test' | 'toggle'
  const [qrOpen, setQrOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const pollingRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await waStatus();
      setData(res);
    } catch (err) {
      console.error('[WhatsAppCard] status failed:', err);
      toast.error(`Error al leer estado de WhatsApp: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady || !currentUser) return;
    load();
  }, [isAuthReady, currentUser, load]);

  // Polling cuando el modal de QR está abierto — cada 2s
  useEffect(() => {
    if (!qrOpen) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await waStatus();
        setData(res);
        if (res.status === 'connected') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setQrOpen(false);
          toast.success('WhatsApp conectado correctamente');
        }
      } catch (err) {
        // silenciar errores de polling
      }
    }, 2000);
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [qrOpen]);

  const handleConnect = async () => {
    setBusyAction('connect');
    try {
      const res = await waConnect();
      setData(res);
      if (res.status === 'connected') {
        toast.success('WhatsApp ya estaba conectado');
      } else {
        setQrOpen(true);
        toast('Escaneá el QR desde el celular del negocio');
      }
    } catch (err) {
      toast.error(`Error al conectar: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Seguro? Vas a desvincular el dispositivo y borrar la sesión.')) return;
    setBusyAction('disconnect');
    try {
      await waDisconnect();
      toast.success('WhatsApp desconectado');
      await load();
    } catch (err) {
      toast.error(`Error al desconectar: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) {
      toast.error('Ingresá un teléfono para probar');
      return;
    }
    setBusyAction('test');
    try {
      await waTest(testPhone.trim());
      toast.success(`Mensaje de prueba enviado a ${testPhone}`);
    } catch (err) {
      toast.error(`Error al enviar prueba: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggle = async (enabled) => {
    setBusyAction('toggle');
    try {
      await waToggle(enabled);
      await load();
      toast.success(enabled ? 'WhatsApp activado' : 'WhatsApp desactivado');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!data) {
    return (
      <div className="bg-card border border-border border-l-[6px] border-l-red-500 rounded-lg p-4">
        <div className="flex items-start gap-2 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-bold">No se pudo cargar el estado de WhatsApp. Revisá la consola.</p>
        </div>
      </div>
    );
  }

  const status = data.status || 'disconnected';
  const borderCls = BORDER_BY_STATUS[status] || 'border-l-red-500';
  const isConnected = status === 'connected';

  return (
    <>
      <div className={`bg-card border border-border border-l-[6px] ${borderCls} rounded-lg overflow-hidden shadow-sm`}>
        {/* Row 1: título + toggle */}
        <div className="flex items-center justify-between gap-3 p-4 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="w-5 h-5 text-primary shrink-0" />
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">WhatsApp Business</h3>
          </div>
          <Switch
            checked={!!data.enabled}
            onCheckedChange={handleToggle}
            disabled={busyAction !== null}
            className="data-[state=checked]:bg-green-500"
          />
        </div>

        {/* Row 2: estado + teléfono */}
        <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
          <StatusDot status={status} />
          {data.phoneNumber && (
            <span className="text-xs font-bold text-muted-foreground tabular-nums">· {data.phoneNumber}</span>
          )}
          {data.lastError && (
            <span className="text-[10px] font-bold text-red-400 truncate max-w-xs">⚠ {data.lastError}</span>
          )}
        </div>

        {/* Row 3: acciones — estilo idéntico a botones del AdminDashboard */}
        <div className="px-4 py-3 border-t border-border">
          {isConnected ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex gap-2 flex-1">
                <Input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+54 9 342 512 3456"
                  className="bg-background border-border text-foreground h-10 text-xs font-bold tabular-nums flex-1"
                />
                <Button
                  onClick={handleTest}
                  disabled={busyAction !== null}
                  size="sm"
                  className="btn-primary h-10 px-3 text-xs font-black uppercase tracking-wide shrink-0"
                >
                  {busyAction === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1 h-4 w-4" />Probar</>}
                </Button>
              </div>
              <Button
                onClick={handleDisconnect}
                disabled={busyAction !== null}
                variant="outline"
                size="sm"
                className="h-10 px-3 border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs font-black uppercase tracking-wide"
              >
                {busyAction === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Power className="mr-1 h-4 w-4" />Desconectar</>}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={busyAction !== null || !data.enabled}
              className="btn-primary w-full h-11 text-sm font-black uppercase tracking-wide shadow-sm"
            >
              {busyAction === 'connect' ? <Loader2 className="h-5 w-5 animate-spin" /> : <><MessageCircle className="mr-2 h-5 w-5" />Conectar WhatsApp</>}
            </Button>
          )}
          {!data.enabled && !isConnected && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2 text-center">
              Activá el toggle arriba para conectar
            </p>
          )}
        </div>
      </div>

      {/* Modal QR — fullscreen overlay */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black uppercase tracking-tight">Escanear QR</h3>
              <Button onClick={() => setQrOpen(false)} variant="ghost" size="sm" className="h-8 px-2 text-[11px]">Cancelar</Button>
            </div>
            <p className="text-xs text-muted-foreground font-bold mb-4">
              Abrí WhatsApp en el celular del negocio → Configuración → Dispositivos vinculados → Vincular un dispositivo.
            </p>
            {data.qrCode ? (
              <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(data.qrCode)}`}
                  alt="QR WhatsApp"
                  className="w-full h-auto"
                />
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-xs font-bold text-muted-foreground uppercase">Esperando QR...</p>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground font-bold text-center mt-4 tabular-nums">
              Polling cada 2s · Estado: <StatusDot status={status} />
            </p>
          </div>
        </div>
      )}
    </>
  );
};

// ══════════════════════════════════════════════════════════════════
//  Mercado Pago Card
// ══════════════════════════════════════════════════════════════════
const MercadoPagoCard = () => {
  const { isAuthReady, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [form, setForm] = useState({
    accessToken: '',
    publicKey: '',
    webhookSecret: '',
  });
  const [visible, setVisible] = useState({
    accessToken: false,
    publicKey: false,
    webhookSecret: false,
  });

  const load = useCallback(async () => {
    try {
      const res = await mpStatus();
      setData(res);
      setForm(f => ({
        ...f,
        publicKey: res.publicKey || '',
      }));
    } catch (err) {
      console.error('[MercadoPagoCard] status failed:', err);
      toast.error(`Error al leer estado de MP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady || !currentUser) return;
    load();
  }, [isAuthReady, currentUser, load]);

  const handleSave = async () => {
    if (!form.accessToken.trim() || !form.publicKey.trim()) {
      toast.error('Access Token y Public Key son requeridos');
      return;
    }
    setBusyAction('save');
    try {
      await mpSave({
        accessToken: form.accessToken.trim(),
        publicKey: form.publicKey.trim(),
        webhookSecret: form.webhookSecret.trim() || undefined,
      });
      toast.success('Credenciales guardadas y verificadas');
      setForm(f => ({ ...f, accessToken: '', webhookSecret: '' }));
      await load();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleTest = async () => {
    setBusyAction('test');
    try {
      const res = await mpTest();
      toast.success(`Conexión OK · init_point generado`);
      console.log('[mp/test] init_point:', res.initPoint);
      await load();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggle = async (enabled) => {
    setBusyAction('toggle');
    try {
      await mpToggle(enabled);
      await load();
      toast.success(enabled ? 'Mercado Pago activado' : 'Mercado Pago desactivado');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const webhookUrl = 'https://api.dripburger.com/mp/webhook';
  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook copiado');
    } catch (err) {
      toast.error('No se pudo copiar');
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (!data) {
    return (
      <div className="bg-card border border-border border-l-[6px] border-l-red-500 rounded-lg p-4">
        <div className="flex items-start gap-2 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-bold">No se pudo cargar el estado de Mercado Pago.</p>
        </div>
      </div>
    );
  }

  const status = data.status || 'disconnected';
  const borderCls = BORDER_BY_STATUS[status] || 'border-l-red-500';

  return (
    <div className={`bg-card border border-border border-l-[6px] ${borderCls} rounded-lg overflow-hidden shadow-sm`}>
      {/* Row 1: título + toggle */}
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <CreditCard className="w-5 h-5 text-primary shrink-0" />
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">Mercado Pago</h3>
        </div>
        <Switch
          checked={!!data.enabled}
          onCheckedChange={handleToggle}
          disabled={busyAction !== null}
          className="data-[state=checked]:bg-green-500"
        />
      </div>

      {/* Row 2: estado */}
      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
        <StatusDot status={status} />
        {data.accessTokenPreview && (
          <span className="text-[10px] font-mono font-bold text-muted-foreground">Token: {data.accessTokenPreview}</span>
        )}
        {data.lastError && (
          <span className="text-[10px] font-bold text-red-400 truncate max-w-xs">⚠ {data.lastError}</span>
        )}
      </div>

      {/* Row 3: inputs con toggle visibility */}
      <div className="px-4 py-3 border-t border-border space-y-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Access Token</label>
          <div className="relative">
            <Input
              type={visible.accessToken ? 'text' : 'password'}
              value={form.accessToken}
              onChange={(e) => setForm(f => ({ ...f, accessToken: e.target.value }))}
              placeholder={data.accessTokenPreview || 'APP_USR-...'}
              className="bg-background border-border text-foreground h-9 text-xs font-mono pr-9"
            />
            <button
              type="button"
              onClick={() => setVisible(v => ({ ...v, accessToken: !v.accessToken }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {visible.accessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Public Key</label>
          <div className="relative">
            <Input
              type={visible.publicKey ? 'text' : 'password'}
              value={form.publicKey}
              onChange={(e) => setForm(f => ({ ...f, publicKey: e.target.value }))}
              placeholder="APP_USR-..."
              className="bg-background border-border text-foreground h-9 text-xs font-mono pr-9"
            />
            <button
              type="button"
              onClick={() => setVisible(v => ({ ...v, publicKey: !v.publicKey }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {visible.publicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Webhook Secret (opcional)</label>
          <div className="relative">
            <Input
              type={visible.webhookSecret ? 'text' : 'password'}
              value={form.webhookSecret}
              onChange={(e) => setForm(f => ({ ...f, webhookSecret: e.target.value }))}
              placeholder="Secret para validar webhooks"
              className="bg-background border-border text-foreground h-9 text-xs font-mono pr-9"
            />
            <button
              type="button"
              onClick={() => setVisible(v => ({ ...v, webhookSecret: !v.webhookSecret }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {visible.webhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: acciones */}
      <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleSave}
          disabled={busyAction !== null}
          size="sm"
          className="btn-primary flex-1 h-10 text-xs font-black uppercase tracking-wide shadow-sm"
        >
          {busyAction === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-1 h-4 w-4" />Guardar</>}
        </Button>
        <Button
          onClick={handleTest}
          disabled={busyAction !== null || status !== 'connected'}
          variant="outline"
          size="sm"
          className="flex-1 h-10 border-border btn-secondary text-xs font-black uppercase tracking-wide"
        >
          {busyAction === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1 h-4 w-4" />Probar</>}
        </Button>
      </div>

      {/* Row 5: webhook URL copiable */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Webhook URL</p>
        <button
          type="button"
          onClick={copyWebhook}
          className="w-full flex items-center gap-2 px-3 py-2 bg-background border border-border rounded text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors group"
        >
          <Copy className="w-3 h-3 shrink-0 group-hover:text-primary" />
          <span className="truncate flex-1 text-left">{webhookUrl}</span>
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
//  Page wrapper
// ══════════════════════════════════════════════════════════════════
// Body de la pantalla de Configuración, sin Header ni container.
// Se usa embebido como tab dentro del AdminDashboard y también por el
// wrapper SettingsPage (página standalone para deep-links legacy).
export const SettingsContent = () => {
  return (
    <div className="space-y-4">
      <OperacionCard />
      <div className="pt-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Integraciones</p>
        <div className="space-y-4">
          <WhatsAppCard />
          <MercadoPagoCard />
        </div>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  return (
    <>
      <Helmet><title>Configuración - DRIP BURGER</title></Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 max-w-4xl">
          {/* Header con volver — mismo patrón que AdminDashboard */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <Button asChild variant="outline" size="sm" className="border-border h-8 px-2 text-[11px]">
              <Link to="/gestion"><ArrowLeft className="mr-1 h-3 w-3" />Volver</Link>
            </Button>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">
              Configur<span className="text-primary">ación</span>
            </h1>
            <div className="w-16" />
          </div>

          <SettingsContent />
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
