import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getClients, getVisits, getMaterials, getOxidants, getProducts, getUkony, getProdeje } from '@/lib/firestore';
import Card from '@/components/Card';
import Button from '@/components/Button';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedMode);
    if (savedMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    
    if (newMode) {
      document.documentElement.classList.add('dark');
      toast.success('Tmavý režim zapnut');
    } else {
      document.documentElement.classList.remove('dark');
      toast.success('Světlý režim zapnut');
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    
    setExporting(true);
    try {
      const [clients, visits, materials, oxidants, products, ukony, sales] = await Promise.all([
        getClients(user.uid),
        getVisits(user.uid),
        getMaterials(user.uid),
        getOxidants(user.uid),
        getProducts(user.uid),
        getUkony(user.uid),
        getProdeje(user.uid),
      ]);

      const backup = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          clients,
          visits,
          materials,
          oxidants,
          products,
          ukony,
          sales,
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hairmaster-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Záloha úspěšně vytvořena');
    } catch (err: any) {
      toast.error('Chyba při vytváření zálohy');
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        
        // Validate backup structure
        if (!backup.version || !backup.data) {
          throw new Error('Neplatný formát zálohy');
        }

        // Here you would implement the restore logic
        // For now, just show the data structure
        console.log('Backup data:', backup);
        toast.success('Záloha načtena (obnovení bude implementováno)');
      } catch (err: any) {
        toast.error('Chyba při načítání zálohy: ' + err.message);
        console.error(err);
      }
    };
    input.click();
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Nastavení</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">Konfigurace aplikace a správa dat</p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">Vzhled</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Tmavý režim</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Přepnutí mezi světlým a tmavým motivem</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? 'bg-accent-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Backup & Restore */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">Záloha a obnova</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-3">
                Exportujte všechna data do souboru JSON pro zálohování nebo přenos na jiné zařízení.
              </p>
              <Button 
                onClick={handleExportData} 
                disabled={exporting}
                variant="secondary"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exportuji...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Exportovat data
                  </>
                )}
              </Button>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-3">
                Importujte dříve vytvořenou zálohu pro obnovení dat.
              </p>
              <Button 
                onClick={handleImportData}
                variant="secondary"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Importovat data
              </Button>
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Upozornění: Import dat může přepsat existující data
              </p>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">O aplikaci</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">HairMaster</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Verze 1.0.0</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-2">
                Aplikace pro správu kaderníckého salonu - klienti, návštěvy, receptury, produkty a tržby.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">Vytvořil</p>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">MV</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Martin Vítek</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Software Developer</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Technologie</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">React 19 + TypeScript</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Databáze</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Firebase Firestore</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Styling</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Tailwind CSS</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Hosting</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Firebase Hosting</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">
                © 2026 Martin Vítek. Všechna práva vyhrazena.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
