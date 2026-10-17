import { getCmsDocument, saveCmsDocument } from '@/lib/admin-cms'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { HOME_SECTIONS, DEFAULT_HOME_SECTION_ORDER, normalizeHomeSectionOrder, type HomeSectionId } from '@/lib/home-layout'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/cms/home-layout/')({ component: HomeLayout })
const queryKey = ['cmsDocument', 'homeLayout']

function SectionRow({ id, index, disabled, enabled, move, toggle }: { id: HomeSectionId; index: number; disabled: boolean; enabled: boolean; move: (from: number, to: number) => void; toggle: (id: HomeSectionId, enabled: boolean) => void }) {
  const section = HOME_SECTIONS.find(section => section.id === id)!
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative flex items-center gap-3 rounded-xl border bg-card p-4 ${isDragging ? 'z-10 shadow-lg' : ''}`}>
    <Button variant="ghost" size="icon" disabled={disabled} className="shrink-0 touch-none cursor-grab" aria-label={`Drag ${section.title}`} {...attributes} {...listeners}><GripVertical className="size-5" /></Button>
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
    <div className="min-w-0 flex-1"><h2 className="font-semibold">{section.title}</h2><p className="mt-1 text-sm text-muted-foreground">{section.description}</p></div>
    <label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" aria-label={`Show ${section.title} on Home`} checked={enabled} disabled={disabled} onChange={event => toggle(id, event.target.checked)} />Show</label>
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" disabled={disabled || index === 0} aria-label={`Move ${section.title} up`} onClick={() => move(index, index - 1)}><ArrowUp className="size-4" /></Button>
      <Button variant="ghost" size="icon" disabled={disabled || index === HOME_SECTIONS.length - 1} aria-label={`Move ${section.title} down`} onClick={() => move(index, index + 1)}><ArrowDown className="size-4" /></Button>
    </div>
  </li>
}

function HomeLayout() {
  const client = useQueryClient()
  const layout = useQuery({ queryKey, queryFn: async () => {
    const snapshot = await getCmsDocument('homeLayout')
    const savedOrder = normalizeHomeSectionOrder(snapshot?.sectionOrder)
    const sectionOrder = [...savedOrder, ...DEFAULT_HOME_SECTION_ORDER.filter(id => !savedOrder.includes(id))]
    return { sectionOrder, enabledSections: normalizeHomeSectionOrder(snapshot?.enabledSections ?? savedOrder) }
  }, refetchOnWindowFocus: false })
  const [order, setOrder] = useState(DEFAULT_HOME_SECTION_ORDER)
  const [enabled, setEnabled] = useState<Set<HomeSectionId>>(() => new Set(DEFAULT_HOME_SECTION_ORDER))
  useEffect(() => { if (layout.data) { setOrder(layout.data.sectionOrder); setEnabled(new Set(layout.data.enabledSections)) } }, [layout.data])
  const save = useMutation({ mutationFn: async (value: { sectionOrder: HomeSectionId[]; enabledSections: HomeSectionId[] }) => {
    await saveCmsDocument('homeLayout', { ...value, lastUpdated: new Date().toISOString() })
    return value
  }, onSuccess: value => { client.setQueryData(queryKey, value); toast.success('Home layout saved') }, onError: () => toast.error('Could not save Home layout. Your changes are still here.') })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const enabledOrder = order.filter(id => enabled.has(id))
  const dirty = order.join() !== layout.data?.sectionOrder.join() || enabledOrder.join() !== layout.data?.enabledSections.join()
  const move = (from: number, to: number) => setOrder(current => arrayMove(current, from, to))
  const toggle = (id: HomeSectionId, show: boolean) => setEnabled(current => { const next = new Set(current); show ? next.add(id) : next.delete(id); return next })
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = order.indexOf(active.id as HomeSectionId), to = order.indexOf(over.id as HomeSectionId)
    if (from >= 0 && to >= 0) move(from, to)
  }
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8">
    <div className="sticky top-(--header-height) z-20 flex flex-wrap items-center justify-between gap-4 border-b bg-background py-3">
      <div><h1 className="text-2xl font-semibold">Home screen</h1><p className="mt-1 text-sm text-muted-foreground">Choose which sections appear and arrange them from top to bottom.</p></div>
      <Button disabled={!dirty || !layout.isSuccess || save.isPending} onClick={() => save.mutate({ sectionOrder: [...order], enabledSections: enabledOrder })}><Save className="mr-2 size-4" />{save.isPending ? 'Saving…' : 'Save layout'}</Button>
    </div>
    {layout.isPending ? <p role="status">Loading Home layout…</p> : layout.isError ? <div role="alert" className="rounded-xl border p-5"><p>Could not load the saved layout.</p><Button className="mt-3" variant="outline" onClick={() => void layout.refetch()}>Retry</Button></div> : <>
      <p className="text-sm text-muted-foreground">Show or hide each section, then drag it or use the arrows to set its position. Save to update the app.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={dragEnd}><SortableContext items={order} strategy={verticalListSortingStrategy}><ol className="space-y-3" aria-label="Home sections">{order.map((id, index) => <SectionRow key={id} id={id} index={index} disabled={save.isPending} enabled={enabled.has(id)} move={move} toggle={toggle} />)}</ol></SortableContext></DndContext>
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={save.isPending} onClick={() => { setOrder([...DEFAULT_HOME_SECTION_ORDER]); setEnabled(new Set(DEFAULT_HOME_SECTION_ORDER)) }}>Reset to default</Button><Button variant="ghost" disabled={!dirty || save.isPending} onClick={() => { if (layout.data) { setOrder(layout.data.sectionOrder); setEnabled(new Set(layout.data.enabledSections)) } }}>Discard changes</Button><span role="status" className="text-sm text-muted-foreground">{dirty ? 'Unsaved changes' : 'Layout saved'}</span></div>
      <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Search and account verification stay at the top. The app launch poster is managed separately. Students need an app version that supports Home section ordering.</p>
    </>}
  </div>
}
