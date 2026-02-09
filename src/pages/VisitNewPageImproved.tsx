import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { 
  getClients, 
  getMaterials, 
  getProducts, 
  createVisit, 
  getVisit,
  getOxidants,
  getUkony,
  createClient
} from '@/lib/firestore';
import type {
  Klient,
  Material,
  Produkt,
  NavstevaForm,
  SluzbaForm,
  MiskaForm,
  MaterialVMisceForm,
  ProdejProduktuForm,
  NavstevaFull,
  Ukon,
} from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import Card from '@/components/Card';
import Input from '@/components/Input';
import { useSetBreadcrumbs } from '@/lib/breadcrumbs';

function createUid() {
  let id = 0;
  return () => String(++id);
}

function makeEmpty(uid: () => string) {
  return {
    material: (): MaterialVMisceForm => ({
      tempId: uid(), material_id: null, odstin_cislo: '', gramy_materialu: '',
    }),
    miska: (): MiskaForm => ({
      tempId: uid(), oxidant_id: null, gramy_oxidantu: 0, materialy: [makeEmpty(uid).material()],
    }),
    sluzba: (): SluzbaForm => ({
      tempId: uid(), nazev: '', misky: [makeEmpty(uid).miska()],
    }),
  };
}

export default function VisitNewPageImproved() {
  const { clientId, id: copyId } = useParams<{ clientId?: string; id?: string }>();
  const location = useLocation();
  const isCopy = location.pathname.endsWith('/copy');
  const navigate = useNavigate();
  const { user } = useAuth();
  const uidRef = useRef(createUid());
  const uid = uidRef.current;
  const empty = useMemo(() => makeEmpty(uid), [uid]);

  // Refs for auto-scroll
  const sluzbyRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const miskyRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const materialyRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const produktyRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [clients, setClients] = useState<Klient[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [produktyCatalog, setProduktyCatalog] = useState<Produkt[]>([]);
  const [ukony, setUkony] = useState<Ukon[]>([]);
  const [oxidants, setOxidants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [productSearches, setProductSearches] = useState<{[key: string]: string}>({});
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ jmeno: '', prijmeni: '', telefon: '', alergie: '' });

  const [form, setForm] = useState<NavstevaForm>({
    klient_id: clientId || null,
    datum: new Date().toISOString().slice(0, 10),
    celkova_castka: '',
    poznamka: '',
    sluzby: [],
    produkty: [],
  });

  // Auto-scroll helper
  const scrollToElement = (tempId: string, refMap: React.MutableRefObject<Map<string, HTMLDivElement>>) => {
    setTimeout(() => {
      const element = refMap.current.get(tempId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  const selectedClient = clients.find(c => c.id === form.klient_id);
  const breadcrumbs = useMemo(() => {
    const items: { label: string; to?: string }[] = [{ label: 'Klienti', to: '/clients' }];
    if (selectedClient) {
      items.push({ label: `${selectedClient.jmeno} ${selectedClient.prijmeni}`, to: `/clients/${selectedClient.id}` });
    }
    items.push({ label: isCopy ? 'Kopie receptury' : 'Nová návštěva' });
    return items;
  }, [selectedClient, isCopy]);
  useSetBreadcrumbs(breadcrumbs);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to go back to editing from summary
      if (e.key === 'Escape' && showSummary) {
        setShowSummary(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSummary]);

  const loadBase = useCallback(async () => {
    if (!user) return;
    try {
      const [cls, mats, oxs, uks] = await Promise.all([
        getClients(user.uid),
        getMaterials(user.uid),
        getOxidants(user.uid),
        getUkony(user.uid),
      ]);
      setClients(cls as Klient[]);
      
      // Store oxidants
      const activeOxidants = (oxs as any[]).filter(ox => ox.aktivni);
      setOxidants(activeOxidants);
      
      // Merge oxidants into materials
      const oxidantsMap = new Map(activeOxidants.map(ox => [ox.id, ox]));
      const activeMats = (mats as Material[]).filter(m => m.aktivni).map(m => ({
        ...m,
        oxidanty: (m.oxidant_ids || []).map((oxId: string) => oxidantsMap.get(oxId)).filter(Boolean)
      }));
      console.log('Loaded materials with ratios:', activeMats.map(m => ({ 
        nazev: m.nazev, 
        michaci_pomery: m.michaci_pomery 
      })));
      setMaterials(activeMats);
      
      const activeUkony = (uks as Ukon[]).filter(u => u.aktivni);
      setUkony(activeUkony);
      
      try {
        const prods = await getProducts(user.uid);
        const activeProds = (prods as Produkt[]).filter(p => p.aktivni);
        setProduktyCatalog(activeProds);
      } catch {
        // Products catalog may not be available yet
      }

      // If no ukony exist and not copying, add default empty service
      if (activeUkony.length === 0 && !isCopy && !copyId) {
        setForm(f => f.sluzby.length === 0 ? { ...f, sluzby: [empty.sluzba()] } : f);
      }

      // If copying from existing visit
      if (isCopy && copyId) {
        try {
          const visit = await getVisit(user.uid, copyId) as NavstevaFull;
          setForm({
            klient_id: visit.klient_id,
            datum: new Date().toISOString().slice(0, 10),
            celkova_castka: '',
            poznamka: '',
            sluzby: visit.sluzby.map(s => ({
              tempId: uid(),
              nazev: s.nazev,
              misky: (s.misky || []).map(m => ({
                tempId: uid(),
                oxidant_id: m.oxidant_id,
                gramy_oxidantu: m.gramy_oxidantu,
                materialy: (m.materialy || []).map(mat => ({
                  tempId: uid(),
                  material_id: mat.material_id,
                  odstin_cislo: mat.odstin_cislo || '',
                  gramy_materialu: mat.gramy_materialu,
                })),
              })),
            })),
            produkty: (visit.produkty || []).map(p => ({
              tempId: uid(),
              produkt_id: p.produkt_id,
              pocet_ks: p.pocet_ks,
              cena_za_ks: p.cena_za_ks,
            })),
          });
        } catch {
          toast.error('Nepodařilo se načíst recepturu ke kopírování');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [copyId, isCopy, uid, user]);

  useEffect(() => { loadBase(); }, [loadBase]);

  // Material lookup map
  const materialMap = useMemo(() => {
    const map = new Map<string, Material>();
    materials.forEach(m => map.set(m.id, m));
    return map;
  }, [materials]);

  const produktMap = useMemo(() => {
    const map = new Map<string, Produkt>();
    produktyCatalog.forEach(p => map.set(p.id, p));
    return map;
  }, [produktyCatalog]);

  const oxidantsMap = useMemo(() => {
    const map = new Map<string, any>();
    oxidants.forEach(ox => map.set(ox.id, ox));
    return map;
  }, [oxidants]);

  // Auto-calculate oxidant grams for entire bowl based on all materials
  const calcOxidantForBowl = (miska: MiskaForm): number => {
    let totalMaterialGrams = 0;
    let totalOxidantNeeded = 0;
    
    for (const mat of miska.materialy) {
      if (!mat.material_id || !mat.gramy_materialu) continue;
      const material = materialMap.get(mat.material_id);
      if (!material) continue;
      const grams = typeof mat.gramy_materialu === 'string' ? parseFloat(mat.gramy_materialu) : mat.gramy_materialu;
      if (isNaN(grams) || grams <= 0) continue;
      
      // Use the selected ratio from the form, or fall back to material's default ratio
      const ratioMaterial = mat.material_michaci_pomer_material || material.michaci_pomer_material || 1;
      const ratioOxidant = mat.material_michaci_pomer_oxidant || material.michaci_pomer_oxidant || 1;
      
      totalMaterialGrams += grams;
      totalOxidantNeeded += (grams * ratioOxidant / ratioMaterial);
    }
    
    return totalMaterialGrams > 0 ? Math.round(totalOxidantNeeded * 10) / 10 : 0;
  };

  const updateSluzba = (sIdx: number, update: Partial<SluzbaForm>) => {
    setForm(f => ({
      ...f,
      sluzby: f.sluzby.map((s, i) => (i === sIdx ? { ...s, ...update } : s)),
    }));
  };

  const updateMiska = (sIdx: number, mIdx: number, update: Partial<MiskaForm>) => {
    setForm(f => ({
      ...f,
      sluzby: f.sluzby.map((s, si) =>
        si === sIdx
          ? { 
              ...s, 
              misky: s.misky.map((m, mi) => {
                if (mi !== mIdx) return m;
                const updated = { ...m, ...update };
                // Auto-recalc oxidant if materials or oxidant_id changed
                if ('materialy' in update || !('oxidant_id' in update)) {
                  updated.gramy_oxidantu = calcOxidantForBowl(updated);
                }
                return updated;
              })
            }
          : s
      ),
    }));
  };

  const updateMaterial = (sIdx: number, mIdx: number, matIdx: number, update: Partial<MaterialVMisceForm>) => {
    setForm(f => ({
      ...f,
      sluzby: f.sluzby.map((s, si) =>
        si === sIdx
          ? {
              ...s,
              misky: s.misky.map((m, mi) => {
                if (mi !== mIdx) return m;
                const updatedMiska = {
                  ...m,
                  materialy: m.materialy.map((mat, mati) => {
                    if (mati !== matIdx) return mat;
                    const updated = { ...mat, ...update };
                    // Clear odstin if material changed
                    if ('material_id' in update) {
                      updated.odstin_cislo = '';
                    }
                    return updated;
                  }),
                };
                // Recalculate oxidant for entire bowl
                updatedMiska.gramy_oxidantu = calcOxidantForBowl(updatedMiska);
                return updatedMiska;
              }),
            }
          : s
      ),
    }));
  };

  // Validation
  const validate = (): string | null => {
    if (!form.klient_id) return 'Vyberte klienta';
    if (!form.datum) return 'Zadejte datum';
    if (form.sluzby.length === 0) return 'Přidejte alespoň jednu službu';

    for (const s of form.sluzby) {
      if (!s.nazev.trim()) return 'Vyplňte název každé služby';
      for (const m of s.misky) {
        // Check materials
        for (const mat of m.materialy) {
          if (!mat.material_id) return 'Vyberte materiál pro každý řádek';
          const grams = typeof mat.gramy_materialu === 'string' ? parseFloat(mat.gramy_materialu) : mat.gramy_materialu;
          if (!grams || grams <= 0) return 'Zadejte gramáž materiálu';
        }
        // Check oxidant for bowl
        if (m.materialy.length > 0 && !m.oxidant_id) return 'Vyberte oxidant pro každou misku';
      }
    }
    return null;
  };

  const handleShowSummary = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setShowSummary(true);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Musíte být přihlášeni');
      return;
    }
    setSaving(true);
    try {
      // Vypočítat částku za produkty
      const castkaProduktov = form.produkty
        .filter(p => p.produkt_id)
        .reduce((sum, p) => {
          const ks = typeof p.pocet_ks === 'string' ? parseInt(p.pocet_ks) || 1 : p.pocet_ks;
          const cena = typeof p.cena_za_ks === 'string' ? parseFloat(p.cena_za_ks) || 0 : p.cena_za_ks;
          return sum + (ks * cena);
        }, 0);
      
      // Částka za služby (zadaná uživatelem)
      const castkaSluzeb = form.celkova_castka ? Number(form.celkova_castka) : null;
      
      // Celková částka = služby + produkty
      const celkovaCastka = (castkaSluzeb || 0) + castkaProduktov;
      
      const payload = {
        ...form,
        klient_jmeno: selectedClient?.jmeno || '',
        klient_prijmeni: selectedClient?.prijmeni || '',
        castka_sluzby: castkaSluzeb,
        castka_produkty: castkaProduktov > 0 ? castkaProduktov : null,
        celkova_castka: celkovaCastka > 0 ? celkovaCastka : null,
        sluzby: form.sluzby.map(s => ({
          nazev: s.nazev,
          misky: s.misky.map(m => {
            const oxidant = oxidantsMap.get(m.oxidant_id!);
            return {
              oxidant_id: m.oxidant_id,
              gramy_oxidantu: m.gramy_oxidantu,
              materialy: m.materialy.map(mat => {
                const material = materialMap.get(mat.material_id!);
                return {
                  material_id: mat.material_id,
                  material_nazev: material?.nazev || '',
                  material_michaci_pomer_material: mat.material_michaci_pomer_material || material?.michaci_pomer_material || 1,
                  material_michaci_pomer_oxidant: mat.material_michaci_pomer_oxidant || material?.michaci_pomer_oxidant || 1,
                  odstin_cislo: mat.odstin_cislo,
                  gramy_materialu: typeof mat.gramy_materialu === 'string' ? parseFloat(mat.gramy_materialu) : mat.gramy_materialu,
                };
              }),
            };
          }),
        })),
        produkty: form.produkty
          .filter(p => p.produkt_id)
          .map(p => {
            const produkt = produktMap.get(p.produkt_id!);
            return {
              produkt_id: p.produkt_id,
              produkt_nazev: produkt?.nazev || '',
              pocet_ks: typeof p.pocet_ks === 'string' ? parseInt(p.pocet_ks) || 1 : p.pocet_ks,
              cena_za_ks: typeof p.cena_za_ks === 'string' ? parseFloat(p.cena_za_ks) || 0 : p.cena_za_ks,
            };
          }),
      };
      const visitId = await createVisit(user.uid, payload);
      toast.success('Návštěva uložena');
      navigate(`/visits/${visitId}`);
    } catch (err: any) {
      toast.error(err.message || 'Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = clientSearch.trim()
    ? clients.filter(c =>
        `${c.jmeno} ${c.prijmeni}`.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : [];

  if (loading) return <LoadingSpinner className="py-20" />;

  // Summary modal
  if (showSummary) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Souhrn návštěvy</h1>

        <Card className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Klient</span>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {selectedClient ? `${selectedClient.jmeno} ${selectedClient.prijmeni}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Datum</span>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{new Date(form.datum).toLocaleDateString('cs-CZ')}</p>
            </div>
          </div>

          {form.sluzby.map((sluzba, sIdx) => (
            <div key={sluzba.tempId} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="service">{sIdx + 1}</Badge>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sluzba.nazev}</h3>
              </div>
              {sluzba.misky.map((miska, mIdx) => (
                <div key={miska.tempId} className="ml-6 mb-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">Miska {mIdx + 1}:</p>
                  <div className="space-y-1.5">
                    {miska.materialy.map(mat => {
                      const material = mat.material_id ? materialMap.get(mat.material_id) : null;
                      if (!material) return null;
                      const ratioMaterial = mat.material_michaci_pomer_material || material.michaci_pomer_material || 1;
                      const ratioOxidant = mat.material_michaci_pomer_oxidant || material.michaci_pomer_oxidant || 1;
                      return (
                        <div key={mat.tempId} className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="material">{material.nazev}</Badge>
                          {mat.odstin_cislo && (
                            <span className="font-medium text-gray-700 dark:text-gray-300">{mat.odstin_cislo}</span>
                          )}
                          <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">{mat.gramy_materialu}g</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            ({ratioMaterial}:{ratioOxidant})
                          </span>
                        </div>
                      );
                    })}
                    {/* Oxidant for the bowl */}
                    {miska.oxidant_id && miska.gramy_oxidantu > 0 && (
                      <div className="flex items-center gap-2 text-sm flex-wrap mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">Oxidant:</span>
                        <Badge variant="oxidant">
                          {oxidantsMap.get(miska.oxidant_id)?.nazev ?? '?'}
                        </Badge>
                        <span className="font-bold text-amber-900 dark:text-amber-200">{miska.gramy_oxidantu}g</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {form.produkty.filter(p => p.produkt_id).length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Prodané produkty</h3>
              <div className="space-y-1.5">
                {form.produkty
                  .filter(p => p.produkt_id)
                  .map(p => {
                    const produkt = p.produkt_id ? produktMap.get(p.produkt_id) : null;
                    const ks = typeof p.pocet_ks === 'string' ? parseInt(p.pocet_ks) : p.pocet_ks;
                    const cena = typeof p.cena_za_ks === 'string' ? parseFloat(p.cena_za_ks) : p.cena_za_ks;
                    return (
                      <div key={p.tempId} className="flex items-center gap-2 text-sm">
                        <Badge variant="product">{produkt?.nazev ?? '?'}</Badge>
                        <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">
                          {ks || 0} ks × {cena || 0} Kč = {((ks || 0) * (cena || 0)).toLocaleString('cs-CZ')} Kč
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Poznámka</label>
              <textarea
                value={form.poznamka}
                onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))}
                rows={2}
                placeholder="Poznámka k návštěvě..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none transition-colors dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <Input
              type="number"
              label="Celková částka (Kč)"
              value={form.celkova_castka}
              onChange={e => setForm(f => ({ ...f, celkova_castka: e.target.value }))}
              className="w-48"
              placeholder="Nepovinné"
            />
          </div>
        </Card>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowSummary(false)}>
            Vrátit se a upravit
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            Uložit návštěvu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {isCopy ? 'Nová návštěva (kopie receptury)' : 'Nová návštěva'}
      </h1>

      {/* Client selection */}
      <Card className="mb-6 animate-fade-in">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Klient a datum</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Klient *</label>
            {form.klient_id && selectedClient ? (
              <div>
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
                {selectedClient.alergie && (
                  <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <svg className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-red-900 dark:text-red-200">⚠️ Pozor - Alergie</div>
                      <div className="text-sm text-red-700 dark:text-red-300 mt-0.5">{selectedClient.alergie}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="relative">
                  <input
                    placeholder="Hledat klienta..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all dark:bg-gray-900 dark:text-gray-100"
                    autoFocus
                  />
                  {filteredClients.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto scrollbar-thin animate-slide-up">
                      {filteredClients.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setForm(f => ({ ...f, klient_id: c.id })); setClientSearch(''); }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                        >
                          <span className="font-medium text-gray-900 dark:text-gray-100">{c.jmeno} {c.prijmeni}</span>
                          {c.poznamka && <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-2 text-xs">• {c.poznamka}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* New client button and form */}
                {!showNewClient ? (
                  <button
                    onClick={() => setShowNewClient(true)}
                    className="mt-2 text-sm text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nový klient
                  </button>
                ) : (
                  <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 animate-slide-up">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Nový klient</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <input
                        placeholder="Jméno *"
                        value={newClientForm.jmeno}
                        onChange={e => setNewClientForm(f => ({ ...f, jmeno: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <input
                        placeholder="Příjmení *"
                        value={newClientForm.prijmeni}
                        onChange={e => setNewClientForm(f => ({ ...f, prijmeni: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <input
                      placeholder="Telefon"
                      value={newClientForm.telefon}
                      onChange={e => setNewClientForm(f => ({ ...f, telefon: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 dark:bg-gray-800 dark:text-gray-100 mb-3"
                    />
                    <textarea
                      placeholder="Alergie"
                      value={newClientForm.alergie}
                      onChange={e => setNewClientForm(f => ({ ...f, alergie: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-red-200 dark:border-red-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-gray-100 resize-none mb-3"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setShowNewClient(false); setNewClientForm({ jmeno: '', prijmeni: '', telefon: '', alergie: '' }); }}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Zrušit
                      </button>
                      <button
                        onClick={async () => {
                          if (!newClientForm.jmeno.trim() || !newClientForm.prijmeni.trim() || !user) {
                            toast.error('Jméno a příjmení jsou povinné');
                            return;
                          }
                          try {
                            const id = await createClient(user.uid, newClientForm);
                            toast.success('Klient vytvořen');
                            setForm(f => ({ ...f, klient_id: id }));
                            setShowNewClient(false);
                            setNewClientForm({ jmeno: '', prijmeni: '', telefon: '', alergie: '' });
                            // Reload clients
                            const data = await getClients(user.uid);
                            setClients(data as Klient[]);
                          } catch (err: any) {
                            toast.error(err.message || 'Chyba při vytváření klienta');
                          }
                        }}
                        className="px-3 py-1.5 text-sm bg-accent-600 text-white rounded-lg hover:bg-accent-700 font-medium"
                      >
                        Vytvořit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <Input
            type="date"
            label="Datum *"
            value={form.datum}
            onChange={e => setForm(f => ({ ...f, datum: e.target.value }))}
          />
        </div>
      </Card>

      {/* Úkony - quick add */}
      {ukony.length > 0 && (
        <Card className="mb-6 animate-fade-in">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Vyberte úkon</h2>
          <div className="flex flex-wrap gap-2">
            {ukony.map(ukon => (
              <button
                key={ukon.id}
                onClick={() => {
                  const pocetMisek = Math.max(0, ukon.pocet_misek || 0);
                  const newSluzba: SluzbaForm = {
                    tempId: uid(),
                    nazev: ukon.nazev,
                    misky: pocetMisek === 0 ? [] : Array.from({ length: pocetMisek }, () => empty.miska()),
                  };
                  setForm(f => ({ ...f, sluzby: [...f.sluzby, newSluzba] }));
                  scrollToElement(newSluzba.tempId, sluzbyRefs);
                  toast.success(`Přidán úkon: ${ukon.nazev}`);
                }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 border-2 border-accent-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-accent-500 dark:hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 hover:text-accent-700 dark:hover:text-accent-300 hover:scale-105 transition-all"
              >
                {ukon.nazev}
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  {ukon.pocet_misek === 0 
                    ? '(bez materiálu)' 
                    : `(${ukon.pocet_misek} ${ukon.pocet_misek === 1 ? 'miska' : ukon.pocet_misek <= 4 ? 'misky' : 'misek'})`
                  }
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Services */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Služby</h2>

        <div className="space-y-4">
          {form.sluzby.map((sluzba, sIdx) => (
              <Card 
            key={sluzba.tempId} 
            className="animate-slide-in"
            ref={(el) => {
              if (el) sluzbyRefs.current.set(sluzba.tempId, el);
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 flex-1">
                <Badge variant="service" className="text-base">#{sIdx + 1}</Badge>
                <input
                  placeholder="Název služby (např. Barvení odrostů)"
                  value={sluzba.nazev}
                  onChange={e => updateSluzba(sIdx, { nazev: e.target.value })}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              {form.sluzby.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm(f => ({ ...f, sluzby: f.sluzby.filter((_, i) => i !== sIdx) }))}
                  title="Smazat službu"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </Button>
              )}
            </div>

            {/* Bowls */}
            {sluzba.misky.length === 0 ? (
              <div className="ml-2 sm:ml-6 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
                  ✓ Služba bez materiálu (stříhání, foukání, žehlení...)
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sluzba.misky.map((miska, mIdx) => (
                <div 
                  key={miska.tempId} 
                  className="ml-2 sm:ml-6 pl-4 border-l-2 border-purple-200 dark:border-purple-700 animate-slide-in"
                  ref={(el) => {
                    if (el) miskyRefs.current.set(miska.tempId, el);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wide bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">
                      Miska {mIdx + 1}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const copiedMiska: MiskaForm = {
                            tempId: uid(),
                            oxidant_id: miska.oxidant_id,
                            gramy_oxidantu: miska.gramy_oxidantu,
                            materialy: miska.materialy.map(mat => ({
                              tempId: uid(),
                              material_id: mat.material_id,
                              odstin_cislo: mat.odstin_cislo,
                              gramy_materialu: mat.gramy_materialu,
                            })),
                          };
                          updateSluzba(sIdx, { ...sluzba, misky: [...sluzba.misky, copiedMiska] } as any);
                          scrollToElement(copiedMiska.tempId, miskyRefs);
                          toast.success('Miska zkopírována');
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-md transition-colors flex items-center gap-1"
                        title="Duplikovat misku"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Duplikovat
                      </button>
                      {sluzba.misky.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Opravdu smazat tuto misku?')) {
                              updateSluzba(sIdx, { ...sluzba, misky: sluzba.misky.filter((_, i) => i !== mIdx) } as any);
                            }
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Summary banner */}
                  {(() => {
                    const totalMaterialGrams = miska.materialy.reduce((sum, m) => {
                      const g = typeof m.gramy_materialu === 'string' ? parseFloat(m.gramy_materialu) : m.gramy_materialu;
                      return sum + (isNaN(g) ? 0 : g);
                    }, 0);
                    
                    if (totalMaterialGrams > 0) {
                      return (
                        <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-purple-900 dark:text-purple-200">📊 Souhrn:</span>
                            <div className="flex items-center gap-3">
                              <span className="text-purple-700 dark:text-purple-300">
                                <strong>{totalMaterialGrams}g</strong> materiálu
                              </span>
                              {miska.oxidant_id && miska.gramy_oxidantu > 0 && (
                                <>
                                  <span className="text-purple-400">+</span>
                                  <span className="text-amber-700 dark:text-amber-300">
                                    <strong>{miska.gramy_oxidantu}g</strong> oxidantu
                                  </span>
                                  <span className="text-purple-400">=</span>
                                  <span className="text-green-700 dark:text-green-400 font-bold">
                                    {totalMaterialGrams + miska.gramy_oxidantu}g celkem
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Materials table */}
                  <div className="space-y-2 mb-3">
                    {miska.materialy.map((mat, matIdx) => (
                      <div
                        key={mat.tempId}
                        ref={(el) => {
                          if (el) materialyRefs.current.set(mat.tempId, el);
                        }}
                      >
                        <MaterialRow
                          mat={mat}
                          materials={materials}
                          materialMap={materialMap}
                          onChange={(update) => updateMaterial(sIdx, mIdx, matIdx, update)}
                          onRemove={
                            miska.materialy.length > 1
                              ? () =>
                                  updateMiska(sIdx, mIdx, {
                                    materialy: miska.materialy.filter((_, i) => i !== matIdx),
                                  })
                              : undefined
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const newMat = empty.material();
                      updateMiska(sIdx, mIdx, {
                        materialy: [...miska.materialy, newMat],
                      });
                      scrollToElement(newMat.tempId, materialyRefs);
                    }}
                    className="w-full py-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg border border-dashed border-purple-300 dark:border-purple-600 hover:border-purple-400 dark:hover:border-purple-400 transition-colors font-medium"
                  >
                    + Přidat materiál
                  </button>

                  {/* Oxidant selection - compact with buttons */}
                  {miska.materialy.length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700 rounded-lg">
                      <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-2">
                        🧪 Oxidant
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {oxidants.map(ox => (
                          <button
                            key={ox.id}
                            onClick={() => updateMiska(sIdx, mIdx, { oxidant_id: ox.id })}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                              miska.oxidant_id === ox.id
                                ? 'bg-amber-600 dark:bg-amber-700 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-400'
                            }`}
                          >
                            {ox.nazev}
                          </button>
                        ))}
                      </div>
                      {miska.oxidant_id && miska.gramy_oxidantu > 0 && (
                        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold">{miska.gramy_oxidantu}g</span>
                          <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">(auto)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}

            {/* Add bowl button - only if not empty service */}
            {sluzba.misky.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newMiska = empty.miska();
                    updateSluzba(sIdx, { ...sluzba, misky: [...sluzba.misky, newMiska] } as any);
                    scrollToElement(newMiska.tempId, miskyRefs);
                  }}
                  className="text-purple-600"
                >
                  + Přidat misku
                </Button>
              </div>
            )}
          </Card>
          ))}
        </div>
      </div>

      <Button
        variant="secondary"
        onClick={() => {
          const newSluzba = empty.sluzba();
          setForm(f => ({ ...f, sluzby: [...f.sluzby, newSluzba] }));
          scrollToElement(newSluzba.tempId, sluzbyRefs);
        }}
        className="w-full mb-6 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-accent-400 hover:text-accent-600"
      >
        + Přidat vlastní službu
      </Button>


      {/* Products section */}
      <Card className="mb-6 animate-fade-in">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Prodané produkty</h2>

        {form.produkty.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 italic mb-3">Žádné produkty zatím nepřidány</p>
        ) : (
          <div className="space-y-3 mb-4">
            {form.produkty.map((prod, pIdx) => (
              <div 
                key={prod.tempId} 
                className="p-4 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-lg animate-slide-in"
                ref={(el) => {
                  if (el) produktyRefs.current.set(prod.tempId, el);
                }}
              >
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-2">Produkt</label>
                  
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="Hledat produkt..."
                    value={productSearches[prod.tempId] || ''}
                    onChange={e => setProductSearches({ ...productSearches, [prod.tempId]: e.target.value })}
                    className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100"
                  />

                  {/* Filtered products */}
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {productSearches[prod.tempId]?.trim() && produktyCatalog
                      .filter(p => {
                        const search = productSearches[prod.tempId]?.toLowerCase() || '';
                        return p.nazev.toLowerCase().includes(search);
                      })
                      .slice(0, 20)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setForm(f => ({
                              ...f,
                              produkty: f.produkty.map((pr, i) =>
                                i === pIdx
                                  ? { ...pr, produkt_id: p.id, cena_za_ks: p.cena }
                                  : pr
                              ),
                            }));
                            // Clear search after selection
                            setProductSearches({ ...productSearches, [prod.tempId]: '' });
                          }}
                          className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                            prod.produkt_id === p.id
                              ? 'bg-emerald-600 dark:bg-emerald-700 text-white shadow-sm'
                              : 'bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 text-gray-700 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
                          }`}
                        >
                          {p.nazev}
                          <span className="ml-1.5 text-xs opacity-70">{p.cena} Kč</span>
                        </button>
                      ))}
                    {productSearches[prod.tempId]?.trim() && produktyCatalog.filter(p => {
                      const search = productSearches[prod.tempId]?.toLowerCase() || '';
                      return p.nazev.toLowerCase().includes(search);
                    }).length > 20 && (
                      <div className="w-full text-center text-xs text-gray-500 dark:text-gray-400 py-2">
                        ... a další {produktyCatalog.filter(p => {
                          const search = productSearches[prod.tempId]?.toLowerCase() || '';
                          return p.nazev.toLowerCase().includes(search);
                        }).length - 20} produktů (upřesněte hledání)
                      </div>
                    )}
                    {!productSearches[prod.tempId]?.trim() && !prod.produkt_id && (
                      <div className="w-full text-center text-sm text-gray-400 dark:text-gray-500 py-4">
                        👆 Začněte psát název produktu...
                      </div>
                    )}
                    {prod.produkt_id && (() => {
                      const produkt = produktyCatalog.find(p => p.id === prod.produkt_id);
                      return produkt ? (
                        <div className="w-full">
                          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-emerald-600 dark:bg-emerald-700 text-white">
                            ✓ {produkt.nazev}
                            <span className="text-xs opacity-70">{produkt.cena} Kč</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>

                {prod.produkt_id && (
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="w-24">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Počet ks</label>
                      <input
                        type="number"
                        min={1}
                        value={prod.pocet_ks}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            produkty: f.produkty.map((pr, i) =>
                              i === pIdx ? { ...pr, pocet_ks: e.target.value } : pr
                            ),
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Cena za ks (Kč)</label>
                      <input
                        type="number"
                        min={0}
                        value={prod.cena_za_ks}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            produkty: f.produkty.map((pr, i) =>
                              i === pIdx ? { ...pr, cena_za_ks: e.target.value } : pr
                            ),
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      = {((typeof prod.pocet_ks === 'string' ? parseInt(prod.pocet_ks) : prod.pocet_ks) || 0) *
                        ((typeof prod.cena_za_ks === 'string' ? parseFloat(prod.cena_za_ks) : prod.cena_za_ks) || 0)} Kč
                    </div>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm(f => ({
                      ...f,
                      produkty: f.produkty.filter((_, i) => i !== pIdx),
                    }))
                  }
                  className="mt-3 text-red-500 hover:text-red-600"
                >
                  Smazat produkt
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const newProdukt = { tempId: uid(), produkt_id: null, pocet_ks: 1, cena_za_ks: '' };
            setForm(f => ({
              ...f,
              produkty: [
                ...f.produkty,
                newProdukt,
              ],
            }));
            scrollToElement(newProdukt.tempId, produktyRefs);
          }}
          className="text-emerald-600"
        >
          + Přidat produkt
        </Button>
      </Card>

      {/* Poznámka section */}
      <Card className="mb-6 animate-fade-in">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Poznámka k návštěvě</h2>
        <textarea
          value={form.poznamka}
          onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))}
          rows={3}
          placeholder="Poznámka k návštěvě (nepovinné)..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none transition-colors dark:bg-gray-900 dark:text-gray-100"
        />
      </Card>

      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 -mx-4 sm:mx-0 px-4 py-4 sm:bg-transparent sm:border-0 sm:backdrop-blur-none">
        <div className="flex justify-end">
          <Button onClick={handleShowSummary} size="lg" className="shadow-lg sm:shadow-sm">
            Pokračovat k souhrnu →
          </Button>
        </div>
      </div>
    </div>
  );
}

// Material selection row component
function MaterialRow({
  mat,
  materials,
  materialMap,
  onChange,
  onRemove,
}: {
  mat: MaterialVMisceForm;
  materials: Material[];
  materialMap: Map<string, Material>;
  onChange: (update: Partial<MaterialVMisceForm>) => void;
  onRemove?: () => void;
}) {
  const selectedMaterial = mat.material_id ? materialMap.get(mat.material_id) : null;
  const odstinRef = useRef<HTMLInputElement>(null);
  const gramyRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-3 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-lg hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-sm transition-all group">
      {/* Material buttons - compact */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {materials.map(m => (
          <button
            key={m.id}
            onClick={() => {
              console.log('Material clicked:', m.nazev, 'default ratio:', m.michaci_pomer_material, ':', m.michaci_pomer_oxidant, 'additional ratios:', m.michaci_pomery);
              const update: Partial<MaterialVMisceForm> = { material_id: m.id };
              // Always use the default ratio first
              update.material_michaci_pomer_material = m.michaci_pomer_material || 1;
              update.material_michaci_pomer_oxidant = m.michaci_pomer_oxidant || 1;
              console.log('Using default ratio:', update.material_michaci_pomer_material, ':', update.material_michaci_pomer_oxidant);
              onChange(update);
              setTimeout(() => odstinRef.current?.focus(), 50);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mat.material_id === m.id
                ? 'bg-purple-600 dark:bg-purple-700 text-white shadow-sm'
                : 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-500'
            }`}
          >
            {m.nazev}
          </button>
        ))}
      </div>

      {selectedMaterial && (
        <>
          {/* Mixing ratio selection - show default ratio + additional ratios */}
          {(selectedMaterial.michaci_pomery && selectedMaterial.michaci_pomery.length > 0) || selectedMaterial.michaci_pomer_material ? (
            <div className="mb-2">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">Míchací poměr:</div>
              <div className="flex flex-wrap gap-1.5">
                {/* Default ratio button */}
                {selectedMaterial.michaci_pomer_material && (
                  <button
                    onClick={() => onChange({ 
                      material_michaci_pomer_material: selectedMaterial.michaci_pomer_material,
                      material_michaci_pomer_oxidant: selectedMaterial.michaci_pomer_oxidant
                    })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mat.material_michaci_pomer_material === selectedMaterial.michaci_pomer_material && 
                      mat.material_michaci_pomer_oxidant === selectedMaterial.michaci_pomer_oxidant
                        ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-sm'
                        : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-500'
                    }`}
                  >
                    {selectedMaterial.michaci_pomer_material}:{selectedMaterial.michaci_pomer_oxidant}
                  </button>
                )}
                {/* Additional ratios */}
                {selectedMaterial.michaci_pomery?.map((pomer, idx) => (
                  <button
                    key={idx}
                    onClick={() => onChange({ 
                      material_michaci_pomer_material: pomer.material,
                      material_michaci_pomer_oxidant: pomer.oxidant
                    })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mat.material_michaci_pomer_material === pomer.material && 
                      mat.material_michaci_pomer_oxidant === pomer.oxidant
                        ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-sm'
                        : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-500'
                    }`}
                  >
                    {pomer.material}:{pomer.oxidant}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          
          <div className="flex items-center gap-2">
            {/* Shade/number input */}
            <input
              ref={odstinRef}
              placeholder={selectedMaterial.typ_zadavani === 'odstin' ? 'Odstín' : 'Číslo'}
              value={mat.odstin_cislo}
              onChange={e => onChange({ odstin_cislo: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  gramyRef.current?.focus();
                }
              }}
              className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-900 dark:text-gray-100"
            />
            
            {/* Grams input */}
            <input
              ref={gramyRef}
              type="number"
              min={1}
              placeholder="g"
              value={mat.gramy_materialu}
              onChange={e => onChange({ gramy_materialu: e.target.value })}
              className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-900 dark:text-gray-100"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">g</span>
            
            {/* Remove button */}
            {onRemove && (
              <button
                onClick={onRemove}
                className="ml-auto p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="Smazat"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
