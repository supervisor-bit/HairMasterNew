import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import Button from '../components/Button';
import Input from '../components/Input';
import toast from 'react-hot-toast';

export function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({
    email: '',
    heslo: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegistering) {
        await register(form.email, form.heslo);
        toast.success('Účet vytvořen!');
      } else {
        await login(form.email, form.heslo);
        toast.success('Přihlášen!');
      }
      
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Chyba při přihlašování');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-900">
      {/* Left Side - Grafika */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-accent-600 via-accent-700 to-purple-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Dekorativní pozadí */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3"/>
                <path d="M8.12 8.12 12 12"/>
                <path d="M20 4 8.12 15.88"/>
                <circle cx="6" cy="18" r="3"/>
                <path d="M14.8 14.8 20 20"/>
              </svg>
            </div>
            <span className="text-3xl font-bold text-white">HairMaster</span>
          </div>
          
          <div className="space-y-6 mt-16">
            <h1 className="text-5xl font-bold text-white leading-tight">
              Moderní systém pro
              <br />
              kadeřnické salony
            </h1>
            <p className="text-xl text-white/80 max-w-md">
              Evidence klientů, návštěv, receptur a materiálů. 
              Vše na jednom místě, jednoduše a rychle.
            </p>
          </div>
        </div>

        {/* Ikony funkcí */}
        <div className="relative z-10 grid grid-cols-2 gap-4 mt-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <svg className="w-8 h-8 text-white mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <h3 className="text-white font-semibold">Evidence klientů</h3>
            <p className="text-white/70 text-sm mt-1">Kompletní přehled</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <svg className="w-8 h-8 text-white mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
            <h3 className="text-white font-semibold">Receptury</h3>
            <p className="text-white/70 text-sm mt-1">Historie a poznámky</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-800">
        <div className="w-full max-w-md">
          {/* Logo pro mobil */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-accent-500 to-purple-600 mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3"/>
                <path d="M8.12 8.12 12 12"/>
                <path d="M20 4 8.12 15.88"/>
                <circle cx="6" cy="18" r="3"/>
                <path d="M14.8 14.8 20 20"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">HairMaster</h1>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {isRegistering ? 'Vytvořit účet' : 'Vítejte zpět'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {isRegistering 
                ? 'Vytvořte si účet pro přístup do aplikace' 
                : 'Přihlaste se do svého účtu'}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
                autoFocus
              />

              <Input
                label="Heslo"
                type="password"
                value={form.heslo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, heslo: e.target.value })}
                required
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={loading}
              >
                {isRegistering ? 'Vytvořit účet' : 'Přihlásit se'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 font-medium transition-colors"
              >
                {isRegistering ? '← Zpět na přihlášení' : 'Vytvořit nový účet'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            © 2026 HairMaster · Salon management systém
          </p>
        </div>
      </div>
    </div>
  );
}
