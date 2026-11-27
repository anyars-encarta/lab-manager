/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import {
  Building2,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Download,
  Edit,
  FlaskConical,
  FileText,
  Eye,
  Microscope,
  Plus,
  Search,
  ShieldCheck,
  Power,
  UserCog,
  Users,
} from "lucide-react";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { openPaystackCheckout } from "@/lib/paystack-inline";
import { DataTablePagination } from "@/components/refine-ui/data-table/data-table-pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Props = {
  section:
    | "patients"
    | "orders"
    | "investigations"
    | "facilities"
    | "users"
    | "reports"
    | "claims";
};

const titles = {
  patients: ["Patients", "Register and find patient records", Users],
  orders: [
    "Laboratory orders",
    "Create and track test requests",
    ClipboardList,
  ],
  investigations: [
    "Investigations",
    "Configure laboratory tests and parameters",
    Microscope,
  ],
  facilities: ["Facilities", "Manage laboratory facility details", Building2],
  users: ["User management", "Create accounts and assign roles", UserCog],
  reports: ["Reports", "Generate laboratory activity reports", FlaskConical],
  claims: ["NHIA claims", "Generate NHIA claim batches", ShieldCheck],
} as const;

export function LaboratoryWorkspace({ section }: Props) {
  const { data: identity } = useGetIdentity<{
    role?: "admin" | "frontdesk" | "account" | "technician" | "doctor";
  }>();
  const role = identity?.role;
  const canCreate =
    role === "admin" ||
    (section === "patients" && role === "frontdesk") ||
    (section === "orders" && role === "frontdesk") ||
    (section === "reports" && role === "doctor");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [claimsMode, setClaimsMode] = useState<"generate" | "export">("generate");
  const [claimFrom, setClaimFrom] = useState("");
  const [claimTo, setClaimTo] = useState("");
  const [claimPage, setClaimPage] = useState(1);
  const [claimPageSize, setClaimPageSize] = useState(20);
  const [claimTotal, setClaimTotal] = useState(0);
  const [claimGrandTotal, setClaimGrandTotal] = useState("0.00");
  const [claimDetails, setClaimDetails] = useState<any>(null);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(20);
  const [orderTotal, setOrderTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [facilities, setFacilities] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userImage, setUserImage] = useState("");
  const [uploadingUserImage, setUploadingUserImage] = useState(false);
  const userUploadSession = useRef(0);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paystackReference, setPaystackReference] = useState<{
    orderId: string;
    reference: string;
  } | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [resultOrder, setResultOrder] = useState<any>(null);
  const [resultDraft, setResultDraft] = useState<Record<string, {
    value: string;
    abnormalFlag?: "normal" | "high" | "low" | "critical";
    remarks: string;
  }>>({});
  const [resultSaving, setResultSaving] = useState(false);
  const [resultError, setResultError] = useState("");
  const resultRequestGeneration = useRef(0);
  const resultDraftRef = useRef<Record<string, {
    value: string;
    abnormalFlag?: "normal" | "high" | "low" | "critical";
    remarks: string;
  }>>({});
  const requestGeneration = useRef(0);
  const [TitleIcon] = [titles[section][2]];
  useEffect(() => {
    resultDraftRef.current = resultDraft;
  }, [resultDraft]);

  const load = async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadError("");
    setRows([]);
    try {
      const paths: Record<Props["section"], string> = {
        patients: "/api/patients",
        orders: "/api/orders",
        investigations: "/api/investigations",
        facilities: "/api/facilities",
        users: "/api/users",
        reports: "/api/reports/summary",
        claims: "/api/nhia/claims/individual",
      };
      const query = section === "claims"
        ? `?${new URLSearchParams({
            page: String(claimPage),
            pageSize: String(claimPageSize),
            ...(claimFrom ? { from: claimFrom } : {}),
            ...(claimTo ? { to: claimTo } : {}),
          }).toString()}`
        : section === "orders"
        ? `?${new URLSearchParams({
            page: String(orderPage),
            pageSize: String(orderPageSize),
            ...(search.trim() ? { search: search.trim() } : {}),
          }).toString()}`
        : "";
      const response = await fetch(`${API_URL}${paths[section]}${query}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      if (generation !== requestGeneration.current) return;
      if (section === "claims" && data && !Array.isArray(data)) {
        setRows(Array.isArray(data.data) ? data.data : []);
        setClaimTotal(Number(data.total || 0));
        setClaimGrandTotal(String(data.grandTotal || "0.00"));
      } else if (section === "orders" && data && !Array.isArray(data)) {
        setRows(Array.isArray(data.data) ? data.data : []);
        setOrderTotal(Number(data.total || 0));
      } else {
        setRows(Array.isArray(data) ? data : data ? [data] : []);
      }
      if (section !== "facilities") {
        try {
          const lookupResponse = await fetch(`${API_URL}/api/facilities`, {
            credentials: "include",
          });
          if (!lookupResponse.ok) throw new Error("Unable to load facilities");
          const facilitiesData = await lookupResponse.json();
          if (generation === requestGeneration.current)
            setFacilities(Array.isArray(facilitiesData) ? facilitiesData : []);
        } catch (error) {
          if (generation === requestGeneration.current)
            setLoadError(
              error instanceof Error
                ? error.message
                : "Unable to load lookup data",
            );
        }
      }
      if (section === "orders") {
        try {
          const [investigationResponse, patientResponse] = await Promise.all([
            (async () => {
              const investigations: any[] = [];
              let page = 1;
              while (true) {
                const response = await fetch(
                  `${API_URL}/api/investigations?page=${page}&pageSize=100`,
                  { credentials: "include" },
                );
                if (!response.ok)
                  throw new Error("Unable to load investigations");
                const payload = await response.json();
                const rows = Array.isArray(payload.data)
                  ? payload.data
                  : Array.isArray(payload)
                  ? payload
                  : [];
                investigations.push(...rows);
                if (
                  rows.length === 0 ||
                  investigations.length >=
                    Number(payload.total || investigations.length)
                )
                  break;
                page += 1;
              }
              return investigations;
            })(),
            fetch(`${API_URL}/api/patients`, { credentials: "include" }),
          ]);
          if (!patientResponse.ok) throw new Error("Unable to load patients");
          const [investigationsData, patientsData] = await Promise.all([
            investigationResponse,
            patientResponse.json(),
          ]);
          if (generation === requestGeneration.current) {
            setInvestigations(
              Array.isArray(investigationsData) ? investigationsData : [],
            );
            setPatients(Array.isArray(patientsData) ? patientsData : []);
          }
        } catch (error) {
          if (generation === requestGeneration.current)
            setLoadError(
              error instanceof Error
                ? error.message
                : "Unable to load lookup data",
            );
        }
      }
    } catch (error) {
      if (generation === requestGeneration.current) {
        setRows([]);
        setLoadError(
          error instanceof Error ? error.message : "Unable to load records",
        );
      }
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };

  const invalidateUserUploadSession = () => {
    userUploadSession.current += 1;
    setUploadingUserImage(false);
  };

  useEffect(() => {
    invalidateUserUploadSession();
    setRows([]);
    setLoadError("");
    setSubmissionError("");
    setEditingUser(null);
    setUserImage("");
    setSearch("");
    void load();
  }, [section]);

  useEffect(() => {
    if (section === "claims") void load();
  }, [section, claimPage, claimPageSize, claimFrom, claimTo]);

  useEffect(() => {
    if (section === "orders") void load();
  }, [section, orderPage, orderPageSize]);
  useEffect(() => {
    if (section === "orders") {
      setOrderPage(1);
      void load();
    }
  }, [search]);

  const uploadUserImage = async (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Please select a PNG or JPEG image");
      return;
    }
    const session = ++userUploadSession.current;
    setUploadingUserImage(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read image"));
        reader.readAsDataURL(file);
      });
      if (session !== userUploadSession.current) return;
      const response = await fetch(`${API_URL}/api/users/image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      });
      if (session !== userUploadSession.current) return;
      const result = await response.json().catch(() => null);
      if (session !== userUploadSession.current) return;
      if (!response.ok || !result?.secureUrl) {
        throw new Error(result?.error || "Unable to upload image");
      }
      setUserImage(result.secureUrl);
      toast.success("Image uploaded");
    } catch (error) {
      if (session === userUploadSession.current) {
        toast.error(error instanceof Error ? error.message : "Unable to upload image");
      }
    } finally {
      if (session === userUploadSession.current) {
        setUploadingUserImage(false);
      }
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (section === "users" && uploadingUserImage) {
      toast.error("Please wait for the image upload to finish");
      return;
    }
    setSaving(true);
    setMessage("");
    setSubmissionError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    const pathMap: Partial<Record<Props["section"], string>> = {
      patients: "/api/patients",
      investigations: "/api/investigations",
      facilities: "/api/facilities",
      users: "/api/users",
    };
    let reportGeneration: number | null = null;
    try {
      if (section === "orders") {
        const selected = String(values.investigationIds).split(",");
        const payload = {
          facilityId: values.facilityId,
          patientId: values.patientId,
          clinicianName: values.clinicianName,
          claimCheckCode: values.claimCheckCode,
          investigationIds: selected,
        };
        const response = await fetch(`${API_URL}/api/orders`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Unable to create order",
          );
        toast.success("Laboratory request created", {
          description: "The investigation request and charges were saved.",
        });
      } else if (section === "reports") {
        reportGeneration = ++requestGeneration.current;
        setLoading(true);
        setLoadError("");
        const response = await fetch(
          `${API_URL}/api/reports/summary?from=${values.from}&to=${values.to}`,
          { credentials: "include" },
        );
        if (!response.ok) throw new Error("Unable to generate report");
        const report = await response.json();
        if (reportGeneration === requestGeneration.current) {
          setRows([report]);
          setLoading(false);
          setMessage("Report generated successfully");
          toast.success("Laboratory report generated", {
            description: "The selected reporting period is ready.",
          });
          setDialogOpen(false);
        }
        return;
      } else if (section === "claims") {
        if (claimsMode === "export") {
          const params = new URLSearchParams({
            from: String(values.from),
            to: String(values.to),
          });
          const response = await fetch(`${API_URL}/api/nhia/claims/export?${params}`, {
            credentials: "include",
          });
          if (!response.ok) {
            throw new Error((await response.json()).error || "Unable to export NHIA claims");
          }
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = downloadUrl;
          anchor.download = `nhia-claims-${values.from}-${values.to}.xml`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(downloadUrl);
          toast.success("NHIA claims exported", {
            description: "The XML file was downloaded.",
          });
          setDialogOpen(false);
          return;
        }
        const response = await fetch(`${API_URL}/api/nhia/claims`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claimPeriodStart: new Date(
              `${values.from}T00:00:00Z`,
            ).toISOString(),
            claimPeriodEnd: (() => {
              const end = new Date(`${values.to}T00:00:00Z`);
              end.setUTCDate(end.getUTCDate() + 1);
              return end.toISOString();
            })(),
          }),
        });
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Unable to generate claim",
          );
        toast.success("NHIA claim generated", {
          description: "The claim was created for the selected period.",
        });
      } else {
        const path = pathMap[section];
        if (!path) return;
        let payload: Record<string, unknown> = values;
        if (section === "users") {
          payload = editingUser
            ? {
                name: values.name,
                email: values.email,
                role: values.role,
                image: userImage || null,
              }
            : {
                name: values.name,
                email: values.email,
                password: values.password,
                role: values.role,
                image: userImage || null,
              };
        }
        if (section === "patients") {
          payload = {
            ...values,
            dateOfBirth: values.dateOfBirth
              ? new Date(`${values.dateOfBirth}T00:00:00Z`).toISOString()
              : undefined,
          };
        }
        if (section === "investigations")
          payload = {
            ...values,
            coveredTariff: Number(values.coveredTariff || 0),
            uncoveredTariff: Number(values.uncoveredTariff || 0),
            topUp: Number(values.topUp || 0),
          };
        const requestPath = editingUser ? `${path}/${editingUser.id}` : path;
        const response = await fetch(`${API_URL}${requestPath}`, {
          method: editingUser ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Unable to save record",
          );
        toast.success(
          section === "users"
            ? editingUser ? "User account updated" : "User account created"
            : "Setup record saved",
          {
            description:
              section === "users"
                ? editingUser
                  ? "The account details, role, and image were saved."
                  : "The new account and role were saved."
                : "The setup information was saved successfully.",
          },
        );
      }
      setMessage("Saved successfully");
      if (section === "users") {
        setEditingUser(null);
        invalidateUserUploadSession();
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Unable to complete operation", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
      if (
        reportGeneration === null ||
        reportGeneration === requestGeneration.current
      ) {
        setSubmissionError(
          error instanceof Error ? error.message : "Unable to save record",
        );
      }
      if (
        reportGeneration !== null &&
        reportGeneration === requestGeneration.current
      ) {
        setLoading(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const openPayment = async (order: any) => {
    const outstanding = Math.max(
      0,
      Number(order.totalAmount || 0) - Number(order.paidAmount || 0),
    );
    let detailedOrder = order;
    try {
      const response = await fetch(`${API_URL}/api/orders/${order.id}`, {
        credentials: "include",
      });
      if (response.ok) detailedOrder = await response.json();
    } catch {
      // The list row already contains the balance needed for payment entry.
    }
    setPaymentOrder(detailedOrder);
    setPaymentMethod("cash");
    setPaymentAmount(outstanding.toFixed(2));
    setPaymentReference("");
    setPaystackReference(null);
    setPaymentError("");
  };

  const recordPayment = async (reference?: string) => {
    if (!paymentOrder) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }
    setPaymentSaving(true);
    setPaymentError("");
    try {
      const response = await fetch(
        `${API_URL}/api/orders/${paymentOrder.id}/payments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            method: paymentMethod,
            reference: reference || paymentReference || undefined,
          }),
        },
      );
      const payment = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payment?.error || "Unable to receive payment");
      setPaystackReference(null);
      toast.success("Payment received", {
        description: `Receipt ${payment.receiptNumber} was created.`,
      });
      setPaymentOrder(null);
      await load();

      try {
        const receiptResponse = await fetch(
          `${API_URL}/api/payments/${payment.id}/receipt`,
          { credentials: "include" },
        );
        if (!receiptResponse.ok) throw new Error("Receipt request failed");
        const blob = await receiptResponse.blob();
        const receiptUrl = URL.createObjectURL(blob);
        window.open(receiptUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(receiptUrl), 60_000);
      } catch {
        toast.error("Payment received", {
          description: "The receipt could not be opened.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to receive payment";
      setPaymentError(message);
      toast.error("Payment not recorded", { description: message });
    } finally {
      setPaymentSaving(false);
    }
  };

  const startPayment = async () => {
    if (paymentMethod !== "mobile_money") {
      await recordPayment();
      return;
    }
    if (paystackReference && paystackReference.orderId === paymentOrder.id) {
      await recordPayment(paystackReference.reference);
      return;
    }
    try {
      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setPaymentError("Enter a valid payment amount.");
        return;
      }
      const configResponse = await fetch(
        `${API_URL}/api/payments/paystack/config`,
        { credentials: "include" },
      );
      const config = await configResponse.json();
      if (!configResponse.ok || !config.publicKey)
        throw new Error("Paystack public key is not configured");
      const patientName = `${paymentOrder.patient?.firstName || ""} ${
        paymentOrder.patient?.lastName || ""
      }`.trim();
      await openPaystackCheckout({
        key: config.publicKey,
        email: paymentOrder.patient?.email || "patient@lab.local",
        amount,
        currency: "GHS",
        reference: `LAB-${paymentOrder.orderNumber}-${crypto
          .randomUUID()
          .slice(0, 8)}`,
        firstname: paymentOrder.patient?.firstName,
        lastname: paymentOrder.patient?.lastName,
        phone: paymentOrder.patient?.phone,
        metadata: { orderId: paymentOrder.id, patientName },
        onSuccess: (response) => {
          const reference =
            response.reference ||
            response.trxref ||
            response.trans ||
            response.transaction;
          if (!reference) {
            setPaymentError("Paystack returned no payment reference.");
            return;
          }
          const retainedReference = String(reference);
          setPaystackReference({
            orderId: paymentOrder.id,
            reference: retainedReference,
          });
          void recordPayment(retainedReference);
        },
        onClose: () => toast.info("Paystack checkout closed"),
      });
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Unable to open Paystack",
      );
    }
  };

  const openResults = async (order: any, preserveUnsaved = false) => {
    const generation = ++resultRequestGeneration.current;
    setResultError("");
    if (!preserveUnsaved) {
      setResultDraft({});
      resultDraftRef.current = {};
      setResultOrder(null);
    }
    try {
      const response = await fetch(`${API_URL}/api/orders/${order.id}`, {
        credentials: "include",
      });
      const detailed = await response.json().catch(() => null);
      if (generation !== resultRequestGeneration.current) return;
      if (!response.ok) throw new Error(detailed?.error || "Unable to load laboratory order");
      const draft: typeof resultDraft = {};
      for (const item of detailed.items || []) {
        for (const parameter of item.parameters || []) {
          const existing = (item.results || []).find(
            (result: any) => result.parameterId === parameter.id,
          );
          const persistedDraft = {
            value: existing?.value || "",
            abnormalFlag: existing?.abnormalFlag || undefined,
            remarks: existing?.remarks || "",
          };
          const key = `${item.id}:${parameter.id}`;
          draft[key] = preserveUnsaved
            ? resultDraftRef.current[key] || persistedDraft
            : persistedDraft;
        }
      }
      resultDraftRef.current = draft;
      setResultDraft(draft);
      setResultOrder(detailed);
    } catch (error) {
      if (generation !== resultRequestGeneration.current) return;
      toast.error(error instanceof Error ? error.message : "Unable to open result capture");
    }
  };

  const saveResults = async (item: any) => {
    setResultSaving(true);
    setResultError("");
    try {
      const results = (item.parameters || [])
        .filter((parameter: any) => parameter.active)
        .map((parameter: any) => ({
          parameterId: parameter.id,
          value: resultDraft[`${item.id}:${parameter.id}`]?.value || "",
          remarks: resultDraft[`${item.id}:${parameter.id}`]?.remarks || "",
        }));
      if (results.some((result: any) => !result.value.trim())) {
        throw new Error("Enter a value for every active parameter");
      }
      const response = await fetch(
        `${API_URL}/api/orders/${resultOrder.id}/items/${item.id}/results`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results }),
        },
      );
      const saved = await response.json().catch(() => null);
      if (!response.ok) throw new Error(saved?.error || "Unable to save results");
      toast.success("Results saved", {
        description: `${item.investigation?.name || "Investigation"} results were captured.`,
      });
      await openResults(resultOrder, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save results";
      setResultError(message);
      toast.error("Result capture failed", { description: message });
    } finally {
      setResultSaving(false);
    }
  };

  const completeResultOrder = async () => {
    if (!resultOrder) return;
    const dirtyDraft = (resultOrder.items || []).some((item: any) =>
      (item.parameters || []).filter((parameter: any) => parameter.active).some((parameter: any) => {
        const key = `${item.id}:${parameter.id}`;
        const draft = resultDraftRef.current[key];
        const persisted = (item.results || []).find(
          (result: any) => result.parameterId === parameter.id,
        );
        return !draft ||
          draft.value.trim() !== (persisted?.value || "").trim() ||
          draft.remarks !== (persisted?.remarks || "");
      }),
    );
    if (dirtyDraft) {
      const message = "Save or revert all changed results before completing the report.";
      setResultError(message);
      toast.error("Unsaved result changes", { description: message });
      return;
    }
    setResultSaving(true);
    setResultError("");
    try {
      const response = await fetch(`${API_URL}/api/orders/${resultOrder.id}/complete`, {
        method: "POST",
        credentials: "include",
      });
      const completed = await response.json().catch(() => null);
      if (!response.ok) throw new Error(completed?.error || "Unable to complete report");
      toast.success("Report completed");
      ++resultRequestGeneration.current;
      resultDraftRef.current = {};
      setResultDraft({});
      setResultOrder(null);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete report";
      setResultError(message);
      toast.error("Report could not be completed", { description: message });
    } finally {
      setResultSaving(false);
    }
  };

  const exportFilteredClaims = async () => {
    try {
      const params = new URLSearchParams();
      if (claimFrom) params.set("from", claimFrom);
      if (claimTo) params.set("to", claimTo);
      const response = await fetch(`${API_URL}/api/nhia/claims/export?${params}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error((await response.json()).error || "Unable to export claims");
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `nhia-claims-${claimFrom || "all"}-${claimTo || "dates"}.xml`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      toast.success("NHIA claims exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export claims");
    }
  };

  const exportIndividualClaim = async (claim: any) => {
    try {
      const response = await fetch(`${API_URL}/api/nhia/claims/individual/${claim.id}/export`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error((await response.json()).error || "Unable to export claim");
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${claim.claimId}.xml`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      toast.success("NHIA claim exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export claim");
    }
  };

  const openLaboratoryReport = async (order: any, download = false) => {
    try {
      const response = await fetch(`${API_URL}/api/orders/${order.id}/report`, {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Unable to open laboratory report");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${order.orderNumber}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open laboratory report");
    }
  };

  const filtered =
    section === "orders"
      ? rows
      : rows.filter((row) =>
          JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
        );
  const [title, description] = titles[section];

  return (
    <div className="space-y-5 pb-8">
      <Breadcrumb />
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
          <p className="text-sm font-medium text-blue-600">
            Laboratory operations
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <TitleIcon className="h-7 w-7" />
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {canCreate &&
          [
            "patients",
            "orders",
            "investigations",
            "facilities",
            "users",
            "reports",
            "claims",
          ].includes(section) && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                invalidateUserUploadSession();
                setEditingUser(null);
                setUserImage("");
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 cursor-pointer" onClick={() => {
                  invalidateUserUploadSession();
                  setEditingUser(null);
                  setUserImage("");
                  if (section === "claims") setClaimsMode("generate");
                }}>
                  <Plus className="h-4 w-4" />
                  {section === "claims"
                    ? "Generate claim"
                    : section === "reports"
                    ? "Generate report"
                    : `New ${
                        section === "investigations"
                          ? "investigation"
                          : section === "users"
                          ? "user"
                          : section === "facilities"
                          ? "facility"
                          : section.slice(0, -1)
                      }`}
                </Button>
              </DialogTrigger>
              <DialogContent 
              className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
              onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
              >
                <form onSubmit={submit}>
                  <DialogHeader>
                    <DialogTitle>
                      {section === "claims"
                        ? claimsMode === "export"
                          ? "Export NHIA claims"
                          : "Generate NHIA claim"
                        : section === "reports"
                        ? "Generate laboratory report"
                        : editingUser
                        ? "Edit user"
                        : `Create ${
                            section === "investigations"
                              ? "investigation"
                              : section === "users"
                              ? "user"
                              : section === "facilities"
                              ? "facility"
                              : section.slice(0, -1)
                          }`}
                    </DialogTitle>
                    <DialogDescription>
                      Complete the information below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-5">
                    {section === "patients" && (
                      <>
                        <FacilityField facilities={facilities} />
                        <div className="grid grid-cols-2 gap-3">
                          <Field name="firstName" label="First name" required />
                          <Field name="lastName" label="Last name" required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field name="phone" label="Phone" />
                          <Field name="gender" label="Gender" />
                        </div>
                        <Field name="dateOfBirth" label="Date of birth" type="date" />
                        <Field name="nhisNumber" label="NHIS number" />
                      </>
                    )}
                    {section === "users" && (
                      <>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16">
                            {userImage && <AvatarImage src={userImage} alt={editingUser?.name || "User"} />}
                            <AvatarFallback>{(editingUser?.name || "U").split(" ").slice(0, 2).map((part: string) => part[0]).join("").toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 space-y-2">
                            <Label htmlFor="userImage">Profile image</Label>
                            <Input
                              id="userImage"
                              type="file"
                              accept="image/png,image/jpeg"
                              disabled={uploadingUserImage}
                              className="cursor-pointer"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadUserImage(file);
                                event.target.value = "";
                              }}
                            />
                            <p className="text-xs text-muted-foreground">PNG or JPEG · Maximum 5 MB</p>
                          </div>
                        </div>
                        <Field name="name" label="Full name" required defaultValue={editingUser?.name} />
                        <Field
                          name="email"
                          label="Email"
                          type="email"
                          required
                          defaultValue={editingUser?.email}
                        />
                        {!editingUser && (
                          <Field
                            name="password"
                            label="Password"
                            type="password"
                            required
                          />
                        )}
                        <RoleField defaultValue={editingUser?.role} />
                      </>
                    )}
                    {section === "facilities" && (
                      <>
                        <Field name="name" label="Facility name" required />
                        <Field name="code" label="Facility code" />
                        <Field name="address" label="Address" />
                        <Field name="phone" label="Phone" />
                        <Field
                          name="nhiaFacilityCode"
                          label="NHIA facility code"
                        />
                      </>
                    )}
                    {section === "investigations" && (
                      <>
                        <Field name="gdrgCode" label="G-DRG code" />
                        <Field
                          name="name"
                          label="Investigation name"
                          required
                        />
                        <Field name="specimenType" label="Specimen type" />
                        <div className="grid grid-cols-3 gap-3">
                          <Field
                            name="coveredTariff"
                            label="Covered tariff"
                            type="number"
                            step="0.01"
                          />
                          <Field
                            name="topUp"
                            label="Top-up"
                            type="number"
                            step="0.01"
                          />
                          <Field
                            name="uncoveredTariff"
                            label="Uncovered tariff"
                            type="number"
                            step="0.01"
                          />
                        </div>
                      </>
                    )}
                    {section === "orders" && (
                      <>
                        <FacilityField facilities={facilities} />
                        <PatientField patients={patients} />
                        <Field name="clinicianName" label="Clinician" />
                        <Field name="claimCheckCode" label="Claims Check Code (CCC)" />
                        <InvestigationField investigations={investigations} />
                      </>
                    )}
                    {section === "reports" && (
                      <>
                        <FacilityField facilities={facilities} />
                        <div className="grid grid-cols-2 gap-3">
                          <Field
                            name="from"
                            label="From"
                            type="date"
                            required
                          />
                          <Field name="to" label="To" type="date" required />
                        </div>
                      </>
                    )}
                    {section === "claims" && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          name="from"
                          label="From"
                          type="date"
                          required
                        />
                        <Field name="to" label="To" type="date" required />
                      </div>
                    )}
                  </div>
                  {submissionError && (
                    <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {submissionError}
                    </p>
                  )}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        invalidateUserUploadSession();
                        setDialogOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving || (section === "users" && uploadingUserImage)} className="cursor-pointer">
                      {section === "users" && uploadingUserImage
                        ? "Uploading..."
                        : saving
                          ? "Saving..."
                          : section === "claims" && claimsMode === "export"
                            ? "Export XML"
                            : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
      </section>

      {loadError && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}
      {message && (
        <p className="rounded-md border bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {section === "reports" ? (
        <ReportView row={rows[0]} />
      ) : (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Records</CardTitle>
                <CardDescription>
                  {section === "claims"
                    ? `${claimTotal} record(s) · Grand Total: GH₵ ${Number(claimGrandTotal).toFixed(2)}`
                    : section === "orders"
                    ? `${orderTotal} record(s)`
                    : `${filtered.length} record(s)`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {section === "claims" && role === "admin" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="whitespace-nowrap">From</Label>
                      <Input
                        type="date"
                        className="h-9 w-36"
                        value={claimFrom}
                        onChange={(event) => {
                          setClaimFrom(event.target.value);
                          setClaimPage(1);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="whitespace-nowrap">To</Label>
                      <Input
                        type="date"
                        className="h-9 w-36"
                        value={claimTo}
                        onChange={(event) => {
                          setClaimTo(event.target.value);
                          setClaimPage(1);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer gap-2"
                      onClick={() => void exportFilteredClaims()}
                    >
                      <Download className="h-4 w-4" />
                      Export XML
                    </Button>
                  </>
                )}
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search records..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No records found
              </div>
            ) : (
              <RecordTable
                section={section}
                rows={filtered}
                canReceivePayment={role === "admin" || role === "account"}
                canCaptureResults={role === "admin" || role === "technician"}
                canViewReports={role === "admin" || role === "frontdesk" || role === "account" || role === "technician" || role === "doctor"}
                onReceivePayment={(order) => void openPayment(order)}
                onCaptureResults={(order) => void openResults(order)}
                onOpenReport={(order) => void openLaboratoryReport(order)}
                onDownloadReport={(order) => void openLaboratoryReport(order, true)}
                onViewClaim={(claim) => setClaimDetails(claim)}
                onExportClaim={(claim) => void exportIndividualClaim(claim)}
                onEditUser={(user) => {
                  invalidateUserUploadSession();
                  setEditingUser(user);
                  setUserImage(user.image || "");
                  setDialogOpen(true);
                }}
                onToggleUser={async (user) => {
                  try {
                    const response = await fetch(`${API_URL}/api/users/${user.id}`, {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ active: !user.active }),
                    });
                    const result = await response.json().catch(() => null);
                    if (!response.ok) throw new Error(result?.error || "Unable to update user");
                    toast.success(user.active ? "User disabled" : "User enabled");
                    await load();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to update user");
                  }
                }}
              />
            )}
          </CardContent>
          {section === "claims" && (
            <div className="border-t px-4 py-3">
              <DataTablePagination
                currentPage={claimPage}
                pageCount={Math.max(1, Math.ceil(claimTotal / claimPageSize))}
                setCurrentPage={setClaimPage}
                pageSize={claimPageSize}
                setPageSize={(size) => {
                  setClaimPageSize(size);
                  setClaimPage(1);
                }}
                total={claimTotal}
              />
            </div>
          )}
          {section === "orders" && (
            <div className="border-t px-4 py-3">
              <DataTablePagination
                currentPage={orderPage}
                pageCount={Math.max(1, Math.ceil(orderTotal / orderPageSize))}
                setCurrentPage={setOrderPage}
                pageSize={orderPageSize}
                setPageSize={(size) => {
                  setOrderPageSize(size);
                  setOrderPage(1);
                }}
                total={orderTotal}
              />
            </div>
          )}
        </Card>
      )}
      <Dialog open={claimDetails != null} onOpenChange={(open) => !open && setClaimDetails(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>NHIA claim details</DialogTitle>
            <DialogDescription>
              {claimDetails?.claimId || "Individual claim"}
            </DialogDescription>
          </DialogHeader>
          {claimDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Patient</span><p className="font-medium">{claimDetails.patientName}</p></div>
                <div><span className="text-muted-foreground">NHIA number</span><p className="font-medium">{claimDetails.nhisNumber || "—"}</p></div>
                <div><span className="text-muted-foreground">Patient number</span><p className="font-medium">{claimDetails.patientNumber || "—"}</p></div>
                <div><span className="text-muted-foreground">CCC</span><p className="font-medium">{claimDetails.claimCheckCode || "—"}</p></div>
                <div><span className="text-muted-foreground">Service date</span><p className="font-medium">{claimDetails.createdAt ? new Date(claimDetails.createdAt).toLocaleDateString() : "—"}</p></div>
                <div><span className="text-muted-foreground">Total cost</span><p className="font-medium">GH₵ {Number(claimDetails.totalAmount || 0).toFixed(2)}</p></div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Investigations</p>
                <div className="space-y-2">
                  {claimDetails.investigations?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">G-DRG: {item.gdrgCode || "—"}</p></div>
                      <span>GH₵ {Number(item.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setClaimDetails(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={resultOrder != null}
        onOpenChange={(open) => {
          if (!open && !resultSaving) {
            ++resultRequestGeneration.current;
            resultDraftRef.current = {};
            setResultDraft({});
            setResultOrder(null);
            setResultError("");
          }
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Capture laboratory results</DialogTitle>
            <DialogDescription>
              {resultOrder
                ? `${resultOrder.orderNumber} · ${resultOrder.patient?.firstName || ""} ${resultOrder.patient?.lastName || ""}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {resultOrder?.items?.map((item: any) => (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{item.investigation?.name || "Investigation"}</CardTitle>
                  <CardDescription>
                    {item.investigation?.specimenType || "Specimen"} · {item.parameters?.filter((p: any) => p.active).length || 0} parameter(s)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(item.parameters || []).filter((parameter: any) => parameter.active).map((parameter: any) => {
                    const key = `${item.id}:${parameter.id}`;
                    const draft = resultDraft[key] || { value: "", remarks: "" };
                    const numericValue = Number(draft.value);
                    const hasNumericValue =
                      parameter.dataType === "number" &&
                      draft.value.trim() !== "" &&
                      Number.isFinite(numericValue);
                    const low = parameter.effectiveReferenceLow == null
                      ? null
                      : Number(parameter.effectiveReferenceLow);
                    const high = parameter.effectiveReferenceHigh == null
                      ? null
                      : Number(parameter.effectiveReferenceHigh);
                    const generatedFlag = hasNumericValue
                      ? low != null && numericValue < low
                        ? "low"
                        : high != null && numericValue > high
                          ? "high"
                          : low != null || high != null
                            ? "normal"
                            : ""
                      : "";
                    const matchedReferenceText =
                      parameter.hasPatientMatchedRange
                        ? parameter.effectiveReferenceRange ||
                          (low != null || high != null
                            ? `${low ?? "—"} — ${high ?? "—"}`
                            : "")
                        : parameter.referenceRange || "";
                    return (
                      <div key={parameter.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_180px_1fr]">
                        <div className="space-y-2">
                          <Label>{parameter.name}{parameter.unit ? ` (${parameter.unit})` : ""}</Label>
                          <Input
                            value={draft.value}
                            placeholder={matchedReferenceText || "Enter result"}
                            onChange={(event) => setResultDraft((current) => ({
                              ...current,
                              [key]: { ...draft, value: event.target.value },
                            }))}
                          />
                          {matchedReferenceText && (
                            <p className="text-xs text-muted-foreground">Reference: {matchedReferenceText}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Flag</Label>
                          {generatedFlag ? (
                            <Badge
                              variant={generatedFlag === "normal" ? "secondary" : "destructive"}
                              className="mt-1"
                            >
                              {generatedFlag === "high"
                                ? "H - High"
                                : generatedFlag === "low"
                                  ? "L - Low"
                                  : "Normal"}
                            </Badge>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">Calculated from bounds</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Remarks</Label>
                          <Input
                            value={draft.remarks}
                            onChange={(event) => setResultDraft((current) => ({
                              ...current,
                              [key]: { ...draft, remarks: event.target.value },
                            }))}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={resultSaving}
                    onClick={() => void saveResults(item)}
                  >
                    Save {item.investigation?.name || "investigation"} results
                  </Button>
                </CardContent>
              </Card>
            ))}
            {resultError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {resultError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                ++resultRequestGeneration.current;
                resultDraftRef.current = {};
                setResultDraft({});
                setResultOrder(null);
                setResultError("");
              }}
              disabled={resultSaving}
            >
              Close
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => void completeResultOrder()}
              disabled={resultSaving}
            >
              Complete report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={paymentOrder != null}
        onOpenChange={(open) => {
          if (!open && !paymentSaving) {
            setPaymentOrder(null);
            setPaystackReference(null);
          }
        }}
      >
        <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Receive payment</DialogTitle>
            <DialogDescription>
              {paymentOrder
                ? `Order ${paymentOrder.orderNumber} · Balance GH₵ ${Math.max(
                    0,
                    Number(paymentOrder.totalAmount || 0) -
                      Number(paymentOrder.paidAmount || 0),
                  ).toFixed(2)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Payment mode</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => {
                  setPaymentMethod(value);
                  setPaystackReference(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile_money">
                    MobileMoney (Paystack)
                  </SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Amount (GH₵)</Label>
              <Input
                id="paymentAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => {
                  setPaymentAmount(event.target.value);
                  setPaystackReference(null);
                }}
              />
            </div>
            {paymentMethod !== "mobile_money" && (
              <div className="space-y-2">
                <Label htmlFor="paymentReference">Reference (optional)</Label>
                <Input
                  id="paymentReference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                />
              </div>
            )}
            {paymentError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {paymentError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setPaymentOrder(null);
                setPaystackReference(null);
              }}
              disabled={paymentSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => void startPayment()}
              disabled={paymentSaving || Number(paymentAmount) <= 0}
            >
              {paymentSaving
                ? "Processing..."
                : paymentMethod === "mobile_money"
                ? "Pay with Paystack"
                : "Receive payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  step,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: number | string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        step={step}
        defaultValue={defaultValue}
      />
    </div>
  );
}

function FacilityField({ facilities }: { facilities: any[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const selected = facilities.find((facility) => facility.id === value);
  return (
    <div className="space-y-2">
      <Label htmlFor="facilityId">Facility</Label>
      <input type="hidden" name="facilityId" value={value} required />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className="w-full justify-between">
            {selected ? `${selected.name}${selected.code ? ` — ${selected.code}` : ""}` : "Select facility"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search facilities..." />
            <CommandList>
              <CommandEmpty>No facility found.</CommandEmpty>
              <CommandGroup>
                {facilities.map((facility) => (
                  <CommandItem
                    key={facility.id}
                    value={`${facility.name} ${facility.code || ""}`}
                    onSelect={() => {
                      setValue(facility.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === facility.id ? "opacity-100" : "opacity-0"}`} />
                    {facility.name}{facility.code ? ` — ${facility.code}` : ""}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RoleField({ defaultValue }: { defaultValue?: string }) {
  return (
    <div className="space-y-2">
      <Label>Role</Label>
      <Select name="role" required defaultValue={defaultValue}>
        <SelectTrigger>
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          {["admin", "frontdesk", "account", "technician", "doctor"].map(
            (role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function PatientField({ patients }: { patients: any[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const selected = patients.find((patient) => patient.id === value);
  return (
    <div className="space-y-2">
      <Label htmlFor="patientId">Patient</Label>
      <input type="hidden" name="patientId" value={value} required />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className="w-full justify-between">
            {selected ? `${selected.firstName} ${selected.lastName} — ${selected.patientNumber}` : "Select patient"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search name or patient number..." />
            <CommandList>
              <CommandEmpty>No patient found.</CommandEmpty>
              <CommandGroup>
                {patients.map((patient) => (
                  <CommandItem
                    key={patient.id}
                    value={`${patient.firstName} ${patient.lastName} ${patient.patientNumber} ${patient.nhisNumber || ""}`}
                    onSelect={() => {
                      setValue(patient.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === patient.id ? "opacity-100" : "opacity-0"}`} />
                    {patient.firstName} {patient.lastName} — {patient.patientNumber}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function InvestigationField({ investigations }: { investigations: any[] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const selected = investigations.find((item) => item.id === value);
  return (
    <div className="space-y-2">
      <Label htmlFor="investigationIds">Investigations</Label>
      <input type="hidden" name="investigationIds" value={value} required />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className="w-full justify-between">
            {selected
              ? `${selected.name} — GH₵ ${(selected.covered
                  ? Number(selected.topUp || 0)
                  : Number(selected.uncoveredTariff || 0)).toFixed(2)}`
              : "Select investigation"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search investigations..." />
            <CommandList>
              <CommandEmpty>No investigation found.</CommandEmpty>
              <CommandGroup>
                {investigations.map((item) => {
                  const charge = item.covered
                    ? Number(item.topUp || 0)
                    : Number(item.uncoveredTariff || 0);
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.name} ${item.gdrgCode || ""} ${item.code || ""}`}
                      onSelect={() => {
                        setValue(item.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={`mr-2 h-4 w-4 ${value === item.id ? "opacity-100" : "opacity-0"}`} />
                      {item.name} — GH₵ {charge.toFixed(2)}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RecordTable({
  section,
  rows,
  canReceivePayment = false,
  canCaptureResults = false,
  canViewReports = false,
  onReceivePayment,
  onCaptureResults,
  onOpenReport,
  onDownloadReport,
  onEditUser,
  onToggleUser,
  onViewClaim,
  onExportClaim,
}: {
  section: Props["section"];
  rows: any[];
  canReceivePayment?: boolean;
  canCaptureResults?: boolean;
  canViewReports?: boolean;
  onReceivePayment?: (order: any) => void;
  onCaptureResults?: (order: any) => void;
  onOpenReport?: (order: any) => void;
  onDownloadReport?: (order: any) => void;
  onEditUser?: (user: any) => void;
  onToggleUser?: (user: any) => void;
  onViewClaim?: (claim: any) => void;
  onExportClaim?: (claim: any) => void;
}) {
  const patientName = (row: any) =>
    `${row.firstName || ""} ${row.lastName || ""}`.trim();
  const columns: Record<Props["section"], string[]> = {
    patients: ["patientNumber", "name", "phone", "nhisNumber", "createdAt"],
    orders: [
      "orderNumber",
      "patient",
      "status",
      "paymentStatus",
      "totalAmount",
      "createdAt",
    ],
    investigations: [
      "gdrgCode",
      "name",
      "specimenType",
      "coveredTariff",
      "topUp",
      "uncoveredTariff",
      "covered",
      "active",
    ],
    facilities: ["name", "code", "phone", "nhiaFacilityCode"],
    users: ["name", "email", "role", "active"],
    claims: [
      "claimId",
      "patientName",
      "nhisNumber",
      "totalAmount",
      "createdAt",
    ],
    reports: ["name"],
  };
  const tableColumns = [
    ...columns[section],
    ...(section === "orders" ? ["actions"] : []),
    ...(section === "users" ? ["actions"] : []),
    ...(section === "claims" ? ["actions"] : []),
  ];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {tableColumns.map((column) => (
            <TableHead key={column}>
              {column === "nhisNumber"
                ? "NHIS"
                : column === "claimId"
                ? "Claim ID"
                : column === "patientName"
                ? "Patient Name"
                : column === "totalAmount"
                ? "Total Cost"
                : column === "paymentStatus"
                ? "Payment"
                : column === "actions"
                ? "Action"
                : column
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (char) => char.toUpperCase())}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {tableColumns.map((column) => (
              <TableCell key={column}>
                {column === "actions" ? (
                  section === "claims" ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => onViewClaim?.(row)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => onExportClaim?.(row)}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Export XML
                      </Button>
                    </div>
                  ) : section === "users" ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => onEditUser?.(row)}
                      >
                        <Edit className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={row.active ? "destructive" : "outline"}
                        className="cursor-pointer"
                        onClick={() => onToggleUser?.(row)}
                      >
                        <Power className="mr-1 h-3.5 w-3.5" />
                        {row.active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  ) : Number(row.paidAmount || 0) < Number(row.totalAmount || 0) ? (
                    <div className="flex flex-wrap gap-2">
                      {canReceivePayment && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => onReceivePayment?.(row)}
                        >
                          Receive payment
                        </Button>
                      )}
                      {canCaptureResults && (
                        <span className="text-xs text-muted-foreground">Payment required</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {canCaptureResults && row.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => onCaptureResults?.(row)}
                        >
                          <FileText className="mr-1 h-3.5 w-3.5" />
                          Capture results
                        </Button>
                      )}
                      {row.status === "completed" && canViewReports && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => onOpenReport?.(row)}
                          >
                            Print
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => onDownloadReport?.(row)}
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            Download
                          </Button>
                        </>
                      )}
                      {row.status !== "completed" && !canCaptureResults && <Badge>Paid</Badge>}
                    </div>
                  )
                ) : column === "name" && section === "patients" ? (
                  patientName(row)
                ) : column === "patient" ? (
                  `${row.patient?.firstName || ""} ${row.patient?.lastName || ""}`.trim() ||
                  "—"
                ) : column === "active" ? (
                  <Badge variant={row[column] ? "default" : "secondary"}>
                    {row[column] ? "Active" : "Inactive"}
                  </Badge>
                ) : column === "status" ? (
                  <Badge
                    variant={
                      row[column] === "completed" || row[column] === "paid"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {row[column] || "—"}
                  </Badge>
                ) : row[column] == null ? (
                  "—"
                ) : typeof row[column] === "object" ? (
                  JSON.stringify(row[column])
                ) : (
                  String(row[column])
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReportView({ row }: { row?: any }) {
  if (!row)
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Select a period to generate a summary
        </CardContent>
      </Card>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Total orders", row.totalOrders],
        ["Completed", row.completed],
        ["Pending", row.pending],
        [
          "Collected",
          `GH₵ ${Number(row.totalCollected || 0).toLocaleString()}`,
        ],
      ].map(([label, value]) => (
        <Card key={String(label)}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl">{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
