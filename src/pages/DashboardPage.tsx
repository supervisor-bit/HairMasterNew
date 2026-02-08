import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getClients, getVisits, getProdeje } from '@/lib/firestore';
import type { Klient, Navsteva, Prodej } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';

const APP_VERSION = '2.0.3';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recentVisits, setRecentVisits] = useState<Navsteva[]>([]);
  const [recentClients, setRecentClients] = useState<Klient[]>([]);
  const [recentSales, setRecentSales] = useState<Prodej[]>([]);
  const [stats, setStats] = useState({ totalClients: 0, totalVisits: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [clients, allVisits, allSales] = await Promise.all([
        getClients(user.uid),
        getVisits(user.uid),
        getProdeje(user.uid),
      ]);

      // Recent clients (last 5)
      const sortedClients = [...(clients as Klient[])].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecentClients(sortedClients.slice(0, 5));

      // Recent visits (last 10)
      const sortedVisits = [...(allVisits as Navsteva[])].sort((a, b) => 
        new Date(b.datum).getTime() - new Date(a.datum).getTime()
      );
      setRecentVisits(sortedVisits.slice(0, 10));

      // Recent sales (last 5)
      const sortedSales = [...(allSales as Prodej[])].sort((a, b) => 
        new Date(b.datum).getTime() - new Date(a.datum).getTime()
      );
      setRecentSales(sortedSales.slice(0, 5));

      // Stats
      const now = new Date();
      const thisMonth = (allVisits as Navsteva[]).filter(v => {
        const visitDate = new Date(v.datum);
        return visitDate.getMonth() === now.getMonth() && 
               visitDate.getFullYear() === now.getFullYear();
      }).length;

      setStats({
        totalClients: clients.length,
        totalVisits: allVisits.length,
        thisMonth,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (d: string | undefined) => {
    if (!d) return '';
    
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Dnes';
    if (diffDays === 1) return 'Včera';
    if (diffDays < 7) return `Před ${diffDays} dny`;
    
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Přehled</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
            Rychlý přístup k nedávné práci · <span className="text-xs opacity-50">v{APP_VERSION}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/clients?new=true')}>
            + Nový klient
          </Button>
          <Button onClick={() => navigate('/visits/new')}>
            Nová návštěva
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card padding="md" className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-white dark:to-gray-800 border-blue-100 dark:border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Klienti celkem</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{stats.totalClients}</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-purple-50 dark:from-purple-900/20 to-white dark:to-gray-800 border-purple-100 dark:border-purple-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Návštěv celkem</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{stats.totalVisits}</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-white dark:to-gray-800 border-emerald-100 dark:border-emerald-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Tento měsíc</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{stats.thisMonth}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent visits */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">Poslední návštěvy</h2>

          {recentVisits.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Zatím žádné návštěvy</p>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {recentVisits.map((visit, idx) => (
                <Card
                  key={visit.id}
                  hover
                  padding="md"
                  onClick={() => navigate(`/visits/${visit.id}`)}
                  className="cursor-pointer group animate-slide-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 group-hover:text-accent-700 transition-colors">
                        {visit.klient_jmeno} {visit.klient_prijmeni}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{formatDate(visit.datum)}</span>
                        <Badge variant="service" className="text-xs">
                          {visit.sluzby_count != null ? `${visit.sluzby_count} ${visit.sluzby_count === 1 ? 'služba' : visit.sluzby_count < 5 ? 'služby' : 'služeb'}` : 'služby'}
                        </Badge>
                        {visit.castka_produkty != null && visit.castka_produkty > 0 && (
                          <Badge variant="product" className="text-xs">
                            🛍️ produkty
                          </Badge>
                        )}
                        {visit.celkova_castka != null && (
                          <span className="text-sm font-semibold text-emerald-600">
                            {visit.celkova_castka.toLocaleString('cs-CZ')} Kč
                          </span>
                        )}
                      </div>
                      {visit.poznamka && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{visit.poznamka}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-accent-600 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent sales */}
        {recentSales.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Prodej produktů</h2>
            </div>

            <div className="space-y-2">
              {recentSales.map((sale, idx) => (
                <Card
                  key={sale.id}
                  padding="md"
                  className="animate-slide-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                        {sale.klient_id ? (
                          <>
                            {sale.klient_jmeno} {sale.klient_prijmeni}
                          </>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">{sale.klient_jmeno || 'Zákazník'}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{formatDate(sale.datum)}</span>
                        <Badge variant="product" className="text-xs">
                          💰 {sale.produkty.reduce((sum, p) => sum + p.pocet_ks, 0)} ks
                        </Badge>
                        <span className="text-sm font-semibold text-emerald-600">
                          {sale.celkova_castka.toLocaleString('cs-CZ')} Kč
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
                        {sale.produkty.map(p => p.produkt_nazev).join(', ')}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent clients */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Noví klienti</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
              Zobrazit vše →
            </Button>
          </div>

          {recentClients.length === 0 ? (
            <Card padding="lg" className="text-center">
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Zatím žádní klienti</p>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {recentClients.map((client, idx) => (
                <Card
                  key={client.id}
                  hover
                  padding="md"
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="cursor-pointer group animate-slide-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <Avatar jmeno={client.jmeno} prijmeni={client.prijmeni} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 group-hover:text-accent-700 transition-colors">
                        {client.jmeno} {client.prijmeni}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{formatDate(client.created_at)}</span>
                        {client.telefon && (
                          <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">· {client.telefon}</span>
                        )}
                      </div>
                      {client.skupiny && client.skupiny.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {client.skupiny.map(s => (
                            <span
                              key={s.id}
                              className="text-xs px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: s.barva }}
                            >
                              {s.nazev}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-accent-600 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
