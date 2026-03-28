import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInvoices, saveInvoices, getLoads } from "@/lib/store";
import { useStoreData } from "@/hooks/use-store";
import { InvoiceStatus } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Filter } from "lucide-react";

const statusColor: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
};

const statusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

const statusFlow: Record<string, InvoiceStatus> = {
  draft: "sent",
  sent: "paid",
};

export default function InvoicesPage() {
  const invoices = useStoreData(getInvoices);
  const loads = useStoreData(getLoads);
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = invoices
    .filter((i) => statusFilter === "all" || i.status === statusFilter)
    .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate));

  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.amount, 0);

  const updateStatus = (id: string, status: InvoiceStatus) => {
    saveInvoices(
      invoices.map((i) =>
        i.id === id
          ? { ...i, status, paidDate: status === "paid" ? new Date().toISOString().split("T")[0] : i.paidDate }
          : i,
      ),
    );
  };

  const markOverdue = (id: string) => {
    saveInvoices(invoices.map((i) => (i.id === id ? { ...i, status: "overdue" } : i)));
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="text-emerald-600 font-medium">${totalPaid.toLocaleString()} paid</span>
            {" · "}
            <span className="text-amber-600 font-medium">${totalOutstanding.toLocaleString()} outstanding</span>
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {statusFilter !== "all" ? `No ${statusLabel[statusFilter as InvoiceStatus]?.toLowerCase()} invoices` : "No invoices yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Load</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const load = loads.find((l) => l.id === inv.loadId);
                  const next = statusFlow[inv.status];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">{inv.customer}</TableCell>
                      <TableCell className="text-sm">{load?.referenceNumber || "—"}</TableCell>
                      <TableCell className="tabular-nums text-sm">{inv.issuedDate}</TableCell>
                      <TableCell className="tabular-nums text-sm">{inv.dueDate}</TableCell>
                      <TableCell className="tabular-nums font-medium">${inv.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColor[inv.status]}>
                          {statusLabel[inv.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {next && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(inv.id, next)}>
                              Mark {statusLabel[next]}
                            </Button>
                          )}
                          {inv.status === "sent" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => markOverdue(inv.id)}
                            >
                              Overdue
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
