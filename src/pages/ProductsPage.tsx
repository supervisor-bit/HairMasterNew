import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/lib/firestore';
import type { Produkt } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ProductForm {
  nazev: string;
  cena: number | string;
}

const emptyForm: ProductForm = {
  nazev: '',
  cena: '',
};

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [showNew, setShowNew] = useState(false);  const [showInactive, setShowInactive] = useState(false);  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getProducts(user.uid);
      setProducts(data as Produkt[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSaveNew = async () => {
    if (!form.nazev.trim() || !user) return;
    try {
      await createProduct(user.uid, {
        nazev: form.nazev,
        cena: Number(form.cena) || 0,
        aktivni: true,
      });
      setForm(emptyForm);
      setShowNew(false);
      toast.success('Produkt vytvořen');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při vytváření');
    }
  };

  const handleUpdate = async (product: Produkt) => {
    if (!user) return;
    try {
      await updateProduct(user.uid, product.id, {
        nazev: form.nazev,
        cena: Number(form.cena) || 0,
        aktivni: product.aktivni,
      });
      setEditingId(null);
      toast.success('Produkt upraven');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při ukládání');
    }
  };

  const handleToggleActive = async (product: Produkt) => {
    if (!user) return;
    try {
      await updateProduct(user.uid, product.id, {
        nazev: product.nazev,
        cena: product.cena,
        aktivni: !product.aktivni,
      });
      toast.success(product.aktivni ? 'Produkt deaktivován' : 'Produkt aktivován');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba');
    }
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newList = [...products];
    const [item] = newList.splice(dragIdx, 1);
    newList.splice(idx, 0, item);
    setProducts(newList);
    setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    if (!user) return;
    const prevOrder = [...products];
    setDragIdx(null);
    try {
      await Promise.all(
        products.map((p, i) => 
          updateProduct(user.uid, p.id, { 
            nazev: p.nazev, 
            cena: p.cena, 
            aktivni: p.aktivni, 
            poradi: i + 1 
          })
        )
      );
      toast.success('Pořadí uloženo');
    } catch {
      setProducts(prevOrder);
      toast.error('Nepodařilo se uložit pořadí');
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  const renderForm = (onSave: () => void, onCancel: () => void) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">Název</label>
        <input
          value={form.nazev}
          onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
          placeholder="Např. Olaplex No.3"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cena (Kč)</label>
        <input
          type="number"
          min={0}
          value={form.cena}
          onChange={e => setForm(f => ({ ...f, cena: e.target.value }))}
          className="w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          placeholder="0"
        />
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Produkty</h1>
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
            + Nový produkt
          </button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-6 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-4">Nový produkt</h3>
          {renderForm(handleSaveNew, () => setShowNew(false))}
        </div>
      )}

      <div className="space-y-2">
        {products.filter(p => showInactive || p.aktivni).map((product, idx) => (
          <div
            key={product.id}
            draggable={editingId !== product.id}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors ${
              dragIdx === idx ? 'ring-2 ring-accent-300' : ''
            } ${!product.aktivni ? 'opacity-50' : ''}`}
          >
            {editingId === product.id ? (
              <div className="p-6">
                {renderForm(
                  () => handleUpdate(product),
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
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{product.nazev}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {product.cena.toLocaleString('cs-CZ')} Kč
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      product.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {product.aktivni ? 'Aktivní' : 'Neaktivní'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingId(product.id);
                    setForm({
                      nazev: product.nazev,
                      cena: product.cena,
                    });
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
                >
                  Upravit
                </button>
                <button
                  onClick={() => handleToggleActive(product)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
                >
                  {product.aktivni ? 'Deaktivovat' : 'Aktivovat'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
