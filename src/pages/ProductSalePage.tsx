import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getClients, getProducts, createProductSale, createVisit } from '@/lib/firestore';
import type { Klient, Produkt } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Badge from '@/components/Badge';

interface SaleItem {
  tempId: string;
  produkt_id: string | null;
  pocet_ks: number | string;
  cena_za_ks: number | string;
}

function createUid() {
  let id = 0;
  return () => String(++id);
}

export default function ProductSalePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Klient[]>([]);
  const [products, setProducts] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [selectedClientIndex, setSelectedClientIndex] = useState(0);
  const [productSearches, setProductSearches] = useState<{[key: string]: string}>({});
  const uidRef = useState(createUid)[0];
  const uid = uidRef;
  const productsEndRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    klient_id: null as string | null,
    klient_typ: 'walk-in' as 'walk-in' | 'registered',
    walk_in_name: '',
    datum: new Date().toISOString().slice(0, 10),
    poznamka: '',
    platebni_metoda: 'hotovost' as 'hotovost' | 'qr',
    produkty: [{ tempId: uid(), produkt_id: null, pocet_ks: 1, cena_za_ks: '' }] as SaleItem[],
  });

  const selectedClient = clients.find(c => c.id === form.klient_id);

  const filteredClients = clientSearch.trim()
    ? clients.filter(c => 
        `${c.jmeno} ${c.prijmeni}`.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.telefon?.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : [];

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedClientIndex(0);
  }, [clientSearch]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const [clientsData, productsData] = await Promise.all([
          getClients(user.uid),
          getProducts(user.uid),
        ]);
        setClients(clientsData as Klient[]);
        setProducts(productsData as Produkt[]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const calculateTotal = () => {
    return form.produkty.reduce((sum, p) => {
      const ks = typeof p.pocet_ks === 'string' ? parseInt(p.pocet_ks) || 0 : p.pocet_ks;
      const cena = typeof p.cena_za_ks === 'string' ? parseFloat(p.cena_za_ks) || 0 : p.cena_za_ks;
      return sum + (ks * cena);
    }, 0);
  };

  const handleSave = async () => {
    if (!user) return;

    // Validation
    if (form.klient_typ === 'walk-in' && !form.walk_in_name.trim()) {
      toast.error('Zadejte jméno zákazníka');
      return;
    }

    const validProdukty = form.produkty.filter(p => p.produkt_id);
    if (validProdukty.length === 0) {
      toast.error('Přidejte alespoň jeden produkt');
      return;
    }

    setSaving(true);
    try {
      const totalAmount = calculateTotal();
      
      // Pro existujícího klienta vytvoříme návštěvu s produkty (bez úkonů)
      if (form.klient_typ === 'registered' && form.klient_id) {
        await createVisit(user.uid, {
          klient_id: form.klient_id,
          klient_jmeno: selectedClient?.jmeno,
          klient_prijmeni: selectedClient?.prijmeni,
          datum: form.datum,
          poznamka: form.poznamka,
          platebni_metoda: form.platebni_metoda,
          castka_sluzby: null,
          castka_produkty: totalAmount,
          celkova_castka: totalAmount,
          sluzby: [],
          produkty: validProdukty.map(p => ({
            produkt_id: p.produkt_id!,
            produkt_nazev: products.find(pr => pr.id === p.produkt_id)?.nazev || '',
            pocet_ks: typeof p.pocet_ks === 'string' ? parseInt(p.pocet_ks) : p.pocet_ks,
            cena_za_ks: typeof p.cena_za_ks === 'string' ? parseFloat(p.cena_za_ks) : p.cena_za_ks,
          })),
        });
      } else {
        // Pro walk-in zákazníka uložíme jen do prodejů
        await createProductSale(user.uid, {
          klient_id: null,
          klient_jmeno: form.walk_in_name,
          klient_prijmeni: '',
          datum: form.datum,
          poznamka: form.poznamka,
          platebni_metoda: form.platebni_metoda,
          produkty: validProdukty.map(p => ({
            produkt_id: p.produkt_id!,
            produkt_nazev: products.find(pr => pr.id === p.produkt_id)?.nazev || '',
            pocet_ks: typeof p.pocet_ks === 'string' ? parseInt(p.pocet_ks) : p.pocet_ks,
            cena_za_ks: typeof p.cena_za_ks === 'string' ? parseFloat(p.cena_za_ks) : p.cena_za_ks,
          })),
          celkova_castka: totalAmount,
        });
      }

      toast.success('Prodej uložen');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Prodej produktů</h1>

      {/* Client selection */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Zákazník</h2>
        
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => {
              setForm(f => ({ ...f, klient_typ: 'walk-in', klient_id: null }));
              setShowClientSearch(false);
            }}
            className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
              form.klient_typ === 'walk-in'
                ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="font-semibold">Bez evidence</div>
            <div className="text-xs mt-1 opacity-70">Zákazník není v databázi</div>
          </button>
          <button
            onClick={() => {
              setForm(f => ({ ...f, klient_typ: 'registered' }));
              setShowClientSearch(true);
            }}
            className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
              form.klient_typ === 'registered'
                ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="font-semibold">Existující klient</div>
            <div className="text-xs mt-1 opacity-70">Vybrat z databáze</div>
          </button>
        </div>

        {form.klient_typ === 'walk-in' ? (
          <Input
            label="Jméno zákazníka"
            value={form.walk_in_name}
            onChange={e => setForm(f => ({ ...f, walk_in_name: e.target.value }))}
            placeholder="Např. pan Novák"
            required
          />
        ) : (
          <div>
            {form.klient_id && selectedClient ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-base px-4 py-2">
                  {selectedClient.jmeno} {selectedClient.prijmeni}
                </Badge>
                <button
                  onClick={() => setForm(f => ({ ...f, klient_id: null }))}
                  className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:text-gray-300 underline"
                >
                  Změnit
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  placeholder="Hledat klienta..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  onKeyDown={e => {
                    if (filteredClients.length === 0) return;
                    
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedClientIndex(prev => 
                        prev < filteredClients.length - 1 ? prev + 1 : prev
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedClientIndex(prev => prev > 0 ? prev - 1 : 0);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const selectedClient = filteredClients[selectedClientIndex];
                      if (selectedClient) {
                        setForm(f => ({ ...f, klient_id: selectedClient.id }));
                        setClientSearch('');
                      }
                    } else if (e.key === 'Escape') {
                      setClientSearch('');
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all"
                  autoFocus
                />
                {filteredClients.length > 0 && (
                  <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {filteredClients.map((c, idx) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setForm(f => ({ ...f, klient_id: c.id }));
                          setClientSearch('');
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 ${
                          idx === selectedClientIndex
                            ? 'bg-accent-100 dark:bg-accent-900/30'
                            : 'hover:bg-accent-50 dark:hover:bg-accent-900/20'
                        }`}
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{c.jmeno} {c.prijmeni}</span>
                        {c.telefon && <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">• {c.telefon}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Date */}
      <Card className="mb-6">
        <Input
          type="date"
          label="Datum prodeje"
          value={form.datum}
          onChange={e => setForm(f => ({ ...f, datum: e.target.value }))}
          required
        />
      </Card>

      {/* Products */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Produkty</h2>
        
        <div className="space-y-4">
          {form.produkty.map((item, idx) => {
            const produkt = item.produkt_id ? products.find(p => p.id === item.produkt_id) : null;
            return (
              <div key={item.tempId} className="p-4 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-lg">
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-2">Produkt</label>
                  
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="Hledat produkt..."
                    value={productSearches[item.tempId] || ''}
                    onChange={e => setProductSearches({ ...productSearches, [item.tempId]: e.target.value })}
                    className="w-full px-3 py-2 mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  {/* Filtered products */}
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {productSearches[item.tempId]?.trim() && products
                      .filter(p => {
                        const search = productSearches[item.tempId]?.toLowerCase() || '';
                        return p.nazev.toLowerCase().includes(search);
                      })
                      .slice(0, 20)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            const newProdukty = [...form.produkty];
                            newProdukty[idx] = { ...item, produkt_id: p.id, cena_za_ks: p.cena };
                            setForm(f => ({ ...f, produkty: newProdukty }));
                            // Clear search after selection
                            setProductSearches({ ...productSearches, [item.tempId]: '' });
                          }}
                          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                            item.produkt_id === p.id
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 text-gray-700 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-500'
                          }`}
                        >
                          {p.nazev}
                          <span className="ml-1.5 text-xs opacity-70">{p.cena} Kč</span>
                        </button>
                      ))}
                    {productSearches[item.tempId]?.trim() && products.filter(p => {
                      const search = productSearches[item.tempId]?.toLowerCase() || '';
                      return p.nazev.toLowerCase().includes(search);
                    }).length > 20 && (
                      <div className="w-full text-center text-xs text-gray-500 dark:text-gray-400 py-2">
                        ... a další {products.filter(p => {
                          const search = productSearches[item.tempId]?.toLowerCase() || '';
                          return p.nazev.toLowerCase().includes(search);
                        }).length - 20} produktů (upřesněte hledání)
                      </div>
                    )}
                    {!productSearches[item.tempId]?.trim() && !item.produkt_id && (
                      <div className="w-full text-center text-sm text-gray-400 dark:text-gray-500 py-4">
                        👆 Začněte psát název produktu...
                      </div>
                    )}
                    {item.produkt_id && produkt && (
                      <div className="w-full">
                        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white">
                          ✓ {produkt.nazev}
                          <span className="text-xs opacity-70">{produkt.cena} Kč</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {produkt && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      label="Počet kusů"
                      value={item.pocet_ks}
                      onChange={e => {
                        const newProdukty = [...form.produkty];
                        newProdukty[idx] = { ...item, pocet_ks: e.target.value };
                        setForm(f => ({ ...f, produkty: newProdukty }));
                      }}
                      min={1}
                    />
                    <Input
                      type="number"
                      label="Cena za kus (Kč)"
                      value={item.cena_za_ks}
                      onChange={e => {
                        const newProdukty = [...form.produkty];
                        newProdukty[idx] = { ...item, cena_za_ks: e.target.value };
                        setForm(f => ({ ...f, produkty: newProdukty }));
                      }}
                    />
                  </div>
                )}

                {form.produkty.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm(f => ({ ...f, produkty: f.produkty.filter((_, i) => i !== idx) }))}
                    className="mt-3 text-red-500"
                  >
                    Odebrat produkt
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setForm(f => ({ ...f, produkty: [...f.produkty, { tempId: uid(), produkt_id: null, pocet_ks: 1, cena_za_ks: '' }] }));
            setTimeout(() => {
              productsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
          }}
          className="mt-4 text-emerald-600"
        >
          + Přidat produkt
        </Button>
        <div ref={productsEndRef} />
      </Card>

      {/* Note */}
      <Card className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Poznámka</label>
        <textarea
          value={form.poznamka}
          onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))}
          rows={2}
          placeholder="Poznámka k prodeji..."
          className="w-full px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
        />
      </Card>

      {/* Total */}
      <Card className="mb-6 bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-white dark:to-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Celková částka</span>
          <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            {calculateTotal().toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      </Card>

      {/* Platební metoda */}
      <Card className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Způsob platby
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="platebni_metoda"
              value="hotovost"
              checked={form.platebni_metoda === 'hotovost'}
              onChange={e => setForm(f => ({ ...f, platebni_metoda: e.target.value as 'hotovost' | 'qr' }))}
              className="w-4 h-4 text-accent-600 focus:ring-accent-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">💵 Hotovost</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="platebni_metoda"
              value="qr"
              checked={form.platebni_metoda === 'qr'}
              onChange={e => setForm(f => ({ ...f, platebni_metoda: e.target.value as 'hotovost' | 'qr' }))}
              className="w-4 h-4 text-accent-600 focus:ring-accent-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">📱 QR kód</span>
          </label>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate('/')}>
          Zrušit
        </Button>
        <Button onClick={handleSave} isLoading={saving} className="flex-1">
          Uložit prodej
        </Button>
      </div>
    </div>
  );
}
