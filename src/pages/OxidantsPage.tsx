import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getOxidants, createOxidant, updateOxidant, deleteOxidant } from '@/lib/firestore';
import type { Oxidant } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function OxidantsPage() {
  const { user } = useAuth();
  const [oxidants, setOxidants] = useState<Oxidant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nazev: '', popis: '' });
  const [showNew, setShowNew] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getOxidants(user.uid);
      setOxidants(data as Oxidant[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSaveNew = async () => {
    if (!form.nazev.trim() || !user) return;
    try {
      await createOxidant(user.uid, { ...form, aktivni: true });
      setForm({ nazev: '', popis: '' });
      setShowNew(false);
      toast.success('Oxidant vytvořen');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při vytváření');
    }
  };

  const handleUpdate = async (ox: Oxidant) => {
    if (!user) return;
    try {
      await updateOxidant(user.uid, ox.id, {
        nazev: form.nazev,
        popis: form.popis,
        aktivni: ox.aktivni,
      });
      setEditingId(null);
      toast.success('Oxidant upraven');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při ukládání');
    }
  };

  const handleToggleActive = async (ox: Oxidant) => {
    if (!user) return;
    try {
      await updateOxidant(user.uid, ox.id, {
        nazev: ox.nazev,
        popis: ox.popis,
        aktivni: !ox.aktivni,
      });
      toast.success(ox.aktivni ? 'Oxidant deaktivován' : 'Oxidant aktivován');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba');
    }
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newList = [...oxidants];
    const [item] = newList.splice(dragIdx, 1);
    newList.splice(idx, 0, item);
    setOxidants(newList);
    setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    if (!user) return;
    const prevOrder = [...oxidants];
    setDragIdx(null);
    try {
      // Update poradi for each oxidant
      await Promise.all(
        oxidants.map((o, i) => 
          updateOxidant(user.uid, o.id, { 
            nazev: o.nazev, 
            popis: o.popis, 
            aktivni: o.aktivni, 
            poradi: i + 1 
          })
        )
      );
      toast.success('Pořadí uloženo');
    } catch {
      setOxidants(prevOrder);
      toast.error('Nepodařilo se uložit pořadí');
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Oxidanty</h1>
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
            onClick={() => { setShowNew(true); setForm({ nazev: '', popis: '' }); }}
            className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors text-sm font-medium"
          >
            + Nový oxidant
          </button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Nový oxidant</h3>
          <div className="flex gap-3">
            <input
              placeholder="Název (např. 6%)"
              value={form.nazev}
              onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <input
              placeholder="Popis (volitelné)"
              value={form.popis}
              onChange={e => setForm(f => ({ ...f, popis: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <button onClick={handleSaveNew} className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm font-medium">
              Uložit
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:bg-gray-600 text-sm">
              Zrušit
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {oxidants.filter(o => showInactive || o.aktivni).map((ox, idx) => (
          <div
            key={ox.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-4 px-4 py-3 transition-colors ${
              dragIdx === idx ? 'bg-accent-50 dark:bg-accent-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            } ${!ox.aktivni ? 'opacity-50' : ''}`}
          >
            <div className="cursor-grab text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </div>

            {editingId === ox.id ? (
              <>
                <input
                  value={form.nazev}
                  onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))}
                  className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  autoFocus
                />
                <input
                  value={form.popis}
                  onChange={e => setForm(f => ({ ...f, popis: e.target.value }))}
                  className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
                <button onClick={() => handleUpdate(ox)} className="px-3 py-1.5 bg-accent-600 text-white rounded-lg text-sm">
                  Uložit
                </button>
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">
                  Zrušit
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{ox.nazev}</span>
                  {ox.popis && <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{ox.popis}</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  ox.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {ox.aktivni ? 'Aktivní' : 'Neaktivní'}
                </span>
                <button
                  onClick={() => { setEditingId(ox.id); setForm({ nazev: ox.nazev, popis: ox.popis || '' }); }}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
                >
                  Upravit
                </button>
                <button
                  onClick={() => handleToggleActive(ox)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
                >
                  {ox.aktivni ? 'Deaktivovat' : 'Aktivovat'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
