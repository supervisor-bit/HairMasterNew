import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getVisitsWithDetails, getProdeje } from '@/lib/firestore';
import type { Navsteva, Sluzba, Miska, MaterialVMisce, Prodej } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MaterialStats {
  nazev: string;
  count: number;
  totalGrams: number;
}

interface OdstinStats {
  odstin: string;
  material: string;
  count: number;
  totalGrams: number;
}

interface OxidantStats {
  procenta: string;
  count: number;
}

interface MonthlyUsage {
  month: string;
  gramy: number;
}

interface ProductStats {
  nazev: string;
  count: number;
  totalRevenue: number;
  totalItems: number;
}

interface MonthlySales {
  month: string;
  castka: number;
}

export default function StatisticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'materials' | 'sales'>('materials');
  
  // Material stats
  const [topMaterials, setTopMaterials] = useState<MaterialStats[]>([]);
  const [topOdstiny, setTopOdstiny] = useState<OdstinStats[]>([]);
  const [topOxidants, setTopOxidants] = useState<OxidantStats[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyUsage[]>([]);
  const [totalGrams, setTotalGrams] = useState(0);
  const [avgGramsPerVisit, setAvgGramsPerVisit] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  
  // Sales stats
  const [topProducts, setTopProducts] = useState<ProductStats[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([]);
  const [totalSalesRevenue, setTotalSalesRevenue] = useState(0);
  const [totalProductsSold, setTotalProductsSold] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    
    try {
      const [visits, sales] = await Promise.all([
        getVisitsWithDetails(user.uid) as Promise<Navsteva[]>,
        getProdeje(user.uid) as Promise<Prodej[]>
      ]);
      
      // === MATERIAL STATS ===
      const materialMap = new Map<string, { count: number; totalGrams: number }>();
      const odstinMap = new Map<string, { material: string; count: number; totalGrams: number }>();
      const oxidantMap = new Map<string, number>();
      const monthlyMap = new Map<string, number>();
      
      let totalGramsSum = 0;
      let visitsWithMaterials = 0;

      visits.forEach(visit => {
        if (!visit.sluzby || visit.sluzby.length === 0) return;
        
        let visitHasMaterials = false;
        const date = new Date(visit.datum);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        visit.sluzby.forEach((sluzba: Sluzba) => {
          if (!sluzba.misky) return;

          sluzba.misky.forEach((miska: Miska) => {
            if (miska.oxidant_nazev) {
              const current = oxidantMap.get(miska.oxidant_nazev) || 0;
              oxidantMap.set(miska.oxidant_nazev, current + 1);
            }

            if (!miska.materialy) return;

            miska.materialy.forEach((mat: MaterialVMisce) => {
              visitHasMaterials = true;
              const gramy = mat.gramy_materialu || 0;
              totalGramsSum += gramy;

              const materialName = mat.material_nazev || 'Neznámý';
              const matStats = materialMap.get(materialName) || { count: 0, totalGrams: 0 };
              matStats.count++;
              matStats.totalGrams += gramy;
              materialMap.set(materialName, matStats);

              if (mat.odstin_cislo && mat.odstin_cislo.trim()) {
                const odstinKey = `${materialName}|${mat.odstin_cislo}`;
                const odstinStats = odstinMap.get(odstinKey) || { material: materialName, count: 0, totalGrams: 0 };
                odstinStats.count++;
                odstinStats.totalGrams += gramy;
                odstinMap.set(odstinKey, odstinStats);
              }

              const monthGrams = monthlyMap.get(monthKey) || 0;
              monthlyMap.set(monthKey, monthGrams + gramy);
            });
          });
        });

        if (visitHasMaterials) visitsWithMaterials++;
      });

      const materials = Array.from(materialMap.entries())
        .map(([nazev, stats]) => ({ nazev, ...stats }))
        .sort((a, b) => b.count - a.count);
      setTopMaterials(materials.slice(0, 10));

      const odstiny = Array.from(odstinMap.entries())
        .map(([key, stats]) => {
          const [, odstin] = key.split('|');
          return { odstin, ...stats };
        })
        .sort((a, b) => b.count - a.count);
      setTopOdstiny(odstiny.slice(0, 10));

      const oxidants = Array.from(oxidantMap.entries())
        .map(([procenta, count]) => ({ procenta, count }))
        .sort((a, b) => b.count - a.count);
      setTopOxidants(oxidants.slice(0, 5));

      const monthlyArray: MonthlyUsage[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('cs-CZ', { month: 'short', year: 'numeric' });
        monthlyArray.push({
          month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          gramy: monthlyMap.get(monthKey) || 0,
        });
      }
      setMonthlyData(monthlyArray);

      setTotalGrams(totalGramsSum);
      setTotalVisits(visitsWithMaterials);
      setAvgGramsPerVisit(visitsWithMaterials > 0 ? Math.round(totalGramsSum / visitsWithMaterials) : 0);
      
      // === SALES STATS ===
      const productMap = new Map<string, { count: number; totalRevenue: number; totalItems: number }>();
      const monthlySalesMap = new Map<string, number>();
      
      let totalRevenue = 0;
      let totalItems = 0;
      
      sales.forEach(sale => {
        const date = new Date(sale.datum);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // Add to monthly sales
        const monthRevenue = monthlySalesMap.get(monthKey) || 0;
        monthlySalesMap.set(monthKey, monthRevenue + (sale.celkova_castka || 0));
        
        totalRevenue += sale.celkova_castka || 0;
        
        // Process each product in sale
        sale.produkty?.forEach(prod => {
          const productName = prod.produkt_nazev || 'Neznámý';
          const productStats = productMap.get(productName) || { count: 0, totalRevenue: 0, totalItems: 0 };
          
          productStats.count++; // Number of sales containing this product
          productStats.totalRevenue += prod.pocet_ks * prod.cena_za_ks;
          productStats.totalItems += prod.pocet_ks;
          
          productMap.set(productName, productStats);
          totalItems += prod.pocet_ks;
        });
      });
      
      const products = Array.from(productMap.entries())
        .map(([nazev, stats]) => ({ nazev, ...stats }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);
      setTopProducts(products.slice(0, 10));
      
      const monthlySalesArray: MonthlySales[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('cs-CZ', { month: 'short', year: 'numeric' });
        monthlySalesArray.push({
          month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          castka: monthlySalesMap.get(monthKey) || 0,
        });
      }
      setMonthlySales(monthlySalesArray);
      
      setTotalSalesRevenue(totalRevenue);
      setTotalProductsSold(totalItems);
      setTotalSalesCount(sales.length);
      
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Statistiky</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Přehled spotřeby materiálů a prodeje produktů
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('materials')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'materials'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          🧪 Materiály
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'sales'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          🛍️ Prodeje produktů
        </button>
      </div>

      {activeTab === 'materials' ? (
        <MaterialsStats
          topMaterials={topMaterials}
          topOdstiny={topOdstiny}
          topOxidants={topOxidants}
          monthlyData={monthlyData}
          totalGrams={totalGrams}
          avgGramsPerVisit={avgGramsPerVisit}
          totalVisits={totalVisits}
        />
      ) : (
        <SalesStats
          topProducts={topProducts}
          monthlySales={monthlySales}
          totalSalesRevenue={totalSalesRevenue}
          totalProductsSold={totalProductsSold}
          totalSalesCount={totalSalesCount}
        />
      )}
    </div>
  );
}

// Materials Stats Component
function MaterialsStats({
  topMaterials,
  topOdstiny,
  topOxidants,
  monthlyData,
  totalGrams,
  avgGramsPerVisit,
  totalVisits
}: {
  topMaterials: MaterialStats[];
  topOdstiny: OdstinStats[];
  topOxidants: OxidantStats[];
  monthlyData: MonthlyUsage[];
  totalGrams: number;
  avgGramsPerVisit: number;
  totalVisits: number;
}) {
  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card padding="md" className="bg-gradient-to-br from-purple-50 dark:from-purple-900/20 to-white dark:to-gray-800 border-purple-100 dark:border-purple-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Celkem spotřeba</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalGrams.toLocaleString('cs-CZ')} g</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-white dark:to-gray-800 border-blue-100 dark:border-blue-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Průměr na návštěvu</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{avgGramsPerVisit} g</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-white dark:to-gray-800 border-emerald-100 dark:border-emerald-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Top materiál</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {topMaterials[0]?.nazev || '-'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Spotřeba za posledních 6 měsíců</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis 
              dataKey="month" 
              className="text-xs text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <YAxis 
              className="text-xs text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgb(31 41 55)', 
                border: 'none', 
                borderRadius: '0.5rem',
                color: 'white'
              }}
              labelStyle={{ color: 'white' }}
            />
            <Bar 
              dataKey="gramy" 
              fill="#8b5cf6" 
              radius={[4, 4, 0, 0]}
              name="Gramy"
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Materials */}
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Nejpoužívanější materiály</h2>
          {topMaterials.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Zatím žádná data</p>
          ) : (
            <div className="space-y-3">
              {topMaterials.map((mat, idx) => (
                <div key={mat.nazev} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{mat.nazev}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {mat.totalGrams.toLocaleString('cs-CZ')} g celkem
                      </div>
                    </div>
                  </div>
                  <Badge variant="primary">{mat.count}× použito</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Odstiny */}
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Nejčastější odstíny</h2>
          {topOdstiny.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Zatím žádná data</p>
          ) : (
            <div className="space-y-3">
              {topOdstiny.map((odstin, idx) => (
                <div key={`${odstin.material}-${odstin.odstin}`} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{odstin.odstin}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {odstin.material} · {odstin.totalGrams.toLocaleString('cs-CZ')} g
                      </div>
                    </div>
                  </div>
                  <Badge variant="primary">{odstin.count}×</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Oxidants */}
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Nejpoužívanější oxidanty</h2>
          {topOxidants.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Zatím žádná data</p>
          ) : (
            <div className="space-y-3">
              {topOxidants.map((ox, idx) => (
                <div key={ox.procenta} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{ox.procenta}</div>
                  </div>
                  <Badge variant="primary">{ox.count}× použito</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Insights */}
        <Card padding="lg" className="bg-gradient-to-br from-amber-50 dark:from-amber-900/20 to-white dark:to-gray-800 border-amber-100 dark:border-amber-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            Zajímavosti
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Návštěv s materiály</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{totalVisits} návštěv používalo materiály</p>
              </div>
            </div>
            {topMaterials[0] && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Nejoblíbenější produkt</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {topMaterials[0].nazev} byl použit {topMaterials[0].count}× s celkem {topMaterials[0].totalGrams.toLocaleString('cs-CZ')} g
                  </p>
                </div>
              </div>
            )}
            {topOdstiny[0] && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Top odstín</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Odstín {topOdstiny[0].odstin} ({topOdstiny[0].material}) byl použit {topOdstiny[0].count}×
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
