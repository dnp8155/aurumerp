import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, UserPlus, Pencil, Calendar, Award, GraduationCap, Plus, Trash2, Eye, Upload, TrendingUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import StatCard from "@/components/erp/StatCard";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";

export default function HR() {
  const { t } = useI18n();
  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("hr.title")} description={t("hr.desc")} />
      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees"><Users className="mr-2 h-4 w-4" /> Employees</TabsTrigger>
          <TabsTrigger value="attendance"><Calendar className="mr-2 h-4 w-4" /> Attendance</TabsTrigger>
          <TabsTrigger value="performance"><Award className="mr-2 h-4 w-4" /> Performance</TabsTrigger>
          <TabsTrigger value="training"><GraduationCap className="mr-2 h-4 w-4" /> Training</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-4"><EmployeesTab /></TabsContent>
        <TabsContent value="attendance" className="mt-4"><AttendanceTab /></TabsContent>
        <TabsContent value="performance" className="mt-4"><PerformanceTab /></TabsContent>
        <TabsContent value="training" className="mt-4"><TrainingTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function EmployeesTab() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ name: "", contact_number: "", address: "", date_of_joining: "", designation: "", department: "", branch: "", current_monthly_salary: 0, status: "active" });
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    try {
      const data = await base44.entities.Employee.list('-created_date', 500);
      setEmployees(data || []);
    } catch (err) {
      console.error("Failed to load employees", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (emp) => {
    setEditing(emp);
    setForm({ name: emp.name || "", contact_number: emp.contact_number || "", address: emp.address || "", date_of_joining: emp.date_of_joining || "", designation: emp.designation || "", department: emp.department || "", branch: emp.branch || "", current_monthly_salary: emp.current_monthly_salary || 0, status: emp.status || "active" });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await base44.entities.Employee.update(editing.id, form);
        toast({ title: "Employee updated" });
      } else {
        await base44.entities.Employee.create(form);
        toast({ title: "Employee created" });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm({ name: "", contact_number: "", address: "", date_of_joining: "", designation: "", department: "", branch: "", current_monthly_salary: 0, status: "active" });
      loadEmployees();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this employee record?")) return;
    try {
      await base44.entities.Employee.delete(id);
      toast({ title: "Employee deleted" });
      loadEmployees();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = employees.filter(e => {
    if (search && !e.name?.toLowerCase().includes(search.toLowerCase()) && !(e.contact_number || "").includes(search)) return false;
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Employees" value={employees.length} icon={Users} accent="blue" />
        <StatCard label="Active" value={employees.filter(e => e.status === "active").length} icon={Check} accent="emerald" />
        <StatCard label="Departments" value={departments.length} icon={Award} accent="violet" />
        <StatCard label="Monthly Payroll" value={`₹${employees.reduce((s, e) => s + (e.current_monthly_salary || 0), 0).toLocaleString()}`} icon={TrendingUp} accent="amber" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: "", contact_number: "", address: "", date_of_joining: "", designation: "", department: "", branch: "", current_monthly_salary: 0, status: "active" }); setDialogOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={t("hr.no_employees")} description={t("hr.desc")} />
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-sm">{e.contact_number || "—"}</TableCell>
                  <TableCell className="text-sm">{e.designation || "—"}</TableCell>
                  <TableCell className="text-sm">{e.department || "—"}</TableCell>
                  <TableCell className="text-sm">{e.branch || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.date_of_joining ? format(new Date(e.date_of_joining), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">₹{(e.current_monthly_salary || 0).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Contact Number</Label><Input value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Designation</Label><Input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Sales Executive" /></div>
              <div><Label>Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="e.g. Sales" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Branch</Label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} placeholder="e.g. Mumbai" /></div>
              <div><Label>Date of Joining</Label><Input type="date" value={form.date_of_joining} onChange={e => setForm({ ...form, date_of_joining: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Monthly Salary (₹)</Label><Input type="number" value={form.current_monthly_salary} onChange={e => setForm({ ...form, current_monthly_salary: Number(e.target.value) })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Update" : "Create"} Employee</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceTab() {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [monthSummary, setMonthSummary] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, [selectedDate]);

  const loadData = async () => {
    try {
      const [empData, attData] = await Promise.all([
        base44.entities.Employee.filter({ status: "active" }),
        base44.entities.Attendance.filter({ date: selectedDate })
      ]);
      setEmployees(empData || []);
      setAttendance(attData || []);
      setLoading(false);
      loadMonthSummary(selectedDate.slice(0, 7));
    } catch (err) {
      console.error("Failed to load attendance", err);
      setLoading(false);
    }
  };

  const loadMonthSummary = async (month) => {
    try {
      const monthStart = `${month}-01`;
      const monthEnd = `${month}-31`;
      const monthAtt = await base44.entities.Attendance.filter({ date: { $gte: monthStart, $lte: monthEnd } });
      const summary = {};
      (monthAtt || []).forEach(a => {
        if (!summary[a.employee_id]) summary[a.employee_id] = { name: a.employee_name, present: 0, absent: 0, half_day: 0, leave: 0, overtime: 0 };
        if (a.status === "present") summary[a.employee_id].present++;
        if (a.status === "absent") summary[a.employee_id].absent++;
        if (a.status === "half_day") summary[a.employee_id].half_day++;
        if (a.status === "leave") summary[a.employee_id].leave++;
        summary[a.employee_id].overtime += (a.overtime_hours || 0);
      });
      setMonthSummary(summary);
    } catch (err) {
      console.error("Failed to load month summary", err);
    }
  };

  const markAttendance = async (emp, status) => {
    try {
      const existing = attendance.find(a => a.employee_id === emp.id);
      if (existing) {
        await base44.entities.Attendance.update(existing.id, { status });
      } else {
        await base44.entities.Attendance.create({
          employee_id: emp.id,
          employee_name: emp.name,
          date: selectedDate,
          status
        });
      }
      toast({ title: `Marked ${status}`, description: emp.name });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getStatus = (empId) => attendance.find(a => a.employee_id === empId)?.status;

  const handleBiometricImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_uri,
        json_schema: {
          type: "object",
          properties: {
            records: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  employee_name: { type: "string" },
                  date: { type: "string" },
                  status: { type: "string" },
                  check_in: { type: "string" },
                  check_out: { type: "string" }
                }
              }
            }
          }
        }
      });
      const data = res.output || res;
      if (data?.records) {
        let created = 0;
        for (const rec of data.records) {
          const emp = employees.find(em => em.name?.toLowerCase().includes(rec.employee_name?.toLowerCase()));
          if (emp) {
            await base44.entities.Attendance.create({
              employee_id: emp.id,
              employee_name: emp.name,
              date: rec.date || selectedDate,
              status: rec.status || "present",
              check_in: rec.check_in,
              check_out: rec.check_out
            });
            created++;
          }
        }
        toast({ title: "Biometric import complete", description: `${created} records imported` });
        setImportOpen(false);
        loadData();
      }
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Label>Date:</Label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" /> Import Biometric CSV
        </Button>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Mark Attendance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map(emp => {
              const status = getStatus(emp.id);
              return (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.designation || "—"}</TableCell>
                  <TableCell>{status ? <StatusBadge status={status === "half_day" ? "partial" : status === "present" ? "active" : status === "absent" ? "rejected" : "pending"} label={status.replace("_", " ")} /> : <span className="text-xs text-muted-foreground">Not marked</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {["present", "absent", "half_day", "leave"].map(s => (
                        <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => markAttendance(emp, s)} className="text-xs capitalize">
                          {s.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {monthSummary && Object.keys(monthSummary).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-3">Monthly Summary — {selectedDate.slice(0, 7)}</h3>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Absent</TableHead>
                  <TableHead className="text-right">Half Day</TableHead>
                  <TableHead className="text-right">Leave</TableHead>
                  <TableHead className="text-right">Overtime (hrs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(monthSummary).map(([empId, s]) => (
                  <TableRow key={empId}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">{s.present}</TableCell>
                    <TableCell className="text-right text-red-600">{s.absent}</TableCell>
                    <TableCell className="text-right text-amber-600">{s.half_day}</TableCell>
                    <TableCell className="text-right text-blue-600">{s.leave}</TableCell>
                    <TableCell className="text-right">{s.overtime.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Import Biometric Attendance</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a CSV or Excel file from your biometric device. AI will extract employee name, date, status, and check-in/out times.</p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary transition-colors">
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleBiometricImport} />
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Click to upload file</span>
              <span className="text-xs text-muted-foreground">CSV, XLSX</span>
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PerformanceTab() {
  const [employees, setEmployees] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewEmp, setViewEmp] = useState(null);
  const [form, setForm] = useState({ employee_id: "", period: new Date().toISOString().slice(0, 7), sales_target: 0, sales_achieved: 0, attendance_pct: 0, task_completion_pct: 0, customer_rating: 0, notes: "" });
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [empData, scoreData] = await Promise.all([
        base44.entities.Employee.filter({ status: "active" }),
        base44.entities.PerformanceScore.list('-created_date', 200)
      ]);
      setEmployees(empData || []);
      setScores(scoreData || []);
    } catch (err) {
      console.error("Failed to load performance data", err);
    } finally {
      setLoading(false);
    }
  };

  const computeGrade = (score) => {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 50) return "C";
    return "D";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const emp = employees.find(em => em.id === form.employee_id);
      if (!emp) { toast({ title: "Select employee", variant: "destructive" }); return; }
      const totalScore = Math.round(
        (form.sales_achieved / Math.max(form.sales_target, 1)) * 40 +
        (form.attendance_pct / 100) * 25 +
        (form.task_completion_pct / 100) * 20 +
        (form.customer_rating / 5) * 15
      );
      const grade = computeGrade(totalScore);
      await base44.entities.PerformanceScore.create({
        employee_id: form.employee_id,
        employee_name: emp.name,
        period: form.period,
        sales_target: form.sales_target,
        sales_achieved: form.sales_achieved,
        attendance_pct: form.attendance_pct,
        task_completion_pct: form.task_completion_pct,
        customer_rating: form.customer_rating,
        total_score: totalScore,
        grade,
        bonus_recommendation: grade === "A" ? Math.round((form.sales_achieved - form.sales_target) * 0.05) : 0,
        promotion_flag: grade === "A" && totalScore >= 90,
        notes: form.notes
      });
      toast({ title: "Scorecard saved", description: `${emp.name} — Grade ${grade} (${totalScore}/100)` });
      setDialogOpen(false);
      setForm({ employee_id: "", period: new Date().toISOString().slice(0, 7), sales_target: 0, sales_achieved: 0, attendance_pct: 0, task_completion_pct: 0, customer_rating: 0, notes: "" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const empScores = (empId) => scores.filter(s => s.employee_id === empId);

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Scorecard
        </Button>
      </div>

      {scores.length === 0 ? (
        <EmptyState icon={Award} title="No scorecards yet" description="Create performance scorecards with KPIs, auto-grading, and bonus recommendations" />
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Bonus/Promo</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.employee_name}</TableCell>
                  <TableCell className="text-sm font-mono">{s.period}</TableCell>
                  <TableCell className="text-right text-sm">₹{(s.sales_achieved || 0).toLocaleString()} / ₹{(s.sales_target || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">{s.attendance_pct || 0}%</TableCell>
                  <TableCell className="text-right text-sm">{s.task_completion_pct || 0}%</TableCell>
                  <TableCell className="text-right text-sm">{s.customer_rating || 0}/5</TableCell>
                  <TableCell className="text-right font-bold">{s.total_score || 0}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${
                      s.grade === "A" ? "bg-emerald-100 text-emerald-700" :
                      s.grade === "B" ? "bg-blue-100 text-blue-700" :
                      s.grade === "C" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>{s.grade}</span>
                  </TableCell>
                  <TableCell>
                    {s.bonus_recommendation > 0 && <span className="text-xs text-emerald-600">₹{s.bonus_recommendation.toLocaleString()}</span>}
                    {s.promotion_flag && <span className="text-xs text-violet-600 ml-1">⭐ Promo</span>}
                    {!s.bonus_recommendation && !s.promotion_flag && <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setViewEmp(s)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Performance Scorecard</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee *</Label>
                <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Period (YYYY-MM)</Label><Input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} placeholder="2026-09" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Sales Target (₹)</Label><Input type="number" value={form.sales_target} onChange={e => setForm({ ...form, sales_target: Number(e.target.value) })} /></div>
              <div><Label>Sales Achieved (₹)</Label><Input type="number" value={form.sales_achieved} onChange={e => setForm({ ...form, sales_achieved: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Attendance %</Label><Input type="number" min="0" max="100" value={form.attendance_pct} onChange={e => setForm({ ...form, attendance_pct: Number(e.target.value) })} /></div>
              <div><Label>Task Completion %</Label><Input type="number" min="0" max="100" value={form.task_completion_pct} onChange={e => setForm({ ...form, task_completion_pct: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Customer Rating (1-5)</Label><Input type="number" min="0" max="5" step="0.1" value={form.customer_rating} onChange={e => setForm({ ...form, customer_rating: Number(e.target.value) })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Scorecard</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewEmp} onOpenChange={(open) => !open && setViewEmp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Scorecard — {viewEmp?.employee_name}</DialogTitle></DialogHeader>
          {viewEmp && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Period:</span> <span className="font-mono font-medium">{viewEmp.period}</span></div>
                <div><span className="text-muted-foreground">Grade:</span> <span className={`font-bold ${viewEmp.grade === "A" ? "text-emerald-600" : viewEmp.grade === "B" ? "text-blue-600" : viewEmp.grade === "C" ? "text-amber-600" : "text-red-600"}`}>{viewEmp.grade}</span></div>
                <div><span className="text-muted-foreground">Total Score:</span> <span className="font-bold">{viewEmp.total_score}/100</span></div>
                <div><span className="text-muted-foreground">Attendance:</span> <span>{viewEmp.attendance_pct}%</span></div>
                <div><span className="text-muted-foreground">Sales:</span> <span>₹{(viewEmp.sales_achieved || 0).toLocaleString()} / ₹{(viewEmp.sales_target || 0).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Tasks:</span> <span>{viewEmp.task_completion_pct}%</span></div>
                <div><span className="text-muted-foreground">Rating:</span> <span>{viewEmp.customer_rating}/5</span></div>
                <div><span className="text-muted-foreground">Bonus:</span> <span className="text-emerald-600">{viewEmp.bonus_recommendation > 0 ? `₹${viewEmp.bonus_recommendation.toLocaleString()}` : "—"}</span></div>
              </div>
              {viewEmp.promotion_flag && <div className="rounded-lg bg-violet-50 p-2 text-violet-700 text-xs">⭐ Promotion recommended</div>}
              {viewEmp.notes && <div><span className="text-muted-foreground">Notes:</span> {viewEmp.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrainingTab() {
  const [employees, setEmployees] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewProg, setViewProg] = useState(null);
  const [form, setForm] = useState({ name: "", trainer: "", description: "", start_date: "", end_date: "", duration_hours: 0, selectedAttendees: [], notes: "" });
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [empData, progData] = await Promise.all([
        base44.entities.Employee.filter({ status: "active" }),
        base44.entities.TrainingProgram.list('-created_date', 200)
      ]);
      setEmployees(empData || []);
      setPrograms(progData || []);
    } catch (err) {
      console.error("Failed to load training data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const attendees = form.selectedAttendees.map(id => {
        const emp = employees.find(em => em.id === id);
        return { employee_id: id, employee_name: emp?.name || "", completion_status: "enrolled" };
      });
      await base44.entities.TrainingProgram.create({
        name: form.name,
        trainer: form.trainer,
        description: form.description,
        start_date: form.start_date,
        end_date: form.end_date,
        duration_hours: form.duration_hours,
        attendees,
        status: "scheduled",
        notes: form.notes
      });
      toast({ title: "Training program created", description: `${attendees.length} attendees enrolled` });
      setDialogOpen(false);
      setForm({ name: "", trainer: "", description: "", start_date: "", end_date: "", duration_hours: 0, selectedAttendees: [], notes: "" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleAttendee = (id) => {
    setForm(f => ({
      ...f,
      selectedAttendees: f.selectedAttendees.includes(id)
        ? f.selectedAttendees.filter(a => a !== id)
        : [...f.selectedAttendees, id]
    }));
  };

  const updateAttendeeStatus = async (prog, empId, status) => {
    try {
      const updatedAttendees = (prog.attendees || []).map(a =>
        a.employee_id === empId ? { ...a, completion_status: status } : a
      );
      await base44.entities.TrainingProgram.update(prog.id, { attendees: updatedAttendees });
      toast({ title: `Marked ${status}` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateProgramStatus = async (prog, status) => {
    try {
      await base44.entities.TrainingProgram.update(prog.id, { status });
      toast({ title: `Program ${status}` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Training Program
        </Button>
      </div>

      {programs.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No training programs" description="Create training programs, assign attendees, and track completion" />
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Trainer</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Attendees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map(p => {
                const completed = (p.attendees || []).filter(a => a.completion_status === "completed").length;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.trainer || "—"}</TableCell>
                    <TableCell className="text-sm">{p.duration_hours || 0} hrs</TableCell>
                    <TableCell className="text-right text-sm">{completed}/{(p.attendees || []).length}</TableCell>
                    <TableCell><StatusBadge status={p.status === "scheduled" ? "pending" : p.status === "in_progress" ? "pending_qc" : p.status === "completed" ? "approved" : "rejected"} label={p.status.replace("_", " ")} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewProg(p)}><Eye className="h-4 w-4" /></Button>
                        {p.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => updateProgramStatus(p, "in_progress")}>Start</Button>}
                        {p.status === "in_progress" && <Button size="sm" variant="outline" onClick={() => updateProgramStatus(p, "completed")}>Complete</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Training Program</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Program Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Trainer</Label><Input value={form.trainer} onChange={e => setForm({ ...form, trainer: e.target.value })} /></div>
              <div><Label>Duration (hrs)</Label><Input type="number" value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date *</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div>
              <Label>Select Attendees</Label>
              <div className="max-h-40 overflow-y-auto rounded-lg border p-2 space-y-1">
                {employees.map(e => (
                  <label key={e.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                    <input type="checkbox" checked={form.selectedAttendees.includes(e.id)} onChange={() => toggleAttendee(e.id)} className="rounded" />
                    <span className="text-sm">{e.name} — {e.designation || "—"}</span>
                  </label>
                ))}
              </div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Create Program</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewProg} onOpenChange={(open) => !open && setViewProg(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewProg?.name}</DialogTitle></DialogHeader>
          {viewProg && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Trainer:</span> <span className="font-medium">{viewProg.trainer || "—"}</span></div>
                <div><span className="text-muted-foreground">Duration:</span> <span className="font-medium">{viewProg.duration_hours} hrs</span></div>
                <div><span className="text-muted-foreground">Start:</span> <span>{viewProg.start_date ? format(new Date(viewProg.start_date), "dd MMM yyyy") : "—"}</span></div>
                <div><span className="text-muted-foreground">End:</span> <span>{viewProg.end_date ? format(new Date(viewProg.end_date), "dd MMM yyyy") : "—"}</span></div>
              </div>
              {viewProg.description && <p className="text-sm">{viewProg.description}</p>}
              <div>
                <p className="text-sm font-medium mb-2">Attendees ({(viewProg.attendees || []).length})</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Update</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewProg.attendees || []).map((a, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-medium">{a.employee_name}</TableCell>
                          <TableCell><StatusBadge status={a.completion_status === "completed" ? "approved" : a.completion_status === "in_progress" ? "pending_qc" : a.completion_status === "dropped" ? "rejected" : "pending"} label={a.completion_status.replace("_", " ")} /></TableCell>
                          <TableCell className="text-right">
                            <Select value={a.completion_status} onValueChange={v => updateAttendeeStatus(viewProg, a.employee_id, v)}>
                              <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="enrolled">Enrolled</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="dropped">Dropped</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}