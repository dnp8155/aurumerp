import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, UserPlus, Pencil, Shield, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";

const MODULE_GROUPS = [
  { label: "Overview", items: [{ path: "/", label: "Dashboard" }] },
  { label: "Procurement", items: [{ path: "/vendors", label: "Vendors" }, { path: "/purchase-orders", label: "Purchase Orders" }] },
  { label: "Cataloging", items: [{ path: "/goods-receipt", label: "Goods Receipt & QC" }, { path: "/cataloging", label: "SKU Cataloging" }, { path: "/barcode-engine", label: "Barcode Engine" }, { path: "/allocations", label: "Allocations" }, { path: "/pallets", label: "Pallets & Shipments" }] },
  { label: "Inventory", items: [{ path: "/inventory", label: "Stock Overview" }, { path: "/warehouse", label: "Warehouse Dashboard" }, { path: "/stores", label: "Stores" }] },
  { label: "Sales", items: [{ path: "/pos", label: "POS & Billing" }, { path: "/returns", label: "Returns" }, { path: "/rentals", label: "Rentals" }, { path: "/repairs", label: "Repairs" }, { path: "/ecommerce", label: "E-commerce" }] },
  { label: "Finance", items: [{ path: "/finance", label: "Finance & GST" }, { path: "/custom-reports", label: "Custom Reports" }] },
  { label: "HR", items: [{ path: "/hr", label: "HR Management" }] },
  { label: "Administration", items: [{ path: "/alerts", label: "Anomaly Alerts" }, { path: "/audit-trail", label: "Audit Trail" }, { path: "/settings", label: "Settings" }, { path: "/user-roles", label: "User Roles" }, { path: "/help", label: "Help" }] }
];

const ROLE_LABELS = {
  admin: "Admin",
  ho: "Head Office",
  store_manager: "Store Manager",
  accountant: "Accountant",
  user: "User"
};

const ROLE_STYLES = {
  admin: "bg-violet-100 text-violet-700",
  ho: "bg-blue-100 text-blue-700",
  store_manager: "bg-emerald-100 text-emerald-700",
  accountant: "bg-amber-100 text-amber-700",
  user: "bg-slate-100 text-slate-700"
};

export default function UserRoles() {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [userData, storeData] = await Promise.all([
        base44.entities.User.list('-created_date', 100),
        base44.entities.Store.list()
      ]);
      setUsers(userData || []);
      setStores(storeData || []);
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      toast({ title: "Invitation sent", description: `Invited ${inviteEmail} as ${ROLE_LABELS[inviteRole]}` });
      setInviteEmail("");
      setInviteRole("user");
      setInviteOpen(false);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <PageHeader title={t("ur.title")} description={t("ur.desc")}>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Invite User
        </Button>
      </PageHeader>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" description="Invite team members to give them access" />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${ROLE_STYLES[u.role] || ROLE_STYLES.user}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{u.department || "—"}</TableCell>
                  <TableCell className="text-sm">{u.store_name || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {u.role === "admin" ? (
                      <span className="text-xs text-muted-foreground">All modules</span>
                    ) : (u.module_access || []).length > 0 ? (
                      <span className="text-xs">{u.module_access.length} modules</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not configured</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.is_active === false ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600"><X className="h-3 w-3" /> Inactive</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> Active</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditUser(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address *</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">After invitation, edit the user to set department, store, and module access.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editUser && (
        <EditAccessDialog
          user={editUser}
          stores={stores}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); loadData(); }}
        />
      )}
    </div>
  );
}

function EditAccessDialog({ user, stores, onClose, onSaved }) {
  const [role, setRole] = useState(user.role || "user");
  const [department, setDepartment] = useState(user.department || "");
  const [storeId, setStoreId] = useState(user.store_id || "");
  const [moduleAccess, setModuleAccess] = useState(user.module_access || []);
  const [isActive, setIsActive] = useState(user.is_active !== false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const toggleModule = (path) => {
    setModuleAccess(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
  };

  const toggleGroup = (group) => {
    const allPaths = group.items.map(i => i.path);
    const allSelected = allPaths.every(p => moduleAccess.includes(p));
    if (allSelected) {
      setModuleAccess(prev => prev.filter(p => !allPaths.includes(p)));
    } else {
      setModuleAccess(prev => [...new Set([...prev, ...allPaths])]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedStore = stores.find(s => s.id === storeId);
      await base44.entities.User.update(user.id, {
        role,
        department: department || undefined,
        store_id: storeId || undefined,
        store_name: selectedStore?.name || undefined,
        module_access: role === "admin" ? [] : moduleAccess,
        is_active: isActive
      });
      toast({ title: "User access updated", description: `${user.full_name || user.email} — ${ROLE_LABELS[role]}` });
      onSaved();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Access — {user.full_name || user.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Full Access)</SelectItem>
                  <SelectItem value="ho">Head Office</SelectItem>
                  <SelectItem value="store_manager">Store Manager</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="head_office">Head Office</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Assigned Store</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue placeholder="No store assigned" /></SelectTrigger>
              <SelectContent>
                {(stores || []).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role !== "admin" ? (
            <div>
              <Label className="mb-2 block">Module Access</Label>
              <p className="text-xs text-muted-foreground mb-3">Select which modules this user can access. Admin role gets full access automatically.</p>
              <div className="space-y-3 rounded-xl border p-4">
                {MODULE_GROUPS.map((group) => {
                  const allPaths = group.items.map(i => i.path);
                  const allSelected = allPaths.every(p => moduleAccess.includes(p));
                  return (
                    <div key={group.label}>
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox checked={allSelected} onCheckedChange={() => toggleGroup(group)} />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 ml-6">
                        {group.items.map((item) => (
                          <label key={item.path} className="flex items-center gap-2 cursor-pointer text-sm">
                            <Checkbox checked={moduleAccess.includes(item.path)} onCheckedChange={() => toggleModule(item.path)} />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-violet-50 p-3 text-sm text-violet-700">
              <Shield className="inline mr-2 h-4 w-4" />
              Admin role has full access to all modules.
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>User is active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}