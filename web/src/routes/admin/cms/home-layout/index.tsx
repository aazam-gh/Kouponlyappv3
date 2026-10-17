import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Button } from '@/components/ui/button'
import { HOME_SECTIONS, DEFAULT_HOME_SECTION_ORDER, normalizeHomeSectionOrder, type HomeSectionId } from '@/lib/home-layout'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/cms/home-layout/')({ component: HomeLayout })
const queryKey = ['cmsDocument', 'homeLayout']

function SectionRow({ id, index, disabled, move }: { id: HomeSectionId; index: number; disabled: boolean; move: (from: number, to: number) => void }) {
  const section = HOME_SECTIONS.find(section => section.id === id)!
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative flex items-center gap-3 rounded-xl border bg-card p-4 ${isDragging ? 'z-10 shadow-lg' : ''}`}>
    <Button variant="ghost" size="icon" disabled={disabled} className="shrink-0 touch-none cursor-grab" aria-label={`Drag ${section.title}`} {...attributes} {...listeners}><GripVertical className="size-5" /></Button>
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
    <div className="min-w-0 flex-1"><h2 className="font-semibold">{section.title}</h2><p className="mt-1 text-sm text-muted-foreground">{section.description}</p></div>
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" disabled={disabled || index === 0} aria-label={`Move ${section.title} up`} onClick={() => move(index, index - 1)}><ArrowUp className="size-4" /></Button>
      <Button variant="ghost" size="icon" disabled={disabled || index === HOME_SECTIONS.length - 1} aria-label={`Move ${section.title} down`} onClick={() => move(index, index + 1)}><ArrowDown className="size-4" /></Button>
    </div>
  </li>
}

function HomeLayout() {
  const client = useQueryClient()
  const layout = useQuery({ queryKey, queryFn: async () => {
    const snapshot = await getDoc(doc(db, 'cms', 'homeLayout'))
    return normalizeHomeSectionOrder(snapshot.data()?.sectionOrder)
  }, refetchOnWindowFocus: false })
  const [order, setOrder] = useState(DEFAULT_HOME_SECTION_ORDER)
  useEffect(() => { if (layout.data) setOrder(layout.data) }, [layout.data])
  const save = useMutation({ mutationFn: async (sectionOrder: HomeSectionId[]) => {
    await setDoc(doc(db, 'cms', 'homeLayout'), { sectionOrder, lastUpdated: new Date().toISOString() })
    return sectionOrder
  }, onSuccess: sectionOrder => { client.setQueryData(queryKey, sectionOrder); toast.success('Home section order saved') }, onError: () => toast.error('Could not save Home order. Your changes are still here.') })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const dirty = order.join() !== layout.data?.join()
  const move = (from: number, to: number) => setOrder(current => arrayMove(current, from, to))
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = order.indexOf(active.id as HomeSectionId), to = order.indexOf(over.id as HomeSectionId)
    if (from >= 0 && to >= 0) move(from, to)
  }
  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8">
    <div className="sticky top-(--header-height) z-20 flex flex-wrap items-center justify-between gap-4 border-b bg-background py-3">
      <div><h1 className="text-2xl font-semibold">Home section order</h1><p className="mt-1 text-sm text-muted-foreground">Arrange the student app’s Home screen from top to bottom.</p></div>
      <Button disabled={!dirty || !layout.isSuccess || save.isPending} onClick={() => save.mutate([...order])}><Save className="mr-2 size-4" />{save.isPending ? 'Saving…' : 'Save order'}</Button>
    </div>
    {layout.isPending ? <p role="status">Loading Home layout…</p> : layout.isError ? <div role="alert" className="rounded-xl border p-5"><p>Could not load the saved layout.</p><Button className="mt-3" variant="outline" onClick={() => void layout.refetch()}>Retry</Button></div> : <>
      <p className="text-sm text-muted-foreground">Drag a section or use its arrow buttons. Save to update the app. Sections without content follow their existing display rules.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={dragEnd}><SortableContext items={order} strategy={verticalListSortingStrategy}><ol className="space-y-3" aria-label="Home sections">{order.map((id, index) => <SectionRow key={id} id={id} index={index} disabled={save.isPending} move={move} />)}</ol></SortableContext></DndContext>
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={save.isPending} onClick={() => setOrder([...DEFAULT_HOME_SECTION_ORDER])}>Reset to default</Button><Button variant="ghost" disabled={!dirty || save.isPending} onClick={() => setOrder(layout.data)}>Discard changes</Button><span role="status" className="text-sm text-muted-foreground">{dirty ? 'Unsaved changes' : 'Order saved'}</span></div>
      <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Search and account verification stay at the top. The app launch poster is managed separately. Students need an app version that supports Home section ordering.</p>
    </>}
  </div>
}
