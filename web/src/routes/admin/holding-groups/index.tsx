import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { Loader2, Plus, Save, Trash2, UserMinus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/firebase/config'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createHoldingGroup,
  createHoldingGroupUser,
  deleteHoldingGroupUser,
  disableHoldingGroupUser,
  listHoldingGroups,
  updateHoldingGroup,
  type HoldingRole,
  type HoldingStatus,
} from '@/lib/holding-groups'
import type { Vendor } from '@/queries'

export const Route = createFileRoute('/admin/holding-groups/')({
  component: HoldingGroupsAdmin,
})

const EMPTY_GROUP_FORM = {
  name: '',
  vendorIds: [] as string[],
}

const EMPTY_USER_FORM = {
  email: '',
  password: '',
  displayName: '',
  role: 'viewer' as HoldingRole,
}

async function fetchAdminVendors() {
  const snapshot = await getDocs(query(collection(db, 'vendors'), orderBy('name', 'asc')))
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Vendor[]
}

function HoldingGroupsAdmin() {
  const queryClient = useQueryClient()
  const [createForm, setCreateForm] = useState(EMPTY_GROUP_FORM)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState<HoldingStatus>('active')
  const [editVendorIds, setEditVendorIds] = useState<string[]>([])
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['holding-groups'],
    queryFn: listHoldingGroups,
  })

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['holding-admin-vendors'],
    queryFn: fetchAdminVendors,
  })

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || groups[0],
    [groups, selectedGroupId],
  )

  useEffect(() => {
    if (!selectedGroup) {
      setSelectedGroupId('')
      setEditName('')
      setEditStatus('active')
      setEditVendorIds([])
      return
    }
    setSelectedGroupId(selectedGroup.id)
    setEditName(selectedGroup.name)
    setEditStatus(selectedGroup.status)
    setEditVendorIds(selectedGroup.vendorIds)
  }, [selectedGroup])

  const refreshGroups = () => queryClient.invalidateQueries({ queryKey: ['holding-groups'] })

  const createGroupMutation = useMutation({
    mutationFn: createHoldingGroup,
    onSuccess: async () => {
      setCreateForm(EMPTY_GROUP_FORM)
      await refreshGroups()
    },
  })

  const updateGroupMutation = useMutation({
    mutationFn: updateHoldingGroup,
    onSuccess: refreshGroups,
  })

  const createUserMutation = useMutation({
    mutationFn: createHoldingGroupUser,
    onSuccess: async () => {
      setUserForm(EMPTY_USER_FORM)
      await refreshGroups()
    },
  })

  const disableUserMutation = useMutation({
    mutationFn: disableHoldingGroupUser,
    onSuccess: refreshGroups,
  })

  const deleteUserMutation = useMutation({
    mutationFn: deleteHoldingGroupUser,
    onSuccess: refreshGroups,
  })

  const toggleCreateVendor = (vendorId: string) => {
    setCreateForm((current) => ({
      ...current,
      vendorIds: current.vendorIds.includes(vendorId)
        ? current.vendorIds.filter((id) => id !== vendorId)
        : [...current.vendorIds, vendorId],
    }))
  }

  const toggleEditVendor = (vendorId: string) => {
    setEditVendorIds((current) => (
      current.includes(vendorId)
        ? current.filter((id) => id !== vendorId)
        : [...current, vendorId]
    ))
  }

  const saveSelectedGroup = () => {
    if (!selectedGroup) return
    updateGroupMutation.mutate({
      groupId: selectedGroup.id,
      name: editName,
      status: editStatus,
      vendorIds: editVendorIds,
    })
  }

  const addHoldingUser = () => {
    if (!selectedGroup) return
    createUserMutation.mutate({
      groupId: selectedGroup.id,
      ...userForm,
    })
  }

  const loading = groupsLoading || vendorsLoading

  return (
    <div className="p-8 space-y-6 w-full max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Holding Groups</h1>
        <p className="text-muted-foreground mt-1">
          Create read-only holding accounts and assign vendors to their dashboard.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
          <div className="space-y-6">
            <section className="bg-white border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Create Group</h2>
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holding-name">Group Name</Label>
                <Input
                  id="holding-name"
                  value={createForm.name}
                  onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                  placeholder="Al Mana Group"
                />
              </div>
              <VendorChecklist
                vendors={vendors}
                selectedVendorIds={createForm.vendorIds}
                onToggle={toggleCreateVendor}
              />
              <Button
                className="w-full bg-brand-green hover:bg-brand-green/90 text-white"
                disabled={!createForm.name.trim() || createGroupMutation.isPending}
                onClick={() => createGroupMutation.mutate(createForm)}
              >
                {createGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Holding Group'}
              </Button>
            </section>

            <section className="bg-white border rounded-xl p-5 space-y-3">
              <h2 className="text-lg font-semibold">Groups</h2>
              <div className="space-y-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`w-full text-left border rounded-lg p-3 transition ${selectedGroup?.id === group.id ? 'border-brand-green bg-brand-green/5' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {group.vendorIds.length} vendors · {group.users.length} users · {group.status}
                    </div>
                  </button>
                ))}
                {!groups.length && (
                  <p className="text-sm text-muted-foreground">No holding groups yet.</p>
                )}
              </div>
            </section>
          </div>

          {selectedGroup ? (
            <div className="space-y-6">
              <section className="bg-white border rounded-xl p-5 space-y-4">
                <h2 className="text-lg font-semibold">Edit Group</h2>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Group Name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={(value) => setEditStatus(value as HoldingStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <VendorChecklist
                  vendors={vendors}
                  selectedVendorIds={editVendorIds}
                  onToggle={toggleEditVendor}
                />
                <Button
                  className="bg-brand-green hover:bg-brand-green/90 text-white gap-2"
                  disabled={!editName.trim() || updateGroupMutation.isPending}
                  onClick={saveSelectedGroup}
                >
                  {updateGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Group
                </Button>
              </section>

              <section className="bg-white border rounded-xl p-5 space-y-4">
                <h2 className="text-lg font-semibold">Create Holding Account</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldInput label="Display Name" value={userForm.displayName} onChange={(displayName) => setUserForm({ ...userForm, displayName })} />
                  <FieldInput label="Email" value={userForm.email} onChange={(email) => setUserForm({ ...userForm, email })} type="email" />
                  <FieldInput label="Password" value={userForm.password} onChange={(password) => setUserForm({ ...userForm, password })} type="password" />
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={userForm.role} onValueChange={(role) => setUserForm({ ...userForm, role: role as HoldingRole })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="bg-brand-green hover:bg-brand-green/90 text-white"
                  disabled={!userForm.displayName || !userForm.email || !userForm.password || createUserMutation.isPending}
                  onClick={addHoldingUser}
                >
                  {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Holding User'}
                </Button>
              </section>

              <section className="bg-white border rounded-xl p-5 space-y-4">
                <h2 className="text-lg font-semibold">Holding Users</h2>
                <div className="border rounded-lg divide-y">
                  {selectedGroup.users.map((user) => (
                    <div key={user.uid} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="font-semibold">{user.displayName || user.email}</div>
                        <div className="text-sm text-muted-foreground">{user.email} · {user.role} · {user.status}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={disableUserMutation.isPending}
                          onClick={() => disableUserMutation.mutate(user.uid)}
                        >
                          <UserMinus className="h-4 w-4" />
                          Disable
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          disabled={deleteUserMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete ${user.email}?`)) {
                              deleteUserMutation.mutate(user.uid)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!selectedGroup.users.length && (
                    <p className="p-4 text-sm text-muted-foreground">No holding users for this group.</p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="bg-white border rounded-xl p-8 text-muted-foreground">
              Create a group to manage holding accounts.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function VendorChecklist({
  vendors,
  selectedVendorIds,
  onToggle,
}: {
  vendors: Vendor[]
  selectedVendorIds: string[]
  onToggle: (vendorId: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Assigned Vendors</Label>
        <span className="text-xs text-muted-foreground">{selectedVendorIds.length}/30 selected</span>
      </div>
      <div className="border rounded-lg max-h-72 overflow-auto divide-y">
        {vendors.map((vendor) => (
          <label key={vendor.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50">
            <Checkbox checked={selectedVendorIds.includes(vendor.id)} onCheckedChange={() => onToggle(vendor.id)} />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{vendor.name || 'Unnamed Vendor'}</span>
              <span className="block text-xs text-muted-foreground truncate">{vendor.email || vendor.vendorType || vendor.id}</span>
            </span>
          </label>
        ))}
        {!vendors.length && (
          <p className="p-3 text-sm text-muted-foreground">No vendors found.</p>
        )}
      </div>
    </div>
  )
}
