import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getVisits, getProdeje } from '@/lib/firestore';
import type { Navsteva, Prodej } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import Card from '@/components/Card';
import Button from '@/components/Button';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlyRevenue {
  month: string;
  year: number;
  sluzby: number;
  produkty: number;
  celkem: number;
}

interface YearlyRevenue {
  year: number;
  sluzby: number;
  produkty: number;
  celkem: number;
}

type TabType = 'prehled' | 'roky' | 'statistiky' | 'export';

export default function TrzbyPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyRevenue[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<TabType>('prehled');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [visits, sales] = await Promise.all([
        getVisits(user.uid),
        getProdeje(user.uid),
      ]);

      // Prepare data structures
      const monthlyMap = new Map<string, MonthlyRevenue>();
      const yearlyMap = new Map<number, YearlyRevenue>();

      // Process visits
      (visits as Navsteva[]).forEach(visit => {
        const date = new Date(visit.datum);
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${month}`;

        // Monthly data
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            month: date.toLocaleDateString('cs-CZ', { month: 'long' }),
            year,
            sluzby: 0,
            produkty: 0,
            celkem: 0,
          });
        }
        const monthData = monthlyMap.get(monthKey)!;
        monthData.sluzby += visit.castka_sluzby || 0;
        monthData.produkty += visit.castka_produkty || 0;
        monthData.celkem += visit.celkova_castka || 0;

        // Yearly data
        if (!yearlyMap.has(year)) {
          yearlyMap.set(year, { year, sluzby: 0, produkty: 0, celkem: 0 });
        }
        const yearData = yearlyMap.get(year)!;
        yearData.sluzby += visit.castka_sluzby || 0;
        yearData.produkty += visit.castka_produkty || 0;
        yearData.celkem += visit.celkova_castka || 0;
      });

      // Process standalone sales (cizí zákazníci)
      (sales as Prodej[]).forEach(sale => {
        const date = new Date(sale.datum);
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${month}`;

        // Monthly data
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            month: date.toLocaleDateString('cs-CZ', { month: 'long' }),
            year,
            sluzby: 0,
            produkty: 0,
            celkem: 0,
          });
        }
        const monthData = monthlyMap.get(monthKey)!;
        monthData.produkty += sale.celkova_castka || 0;
        monthData.celkem += sale.celkova_castka || 0;

        // Yearly data
        if (!yearlyMap.has(year)) {
          yearlyMap.set(year, { year, sluzby: 0, produkty: 0, celkem: 0 });
        }
        const yearData = yearlyMap.get(year)!;
        yearData.produkty += sale.celkova_castka || 0;
        yearData.celkem += sale.celkova_castka || 0;
      });

      // Convert to arrays and sort
      const monthlyArray = Array.from(monthlyMap.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return new Date(`${a.month} 1, ${a.year}`).getMonth() - new Date(`${b.month} 1, ${b.year}`).getMonth();
      });

      const yearlyArray = Array.from(yearlyMap.values()).sort((a, b) => b.year - a.year);

      setMonthlyData(monthlyArray);
      setYearlyData(yearlyArray);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const exportToExcel = () => {
    if (!currentYearData) return;

    // Prepare monthly data sorted by month number
    const monthNames = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
    const monthDataMap = new Map<number, MonthlyRevenue>();
    
    filteredMonthly.forEach(m => {
      const monthIndex = monthNames.findIndex(name => name === m.month.toLowerCase());
      if (monthIndex !== -1) {
        monthDataMap.set(monthIndex, m);
      }
    });

    const exportData: any[] = [
      { 'Měsíc': `Tržby ${selectedYear}`, 'Služby (Kč)': '', 'Produkty (Kč)': '', 'Celkem (Kč)': '' },
      {},
    ];

    // Add monthly breakdown
    for (let i = 0; i < 12; i++) {
      const monthData = monthDataMap.get(i);
      const monthName = monthNames[i].charAt(0).toUpperCase() + monthNames[i].slice(1);
      
      exportData.push({
        'Měsíc': monthName,
        'Služby (Kč)': monthData?.sluzby || 0,
        'Produkty (Kč)': monthData?.produkty || 0,
        'Celkem (Kč)': monthData?.celkem || 0,
      });
    }

    // Add totals at the bottom
    exportData.push({});
    exportData.push({
      'Měsíc': 'CELKEM ZA SLUŽBY',
      'Služby (Kč)': currentYearData.sluzby,
      'Produkty (Kč)': '',
      'Celkem (Kč)': '',
    });
    exportData.push({
      'Měsíc': 'CELKEM ZA PRODUKTY',
      'Služby (Kč)': '',
      'Produkty (Kč)': currentYearData.produkty,
      'Celkem (Kč)': '',
    });
    exportData.push({
      'Měsíc': 'CELKEM ZA VŠE',
      'Služby (Kč)': '',
      'Produkty (Kč)': '',
      'Celkem (Kč)': currentYearData.celkem,
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData, { skipHeader: false });

    // Set column widths
    ws['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, `Tržby ${selectedYear}`);
    XLSX.writeFile(wb, `trzby_${selectedYear}.xlsx`);
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  const filteredMonthly = monthlyData.filter(m => m.year === selectedYear);
  const currentYearData = yearlyData.find(y => y.year === selectedYear);

  // Prepare chart data (all 12 months)
  const chartData = [];
  const monthNames = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  
  // Create a map for easier lookup
  const monthDataMap = new Map<number, MonthlyRevenue>();
  filteredMonthly.forEach(m => {
    const monthKey = `${m.year}-${m.month}`;
    const date = new Date(selectedYear, 0, 1);
    for (let i = 0; i < 12; i++) {
      date.setMonth(i);
      const monthName = date.toLocaleDateString('cs-CZ', { month: 'long' });
      if (monthName === m.month) {
        monthDataMap.set(i, m);
        break;
      }
    }
  });
  
  for (let i = 0; i < 12; i++) {
    const monthData = monthDataMap.get(i);
    chartData.push({
      mesic: monthNames[i].charAt(0).toUpperCase() + monthNames[i].slice(1),
      Služby: monthData?.sluzby || 0,
      Produkty: monthData?.produkty || 0,
    });
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pokladní deník</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('prehled')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-all border-b-2 ${
            activeTab === 'prehled'
              ? 'border-accent-600 text-accent-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ChartBarIcon className="w-4 h-4" />
          Přehled
        </button>
        <button
          onClick={() => setActiveTab('roky')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-all border-b-2 ${
            activeTab === 'roky'
              ? 'border-accent-600 text-accent-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Roční porovnání
        </button>
        <button
          onClick={() => setActiveTab('statistiky')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-all border-b-2 ${
            activeTab === 'statistiky'
              ? 'border-accent-600 text-accent-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ChartLineIcon className="w-4 h-4" />
          Statistiky
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-4 py-2 font-medium transition-all border-b-2 ${
            activeTab === 'export'
              ? 'border-accent-600 text-accent-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <DocumentIcon className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'prehled' && (
        <>
          {/* Year selector */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {yearlyData.map(y => (
              <button
                key={y.year}
                onClick={() => setSelectedYear(y.year)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedYear === y.year
                    ? 'bg-accent-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-accent-300'
                }`}
              >
                {y.year}
              </button>
            ))}
          </div>

          {/* Yearly summary */}
          {currentYearData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-white dark:to-gray-800 border-blue-100">
                <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Služby {selectedYear}</div>
                <div className="text-3xl font-bold text-blue-700">
                  {currentYearData.sluzby.toLocaleString('cs-CZ')} Kč
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-white dark:to-gray-800 border-emerald-100">
                <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Produkty {selectedYear}</div>
                <div className="text-3xl font-bold text-emerald-700">
                  {currentYearData.produkty.toLocaleString('cs-CZ')} Kč
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 dark:from-purple-900/20 to-white dark:to-gray-800 border-purple-100">
                <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Celkem {selectedYear}</div>
                <div className="text-3xl font-bold text-purple-700">
                  {currentYearData.celkem.toLocaleString('cs-CZ')} Kč
                </div>
              </Card>
            </div>
          )}

          {/* Chart */}
          {currentYearData && (
            <Card className="mb-8 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Graf tržeb {selectedYear}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mesic" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => `${value.toLocaleString('cs-CZ')} Kč`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="Služby" fill="#3b82f6" />
                  <Bar dataKey="Produkty" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Monthly breakdown */}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Měsíční přehled {selectedYear}</h2>
          
          {filteredMonthly.length === 0 ? (
            <Card>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-8">Žádné tržby v roce {selectedYear}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredMonthly.map((data, idx) => (
                <Card key={`${data.year}-${data.month}`} hover padding="md" className="animate-slide-in" style={{ animationDelay: `${idx * 30}ms` }}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{data.month}</h3>
                      <div className="flex gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Služby:</span>{' '}
                          <span className="font-semibold text-blue-600">{data.sluzby.toLocaleString('cs-CZ')} Kč</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Produkty:</span>{' '}
                          <span className="font-semibold text-emerald-600">{data.produkty.toLocaleString('cs-CZ')} Kč</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Celkem</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {data.celkem.toLocaleString('cs-CZ')} Kč
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'roky' && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Porovnání všech let</h2>
          {yearlyData.length === 0 ? (
            <Card>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-8">Zatím nejsou žádné tržby</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {yearlyData.map((data, idx) => (
                <Card key={data.year} hover padding="md" className="animate-slide-in" style={{ animationDelay: `${idx * 30}ms` }}>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-xl">{data.year}</h3>
                      <div className="flex gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Služby:</span>{' '}
                          <span className="font-semibold text-blue-600">{data.sluzby.toLocaleString('cs-CZ')} Kč</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Produkty:</span>{' '}
                          <span className="font-semibold text-emerald-600">{data.produkty.toLocaleString('cs-CZ')} Kč</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Celkem</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {data.celkem.toLocaleString('cs-CZ')} Kč
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'statistiky' && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Statistiky a analýzy</h2>
          
          {!currentYearData ? (
            <Card>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-8">Nejsou žádná data pro statistiky</p>
            </Card>
          ) : (
            <>
              {/* Year selector */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {yearlyData.map(y => (
                  <button
                    key={y.year}
                    onClick={() => setSelectedYear(y.year)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedYear === y.year
                        ? 'bg-accent-600 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-700 hover:border-accent-300'
                    }`}
                  >
                    {y.year}
                  </button>
                ))}
              </div>

              {/* Statistics cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Average monthly */}
                <Card className="p-6">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-2">Průměrné měsíční tržby</h3>
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {Math.round(currentYearData.celkem / 12).toLocaleString('cs-CZ')} Kč
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                    {Math.round(currentYearData.celkem / 12 / 30).toLocaleString('cs-CZ')} Kč / den
                  </p>
                </Card>

                {/* Service vs Product ratio */}
                <Card className="p-6">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-2">Poměr služby / produkty</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-2xl font-bold text-blue-600">
                        {currentYearData.celkem > 0 ? Math.round((currentYearData.sluzby / currentYearData.celkem) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Služby</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-2xl font-bold text-emerald-600">
                        {currentYearData.celkem > 0 ? Math.round((currentYearData.produkty / currentYearData.celkem) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Produkty</div>
                    </div>
                  </div>
                </Card>

                {/* Best month */}
                {filteredMonthly.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-2">Nejlepší měsíc</h3>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                      {filteredMonthly.reduce((best, current) => 
                        current.celkem > best.celkem ? current : best
                      ).month}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                      {filteredMonthly.reduce((best, current) => 
                        current.celkem > best.celkem ? current : best
                      ).celkem.toLocaleString('cs-CZ')} Kč
                    </p>
                  </Card>
                )}

                {/* Year over year growth */}
                {(() => {
                  const previousYear = yearlyData.find(y => y.year === selectedYear - 1);
                  if (previousYear) {
                    const growth = ((currentYearData.celkem - previousYear.celkem) / previousYear.celkem) * 100;
                    return (
                      <Card className="p-6">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-2">Meziroční růst</h3>
                        <div className={`text-3xl font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                          vs {selectedYear - 1} ({previousYear.celkem.toLocaleString('cs-CZ')} Kč)
                        </p>
                      </Card>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Monthly breakdown chart */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Měsíční vývoj {selectedYear}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mesic" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => `${value.toLocaleString('cs-CZ')} Kč`}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="Služby" fill="#3b82f6" stackId="a" />
                    <Bar dataKey="Produkty" fill="#10b981" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </>
      )}

      {activeTab === 'export' && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Export dat</h2>
          
          {/* Year selector for export */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {yearlyData.map(y => (
              <button
                key={y.year}
                onClick={() => setSelectedYear(y.year)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedYear === y.year
                    ? 'bg-accent-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-accent-300'
                }`}
              >
                {y.year}
              </button>
            ))}
          </div>

          {currentYearData ? (
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Export roku {selectedYear}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">
                  Exportovat měsíční přehled tržeb do Excel souboru pro účetnictví
                </p>
                <Button onClick={exportToExcel} variant="primary">
                  <DocumentIcon className="w-4 h-4 inline mr-2" />
                  Stáhnout Excel ({selectedYear})
                </Button>
              </Card>

              <Card className="p-6 bg-gray-50">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Náhled exportu</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Služby</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {currentYearData.sluzby.toLocaleString('cs-CZ')} Kč
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <div className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Produkty</div>
                    <div className="text-2xl font-bold text-emerald-700">
                      {currentYearData.produkty.toLocaleString('cs-CZ')} Kč
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <div className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Celkem</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {currentYearData.celkem.toLocaleString('cs-CZ')} Kč
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-8">Nejsou žádná data pro export</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
// Icon components
function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function ChartLineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}