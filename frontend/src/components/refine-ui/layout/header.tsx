import { ThemeToggle } from "@/components/refine-ui/theme/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useActiveAuthProvider,
  useLogout,
  useRefineOptions,
  useGetIdentity,
} from "@refinedev/core";
import { LogOutIcon, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/providers/constants";

type HeaderIdentity = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "frontdesk" | "account" | "technician" | "doctor";
  avatar?: string;
};

export const Header = () => {
  const { isMobile } = useSidebar();

  return <>{isMobile ? <MobileHeader /> : <DesktopHeader />}</>;
};

function DesktopHeader() {
  return (
    <header
      className={cn(
        "sticky",
        "top-0",
        "flex",
        "h-16",
        "shrink-0",
        "items-center",
        "gap-4",
        "border-b",
        "border-border",
        "bg-sidebar",
        "pr-3",
        "justify-end",
        "z-40"
      )}
    >
      <ThemeToggle />
      <UserDropdown />
    </header>
  );
}

function MobileHeader() {
  const { open, isMobile } = useSidebar();

  const { title } = useRefineOptions();

  return (
    <header
      className={cn(
        "sticky",
        "top-0",
        "flex",
        "h-12",
        "shrink-0",
        "items-center",
        "gap-2",
        "border-b",
        "border-border",
        "bg-sidebar",
        "pr-3",
        "justify-between",
        "z-40"
      )}
    >
      <SidebarTrigger
        className={cn("text-muted-foreground", "rotate-180", "ml-1", {
          "opacity-0": open,
          "opacity-100": !open || isMobile,
          "pointer-events-auto": !open || isMobile,
          "pointer-events-none": open && !isMobile,
        })}
      />

      <div
        className={cn(
          "whitespace-nowrap",
          "flex",
          "flex-row",
          "h-full",
          "items-center",
          "justify-start",
          "gap-2",
          "transition-discrete",
          "duration-200",
          {
            "pl-3": !open,
            "pl-5": open,
          }
        )}
      >
        <div>{title.icon}</div>
        <h2
          className={cn(
            "text-sm",
            "font-bold",
            "transition-opacity",
            "duration-200",
            {
              "opacity-0": !open,
              "opacity-100": open,
            }
          )}
        >
          {title.text}
        </h2>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle className={cn("h-8", "w-8")} />
        <UserDropdown compact />
      </div>
    </header>
  );
}

const roleLabels: Record<HeaderIdentity["role"], string> = {
  admin: "Administrator",
  frontdesk: "Front Desk",
  account: "Account",
  technician: "Technician",
  doctor: "Doctor",
};

const getInitials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

const UserDropdown = ({ compact = false }: { compact?: boolean }) => {
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const { data: identity, isLoading, refetch } = useGetIdentity<HeaderIdentity>();
  const authProvider = useActiveAuthProvider();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!identity) return;
    setName(identity.name || "");
    setEmail(identity.email || "");
    setImage(identity.avatar || "");
  }, [identity]);

  if (!authProvider?.getIdentity) {
    return null;
  }

  const openEditor = () => {
    setName(identity?.name || "");
    setEmail(identity?.email || "");
    setImage(identity?.avatar || "");
    setEditOpen(true);
  };

  const uploadImage = async (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Please select a PNG or JPEG image");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read image"));
        reader.readAsDataURL(file);
      });
      const response = await fetch(`${API_URL}/api/users/image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.secureUrl) {
        throw new Error(result?.error || "Unable to upload image");
      }
      setImage(result.secureUrl);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload image");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/users/me/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, image: image || null }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Unable to update profile");
      toast.success("Profile updated");
      setEditOpen(false);
      await refetch?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn("flex cursor-pointer items-center gap-2 rounded-md", compact ? "p-1" : "px-2 py-1")}>
            <Avatar className={cn(compact ? "h-8 w-8" : "h-10 w-10")}>
              {identity?.avatar && <AvatarImage src={identity.avatar} alt={identity.name} />}
              <AvatarFallback>{getInitials(identity?.name)}</AvatarFallback>
            </Avatar>
            {!compact && (
              <div className="hidden min-w-32 flex-col text-left sm:flex">
                <span className="text-sm font-medium">{isLoading ? "Loading..." : identity?.name}</span>
                <span className="text-xs text-muted-foreground">{identity?.role ? roleLabels[identity.role] : ""}</span>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!compact && identity && (
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{identity.name}</p>
              <p className="text-xs text-muted-foreground">{identity.email}</p>
              <p className="mt-1 text-xs font-medium text-blue-600">{roleLabels[identity.role]}</p>
            </div>
          )}
          <DropdownMenuItem onClick={openEditor} className="cursor-pointer">
            <Pencil className="h-4 w-4" />
            Edit profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              logout();
            }}
          >
            <LogOutIcon className={cn("text-destructive", "hover:text-destructive", "cursor-pointer")} />
            <span className={cn("text-destructive", "hover:text-destructive", "cursor-pointer")}>
              {isLoggingOut ? "Logging out..." : "Logout"}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Update your name, email, and profile image.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {image && <AvatarImage src={image} alt={name} />}
                <AvatarFallback>{getInitials(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Label htmlFor="profileImage">Profile image</Label>
                <Input
                  id="profileImage"
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={uploading}
                  className="mt-2 cursor-pointer"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file);
                    event.target.value = "";
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">PNG or JPEG · Maximum 5 MB</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileName">Name</Label>
              <Input id="profileName" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileEmail">Email</Label>
              <Input id="profileEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void saveProfile()} disabled={saving || uploading || name.trim().length < 2}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

Header.displayName = "Header";
MobileHeader.displayName = "MobileHeader";
DesktopHeader.displayName = "DesktopHeader";
