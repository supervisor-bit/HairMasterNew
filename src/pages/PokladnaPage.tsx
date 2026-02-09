import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getVisits, getProdeje } from '@/lib/firestore';
import type { Navsteva, Prodej } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Button from '@/components/Button';

interface DailyStats {
  hotovost: number;
  qr: number;
  celkem: number;
  hotovostCount: number;
  qrCount: number;
  celkemCount: number;
}

interface Transaction {
  id: string;
  cas: string;
  klient: string;
  castka: number;
  metoda: 'hotovost' | 'qr' | undefined;
  typ: 'navsteva' | 'prodej';
}

export default function PokladnaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<DailyStats>({
    hotovost: 0,
    qr: 0,
    celkem: 0,
    hotovostCount: 0,
    qrCount: 0,
    celkemCount: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [visits, sales] = await Promise.all([
        getVisits(user.uid) as Promise<Navsteva[]>,
        getProdeje(user.uid) as Promise<Prodej[]>,
      ]);

      // Filter by selected date
      const selectedDateObj = new Date(selectedDate);
      const filteredVisits = visits.filter(v => {
        const vDate = new Date(v.datum);
        return vDate.toISOString().split('T')[0] === selectedDate;
      });

      const filteredSales = sales.filter(s => {
        const sDate = new Date(s.datum);
        return sDate.toISOString().split('T')[0] === selectedDate;
      });

      // Calculate stats
      let hotovost = 0;
      let qr = 0;
      let hotovostCount = 0;
      let qrCount = 0;

      filteredVisits.forEach(v => {
        const castka = v.celkova_castka || 0;
        if (v.platebni_metoda === 'hotovost') {
          hotovost += castka;
          hotovostCount++;
        } else if (v.platebni_metoda === 'qr') {
          qr += castka;
          qrCount++;
        }
      });

      filteredSales.forEach(s => {
        const castka = s.celkova_castka || 0;
        if (s.platebni_metoda === 'hotovost') {
          hotovost += castka;
          hotovostCount++;
        } else if (s.platebni_metoda === 'qr') {
          qr += castka;
          qrCount++;
        }
      });

      setStats({
        hotovost,
        qr,
        celkem: hotovost + qr,
        hotovostCount,
        qrCount,
        celkemCount: hotovostCount + qrCount,
      });

      // Build transactions list
      const trans: Transaction[] = [];

      filteredVisits.forEach(v => {
        trans.push({
          id: v.id,
          cas: v.datum,
          klient: `${v.klient_jmeno || ''} ${v.klient_prijmeni || ''}`.trim() || 'Neznámý',
          castka: v.celkova_castka || 0,
          metoda: v.platebni_metoda,
          typ: 'navsteva',
        });
      });

      filteredSales.forEach(s => {
        trans.push({
          id: s.id,
          cas: s.datum,
          klient: s.klient_jmeno && s.klient_prijmeni 
            ? `${s.klient_jmeno} ${s.klient_prijmeni}` 
            : 'Prodej produktů',
          castka: s.celkova_castka || 0,
          metoda: s.platebni_metoda,
          typ: 'prodej',
        });
      });

      // Sort by time (newest first)
      trans.sort((a, b) => new Date(b.cas).getTime() - new Date(a.cas).getTime());
      setTransactions(trans);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const handleExportUzaverka = () => {
    const dateStr = new Date(selectedDate).toLocaleDateString('cs-CZ', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    const content = `
DENNÍ UZÁVĚRKA
${dateStr}
─────────────────────────────────

CELKEM:         ${stats.celkem.toLocaleString('cs-CZ')} Kč (${stats.celkemCount}×)

💵 Hotovost:    ${stats.hotovost.toLocaleString('cs-CZ')} Kč (${stats.hotovostCount}×)
📱 QR kód:      ${stats.qr.toLocaleString('cs-CZ')} Kč (${stats.qrCount}×)

Počet transakcí: ${stats.celkemCount}
─────────────────────────────────

TRANSAKCE:

${transactions.map(t => {
  const time = new Date(t.cas).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const metodaIcon = t.metoda === 'hotovost' ? '💵' : t.metoda === 'qr' ? '📱' : '❓';
  return `${time}  ${t.klient.padEnd(25)} ${t.castka.toLocaleString('cs-CZ').padStart(8)} Kč  ${metodaIcon}`;
}).join('\n')}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uzaverka-${selectedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  const hotovostPercent = stats.celkem > 0 ? Math.round((stats.hotovost / stats.celkem) * 100) : 0;
  const qrPercent = stats.celkem > 0 ? Math.round((stats.qr / stats.celkem) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pokladna</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Přehled tržeb a plateb
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          />
          <Button onClick={handleExportUzaverka} variant="secondary">
            📄 Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card padding="lg" className="bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-white dark:to-gray-800 border-emerald-100 dark:border-emerald-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-2xl">
              💵
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Hotovost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.hotovost.toLocaleString('cs-CZ')} Kč
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.hotovostCount} plateb
              </p>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-white dark:to-gray-800 border-blue-100 dark:border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-2xl">
              📱
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">QR kód</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.qr.toLocaleString('cs-CZ')} Kč
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.qrCount} plateb
              </p>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="bg-gradient-to-br from-purple-50 dark:from-purple-900/20 to-white dark:to-gray-800 border-purple-100 dark:border-purple-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center text-2xl">
              💰
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Celkem</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.celkem.toLocaleString('cs-CZ')} Kč
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.celkemCount} plateb
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment Distribution */}
      {stats.celkem > 0 && (
        <Card padding="lg" className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Rozdělení plateb</h2>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">💵 Hotovost</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{hotovostPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${hotovostPercent}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">📱 QR kód</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{qrPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${qrPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Transactions List */}
      <Card padding="lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Transakce</h2>
        
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Žádné transakce pro vybraný den</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {transactions.map((t, idx) => {
              const time = new Date(t.cas).toLocaleTimeString('cs-CZ', { 
                hour: '2-digit', 
                minute: '2-digit' 
              });
              
              return (
                <div 
                  key={t.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors animate-slide-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-xl">
                      {t.metoda === 'hotovost' ? '💵' : t.metoda === 'qr' ? '📱' : '❓'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{t.klient}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span>{time}</span>
                        <Badge variant={t.typ === 'navsteva' ? 'primary' : 'secondary'}>
                          {t.typ === 'navsteva' ? 'Návštěva' : 'Prodej'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {t.castka.toLocaleString('cs-CZ')} Kč
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t.metoda === 'hotovost' ? 'Hotovost' : t.metoda === 'qr' ? 'QR kód' : 'Neuvedeno'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
