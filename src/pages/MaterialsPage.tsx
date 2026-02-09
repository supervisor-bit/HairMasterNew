import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getMaterials, createMaterial, updateMaterial, deleteMaterial, getOxidants } from '@/lib/firestore';
import type { Material, Oxidant, MichaciPomer } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface MaterialForm {
  nazev: string;
  typ_zadavani: 'odstin' | 'cislo';
  michaci_pomer_material: number;
  michaci_pomer_oxidant: number;
  michaci_pomery: MichaciPomer[];
  oxidant_ids: string[];
}

const emptyForm: MaterialForm = {
  nazev: '',
  typ_zadavani: 'odstin',
  michaci_pomer_material: 1,
  michaci_pomer_oxidant: 1,
  michaci_pomery: [],
  oxidant_ids: [],
};

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allOxidants, setAllOxidants] = useState<Oxidant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MaterialForm>(emptyForm);
  const [showNew, setShowNew] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [mats, oxs] = await Promise.all([
        getMaterials(user.uid),
        getOxidants(user.uid),
      ]);
      setMaterials(mats as Material[]);
      setAllOxidants((oxs as Oxidant[]).filter(o => o.aktivni));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSaveNew = async () => {
    if (!form.nazev.trim() || !user) return;
    try {
      await createMaterial(user.uid, { ...form, aktivni: true });
      setForm(emptyForm);
      setShowNew(false);
      toast.success('Materiál vytvořen');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při vytváření');
    }
  };

  const handleUpdate = async (mat: Material) => {
    if (!user) return;
    try {
      await updateMaterial(user.uid, mat.id, { ...form, aktivni: mat.aktivni });
      setEditingId(null);
      toast.success('Materiál upraven');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při ukládání');
    }
  };

  const handleToggleActive = async (mat: Material) => {
    if (!user) return;
    try {
      await updateMaterial(user.uid, mat.id, {
        nazev: mat.nazev,
        typ_zadavani: mat.typ_zadavani,
        michaci_pomer_material: mat.michaci_pomer_material,
        michaci_pomer_oxidant: mat.michaci_pomer_oxidant,
        aktivni: !mat.aktivni,
        oxidant_ids: mat.oxidanty?.map(o => o.id) || [],
      });
      toast.success(mat.aktivni ? 'Materiál deaktivován' : 'Materiál aktivován');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba');
    }
  };

  const toggleOxidant = (oid: string) => {
    setForm(f => ({
      ...f,
      oxidant_ids: f.oxidant_ids.includes(oid)
        ? f.oxidant_ids.filter(id => id !== oid)
        : [...f.oxidant_ids, oid],
    }));
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newList = [...materials];
    const [item] = newList.splice(dragIdx, 1);
    newList.splice(idx, 0, item);
    setMaterials(newList);
    setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    const prevOrder = [...materials];
    setDragIdx(null);
    const items = materials.map((m, i) => ({ id: m.id, poradi: i + 1 }));
    try {
      await api.put('/materials/reorder/batch', { items });
      toast.success('Pořadí uloženo');
    } catch {
      setMaterials(prevOrder);
      toast.error('Nepodařilo se uložit pořadí');
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  const renderForm = (onSave: () => void, onCancel: () => void) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Název</label>
        <input
          value={form.nazev}
          onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          placeholder="Např. INOA"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Typ zadávání</label>
        <div className="flex gap-4">
          {(['odstin', 'cislo'] as const).map(typ => (
            <label key={typ} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={form.typ_zadavani === typ}
                onChange={() => setForm(f => ({ ...f, typ_zadavani: typ }))}
                className="text-accent-600 focus:ring-accent-500"
              />
              <span className="text-sm text-gray-900 dark:text-gray-100">{typ === 'odstin' ? 'Odstín (např. 6.0)' : 'Číslo (např. 7)'}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Míchací poměr (materiál : oxidant)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={form.michaci_pomer_material}
            onChange={e => setForm(f => ({ ...f, michaci_pomer_material: parseFloat(e.target.value) || 1 }))}
            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">:</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={form.michaci_pomer_oxidant}
            onChange={e => setForm(f => ({ ...f, michaci_pomer_oxidant: parseFloat(e.target.value) || 1 }))}
            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Výchozí poměr pro tento materiál</p>
      </div>
      
      {form.typ_zadavani === 'cislo' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Další možné poměry (pro materiály jako Blond Studio)
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.michaci_pomery.map((pomer, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setForm(f => ({ ...f, michaci_pomery: f.michaci_pomery.filter((_, i) => i !== idx) }))}
                className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-2"
              >
                {pomer.material}:{pomer.oxidant}
                <span className="text-blue-600 dark:text-blue-400">×</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.1}
              step={0.1}
              placeholder="1"
              id="new-pomer-mat"
              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <span className="text-gray-500 dark:text-gray-400">:</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              placeholder="2"
              id="new-pomer-ox"
              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => {
                const matInput = document.getElementById('new-pomer-mat') as HTMLInputElement;
                const oxInput = document.getElementById('new-pomer-ox') as HTMLInputElement;
                const mat = parseFloat(matInput.value);
                const ox = parseFloat(oxInput.value);
                if (mat > 0 && ox > 0) {
                  setForm(f => ({ ...f, michaci_pomery: [{ material: mat, oxidant: ox }, ...f.michaci_pomery] }));
                  matInput.value = '';
                  oxInput.value = '';
                }
              }}
              className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm font-medium"
            >
              + Přidat poměr
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Např. Blond Studio může mít 1:1, 1:1.5, 1:2</p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Oxidanty</label>
        <div className="flex flex-wrap gap-2">
          {allOxidants.map(ox => (
            <button
              key={ox.id}
              type="button"
              onClick={() => toggleOxidant(ox.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                form.oxidant_ids.includes(ox.id)
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {ox.nazev}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:bg-gray-600 text-sm">
          Zrušit
        </button>
        <button onClick={onSave} className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm font-medium">
          Uložit
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Materiály</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              showInactive
                ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 border border-accent-300 dark:border-accent-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {showInactive ? 'Jen aktivní' : 'Zobrazit i neaktivní'}
          </button>
          <button
            onClick={() => { setShowNew(true); setForm(emptyForm); }}
            className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors text-sm font-medium"
          >
            + Nový materiál
          </button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-6 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Nový materiál</h3>
          {renderForm(handleSaveNew, () => setShowNew(false))}
        </div>
      )}

      <div className="space-y-2">
        {materials.filter(m => showInactive || m.aktivni).map((mat, idx) => (
          <div
            key={mat.id}
            draggable={editingId !== mat.id}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors ${
              dragIdx === idx ? 'ring-2 ring-accent-300' : ''
            } ${!mat.aktivni ? 'opacity-50' : ''}`}
          >
            {editingId === mat.id ? (
              <div className="p-6">
                {renderForm(
                  () => handleUpdate(mat),
                  () => setEditingId(null)
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="cursor-grab text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{mat.nazev}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {mat.typ_zadavani === 'odstin' ? 'Odstín' : 'Číslo'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      Poměr {mat.michaci_pomer_material}:{mat.michaci_pomer_oxidant}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      mat.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {mat.aktivni ? 'Aktivní' : 'Neaktivní'}
                    </span>
                  </div>
                  {mat.oxidanty && mat.oxidanty.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5">
                      {mat.oxidanty.map(o => (
                        <span key={o.id} className="text-xs px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400">
                          {o.nazev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditingId(mat.id);
                    setForm({
                      nazev: mat.nazev,
                      typ_zadavani: mat.typ_zadavani,
                      michaci_pomer_material: mat.michaci_pomer_material,
                      michaci_pomer_oxidant: mat.michaci_pomer_oxidant,
                      michaci_pomery: mat.michaci_pomery || [],
                      oxidant_ids: mat.oxidanty?.map(o => o.id) || [],
                    });
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
                >
                  Upravit
                </button>
                <button
                  onClick={() => handleToggleActive(mat)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
                >
                  {mat.aktivni ? 'Deaktivovat' : 'Aktivovat'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
