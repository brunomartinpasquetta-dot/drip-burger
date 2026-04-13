
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    try {
      await pb.collection('users').requestPasswordReset(email, { requestKey: null });
      setSubmitted(true);
      toast.success('Correo de recuperación enviado');
    } catch (error) {
      console.error(error);
      toast.error('Ocurrió un error al intentar enviar el correo. Verificá que la dirección sea correcta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Recuperar Contraseña - DRIP BURGER</title>
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <div className="flex-1 flex items-center justify-center p-4 py-12">
          <div className="w-full max-w-md">
            <Link to="/login" className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-6 uppercase tracking-wider">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Login
            </Link>

            <Card className="bg-card border-border shadow-2xl">
              <CardHeader className="space-y-2 pb-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">Recuperar Contraseña</CardTitle>
                <CardDescription className="text-muted-foreground font-medium">
                  Ingresá tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="text-center space-y-6">
                    <div className="p-4 bg-muted/30 border border-border rounded-xl">
                      <p className="text-sm font-bold text-foreground">
                        Si existe una cuenta con <span className="text-primary">{email}</span>, recibirás un correo con las instrucciones.
                      </p>
                    </div>
                    <Button asChild className="w-full btn-primary h-12">
                      <Link to="/login">Volver al inicio</Link>
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2 text-left">
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

                    <Button type="submit" className="w-full btn-primary h-12 mt-2" disabled={loading}>
                      {loading ? 'Enviando...' : 'Enviar enlace'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPasswordPage;
