import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { getUkony, createUkon, updateUkon } from '@/lib/firestore';
import type { Ukon } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function UkonyPage() {
  const { user } = useAuth();
  const [ukony, setUkony] = useState<Ukon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState({ nazev: '', pocet_misek: 1 });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function load() {
    if (!user) return;
    try {
      const data = await getUkony(user.uid);
      setUkony(data as Ukon[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setUkony((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);

      // Update poradi in background
      Promise.all(
        newItems.map((item, index) =>
          updateUkon(user!.uid, item.id, { poradi: index + 1 })
        )
      ).catch(err => toast.error('Chyba při ukládání pořadí'));

      return newItems;
    });
  }

  async function handleCreate() {
    if (!user || !form.nazev.trim()) {
      toast.error('Zadejte název úkonu');
      return;
    }
    try {
      const newId = await createUkon(user.uid, {
        nazev: form.nazev,
        pocet_misek: form.pocet_misek,
        aktivni: true,
        poradi: ukony.length + 1,
      });
      toast.success('Úkon vytvořen');
      setForm({ nazev: '', pocet_misek: 1 });
      setCreating(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při vytváření');
    }
  }

  async function handleUpdate(id: string) {
    if (!user || !form.nazev.trim()) {
      toast.error('Zadejte název úkonu');
      return;
    }
    try {
      await updateUkon(user.uid, id, {
        nazev: form.nazev,
        pocet_misek: form.pocet_misek,
      });
      toast.success('Úkon uložen');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při ukládání');
    }
  }

  async function handleToggleActive(id: string, aktivni: boolean) {
    if (!user) return;
    try {
      await updateUkon(user.uid, id, { aktivni: !aktivni });
      toast.success(aktivni ? 'Úkon deaktivován' : 'Úkon aktivován');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba');
    }
  }

  if (loading) return <LoadingSpinner className="py-20" />;

  const activeUkony = ukony.filter(u => showInactive || u.aktivni);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Úkony</h1>
        <div className="flex gap-2">
          <Button
            variant={showInactive ? 'secondary' : 'ghost'}
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? 'Jen aktivní' : 'Zobrazit i neaktivní'}
          </Button>
          <Button onClick={() => setCreating(true)}>+ Nový úkon</Button>
        </div>
      </div>

      {creating && (
        <Card className="mb-6 animate-slide-in">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Nový úkon</h2>
          <div className="space-y-4 mb-4">
            <Input
              label="Název úkonu"
              value={form.nazev}
              onChange={(e) => setForm({ ...form, nazev: e.target.value })}
              placeholder="např. Stříhání, Barvení, Foukání..."
              autoFocus
            />
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={form.pocet_misek === 0}
                  onChange={(e) => setForm({ ...form, pocet_misek: e.target.checked ? 0 : 1 })}
                  className="w-4 h-4 text-accent-600 border-gray-300 dark:border-gray-600 rounded focus:ring-accent-500"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Úkon bez materiálu
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-6 mb-3">
                Pro služby jako stříhání, foukání, žehlení, které nepotřebují barvy ani misky
              </p>
              {form.pocet_misek > 0 && (
                <div className="ml-6">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    label="Počet misek pro tento úkon"
                    value={form.pocet_misek}
                    onChange={(e) => setForm({ ...form, pocet_misek: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate}>Vytvořit</Button>
            <Button variant="secondary" onClick={() => { setCreating(false); setForm({ nazev: '', pocet_misek: 1 }); }}>
              Zrušit
            </Button>
          </div>
        </Card>
      )}

      {activeUkony.length === 0 ? (
        <EmptyState
          message="Zatím nemáte žádné úkony"
          description="Vytvořte první úkon pro rychlejší zadávání návštěv"
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={activeUkony.map(u => u.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {activeUkony.map((ukon) => (
                <UkonItem
                  key={ukon.id}
                  ukon={ukon}
                  editing={editing === ukon.id}
                  form={form}
                  setForm={setForm}
                  onEdit={(u) => {
                    setEditing(u.id);
                    setForm({ nazev: u.nazev, pocet_misek: u.pocet_misek });
                  }}
                  onSave={() => handleUpdate(ukon.id)}
                  onCancel={() => setEditing(null)}
                  onToggle={() => handleToggleActive(ukon.id, ukon.aktivni)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function UkonItem({
  ukon,
  editing,
  form,
  setForm,
  onEdit,
  onSave,
  onCancel,
  onToggle,
}: {
  ukon: Ukon;
  editing: boolean;
  form: { nazev: string; pocet_misek: number };
  setForm: (f: { nazev: string; pocet_misek: number }) => void;
  onEdit: (u: Ukon) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ukon.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {editing ? (
          <div className="flex-1 space-y-3">
            <Input
              label="Název úkonu"
              value={form.nazev}
              onChange={(e) => setForm({ ...form, nazev: e.target.value })}
              autoFocus
            />
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={form.pocet_misek === 0}
                  onChange={(e) => setForm({ ...form, pocet_misek: e.target.checked ? 0 : 1 })}
                  className="w-4 h-4 text-accent-600 border-gray-300 dark:border-gray-600 rounded focus:ring-accent-500"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Úkon bez materiálu
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-6 mb-2">
                Stříhání, foukání, žehlení...
              </p>
              {form.pocet_misek > 0 && (
                <div className="ml-6">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    label="Počet misek"
                    value={form.pocet_misek}
                    onChange={(e) => setForm({ ...form, pocet_misek: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{ukon.nazev}</h3>
              {ukon.pocet_misek === 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  bez materiálu
                </span>
              ) : (
                <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  {ukon.pocet_misek} {ukon.pocet_misek === 1 ? 'miska' : ukon.pocet_misek <= 4 ? 'misky' : 'misek'}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={onSave} className="px-3 py-1.5 text-sm bg-accent-600 text-white hover:bg-accent-700 rounded-lg transition-colors">
                Uložit
              </button>
              <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                Zrušit
              </button>
            </>
          ) : (
            <>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                ukon.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {ukon.aktivni ? 'Aktivní' : 'Neaktivní'}
              </span>
              <button
                onClick={() => onEdit(ukon)}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
              >
                Upravit
              </button>
              <button
                onClick={onToggle}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
              >
                {ukon.aktivni ? 'Deaktivovat' : 'Aktivovat'}
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
