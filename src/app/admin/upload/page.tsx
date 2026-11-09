"use client";

import { useState, useEffect, useRef } from "react";
import exifr from "exifr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Camera,
  MapPin,
  Tag,
  Folder,
  CheckCircle2,
  Lock,
  LogOut,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sliders,
  Settings as SettingsIcon,
  Palette,
  ArrowUpDown,
  Clock,
  Save,
  Plus,
  X,
  History,
  Trash2,
  Search,
  Image as ImageIcon,
  AlertTriangle,
  CheckSquare,
  Square,
  MinusSquare,
  FolderPlus,
  Filter,
} from "lucide-react";
import { AdminMapPicker } from "@/components/AdminMapPicker";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  THEME_PRESETS,
  BACKGROUND_PRESETS,
  SiteSettings,
  DEFAULT_SETTINGS,
} from "@/types/settings";

interface MetadataResponse {
  albums: string[];
  popularTags: { tag: string; count: number }[];
  allTags: string[];
  commonTripods: string[];
}

export default function AdminUploadPage() {
  const router = useRouter();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"upload" | "manage" | "settings">(
    "upload"
  );

  // Manage / Catalog state
  const [catalogPhotos, setCatalogPhotos] = useState<any[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogAlbumFilter, setCatalogAlbumFilter] = useState("all");
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState<number | "all">(50);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogTotalPages, setCatalogTotalPages] = useState(1);
  const [availableAlbums, setAvailableAlbums] = useState<string[]>([]);

  // Selection state
  const [selectedPhotoIDs, setSelectedPhotoIDs] = useState<string[]>([]);

  // Bulk actions state
  const [activeBulkModal, setActiveBulkModal] = useState<
    "addAlbum" | "removeAlbum" | "addTags" | "removeTag" | "delete" | null
  >(null);
  const [bulkAlbumChoice, setBulkAlbumChoice] = useState("");
  const [bulkCustomAlbum, setBulkCustomAlbum] = useState("");
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [bulkRemoveTagInput, setBulkRemoveTagInput] = useState("");
  const [isExecutingBulk, setIsExecutingBulk] = useState(false);
  const [bulkStatusMsg, setBulkStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Single delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState("");

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Metadata from backend (albums A-Z, tags, tripods)
  const [metadata, setMetadata] = useState<MetadataResponse>({
    albums: [],
    popularTags: [],
    allTags: [],
    commonTripods: [],
  });
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [showTagTray, setShowTagTray] = useState(false);

  // Upload & File states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form & EXIF states
  const [photoID, setPhotoID] = useState("");
  const [idSourceNote, setIdSourceNote] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [captureDate, setCaptureDate] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tripod, setTripod] = useState("");
  const [availability, setAvailability] = useState("Available for Order");

  // Detected technical details
  const [detectedCamera, setDetectedCamera] = useState<any>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [publishedResult, setPublishedResult] = useState<any>(null);

  // Settings states
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Change password states
  const [currentPasswordChange, setCurrentPasswordChange] = useState("");
  const [newPasswordChange, setNewPasswordChange] = useState("");
  const [confirmPasswordChange, setConfirmPasswordChange] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth and load metadata on mount
  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => res.json())
      .then((data) => {
        setIsAuthenticated(!!data.authenticated);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });

    // Load metadata (albums, tags, tripods)
    fetch("/api/admin/metadata")
      .then((res) => res.json())
      .then((data: MetadataResponse) => {
        setMetadata(data);
      })
      .catch(() => {});

    // Load settings
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data: SiteSettings) => {
        setSettings(data);
      })
      .catch(() => {});

    // Load recent tags & tripod from localStorage
    try {
      const storedTripod = localStorage.getItem("lumenist_last_tripod");
      if (storedTripod) {
        setTripod(storedTripod);
      } else {
        setTripod("None");
      }

      const storedTags = localStorage.getItem("lumenist_recent_tags");
      if (storedTags) {
        setRecentTags(JSON.parse(storedTags));
      }
    } catch {}
  }, []);

  const loadCatalog = async (
    page = catalogPage,
    query = catalogSearch,
    album = catalogAlbumFilter,
    size = catalogPageSize
  ) => {
    setIsLoadingCatalog(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(size));
      if (query.trim()) params.set("q", query.trim());
      if (album && album !== "all") params.set("album", album.trim());

      const res = await fetch(`/api/admin/photos?${params.toString()}`);
      const data = await res.json();
      if (data.photos) {
        setCatalogPhotos(data.photos);
        setCatalogTotal(data.total || 0);
        setCatalogTotalPages(data.totalPages || 1);
        setCatalogPage(data.page || 1);
        if (data.allAlbums) {
          setAvailableAlbums(data.allAlbums);
        }
      }
    } catch {
      console.warn("Failed to load catalog");
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (activeTab === "manage" && isAuthenticated) {
      loadCatalog(catalogPage, catalogSearch, catalogAlbumFilter, catalogPageSize);
    }
  }, [activeTab, isAuthenticated, catalogPage, catalogAlbumFilter, catalogPageSize]);

  // Debounced search when query changes
  useEffect(() => {
    if (activeTab !== "manage" || !isAuthenticated) return;
    const timer = setTimeout(() => {
      setCatalogPage(1);
      loadCatalog(1, catalogSearch, catalogAlbumFilter, catalogPageSize);
    }, 280);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

  // Selection helpers
  const isAllCurrentPageSelected =
    catalogPhotos.length > 0 &&
    catalogPhotos.every((p) => selectedPhotoIDs.includes(p.photoID));

  const toggleSelectPhoto = (id: string) => {
    setSelectedPhotoIDs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const currentIds = new Set(catalogPhotos.map((p) => p.photoID));
      setSelectedPhotoIDs((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const combined = Array.from(
        new Set([...selectedPhotoIDs, ...catalogPhotos.map((p) => p.photoID)])
      );
      setSelectedPhotoIDs(combined);
    }
  };

  const selectAllMatching = async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "all");
      if (catalogSearch.trim()) params.set("q", catalogSearch.trim());
      if (catalogAlbumFilter && catalogAlbumFilter !== "all") {
        params.set("album", catalogAlbumFilter.trim());
      }
      const res = await fetch(`/api/admin/photos?${params.toString()}`);
      const data = await res.json();
      if (data.photos) {
        setSelectedPhotoIDs(data.photos.map((p: any) => p.photoID));
      }
    } catch {
      alert("Failed to select all photographs");
    }
  };

  const clearSelection = () => setSelectedPhotoIDs([]);

  // Bulk actions executor
  const handleExecuteBulkAction = async () => {
    if (!activeBulkModal || selectedPhotoIDs.length === 0) return;
    setIsExecutingBulk(true);
    setBulkStatusMsg(null);

    try {
      const body: any = {
        action: activeBulkModal,
        photoIDs: selectedPhotoIDs,
      };

      if (activeBulkModal === "addAlbum") {
        const finalAlbum = bulkCustomAlbum.trim() || bulkAlbumChoice.trim();
        if (!finalAlbum) throw new Error("Please specify an album name");
        body.album = finalAlbum;
      } else if (activeBulkModal === "removeAlbum") {
        if (!bulkAlbumChoice.trim()) {
          throw new Error("Please select an album to remove");
        }
        body.album = bulkAlbumChoice.trim();
      } else if (activeBulkModal === "addTags") {
        const tags = bulkTagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tags.length === 0) throw new Error("Please enter at least one tag");
        body.tags = tags;
      } else if (activeBulkModal === "removeTag") {
        if (!bulkRemoveTagInput.trim()) {
          throw new Error("Please specify a tag to remove");
        }
        body.tag = bulkRemoveTagInput.trim();
      }

      const res = await fetch("/api/admin/photos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Bulk action failed");
      }

      let msg = "";
      if (activeBulkModal === "delete") {
        msg = `Permanently deleted ${data.affectedCount} photographs and associated files.`;
        setSelectedPhotoIDs([]);
      } else if (activeBulkModal === "addAlbum") {
        msg = `Added album "${body.album}" to ${data.affectedCount} photograph${data.affectedCount === 1 ? "" : "s"}.`;
      } else if (activeBulkModal === "removeAlbum") {
        msg = `Removed album "${body.album}" from ${data.affectedCount} photograph${data.affectedCount === 1 ? "" : "s"}.`;
      } else if (activeBulkModal === "addTags") {
        msg = `Added tags [${body.tags.join(", ")}] to ${data.affectedCount} photograph${data.affectedCount === 1 ? "" : "s"}.`;
      } else if (activeBulkModal === "removeTag") {
        msg = `Removed tag "${body.tag}" from ${data.affectedCount} photograph${data.affectedCount === 1 ? "" : "s"}.`;
      }

      setBulkStatusMsg({ type: "success", text: msg });
      setActiveBulkModal(null);
      await loadCatalog(catalogPage, catalogSearch, catalogAlbumFilter, catalogPageSize);
      router.refresh();
      setTimeout(() => setBulkStatusMsg(null), 5500);
    } catch (err: any) {
      setBulkStatusMsg({
        type: "error",
        text: err.message || "Failed to complete bulk action",
      });
    } finally {
      setIsExecutingBulk(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirmDelete) return;
    setIsDeletingPhoto(true);

    try {
      const res = await fetch(
        `/api/admin/photo/${encodeURIComponent(confirmDelete.id)}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete photograph");
      }

      setCatalogPhotos((prev) =>
        prev.filter((p) => p.photoID !== confirmDelete.id)
      );
      setSelectedPhotoIDs((prev) =>
        prev.filter((id) => id !== confirmDelete.id)
      );
      setCatalogTotal((prev) => Math.max(0, prev - 1));
      setDeleteSuccessMsg(
        `Deleted "${confirmDelete.title}" (${confirmDelete.id}) and all associated files.`
      );
      setTimeout(() => setDeleteSuccessMsg(""), 4500);
      setConfirmDelete(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete photo");
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        setPasswordInput("");
      } else {
        setAuthError(data.error || "Incorrect password");
      }
    } catch {
      setAuthError("Network error during login");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setIsAuthenticated(false);
  };

  // Process dropped or selected image file
  const handleFileSelect = async (file: File) => {
    if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
      alert("Please upload a JPEG photograph (.jpg or .jpeg)");
      return;
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setSubmitError("");
    setPublishedResult(null);

    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/_desktop|_original/i, "");

    // 1. Check if filename matches standard photoID format (e.g. d20261027151131 or s00000613)
    const isConvention = /^[ds]\d+/i.test(baseName);

    // Extract EXIF in browser
    try {
      const exif = await exifr.parse(file, {
        tiff: true,
        xmp: true,
        gps: true,
      });

      if (exif) {
        const dateObj: Date | undefined = exif.DateTimeOriginal || exif.CreateDate;
        const now = dateObj instanceof Date && !isNaN(dateObj.getTime()) ? dateObj : new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hour = String(now.getHours()).padStart(2, "0");
        const minute = String(now.getMinutes()).padStart(2, "0");
        const second = String(now.getSeconds()).padStart(2, "0");

        setCaptureDate(`${year}-${month}-${day}T${hour}:${minute}:${second}`);

        if (isConvention) {
          setPhotoID(baseName);
          setIdSourceNote(`Extracted from filename "${file.name}"`);
        } else if (exif.DateTimeOriginal || exif.CreateDate) {
          const generatedId = `d${year}${month}${day}${hour}${minute}${second}`;
          setPhotoID(generatedId);
          setIdSourceNote(
            `Auto-derived from EXIF capture time (${year}-${month}-${day} ${hour}:${minute}:${second})`
          );
        } else {
          const generatedId = `d${year}${month}${day}${hour}${minute}${second}`;
          setPhotoID(generatedId);
          setIdSourceNote("Defaulted to current date/time (no EXIF timestamp)");
        }

        // Coordinates
        if (exif.latitude !== undefined && exif.longitude !== undefined) {
          setLatitude(parseFloat(exif.latitude.toFixed(6)));
          setLongitude(parseFloat(exif.longitude.toFixed(6)));
        }

        // Camera Details
        setDetectedCamera({
          make: exif.Make,
          model: exif.Model,
          lens: exif.LensModel || exif.Lens,
          focalLength: exif.FocalLength
            ? `${Math.round(exif.FocalLength)} mm`
            : undefined,
          shutter: exif.ExposureTime
            ? exif.ExposureTime >= 1
              ? `${exif.ExposureTime}s`
              : `1/${Math.round(1 / exif.ExposureTime)} ss`
            : undefined,
          aperture: exif.FNumber ? `f${exif.FNumber}` : undefined,
          iso: exif.ISO ? `ISO ${exif.ISO}` : undefined,
          exposureComp:
            exif.ExposureCompensation !== undefined
              ? `${exif.ExposureCompensation} Ev`
              : undefined,
          whiteBalance: exif.WhiteBalance || "Auto",
        });

        // Set initial title if file has a friendly name (not an ID)
        if (!isConvention && baseName.length > 2) {
          setTitle(baseName.replace(/[-_]/g, " "));
        }
      } else {
        // No EXIF
        if (isConvention) {
          setPhotoID(baseName);
          setIdSourceNote(`Extracted from filename "${file.name}"`);
        } else {
          const now = new Date();
          const generatedId = `d${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
          setPhotoID(generatedId);
          setIdSourceNote("Generated from current date & time");
        }
      }
    } catch (err) {
      console.warn("Could not read EXIF:", err);
      if (isConvention) {
        setPhotoID(baseName);
        setIdSourceNote(`Extracted from filename "${file.name}"`);
      }
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addCustomCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
      setNewCategoryInput("");
    }
  };

  // Tag chip helper: appends or toggles tag in comma-separated input
  const handleTagChipClick = (tag: string) => {
    const currentTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const exists = currentTags.some(
      (t) => t.toLowerCase() === tag.toLowerCase()
    );

    if (exists) {
      // Remove
      const next = currentTags.filter(
        (t) => t.toLowerCase() !== tag.toLowerCase()
      );
      setTagsInput(next.join(", "));
    } else {
      // Append
      const next = [...currentTags, tag];
      setTagsInput(next.join(", "));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setSubmitError("Please choose a photograph to upload");
      return;
    }
    if (!title.trim()) {
      setSubmitError("Please provide a photograph title");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("photoID", photoID.trim());
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("albums", selectedCategories.join(","));
    formData.append("tags", tagsInput.trim());
    formData.append("tripod", tripod.trim() || "None");
    formData.append("availability", availability);

    if (captureDate) {
      const d = new Date(captureDate);
      if (!isNaN(d.getTime())) {
        formData.append("year", String(d.getFullYear()));
        formData.append("month", String(d.getMonth() + 1));
        formData.append("day", String(d.getDate()));
        formData.append("hour", String(d.getHours()));
        formData.append("minute", String(d.getMinutes()));
        formData.append("second", String(d.getSeconds()));
      }
    }

    if (latitude !== null && longitude !== null) {
      formData.append("latitude", String(latitude));
      formData.append("longitude", String(longitude));
    }

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to process photo");
      }

      // Remember tripod and tags in localStorage
      if (tripod.trim()) {
        try {
          localStorage.setItem("lumenist_last_tripod", tripod.trim());
        } catch {}
      }

      const submittedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (submittedTags.length > 0) {
        try {
          const updatedRecent = Array.from(
            new Set([...submittedTags, ...recentTags])
          ).slice(0, 20);
          setRecentTags(updatedRecent);
          localStorage.setItem(
            "lumenist_recent_tags",
            JSON.stringify(updatedRecent)
          );
        } catch {}
      }

      setPublishedResult(data);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to upload photo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setPhotoID("");
    setIdSourceNote("");
    setTitle("");
    setDescription("");
    setLatitude(null);
    setLongitude(null);
    setSelectedCategories([]);
    setTagsInput("");
    setDetectedCamera(null);
    setPublishedResult(null);
    setSubmitError("");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccess(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsSuccess(true);
        // Apply theme variables immediately to active document
        document.documentElement.style.setProperty(
          "--accent",
          settings.themeAccent
        );
        document.documentElement.style.setProperty(
          "--accent-light",
          settings.themeAccentLight
        );
        document.documentElement.style.setProperty(
          "--accent-dark",
          settings.themeAccentDark
        );
        document.documentElement.style.setProperty(
          "--background",
          settings.themeBackground || "#000000"
        );
        document.documentElement.style.setProperty(
          "--surface",
          settings.themeSurface || "#111111"
        );
        document.documentElement.style.setProperty(
          "--surface-border",
          settings.themeBorder || "#262626"
        );
        router.refresh();
        setTimeout(() => setSettingsSuccess(false), 3500);
      }
    } catch {
      alert("Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError("");
    setPasswordChangeSuccess("");

    if (!currentPasswordChange) {
      setPasswordChangeError("Please enter your current password");
      return;
    }
    if (newPasswordChange.length < 6) {
      setPasswordChangeError("New password must be at least 6 characters long");
      return;
    }
    if (newPasswordChange !== confirmPasswordChange) {
      setPasswordChangeError("New passwords do not match");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPasswordChange,
          newPassword: newPasswordChange,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update password");
      }

      setPasswordChangeSuccess("Password updated successfully!");
      setCurrentPasswordChange("");
      setNewPasswordChange("");
      setConfirmPasswordChange("");
      setTimeout(() => setPasswordChangeSuccess(""), 5000);
    } catch (err: any) {
      setPasswordChangeError(err.message || "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="py-24 text-center text-muted font-mono text-xs">
        Checking admin authentication...
      </div>
    );
  }

  // 1. Password Login View
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-surface border border-surface-border text-accent mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-light text-white tracking-tight">
            Lumenist Admin
          </h1>
          <p className="text-xs text-muted">
            Enter your admin passphrase to manage and publish photographs.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-surface border border-surface-border rounded-sm p-6 space-y-4 shadow-xl"
        >
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1.5">
              Admin Password
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full bg-black border border-surface-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          {authError && (
            <p className="text-xs text-red-400 font-medium">{authError}</p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-2.5 px-4 bg-accent text-black font-semibold text-xs uppercase tracking-wider rounded hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {isLoggingIn ? "Verifying..." : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  // All albums strictly alphabetical
  const displayedAlbums = metadata.albums.length > 0 ? metadata.albums : [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin/upload" },
              {
                label:
                  activeTab === "upload"
                    ? "Upload Photo"
                    : activeTab === "manage"
                    ? "Manage Catalog"
                    : "Site Settings",
              },
            ]}
          />
          <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight mt-1">
            {activeTab === "upload"
              ? "Publish Fine Art Photograph"
              : activeTab === "manage"
              ? "Manage & Delete Photographs"
              : "Studio & Site Settings"}
          </h1>
        </div>

        {/* Tab Buttons & Logout */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-black border border-surface-border rounded-sm p-1 text-xs">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-3 py-1.5 rounded-sm transition-colors flex items-center space-x-1.5 ${
                activeTab === "upload"
                  ? "bg-surface-hover text-white font-medium"
                  : "text-muted hover:text-gray-200"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`px-3 py-1.5 rounded-sm transition-colors flex items-center space-x-1.5 ${
                activeTab === "manage"
                  ? "bg-surface-hover text-white font-medium"
                  : "text-muted hover:text-gray-200"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Manage ({catalogTotal > 0 ? catalogTotal : "Catalog"})</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-1.5 rounded-sm transition-colors flex items-center space-x-1.5 ${
                activeTab === "settings"
                  ? "bg-surface-hover text-white font-medium"
                  : "text-muted hover:text-gray-200"
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 border border-surface-border rounded-sm text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: UPLOAD PHOTOGRAPH */}
      {activeTab === "upload" && (
        <>
          {/* Success Banner */}
          {publishedResult && (
            <div className="bg-surface border border-accent/40 rounded-sm p-6 space-y-4">
              <div className="flex items-center space-x-3 text-accent">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-medium text-white">
                    Photograph Published Successfully
                  </h3>
                  <p className="text-xs text-muted">
                    Photo ID:{" "}
                    <code className="text-accent font-mono">
                      {publishedResult.photoID}
                    </code>{" "}
                    is now cataloged, optimized, and mapped.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={publishedResult.url}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-accent text-black font-semibold text-xs rounded hover:bg-accent-light transition-colors"
                >
                  <span>View Published Work</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={handleResetForm}
                  className="px-4 py-2 bg-black border border-surface-border text-gray-300 font-medium text-xs rounded hover:text-white transition-colors"
                >
                  Upload Another Photograph
                </button>
              </div>
            </div>
          )}

          {!publishedResult && (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* File Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-accent bg-accent/5 scale-[1.005]"
                    : selectedFile
                    ? "border-surface-border bg-surface/50 hover:border-gray-600"
                    : "border-surface-border hover:border-accent bg-surface/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {imagePreviewUrl ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <div className="w-48 aspect-[3/2] bg-black rounded overflow-hidden border border-surface-border shadow-lg">
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-left space-y-1 text-xs">
                      <p className="text-white font-medium text-sm">
                        {selectedFile?.name}
                      </p>
                      <p className="text-muted">
                        Size:{" "}
                        {((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)}{" "}
                        MB
                      </p>
                      <p className="text-accent flex items-center space-x-1 pt-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          EXIF extracted &bull; Click or drop another image to
                          replace
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-6">
                    <div className="inline-flex p-4 rounded-full bg-black border border-surface-border text-muted">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-200 font-medium">
                        Drag and drop your high-resolution JPEG here, or click to
                        browse
                      </p>
                      <p className="text-xs text-muted pt-1">
                        Supports full-size camera captures (.jpg / .jpeg).
                        EXIF, GPS, and optical specs are extracted
                        automatically.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Detected Technical Details Badge */}
              {detectedCamera && (
                <div className="bg-surface border border-surface-border rounded-sm p-4 text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-accent font-medium uppercase tracking-wider text-[11px]">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Auto-Detected Technical Metadata</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-gray-300">
                    <div>
                      <span className="text-muted block text-[10px]">
                        Camera
                      </span>
                      <span>
                        {detectedCamera.make} {detectedCamera.model || "Unknown"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Lens</span>
                      <span className="truncate block">
                        {detectedCamera.lens || "Not recorded"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">
                        Exposure
                      </span>
                      <span>
                        {detectedCamera.focalLength || ""} &bull;{" "}
                        {detectedCamera.aperture || ""} &bull;{" "}
                        {detectedCamera.shutter || ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">
                        Sensitivity
                      </span>
                      <span>
                        {detectedCamera.iso || "ISO -"} &bull;{" "}
                        {detectedCamera.exposureComp || "0 Ev"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Title & Description */}
              <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-200">
                    Photograph Title <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Mingus Mill in Autumn"
                    required
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-200">
                    Narrative Story / Description
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the atmosphere, historical context, geology, or optical technique..."
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-accent leading-relaxed"
                  />
                </div>

                {/* Photo ID & Capture Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-gray-200 font-mono">
                        Photo ID
                      </label>
                      <span className="text-[10px] text-muted">
                        Editable canonical ID
                      </span>
                    </div>
                    <input
                      type="text"
                      value={photoID}
                      onChange={(e) => {
                        setPhotoID(e.target.value);
                        setIdSourceNote("Custom entry");
                      }}
                      placeholder="e.g. d20261027151131 or s00000613"
                      required
                      className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs font-mono text-accent focus:outline-none focus:border-accent"
                    />
                    {idSourceNote && (
                      <p className="text-[11px] text-gray-400 flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-accent" />
                        <span>{idSourceNote}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-200">
                      Capture Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={captureDate}
                      onChange={(e) => setCaptureDate(e.target.value)}
                      className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-accent [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Curated Albums (STRICTLY ALPHABETICAL) */}
              <div className="space-y-3 bg-surface border border-surface-border p-6 rounded-sm">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                    <Folder className="w-3.5 h-3.5 text-accent" />
                    <span>Curated Albums (Alphabetical)</span>
                  </div>
                  <span className="text-[11px] text-muted">
                    {selectedCategories.length} selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {displayedAlbums.map((cat) => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          isSelected
                            ? "bg-accent/20 border-accent text-accent font-medium shadow-sm"
                            : "bg-black border-surface-border text-gray-400 hover:text-white hover:border-gray-500"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Album */}
                <div className="flex items-center space-x-2 pt-3">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomCategory();
                      }
                    }}
                    placeholder="Add new album name..."
                    className="flex-1 bg-black border border-surface-border rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={addCustomCategory}
                    className="px-3 py-1.5 bg-black border border-surface-border rounded text-xs text-gray-300 hover:text-white hover:border-accent transition-colors"
                  >
                    + Add Album
                  </button>
                </div>
              </div>

              {/* Tags with Memory & Fast Popup Tray */}
              <div className="space-y-3 bg-surface border border-surface-border p-6 rounded-sm">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                    <Tag className="w-3.5 h-3.5 text-accent" />
                    <span>Keywords & Tags</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTagTray(!showTagTray)}
                    className="text-xs text-accent hover:underline flex items-center space-x-1"
                  >
                    <span>
                      {showTagTray ? "Hide Tag Tray" : "+ Quick-Add Tags"}
                    </span>
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Type or paste comma-separated tags (e.g. Washington, Fall color, sunset, river, trees)..."
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-muted">
                    Paste comma-separated tags freely, or click popular chips
                    below to toggle them.
                  </p>
                </div>

                {/* Quick-Add Tag Tray */}
                {(showTagTray || recentTags.length > 0) && (
                  <div className="border-t border-surface-border pt-3 mt-2 space-y-3">
                    {/* Recently Used Tags */}
                    {recentTags.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold flex items-center space-x-1">
                          <History className="w-3 h-3 text-accent" />
                          <span>Recently Used Across Photos</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {recentTags.map((tag) => {
                            const isIncluded = tagsInput
                              .split(",")
                              .map((t) => t.trim().toLowerCase())
                              .includes(tag.toLowerCase());
                            return (
                              <button
                                type="button"
                                key={tag}
                                onClick={() => handleTagChipClick(tag)}
                                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                  isIncluded
                                    ? "bg-accent text-black font-semibold border-accent"
                                    : "bg-black border-surface-border text-gray-300 hover:border-accent"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Common & Popular Tags */}
                    {metadata.popularTags.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                          Popular Library Keywords
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {metadata.popularTags.slice(0, 40).map(({ tag }) => {
                            const isIncluded = tagsInput
                              .split(",")
                              .map((t) => t.trim().toLowerCase())
                              .includes(tag.toLowerCase());
                            return (
                              <button
                                type="button"
                                key={tag}
                                onClick={() => handleTagChipClick(tag)}
                                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                  isIncluded
                                    ? "bg-accent text-black font-semibold border-accent"
                                    : "bg-black/60 border-surface-border text-gray-400 hover:text-white hover:border-gray-500"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tripod & Availability */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface border border-surface-border p-6 rounded-sm">
                {/* Tripod Setup with Memory */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-200">
                      Tripod Setup
                    </label>
                    <span className="text-[10px] text-muted">
                      Remembers last used
                    </span>
                  </div>
                  <input
                    type="text"
                    list="tripod-list"
                    value={tripod}
                    onChange={(e) => setTripod(e.target.value)}
                    placeholder="e.g. Manfrotto Befree GT XPRO Carbon, 496 ball head, or None"
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                  />
                  <datalist id="tripod-list">
                    {metadata.commonTripods.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      "None",
                      "Manfrotto Befree GT XPRO Carbon, 496 ball head",
                      "Gitzo GT3542XLS, Really Right Stuff BH-55",
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setTripod(opt)}
                        className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                          tripod === opt
                            ? "bg-accent/20 border-accent text-accent font-medium"
                            : "bg-black border-surface-border text-gray-400 hover:text-white"
                        }`}
                      >
                        {opt.includes(",") ? opt.split(",")[0] : opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Print Availability */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-200">
                    Print Order Availability
                  </label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="Available for Order">
                      Available for Order
                    </option>
                    <option value="Special Edition / By Request">
                      Special Edition / By Request
                    </option>
                    <option value="Archive Only / Not for Sale">
                      Archive Only / Not for Sale
                    </option>
                  </select>
                </div>
              </div>

              {/* Interactive Geospatial Pin Picker */}
              <div className="space-y-3 bg-surface border border-surface-border p-6 rounded-sm">
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                  <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5 text-accent" />
                    <span>Geographic Location & Map Pin</span>
                  </div>
                  {latitude !== null && longitude !== null ? (
                    <span className="text-xs font-mono text-accent">
                      {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">
                      No coordinates chosen
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted">
                  Click anywhere on the dark map or drag the amber pin to place
                  or refine the capture coordinates.
                </p>

                <AdminMapPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lon) => {
                    setLatitude(lat);
                    setLongitude(lon);
                  }}
                />

                {latitude !== null && longitude !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setLatitude(null);
                      setLongitude(null);
                    }}
                    className="text-xs text-muted hover:text-red-400 transition-colors"
                  >
                    Clear coordinates
                  </button>
                )}
              </div>

              {submitError && (
                <div className="p-4 bg-red-950/40 border border-red-800 rounded text-red-300 text-xs">
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="w-full sm:w-auto px-8 py-3.5 bg-accent text-black font-semibold text-xs uppercase tracking-wider rounded hover:bg-accent-light transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isSubmitting
                    ? "Publishing Photograph & Writing Records..."
                    : "Publish Photograph"}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* TAB 2: MANAGE & DELETE CATALOG */}
      {activeTab === "manage" && (
        <div className="space-y-6">
          {/* Notification banners */}
          {deleteSuccessMsg && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-700 rounded text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{deleteSuccessMsg}</span>
            </div>
          )}

          {bulkStatusMsg && (
            <div
              className={`p-4 border rounded text-xs flex items-center space-x-2 animate-in fade-in ${
                bulkStatusMsg.type === "success"
                  ? "bg-emerald-950/40 border-emerald-700 text-emerald-300"
                  : "bg-red-950/40 border-red-700 text-red-300"
              }`}
            >
              {bulkStatusMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span>{bulkStatusMsg.text}</span>
            </div>
          )}

          {/* Search, Album Filter, & Page Size Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface border border-surface-border p-4 rounded-sm">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search catalog by title, photo ID (e.g. test, d2026...), tag, or year..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-black border border-surface-border rounded-sm text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Album Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-xs text-muted flex items-center space-x-1 flex-shrink-0">
                <Filter className="w-3 h-3 text-accent" />
                <span className="hidden sm:inline">Album:</span>
              </label>
              <select
                value={catalogAlbumFilter}
                onChange={(e) => {
                  setCatalogAlbumFilter(e.target.value);
                  setCatalogPage(1);
                }}
                className="bg-black border border-surface-border text-xs rounded px-2.5 py-2 text-white focus:outline-none focus:border-accent max-w-[200px] truncate"
              >
                <option value="all">All Albums ({catalogTotal})</option>
                {availableAlbums.map((alb) => (
                  <option key={alb} value={alb}>
                    {alb}
                  </option>
                ))}
              </select>
            </div>

            {/* Items Per Page */}
            <div className="flex items-center space-x-2">
              <label className="text-xs text-muted flex-shrink-0 hidden sm:inline">
                Show:
              </label>
              <select
                value={catalogPageSize}
                onChange={(e) => {
                  const val =
                    e.target.value === "all"
                      ? "all"
                      : parseInt(e.target.value, 10);
                  setCatalogPageSize(val as any);
                  setCatalogPage(1);
                }}
                className="bg-black border border-surface-border text-xs rounded px-2.5 py-2 text-white focus:outline-none focus:border-accent"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={200}>200 / page</option>
                <option value="all">All ({catalogTotal})</option>
              </select>
            </div>

            {(catalogSearch || catalogAlbumFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setCatalogSearch("");
                  setCatalogAlbumFilter("all");
                  setCatalogPage(1);
                }}
                className="px-2.5 py-1.5 bg-black border border-surface-border rounded text-xs text-accent hover:text-white transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Bulk Selection Action Bar (Appears when items are selected) */}
          {selectedPhotoIDs.length > 0 && (
            <div className="sticky top-4 z-40 bg-surface border border-accent/60 rounded-sm p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-in fade-in duration-200">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={toggleSelectAllCurrentPage}
                  className="p-1 text-white hover:text-accent transition-colors"
                  title={
                    isAllCurrentPageSelected
                      ? "Deselect current page"
                      : "Select all on current page"
                  }
                >
                  {isAllCurrentPageSelected ? (
                    <CheckSquare className="w-4 h-4 text-accent" />
                  ) : (
                    <MinusSquare className="w-4 h-4 text-accent" />
                  )}
                </button>
                <div className="text-xs text-white">
                  <strong className="text-accent font-semibold">
                    {selectedPhotoIDs.length}
                  </strong>{" "}
                  photo{selectedPhotoIDs.length === 1 ? "" : "s"} selected
                  {selectedPhotoIDs.length < catalogTotal && (
                    <button
                      type="button"
                      onClick={selectAllMatching}
                      className="ml-2 text-accent hover:underline font-medium"
                    >
                      Select all {catalogTotal} matching
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="ml-2.5 text-muted hover:text-white underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Bulk Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkAlbumChoice(availableAlbums[0] || "");
                    setBulkCustomAlbum("");
                    setActiveBulkModal("addAlbum");
                  }}
                  className="px-2.5 py-1.5 bg-black border border-surface-border text-gray-200 hover:text-white hover:border-accent rounded text-xs transition-colors flex items-center space-x-1.5"
                  title="Add selected photos to an album"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-accent" />
                  <span>Add to Album</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkTagsInput("");
                    setActiveBulkModal("addTags");
                  }}
                  className="px-2.5 py-1.5 bg-black border border-surface-border text-gray-200 hover:text-white hover:border-accent rounded text-xs transition-colors flex items-center space-x-1.5"
                  title="Add tag(s) to selected photos"
                >
                  <Tag className="w-3.5 h-3.5 text-accent" />
                  <span>Add Tag(s)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkAlbumChoice(availableAlbums[0] || "");
                    setActiveBulkModal("removeAlbum");
                  }}
                  className="px-2.5 py-1.5 bg-black border border-surface-border text-gray-200 hover:text-white hover:border-red-400 rounded text-xs transition-colors flex items-center space-x-1.5"
                  title="Remove selected photos from an album"
                >
                  <Folder className="w-3.5 h-3.5 text-gray-400" />
                  <span>Remove Album</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkRemoveTagInput("");
                    setActiveBulkModal("removeTag");
                  }}
                  className="px-2.5 py-1.5 bg-black border border-surface-border text-gray-200 hover:text-white hover:border-red-400 rounded text-xs transition-colors flex items-center space-x-1.5"
                  title="Remove a tag from selected photos"
                >
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  <span>Remove Tag</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveBulkModal("delete")}
                  className="px-2.5 py-1.5 bg-red-950/30 border border-red-900/60 text-red-400 hover:bg-red-900/40 hover:border-red-500 rounded text-xs transition-colors flex items-center space-x-1.5"
                  title="Permanently delete all selected photos"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedPhotoIDs.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Top Pagination & Summary Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={toggleSelectAllCurrentPage}
                className="p-1 text-muted hover:text-white transition-colors"
                title={
                  isAllCurrentPageSelected
                    ? "Deselect current page"
                    : "Select all on current page"
                }
              >
                {isAllCurrentPageSelected ? (
                  <CheckSquare className="w-4 h-4 text-accent" />
                ) : selectedPhotoIDs.length > 0 ? (
                  <MinusSquare className="w-4 h-4 text-accent" />
                ) : (
                  <Square className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <span>
                Showing{" "}
                <strong className="text-white">
                  {catalogTotal === 0
                    ? 0
                    : catalogPageSize === "all"
                    ? 1
                    : (catalogPage - 1) * (catalogPageSize as number) + 1}
                  –
                  {catalogPageSize === "all"
                    ? catalogTotal
                    : Math.min(
                        catalogPage * (catalogPageSize as number),
                        catalogTotal
                      )}
                </strong>{" "}
                of <strong className="text-white">{catalogTotal}</strong>{" "}
                photographs
              </span>
            </div>

            {/* Pagination Controls */}
            {catalogTotalPages > 1 && catalogPageSize !== "all" && (
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage(1)}
                  className="p-1.5 rounded border border-surface-border bg-black text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-surface-border bg-black text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="px-2 py-1 text-xs text-muted">
                  Page <strong className="text-white">{catalogPage}</strong> of{" "}
                  {catalogTotalPages}
                </span>

                <button
                  type="button"
                  disabled={catalogPage >= catalogTotalPages}
                  onClick={() =>
                    setCatalogPage((p) => Math.min(catalogTotalPages, p + 1))
                  }
                  className="p-1.5 rounded border border-surface-border bg-black text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={catalogPage >= catalogTotalPages}
                  onClick={() => setCatalogPage(catalogTotalPages)}
                  className="p-1.5 rounded border border-surface-border bg-black text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Loading indicator */}
          {isLoadingCatalog ? (
            <div className="py-20 text-center text-xs text-muted font-mono bg-surface border border-surface-border rounded-sm">
              Loading photograph catalog...
            </div>
          ) : catalogPhotos.length > 0 ? (
            <div className="bg-surface border border-surface-border rounded-sm overflow-hidden divide-y divide-surface-border">
              {catalogPhotos.map((item) => {
                const isSelected = selectedPhotoIDs.includes(item.photoID);
                return (
                  <div
                    key={item.photoID}
                    className={`p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                      isSelected ? "bg-accent/5" : "hover:bg-black/40"
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleSelectPhoto(item.photoID)}
                        className="p-1 text-muted hover:text-white transition-colors flex-shrink-0"
                        title={isSelected ? "Deselect" : "Select"}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-600" />
                        )}
                      </button>

                      {/* Thumbnail */}
                      <Link
                        href={`/photo/${encodeURIComponent(item.photoID)}`}
                        target="_blank"
                        className="w-16 h-12 bg-black rounded overflow-hidden flex-shrink-0 border border-surface-border hover:border-accent transition-colors block"
                      >
                        <img
                          src={`/api/thumbnail?src=${encodeURIComponent(
                            item.imageDesktop
                          )}&w=120`}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </Link>

                      {/* Photo details */}
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/photo/${encodeURIComponent(item.photoID)}`}
                          target="_blank"
                          className="text-sm font-medium text-white truncate block hover:text-accent transition-colors"
                        >
                          {item.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <code className="text-accent font-mono text-[11px]">
                            {item.photoID}
                          </code>
                          <span>&bull;</span>
                          <span>
                            {item.dateTaken?.year}-
                            {String(item.dateTaken?.month || 1).padStart(2, "0")}
                            -{String(item.dateTaken?.day || 1).padStart(2, "0")}
                          </span>
                          {item.categories && item.categories.length > 0 && (
                            <>
                              <span>&bull;</span>
                              <span className="truncate max-w-[240px] text-gray-400">
                                {item.categories.join(", ")}
                              </span>
                            </>
                          )}
                          {item.keywords && item.keywords.length > 0 && (
                            <>
                              <span>&bull;</span>
                              <span className="truncate max-w-[200px] text-gray-500 text-[11px]">
                                {item.keywords.slice(0, 3).join(", ")}
                                {item.keywords.length > 3
                                  ? ` +${item.keywords.length - 3}`
                                  : ""}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 self-end sm:self-center flex-shrink-0">
                      <Link
                        href={`/photo/${encodeURIComponent(item.photoID)}`}
                        target="_blank"
                        className="px-3 py-1.5 bg-black border border-surface-border text-gray-300 hover:text-white rounded text-xs transition-colors inline-flex items-center space-x-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3 text-muted" />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            id: item.photoID,
                            title: item.title,
                          })
                        }
                        className="px-3 py-1.5 bg-red-950/20 border border-red-900/40 text-red-400 hover:bg-red-900/30 hover:border-red-600 rounded text-xs transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-surface border border-surface-border rounded-sm space-y-2">
              <p className="text-gray-400 text-xs">
                No photographs found matching your search.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCatalogSearch("");
                  setCatalogAlbumFilter("all");
                  setCatalogPage(1);
                }}
                className="text-accent text-xs underline"
              >
                Clear search filter
              </button>
            </div>
          )}

          {/* Bottom Pagination Controls */}
          {catalogTotalPages > 1 && catalogPageSize !== "all" && (
            <div className="flex items-center justify-between border-t border-surface-border pt-4 text-xs text-muted">
              <div>
                Page <strong className="text-white">{catalogPage}</strong> of{" "}
                <strong className="text-white">{catalogTotalPages}</strong>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage(1)}
                  className="p-1.5 rounded border border-surface-border bg-black text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-surface-border bg-black text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={catalogPage >= catalogTotalPages}
                  onClick={() =>
                    setCatalogPage((p) => Math.min(catalogTotalPages, p + 1))
                  }
                  className="p-1.5 rounded border border-surface-border bg-black text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={catalogPage >= catalogTotalPages}
                  onClick={() => setCatalogPage(catalogTotalPages)}
                  className="p-1.5 rounded border border-surface-border bg-black text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* BULK MODAL: Add to Album */}
          {activeBulkModal === "addAlbum" && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-surface-border rounded-sm max-w-md w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-full bg-accent/20 border border-accent/40 text-accent flex-shrink-0">
                    <FolderPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-white">
                      Add to Album
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      Add{" "}
                      <strong className="text-white">
                        {selectedPhotoIDs.length}
                      </strong>{" "}
                      selected photograph
                      {selectedPhotoIDs.length === 1 ? "" : "s"} to an album.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-gray-300 font-medium mb-1.5">
                      Choose Existing Album
                    </label>
                    <select
                      value={bulkAlbumChoice}
                      onChange={(e) => {
                        setBulkAlbumChoice(e.target.value);
                        setBulkCustomAlbum("");
                      }}
                      className="w-full bg-black border border-surface-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent"
                    >
                      {availableAlbums.map((alb) => (
                        <option key={alb} value={alb}>
                          {alb}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-300 font-medium mb-1.5">
                      Or Create New Album Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Blue Ridge Parkway"
                      value={bulkCustomAlbum}
                      onChange={(e) => setBulkCustomAlbum(e.target.value)}
                      className="w-full bg-black border border-surface-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveBulkModal(null)}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-black border border-surface-border rounded text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-accent text-black font-semibold rounded text-xs hover:bg-accent-light transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>
                      {isExecutingBulk ? "Adding..." : "Add to Album"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BULK MODAL: Remove Album */}
          {activeBulkModal === "removeAlbum" && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-surface-border rounded-sm max-w-md w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-full bg-red-950/40 border border-red-800 text-red-400 flex-shrink-0">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-white">
                      Remove from Album
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      Remove an album from{" "}
                      <strong className="text-white">
                        {selectedPhotoIDs.length}
                      </strong>{" "}
                      selected photograph
                      {selectedPhotoIDs.length === 1 ? "" : "s"}.
                    </p>
                  </div>
                </div>

                <div className="text-xs space-y-2">
                  <label className="block text-gray-300 font-medium">
                    Select Album to Remove
                  </label>
                  <select
                    value={bulkAlbumChoice}
                    onChange={(e) => setBulkAlbumChoice(e.target.value)}
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent"
                  >
                    {availableAlbums.map((alb) => (
                      <option key={alb} value={alb}>
                        {alb}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveBulkModal(null)}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-black border border-surface-border rounded text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded text-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <span>
                      {isExecutingBulk ? "Removing..." : "Remove Album"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BULK MODAL: Add Tag(s) */}
          {activeBulkModal === "addTags" && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-surface-border rounded-sm max-w-md w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-full bg-accent/20 border border-accent/40 text-accent flex-shrink-0">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-white">
                      Add Tags
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      Add tags to{" "}
                      <strong className="text-white">
                        {selectedPhotoIDs.length}
                      </strong>{" "}
                      selected photograph
                      {selectedPhotoIDs.length === 1 ? "" : "s"}.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-gray-300 font-medium mb-1.5">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. sunrise, ocean, landscape"
                      value={bulkTagsInput}
                      onChange={(e) => setBulkTagsInput(e.target.value)}
                      className="w-full bg-black border border-surface-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent"
                    />
                  </div>

                  {metadata.popularTags && metadata.popularTags.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-muted">
                        Quick add popular tags:
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {metadata.popularTags.slice(0, 15).map(({ tag }) => (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => {
                              const parts = bulkTagsInput
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean);
                              if (
                                !parts.some(
                                  (p) => p.toLowerCase() === tag.toLowerCase()
                                )
                              ) {
                                setBulkTagsInput([...parts, tag].join(", "));
                              }
                            }}
                            className="px-2 py-0.5 bg-black border border-surface-border rounded text-[11px] text-gray-300 hover:text-accent hover:border-accent transition-colors"
                          >
                            +{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveBulkModal(null)}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-black border border-surface-border rounded text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-accent text-black font-semibold rounded text-xs hover:bg-accent-light transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>{isExecutingBulk ? "Adding..." : "Add Tags"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BULK MODAL: Remove Tag */}
          {activeBulkModal === "removeTag" && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-surface-border rounded-sm max-w-md w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-full bg-red-950/40 border border-red-800 text-red-400 flex-shrink-0">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-white">
                      Remove Tag
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      Remove a tag from{" "}
                      <strong className="text-white">
                        {selectedPhotoIDs.length}
                      </strong>{" "}
                      selected photograph
                      {selectedPhotoIDs.length === 1 ? "" : "s"}.
                    </p>
                  </div>
                </div>

                <div className="text-xs space-y-2">
                  <label className="block text-gray-300 font-medium">
                    Tag Name to Remove
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. mist"
                    value={bulkRemoveTagInput}
                    onChange={(e) => setBulkRemoveTagInput(e.target.value)}
                    className="w-full bg-black border border-surface-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveBulkModal(null)}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-black border border-surface-border rounded text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded text-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <span>
                      {isExecutingBulk ? "Removing..." : "Remove Tag"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BULK MODAL: Bulk Delete Confirmation */}
          {activeBulkModal === "delete" && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-surface-border rounded-sm max-w-lg w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-full bg-red-950/40 border border-red-800 text-red-400 flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-white">
                      Permanently Delete {selectedPhotoIDs.length} Photographs?
                    </h3>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      You are about to permanently delete{" "}
                      <strong className="text-white">
                        {selectedPhotoIDs.length}
                      </strong>{" "}
                      photographs from your library and storage.
                    </p>
                  </div>
                </div>

                <div className="bg-black/60 border border-red-900/50 rounded p-3 text-xs text-gray-300 space-y-2">
                  <p className="text-red-300 font-medium text-[11px] uppercase tracking-wider">
                    Permanent File Deletion:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-400 pl-1">
                    <li>
                      All companion <code>_desktop.jpg</code> web images and
                      original fullsize JPEG files will be unlinked from disk.
                    </li>
                    <li>
                      Companion <code>.txt</code> metadata records will be
                      deleted.
                    </li>
                    <li>
                      All entries will be permanently removed from{" "}
                      <code>data/photos.json</code>.
                    </li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted">
                    Selected Photographs ({selectedPhotoIDs.length}):
                  </span>
                  <div className="bg-black border border-surface-border rounded p-2.5 max-h-36 overflow-y-auto space-y-1 text-xs font-mono text-gray-400">
                    {selectedPhotoIDs.slice(0, 50).map((id) => {
                      const p = catalogPhotos.find((x) => x.photoID === id);
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="text-accent">{id}</span>
                          <span className="text-gray-300 truncate max-w-[240px]">
                            {p ? p.title : ""}
                          </span>
                        </div>
                      );
                    })}
                    {selectedPhotoIDs.length > 50 && (
                      <div className="text-[10px] text-muted pt-1 italic">
                        ...and {selectedPhotoIDs.length - 50} more
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveBulkModal(null)}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-black border border-surface-border rounded text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBulkAction}
                    disabled={isExecutingBulk}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded text-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {isExecutingBulk
                        ? "Deleting..."
                        : `Permanently Delete ${selectedPhotoIDs.length} Photos`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SINGLE PHOTO Confirmation Modal */}
          {confirmDelete && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-surface border border-surface-border rounded-sm max-w-md w-full p-6 space-y-5 shadow-2xl relative">
                <div className="flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-full bg-red-950/40 border border-red-800 text-red-400 flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-white">
                      Permanently Delete Photograph?
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Are you sure you want to delete{" "}
                      <strong className="text-white">
                        &ldquo;{confirmDelete.title}&rdquo;
                      </strong>{" "}
                      (ID:{" "}
                      <code className="text-accent font-mono">
                        {confirmDelete.id}
                      </code>
                      )?
                    </p>
                  </div>
                </div>

                <div className="bg-black/60 border border-surface-border rounded p-3 text-xs text-gray-400 space-y-1">
                  <p className="text-red-300 font-medium text-[11px] uppercase tracking-wider">
                    This action will permanently delete:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-400 pl-1">
                    <li>Desktop web JPEG and original fullsize file from disk</li>
                    <li>
                      Companion <code>.txt</code> metadata record
                    </li>
                    <li>
                      Catalog entry in <code>data/photos.json</code>
                    </li>
                  </ul>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    disabled={isDeletingPhoto}
                    className="px-4 py-2 bg-black border border-surface-border rounded text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    disabled={isDeletingPhoto}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded text-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {isDeletingPhoto ? "Deleting..." : "Permanently Delete"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SITE & THEME SETTINGS */}
      {activeTab === "settings" && (
        <div className="space-y-8">
          <form onSubmit={handleSaveSettings} className="space-y-8">
          {/* Theme Palette & Accent Colors */}
          <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5 text-accent" />
                <span>Theme Accent Color</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted">Active:</span>
                <span
                  className="w-4 h-4 rounded-full border border-white/20 inline-block shadow-sm"
                  style={{ backgroundColor: settings.themeAccent }}
                />
                <code className="text-xs font-mono text-white">
                  {settings.themeAccent}
                </code>
              </div>
            </div>

            <p className="text-xs text-muted">
              Choose an accent palette for interactive highlights, map pins,
              buttons, and progress indicators across the entire site.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              {THEME_PRESETS.map((preset) => {
                const isSelected =
                  settings.themeAccent.toLowerCase() ===
                  preset.accent.toLowerCase();
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => {
                      setSettings((prev) => ({
                        ...prev,
                        themeAccent: preset.accent,
                        themeAccentLight: preset.light,
                        themeAccentDark: preset.dark,
                      }));
                    }}
                    className={`flex items-center space-x-3 p-3 rounded border text-left transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent"
                        : "border-surface-border bg-black hover:border-gray-600"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex-shrink-0 border border-white/20 shadow-sm"
                      style={{ backgroundColor: preset.accent }}
                    />
                    <div className="truncate">
                      <span className="block text-xs font-medium text-white truncate">
                        {preset.name}
                      </span>
                      <span className="block text-[10px] font-mono text-muted">
                        {preset.accent}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Color Picker */}
            <div className="pt-2 flex items-center space-x-3">
              <label className="text-xs text-muted">Custom Hex:</label>
              <input
                type="color"
                value={settings.themeAccent}
                onChange={(e) => {
                  const hex = e.target.value;
                  setSettings((prev) => ({
                    ...prev,
                    themeAccent: hex,
                    themeAccentLight: hex,
                    themeAccentDark: hex,
                  }));
                }}
                className="w-8 h-8 rounded border border-surface-border bg-black cursor-pointer p-0"
              />
              <input
                type="text"
                value={settings.themeAccent}
                onChange={(e) => {
                  const hex = e.target.value;
                  setSettings((prev) => ({
                    ...prev,
                    themeAccent: hex,
                    themeAccentLight: hex,
                    themeAccentDark: hex,
                  }));
                }}
                placeholder="#f59e0b"
                className="w-28 bg-black border border-surface-border rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Theme Background & Gallery Atmosphere */}
          <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-accent" />
                <span>Gallery Background & Atmosphere</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted">Active:</span>
                <span
                  className="w-4 h-4 rounded-full border border-white/20 inline-block shadow-sm"
                  style={{ backgroundColor: settings.themeBackground || "#000000" }}
                />
                <code className="text-xs font-mono text-white">
                  {settings.themeBackground || "#000000"}
                </code>
              </div>
            </div>

            <p className="text-xs text-muted">
              Select the backdrop tone for the gallery. Fine-art photography can be framed on pure OLED black, soft obsidian, midnight slate, or warm espresso.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {BACKGROUND_PRESETS.map((preset) => {
                const isSelected =
                  (settings.themeBackground || "#000000").toLowerCase() ===
                  preset.background.toLowerCase();
                return (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => {
                      setSettings((prev) => ({
                        ...prev,
                        themeBackground: preset.background,
                        themeSurface: preset.surface,
                        themeBorder: preset.border,
                      }));
                    }}
                    className={`flex items-center space-x-3 p-3 rounded border text-left transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent"
                        : "border-surface-border bg-black hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center -space-x-1 flex-shrink-0">
                      <span
                        className="w-5 h-5 rounded-full border border-white/30 shadow-sm"
                        style={{ backgroundColor: preset.background }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: preset.surface }}
                      />
                    </div>
                    <div className="truncate">
                      <span className="block text-xs font-medium text-white truncate">
                        {preset.name}
                      </span>
                      <span className="block text-[10px] font-mono text-muted">
                        {preset.background}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Background Color Picker */}
            <div className="pt-2 flex items-center space-x-3">
              <label className="text-xs text-muted">Custom Background Hex:</label>
              <input
                type="color"
                value={settings.themeBackground || "#000000"}
                onChange={(e) => {
                  const hex = e.target.value;
                  setSettings((prev) => ({
                    ...prev,
                    themeBackground: hex,
                  }));
                }}
                className="w-8 h-8 rounded border border-surface-border bg-black cursor-pointer p-0"
              />
              <input
                type="text"
                value={settings.themeBackground || "#000000"}
                onChange={(e) => {
                  const hex = e.target.value;
                  setSettings((prev) => ({
                    ...prev,
                    themeBackground: hex,
                  }));
                }}
                placeholder="#000000"
                className="w-28 bg-black border border-surface-border rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Catalog Sort Order */}
          <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
            <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider border-b border-surface-border pb-3">
              <ArrowUpDown className="w-3.5 h-3.5 text-accent" />
              <span>Default Catalog & Gallery Sort Order</span>
            </div>

            <p className="text-xs text-muted">
              Controls the default ordering of photographs in Galleries, All
              Photographs, and adjacent previous/next photo links.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: "date-desc",
                  label: "Capture Date (Newest First)",
                  desc: "Chronological order based on camera exposure timestamp",
                },
                {
                  id: "date-asc",
                  label: "Capture Date (Oldest First)",
                  desc: "Historical progression starting from earliest film captures",
                },
                {
                  id: "created-desc",
                  label: "Recently Added (Newest Uploads First)",
                  desc: "Sort by upload time so newly published work appears first",
                },
                {
                  id: "title-asc",
                  label: "Alphabetical by Title (A to Z)",
                  desc: "Cataloged alphabetically by photograph title",
                },
              ].map((opt) => {
                const isSelected = settings.defaultSortOrder === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        defaultSortOrder: opt.id as any,
                      }))
                    }
                    className={`p-4 rounded border text-left transition-all ${
                      isSelected
                        ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent"
                        : "border-surface-border bg-black hover:border-gray-600"
                    }`}
                  >
                    <span className="block text-xs font-medium text-white">
                      {opt.label}
                    </span>
                    <span className="block text-[11px] text-muted pt-1">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slideshow & Studio Identity */}
          <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm">
            <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider border-b border-surface-border pb-3">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>Slideshow & Studio Identity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-200">
                  Slideshow Interval (seconds)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={settings.slideshowInterval || 10}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        slideshowInterval: parseInt(e.target.value, 10),
                      }))
                    }
                    className="flex-1 accent-accent"
                  />
                  <span className="text-xs font-mono text-accent w-10">
                    {settings.slideshowInterval || 10}s
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-200">
                  Artist Name
                </label>
                <input
                  type="text"
                  value={settings.artistName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      artistName: e.target.value,
                    }))
                  }
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-medium text-gray-200">
                  Site Title
                </label>
                <input
                  type="text"
                  value={settings.siteTitle}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      siteTitle: e.target.value,
                    }))
                  }
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-medium text-gray-200">
                  Site Tagline / Description
                </label>
                <input
                  type="text"
                  value={settings.siteTagline}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      siteTagline: e.target.value,
                    }))
                  }
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {settingsSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-700 rounded text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                Settings successfully saved! Theme and sort order applied.
              </span>
            </div>
          )}

          {/* Save Button */}
          <div>
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-8 py-3.5 bg-accent text-black font-semibold text-xs uppercase tracking-wider rounded hover:bg-accent-light transition-all shadow-lg flex items-center space-x-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSavingSettings ? "Saving Settings..." : "Save Settings"}
              </span>
            </button>
          </div>
        </form>

        {/* Security & Admin Passphrase Form */}
        <div className="space-y-4 bg-surface border border-surface-border p-6 rounded-sm mt-8">
          <div className="flex items-center space-x-2 text-xs font-medium text-gray-200 uppercase tracking-wider border-b border-surface-border pb-3">
            <Lock className="w-3.5 h-3.5 text-accent" />
            <span>Security & Admin Passphrase</span>
          </div>

          <p className="text-xs text-muted">
            Update your administrative passphrase used to sign in to this management dashboard.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-300">
                  Current Password
                </label>
                <input
                  type="password"
                  placeholder="Current passphrase"
                  value={currentPasswordChange}
                  onChange={(e) => setCurrentPasswordChange(e.target.value)}
                  required
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-300">
                  New Password (min 6 chars)
                </label>
                <input
                  type="password"
                  placeholder="New passphrase"
                  value={newPasswordChange}
                  onChange={(e) => setNewPasswordChange(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  placeholder="Repeat new passphrase"
                  value={confirmPasswordChange}
                  onChange={(e) => setConfirmPasswordChange(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-black border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {passwordChangeError && (
              <p className="text-xs text-red-400 font-medium">{passwordChangeError}</p>
            )}

            {passwordChangeSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-700 rounded text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{passwordChangeSuccess}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="px-6 py-2.5 bg-black border border-surface-border hover:border-accent text-white font-medium text-xs uppercase tracking-wider rounded transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-accent" />
                <span>
                  {isUpdatingPassword ? "Updating..." : "Change Password"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
    </div>
  );
}
